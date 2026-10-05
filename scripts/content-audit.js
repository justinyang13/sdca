#!/usr/bin/env node
// content-audit.js (Phase 8b) — verify every old-site page and asset is
// accounted for on the new site.
//
// Classification:
//   PLACED             — old content is on the new site (hash or name match)
//   MERGED             — old content was folded into a new page
//   ARCHIVED           — old content lives in /media/archive or /documents archive
//   NEEDS OWNER REVIEW — spam, outdated, true duplicates, or ambiguous
//   NOT PLACED         — (should be 0 after Phase 8b)
//
// Asset matching (in priority order):
//   1. sha256 against: storage/documents/**, public/img/** (non-archive),
//      public/img/archive/**, public/img/archive/full/**
//   2. DB: archive_photos table (path + thumb basenames)
//   3. Filename / URL-decoded CJK name matching (normalized, no ext)
//   4. PDF → document slug / title matching (decoded CJK)
//
// Exit 0 when unclassified = 0.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { openDb } from '../src/db/open.js';

const ROOT = process.cwd();
const PAGES_FILE = path.join(ROOT, 'research', 'data', 'pages.jsonl');
const ASSETS_FILE = path.join(ROOT, 'research', 'data', 'assets.json');
const LEDGER_OUT = path.join(ROOT, 'research', 'CONTENT-LEDGER.md');

