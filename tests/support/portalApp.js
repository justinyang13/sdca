// tests/support/portalApp.js — boot the whole app on a temp database loaded with the demo school (scripts/portal-seed.js --demo).
//   const app = await bootPortalApp('finance');   // { db, base, creds, close() }; creds[username] = that account's password
//   const Client = makeClient({ base: () => app.base, creds: () => app.creds });   // tests/support/client.js
//   after(() => app.close());
// The app is created with the DB injected, and DB_FILE / DATA_DIR point at the temp folder, so nothing touches the live database.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');

export async function bootPortalApp(name = 'app') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `sdca-${name}-`));
  process.env.NODE_ENV = 'development';
  process.env.DB_FILE = path.join(dir, `${name}.db`);
  process.env.DATA_DIR = dir;
  process.env.LOGIN_RATE_LIMIT = '10000';
  process.env.RATE_LIMIT = '100000';
  process.env.PORTAL_LOGINS_FILE = path.join(dir, 'logins.txt');
  const seed = spawnSync('node', ['scripts/portal-seed.js', '--demo'], { cwd: ROOT, env: process.env, encoding: 'utf8' });
  assert.equal(seed.status, 0, seed.stderr || seed.stdout);
  const creds = Object.fromEntries(fs.readFileSync(process.env.PORTAL_LOGINS_FILE, 'utf8').split('\n').slice(4).filter(Boolean).map((l) => { const [u, , p] = l.trim().split(/\s{2,}/); return [u, p]; }));
  const { createApp } = await import('../../src/app.js');
  const { openDb } = await import('../../src/db/open.js');
  const db = openDb();
  const server = createApp({ db }).listen(0);
  await new Promise((res) => server.once('listening', res));
  return {
    db, creds, dir,
    base: `http://127.0.0.1:${server.address().port}`,
    close() { server.close(); db.close(); fs.rmSync(dir, { recursive: true, force: true }); },
  };
}
