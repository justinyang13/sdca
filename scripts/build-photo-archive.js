#!/usr/bin/env node
// build-photo-archive.js — Phase 8b: promote uncurated old-site photos to the
// new site.
//
// Steps (idempotent, deterministic, resize-only — NEVER alters people):
//   1. Hash every file in storage/documents + public/** (the "new site") and
//      collect hashes + lowercased basenames of every served image.
//   2. For research/assets/images/** (457 files in assets.json):
//        - exclude: <5 KB icons, pdf-thumbnail placeholders (232x300/300x232),
//          sponsor/ad banners, board/staff headshots (stays on board/staff pages),
//          GIFs (animation — sips can't resize losslessly, review instead)
//        - exclude duplicates: same sha256 as another kept file
//        - exclude duplicate thumbnails: "-150x150"/"-300x200" suffix when the
//          full-size file also exists
//        - exclude headshots: BOD.jpg + Ana-150x150.jpg
//        - keep everything else real → copy to public/img/archive/full/ capped at
//          1600px, sips 480px thumb into public/img/archive/
//   3. Upsert into archive_photos (grouped by year/event, caption from alt).
//
// Run: node scripts/build-photo-archive.js [--dry]
// Exit 0 on success (prints summary). Safe to re-run.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { openDb } from '../src/db/open.js';

const ROOT = process.cwd();
const IMAG_DIR = path.join(ROOT, 'research', 'assets', 'images');
const DEST_FULL = path.join(ROOT, 'public', 'img', 'archive', 'full');
const DEST_THUMB = path.join(ROOT, 'public', 'img', 'archive');
const DRY = process.argv.includes('--dry');

