// Builds per-language snapshots of all feeds (fetch → parse). No translation:
// each UI language shows sources in its own language.
//   en, fi  → English-language sources (international news in English)
//   it      → Italian-language sources
// Other-language sources stay defined in journals.mjs but are not shown.
// Runs in GitHub Actions every 30 min. Output: data/snapshot.<lang>.json

import { XMLParser } from 'fast-xml-parser';
import fs from 'node:fs/promises';
import { JOURNALS, CAT_ORDER, UI_LANGS } from './journals.mjs';

const PER_FEED = 20;   // items kept per feed
const FULL_CAP = 8000; // max chars of full text per article

// which source languages each UI language displays
const SHOW_FOR = L => (L === 'it' ? ['it'] : ['en']);

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
function capParas(paras) { const out = []; let n = 0; for (const p of paras) { if (n > FULL_CAP) break; out.push(p); n += p.length; } return out; }
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
function tdate(s) { const t = Date.parse(s); return isNaN(t) ? 0 : t; }

// ── build ───────────────────────────────────────────────────────────────────
async function main() {
  const ts = Date.now();
  const snap = {};
  UI_LANGS.forEach(L => { snap[L] = { ts, intervalMin: 30, journals: {} }; });

  let feedsOk = 0, feedsFail = 0;
  for (const j of JOURNALS) {
    const langsShowing = UI_LANGS.filter(L => SHOW_FOR(L).includes(j.lang));
    if (!langsShowing.length) continue; // kept in config but not shown (e.g. fr/es/de)
    langsShowing.forEach(L => { snap[L].journals[j.id] = {}; });
    const cats = CAT_ORDER.filter(k => j.feeds[k]);
    for (const cat of cats) {
      const xml = await fetchText(j.feeds[cat]);
      let arts = [];
      if (xml) { try { arts = parseFeed(xml); } catch { arts = []; } }
      if (arts.length) feedsOk++; else feedsFail++;
      arts.sort((a, b) => tdate(b.pubDate) - tdate(a.pubDate));
      arts = arts.slice(0, PER_FEED);
      const outArr = arts.map(a => ({
        t: a.title, d: a.desc, l: a.link, p: a.pubDate, c: a.cat, s: j.lang,
        ...(a.fullParas.length ? { f: a.fullParas } : {}),
      }));
      langsShowing.forEach(L => { snap[L].journals[j.id][cat] = outArr; });
      console.log(`  ${j.id}/${cat}: ${arts.length} items`);
    }
  }

  await fs.mkdir('data', { recursive: true });
  for (const L of UI_LANGS) await fs.writeFile(`data/snapshot.${L}.json`, JSON.stringify(snap[L]));
  console.log(`Done. feeds ok=${feedsOk} fail=${feedsFail}`);
}

main().catch(e => { console.error(e); process.exit(1); });
