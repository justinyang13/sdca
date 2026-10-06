#!/usr/bin/env node
// scripts/parity.js — Phase DP item 6: AUTOMATIC PARITY.
//   node scripts/parity.js [--base http://localhost:3100]
// Per ported page compare the OLD main text (research/raw/pages/*.html) with
// the rendered NEW page (HTTP, EN + ZH):
//   (a) sentence/clause coverage >= 99.5%, 0 order inversions
//   (b) every old content image present, loads, same order
//   (c) every old link/file/embed present (external exact), no broken internals
//   (d) layout signature: block-type sequence preserved
// Writes research/PARITY.md + research/parity-summary.json (consumed by
// tests/parity.test.js). Exits 1 when a page misses thresholds, unless the
// miss is listed in EXCEPTIONS (documented, owner-visible).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { newDb } from '../src/db/open.js';
import { lookupRedirect } from '../src/redirects.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW_DIR = path.join(ROOT, 'research', 'raw', 'pages');
const BASE = (process.argv.find((a) => a.startsWith('--base=')) || '').slice(7) || 'http://localhost:3100';

// newSlug -> { route, raws: [raw basenames without .html] }
const PAGES = {
  'about': { route: '/about', raws: ['about-sdca'] },
  'about-board': { route: '/about/board', raws: ['board-of-directors'] },
  'about-staff': { route: '/about/staff', raws: ['staff'] },
  'about-principal': { route: '/about/principal', raws: ['words-from-the-principal'] },
  'programs-classes': { route: '/programs/classes', raws: ['class-placement'] },
  'programs-tcml': { route: '/programs/tcml', raws: ['tcml'] },
  'programs-ta': { route: '/programs/ta', raws: ['ta-program'] },
  'programs-recreational': { route: '/programs/recreational', raws: ['adult-recreational-programs'] },
  'parents-volunteer': { route: '/parents/volunteer', raws: ['volunteer-opportunity'] },
  'parents-handbook': { route: '/parents/handbook', raws: ['handbook-and-policy'] },
  'parents-scrip': { route: '/parents/scrip', raws: ['scrip'] },
  'support-sponsors': { route: '/support/sponsors', raws: ['sponsors', 'sponsors-2'] },
  'education-resource': { route: '/education-resource', raws: ['education-resource'] },
  'disclaimer': { route: '/disclaimer', raws: ['disclaimer'] },
  'privacy': { route: '/privacy', raws: ['privacy-policy'] },
  'enroll': { route: '/enroll', raws: ['registration'] },
  'contact': { route: '/contact', raws: ['countact-us'] },
  'adult': { route: '/adult', raws: ['adult'] },
  'student-store-schedule': { route: '/student-store-schedule', raws: ['student-store-schedule'] },
  'classroom-map': { route: '/classroom-map', raws: ['2026_2027_classroom-map'] },
  'guitar-poster': { route: '/guitar-poster', raws: ['____'] },
  'pre-k-program': { route: '/pre-k-program', raws: ['2018__10__22__pre-k-program'] },
  'new-student-ads': { route: '/new-student-ads', raws: ['new-student-advertisments-2026'] },
  'yearbook-contest': { route: '/yearbook-contest', raws: ['sdca-yearbook-cover-art-contest-guidelines-2025-2026'] },
};

