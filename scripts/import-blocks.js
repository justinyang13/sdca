#!/usr/bin/env node
// scripts/import-blocks.js — Phase DP: load parser/hand block trees into pages.
//   node scripts/import-blocks.js [--strict]
// Resolves __OLD_IMG__ (must already be /img/old/... + exist on disk — FATAL
// otherwise) and __OLD_PDF__ (→ /pdf/<slug>: match documents by bytes/sha or
// normalised basename, else create a documents row from the research asset,
// else drop the block + ledger note). Never touches body_source='admin' rows.
// Idempotent. Writes research/dp-import.json manifest.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { newDb } from '../src/db/open.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BLOCKS_DIR = path.join(ROOT, 'research', 'blocks');
const PUBLIC_DIR = path.join(ROOT, 'public');
const RESEARCH_PDF = path.join(ROOT, 'research', 'assets', 'pdf');
const STORAGE_DOCS = path.join(ROOT, 'storage', 'documents');
const STRICT = process.argv.includes('--strict');

// oldSlug -> { page } (existing pages.slug) or { create, title_en, title_zh, source_url }
const PLAN = {
  'about-sdca': { page: 'about', source_url: '/about-sdca/' },
  'board-of-directors': { page: 'about-board', source_url: '/board-of-directors/' },
  'staff': { page: 'about-staff', source_url: '/staff/' },
  'words-from-the-principal': { page: 'about-principal', source_url: '/words-from-the-principal/' },
  'class-placement': { page: 'programs-classes', source_url: '/class-placement/' },
  'tcml': { page: 'programs-tcml', source_url: '/tcml/' },
  'ta-program': { page: 'programs-ta', source_url: '/ta-program/' },
  'adult-recreational-programs': { page: 'programs-recreational', source_url: '/adult-recreational-programs/' },
  'volunteer-opportunity': { page: 'parents-volunteer', source_url: '/volunteer-opportunity/' },
  'handbook-and-policy': { page: 'parents-handbook', source_url: '/handbook-and-policy/' },
  'scrip': { page: 'parents-scrip', source_url: '/parents-scrip/' },
  'sponsors': { page: 'support-sponsors', source_url: '/sponsors/', append: ['sponsors-2'] },
  'education-resource': { page: 'education-resource', source_url: '/education-resource/' },
  'disclaimer': { page: 'disclaimer', source_url: '/disclaimer/' },
  'privacy-policy': { page: 'privacy', source_url: '/privacy-policy/' },
  'media': { page: 'media', source_url: '/media/' },
  'registration': { page: 'enroll', source_url: '/registration/' },
  'countact-us': { page: 'contact', source_url: '/countact-us/' },
  // hand-written poster/PDF pages -> new rows
  'adult': { create: 'adult', title_en: 'Adult', title_zh: 'Adult', source_url: '/adult/' },
  'student-store-schedule': { create: 'student-store-schedule', title_en: 'Student Store Schedule', title_zh: 'Student Store Schedule', source_url: '/student-store-schedule/' },
  '2026_2027_classroom-map': { create: 'classroom-map', title_en: '2026_2027 Classroom Map', title_zh: '2026_2027 Classroom Map', source_url: '/2026_2027_classroom-map/' },
  '____': { create: 'guitar-poster', title_en: '吉他海報', title_zh: '吉他海報', source_url: '/%E5%90%89%E4%BB%96%E6%B5%B7%E5%A0%B1/' },
  '2018__10__22__pre-k-program': { create: 'pre-k-program', title_en: 'Pre-K Program', title_zh: 'Pre-K Program', source_url: '/2018/10/22/pre-k-program/' },
  'new-student-advertisments-2026': { create: 'new-student-ads', title_en: 'New student Advertisments 2026', title_zh: 'New student Advertisments 2026', source_url: '/new-student-advertisments-2026/' },
  'sdca-yearbook-cover-art-contest-guidelines-2025-2026': { create: 'yearbook-contest', title_en: 'SDCA Yearbook Cover Art Contest Guidelines 2025-2026', title_zh: 'SDCA Yearbook Cover Art Contest Guidelines 2025-2026', source_url: '/sdca-yearbook-cover-art-contest-guidelines-2025-2026/' },
};

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '');
const shaFile = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

function loadBlocks(slug) {
  const p = path.join(BLOCKS_DIR, `${slug}.json`);
  const doc = JSON.parse(fs.readFileSync(p, 'utf8'));
  return Array.isArray(doc.blocks) ? doc.blocks : [];
}

