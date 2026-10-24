// tests/security.test.js — admin lockout, session renewal, cookie flags, upload content check, chat cap and bad JSON, headers.
process.env.CHAT_DAILY_CAP = '0';   // every chat request is over the cap: no model is called in these tests
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bootAdminApp } from './support/adminApp.js';

let app, db, uploadDir;
const GENERIC = 'Invalid username or password';

before(async () => {
  process.env.NODE_ENV = 'development';
  app = await bootAdminApp({ admins: [['boss', 'correct-horse-battery', 'admin'], ['other', 'another-long-pass1', 'admin']] });
  db = app.db;
  uploadDir = (await import('../src/admin/uploads.js')).uploadDir;
});
after(() => app.close());

test('admin: 5 wrong passwords lock the account, even the right password is refused, and every failure reads the same', async () => {
  const j = app.newJar();
  const unknown = await app.session('nobody', 'x', {}, j);
  const wrong = await app.session('other', 'definitely-wrong', {}, j);
  assert.equal(unknown.status, 401); assert.equal(wrong.status, 401);
  assert.ok(unknown.text.includes(GENERIC) && wrong.text.includes(GENERIC));
  for (let i = 0; i < 5; i++) await app.session('boss', 'wrong-guess', {}, j);
  const row = db.prepare("SELECT failed_attempts, locked_until FROM admin_users WHERE username = 'boss'").get();
  assert.ok(row.locked_until, 'locked after the 5th failure');
  const locked = await app.session('boss', 'correct-horse-battery', {}, j);
  assert.equal(locked.status, 401);
  assert.ok(locked.text.includes(GENERIC), 'a locked account gives the generic message, not a hint');
  assert.ok(db.prepare("SELECT 1 FROM login_events WHERE username = 'boss' AND detail = 'account locked'").get());
  // lock expires -> the right password works and the counters reset
  db.prepare("UPDATE admin_users SET locked_until = '2000-01-01 00:00:00' WHERE username = 'boss'").run();
  assert.equal((await app.session('boss', 'correct-horse-battery', {}, j)).status, 302);
  const after = db.prepare("SELECT failed_attempts, locked_until FROM admin_users WHERE username = 'boss'").get();
  assert.equal(after.failed_attempts, 0); assert.equal(after.locked_until, null);
});

test('admin: signing in issues a new session id and removes the old one', async () => {
  const j = app.newJar();
  assert.equal((await app.session('other', 'another-long-pass1', {}, j)).status, 302);
  const sid1 = j.jar.sdca_sid; assert.ok(sid1);
  assert.equal((await app.session('other', 'another-long-pass1', {}, j)).status, 302);   // sign in again with the old cookie
  const sid2 = j.jar.sdca_sid;
  assert.notEqual(sid1, sid2);
  const raw = (s) => decodeURIComponent(s).replace(/^s:/, '').split('.')[0];
  assert.equal(db.prepare('SELECT COUNT(*) n FROM sessions WHERE sid = ?').get(raw(sid1)).n, 0, 'old session row is gone');
});

test('admin CSRF cookie is HttpOnly, and Secure when the request came over https', async () => {
  const plain = await fetch(`${app.base}/admin/login`);
  assert.match(plain.headers.getSetCookie().find((c) => c.startsWith('sdca_csrf')), /HttpOnly/i);
  const https = await fetch(`${app.base}/admin/login`, { headers: { 'x-forwarded-proto': 'https' } });
  const c = https.headers.getSetCookie().find((x) => x.startsWith('sdca_csrf'));
  assert.match(c, /HttpOnly/i); assert.match(c, /Secure/i);
});

test('admin upload: a file whose contents do not match its extension is rejected and deleted', async () => {
  const s = await app.session('other', 'another-long-pass1');
  assert.equal(s.status, 302);
  const existing = new Set(fs.readdirSync(uploadDir));   // only files created by this test are ever removed
  const post = (bytes, name) => {
    const fd = new FormData();
    fd.set('_csrf', s.csrf); fd.set('title_en', 'T'); fd.set('category', 'form');
    fd.set('file', new Blob([bytes], { type: 'application/pdf' }), name);
    return fetch(`${app.base}/admin/documents`, { method: 'POST', redirect: 'manual', headers: { cookie: s.cookie() }, body: fd });
  };
  const bad = await post('<html><script>alert(1)</script></html>', 'evil.pdf');
  assert.equal(bad.status, 400);
  assert.match(await bad.text(), /do not match its type/);
  assert.deepEqual(fs.readdirSync(uploadDir).filter((f) => !existing.has(f)), [], 'rejected file removed from disk');
  const good = await post('%PDF-1.4\n%fake but starts like a pdf\n', 'ok.pdf');
  assert.notEqual(good.status, 400);
  for (const f of fs.readdirSync(uploadDir)) if (!existing.has(f)) fs.rmSync(`${uploadDir}/${f}`, { force: true });
});

test('chat: bad JSON gets a 400, and the daily cap answers without calling the model', async () => {
  const bad = await fetch(`${app.base}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{not json' });
  assert.equal(bad.status, 400);
  const res = await fetch(`${app.base}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'hello', lang: 'en' }) });
  assert.equal(res.status, 200);
  assert.match(await res.text(), /limit for today/);
});

test('responses carry a Permissions-Policy header', async () => {
  const r = await fetch(`${app.base}/en/`);
  assert.match(r.headers.get('permissions-policy') || '', /camera=\(\)/);
});