function sha256(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function imageExt(name) {
  return /\.(png|jpe?g|gif|webp|avif)$/i.test(name);
}

function isThumb(name) {
  return /-\d+x\d+\.(png|jpe?g|gif|webp)$/i.test(name);
}

function thumbBase(name) {
  const m = name.match(/^(.*)-\d+x\d+\.(png|jpe?g|gif|webp)$/i);
  return m ? m[1] : null;
}

// ---------- 1. Build the new-site hash + name sets ----------
const siteHashes = new Map(); // hash -> first path seen
const siteNames = new Set();  // lowercased basename + ext-less form

function addSiteFile(p) {
  const b = path.basename(p);
  if (!imageExt(b)) return;
  siteNames.add(b.toLowerCase());
  siteNames.add(b.toLowerCase().replace(/\.\w+$/, ''));
  try { siteHashes.set(sha256(p), p); } catch { /* unreadable */ }
}
for (const p of walk(path.join(ROOT, 'storage', 'documents'))) addSiteFile(p);
for (const p of walk(path.join(ROOT, 'public'))) addSiteFile(p);

// ---------- 2. Scan the old images ----------
const oldFiles = fs.readdirSync(IMAG_DIR).map((b) => path.join(IMAG_DIR, b)).filter((p) => fs.statSync(p).isFile());

const HEADSHOTS = new Set(['BOD.jpg', 'Ana-150x150.jpg'].map((n) => n.toLowerCase()));
const BANNERS = /(banner|ad-|half-page|header-2018|spring-words|essay-ad|99ranch|pre-registration\.gif$)/i;
const PLACEHOLDER = /-pdf-(232x300|300x232)\.(\w+)([._][A-Za-z0-9]{4,8})?$/i;
const MIN_BYTES = 5 * 1024;

// group detection from filename
const GROUP_RULES = [
  { re: /30th-anniversary|30-?anniversary/i, en: '30th Anniversary', zh: '30週年慶' },
  { re: /38th/i, en: '38th Anniversary', zh: '38週年慶' },
  { re: /graduat|class-of-20\d\d/i, en: 'Graduation', zh: '畢業典禮' },
  { re: /cultural[-\s]?day/i, en: 'Cultural Day', zh: '文化日' },
  { re: /cny|new[-\s]?year|spring[-\s]?festival/i, en: 'Chinese New Year', zh: '春節' },
  { re: /karaoke/i, en: 'Karaoke Contest', zh: '卡拉OK比賽' },
  { re: /poetry[-\s]?recitation|recitation/i, en: 'Poetry Recitation', zh: '朗誦比賽' },
  { re: /typing/i, en: 'Chinese Typing', zh: '中文打字' },
  { re: /teacher[-\s]?meeting/i, en: 'Teacher Meeting', zh: '教師會議' },
  { re: /appreciation[-\s]?dinner|dinner/i, en: 'Teacher Appreciation Dinner', zh: '謝師宴' },
  { re: /tai[-\s]?chi|qigong/i, en: 'Tai Chi & Qigong', zh: '太極與氣功' },
  { re: /community[-\s]?service/i, en: 'Community Service', zh: '社區服務' },
  { re: /tour[-\s]?of[-\s]?taiwan/i, en: 'Taiwan Tour', zh: '台灣之旅' },
  { re: /summer[-\s]?break/i, en: 'Summer Break', zh: '暑假' },
  { re: /first[-\s]?day/i, en: 'First Day of School', zh: '開學日' },
  { re: /textbook[-\s]?pickup/i, en: 'Textbook Pickup', zh: '課本領取' },
  { re: /fundamental|regular[-\s]?class|bilingual|preschool|pre[-\s]?k|beginner|credit[-\s]?class/i, en: 'Classroom', zh: '課堂' },
];

function detectGroup(name, alt) {
  const s = `${name} ${alt || ''}`;
  for (const r of GROUP_RULES) if (r.re.test(s)) return { en: r.en, zh: r.zh };
  const y = name.match(/(20\d\d)/);
  if (y) return { en: y[1], zh: y[1] };
  return { en: 'Other', zh: '其他' };
}

function takenYear(name, alt) {
  const m = String(name + ' ' + (alt || '')).match(/(19|20)\d{2}/);
  return m ? parseInt(m[0], 10) : 0;
}

function cleanCaption(alt, name) {
  const c = String(alt || '').trim();
  if (c && c.length > 4) return c.slice(0, 160);
  // derive from filename: strip year/code/extension
  return path.basename(name).replace(/\.\w+$/, '')
    .replace(/^(19|20)\d\d[-_]?/, '').replace(/[-_]IMG[-_]\d+(-scaled)?/i, 'SDCA photo')
    .replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
}

// pass 1: classify each file
const candidates = [];
const excluded = { icon: [], placeholder: [], banner: [], headshot: [], gif: [], dup: [], onSite: [] };

const seenSha = new Map(); // sha -> kept basename
for (const p of oldFiles) {
  const b = path.basename(p);
  const lb = b.toLowerCase();
  const st = fs.statSync(p);

  if (st.size < MIN_BYTES) { excluded.icon.push(b); continue; }
  if (HEADSHOTS.has(lb)) { excluded.headshot.push(b); continue; }
  if (BANNERS.test(b)) { excluded.banner.push(b); continue; }
  if (PLACEHOLDER.test(b)) { excluded.placeholder.push(b); continue; }
  if (/\.gif$/i.test(b)) { excluded.gif.push(b); continue; } // sips resize of animated gif is lossy

  const sha = sha256(p);

  // duplicate by hash — keep the lexicographically smaller name (deterministic)
  const dup = seenSha.get(sha);
  if (dup) {
    // Prefer the version without a .hash suffix (cleaner name)
    const dupHasHash = /\.[0-9a-f]{6,8}\.\w+$/.test(dup);
    const thisHasHash = /\.[0-9a-f]{6,8}\.\w+$/.test(b);
    if (dupHasHash && !thisHasHash) {
      seenSha.set(sha, b);
      const idx = candidates.findIndex((c) => c.base === dup);
      if (idx >= 0) { candidates.splice(idx, 1); excluded.dup.push(dup); }
    } else {
      excluded.dup.push(b); continue;
    }
  }

  // thumbnail without full-size on disk? keep it (rare); otherwise drop
  const tb = thumbBase(b);
  if (tb) {
    const exts = ['.jpg', '.jpeg', '.png', '.webp'];
    const fullExists = exts.some((e) => {
      const f = IMAG_DIR + '/' + (tb + e);
      return fs.existsSync(f);
    });
    if (fullExists) { excluded.dup.push(b); continue; }
  }
  seenSha.set(sha, b);
  candidates.push({ path: p, base: b, sha, size: st.size });
}

// pass 2: is it already on the new site (by hash or name)?
const archive = [];
for (const c of candidates) {
  if (siteHashes.has(c.sha)) { excluded.onSite.push(c.base); continue; }
  const lb = c.base.toLowerCase();
  if (siteNames.has(lb) || siteNames.has(lb.replace(/\.\w+$/, ''))) { excluded.onSite.push(c.base); continue; }
  archive.push(c);
}

// sort: year desc, then name — stable order for seeding
archive.sort((a, b) => takenYear(b.base).toString().localeCompare(takenYear(a.base).toString()) || a.base.localeCompare(b.base));

// ---------- 3. Copy + resize (skip if already present) ----------
const kept = [];
for (const c of archive) {
  const destName = c.base.replace(/[-\s]/g, '_');
  const fullPath = path.join(DEST_FULL, destName);
  const ext = path.extname(destName).toLowerCase() === '.jpeg' ? '.jpg' : path.extname(destName).toLowerCase();
  const thumbPath = path.join(DEST_THUMB, path.basename(destName, path.extname(destName)) + '-480' + ext);
  const fullUrl = `/img/archive/full/${destName}`;
  const thumbUrl = `/img/archive/${path.basename(thumbPath)}`;

  if (!DRY) {
    fs.mkdirSync(DEST_FULL, { recursive: true });
    fs.mkdirSync(DEST_THUMB, { recursive: true });
    if (!fs.existsSync(fullPath)) {
      fs.copyFileSync(c.path, fullPath);
      // cap at 1600px on the long edge (resize-only, no content change)
      try {
        execFileSync('sips', ['--resampleHeightWidthMax', '1600', fullPath], { stdio: 'ignore' });
      } catch { /* keep original size */ }
    }
    if (!fs.existsSync(thumbPath)) {
      // make a 480px thumb from the source (originals can be huge; thumb from
      // the source keeps color space intact)
      try {
        execFileSync('sips', ['-Z', '480', c.path, '--out', thumbPath], { stdio: 'ignore' });
      } catch {
        // gif/png fallback: copy
        fs.copyFileSync(c.path, thumbPath);
      }
    }
  }
  kept.push({ ...c, fullPath, fullUrl, thumbPath, thumbUrl });
}

// ---------- 4. Seed archive_photos ----------
let seeded = 0;
if (!DRY) {
  const db = openDb();
  const has = db.prepare(`SELECT name FROM sqlite_master WHERE name='archive_photos'`).get();
  if (!has) { console.error('archive_photos table missing — run migrations first'); process.exit(1); }
  const ins = db.prepare(`
    INSERT INTO archive_photos (path, thumb, group_en, group_zh, caption_en, caption_zh, taken_year, sort, published)
    VALUES (?,?,?,?,?,?,?,?,1)
    ON CONFLICT(path) DO UPDATE SET
      thumb=excluded.thumb, group_en=excluded.group_en, group_zh=excluded.group_zh,
      caption_en=excluded.caption_en, caption_zh=excluded.caption_zh,
      taken_year=excluded.taken_year, sort=excluded.sort
  `);
  // alt-text from assets.json when present
  const assetsJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'research', 'data', 'assets.json'), 'utf8'));
  const altByBase = new Map(assetsJson.filter((a) => a.local_path).map((a) => [path.basename(a.local_path).toLowerCase(), a.alt || '']));

  kept.forEach((k, i) => {
    const alt = altByBase.get(k.base.toLowerCase()) || '';
    const g = detectGroup(k.base, alt);
    const cap = cleanCaption(alt, k.base);
    ins.run(k.fullUrl, k.thumbUrl, g.en, g.zh, cap, cap, takenYear(k.base, alt), i);
    seeded++;
  });
}

// ---------- 5. Report ----------
console.log('=== build-photo-archive.js ===');
console.log(`old images scanned: ${oldFiles.length}`);
console.log(`  excluded: icon=${excluded.icon.length} placeholder=${excluded.placeholder.length} banner=${excluded.banner.length} headshot=${excluded.headshot.length} gif=${excluded.gif.length} duplicate=${excluded.dup.length} already-on-site=${excluded.onSite.length}`);
console.log(`archived (new): ${kept.length}`);
console.log(`seeded: ${seeded}${DRY ? ' (dry-run)' : ''}`);
const groups = {};
for (const k of kept) {
  const g = detectGroup(k.base, '').en;
  groups[g] = (groups[g] || 0) + 1;
}
console.log('groups:', JSON.stringify(groups, null, 0));
if (excluded.dup.length > 5) console.log(`  duplicate samples: ${excluded.dup.slice(0, 8).join(', ')} …`);
if (excluded.banner.length) console.log(`  banner samples: ${excluded.banner.slice(0, 8).join(', ')}`);
if (DRY) process.exit(0);
console.log('DONE. Photo archive ready at /en/media/archive and /zh/media/archive.');
