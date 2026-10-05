// tests/seed-idempotent.test.js — Phase 9 (R1 item 3).
// Run the FULL seed twice against a scratch DB; row counts of every content
// table must be unchanged after the second run.
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SCRATCH = path.join(os.tmpdir(), `sdca-seed-test-${process.pid}.db`);
const TABLES = ['pages','announcements','events','programs','people',
                'sponsors','documents','media_items','settings','slides'];

function snapshot(db) {
  const out = {};
  for (const t of TABLES) out[t] = db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n;
  return out;
}

test('seed twice → identical row counts (idempotent)', async () => {
  for (const f of [SCRATCH, SCRATCH + '-wal', SCRATCH + '-shm']) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
  process.env.DB_FILE = SCRATCH;

  const { migrate } = await import('../src/db/migrate.js');
  const { openDb, closeDb } = await import('../src/db/open.js');
  const db = openDb();
  migrate(db);

  // First full seed.
  await import('../scripts/seed.js').then(async (m) => { m.main?.(); });
  const counts1 = snapshot(db);

  // Second full seed (must not change any counts).
  const seed2 = await import('../scripts/seed.js');
  seed2.main?.();
  const counts2 = snapshot(db);
  closeDb();

  const diffs = [];
  for (const t of TABLES) {
    if (counts1[t] !== counts2[t]) diffs.push(`${t}: ${counts1[t]} → ${counts2[t]}`);
  }
  if (diffs.length) throw new Error('Seed NOT idempotent:\n  ' + diffs.join('\n  '));
  console.log('seed-idempotent: row counts stable →', JSON.stringify(counts2));
});
