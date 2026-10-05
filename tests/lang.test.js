// tests/lang.test.js — `/` redirect + /en/ /zh/ home render
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
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdca-lang-'));
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

async function get(path, headers = {}) {
  return fetch(`${base}${path}`, { redirect: 'manual', headers });
}

test('GET / with no lang hint → 302 to /en/', async () => {
  const res = await get('/');
  assert.equal(res.status, 302);
  assert.match(res.headers.get('location') || '', /^\/en\/?$/);
});

test('GET / with Accept-Language: zh-TW → 302 to /zh/', async () => {
  const res = await get('/', { 'accept-language': 'zh-TW,zh;q=0.9,en;q=0.5' });
  assert.equal(res.status, 302);
  assert.match(res.headers.get('location') || '', /^\/zh\/?$/);
});

test('GET / with cookie lang=zh → 302 to /zh/', async () => {
  const res = await get('/', { cookie: 'lang=zh' });
  assert.equal(res.status, 302);
  assert.match(res.headers.get('location') || '', /^\/zh\/?$/);
});

test('GET /en/ → 200 with lang="en"', async () => {
  const res = await get('/en/');
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /<html lang="en">/);
  assert.match(html, /San Diego Chinese Academy/);
});

test('GET /zh/ → 200 with lang="zh-Hant" and UTF-8 Chinese', async () => {
  const res = await get('/zh/');
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /<html lang="zh-Hant">/);
  assert.match(html, /聖地牙哥中華學苑/);
  // not escaped to \u...
  assert.doesNotMatch(html, /\\u[0-9a-fA-F]{4}/);
});

test('GET /en/unknown → 404 with bilingual 404 page', async () => {
  const res = await get('/en/does-not-exist');
  assert.equal(res.status, 404);
  const html = await res.text();
  assert.match(html, /Page not found|找不到頁面/);
});

test('GET /zh/unknown → 404 in zh', async () => {
  const res = await get('/zh/does-not-exist');
  assert.equal(res.status, 404);
  const html = await res.text();
  assert.match(html, /找不到頁面/);
});
