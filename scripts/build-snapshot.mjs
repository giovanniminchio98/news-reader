// Builds per-language snapshots of all feeds (fetch → parse → translate).
// Runs in GitHub Actions every 30 min. Output: data/snapshot.<lang>.json
// Translation cache persisted at data/.tcache.json (kept warm via actions/cache).

import { XMLParser } from 'fast-xml-parser';
import fs from 'node:fs/promises';
import { JOURNALS, CAT_ORDER, UI_LANGS } from './journals.mjs';

const PER_FEED   = 18;     // items kept per feed
const FULL_TXT_N = 6;      // translate full text for the top N items per feed (native stays free for all)
const FULL_CAP   = 7000;   // max chars of full text per article
const CACHE_FILE = 'data/.tcache.json';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', cdataPropName: '__cdata', trimValues: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── fetch: direct first (good UA), then public proxies as fallback ──────────
async function fetchText(url) {
  const attempts = [
    url,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  ];
  for (const u of attempts) {
    for (let tryN = 0; tryN < 2; tryN++) {
      try {
        const r = await fetch(u, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EuroPressBot/1.0; +https://github.com)', 'Accept': 'application/rss+xml, application/xml, text/xml, */*' },
          signal: AbortSignal.timeout(20000),
        });
        if (r.ok) { const t = await r.text(); if (t && t.length > 200 && t.includes('<')) return t; }
      } catch { /* next */ }
      await sleep(400);
    }
  }
  return null;
}

// ── parsing helpers ─────────────────────────────────────────────────────────
function asText(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object') return v.__cdata || v['#text'] || '';
  return '';
}
function strip(html) { return asText(html).replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim(); }
function toParas(html) {
  let t = asText(html);
  if (!t) return [];
  t = t.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
       .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, '\n\n')
       .replace(/<br\s*\/?>/gi, '\n')
       .replace(/<[^>]*>/g, '')
       .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&#39;|&rsquo;/gi, "'").replace(/&quot;/gi, '"');
  return t.split(/\n{2,}/).map(s => s.replace(/\s+/g, ' ').trim()).filter(s => s.length > 1);
}
function firstLink(it) {
  let l = it.link;
  if (Array.isArray(l)) { const alt = l.find(x => !x['@_rel'] || x['@_rel'] === 'alternate') || l[0]; l = alt; }
  if (l && typeof l === 'object') return l['@_href'] || asText(l);
  return asText(l) || asText(it.guid);
}
function parseFeed(xml) {
  const doc = parser.parse(xml);
  const chan = doc?.rss?.channel || doc?.['rdf:RDF'] || doc?.feed || {};
  let items = chan.item || doc?.['rdf:RDF']?.item || doc?.feed?.entry || [];
  if (!items) return [];
  if (!Array.isArray(items)) items = [items];
  return items.map(it => {
    const cat = Array.isArray(it.category) ? asText(it.category[0]) : asText(it.category);
    const full = toParas(it['content:encoded']);
    return {
      title: strip(it.title),
      desc: strip(it.description || it.summary),
      link: String(firstLink(it) || ''),
      pubDate: String(asText(it.pubDate) || asText(it.published) || asText(it.updated) || asText(it['dc:date']) || asText(it.date) || ''),
      cat: cat ? cat.slice(0, 28) : '',
      fullParas: full.join(' ').length > 600 ? capParas(full) : [],
    };
  }).filter(a => a.title);
}
function capParas(paras) { const out = []; let n = 0; for (const p of paras) { if (n > FULL_CAP) break; out.push(p); n += p.length; } return out; }
function tdate(s) { const t = Date.parse(s); return isNaN(t) ? 0 : t; }