function walkBlocks(blocks, fn) {
  for (const b of blocks || []) {
    const key = b && Object.keys(b)[0];
    if (!key) continue;
    const v = b[key];
    if (key === 'image') fn('image', v, b);
    else if (key === 'gallery') (v.items || []).forEach((i) => fn('image', i, b));
    else if (key === 'image_text') { if (v.image) fn('image', v.image, b); }
    else if (key === 'people') (v.cards || []).forEach((c) => { if (c.image) fn('image', c.image, b); });
    else if (key === 'file') fn('file', v, b);
    else if (key === 'tabs') (Array.isArray(v) ? v : []).forEach((t) => walkBlocks(t.blocks, fn));
    else if (key === 'columns') (v.cols || []).forEach((cb) => walkBlocks(cb, fn));
  }
}

function guessCategory(name) {
  const n = norm(name);
  if (n.includes('calendar')) return 'calendar';
  if (n.includes('handbook')) return 'handbook';
  if (n.includes('scrip')) return 'scrip';
  if (n.includes('classinfo') || n.includes('textbook')) return 'class-info';
  if (n.includes('contest') || n.includes('essay') || n.includes('karaoke') || n.includes('poetry')) return 'contest';
  if (n.includes('regist')) return 'registration';
  if (n.includes('volunteer') || n.includes('reimburs') || n.includes('application') || n.includes('form')) return 'form';
  return 'form';
}

