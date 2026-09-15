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
const NAMED = { amp:'&', lt:'<', gt:'>', quot:'"', apos:"'", nbsp:' ', hellip:'…',
  mdash:'—', ndash:'–', rsquo:'’', lsquo:'‘', ldquo:'“', rdquo:'”', bdquo:'„',
  laquo:'«', raquo:'»', euro:'€', deg:'°', copy:'©', reg:'®', trade:'™' };
function decodeEntities(s) {
  if (!s || s.indexOf('&') < 0) return s || '';
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, x) => { try { return String.fromCodePoint(parseInt(x, 16)); } catch { return _; } })
    .replace(/&#(\d+);/g, (_, d) => { try { return String.fromCodePoint(parseInt(d, 10)); } catch { return _; } })
    .replace(/&([a-zA-Z]+);/g, (m, n) => (NAMED[n] !== undefined ? NAMED[n] : m));
}
function strip(html) { return decodeEntities(asText(html).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim(); }
function toParas(html) {
  let t = asText(html);
  if (!t) return [];
  t = t.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
       .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, '\n\n')
       .replace(/<br\s*\/?>/gi, '\n')
       .replace(/<[^>]*>/g, '');
  t = decodeEntities(t);
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

// ── translation: probe once, then use only providers that work from this runner
// gtx (Google) is blocked on datacenter IPs; Lingva (Google proxy) and MyMemory
// are fallbacks. We detect what works up front so a dead provider never stalls the build.
let tcache = {};
const PROV = { gtx: 0, lingva: 0, mymemory: 0, fail: 0 };
const T = 8000; // per-request timeout
const LINGVA_HOSTS = ['lingva.ml', 'lingva.garudalinux.org', 'translate.plausibility.cloud', 'lingva.lunar.icu', 'translate.dr460nf1r3.org'];
let LINGVA_HOST = null;        // pinned to the first mirror that answered in the probe
const WORKING = [];            // ordered [name, fn, multiline] of providers that passed the probe

async function provGtx(text, sl, tl) {
  const api = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
  try {
    const r = await fetch(api, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, signal: AbortSignal.timeout(T) });
    if (!r.ok) return null;
    const body = await r.text();
    if (body.trimStart().startsWith('<')) return null; // Google "Sorry…" block page
    const out = (JSON.parse(body)[0] || []).map(s => (s && s[0]) ? s[0] : '').join('');
    return out || null;
  } catch { return null; }
}
async function lingvaAt(host, text, sl, tl) {
  const r = await fetch(`https://${host}/api/v1/${sl}/${tl}/${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(T) });
  if (!r.ok) return null;
  const d = await r.json();
  return (d && typeof d.translation === 'string' && d.translation.trim()) ? d.translation : null;
}
async function provLingva(text, sl, tl) {
  if (!LINGVA_HOST) return null;
  try { return await lingvaAt(LINGVA_HOST, text, sl, tl); } catch { return null; }
}
async function provMyMemory(text, sl, tl) {
  try {
    const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sl}|${tl}`, { signal: AbortSignal.timeout(T) });
    if (!r.ok) return null;
    const tr = (await r.json())?.responseData?.translatedText;
    if (tr && typeof tr === 'string' && !/MYMEMORY WARNING|QUOTA|INVALID/i.test(tr)) return tr;
  } catch { /* ignore */ }
  return null;
}

async function probeProviders() {
  const s = 'Bonjour le monde, ceci est un simple test de traduction.';
  const g = await provGtx(s, 'fr', 'en');
  for (const host of LINGVA_HOSTS) {
    try { if (await lingvaAt(host, s, 'fr', 'en')) { LINGVA_HOST = host; break; } } catch { /* next */ }
  }
  const m = await provMyMemory(s, 'fr', 'en');
  if (g) WORKING.push(['gtx', provGtx, true]);
  if (LINGVA_HOST) WORKING.push(['lingva', provLingva, true]);
  if (m) WORKING.push(['mymemory', provMyMemory, false]);
  console.log(`PROVIDER PROBE  gtx:${g ? 'OK' : 'FAIL'}  lingva:${LINGVA_HOST || 'FAIL'}  mymemory:${m ? 'OK' : 'FAIL'}`);
  console.log('WORKING providers:', WORKING.map(w => w[0]).join(', ') || 'NONE — articles stay in original language');
}

// translate one batch (newline-joined); returns per-line text + success flags
async function translateBatch(lines, sl, tl) {
  const q = lines.join('\n');
  for (const [name, fn, multiline] of WORKING) {
    if (!multiline) continue;
    const out = await fn(q, sl, tl);
    if (out != null) {
      const parts = out.split('\n');
      if (parts.length === lines.length) { PROV[name] += lines.length; return { parts, ok: lines.map(() => true) }; }
    }
  }
  // per-line fallback (only providers that passed the probe; MyMemory only for short strings)
  const parts = [], ok = [];
  for (const ln of lines) {
    let done = false;
    for (const [name, fn, multiline] of WORKING) {
      if (!multiline && ln.length >= 480) continue;
      const t = await fn(ln, sl, tl);
      if (t != null) { parts.push(t); ok.push(true); PROV[name]++; done = true; break; }
    }
    if (!done) { parts.push(ln); ok.push(false); PROV.fail++; }
  }
  return { parts, ok };
}

async function translateLines(lines, sl, tl) {
  if (sl === tl || !WORKING.length) return lines.slice(); // no provider → keep original, fast
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
    const { parts, ok } = await translateBatch(b, sl, tl);
    b.forEach((l, j) => {
      out[bi[j]] = parts[j];
      if (ok[j]) tcache[`${sl}>${tl}:${l}`] = parts[j]; // never cache a fallback
    });
    b = []; bi = []; size = 0;
    await sleep(80);
  };
  for (let j = 0; j < need.length; j++) {
    const l = need[j];
    if (size + l.length > 1000 && b.length) await flush();
    b.push(l); bi.push(idx[j]); size += l.length + 1;
  }
  await flush();
  return out;
}

// ── build ───────────────────────────────────────────────────────────────────
async function main() {
  try { tcache = JSON.parse(await fs.readFile(CACHE_FILE, 'utf8')); } catch { tcache = {}; }
  await probeProviders();
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
            t: decodeEntities(tT[i] || a.title), d: decodeEntities(tD[i] || a.desc), l: a.link, p: a.pubDate, c: a.cat, s: j.lang,
            ...(j.lang !== L ? { o: decodeEntities(a.title) } : {}),
            ...(f ? { f: f.map(decodeEntities) } : {}),
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
  console.log(`TRANSLATION via gtx=${PROV.gtx} lingva=${PROV.lingva} mymemory=${PROV.mymemory} fail=${PROV.fail}`);
}

main().catch(e => { console.error(e); process.exit(1); });
