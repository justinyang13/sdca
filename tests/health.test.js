// tests/health.test.js — /healthz returns 200 with db ok
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { newDb } from '../src/db/open.js';
import { applyMigrations, MIGRATIONS_DIR } from '../src/db/migrate.js';
import { createApp } from '../src/app.js';

let server, base, dir, file, db;

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdca-app-'));
  file = path.join(dir, 'app.db');
  db = newDb(file);
  applyMigrations(db, MIGRATIONS_DIR);
  const app = createApp({ db });
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('GET /healthz → 200 {ok:true}', async () => {
  const res = await fetch(`${base}/healthz`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
});
