// tests/login-events-portal.test.js — family-portal sign-ins and sign-outs land in login_events.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { makeClient } from './support/client.js';
import { bootPortalApp } from './support/portalApp.js';

let app, base, db, creds;
const Client = makeClient({ base: () => base, creds: () => creds });

before(async () => { app = await bootPortalApp('loginp'); ({ base, db, creds } = app); });
after(() => app.close());

test('portal failed sign-in, sign-in and sign-out are recorded', async () => {
  const bad = new Client();
  await bad.get('/en/portal/signin');
  const r = await bad.post('/en/portal/signin', { username: 'demo.admin', password: 'definitely-wrong' });
  assert.equal(r.status, 401);
  const c = await new Client().login('demo.admin');
  await c.post('/en/portal/signout', {});
  const rows = db.prepare("SELECT event, username, detail FROM login_events WHERE area = 'portal' ORDER BY id").all();
  assert.deepEqual(rows.map((x) => x.event), ['login_failed', 'login', 'logout']);
  assert.equal(rows[0].detail, 'invalid');
  assert.ok(rows.every((x) => x.username === 'demo.admin'));
  assert.ok(!JSON.stringify(rows).includes('definitely-wrong'));
});

test('portal: wrong-password answers never reveal whether an account exists, is locked or is disabled', async () => {
  const msg = async (user, pw) => { const c = new Client(); await c.get('/en/portal/signin'); const r = await c.post('/en/portal/signin', { username: user, password: pw }); return r.text.match(/Invalid username or password|temporarily locked|disabled|not activated/)?.[0] ?? `status ${r.status}`; };
  const none = await msg('no.such.user', 'wrong-password-1');
  assert.equal(none, 'Invalid username or password');
  const wrong = await msg('demo.admin', 'wrong-password-1');
  assert.equal(wrong, none, 'existing account, wrong password');
  const id = db.prepare("SELECT id FROM users WHERE username = 'demo.teacher1'").get()?.id ?? db.prepare("SELECT id FROM users WHERE username LIKE 'demo.%' AND username != 'demo.admin' LIMIT 1").get().id;
  const uname = db.prepare('SELECT username FROM users WHERE id = ?').get(id).username;
  db.prepare("UPDATE users SET status = 'disabled' WHERE id = ?").run(id);
  assert.equal(await msg(uname, 'wrong-password-1'), none, 'disabled account, wrong password');
  assert.match(await msg(uname, creds[uname]), /disabled/, 'right password reveals the state');
  db.prepare("UPDATE users SET status = 'active' WHERE id = ?").run(id);
  for (let i = 0; i < 5; i++) await msg(uname, 'wrong-password-1');
  assert.equal(await msg(uname, 'wrong-password-1'), none, 'locked account, wrong password');
  assert.match(await msg(uname, creds[uname]), /locked/, 'right password reveals the lock');
});
