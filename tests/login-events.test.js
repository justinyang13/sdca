// tests/login-events.test.js — sign-in tracking and the admin-only /admin/logins page.
process.env.LOGIN_RATE_LIMIT = '1000';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { newDb } from '../src/db/open.js';
import { applyMigrations, MIGRATIONS_DIR } from '../src/db/migrate.js';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/admin/auth.js';
import { recordLogin, loginSummary } from '../src/login-events.js';

let server, base, dir, db;

async function adminSession(username, password) {
  const jar = {};
  const absorb = (res) => { for (const c of res.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1); } };
  const cookie = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
  absorb(await fetch(`${base}/admin/login`, { redirect: 'manual' }));
  const res = await fetch(`${base}/admin/login`, {
    method: 'POST', redirect: 'manual',
    headers: { cookie: cookie(), 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'TestBrowser/1.0' },
    body: new URLSearchParams({ username, password, _csrf: jar.sdca_csrf }).toString(),
  });
  absorb(res);
  return { status: res.status, cookie, csrf: jar.sdca_csrf };
}

before(async () => {
  process.env.NODE_ENV = 'development';
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdca-logins-'));
  db = newDb(path.join(dir, 't.db'));
  applyMigrations(db, MIGRATIONS_DIR);
  db.prepare('INSERT INTO admin_users (username, password_hash, role) VALUES (?,?,?)').run('boss', hashPassword('bosspass123'), 'admin');
  db.prepare('INSERT INTO admin_users (username, password_hash, role) VALUES (?,?,?)').run('ed', hashPassword('edpass12345'), 'editor');
  server = createApp({ db }).listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise((r) => server.close(r)); db.close(); fs.rmSync(dir, { recursive: true, force: true }); });

test('failed and successful admin sign-ins are recorded with IP and browser', async () => {
  assert.equal((await adminSession('boss', 'wrong-password')).status, 401);
  assert.equal((await adminSession('nobody', 'x')).status, 401);
  assert.equal((await adminSession('boss', 'bosspass123')).status, 302);
  const rows = db.prepare("SELECT * FROM login_events WHERE area = 'admin' ORDER BY id").all();
  assert.deepEqual(rows.map((r) => [r.event, r.username, r.detail]), [['login_failed', 'boss', 'wrong password'], ['login_failed', 'nobody', 'unknown username'], ['login', 'boss', '']]);
  assert.ok(rows.every((r) => r.ip), 'IP recorded');
  assert.equal(rows[2].user_agent, 'TestBrowser/1.0');
});

test('passwords are never stored in the log', () => {
  const all = JSON.stringify(db.prepare('SELECT * FROM login_events').all());
  assert.ok(!all.includes('bosspass123') && !all.includes('wrong-password'));
});

test('/admin/logins is visible to admins and shows the activity', async () => {
  const s = await adminSession('boss', 'bosspass123');
  const res = await fetch(`${base}/admin/logins`, { headers: { cookie: s.cookie() } });
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Login activity/);
  assert.match(html, /unknown username/);
  assert.match(html, /FAILED/);
  const f = await fetch(`${base}/admin/logins?event=login_failed&q=nobody`, { headers: { cookie: s.cookie() } });
  const fh = await f.text();
  assert.match(fh, /nobody/);
  assert.ok(!fh.includes('wrong password'), 'filtered to the unknown-user row only');
});

test('/admin/logins is forbidden for editors and for signed-out visitors', async () => {
  const e = await adminSession('ed', 'edpass12345');
  assert.equal(e.status, 302);
  const res = await fetch(`${base}/admin/logins`, { headers: { cookie: e.cookie() } });
  assert.equal(res.status, 403);
  assert.ok(!(await res.text()).includes('unknown username'));
  assert.equal((await fetch(`${base}/admin/logins`)).status, 401);
});

test('admin sign-out is recorded', async () => {
  const s = await adminSession('boss', 'bosspass123');
  await fetch(`${base}/admin/logout`, { method: 'POST', redirect: 'manual', headers: { cookie: s.cookie(), 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ _csrf: s.csrf }).toString() });
  assert.ok(db.prepare("SELECT 1 FROM login_events WHERE event = 'logout' AND username = 'boss'").get());
});

test('recordLogin never throws and loginSummary counts the week', () => {
  assert.doesNotThrow(() => recordLogin({ prepare() { throw new Error('db gone'); } }, { area: 'admin', event: 'login' }));
  for (let i = 0; i < 3; i++) recordLogin(db, { area: 'portal', event: 'login_failed', username: 'x', ip: '9.9.9.9', detail: 'invalid' });
  const sum = loginSummary(db);
  assert.ok(sum.failed7 >= 5 && sum.logins7 >= 1);
  assert.ok(sum.failedIps.some((r) => r.ip === '9.9.9.9' && r.n === 3));
});
