#!/usr/bin/env node
// Phase 3 — seed script (idempotent).
// Imports ONLY from research/wiki + research/data (via the curated data modules below),
// copies PDFs into storage/documents/, and fills all seedable tables.
// Content text is transcribed verbatim from research/wiki/pages/*.md — no invented facts.
// Re-running changes nothing (upserts by slug/key, deterministic file copies).

import { openDb } from '../src/db/open.js';
import { seedDocuments } from './seed-data-documents.js';
import { seedWeekly } from './seed-data-weekly.js';
import { seedPages } from './seed-data-pages.js';
import { seedPrograms } from './seed-data-programs.js';
import { seedPeople } from './seed-data-people.js';
import { seedSponsors } from './seed-data-sponsors.js';
import { seedEvents } from './seed-data-events.js';
import { seedMedia } from './seed-data-media.js';
import { seedSettings } from './seed-data-settings.js';
import { seedPress } from './seed-data-press.js';
import { seedSlides } from './seed-data-slides.js';

const log = [];
const skipped = [];

function rebuildSearch(db) {
  db.exec('DELETE FROM search_index');
  const ins = db.prepare('INSERT INTO search_index (kind, slug, title_en, title_zh, body_en, body_zh) VALUES (?,?,?,?,?,?)');
  for (const r of db.prepare('SELECT slug, title_en, title_zh, body_en, body_zh FROM pages').all()) {
    ins.run('page', r.slug, r.title_en, r.title_zh, r.body_en, r.body_zh);
  }
  for (const r of db.prepare('SELECT slug, title_en, title_zh, body_en, body_zh FROM announcements').all()) {
    ins.run('announcement', r.slug, r.title_en, r.title_zh, r.body_en, r.body_zh);
  }
  for (const r of db.prepare('SELECT slug, title_en, title_zh, description_en, description_zh FROM events').all()) {
    ins.run('event', r.slug, r.title_en, r.title_zh, r.description_en, r.description_zh);
  }
  const n = db.prepare('SELECT count(*) n FROM search_index').get().n;
  log.push(`search_index: ${n} rows`);
}

function main() {
  const db = openDb();
  const counters = {};

  // 1. documents first (weekly announcements reference them)
  counters.documents = seedDocuments(db, log, skipped);

  // 2. announcements: weekly + press
  const weeklyRes = seedWeekly(db, log, skipped);
  const pressRes = seedPress(db, log, skipped);
  counters.announcements = weeklyRes + pressRes;

  // 3. pages
  counters.pages = seedPages(db, log, skipped);

  // 4. programs, people, sponsors, events, media, settings
  counters.programs = seedPrograms(db, log, skipped);
  counters.people = seedPeople(db, log, skipped);
  counters.sponsors = seedSponsors(db, log, skipped);
  counters.events = seedEvents(db, log, skipped);
  counters.media_items = seedMedia(db, log, skipped);
  counters.settings = seedSettings(db, log, skipped);
  counters.slides = seedSlides(db, log, skipped);

  // 5. refresh FTS index from content tables
  rebuildSearch(db);

  // 6. report
  console.log('\n=== Seed summary (rows per table after seed) ===');
  for (const t of ['pages', 'announcements', 'events', 'programs', 'people', 'sponsors', 'documents', 'media_items', 'settings', 'slides', 'search_index']) {
    const n = db.prepare(`SELECT count(*) n FROM ${t}`).get().n;
    console.log(`  ${t.padEnd(14)} ${n}`);
  }
  console.log(`\nActions: ${Object.entries(counters).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  if (log.length) {
    console.log(`\nLog:`);
    for (const l of log) console.log('  ' + l);
  }
  if (skipped.length) {
    console.log(`\nSkipped:`);
    for (const s of skipped) console.log('  ' + s);
  }
}

main();