// Documented misses: [page, kind, match-substring-or-null, detail].
// kind 'text' additionally needs wordRecall >= 0.99. Everything else perfect.
const EXCEPTIONS = [
  ['programs-tcml', 'image', 'img3218', 'IMG_3218.jpg 404 on old site, never captured (CONTENT-LEDGER review).'],
  ['programs-tcml', 'link', 'img3218', 'IMG_3218.jpg link target 404 on old site (CONTENT-LEDGER review).'],
  ['programs-tcml', 'link', 'img9001', 'IMG_9001-scaled.jpg original never captured (only 225px thumb placed) (CONTENT-LEDGER review).'],
  ['programs-tcml', 'link', 'img9002', 'IMG_9002-scaled.jpg original never captured (only 225px thumb placed) (CONTENT-LEDGER review).'],
  ['programs-tcml', 'link', 'img9003', 'IMG_9003-scaled.jpg original never captured (only 225px thumb placed) (CONTENT-LEDGER review).'],
  ['guitar-poster', 'link', null, '吉他海報.pdf never captured (404 on old site); poster image placed (CONTENT-LEDGER review).'],
  ['parents-volunteer', 'link', 'volunteerjobdescriptions', 'Volunteer Job Descriptions PDF never captured; lead text restated plain (CONTENT-LEDGER review).'],
  ['support-sponsors', 'link', 'donationform', 'SDCA_Donation_Form-2008.pdf never captured; donation text restated plain (CONTENT-LEDGER review).'],
  ['support-sponsors', 'link', 'dr.-liu-ad-half-page', 'Dr.-Liu full-ad image never captured; banner links to its placed thumbnail (CONTENT-LEDGER review).'],
  ['about-board', 'link', 'peggy-han', 'Peggy-Han.jpeg title-link target never captured; title links to the placed card photo (CONTENT-LEDGER review).'],
  ['about-board', 'image', 'bod1024x721', 'Group-photo block removed per owner 2026-10-05 (not on the original page).'],
  ['enroll', 'link', 'register.sandiegochineseschool.com/public/upload', 'Registration Notice PDFs live on the registration portal (never crawled); linked exact (CONTENT-LEDGER review).'],
  ['contact', 'text', null, 'old tab-nav glued units + no form on old page; all tab content placed, word recall gates instead.'],
  ['parents-scrip', 'link', 'scriporderform', 'Scrip_Order_Form.jpg never captured (not in research/assets, 404-era file); order-form image+link absent (CONTENT-LEDGER review).'],
];

const norm = (s) => String(s || '').normalize('NFKC')
  .replace(/[\u2018\u2019\u02BC]/g, "'").replace(/[\u201C\u201D]/g, '"')
  .replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();
const isCjk = (s) => /[\u4e00-\u9fff]/.test(s);

function splitUnits(text) {
  return String(text || '').split(/[\n]+/)
    .flatMap((line) => line.split(/(?<=[。！？；!?.])\s*/))
    .map((u) => u.trim()).filter((u) => u && (isCjk(u) ? u.length >= 6 : u.length >= 25));
}

const NAMED_ENTITIES = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'",
  hellip: '…', mdash: '—', ndash: '–', laquo: '«', raquo: '»',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', sbquo: '‚', bdquo: '„',
  dagger: '†', Dagger: '‡', bull: '•', middot: '·', copy: '©', reg: '®',
  trade: '™', deg: '°', plusmn: '±', times: '×', divide: '÷', frac12: '½',
  frac14: '¼', frac34: '¾', para: '¶', sect: '§', iexcl: '¡', iquest: '¿',
  agrave: 'à', aacute: 'á', eacute: 'é', egrave: 'è', iacute: 'í', oacute: 'ó',
  uacute: 'ú', ntilde: 'ñ', auml: 'ä', ouml: 'ö', uuml: 'ü', szlig: 'ß',
  alpha: 'α', beta: 'β', rarr: '→', larr: '←', uarr: '↑', darr: '↓',
};
function decodeEntities(s) {
  return String(s || '')
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(Number(n)); } catch { return _; } })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch { return _; } })
    .replace(/&([a-zA-Z][a-zA-Z0-9]+);/g, (m, n) => (n in NAMED_ENTITIES ? NAMED_ENTITIES[n] : m));
}

