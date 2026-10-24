// tests/primitives.test.js — the shared building blocks: sanitizer, lockout rule, language helpers, office contact, chat messages, :lang guard.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { newDb } from '../src/db/open.js';
import { applyMigrations, MIGRATIONS_DIR } from '../src/db/migrate.js';
import { createApp } from '../src/app.js';
import { sanitizeRich } from '../src/sanitize.js';
import { isLocked, recordFailure, clearFailures, MAX_FAILS } from '../src/auth/lockout.js';
import { pickLang, localized } from '../src/i18n/index.js';
import { officeContact } from '../src/school.js';
import { replyLang, noAnswerMessage, dailyLimitMessage } from '../src/chat/messages.js';

let dir, db, server, base;
before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdca-prim-'));
  db = newDb(path.join(dir, 'p.db'));
  applyMigrations(db, MIGRATIONS_DIR);
  server = createApp({ db }).listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise((r) => server.close(r)); db.close(); fs.rmSync(dir, { recursive: true, force: true }); });

test('sanitizeRich keeps safe markup (including h6) and strips scripts, handlers and javascript: links', () => {
  const out = sanitizeRich('<h6>t</h6><a href="https://x.org" onclick="evil()">ok</a><script>alert(1)</script><img src="a.png" onerror="evil()"><a href="javascript:evil()">bad</a>');
  assert.match(out, /<h6>t<\/h6>/);
  assert.match(out, /<a href="https:\/\/x\.org">ok<\/a>/);
  assert.ok(!/script|onclick|onerror|javascript:/i.test(out));
  assert.equal(sanitizeRich(null), '');
});

test('lockout: 5th wrong password locks, a success clears, unknown tables are refused', () => {
  db.prepare('INSERT INTO admin_users (username, password_hash, role) VALUES (?,?,?)').run('lock-me', 'x', 'editor');
  const get = () => db.prepare("SELECT * FROM admin_users WHERE username = 'lock-me'").get();
  for (let i = 1; i < MAX_FAILS; i++) assert.equal(recordFailure(db, 'admin_users', get()), false);
  assert.equal(isLocked(get()), false);
  assert.equal(recordFailure(db, 'admin_users', get()), true);
  assert.equal(isLocked(get()), true);
  clearFailures(db, 'admin_users', get().id);
  assert.equal(isLocked(get()), false);
  assert.equal(get().failed_attempts, 0);
  assert.throws(() => recordFailure(db, 'settings; DROP TABLE users', { id: 1 }), /unknown table/);
});

test('pickLang and localized choose the wording and fall back to the other language', () => {
  assert.equal(pickLang('zh', 'Hello', '你好'), '你好');
  assert.equal(pickLang('en', 'Hello', '你好'), 'Hello');
  assert.equal(localized({ title_en: 'A', title_zh: '甲' }, 'title', 'zh'), '甲');
  assert.equal(localized({ title_en: 'A', title_zh: '' }, 'title', 'zh'), 'A');
  assert.equal(localized({ title_en: '', title_zh: '甲' }, 'title', 'en'), '甲');
  assert.equal(localized({}, 'title', 'en'), '');
});

test('officeContact reads the settings, with a fallback when they are empty', () => {
  assert.deepEqual(officeContact(db), { email: 'Office.SDCA@gmail.com', phone: '(858) 205-7322' });
  db.prepare("INSERT OR REPLACE INTO settings (key, value_en) VALUES ('email_office', 'new@example.org')").run();
  assert.equal(officeContact(db).email, 'new@example.org');
});

test('chat messages: reply language rule, and the contact comes from the argument', () => {
  const c = { email: 'a@b.c', phone: '123' };
  assert.equal(replyLang('學費多少', 'en'), 'zh');
  assert.equal(replyLang('when is school', 'zh'), 'en');
  assert.equal(replyLang('ok', 'zh'), 'zh');
  assert.match(noAnswerMessage('en', c), /a@b\.c or 123/);
  assert.match(noAnswerMessage('zh', c), /a@b\.c 或 123/);
  assert.match(dailyLimitMessage('en', c), /limit for today.*a@b\.c/);
});

test('an unsupported :lang is a 404 on every kind of route, and supported ones still work', async () => {
  for (const p of ['/xx', '/xx/news', '/xx/documents/foo', '/xx/events', '/xx/search', '/xx/portal/signin', '/xx/about']) {
    assert.equal((await fetch(base + p)).status, 404, p);
  }
  for (const p of ['/en/news', '/zh/news', '/en/search?q=school']) assert.equal((await fetch(base + p)).status, 200, p);
});
