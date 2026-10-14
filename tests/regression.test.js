// tests/regression.test.js — HTML sanity crawl over the role x page matrix, plus fixed-bug regressions.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

let dir, base, server, db, creds;
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdca-reg-'));
  process.env.NODE_ENV = 'development';
  process.env.DB_FILE = path.join(dir, 'reg.db');
  process.env.DATA_DIR = dir;
  process.env.LOGIN_RATE_LIMIT = '10000';
  process.env.RATE_LIMIT = '100000';
  process.env.PORTAL_LOGINS_FILE = path.join(dir, 'logins.txt');
  const r = spawnSync('node', ['scripts/portal-seed.js', '--demo'], { cwd: ROOT, env: process.env, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  creds = Object.fromEntries(fs.readFileSync(process.env.PORTAL_LOGINS_FILE, 'utf8').split('\n').slice(4).filter(Boolean).map((l) => { const [u, , p] = l.trim().split(/\s+/); return [u, p]; }));
  const { createApp } = await import('../src/app.js');
  const { openDb } = await import('../src/db/open.js');
  db = openDb();
  server = createApp({ db }).listen(0);
  await new Promise((res) => server.once('listening', res));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server?.close(); db?.close(); fs.rmSync(dir, { recursive: true, force: true }); });

class Client {
  constructor() { this.c = {}; }
  absorb(res) { for (const h of res.headers.getSetCookie?.() || []) { const [kv] = h.split(';'); const i = kv.indexOf('='); this.c[kv.slice(0, i)] = kv.slice(i + 1); } }
  get cookie() { return Object.entries(this.c).map(([k, v]) => `${k}=${v}`).join('; '); }
  async req(method, p, form) {
    const headers = { cookie: this.cookie }; let body;
    if (form) { headers['content-type'] = 'application/x-www-form-urlencoded'; body = (form instanceof URLSearchParams ? form : new URLSearchParams(form)).toString(); }
    const res = await fetch(base + p, { method, headers, body, redirect: 'manual' });
    this.absorb(res);
    return { status: res.status, loc: res.headers.get('location'), text: await res.text() };
  }
  get(p) { return this.req('GET', p); }
  async post(p, form) {
    if (!this.c.sdca_csrf) await this.get('/en/portal/signin');
    const f = form instanceof URLSearchParams ? form : new URLSearchParams(form); f.set('_csrf', this.c.sdca_csrf);
    return this.req('POST', p, f);
  }
  async login(user) { await this.get('/en/portal/signin'); const r = await this.post('/en/portal/signin', { username: user, password: creds[user] }); assert.equal(r.status, 302, `login ${user}`); return this; }
}


const as = async (u) => new Client().login(u);
const roleUsers = () => Object.keys(creds);
const PAGES = ['/en/portal', '/zh/portal', '/en/portal/manage/persons', '/en/portal/manage/families', '/en/portal/manage/school_years', '/en/portal/manage/volunteer_signups', '/en/portal/manage/enrollments', '/en/portal/manage/events', '/en/portal/finance/payment', '/en/portal/profile'];
const BAD = [/=&#34;/, /=&quot;/, /\bundefined\b/, /\[object Object\]/, /<%/, /\bNaN\b/];

test('regression: no page leaks template debris (escaped attributes, undefined, [object Object], NaN) for any demo role', async () => {
  const seen = new Set();
  for (const u of roleUsers().filter((x) => x.startsWith('demo.')).slice(0, 14)) {
    const c = await as(u);
    for (const p of PAGES) {
      const r = await c.get(p);
      assert.ok(r.status < 500, `${u} ${p} -> ${r.status}`);
      if (r.status !== 200) continue;
      for (const re of BAD) {
        const m = r.text.replace(/<script[\s\S]*?<\/script>/g, '').match(re);
        assert.equal(m, null, `${u} ${p} contains ${re}: ${m && r.text.slice(Math.max(0, m.index - 60), m.index + 60)}`);
      }
      seen.add(p);
    }
  }
  assert.ok(seen.size >= 5);
});
test('regression: the drawer marks the current page with a real aria-current attribute', async () => {
  const c = await as(roleUsers().find((x) => /admin/.test(x)) || roleUsers()[0]);
  const r = await c.get('/en/portal/manage/school_years');
  assert.match(r.text, /aria-current="page"/); assert.doesNotMatch(r.text, /aria-current=&#34;/);
});
test('regression: unknown username sign-in is a 4xx page, not a 500', async () => {
  const c = new Client(); await c.get('/en/portal/signin');
  const r = await c.post('/en/portal/signin', { username: 'nobody.at.all', password: 'x' }); assert.ok(r.status < 500, String(r.status));
});
test('regression: Volunteer Sign-ups wraps date/status cells and School Years keeps the label on one line', async () => {
  const c = await as(roleUsers().find((x) => /admin/.test(x)) || roleUsers()[0]);
  const v = await c.get('/en/portal/manage/volunteer_signups'); assert.equal(v.status, 200); assert.doesNotMatch(v.text, /<td data-col="signed_up_at" class="[^"]*\bnw\b/);
  const y = await c.get('/en/portal/manage/school_years'); assert.match(y.text, /<td data-col="label" class="[^"]*\bnw\b[^"]*" style="min-width:130px"/);
});
