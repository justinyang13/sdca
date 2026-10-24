// tests/login-events.test.js — sign-in tracking and the admin-only /admin/logins page.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { bootAdminApp } from './support/adminApp.js';
import { recordLogin, loginSummary } from '../src/login-events.js';

let app;
before(async () => { app = await bootAdminApp({ admins: [['boss', 'bosspass123', 'admin'], ['ed', 'edpass12345', 'editor']] }); });
after(() => app.close());
const UA = { 'user-agent': 'TestBrowser/1.0' };

test('failed and successful admin sign-ins are recorded with IP and browser', async () => {
  assert.equal((await app.session('boss', 'wrong-password', UA)).status, 401);
  assert.equal((await app.session('nobody', 'x', UA)).status, 401);
  assert.equal((await app.session('boss', 'bosspass123', UA)).status, 302);
  const rows = app.db.prepare("SELECT * FROM login_events WHERE area = 'admin' ORDER BY id").all();
  assert.deepEqual(rows.map((r) => [r.event, r.username, r.detail]), [['login_failed', 'boss', 'wrong password'], ['login_failed', 'nobody', 'unknown username'], ['login', 'boss', '']]);
  assert.ok(rows.every((r) => r.ip), 'IP recorded');
  assert.equal(rows[2].user_agent, 'TestBrowser/1.0');
});

test('passwords are never stored in the log', () => {
  const all = JSON.stringify(app.db.prepare('SELECT * FROM login_events').all());
  assert.ok(!all.includes('bosspass123') && !all.includes('wrong-password'));
});

test('/admin/logins is visible to admins and shows the activity', async () => {
  const s = await app.session('boss', 'bosspass123');
  const res = await app.get(s, '/admin/logins');
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Login activity/);
  assert.match(html, /unknown username/);
  assert.match(html, /FAILED/);
  const fh = await (await app.get(s, '/admin/logins?event=login_failed&q=nobody')).text();
  assert.match(fh, /nobody/);
  assert.ok(!fh.includes('wrong password'), 'filtered to the unknown-user row only');
});

test('/admin/logins is forbidden for editors and for signed-out visitors', async () => {
  const e = await app.session('ed', 'edpass12345');
  assert.equal(e.status, 302);
  const res = await app.get(e, '/admin/logins');
  assert.equal(res.status, 403);
  assert.ok(!(await res.text()).includes('unknown username'));
  assert.equal((await fetch(`${app.base}/admin/logins`)).status, 401);
});

test('admin sign-out is recorded', async () => {
  const s = await app.session('boss', 'bosspass123');
  await app.post(s, '/admin/logout');
  assert.ok(app.db.prepare("SELECT 1 FROM login_events WHERE event = 'logout' AND username = 'boss'").get());
});

test('recordLogin never throws and loginSummary counts the week', () => {
  assert.doesNotThrow(() => recordLogin({ prepare() { throw new Error('db gone'); } }, { area: 'admin', event: 'login' }));
  for (let i = 0; i < 3; i++) recordLogin(app.db, { area: 'portal', event: 'login_failed', username: 'x', ip: '9.9.9.9', detail: 'invalid' });
  const sum = loginSummary(app.db);
  assert.ok(sum.failed7 >= 5 && sum.logins7 >= 1);
  assert.ok(sum.failedIps.some((r) => r.ip === '9.9.9.9' && r.n === 3));
});
