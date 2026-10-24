// tests/login-events-portal.test.js — family-portal sign-ins and sign-outs land in login_events.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { makeClient } from './support/client.js';

let dir, base, server, db, creds;
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const Client = makeClient({ base: () => base, creds: () => creds });

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdca-loginp-'));
  process.env.NODE_ENV = 'development';
  process.env.DB_FILE = path.join(dir, 'p.db');
  process.env.DATA_DIR = dir;
  process.env.LOGIN_RATE_LIMIT = '10000';
  process.env.PORTAL_LOGINS_FILE = path.join(dir, 'logins.txt');
  const r = spawnSync('node', ['scripts/portal-seed.js', '--demo'], { cwd: ROOT, env: process.env, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  creds = Object.fromEntries(fs.readFileSync(process.env.PORTAL_LOGINS_FILE, 'utf8').split('\n').slice(4).filter(Boolean).map((l) => { const [u, , p] = l.trim().split(/\s{2,}/); return [u, p]; }));
  const { createApp } = await import('../src/app.js');
  const { openDb } = await import('../src/db/open.js');
  db = openDb();
  server = createApp({ db }).listen(0);
  await new Promise((res) => server.once('listening', res));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server?.close(); db?.close(); fs.rmSync(dir, { recursive: true, force: true }); });

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
