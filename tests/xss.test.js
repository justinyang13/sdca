// tests/xss.test.js — stored-XSS sweep: hostile text goes into every text column, then every list / detail / edit page and the public site must show it escaped.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { makeClient } from './support/client.js';

let dir, base, server, db, creds;
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdca-xss-'));
  process.env.NODE_ENV = 'development';
  process.env.DB_FILE = path.join(dir, 'xss.db');
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

const Client = makeClient({ base: () => base, creds: () => creds });


const as = async (u) => new Client().login(u);
const PAYLOAD = `"'><svg/onload=alert(9)><script>alert(9)</script><img src=x onerror=alert(9)>`;
const MARKERS = [/<script>alert\(9\)/i, /<svg\/onload/i, /<img src=x onerror/i, /onerror=alert\(9\)(?!&)/i, /"'><svg/];
const stripScripts = (h) => h.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (m) => (/alert\(9\)/.test(m) ? m : ''));

/** Put the payload into every free-text column of every table (skipping keys, dates, hashes, and columns a CHECK rule refuses). */
function poison() {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('sessions','users','roles','permissions','role_permissions','user_roles','admin_users','schema_migrations','migrations','portal_audit','audit_log')").all().map((r) => r.name);
  let hit = 0;
  for (const t of tables) {
    for (const c of db.prepare(`PRAGMA table_info("${t}")`).all()) {
      if (!/TEXT|CHAR/i.test(c.type) || c.pk || /(^|_)(id|code|slug|status|kind|type|date|at|hash|key|sid|path|url|ext|mime|sort|lang|month|year|time|day|num|token|amount|ip|file|image|state|zip)(_|$)/i.test(c.name)) continue;
      try { hit += db.prepare(`UPDATE "${t}" SET "${c.name}" = ? WHERE "${c.name}" IS NOT NULL AND "${c.name}" <> ''`).run(PAYLOAD).changes; } catch { /* CHECK / unique rule: leave it */ }
    }
  }
  return hit;
}

