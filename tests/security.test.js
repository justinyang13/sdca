// tests/security.test.js — admin lockout, session renewal, cookie flags, upload content check, chat cap and bad JSON, headers.
process.env.LOGIN_RATE_LIMIT = '1000';
process.env.CHAT_DAILY_CAP = '0';   // every chat request is over the cap: no model is called in these tests
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let server, base, dir, db, uploadDir;
const GENERIC = 'Invalid username or password';

function jarOf() {
  const jar = {};
  return {
    jar,
    absorb(res) { for (const c of res.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1); } },
    cookie() { return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; '); },
  };
}
async function attempt(j, username, password) {
  const g = await fetch(`${base}/admin/login`, { redirect: 'manual', headers: { cookie: j.cookie() } }); j.absorb(g);
  const res = await fetch(`${base}/admin/login`, { method: 'POST', redirect: 'manual', headers: { cookie: j.cookie(), 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ username, password, _csrf: j.jar.sdca_csrf }).toString() });
  j.absorb(res);
  return { status: res.status, text: res.status === 401 ? await res.text() : '' };
}

before(async () => {
  process.env.NODE_ENV = 'development';
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdca-sec-'));
  process.env.DB_FILE = path.join(dir, 's.db');   // the session store and the app then share this temp database
  process.env.DATA_DIR = dir;
  process.env.STORAGE_DIR = path.join(dir, 'storage');
  const { openDb } = await import('../src/db/open.js');
  const { applyMigrations, MIGRATIONS_DIR } = await import('../src/db/migrate.js');
  const { createApp } = await import('../src/app.js');
  const { hashPassword } = await import('../src/admin/auth.js');
  uploadDir = (await import('../src/admin/uploads.js')).uploadDir;
  db = openDb();
  applyMigrations(db, MIGRATIONS_DIR);
  for (const [u, p] of [['boss', 'correct-horse-battery'], ['other', 'another-long-pass1']]) db.prepare('INSERT INTO admin_users (username, password_hash, role) VALUES (?,?,?)').run(u, hashPassword(p), 'admin');
  server = createApp({ db }).listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise((r) => server.close(r)); db.close(); fs.rmSync(dir, { recursive: true, force: true }); });

test('admin: 5 wrong passwords lock the account, even the right password is refused, and every failure reads the same', async () => {
  const j = jarOf();
  const unknown = await attempt(j, 'nobody', 'x');
  const wrong = await attempt(j, 'other', 'definitely-wrong');
  assert.equal(unknown.status, 401); assert.equal(wrong.status, 401);
  assert.ok(unknown.text.includes(GENERIC) && wrong.text.includes(GENERIC));
  for (let i = 0; i < 5; i++) await attempt(j, 'boss', 'wrong-guess');
  const row = db.prepare("SELECT failed_attempts, locked_until FROM admin_users WHERE username = 'boss'").get();
  assert.ok(row.locked_until, 'locked after the 5th failure');
  const locked = await attempt(j, 'boss', 'correct-horse-battery');
  assert.equal(locked.status, 401);
  assert.ok(locked.text.includes(GENERIC), 'a locked account gives the generic message, not a hint');
  assert.ok(db.prepare("SELECT 1 FROM login_events WHERE username = 'boss' AND detail = 'account locked'").get());
  // lock expires -> the right password works and the counters reset
  db.prepare("UPDATE admin_users SET locked_until = '2000-01-01 00:00:00' WHERE username = 'boss'").run();
  assert.equal((await attempt(j, 'boss', 'correct-horse-battery')).status, 302);
  const after = db.prepare("SELECT failed_attempts, locked_until FROM admin_users WHERE username = 'boss'").get();
  assert.equal(after.failed_attempts, 0); assert.equal(after.locked_until, null);
});

test('admin: signing in issues a new session id and removes the old one', async () => {
  const j = jarOf();
  assert.equal((await attempt(j, 'other', 'another-long-pass1')).status, 302);
  const sid1 = j.jar.sdca_sid; assert.ok(sid1);
  assert.equal((await attempt(j, 'other', 'another-long-pass1')).status, 302);   // sign in again with the old cookie
  const sid2 = j.jar.sdca_sid;
  assert.notEqual(sid1, sid2);
  const raw = (s) => decodeURIComponent(s).replace(/^s:/, '').split('.')[0];
  assert.equal(db.prepare('SELECT COUNT(*) n FROM sessions WHERE sid = ?').get(raw(sid1)).n, 0, 'old session row is gone');
});

test('admin CSRF cookie is HttpOnly, and Secure when the request came over https', async () => {
  const plain = await fetch(`${base}/admin/login`);
  assert.match(plain.headers.getSetCookie().find((c) => c.startsWith('sdca_csrf')), /HttpOnly/i);
  const https = await fetch(`${base}/admin/login`, { headers: { 'x-forwarded-proto': 'https' } });
  const c = https.headers.getSetCookie().find((x) => x.startsWith('sdca_csrf'));
  assert.match(c, /HttpOnly/i); assert.match(c, /Secure/i);
});

test('admin upload: a file whose contents do not match its extension is rejected and deleted', async () => {
  const j = jarOf();
  assert.equal((await attempt(j, 'other', 'another-long-pass1')).status, 302);
  const existing = new Set(fs.readdirSync(uploadDir));   // only files created by this test are ever removed
  const post = async (bytes, name) => {
    const fd = new FormData();
    fd.set('_csrf', j.jar.sdca_csrf); fd.set('title_en', 'T'); fd.set('category', 'form');
    fd.set('file', new Blob([bytes], { type: 'application/pdf' }), name);
    return fetch(`${base}/admin/documents`, { method: 'POST', redirect: 'manual', headers: { cookie: j.cookie() }, body: fd });
  };
  const bad = await post('<html><script>alert(1)</script></html>', 'evil.pdf');
  assert.equal(bad.status, 400);
  assert.match(await bad.text(), /do not match its type/);
  assert.deepEqual(fs.readdirSync(uploadDir).filter((f) => !existing.has(f)), [], 'rejected file removed from disk');
  const good = await post('%PDF-1.4\n%fake but starts like a pdf\n', 'ok.pdf');
  assert.notEqual(good.status, 400);
  for (const f of fs.readdirSync(uploadDir)) if (!existing.has(f)) fs.rmSync(path.join(uploadDir, f), { force: true });
});

test('chat: bad JSON gets a 400, and the daily cap answers without calling the model', async () => {
  const bad = await fetch(`${base}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{not json' });
  assert.equal(bad.status, 400);
  const res = await fetch(`${base}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'hello', lang: 'en' }) });
  assert.equal(res.status, 200);
  assert.match(await res.text(), /limit for today/);
});

test('responses carry a Permissions-Policy header', async () => {
  const r = await fetch(`${base}/en/`);
  assert.match(r.headers.get('permissions-policy') || '', /camera=\(\)/);
});
