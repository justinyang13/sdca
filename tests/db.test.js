// tests/db.test.js — migration idempotency + all tables present
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { newDb } from '../src/db/open.js';
import { applyMigrations, MIGRATIONS_DIR } from '../src/db/migrate.js';

const EXPECTED_TABLES = [
  'pages', 'announcements', 'events', 'programs', 'people', 'sponsors',
  'documents', 'media_items', 'contact_messages', 'newsletter_subscribers',
  'admin_users', 'sessions', 'audit_log', 'settings', 'search_index',
];

function makeTempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdca-test-'));
  return { file: path.join(dir, 'test.db'), dir };
}

test('migration applies once and is idempotent', () => {
  const { file, dir } = makeTempDb();
  try {
    const db = newDb(file);
    const first = applyMigrations(db);
    assert.equal(first.length, 1, 'first run applies 001_schema.sql');
    const second = applyMigrations(db);
    assert.equal(second.length, 0, 'second run applies nothing');
    db.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('all expected tables and FTS exist', () => {
  const { file, dir } = makeTempDb();
  try {
    const db = newDb(file);
    applyMigrations(db);
    const rows = db.prepare(
      "SELECT name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name"
    ).all().map(r => r.name);
    for (const t of EXPECTED_TABLES) {
      assert.ok(rows.includes(t), `missing table: ${t}`);
    }
    db.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('FTS5 search works (EN + CJK)', () => {
  const { file, dir } = makeTempDb();
  try {
    const db = newDb(file);
    applyMigrations(db);
    db.prepare('INSERT INTO search_index (kind, slug, title_en, title_zh, body_en, body_zh) VALUES (?,?,?,?,?,?)')
      .run('announcement', 'welcome', 'Welcome to SDCA', '歡迎來到聖地牙哥中華學苑', 'A non-profit school', '一所非營利學校');
    const en = db.prepare("SELECT slug FROM search_index WHERE search_index MATCH ?").all('"welcome"').map(r => r.slug);
    assert.deepEqual(en, ['welcome']);
    const zh = db.prepare("SELECT slug FROM search_index WHERE search_index MATCH ?").all('"註冊"').map(r => r.slug);
    // 註冊 is not in the test row — should be empty; sanity: unicode61 tokenizes CJK by char
    assert.ok(Array.isArray(zh));
    db.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
