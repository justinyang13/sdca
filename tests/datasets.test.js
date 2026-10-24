// tests/datasets.test.js — demo data and live data stay apart (DB split, is_demo flag, public views, guards, chat sources).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { newDb } from '../src/db/open.js';
import { assertDatasetMatches, demoRowCount, DEMO_TABLES } from '../src/db/guard.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let dir, file, db;

before(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdca-datasets-'));
  file = path.join(dir, 'd.db');
  const env = { ...process.env, DB_FILE: file, DATA_DIR: dir, PORTAL_LOGINS_FILE: path.join(dir, 'logins.txt') };
  const r = spawnSync('node', ['scripts/portal-seed.js', '--demo'], { cwd: ROOT, env, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  db = newDb(file);
});
after(() => { db?.close(); fs.rmSync(dir, { recursive: true, force: true }); });

test('demo seed flags every row of the placeholder tables', () => {
  for (const t of DEMO_TABLES) {
    const n = db.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE is_demo = 0`).get().n;
    assert.equal(n, 0, `${t} has unflagged rows after the demo seed`);
  }
  assert.ok(demoRowCount(db) > 100);
});

test('public views show no demo rows, and show a real row once it is unflagged', () => {
  for (const v of ['v_public_board', 'v_public_classes', 'v_public_fees']) {
    assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM ${v}`).get().n, 0, `${v} leaks demo rows`);
  }
  const bm = db.prepare('SELECT id, person_id FROM board_members LIMIT 1').get();
  db.prepare('UPDATE board_members SET is_demo = 0 WHERE id = ?').run(bm.id);
  db.prepare('UPDATE persons SET is_demo = 0 WHERE id = ?').run(bm.person_id);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM v_public_board').get().n, 1);
  db.prepare('UPDATE board_members SET is_demo = 1 WHERE id = ?').run(bm.id);
  db.prepare('UPDATE persons SET is_demo = 1 WHERE id = ?').run(bm.person_id);
});

test('guard refuses a live database that contains demo rows, and a dataset mismatch', () => {
  assert.throws(() => assertDatasetMatches(db, 'live'), /demo row|marked/);
  db.prepare("UPDATE settings SET value_en = 'demo' WHERE key = 'dataset'").run();
  assert.doesNotThrow(() => assertDatasetMatches(db, 'demo'));
  assert.throws(() => assertDatasetMatches(db, 'live'), /marked 'demo'/);
  db.prepare("UPDATE settings SET value_en = 'live' WHERE key = 'dataset'").run();
});

test('demo seed refuses to run against the live database file', () => {
  const live = fs.mkdtempSync(path.join(os.tmpdir(), 'sdca-livetarget-'));   // DATA_DIR only: DB defaults to <DATA_DIR>/sdca.db = live
  try {
    const env = { ...process.env, DATA_DIR: live, PORTAL_LOGINS_FILE: path.join(live, 'logins.txt') };
    delete env.DB_FILE; delete env.DATASET;
    const r = spawnSync('node', ['scripts/portal-seed.js', '--demo'], { cwd: ROOT, env, encoding: 'utf8' });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /Refusing to load demo data/);
  } finally { fs.rmSync(live, { recursive: true, force: true }); }
});

test('chat sources read only public views and content tables, never demo tables', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/chat/sources.js'), 'utf8');
  const names = [...src.matchAll(/\b(?:FROM|JOIN)\s+([a-z_]+)/g)].map((m) => m[1]);
  const allowed = new Set(['pages', 'events', 'announcements', 'programs', 'volunteer_jobs', 'v_public_board', 'v_public_classes', 'v_public_fees', 'v_public_class_times', 'v_public_school_year']);
  for (const n of names) assert.ok(allowed.has(n), `chat source reads "${n}" — use a v_public_* view`);
  for (const t of DEMO_TABLES) assert.ok(!names.includes(t), `chat source reads demo-capable table ${t}`);
});
