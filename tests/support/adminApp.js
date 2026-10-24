// tests/support/adminApp.js — boot the app on a temp database with admin accounts, and sign in as one.
//   const app = await bootAdminApp({ admins: [['boss', 'a-long-password', 'admin'], ['ed', 'another-long-pw', 'editor']] });
//   const s = await app.session('boss', 'a-long-password');   // { status, cookie(), csrf, jar }
//   await app.post(s, '/admin/events', { title_en: 'x', ... });   // form POST with the CSRF field filled in
//   await app.close();
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { newDb } from '../../src/db/open.js';
import { applyMigrations, MIGRATIONS_DIR } from '../../src/db/migrate.js';
import { createApp } from '../../src/app.js';
import { hashPassword } from '../../src/admin/auth.js';

export async function bootAdminApp({ admins = [] } = {}) {
  process.env.LOGIN_RATE_LIMIT = '100000';
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdca-admin-'));
  const db = newDb(path.join(dir, 't.db'));
  applyMigrations(db, MIGRATIONS_DIR);
  for (const [u, p, role] of admins) db.prepare('INSERT INTO admin_users (username, password_hash, role) VALUES (?,?,?)').run(u, hashPassword(p), role || 'admin');
  const server = createApp({ db }).listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const newJar = () => {
    const jar = {};
    return { jar, absorb(res) { for (const c of res.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1); } }, cookie: () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ') };
  };

  /** Sign in. `headers` are added to the POST (e.g. a user-agent). Returns the jar helpers plus status/csrf/text. */
  async function session(username, password, headers = {}, j = newJar()) {
    j.absorb(await fetch(`${base}/admin/login`, { redirect: 'manual', headers: { cookie: j.cookie() } }));
    const res = await fetch(`${base}/admin/login`, {
      method: 'POST', redirect: 'manual',
      headers: { cookie: j.cookie(), 'content-type': 'application/x-www-form-urlencoded', ...headers },
      body: new URLSearchParams({ username, password, _csrf: j.jar.sdca_csrf }).toString(),
    });
    j.absorb(res);
    return { ...j, status: res.status, csrf: j.jar.sdca_csrf, text: res.status === 401 ? await res.text() : '' };
  }

  const get = (s, p) => fetch(base + p, { redirect: 'manual', headers: { cookie: s.cookie() } });
  const post = (s, p, form = {}) => fetch(base + p, {
    method: 'POST', redirect: 'manual',
    headers: { cookie: s.cookie(), 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...form, _csrf: s.csrf }).toString(),
  });

  return {
    db, base, dir, session, get, post, newJar,
    async close() { await new Promise((r) => server.close(r)); db.close(); fs.rmSync(dir, { recursive: true, force: true }); },
  };
}
