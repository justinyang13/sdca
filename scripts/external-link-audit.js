#!/usr/bin/env node
// scripts/external-link-audit.js — Phase 9 (R1 item 4), EXTERNAL LINK RULE.
// Every external http(s) URL present in the DB (any text column of any
// content table) MUST appear in the research corpus (research/wiki or
// research/data). URLs that appear only in the DB are treated as INVENTED
// and the script exits 1.
//
// Also audits seed scripts (scripts/seed-data-*.js) for external URLs that
// do not appear in research/.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from '../src/db/open.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const URL_RE = /https?:\/\/[^\s"'<>)\]`,;]+/g;

function collectExternal(db) {
  const found = new Map(); // url -> [table.column rows]
  const tables = ['pages','announcements','events','programs','people',
                  'sponsors','media_items','settings','slides','documents'];
  for (const t of tables) {
    let cols;
    try { cols = db.prepare(`PRAGMA table_info(${t})`).all().map(r => r.name); } catch { continue; }
    const rows = db.prepare(`SELECT * FROM ${t}`).all();
    for (const r of rows) {
      for (const c of cols) {
        const v = r[c];
        if (typeof v !== 'string') continue;
        for (const m of v.matchAll(URL_RE)) {
          const u = m[0].replace(/[),.;]+$/, '');
          if (!found.has(u)) found.set(u, []);
          found.get(u).push(`${t}[${r.id}].${c}`);
        }
      }
    }
  }
  return found;
}

function corpusText() {
  const parts = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { if (!e.name.startsWith('__')) walk(full); continue; }
      if (!/\.(md|jsonl|json|txt|csv)$/i.test(e.name)) continue;
      try { parts.push(fs.readFileSync(full, 'utf8')); } catch { /* skip */ }
    }
  };
  for (const d of ['research/wiki', 'research/data']) {
    if (fs.existsSync(path.join(root, d))) walk(path.join(root, d));
  }
  return parts.join('\n');
}

function seedScriptsText() {
  const dir = path.join(root, 'scripts');
  const parts = [];
  for (const f of fs.readdirSync(dir)) {
    if (!/^seed-data-.*\.js$/.test(f)) continue;
    parts.push(fs.readFileSync(path.join(dir, f), 'utf8'));
  }
  return parts.join('\n');
}

export function externalLinkAudit(db = openDb()) {
  const corpus = corpusText();
  const dbUrls = collectExternal(db);
  const invented = [];
  const seen = [];
  for (const [url, locs] of dbUrls) {
    const inCorpus = corpus.includes(url) || corpus.includes(url.replace(/\/+$/, ''));
    if (!inCorpus) invented.push({ url, locs });
    else seen.push(url);
  }
  // Also: seed scripts may carry URLs not in the DB (e.g. body text not yet
  // seeded). Audit those too.
  const seedText = seedScriptsText();
  const seedUrls = [...new Set(seedText.match(URL_RE) || [])].map(u => u.replace(/[),.;]+$/, ''));
  const seedInvented = seedUrls.filter(u => !corpus.includes(u) && !dbUrls.has(u));
  return { db: { invented, seen: seen.length }, seed: { invented: seedInvented, seen: seedUrls.length - seedInvented.length } };
}

function main() {
  const db = openDb();
  const r = externalLinkAudit(db);
  let bad = 0;
  if (r.db.invented.length) {
    bad++;
    console.error(`external-link-audit: ${r.db.invented.length} INVENTED URL(s) in DB:`);
    for (const { url, locs } of r.db.invented) console.error(`  - ${url}  (${locs.join(', ')})`);
  }
  if (r.seed.invented.length) {
    bad++;
    console.error(`external-link-audit: ${r.seed.invented.length} INVENTED URL(s) in seed scripts:`);
    for (const u of r.seed.invented) console.error(`  - ${u}`);
  }
  if (bad) process.exit(1);
  console.log(`external-link-audit: OK — DB ${r.db.seen} external URL(s) all in research corpus; seed ${r.seed.seen} all in research corpus`);
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
