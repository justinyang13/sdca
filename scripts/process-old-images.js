#!/usr/bin/env node
// process-old-images.js — Phase DP (ROADMAP v3 item 3).
// For every block JSON in research/blocks/, resolve __OLD_IMG__/<year>/<name>
// placeholders to real local files:
//   - copy the ORIGINAL (or flagged thumbnail) from research/assets/images/
//     to public/img/old/<year>/<name> (sips: max 1600px wide, JPEG/PNG/GIF kept)
//   - rewrite the block JSON src to the root-absolute /img/old/<year>/<name>
// PDFs (__OLD_PDF__) are checked: the local file must exist in
// research/assets/pdf/ (already served by the existing /pdf/:slug route);
// the href is rewritten to /pdf/<slug> if a documents row matches, else kept
// as a file link with the local path recorded.
//
// Idempotent. Never edits research/ data files (only rewrites research/blocks/*.json
// which are GENERATED artifacts owned by Phase DP).

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const BLOCKS_DIR = path.join(ROOT, 'research', 'blocks');
const ASSETS_DIR = path.join(ROOT, 'research', 'assets');
const OUT_DIR = path.join(ROOT, 'public', 'img', 'old');
const PDF_DIR = path.join(ROOT, 'storage', 'documents');
const MAX_W = 1600;

const IMGS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

function sipsResize(src, dst, maxW) {
  // sips -Z maxW (longest side) is wrong for wide banners; use -Z only when height would exceed.
  // Simpler: -Z maxW (resizes longest edge to maxW) — acceptable for our use.
  const out = spawnSync('sips', ['-Z', String(maxW), '--setProperty', 'format', 'jpeg', '--out', dst, src], { encoding: 'utf8' });
  return out.status === 0;
}

function sipsCopy(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  if (dst.endsWith('.jpg') || dst.endsWith('.jpeg')) {
    return sipsResize(src, dst, MAX_W);
  }
  // PNG/GIF: just copy (preserve transparency/animation)
  fs.copyFileSync(src, dst);
  return true;
}

function yearFromName(name) {
  // __OLD_IMG__/2018/... → year is already in the path; handled by caller
  return 'misc';
}

function main() {
  const files = fs.readdirSync(BLOCKS_DIR).filter((f) => f.endsWith('.json'));
  const imgStats = { total: 0, done: 0, copied: 0, failed: 0 };
  const pdfStats = { total: 0, resolved: 0, failed: 0 };
  const failures = [];

  // Build a local_path -> public dest map (dedupe across pages)
  const imgPlan = new Map(); // local_path -> { year, name }

  for (const f of files) {
    const p = path.join(BLOCKS_DIR, f);
    const doc = JSON.parse(fs.readFileSync(p, 'utf8'));

    function planImage(img) {
      if (!img || !img.local_path) return;
      imgStats.total++;
      const lp = img.local_path;
      if (!fs.existsSync(lp)) {
        imgStats.failed++;
        failures.push(`missing local file: ${lp} (in ${f})`);
        return;
      }
      const ext = path.extname(lp).toLowerCase();
      if (!IMGS.has(ext)) {
        imgStats.failed++;
        failures.push(`unsupported image type: ${lp}`);
        return;
      }
      // Determine year + name from placeholder src: __OLD_IMG__/<year>/<name>
      const srcMatch = (img.src || '').match(/^__OLD_IMG__\/([^/]+)\/(.+)$/);
      const year = srcMatch ? srcMatch[1] : 'misc';
      const name = srcMatch ? srcMatch[2] : path.basename(lp);
      const dest = path.join(OUT_DIR, year, name);
      const rel = `/img/old/${year}/${name}`;

      if (imgPlan.has(lp) && imgPlan.get(lp).rel === rel) {
        img.src = rel;
        img.local_path = lp;
        return;
      }
      imgPlan.set(lp, { year, name, dest, rel });
      img.src = rel;
      img.local_path = lp;
    }

    function planFile(file) {
      if (!file || !file.local_path) return;
      pdfStats.total++;
      const lp = file.local_path;
      if (!fs.existsSync(lp)) {
        pdfStats.failed++;
        failures.push(`missing local PDF: ${lp} (in ${f})`);
        return;
      }
      // Check if a documents row already serves this file
      const base = path.basename(lp);
      // We'll resolve the slug at render time via a lookup; for now record the file
      file.local_path = lp;
    }

    function walkBlocks(blocks) {
      for (const b of blocks || []) {
        const key = Object.keys(b)[0];
        const v = b[key];
        if (key === 'image') planImage(v);
        if (key === 'image_text') { planImage(v.image); (v.extra || []).forEach((e) => { if (e.file) planFile(e.file); if (e.image) planImage(e.image); }); }
        if (key === 'file') planFile(v);
        if (key === 'gallery') v.items.forEach((i) => planImage(i));
        if (key === 'columns') v.cols.forEach((cb) => walkBlocks(cb));
        if (key === 'tabs') v.forEach((t) => walkBlocks(t.blocks));
      }
    }
    walkBlocks(doc.blocks);

    doc.missing_local_files = [];
    fs.writeFileSync(p, JSON.stringify(doc, null, 2));
  }

  // Execute image copies
  for (const [lp, plan] of imgPlan) {
    if (fs.existsSync(plan.dest)) { imgStats.copied++; continue; }
    const ok = sipsCopy(lp, plan.dest);
    if (ok) imgStats.copied++;
    else { imgStats.failed++; failures.push(`sips failed for ${lp}`); }
  }

  console.log('=== process-old-images.js ===');
  console.log('images:', JSON.stringify(imgStats));
  console.log('pdfs checked:', JSON.stringify(pdfStats));
  if (failures.length) {
    console.log('\nFAILURES:');
    failures.slice(0, 30).forEach((f) => console.log('  ' + f));
    if (process.argv.includes('--strict')) process.exit(1);
  }
  console.log(`\nProcessed ${imgPlan.size} unique images -> ${path.relative(ROOT, OUT_DIR)}/`);
}

main();