// ── translation (free gtx endpoint, batched, cached) ────────────────────────
let tcache = {};
async function gtx(text, sl, tl) {
  const api = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(api, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20000) });
      if (r.ok) { const d = await r.json(); return (d[0] || []).map(s => (s && s[0]) ? s[0] : '').join(''); }
    } catch { /* retry */ }
    await sleep(600 * (i + 1));
  }
  return null;
}
async function translateLines(lines, sl, tl) {
  if (sl === tl) return lines.slice();
  const out = new Array(lines.length);
  const need = [], idx = [];
  lines.forEach((l, i) => {
    if (!l) { out[i] = ''; return; }
    const k = `${sl}>${tl}:${l}`;
    if (tcache[k] != null) out[i] = tcache[k]; else { need.push(l); idx.push(i); }
  });
  let b = [], bi = [], size = 0;
  const flush = async () => {
    if (!b.length) return;
    const res = await gtx(b.join('\n'), sl, tl);
    const parts = res != null ? res.split('\n') : null;
    const good = parts && parts.length === b.length;
    b.forEach((l, j) => {
      const val = good ? parts[j] : l;          // fall back to original on failure
      out[bi[j]] = val;
      if (good) tcache[`${sl}>${tl}:${l}`] = val; // but NEVER cache a fallback — retry it next run
    });
    b = []; bi = []; size = 0;
    if (good) await sleep(200);
  };
  for (let j = 0; j < need.length; j++) {
    const l = need[j];
    if (size + l.length > 1200 && b.length) await flush();
    b.push(l); bi.push(idx[j]); size += l.length + 1;
  }
  await flush();
  return out;
}

// ── build ───────────────────────────────────────────────────────────────────
async function main() {
  try { tcache = JSON.parse(await fs.readFile(CACHE_FILE, 'utf8')); } catch { tcache = {}; }
  const ts = Date.now();
  const snap = {};
  UI_LANGS.forEach(L => { snap[L] = { ts, intervalMin: 30, journals: {} }; });

  let feedsOk = 0, feedsFail = 0;
  for (const j of JOURNALS) {
    UI_LANGS.forEach(L => { snap[L].journals[j.id] = {}; });
    const cats = CAT_ORDER.filter(k => j.feeds[k]);
    for (const cat of cats) {
      const xml = await fetchText(j.feeds[cat]);
      let arts = [];
      if (xml) { try { arts = parseFeed(xml); } catch { arts = []; } }
      if (arts.length) feedsOk++; else feedsFail++;
      arts.sort((a, b) => tdate(b.pubDate) - tdate(a.pubDate));
      arts = arts.slice(0, PER_FEED);

      for (const L of UI_LANGS) {
        const [tT, tD] = await Promise.all([
          translateLines(arts.map(a => a.title), j.lang, L),
          translateLines(arts.map(a => a.desc), j.lang, L),
        ]);
        const outArr = [];
        for (let i = 0; i < arts.length; i++) {
          const a = arts[i];
          let f;
          if (a.fullParas.length) {
            if (j.lang === L) f = a.fullParas;                 // native language: full text is free
            else if (i < FULL_TXT_N) {                          // others: translate only the top N
              const tf = await translateLines(a.fullParas, j.lang, L);
              if (tf && tf.length) f = tf;
            }
          }
          outArr.push({
            t: tT[i] || a.title, d: tD[i] || a.desc, l: a.link, p: a.pubDate, c: a.cat, s: j.lang,
            ...(j.lang !== L ? { o: a.title } : {}),
            ...(f ? { f } : {}),
          });
        }
        snap[L].journals[j.id][cat] = outArr;
      }
      console.log(`  ${j.id}/${cat}: ${arts.length} items`);
    }
  }

  await fs.mkdir('data', { recursive: true });
  for (const L of UI_LANGS) await fs.writeFile(`data/snapshot.${L}.json`, JSON.stringify(snap[L]));
  await fs.writeFile(CACHE_FILE, JSON.stringify(tcache));
  console.log(`Done. feeds ok=${feedsOk} fail=${feedsFail}, cache entries=${Object.keys(tcache).length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