function main() {
  const db = newDb(path.join(ROOT, 'data', 'sdca.db'));
  const fatal = [];
  const ledger = []; // { item, reason, recommendation }
  const createdDocs = [];
  const manifest = { generated: new Date().toISOString(), pages: {} };

  // doc lookup: sha(bytes) -> slug, normbase -> slug
  const docs = db.prepare('SELECT slug, file_path, title_en FROM documents').all();
  const shaToSlug = new Map();
  const baseToSlug = new Map();
  for (const d of docs) {
    const fp = path.join(ROOT, d.file_path);
    try {
      if (fs.existsSync(fp)) shaToSlug.set(shaFile(fp), d.slug);
    } catch { /* ignore */ }
    baseToSlug.set(norm(path.basename(d.file_path, path.extname(d.file_path))), d.slug);
  }

  function resolvePdf(file, pageSlug) {
    // returns /pdf/<slug> or null (caller drops block + ledgers)
    let cand = file.local_path && path.join(ROOT, file.local_path);
    if (!cand || !fs.existsSync(cand)) {
      // search research pdf dir by normalised basename of the old href
      const want = norm(path.basename(file.href || '', path.extname(file.href || '')));
      const cands = fs.existsSync(RESEARCH_PDF) ? fs.readdirSync(RESEARCH_PDF) : [];
      const hit = cands.find((f) => norm(path.basename(f, path.extname(f))) === want);
      cand = hit ? path.join(RESEARCH_PDF, hit) : null;
    }
    if (cand && fs.existsSync(cand)) {
      const sha = shaFile(cand);
      if (file.sha256 && file.sha256 !== sha) {
        ledger.push({ item: `${pageSlug}: ${file.label}`, reason: `research file bytes differ from parser sha256 (${file.sha256.slice(0, 12)}… vs ${sha.slice(0, 12)}…)`, recommendation: 'Owner: confirm which PDF revision is correct.' });
      }
      if (shaToSlug.has(sha)) return `/pdf/${shaToSlug.get(sha)}`;
      const nb = norm(path.basename(cand, path.extname(cand)));
      if (baseToSlug.has(nb)) return `/pdf/${baseToSlug.get(nb)}`;
      // create a documents row from the research asset
      let slug = norm(path.basename(cand, path.extname(cand)).replace(/[^a-z0-9\u4e00-\u9fff]+/gi, '-')).replace(/^-+|-+$/g, '').slice(0, 80) || `dp-doc-${Date.now()}`;
      slug = slug.replace(/-+/g, '-');
      let n = 0;
      while (db.prepare('SELECT 1 FROM documents WHERE slug = ?').get(n ? `${slug}-${n}` : slug)) n++;
      if (n) slug = `${slug}-${n}`;
      const dest = path.join(STORAGE_DOCS, `${slug}.pdf`);
      fs.mkdirSync(STORAGE_DOCS, { recursive: true });
      fs.copyFileSync(cand, dest);
      const label = (file.label || slug).replace(/\s*\(PDF\)\s*$/i, '');
      const yr = (cand.match(/(19|20)\d{2}/) || [])[0] || '';
      db.prepare(`INSERT INTO documents (slug, title_en, title_zh, file_path, bytes, category, school_year, published)
                  VALUES (?,?,?,?,?,?,?,1)`).run(slug, label, label, `storage/documents/${slug}.pdf`, fs.statSync(dest).size, guessCategory(cand), yr);
      createdDocs.push(slug);
      shaToSlug.set(sha, slug);
      return `/pdf/${slug}`;
    }
    ledger.push({ item: `${pageSlug}: ${file.label || file.href}`, reason: 'PDF file not captured (not in research/assets, no local copy).', recommendation: 'Owner: supply the PDF or confirm removal.' });
    return null;
  }

  let wrote = 0, skippedAdmin = 0;
  for (const [oldSlug, plan] of Object.entries(PLAN)) {
    let blocks = loadBlocks(oldSlug);
    if (!blocks.length) {
      fatal.push(`empty block tree (parser produced nothing): ${oldSlug}.json`);
      continue;
    }
    for (const extra of plan.append || []) {
      const eb = loadBlocks(extra);
      if (eb.length) {
        blocks = blocks.concat([{ divider: {} }], eb);
        manifest[`append:${extra}`] = true;
      }
    }
    const dropped = [];
    // resolve + verify
    walkBlocks(blocks, (kind, v) => {
      if (kind === 'image') {
        if (!v.src) { dropped.push('image with empty src (no local file, e.g. IMG_3218.jpg)'); v._drop = true; return; }
        if (v.src.startsWith('__OLD_IMG__')) {
          fatal.push(`${oldSlug}: unresolved placeholder image ${v.src} (run process-old-images.js first)`);
          return;
        }
        if (!v.src.startsWith('/img/old/')) {
          fatal.push(`${oldSlug}: image src not root-absolute /img/old/…: ${v.src}`);
          return;
        }
        if (!fs.existsSync(path.join(PUBLIC_DIR, v.src.slice(1)))) {
          fatal.push(`${oldSlug}: image file missing on disk: public${v.src}`);
        }
        // image link overrides must also resolve (stale hrefs fail the import)
        if (v.href && v.href.startsWith('/img/old/') && !fs.existsSync(path.join(PUBLIC_DIR, v.href.slice(1)))) {
          fatal.push(`${oldSlug}: image href target missing on disk: public${v.href}`);
        }
      } else if (kind === 'file') {
        if (v.href && v.href.startsWith('__OLD_PDF__')) {
          const url = resolvePdf(v, plan.page || plan.create);
          if (url) v.href = url;
          else { dropped.push(`file: ${v.label || v.href}`); v._drop = true; }
        }
      }
    });
    // remove dropped blocks (single-key wrappers)
    const cleanList = (list) => list.filter((b) => {
      const key = b && Object.keys(b)[0];
      if (!key) return false;
      const v = b[key];
      if (key === 'image' || key === 'file') return !v._drop;
      if (key === 'gallery') { v.items = (v.items || []).filter((i) => !i._drop); return v.items.length > 0; }
      if (key === 'image_text') return !(v.image && v.image._drop) || v.title || v.text;
      if (key === 'columns') { v.cols = (v.cols || []).map(cleanList); v.count = v.cols.filter((c) => c.length).length; return true; }
      return true;
    });
    // an image followed by a PDF whose label is just a filename = the old image-wrapped PDF link:
    // make the image itself open the PDF (inline, new tab) and drop the filename text
    const mergeImgPdf = (list) => list.reduce((acc, b) => {
      const key = b && Object.keys(b)[0];
      if (key === 'columns') b.columns.cols = b.columns.cols.map(mergeImgPdf);
      const prev = acc[acc.length - 1];
      if (key === 'file' && prev && prev.image && !prev.image.href && /\.pdf$/i.test(b.file.label || '') && /^\/pdf\//.test(b.file.href || '')) {
        prev.image.href = b.file.href;
        return acc;
      }
      acc.push(b);
      return acc;
    }, []);
    const clean = mergeImgPdf(cleanList(blocks));
    const nImages = [];
    const nFiles = [];
    walkBlocks(clean, (kind) => { (kind === 'image' ? nImages : nFiles).push(1); });
    // old registration-portal links -> the static copies on this site (scripts/portal-import.js)
    const PORTAL_MAP = [
      ['https://register.sandiegochineseschool.com/signin/register', '/en/portal/register'],
      ['https://register.sandiegochineseschool.com/signin', '/en/portal/signin'],
      ['https://register.sandiegochineseschool.com/public/upload/Registration%20Notice%20Chinese.pdf', '/pdf/registration-notice-chinese'],
      ['https://register.sandiegochineseschool.com/public/upload/Registration%20Notice%20English.pdf', '/pdf/registration-notice-english'],
      ['https://register.sandiegochineseschool.com', '/en/portal/signin'],
    ];
    let canon = JSON.stringify(clean);
    for (const [from, to] of PORTAL_MAP) canon = canon.split(`"${from}"`).join(`"${to}"`);
    clean.splice(0, clean.length, ...JSON.parse(canon));
    // any remaining /img/old link target (image_text titles, people cards,
    // image hrefs) must exist on disk — catches stale hrefs
    for (const m of canon.matchAll(/"href":\s*"(\/img\/old\/[^"]+)"/g)) {
      if (!fs.existsSync(path.join(PUBLIC_DIR, m[1].slice(1)))) {
        fatal.push(`${oldSlug}: link target missing on disk: public${m[1]}`);
      }
    }
    const hash = crypto.createHash('sha256').update(canon).digest('hex');
    const notes = [`DP import 2026-10-05 (${/hand|2018__|adult|student|classroom|____|new-student|yearbook/.test(oldSlug) ? 'hand-written from raw DOM' : 'parser block tree'}).`];
    if (plan.page) {
      const row = db.prepare('SELECT body_source FROM pages WHERE slug = ?').get(plan.page);
      if (!row) { fatal.push(`target page missing: ${plan.page} (from ${oldSlug})`); continue; }
      if (row.body_source === 'admin') { skippedAdmin++; manifest[plan.page] = { from: oldSlug, skipped: 'admin-edited' }; continue; }
      db.prepare('UPDATE pages SET blocks=?, source_url=?, layout_notes=?, import_hash=? WHERE slug=?')
        .run(canon, plan.source_url, notes.join(' '), hash, plan.page);
    } else {
      const exists = db.prepare('SELECT body_source FROM pages WHERE slug = ?').get(plan.create);
      if (exists && exists.body_source === 'admin') { skippedAdmin++; continue; }
      if (exists) {
        db.prepare('UPDATE pages SET blocks=?, source_url=?, layout_notes=?, import_hash=? WHERE slug=?')
          .run(canon, plan.source_url, notes.join(' '), hash, plan.create);
      } else {
        db.prepare(`INSERT INTO pages (slug, title_en, title_zh, blocks, source_url, layout_notes, import_hash, body_source, published)
                    VALUES (?,?,?,?,?,?,?,'import',1)`)
          .run(plan.create, plan.title_en, plan.title_zh, canon, plan.source_url, notes.join(' '), hash);
      }
    }
    wrote++;
    manifest.pages[plan.page || plan.create] = {
      from: oldSlug, blocks: clean.length, images: nImages.length, files: nFiles.length, dropped,
    };
  }
  manifest.createdDocs = createdDocs;
  manifest.ledger = ledger;
  manifest.wrote = wrote;
  manifest.skippedAdmin = skippedAdmin;
  fs.writeFileSync(path.join(ROOT, 'research', 'dp-import.json'), JSON.stringify(manifest, null, 2));

  console.log('=== import-blocks.js ===');
  console.log(`pages written: ${wrote}, admin-skipped: ${skippedAdmin}, docs created: ${createdDocs.length}`);
  for (const [k, v] of Object.entries(manifest.pages)) {
    if (v.skipped) console.log(`  - ${k}: SKIPPED (${v.skipped})`);
    else console.log(`  - ${k} <- ${v.from}: ${v.blocks} blocks, ${v.images} img, ${v.files} files${v.dropped.length ? `, DROPPED: ${v.dropped.join('; ')}` : ''}`);
  }
  if (createdDocs.length) console.log('created documents:', createdDocs.join(', '));
  if (ledger.length) {
    console.log('\nLEDGER (needs owner review):');
    ledger.forEach((l) => console.log(`  - ${l.item}: ${l.reason}`));
  }
  if (fatal.length) {
    console.log('\nFATAL:');
    fatal.forEach((f) => console.log(`  ! ${f}`));
    process.exit(1);
  }
  if (STRICT && (ledger.length || Object.values(manifest.pages).some((p) => p.dropped && p.dropped.length))) {
    process.exit(1);
  }
  console.log('\nOK');
}

main();
