#!/usr/bin/env node
// scripts/portal-smoke.js — sign in as every demo role and fetch the pages that role should see.
//   node scripts/portal-smoke.js [base=http://localhost:3100]
import fs from 'node:fs';
const BASE = process.argv[2] || 'http://localhost:3100';
const lines = fs.readFileSync(new URL('../data/PORTAL-DEMO-LOGINS.txt', import.meta.url), 'utf8').split('\n').slice(4).filter(Boolean);
const creds = Object.fromEntries(lines.map((l) => { const [u, r, p] = l.trim().split(/\s{2,}/); return [u, p]; }));
class Jar { constructor() { this.c = {}; } set(res) { for (const h of res.headers.getSetCookie?.() || []) { const [kv] = h.split(';'); const i = kv.indexOf('='); this.c[kv.slice(0, i)] = kv.slice(i + 1); } } get h() { return Object.entries(this.c).map(([k, v]) => `${k}=${v}`).join('; '); } }
async function login(user, lang = 'en') {
  const jar = new Jar();
  let r = await fetch(`${BASE}/${lang}/portal/signin`, { redirect: 'manual' }); jar.set(r);
  const csrf = jar.c.sdca_csrf;
  r = await fetch(`${BASE}/${lang}/portal/signin`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: jar.h }, body: new URLSearchParams({ _csrf: csrf, username: user, password: creds[user] }) });
  jar.set(r);
  return { jar, status: r.status, loc: r.headers.get('location') };
}
const get = async (jar, path) => { const r = await fetch(BASE + path, { redirect: 'manual', headers: { cookie: jar.h } }); jar.set(r); const body = await r.text(); return { status: r.status, body, loc: r.headers.get('location') }; };
const PLAN = {
  'demo.admin': ['/en/portal', '/en/portal/manage/persons', '/en/portal/manage/families', '/en/portal/manage/users', '/en/portal/manage/roles', '/en/portal/manage/roles/2/permissions', '/en/portal/class-roster', '/en/portal/manage/enrollments', '/en/portal/manage/transactions', '/en/portal/manage/registrations', '/en/portal/manage/fee_schedules', '/en/portal/fees', '/en/portal/manage/enrollments?f_placement=unplaced', '/en/portal/reports', '/en/portal/class-roster', '/en/portal/manage/events', '/en/portal/events-calendar', '/en/portal/class-roster?sort=n&dir=desc', '/en/portal/manage/student_list', '/en/portal/manage/volunteer_list', '/en/portal/manage/student_list/export.csv', '/en/portal/manage/student_list', '/en/portal/manage/portal_audit', '/en/portal/manage/email_outbox', '/en/portal/manage/persons/new', '/en/portal/manage/persons/1', '/en/portal/people/1', '/en/portal/families/1', '/en/portal/manage/volunteer_jobs', '/en/portal/manage/credit_grades', '/en/portal/finance/payment', '/en/portal/finance/manual/new?family=1', '/zh/portal'],
  'demo.secretary': ['/en/portal', '/en/portal/manage/persons', '/en/portal/manage/enrollments?f_placement=unplaced', '/en/portal/reports', '/en/portal/manage/student_list', '/en/portal/manage/volunteer_list', '/en/portal/manage/student_list/export.csv', '/en/portal/finance/payment', '/en/portal/families/new'],
  'demo.accountant': ['/en/portal', '/en/portal/finance/reports', '/en/portal/finance/reports?report=aging', '/en/portal/finance/reports?report=summary', '/en/portal/finance/reports?report=scrip', '/en/portal/manage/transactions', '/en/portal/fees', '/en/portal/finance/manual/new'],
  'demo.pta': ['/en/portal', '/en/portal/manage/volunteer_signups', '/en/portal/manage/volunteer_list', '/en/portal/manage/volunteer_list/export.csv'],
  'demo.principal': ['/en/portal', '/en/portal/class-roster', '/en/portal/reports'],
  'demo.teacher1': ['/en/portal', '/en/portal/classes/1', '/en/portal/class-announcements'],
  'demo.president': ['/en/portal', '/en/portal/manage/board_members', '/en/portal/manage/slides', '/en/portal/manage/announcements', '/en/portal/class-announcements', '/en/portal/finance/reports'],
  'demo.treasurer': ['/en/portal', '/en/portal/finance/payment', '/en/portal/finance/reports'],
  'demo.scrip': ['/en/portal', '/en/portal/finance/manual/new', '/en/portal/finance/reports?report=scrip'],
  'demo.operation': ['/en/portal', '/en/portal/manage/rooms', '/en/portal/class-roster'],
  'demo.editorial': ['/en/portal', '/en/portal/manage/slides', '/en/portal/manage/announcements'],
  'demo.activity': ['/en/portal', '/en/portal/events-calendar'],
  'demo.ptadirector': ['/en/portal', '/en/portal/manage/volunteer_list'],
  'demo.vicepresident': ['/en/portal', '/en/portal/manage/registrations'],
  'demo.boardsecretary': ['/en/portal', '/en/portal/manage/events'],
  'demo.parent01': ['/en/portal', '/en/portal/transactions', '/en/portal/volunteer', '/en/portal/families/1', '/en/portal/families/1/register', '/en/portal/families/1/add-child', '/en/portal/families/1/edit', '/zh/portal', '/en/portal/change-password', '/en/portal/waiver'],
  'demo.student01': ['/en/portal'],
};
const FORBID = { 'demo.parent01': ['/en/portal/manage/persons', '/en/portal/manage/roles', '/en/portal/fees', '/en/portal/manage/student_list', '/en/portal/families/2', '/en/portal/finance/payment'], 'demo.student01': ['/en/portal/manage/persons', '/en/portal/transactions'], 'demo.teacher1': ['/en/portal/manage/persons', '/en/portal/fees'], 'demo.secretary': ['/en/portal/manage/roles', '/en/portal/fees'], 'demo.accountant': ['/en/portal/manage/persons/new', '/en/portal/manage/roles'] };
let bad = 0;
for (const [user, paths] of Object.entries(PLAN)) {
  if (!creds[user]) { console.log('skip (no login):', user); continue; }
  const { jar, status, loc } = await login(user);
  if (status !== 302) { console.log(`✗ login ${user}: ${status}`); bad++; continue; }
  for (const p of paths) {
    const r = await get(jar, p);
    const ok = r.status === 200 && !/ReferenceError|TypeError|is not defined|Cannot read/.test(r.body);
    if (!ok) { bad++; console.log(`✗ ${user} ${p} → ${r.status} ${r.loc || ''} ${(r.body.match(/(ReferenceError|TypeError)[^<\n]{0,140}/) || [''])[0]}`); }
  }
  for (const p of FORBID[user] || []) { const r = await get(jar, p); if (r.status !== 403 && r.status !== 302) { bad++; console.log(`✗ ${user} should be blocked from ${p} but got ${r.status}`); } }
  console.log(`✓ ${user}: ${paths.length} pages, ${(FORBID[user] || []).length} blocked`);
}
console.log(bad ? `${bad} problem(s)` : 'all good');
process.exit(bad ? 1 : 0);
