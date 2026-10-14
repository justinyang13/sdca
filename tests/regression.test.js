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
test('every board position can open Hero Slides and sees it in the menu', async () => {
  const boards = ['president', 'vicepresident', 'boardsecretary', 'treasurer', 'editorial', 'ptadirector', 'scrip', 'activity', 'operation'].map((n) => `demo.${n}`);
  for (const u of boards) assert.ok(creds[u], `${u} exists`);
  for (const u of boards) {
    const c = await as(u);
    assert.equal((await c.get('/en/portal/manage/slides')).status, 200, u);
    assert.match((await c.get('/en/portal')).text, /\/portal\/manage\/slides"/, `${u} menu`);
  }
});
test('Hero Slides sits directly above Reports in Staff Tools', async () => {
  const t = (await (await as('demo.admin')).get('/en/portal')).text;
  const links = [...t.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]);
  const i = links.indexOf('/en/portal/manage/slides');
  assert.ok(i > 0); assert.equal(links[i + 1], '/en/portal/reports');
});
test('Board Positions lives in the Admin menu; Board Members follows Families in Directory', async () => {
  const links = async (u) => [...(await (await as(u)).get('/en/portal')).text.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]);
  const a = await links('demo.admin');
  assert.ok(a.indexOf('/en/portal/manage/board_positions') > a.indexOf('/en/portal/manage/payment_methods') || a.includes('/en/portal/manage/board_positions'));
  const fi = a.indexOf('/en/portal/manage/families'); assert.equal(a[fi + 1], '/en/portal/manage/board_members');
  assert.ok(!(await links('demo.president')).includes('/en/portal/manage/board_positions'), 'not in a board member menu');
});
test('every board member sees the school overview totals and the registrations widget', async () => {
  for (const n of ['secretary', 'parentsecretary', 'president', 'vicepresident', 'boardsecretary', 'treasurer', 'editorial', 'ptadirector', 'scrip', 'activity', 'operation']) {
    const t = (await (await as(`demo.${n}`)).get('/en/portal')).text;
    for (const w of ['Families', 'Directory', 'Students this year', 'Classes', 'Users', 'Transactions this year', 'Events', 'Announcements', 'Class announcements', 'Volunteers', 'Room parents', 'Teachers and assistants', 'Board members', 'Registration status']) assert.match(t, new RegExp(`<(span|h2)>${w}( <small>|</)`), `${n}: ${w}`);
    assert.doesNotMatch(t, /Admin dashboard/);
    const labels = [...t.slice(t.indexOf('School overview'), t.indexOf('chart-grid')).matchAll(/<span>([^<]+)<\/span>/g)].map((m) => m[1]);
    assert.deepEqual(labels, [...labels].sort((x, y) => x.localeCompare(y)), `${n}: tiles sorted A-Z`);
  }
});
test('school overview charts: enrollment by class, students by year, registration status, volunteer jobs', async () => {
  for (const n of ['president', 'treasurer', 'secretary']) {
    const t = (await (await as(`demo.${n}`)).get('/en/portal')).text;
    for (const h of ['Enrollment by class', 'Students by school year', 'Registration status', 'Volunteer jobs']) assert.match(t, new RegExp(`<h2>${h}`), `${n}: ${h}`);
    assert.ok((t.match(/class="bar-row"/g) || []).length >= 3, 'bars rendered');
    assert.ok((t.match(/class="col-bar"/g) || []).length >= 2, 'a column per school year');
    assert.match(t, /class="seg seg-0"/);
  }
  assert.match((await (await as('demo.president')).get('/zh/portal')).text, /各班人數/);
});
test('overview: Registration status sits right above Students by school year in one column', async () => {
  const t = (await (await as('demo.president')).get('/en/portal')).text;
  const r = t.indexOf('Registration status'), y = t.indexOf('Students by school year'), col = t.lastIndexOf('class="chart-col"', r);
  assert.ok(col > 0 && col < r && r < y && y < t.indexOf('Volunteer jobs'));
  assert.ok(!t.slice(r, y).includes('Enrollment by class'));
});
test('admin dashboard has the school overview (tiles A-Z, charts) plus its setup and activity cards', async () => {
  const t = (await (await as('demo.admin')).get('/en/portal')).text;
  assert.match(t, /School overview/); assert.match(t, /Admin dashboard/); assert.match(t, /Emails \(demo outbox\)/);
  for (const h of ['Enrollment by class', 'Students by school year', 'Registration status', 'Volunteer jobs', 'Set up the school', 'Recent activity']) assert.match(t, new RegExp(`<h2>${h.replace(/[()]/g, '\\$&')}`), h);
  assert.ok(t.indexOf('School overview') < t.indexOf('Admin dashboard'));
  assert.equal((t.match(/class="stat-grid"/g) || []).length, 1, 'no second tile grid');
});
