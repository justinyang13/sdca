// tests/csp.test.js — Phase 1: verify upgrade-insecure-requests absent on plain-http
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
  // Force the "not-https" branch.
  process.env.HTTPS = 'false';
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdca-csp-'));
  file = path.join(dir, 'csp.db');
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

test('Content-Security-Policy does NOT include upgrade-insecure-requests on http demo', async () => {
  const res = await fetch(`${base}/en/`);
  assert.equal(res.status, 200);
  const csp = res.headers.get('content-security-policy') || '';
  assert.ok(csp.length > 0, 'expected a CSP header');
  assert.ok(
    !/upgrade-insecure-requests/i.test(csp),
    `upgrade-insecure-requests must be absent, got: ${csp}`
  );
});

test('Strict-Transport-Security header is absent on http demo', async () => {
  const res = await fetch(`${base}/en/`);
  const hsts = res.headers.get('strict-transport-security') || '';
  assert.equal(hsts, '', `HSTS must be absent on http demo, got: ${hsts}`);
});