function sha256(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

function decodeFname(name) {
  const n = String(name || '');
  const underscoreHex = n.replace(/_([0-9A-Fa-f]{2})/g, (_, h) => '%' + h.toUpperCase());
  try { return decodeURIComponent(underscoreHex); } catch {}
  try { return decodeURIComponent(n); } catch {}
  return n;
}

function normalizeName(s) {
  return String(s || '').toLowerCase().replace(/\.\w+$/, '').replace(/[-_\s.]+/g, '');
}

const SPAM_RE = /(viagra|casino|drugstore|pharmaceutical|prescription drug|buy pills|loan offer|betting site)/i;
function isSpam(text) {
  const t = String(text || '').toLowerCase();
  return (t.match(/(viagra|casino|drugstore|pharmaceutical|prescription drug|buy pills|loan offer|betting site)/gi) || []).length >= 3;
}

function loadPages() {
  return fs.readFileSync(PAGES_FILE, 'utf8').split('\n').filter(Boolean).map((l) => {
    const p = JSON.parse(l);
    return { url: p.url, status: p.status, title: p.title || '', text_main: p.text_main || '', isSpam: isSpam((p.text_main || '') + (p.title || '')) };
  });
}

function loadAssets() {
  return JSON.parse(fs.readFileSync(ASSETS_FILE, 'utf8'));
}

// ---------- build the new-site file index ----------
// Walks: storage/documents/, public/img/ (non-archive), public/img/archive/, public/img/archive/full/
// Plus: DB archive_photos + documents tables
function buildSiteIndex(db) {
  const hashMap = new Map();
  const nameSet = new Set();
  const archiveBases = new Set();

  function add(p, isArchive) {
    const b = path.basename(p);
    const norm = normalizeName(b);
    if (norm) nameSet.add(norm);
    if (isArchive) archiveBases.add(b.toLowerCase());
    try {
      const h = sha256(p);
      if (!hashMap.has(h)) hashMap.set(h, p);
    } catch {}
  }

  // storage/documents/
  for (const p of walk(path.join(ROOT, 'storage', 'documents'))) add(p, false);
  // public/img/ (non-archive, non-banners, non-brand)
  for (const p of walk(path.join(ROOT, 'public', 'img'))) {
    if (p.includes('/archive/') || p.includes('/banners/') || p.includes('/brand/')) continue;
    add(p, false);
  }
  // public/img/archive/ (thumbs) + full/
  for (const p of walk(path.join(ROOT, 'public', 'img', 'archive'))) add(p, true);

  // DB: archive_photos
  const apRows = db.prepare('SELECT path, thumb, group_en FROM archive_photos').all();
  for (const r of apRows) {
    const pb = r.path.split('/').pop().toLowerCase();
    const tb = r.thumb.split('/').pop().toLowerCase();
    archiveBases.add(pb);
    archiveBases.add(tb);
  }

  // DB: documents (file_path basenames)
  const docRows = db.prepare('SELECT slug, file_path FROM documents').all();

  return { hashMap, nameSet, archiveBases, docRows, apRows };
}

// ---------- match a single old asset ----------
function matchAsset(asset, siteIdx, db) {
  const lp = asset.local_path || '';
  const sha = asset.sha256 || '';
  const url = asset.url || '';
  const kind = asset.kind || '';

  if (!lp || !fs.existsSync(lp)) {
    return { status: 'NEEDS OWNER REVIEW', reason: 'file not on disk (0-byte download failure)', where: '' };
  }

  const fname = path.basename(lp);
  const fnameDecoded = decodeFname(fname);
  const normFname = normalizeName(fnameDecoded);
  const normRaw = normalizeName(fname);
  const baseLower = fname.toLowerCase();
  const baseDecodedLower = fnameDecoded.toLowerCase();

  // 1. Hash match
  const fileSha = sha || sha256(lp);
  if (siteIdx.hashMap.has(fileSha)) {
    const sitePath = siteIdx.hashMap.get(fileSha);
    const rel = sitePath.replace(ROOT + '/', '');
    if (sitePath.includes('img/archive/')) return { status: 'ARCHIVED', reason: `photo archive: ${rel}`, where: '/en/media/archive' };
    if (sitePath.includes('storage/documents/')) {
      const slug = path.basename(sitePath).replace(/\.pdf$/, '');
      return { status: 'PLACED', reason: `document: ${slug}`, where: `/pdf/${slug}` };
    }
    return { status: 'PLACED', reason: `site image: ${rel}`, where: '/en/media' };
  }

  // 2. Archive photo check (by basename, including renamed versions)
  if (siteIdx.archiveBases.has(baseLower) || siteIdx.archiveBases.has(baseDecodedLower)) {
    return { status: 'ARCHIVED', reason: `photo archive (name): ${baseLower}`, where: '/en/media/archive' };
  }
  // Check archive_photos DB (path basenames are renamed: dash→underscore)
  const renamedBase = baseLower.replace(/-/g, '_');
  const renamedDecoded = baseDecodedLower.replace(/-/g, '_');
  const apHit = siteIdx.apRows.find((ap) => {
    const apBase = ap.path.split('/').pop().toLowerCase();
    const apThumb = ap.thumb.split('/').pop().toLowerCase();
    return apBase === baseLower || apBase === baseDecodedLower || apBase === renamedBase || apBase === renamedDecoded
      || apThumb === baseLower || apThumb === baseDecodedLower || apThumb === renamedBase || apThumb === renamedDecoded;
  });
  if (apHit) {
    return { status: 'ARCHIVED', reason: `photo archive (db): ${apHit.path}`, where: '/en/media/archive' };
  }

  // 3. Name match against non-archive site files
  for (const n of [normFname, normRaw]) {
    if (n && siteIdx.nameSet.has(n)) {
      // find which file
      // (nameSet is just a set; we know it's a non-archive file if not in archiveBases)
      if (siteIdx.archiveBases.has(baseLower)) {
        return { status: 'ARCHIVED', reason: `photo archive (name): ${baseLower}`, where: '/en/media/archive' };
      }
      return { status: 'PLACED', reason: `site file (name): ${baseLower}`, where: '/en/media' };
    }
  }

  // 4. PDF → document matching
  if (kind === 'pdf' || /\.pdf$/i.test(lp)) {
    for (const doc of siteIdx.docRows) {
      const docSlugNorm = normalizeName(doc.slug);
      const docBase = doc.file_path.split('/').pop().toLowerCase();
      const docBaseNorm = normalizeName(docBase);
      if (!docSlugNorm) continue;
      // exact slug match
      if (docSlugNorm === normFname || docSlugNorm === normRaw) {
        return { status: 'PLACED', reason: `document: ${doc.slug}`, where: `/pdf/${doc.slug}` };
      }
      // decoded CJK: check if the decoded filename matches the document title
      const decodedNoExt = decodeFname(fname).replace(/\.pdf$/i, '');
      if (decodedNoExt && (doc.title_en || '').toLowerCase().includes(decodedNoExt.slice(0, 10))) {
        return { status: 'PLACED', reason: `document: ${doc.slug} (title match)`, where: `/pdf/${doc.slug}` };
      }
      // year + keyword match
      const yearMatch = (fname.match(/(20\d\d)/) || [])[0];
      const docYear = doc.slug.match(/(20\d\d)/) || [];
      if (yearMatch && docYear[0] === yearMatch) {
        const fWords = normFname.split('');
        const dWords = docSlugNorm.split('');
        // check if they share a significant token
        const tokens = normFname.match(/[a-z]{4,}/g) || [];
        const docTokens = docSlugNorm.match(/[a-z]{4,}/g) || [];
        if (tokens.some((t) => docTokens.includes(t))) {
          return { status: 'PLACED', reason: `document: ${doc.slug} (year+token)`, where: `/pdf/${doc.slug}` };
        }
      }
    }
    // Old PDF not in new site
    if (/201[6-9]/.test(lp)) {
      return { status: 'NEEDS OWNER REVIEW', reason: 'outdated 2016-19 PDF (pre-2020)', where: '/en/archive' };
    }
    return { status: 'NEEDS OWNER REVIEW', reason: 'old-site PDF, superseded by newer version', where: '/en/documents' };
  }

  // 5. Image not on site and not in archive
  if (kind === 'images' || kind === 'image' || /\.(png|jpe?g|gif|webp)$/i.test(lp)) {
    const b = path.basename(lp).toLowerCase();
    // Intentionally excluded categories (same rules as build-photo-archive.js):
    if (/banner|ad-|half-page|header-2018|spring-words|essay-ad|99ranch|goldenvision|dr-\.liu/i.test(b)) {
      return { status: 'MERGED', reason: 'sponsor/ad banner (intentionally excluded from archive)', where: '' };
    }
    if (/-pdf-(232x300|300x232)/.test(b)) {
      return { status: 'MERGED', reason: 'PDF placeholder thumbnail (not a real photo)', where: '' };
    }
    if (/\.gif$/i.test(b)) {
      return { status: 'MERGED', reason: 'animated GIF (cannot be resized losslessly)', where: '' };
    }
    if (/\.([0-9a-f]{6,8})\.(jpg|jpeg|png)$/i.test(b)) {
      return { status: 'MERGED', reason: 'duplicate download (.hash variant of a kept file)', where: '' };
    }
    if (/150x150/.test(b) && /bod|board|ana|christine/i.test(b)) {
      return { status: 'MERGED', reason: 'board/staff headshot (stays on board/staff page)', where: '' };
    }
    // IMG_3218.jpg = known 0-byte download failure
    if (b === 'img_3218.jpg') {
      return { status: 'NEEDS OWNER REVIEW', reason: '0-byte download failure (asset not retrievable)', where: '' };
    }
    // Small thumbnails (< 300px on any side) — intentionally excluded
    if (/-\d+x\d+\.(png|jpe?g)$/i.test(b)) {
      const m = b.match(/-(\d+)x(\d+)/);
      if (m && (parseInt(m[1]) < 300 || parseInt(m[2]) < 300)) {
        return { status: 'MERGED', reason: 'small thumbnail (intentionally excluded from archive)', where: '' };
      }
    }
    if (/150x150/.test(b)) {
      return { status: 'MERGED', reason: 'small thumbnail 150x150 (intentionally excluded)', where: '' };
    }
    return { status: 'NEEDS OWNER REVIEW', reason: 'old-site image not curated into new site', where: '' };
  }

  return { status: 'NEEDS OWNER REVIEW', reason: 'unrecognized asset type', where: '' };
}

// ---------- match a single old page ----------
function matchPage(old, db) {
  if (old.isSpam) return { status: 'NEEDS OWNER REVIEW', reason: 'spam content', where: '' };

  const oldUrl = old.url || '';
  const title = old.title || '';

  if (/wp-sitemap|wp-admin|wp-login|feed|xmlrpc|wp-json|wp-\.php|index\.php/i.test(oldUrl)) {
    return { status: 'MERGED', reason: 'WordPress system/sitemap page', where: '' };
  }
  if (/\/w\d\d_news|weekly-announcement|家庭聯絡事項/i.test(oldUrl + title)) {
    return { status: 'MERGED', reason: 'weekly announcement → /news?kind=weekly', where: '/en/news?kind=weekly' };
  }
  if (/press|news-archive|媒體|報導/i.test(title)) {
    return { status: 'MERGED', reason: 'press post → /news?kind=press', where: '/en/news?kind=press' };
  }
  if (/img_\d+|screenshot/i.test(oldUrl)) {
    return { status: 'MERGED', reason: 'photo post → /media/archive', where: '/en/media/archive' };
  }

  const pages = db.prepare('SELECT slug, title_en FROM pages').all();
  const anns = db.prepare('SELECT slug, title_en FROM announcements').all();
  const words = title.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
  for (const p of pages) {
    const pWords = (p.title_en || '').toLowerCase().split(/\s+/);
    const overlap = words.filter((w) => pWords.some((pw) => pw.includes(w) || w.includes(pw))).length;
    if (overlap >= 2) return { status: 'PLACED', reason: `page: /en/${p.slug}`, where: `/en/${p.slug}` };
  }
  for (const a of anns) {
    const aWords = (a.title_en || '').toLowerCase().split(/\s+/);
    const overlap = words.filter((w) => aWords.some((aw) => aw.includes(w) || w.includes(aw))).length;
    if (overlap >= 2) return { status: 'PLACED', reason: `announcement: /en/news/${a.slug}`, where: `/en/news/${a.slug}` };
  }

  if (/pre-?k|preschool|學前/i.test(oldUrl + title)) {
    return { status: 'ARCHIVED', reason: 'Pre-K program page (outdated) → /en/archive', where: '/en/archive' };
  }
  if (old.status !== 200) {
    return { status: 'MERGED', reason: `old page returned ${old.status} (404)`, where: '' };
  }
  if (/201[89]|2020/.test(oldUrl) && /notice|通告|通知|announcement|covid|疫情/i.test(title + (old.text_main || '').slice(0, 200))) {
    return { status: 'ARCHIVED', reason: 'outdated 2018-2020 notice → /en/archive', where: '/en/archive' };
  }

  return { status: 'NEEDS OWNER REVIEW', reason: 'no clear home on new site', where: '/en/archive' };
}

// ---------- build ledger ----------
function buildLedger(pages, assets, siteIdx, db) {
  const rows = [];
  for (const p of pages) {
    const m = matchPage(p, db);
    rows.push({ type: 'page', name: p.title || p.url, oldUrl: p.url, status: m.status, reason: m.reason, where: m.where });
  }
  for (const a of assets) {
    const m = matchAsset(a, siteIdx, db);
    rows.push({ type: 'asset', name: path.basename(a.local_path || a.url || 'unknown'), oldUrl: a.url, status: m.status, reason: m.reason, where: m.where });
  }
  return rows;
}

// ---------- write ledger ----------
function writeLedger(rows, pages, assets) {
  const total = rows.length;
  const placed = rows.filter((r) => r.status === 'PLACED').length;
  const merged = rows.filter((r) => r.status === 'MERGED').length;
  const archived = rows.filter((r) => r.status === 'ARCHIVED').length;
  const notPlaced = rows.filter((r) => r.status === 'NOT PLACED').length;
  const review = rows.filter((r) => r.status === 'NEEDS OWNER REVIEW').length;
  const unclassified = total - placed - merged - archived - notPlaced - review;

  function byType(status) {
    const r = rows.filter((x) => x.status === status);
    return {
      page: r.filter((x) => x.type === 'page').length,
      image: r.filter((x) => x.type === 'asset' && !/\.pdf/i.test(x.name)).length,
      pdf: r.filter((x) => x.type === 'asset' && /\.pdf/i.test(x.name)).length,
    };
  }
  const pT = byType('PLACED'), mT = byType('MERGED'), aT = byType('ARCHIVED'), rT = byType('NEEDS OWNER REVIEW');

  const lines = [
    '# SDCA Content Ledger — Old Site → New Site',
    '',
    `Generated: ${new Date().toISOString().slice(0, 10)}`,
    `Source: research/data/pages.jsonl (${pages.length} pages), research/data/assets.json (${assets.length} assets)`,
    '',
    '## Summary',
    '',
    '| Status | Count |',
    '|--------|-------|',
    `| PLACED | ${placed} |`,
    `| MERGED | ${merged} |`,
    `| ARCHIVED | ${archived} |`,
    `| NOT PLACED | ${notPlaced} |`,
    `| NEEDS OWNER REVIEW | ${review} |`,
    `| **Total** | **${total}** |`,
    '',
    `Coverage (PLACED + MERGED + ARCHIVED): **${(((placed + merged + archived) / total) * 100).toFixed(1)}%**`,
    `Unclassified: **${unclassified}** (must be 0).`,
    '',
    '## Summary by Type',
    '',
    '| Type | PLACED | MERGED | ARCHIVED | REVIEW |',
    '|------|--------|--------|----------|--------|',
    `| pages  | ${pT.page} | ${mT.page} | ${aT.page} | ${rT.page} |`,
    `| images | ${pT.image} | ${mT.image} | ${aT.image} | ${rT.image} |`,
    `| PDFs   | ${pT.pdf} | ${mT.pdf} | ${aT.pdf} | ${rT.pdf} |`,
    '',
    '## NEEDS OWNER REVIEW',
    '',
    '> Each item needs a judgement call. Grouped by reason with recommendation.',
    '',
  ];

  const reviewRows = rows.filter((r) => r.status === 'NEEDS OWNER REVIEW');
  if (reviewRows.length) {
    const groups = new Map();
    for (const r of reviewRows) {
      if (!groups.has(r.reason)) groups.set(r.reason, []);
      groups.get(r.reason).push(r);
    }
    for (const [reason, items] of groups) {
      lines.push(`### ${reason} (${items.length})`);
      lines.push('');
      const rec = /spam/i.test(reason) ? 'drop (spam)'
        : /outdated|201[6-9]/.test(reason) ? 'archive or drop'
        : /not curated/i.test(reason) ? 'add to /media/archive if real photo, else drop'
        : /superseded/i.test(reason) ? 'verify newer version exists, then drop'
        : /not on disk/i.test(reason) ? 're-download or drop'
        : /no clear home/i.test(reason) ? 'review content, place on /en/archive or /en/news'
        : 'review manually';
      lines.push(`**Recommendation:** ${rec}`);
      lines.push('');
      lines.push('| Type | Name |');
      lines.push('|------|------|');
      for (const r of items) lines.push(`| ${r.type} | ${r.name.slice(0, 80)} |`);
      lines.push('');
    }
  } else {
    lines.push('_None._');
  }

  lines.push('## NOT PLACED', '');
  const npr = rows.filter((r) => r.status === 'NOT PLACED');
  if (npr.length) {
    lines.push('| Type | Name | Old URL | Reason |');
    lines.push('|------|------|---------|--------|');
    for (const r of npr) lines.push(`| ${r.type} | ${r.name.slice(0, 60)} | ${r.oldUrl} | ${r.reason} |`);
  } else lines.push('_None._');

  lines.push('## Full Ledger (PLACED + MERGED + ARCHIVED)', '');
  lines.push('| Type | Name | Status | Where | Reason |');
  lines.push('|------|------|--------|-------|--------|');
  for (const r of rows.filter((x) => ['PLACED', 'MERGED', 'ARCHIVED'].includes(x.status))) {
    lines.push(`| ${r.type} | ${r.name.slice(0, 60)} | ${r.status} | ${r.where} | ${r.reason.slice(0, 50)} |`);
  }

  fs.mkdirSync(path.dirname(LEDGER_OUT), { recursive: true });
  fs.writeFileSync(LEDGER_OUT, lines.join('\n'));
  return { total, placed, merged, archived, notPlaced, review, unclassified };
}

function main() {
  const db = openDb();
  const pages = loadPages();
  const assets = loadAssets();

  console.log('=== content-audit.js (Phase 8b) ===');
  console.log(`Old pages: ${pages.length}`);
  console.log(`Old assets: ${assets.length}`);

  const siteIdx = buildSiteIndex(db);
  console.log(`Site index: ${siteIdx.hashMap.size} files hashed, ${siteIdx.archiveBases.size} archive basenames`);

  const rows = buildLedger(pages, assets, siteIdx, db);
  const summary = writeLedger(rows, pages, assets);

  console.log(`\nSummary: ${JSON.stringify(summary)}`);
  console.log(`Ledger written to: ${LEDGER_OUT}`);

  if (summary.unclassified > 0) {
    console.log(`\nFAIL: ${summary.unclassified} unclassified items`);
    process.exit(1);
  }
  console.log(`\nPASS: 100% classified (NOT PLACED = ${summary.notPlaced})`);
}

main();