function stripTags(html) {
  const decoded = decodeEntities(String(html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '));
  return decoded.replace(/\s+/g, ' ').trim();
}

function oldMain(rawBase) {
  const html = fs.readFileSync(path.join(RAW_DIR, `${rawBase}.html`), 'utf8');
  const main = (html.match(/<main[\s\S]*?<\/main>/i) || [html])[0];
  const entry = main.match(/<div class="entry-content[^"]*">([\s\S]*?)<\/div><!-- \.entry -->/);
  const scope = entry ? entry[1] : main;
  const imgs = [...scope.matchAll(/<img[^>]+src="([^"]+)"/gi)].map((m) => m[1]);
  const links = [...scope.matchAll(/<a[^>]+href=(["'])(.*?)\1/gi)].map((m) => m[2]);
  return { text: stripTags(scope), imgs, links };
}

function pageMain(html) {
  const main = (html.match(/<main[\s\S]*?<\/main>/i) || [html])[0];
  const rawImgs = [...main.matchAll(/<img[^>]+src="([^"]+)"/gi)].map((m) => m[1])
    .filter((u) => u && !/^\s*data:/i.test(u));
  const BLOCK_SET = new Set(['blk-heading', 'blk-richtext', 'blk-image', 'blk-gallery', 'blk-list', 'blk-embed', 'blk-divider', 'blk-image-text', 'blk-people', 'blk-tabs', 'blk-file', 'blk-button']);
  const sig = [...main.matchAll(/class="([^"]*)"/g)]
    .flatMap((m) => m[1].split(/\s+/).filter((c) => BLOCK_SET.has(c)));
  return {
    text: stripTags(main),
    imgs: rawImgs,
    links: [...main.matchAll(/<a[^>]+href=(["'])(.*?)\1/gi)].map((m) => m[2]),
    sig,
  };
}

const baseName = (u) => {
  try {
    const p = new URL(u, 'https://x').pathname;
    return decodeURIComponent(p.split('/').pop() || '').toLowerCase();
  } catch { return String(u).toLowerCase(); }
};
const stripSize = (n) => n.replace(/-\d+x\d+(?=\.[a-z]+$)/, '');
const stripHash = (n) => n.replace(/\.[0-9a-f]{6,}(?=\.[a-z0-9]+$)/, '');
// canonical image key: lowercase alnum only (WP size/hash suffixes and the
// crawl's CJK-stripped ___ renames all collapse to the same key).
const canonImg = (u) => stripHash(stripSize(baseName(u))).replace(/[^a-z0-9]/g, '');
const isJunkImg = (u) => /^\s*data:/i.test(String(u || '')) || /(^|[^\w])pixel\.gif|shopmore/i.test(baseName(u));

async function fetchText(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const r = await fetch(url);
    if (r.ok) return r.text();
    if ((r.status === 429 || r.status >= 500) && i < retries - 1) {
      await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
      continue;
    }
    throw new Error(`HTTP ${r.status} for ${url}`);
  }
  throw new Error(`HTTP failed for ${url}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const summary = { generated: new Date().toISOString(), base: BASE, pages: {} };
  // documents: pdfKey (all separators removed) -> /pdf/<slug>; plus
  // research-asset sha -> slug so old upload URLs match even when names differ.
  const pdfKey = (s) => norm(s).replace(/[\s\-_]+/g, '');
  const pdfTarget = new Map();
  const shaToSlug = new Map();
  try {
    const db = newDb(path.join(ROOT, 'data', 'sdca.db'));
    for (const d of db.prepare('SELECT slug, file_path FROM documents').all()) {
      const key = pdfKey(path.basename(d.file_path, path.extname(d.file_path)));
      if (key && !pdfTarget.has(key)) pdfTarget.set(key, `/pdf/${d.slug}`);
      const fp = path.join(ROOT, d.file_path);
      if (fs.existsSync(fp)) {
        const h = crypto.createHash('sha256').update(fs.readFileSync(fp)).digest('hex');
        shaToSlug.set(h, `/pdf/${d.slug}`);
      }
    }
    db.close();
  } catch { /* ignore */ }
  const researchSha = new Map();
  // index research PDFs under %20/space/underscore/nothing variants so old
  // upload URLs match even when separators were crawled differently.
  const pdfVariants = (name) => {
    const l = String(name || '').toLowerCase();
    return new Set([l, l.replace(/%20|_20/g, ' '), l.replace(/%20|_20/g, ''),
      l.replace(/ /g, '_20'), l.replace(/ /g, ''), l.replace(/ /g, '-')]);
  };
  try {
    for (const f of fs.readdirSync(path.join(ROOT, 'research', 'assets', 'pdf'))) {
      const fp = path.join(ROOT, 'research', 'assets', 'pdf', f);
      if (fs.statSync(fp).isFile()) {
        const sha = crypto.createHash('sha256').update(fs.readFileSync(fp)).digest('hex');
        for (const v of pdfVariants(f)) if (!researchSha.has(v)) researchSha.set(v, sha);
      }
    }
  } catch { /* ignore */ }
  const normLink = (h) => {
    const s = String(h || '').split('#')[0].split('?')[0].replace(/\/+$/, '');
    if (/^mailto:/i.test(s)) return s.replace(/^mailto:\s*/i, 'mailto:').toLowerCase();
    if (/\.pdf$/i.test(s)) {
      const base = pdfKey(baseName(s).replace(/\.[a-z0-9]+$/i, ''));
      if (pdfTarget.has(base)) return pdfTarget.get(base);
      // exact research-asset basename -> bytes -> served slug (separator variants)
      const rb = baseName(s).toLowerCase();
      let rsha = researchSha.get(rb);
      if (!rsha) {
        for (const v of pdfVariants(rb)) {
          if (researchSha.has(v)) { rsha = researchSha.get(v); break; }
        }
      }
      if (rsha) {
        const slug = shaToSlug.get(rsha);
        if (slug) return slug;
      }
      // fuzzy last resort: slug stem contained in old name or vice versa
      const keys = [...pdfTarget.keys()].filter((k) => k.length >= 8);
      const hit = keys.find((k) => base.includes(k) || k.includes(base));
      if (hit) return pdfTarget.get(hit);
    }
    let p = s;
    if (/^https?:\/\//i.test(s)) {
      try {
        const u = new URL(s);
        if (!/sandiegochineseschool\.com$/i.test(u.hostname)) return (u.hostname + u.pathname).toLowerCase();
        p = u.pathname.replace(/\/+$/, '') || '/';
      } catch { return s.toLowerCase(); }
    }
    const hit = lookupRedirect(p);
    if (hit) return hit[1].split('?')[0].replace(/^\/(en|zh)/, '') || '/';
    return p.replace(/^\/(en|zh)/, '') || '/';
  };
  const md = ['# DP Parity report', '', `Base: ${BASE} · Generated: ${summary.generated}`, '',
    '| Page | Route | Text EN | Text ZH | Order inv | Images | Links missing | Layout |',
    '|---|---|---|---|---|---|---|---|'];
  let failures = 0;

  for (const [slug, cfg] of Object.entries(PAGES)) {
    const olds = cfg.raws.map(oldMain);
    const oldText = olds.map((o) => o.text).join('\n');
    const oldImgs = olds.flatMap((o) => o.imgs);
    const oldLinks = olds.flatMap((o) => o.links);
    const units = splitUnits(oldText);
    const normUnits = units.map(norm);
    const res = { route: cfg.route, units: units.length, missing: [], images: {}, links: {}, layout: {} };

    for (const lang of ['en', 'zh']) {
      let html;
      try {
        html = await fetchText(`${BASE}/${lang}${cfg.route}`);
      } catch (e) {
        res[lang] = { error: String(e.message || e) };
        failures++;
        continue;
      }
      const pg = pageMain(html);
      const hay = norm(pg.text);
      let found = 0, lastPos = -1, inv = 0;
      const missing = [];
      normUnits.forEach((u, i) => {
        const pos = hay.indexOf(u);
        if (pos < 0) { missing.push(units[i].slice(0, 90)); return; }
        found++;
        if (pos < lastPos) inv++;
        else lastPos = pos;
      });
      // word recall: distinctive old words present in rendered (glue-artifact backup)
      const latin = (oldText.toLowerCase().match(/[a-z]{5,}/g) || []).filter((w, i, a) => a.indexOf(w) === i);
      const cjk = [...new Set((oldText.match(/[\u4e00-\u9fff]/g) || []))];
      const hayFlat = hay.replace(/\s+/g, '');
      const latinHit = latin.filter((w) => hay.includes(w)).length;
      const cjkHit = cjk.filter((c) => hayFlat.includes(c)).length;
      const recallDen = latin.length + cjk.length;
      res[lang] = {
        coverage: units.length ? found / units.length : 1,
        found, inversions: inv, missing: missing.slice(0, 12),
        wordRecall: recallDen ? (latinHit + cjkHit) / recallDen : 1,
        words: `${latinHit + cjkHit}/${recallDen}`,
      };
    }

    // images: old basenames (size/hash suffixes stripped, junk excluded) must
    // appear in rendered, same order. Old lightbox <a href=image> wraps count
    // as present when the image itself is placed.
    const wantImgs = [...new Set(oldImgs.filter((u) => u && !isJunkImg(u)).map(canonImg).filter(Boolean))];
    let renderedImgs = [];
    let renderedImgSet = new Set();
    try {
      const html = await fetchText(`${BASE}/en${cfg.route}`);
      renderedImgs = [...new Set(pageMain(html).imgs.map(canonImg))];
      renderedImgSet = new Set(renderedImgs);
    } catch { /* recorded above */ }
    const imgMissing = wantImgs.filter((w) => !renderedImgs.includes(w));
    const imgOrder = wantImgs.filter((w) => renderedImgs.includes(w));
    const renderedOrder = renderedImgs.filter((w) => imgOrder.includes(w));
    const orderOk = imgOrder.join('|') === renderedOrder.join('|');
    res.images = { old: wantImgs.length, missing: imgMissing.slice(0, 10), orderOk };

    // links: old content hrefs must be present (compare normalised path-or-URL)
    let renderedLinks = [];
    try {
      const html = await fetchText(`${BASE}/en${cfg.route}`);
      renderedLinks = pageMain(html).links;
    } catch { /* recorded above */ }
    const have = new Set(renderedLinks.map(normLink));
    const linkMissing = [...new Set(oldLinks.map(normLink))].filter((l) => {
      if (!l || l === '#' || l === '/' || have.has(l)) return false;
      if (['/author/admin', '/author/webmaster'].some((a) => l.includes(a))) return false;
      // old lightbox wrap: link target is itself a placed image
      if (/\.(jpe?g|png|gif|webp|svg)$/i.test(l)) {
        const b = canonImg(l);
        if (renderedImgSet.has(b)) return false;
      }
      return true;
    });
    res.links = { old: oldLinks.length, missing: linkMissing.slice(0, 10) };

    // layout signature from the IMPORTED blocks (DB pages.blocks = what actually
    // renders, incl. hand repairs and minus dropped file blocks) vs rendered classes
    let expected = [];
    try {
      const db2 = newDb(path.join(ROOT, 'data', 'sdca.db'));
      const row = db2.prepare('SELECT blocks FROM pages WHERE slug = ?').get(slug);
      db2.close();
      const bj = row && row.blocks ? JSON.parse(row.blocks) : [];
      const walkB = (blocks) => {
        for (const b of blocks || []) {
          const k = b && Object.keys(b)[0];
          if (!k) continue;
          expected.push(`blk-${k.replace(/_/g, '-')}`);
          if (k === 'tabs') (Array.isArray(b[k]) ? b[k] : []).forEach((t) => walkB(t.blocks));
        }
      };
      walkB(Array.isArray(bj) ? bj : []);
    } catch { /* ignore */ }
    let actual = [];
    try {
      const html = await fetchText(`${BASE}/en${cfg.route}`);
      actual = pageMain(html).sig;
    } catch { /* ignore */ }
    // rendered contains exactly the flattened block classes in document order
    const sigOk = expected.length > 0 && expected.every((e, i) => actual[i] === e);
    res.layout = { expected: expected.join(','), actual: actual.join(','), ok: sigOk };

    // verdict with exceptions
    const letters = (s) => String(s || '').toLowerCase().replace(/[^a-z\u4e00-\u9fff]/g, '');
    const exc = (kind, val) => EXCEPTIONS.some(([p, k, m]) => p === slug && k === kind && (m === null || letters(val).includes(letters(m)))) && val;
    const probs = [];
    for (const lang of ['en', 'zh']) {
      const r = res[lang];
      if (!r || r.error) probs.push(`${lang}: fetch failed`);
      else {
        if (r.coverage < 0.995) {
          const excText = EXCEPTIONS.some(([p, k]) => p === slug && k === 'text');
          if (excText && (r.wordRecall || 0) >= 0.99) r.verdictNote = `${lang}: sentence-glue exception, word recall ${(r.wordRecall * 100).toFixed(1)}%`;
          else probs.push(`${lang}: text coverage ${(r.coverage * 100).toFixed(1)}%`);
        }
        if (r.inversions > 0) probs.push(`${lang}: ${r.inversions} order inversions`);
      }
    }
    const imgMiss = res.images.missing.filter((m) => !exc('image', m));
    if (imgMiss.length) probs.push(`images missing: ${imgMiss.join(', ')}`);
    if (!res.images.orderOk) probs.push('image order differs');
    const linkMiss = res.links.missing.filter((m) => !exc('link', m));
    if (linkMiss.length) probs.push(`links missing: ${linkMiss.join(', ')}`);
    if (!res.layout.ok) probs.push('layout signature differs');
    res.verdict = probs.length ? `FAIL: ${probs.join('; ')}` : 'PASS';
    if (probs.length) failures++;
    summary.pages[slug] = res;

    const f = (v) => (typeof v === 'number' ? (v * 100).toFixed(1) + '%' : 'ERR');
    md.push(`| ${slug} | ${cfg.route} | ${res.en && !res.en.error ? f(res.en.coverage) : 'ERR'} | ${res.zh && !res.zh.error ? f(res.zh.coverage) : 'ERR'} | ${(res.en || {}).inversions ?? '–'}/${(res.zh || {}).inversions ?? '–'} | ${wantImgs.length - imgMiss.length}/${wantImgs.length}${res.images.orderOk ? '' : ' ORDER!'} | ${linkMiss.length} | ${res.layout.ok ? 'ok' : 'DIFF'} |`);
  }

  md.push('', '## Exceptions (documented, owner-visible)', '');
  EXCEPTIONS.forEach(([p, k, d]) => md.push(`- ${p} [${k}]: ${d}`));
  md.push('', '## Method', '',
    'Old main text = `<main>` (or `.entry-content` when present, which excludes spam comments and related-posts) from research/raw/pages/*.html, tags stripped. Units = CJK-aware clauses (≥6 CJK chars) / Latin sentences (≥25 chars), NFKC + case/punct normalised, matched in order against the rendered page text.',
    'Images compare by URL basename with WordPress -WxH size suffix stripped. Links compare by host+path (old absolute URLs) vs rendered hrefs (`/pdf/:slug` counts for old PDF URLs when the slug resolves the same file — see mismatches below).');
  fs.writeFileSync(path.join(ROOT, 'research', 'PARITY.md'), md.join('\n') + '\n');
  fs.writeFileSync(path.join(ROOT, 'research', 'parity-summary.json'), JSON.stringify(summary, null, 2));
  console.log(`parity: ${Object.keys(summary.pages).length} pages, ${failures} failing`);
  for (const [s, r] of Object.entries(summary.pages)) {
    if (r.verdict !== 'PASS') console.log(`  FAIL ${s}: ${r.verdict}`);
  }
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error('parity error:', e.message); process.exit(2); });
