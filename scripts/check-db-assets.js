#!/usr/bin/env node
// scripts/check-db-assets.js — Phase 9 (R1 item 2).
// Every image/document path referenced by ANY DB row must exist on disk
// (served from public/ or storage/ at the repo root). Exits 1 on any miss.
// Run inside `npm test` (see tests/db-assets.test.js).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from '../src/db/open.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const CHECKS = [
  ['pages', 'hero_image'],
  ['announcements', 'document_id', 'join-documents'],
  ['announcements', 'external_url', 'external'],
  ['events', 'image'],
  ['programs', 'image'],
  ['people', 'photo'],
  ['sponsors', 'logo'],
  ['media_items', 'image'],
  ['media_items', 'url', 'external'],
  ['slides', 'image', 'manifest-name'],
  ['documents', 'file_path', 'storage'],
  ['archive_photos', 'thumb'],
  ['archive_photos', 'path'],
];

function isExternal(v) {
  return /^(https?:|mailto:|tel:)/i.test(v);
}

function isManifestName(v) {
  // slides.image stores manifest BASE NAMES (e.g. "classroom-bilingual") or a
  // path. If a path, it must exist; if a bare name, its largest variant must.
  return !v.includes('/');
}

function resolveOnDisk(p) {
  // A DB path is root-absolute (after migration 004). Try public/ and storage/.
  const clean = String(p).replace(/^\/+/, '');
  const candidates = [
    path.join(root, 'public', clean),
    path.join(root, clean),
  ];
  return candidates.find(c => fs.existsSync(c)) || null;
}

export function checkDbAssets(db = openDb()) {
  const missing = [];
  const manifest = new Set();
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(root, 'public', 'img', 'manifest.json'), 'utf8'));
    for (const img of raw.images || []) manifest.add(img.name);
  } catch { /* no manifest */ }

  for (const [table, col, kind] of CHECKS) {
    let rows;
    try {
      rows = db.prepare(`SELECT id, ${col} AS v FROM ${table}`).all();
    } catch (err) {
      // table/column not present — skip (e.g. before a migration)
      continue;
    }
    for (const r of rows) {
      const v = String(r.v || '').trim();
      if (!v) continue;
      if (kind === 'external' || isExternal(v)) continue;
      if (kind === 'join-documents') continue; // handled via documents.file_path
      if (kind === 'storage') {
        const onDisk = path.join(root, v.replace(/^\/+/, ''));
        if (!fs.existsSync(onDisk)) missing.push(`${table}[${r.id}].${col} = ${v}`);
        continue;
      }
      if (kind === 'manifest-name') {
        // slides store manifest base names (e.g. 'classroom-bilingual');
        // accept if the name is in the manifest, else treat as a path.
        if (manifest.has(v) || manifest.has(v.replace(/^\/+/, ''))) continue;
      }
      if (!resolveOnDisk(v)) missing.push(`${table}[${r.id}].${col} = ${v}`);
    }
  }
  return missing;
}

function main() {
  const db = openDb();
  const missing = checkDbAssets(db);
  if (missing.length) {
    console.error(`check-db-assets: ${missing.length} referenced asset(s) missing on disk:`);
    for (const m of missing) console.error('  - ' + m);
    process.exit(1);
  }
  console.log('check-db-assets: all DB-referenced assets exist on disk');
  process.exit(0);
}

// Run only when invoked directly (not when imported by a test).
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