test('xss: hostile text in every free-text column never comes out unescaped (portal lists, details, edit forms, dashboard, public site)', async () => {
  const { ENTITIES } = await import('../src/portal/entities.js');
  const changed = poison(); assert.ok(changed > 500, `poisoned ${changed} cells`);
  const admin = await as('demo.admin');
  const pages = ['/en/portal', '/zh/portal', '/en/portal/profile', '/en/portal/reports', '/en/portal/class-roster', '/en/portal/class-announcements', '/en/portal/finance/payment', '/en/portal/fees', '/en/portal/resources', '/en/portal/billing'];
  for (const [key, e] of Object.entries(ENTITIES)) {
    pages.push(`/en/portal/manage/${key}`, `/en/portal/manage/${key}?q=${encodeURIComponent(PAYLOAD)}`);
    let rows = []; try { rows = db.prepare(`SELECT id FROM "${e.table}" LIMIT 2`).all(); } catch { /* virtual */ }
    for (const r of rows) pages.push(`/en/portal/manage/${key}/${r.id}`, `/en/portal/manage/${key}/${r.id}/edit`);
    pages.push(`/en/portal/manage/${key}/new`);
  }
  for (const r of db.prepare('SELECT id FROM families LIMIT 2').all()) pages.push(`/en/portal/family/${r.id}`);
  for (const r of db.prepare('SELECT id FROM persons LIMIT 3').all()) pages.push(`/en/portal/person/${r.id}`);
  for (const r of db.prepare('SELECT id FROM registrations LIMIT 2').all()) pages.push(`/en/portal/receipt/${r.id}`);
  const bad = []; let ok = 0;
  for (const p of pages) {
    const r = await admin.get(p); if (r.status >= 500) bad.push(`${p} -> ${r.status}`); if (r.status !== 200) continue; ok++;
    for (const m of MARKERS) if (m.test(stripScripts(r.text))) { bad.push(`${p} leaks ${m}`); break; }
  }
  const anon = new Client();
  const publicPages = ['/en/', '/zh/', '/en/events', '/en/calendar', '/en/news', '/en/board', '/en/about', '/en/programs', '/en/contact', '/en/search?q=' + encodeURIComponent(PAYLOAD), '/en/documents', '/en/announcements'];
  for (const r of db.prepare('SELECT slug FROM events LIMIT 3').all()) publicPages.push(`/en/events/${r.slug}`);
  for (const r of db.prepare('SELECT slug FROM announcements LIMIT 3').all()) publicPages.push(`/en/news/${r.slug}`, `/en/announcements/${r.slug}`);
  for (const p of publicPages) {
    const r = await anon.get(p); if (r.status >= 500) bad.push(`${p} -> ${r.status}`); if (r.status !== 200) continue; ok++;
    for (const m of MARKERS) if (m.test(stripScripts(r.text))) { bad.push(`${p} leaks ${m}`); break; }
  }
  assert.ok(ok > 150, `crawled ${ok} pages`);
  assert.deepEqual(bad, [], bad.join('\n'));
});
test('xss: reflected input (search box, filters, sign-in, sort, ?next) is escaped', async () => {
  const c = new Client(); const q = encodeURIComponent(PAYLOAD); const bad = [];
  for (const p of [`/en/search?q=${q}`, `/en/portal/signin?next=${q}`, `/en/portal/signin?logout=${q}`, `/en/portal/forgot-username?x=${q}`, `/en/contact?topic=${q}`, `/en/events?month=${q}`, `/en/calendar?m=${q}&y=${q}`, `/admin/login?next=${q}`, `/en/nope-${q}`]) {
    const r = await c.get(p); if (r.status >= 500) bad.push(`${p} -> ${r.status}`); for (const m of MARKERS) if (m.test(stripScripts(r.text))) { bad.push(`${p} reflects ${m}`); break; }
  }
  const admin = await as('demo.admin');
  for (const p of [`/en/portal/manage/persons?q=${q}&sort=${q}&dir=${q}&page=${q}&f_gender=${q}`, `/en/portal/manage/enrollments?f_status=${q}&yr=${q}`]) {
    const r = await admin.get(p); if (r.status >= 500) bad.push(`${p} -> ${r.status}`); for (const m of MARKERS) if (m.test(stripScripts(r.text))) { bad.push(`${p} reflects ${m}`); break; }
  }
  assert.deepEqual(bad, [], bad.join('\n'));
});
test('xss: positive control — the hostile text is shown, escaped, on a list page', async () => {
  const t = (await (await as('demo.admin')).get('/en/portal/manage/events')).text;
  assert.match(t, /&lt;script&gt;alert\(9\)&lt;\/script&gt;|&lt;svg\/onload/);
});
test('xss: javascript: / data: links cannot be saved or rendered (hero slide link, announcement link)', async () => {
  const admin = await as('demo.admin');
  const bad = ['javascript:alert(9)', 'data:text/html,<script>alert(9)</script>', '//evil.example/x', ' JaVaScRiPt:alert(9)'];
  for (const url of bad) {
    const r = await admin.post('/en/portal/manage/slides', { caption_en: 'x', link_url: url, layout: 'photo', image: '/img/slides/x.jpg', sort: '1', published: '1' });
    assert.ok(r.status === 200 || r.status === 400 || r.status === 422, `${url} -> ${r.status}`);
  }
  assert.equal(db.prepare("SELECT COUNT(*) n FROM slides WHERE link_url LIKE '%alert(9)%' AND caption_en = 'x'").get().n, 0);
  db.prepare("UPDATE slides SET link_url = 'javascript:alert(9)' WHERE id = (SELECT MIN(id) FROM slides)").run();
  const home = (await new Client().get('/en/')).text;
  assert.doesNotMatch(home, /href="javascript:/i);
});
test('csv: cells that start like a spreadsheet formula are defused; plain numbers and negatives are untouched', async () => {
  const { csvEscape } = await import('../src/portal/crud.js');
  assert.equal(csvEscape('=HYPERLINK("http://evil","x")'), `"'=HYPERLINK(""http://evil"",""x"")"`);
  for (const v of ['+1+1', '-2+3', '@SUM(A1)', '\t=1']) assert.ok(csvEscape(v).replace(/^"/, '').startsWith("'"), v);
  assert.equal(csvEscape('-25.00'), '-25.00'); assert.equal(csvEscape('12'), '12'); assert.equal(csvEscape('Pat Chen'), 'Pat Chen');
});
