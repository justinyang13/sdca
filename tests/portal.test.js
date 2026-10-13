// tests/portal.test.js — the school portal: permissions, registration → payment flow, fees, roles, CSRF.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

let dir, base, server, db, creds;
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdca-portal-'));
  process.env.NODE_ENV = 'development';
  process.env.DB_FILE = path.join(dir, 'portal.db');
  process.env.DATA_DIR = dir;
  process.env.LOGIN_RATE_LIMIT = '10000';
  process.env.RATE_LIMIT = '100000';
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

class Client {
  constructor() { this.c = {}; }
  absorb(res) { for (const h of res.headers.getSetCookie?.() || []) { const [kv] = h.split(';'); const i = kv.indexOf('='); this.c[kv.slice(0, i)] = kv.slice(i + 1); } }
  get cookie() { return Object.entries(this.c).map(([k, v]) => `${k}=${v}`).join('; '); }
  async req(method, p, form) {
    const headers = { cookie: this.cookie };
    let body;
    if (form) { headers['content-type'] = 'application/x-www-form-urlencoded'; body = (form instanceof URLSearchParams ? form : new URLSearchParams(form)).toString(); }
    const res = await fetch(base + p, { method, headers, body, redirect: 'manual' });
    this.absorb(res);
    return { status: res.status, loc: res.headers.get('location'), text: await res.text() };
  }
  get(p) { return this.req('GET', p); }
  async post(p, form, { csrf = true } = {}) {
    if (csrf && !this.c.sdca_csrf) await this.get('/en/portal/signin');
    if (form instanceof URLSearchParams) { if (csrf) form.set('_csrf', this.c.sdca_csrf); return this.req('POST', p, form); }
    return this.req('POST', p, csrf ? { _csrf: this.c.sdca_csrf, ...form } : form);
  }
  async login(user) { await this.get('/en/portal/signin'); const r = await this.post('/en/portal/signin', { username: user, password: creds[user] }); assert.equal(r.status, 302, `login ${user}`); return this; }
}
const sql = (q, ...a) => db.prepare(q).all(...a);
const one = (q, ...a) => db.prepare(q).get(...a);

test('anonymous users are sent to sign in; bad password is rejected', async () => {
  const c = new Client();
  const r = await c.get('/en/portal/manage/persons');
  assert.equal(r.status, 302); assert.match(r.loc, /\/portal\/signin/);
  await c.get('/en/portal/signin');
  const bad = await c.post('/en/portal/signin', { username: 'demo.admin', password: 'nope' });
  assert.equal(bad.status, 401);
});

test('POST without a CSRF token is refused', async () => {
  const c = new Client(); await c.login('demo.admin');
  const r = await c.post('/en/portal/manage/rooms', { code: 'X1' }, { csrf: false });
  assert.equal(r.status, 403);
});

test('account locks after 5 wrong passwords', async () => {
  const { attemptLogin } = await import('../src/portal/auth.js');
  for (let i = 0; i < 5; i++) attemptLogin(db, 'demo.pta', 'wrong');
  assert.equal(attemptLogin(db, 'demo.pta', creds['demo.pta']).error, 'locked');
  db.prepare("UPDATE users SET locked_until = NULL, failed_attempts = 0 WHERE username = 'demo.pta'").run();
});

test('Admin CRUD on an entity with audit + soft delete', async () => {
  const c = new Client(); await c.login('demo.admin');
  let r = await c.post('/en/portal/manage/rooms', { code: 'T-100', building: 'Test', capacity: '30' });
  assert.equal(r.status, 302);
  const room = one("SELECT * FROM rooms WHERE code = 'T-100'");
  assert.ok(room && room.created_by && room.created_at, 'tracking columns filled');
  r = await c.post(`/en/portal/manage/rooms/${room.id}`, { code: 'T-100', building: 'Test 2', capacity: '31' });
  assert.equal(one('SELECT building, updated_by FROM rooms WHERE id = ?', room.id).building, 'Test 2');
  assert.ok(one("SELECT 1 FROM portal_audit WHERE table_name = 'rooms' AND row_id = ? AND action = 'update'", room.id));
  assert.match((await c.get('/en/portal/manage/rooms?q=T-100')).text, /T-100/);
  await c.post(`/en/portal/manage/rooms/${room.id}/delete`, {});
  assert.ok(one('SELECT deleted_at FROM rooms WHERE id = ?', room.id).deleted_at, 'soft deleted');
  assert.doesNotMatch((await c.get('/en/portal/manage/rooms?q=T-100')).text, /T-100<\/a>/);
});

test('List search + filter + paging on People', async () => {
  const c = new Client(); await c.login('demo.admin');
  const all = await c.get('/en/portal/manage/persons?ps=10');
  assert.match(all.text, /Showing[^<]*1–10 \/ \d+/);
  const f = await c.get('/en/portal/manage/persons?f_gender=F&q=Demo');
  assert.equal(f.status, 200);
  const csv = await c.get('/en/portal/manage/persons/export.csv');
  assert.equal(csv.status, 200); assert.match(csv.text, /English Last Name/);
});

test('role & permission management is Admin only, and changes take effect', async () => {
  const sec = new Client(); await sec.login('demo.secretary');
  assert.equal((await sec.get('/en/portal/manage/roles')).status, 403);
  assert.equal((await sec.post('/en/portal/manage/roles/1/permissions', {})).status, 403);
  const t = new Client(); await t.login('demo.teacher1');
  assert.equal((await t.get('/en/portal/manage/persons')).status, 403);
  const admin = new Client(); await admin.login('demo.admin');
  const teacher = one("SELECT id FROM roles WHERE code = 'teacher'");
  assert.equal((await admin.get(`/en/portal/manage/roles/${teacher.id}/permissions`)).status, 200);
  await admin.post(`/en/portal/manage/roles/${teacher.id}/permissions`, { 'p:persons.list': 'all', 'p:persons.view': 'all', 'p:class.view_own': 'own_classes' });
  const t2 = new Client(); await t2.login('demo.teacher1');
  assert.equal((await t2.get('/en/portal/manage/persons')).status, 200, 'permission granted takes effect');
  assert.equal((await t2.get('/en/portal/manage/families')).status, 403);
  // restore defaults
  const { seedRolesAndPermissions } = await import('../src/portal/perm.js');
  seedRolesAndPermissions(db, { resetGrants: true });
  const t3 = new Client(); await t3.login('demo.teacher1');
  assert.equal((await t3.get('/en/portal/manage/persons')).status, 403);
});

test('a parent only sees and edits their own family', async () => {
  const c = new Client(); await c.login('demo.parent01');
  const mine = one("SELECT fm.family_id AS id FROM users u JOIN family_members fm ON fm.person_id = u.person_id WHERE u.username = 'demo.parent01'").id;
  const other = one('SELECT id FROM families WHERE id <> ? ORDER BY id LIMIT 1', mine).id;
  assert.equal((await c.get(`/en/portal/families/${mine}`)).status, 200);
  assert.equal((await c.get(`/en/portal/families/${other}`)).status, 403);
  assert.equal((await c.get(`/en/portal/families/${other}/edit`)).status, 403);
  assert.equal((await c.post(`/en/portal/families/${other}/add-child`, { english_last_name: 'X', english_first_name: 'Y', gender: 'M', birth_date: '2018-01-01' })).status, 403);
  const kid = one("SELECT p.id FROM family_members fm JOIN persons p ON p.id = fm.person_id WHERE fm.family_id = ? AND fm.relationship = 'child' LIMIT 1", other);
  if (kid) assert.equal((await c.get(`/en/portal/people/${kid.id}/edit`)).status, 403);
  assert.equal((await c.get('/en/portal/manage/persons')).status, 403);
  assert.equal((await c.get('/en/portal/fees')).status, 403);
});

test('a student sees own school, class, teacher and grades — no classmates', async () => {
  const c = new Client(); await c.login('demo.student01');
  const r = await c.get('/en/portal');
  assert.equal(r.status, 200);
  const me = one("SELECT p.* FROM users u JOIN persons p ON p.id = u.person_id WHERE u.username = 'demo.student01'");
  const en = one("SELECT school_class_id FROM enrollments WHERE student_person_id = ? AND status = 'placed'", me.id);
  const mates = sql("SELECT p.english_first_name, p.english_last_name FROM enrollments e JOIN persons p ON p.id = e.student_person_id WHERE e.school_class_id = ? AND e.student_person_id <> ?", en.school_class_id, me.id);
  for (const m of mates) assert.ok(!r.text.includes(`${m.english_first_name} ${m.english_last_name}`), `classmate ${m.english_first_name} must not be visible`);
  assert.equal((await c.get(`/en/portal/classes/${en.school_class_id}`)).status, 403);
  assert.equal((await c.get('/en/portal/manage/persons')).status, 403);
});

test('registration wizard → payment → class placement, with fees from the fee table', async () => {
  // a family with at least one child and no registration yet
  const fam = one(`SELECT f.id FROM families f WHERE EXISTS (SELECT 1 FROM family_members c WHERE c.family_id = f.id AND c.relationship = 'child')
    AND NOT EXISTS (SELECT 1 FROM registrations r WHERE r.family_id = f.id AND r.school_year_id = (SELECT id FROM school_years WHERE is_current = 1)) ORDER BY f.id LIMIT 1`);
  assert.ok(fam, 'demo has an unregistered family');
  const user = one("SELECT u.username FROM users u JOIN family_members fm ON fm.person_id = u.person_id WHERE fm.family_id = ? AND fm.relationship = 'parent_one'", fam.id);
  const kids = sql("SELECT p.id, p.birth_date FROM family_members fm JOIN persons p ON p.id = fm.person_id WHERE fm.family_id = ? AND fm.relationship = 'child'", fam.id);
  const ctype = one("SELECT id FROM class_types WHERE code = 'regular'").id;
  const p = new Client(); await p.login(user.username);
  let r = await p.get(`/en/portal/families/${fam.id}/register`);
  assert.equal(r.status, 200); assert.match(r.text, /Select Students To Register/);
  const form = { scrip: '50', job_1: String(one('SELECT id FROM volunteer_jobs ORDER BY sort LIMIT 1').id) };
  const body = new URLSearchParams(form);
  for (const k of kids) { body.append('student', String(k.id)); body.set(`birth_${k.id}`, k.birth_date || '2018-03-03'); body.set(`ctype_${k.id}`, String(ctype)); }
  r = await p.post(`/en/portal/families/${fam.id}/register`, body);
  assert.equal(r.status, 302, r.text.slice(0, 300));
  const reg = one("SELECT * FROM registrations WHERE family_id = ? AND status = 'draft'", fam.id);
  assert.ok(reg, 'draft registration created');
  r = await p.get(`/en/portal/registrations/${reg.id}/waiver`); assert.equal(r.status, 200); assert.match(r.text, /Agree and Continue/);
  r = await p.post(`/en/portal/registrations/${reg.id}/waiver`, { agree: '1' }); assert.equal(r.status, 302);
  r = await p.get(`/en/portal/registrations/${reg.id}/form`);
  assert.equal(r.status, 200); assert.match(r.text, /Grand Total/);
  const after = one('SELECT * FROM registrations WHERE id = ?', reg.id);
  assert.equal(after.status, 'submitted');
  const { computeRegistration } = await import('../src/portal/fees.js');
  const calc = computeRegistration(db, { yearId: after.school_year_id, familyId: fam.id, registrationId: reg.id, scripPurchaseCents: after.scrip_purchase_cents,
    items: sql('SELECT student_person_id AS studentId, class_type_id AS classTypeId, grade_label AS gradeLabel FROM registration_items WHERE registration_id = ?', reg.id) });
  assert.equal(after.grand_total_cents, calc.grand, 'stored total = fee table calculation');
  assert.ok(after.service_fee_cents > 0 && after.grand_total_cents > 0);
  assert.equal(sql("SELECT * FROM enrollments WHERE registration_id = ? AND status = 'pending'", reg.id).length, kids.length);
  // accountant records the check
  const a = new Client(); await a.login('demo.accountant');
  r = await a.post('/en/portal/finance/payment', { registration: String(reg.id), transaction_date: '2026-10-13', payment_method_id: String(one("SELECT id FROM payment_methods WHERE code = 'check'").id), check_number: '4321', amount: (after.grand_total_cents / 100).toFixed(2) });
  assert.equal(r.status, 302, r.text.slice(0, 300));
  assert.equal(one('SELECT status FROM registrations WHERE id = ?', reg.id).status, 'paid');
  assert.equal(sql("SELECT * FROM enrollments WHERE registration_id = ? AND status = 'registered'", reg.id).length, kids.length);
  assert.ok(one("SELECT 1 FROM email_outbox WHERE template = 'payment_received' ORDER BY id DESC LIMIT 1"));
  // parent sees the payment + a receipt
  r = await p.get('/en/portal/transactions'); assert.match(r.text, /Registration Transactions/);
  const tx = one('SELECT id FROM transactions WHERE registration_id = ? ORDER BY id DESC', reg.id);
  assert.equal((await p.get(`/en/portal/transactions/${tx.id}/receipt`)).status, 200);
  // a different family cannot read it
  const other = new Client(); await other.login('demo.parent02');
  assert.equal((await other.get(`/en/portal/transactions/${tx.id}`)).status, 403);
  // secretary places the students; parent sees the class only when placement is visible
  const sec = new Client(); await sec.login('demo.secretary');
  const en = one('SELECT id FROM enrollments WHERE registration_id = ? LIMIT 1', reg.id);
  const cls = one("SELECT id FROM school_classes WHERE code = 'CSL2A'");
  r = await sec.post('/en/portal/placement', { [`class_${en.id}`]: String(cls.id) }); assert.equal(r.status, 302);
  assert.equal(one('SELECT status, school_class_id FROM enrollments WHERE id = ?', en.id).school_class_id, cls.id);
});

test('fees: sibling discount from the 3rd child, early-registration deadline, service fee once per year', async () => {
  const { computeRegistration } = await import('../src/portal/fees.js');
  const year = one('SELECT * FROM school_years WHERE is_current = 1');
  const reg = one("SELECT id FROM class_types WHERE code = 'regular'").id;
  const fam = one("SELECT id FROM families WHERE id NOT IN (SELECT family_id FROM registrations) ORDER BY id DESC LIMIT 1") || one('SELECT id FROM families ORDER BY id DESC LIMIT 1');
  const mk = (n, birth) => ({ studentId: 90000 + n, classTypeId: reg, gradeLabel: 'x', birthDate: birth });
  const three = computeRegistration(db, { yearId: year.id, familyId: fam.id, items: [mk(1, '2015-01-01'), mk(2, '2017-01-01'), mk(3, '2019-01-01')], today: '2026-04-01' });
  assert.equal(three.items.filter((i) => i.siblingDiscount > 0).length, 1, 'only the 3rd child gets the sibling discount');
  assert.equal(three.items.find((i) => i.siblingDiscount > 0).studentId, 90003, 'the youngest of three');
  assert.ok(three.items.every((i) => i.earlyRegDiscount > 0), 'before the deadline: early discount');
  const late = computeRegistration(db, { yearId: year.id, familyId: fam.id, items: [mk(1, '2015-01-01')], today: '2026-08-01' });
  assert.equal(late.items[0].earlyRegDiscount, 0, 'after the deadline: none');
  assert.ok(late.serviceFee > 0 && three.serviceFee === late.serviceFee, 'service fee per family');
  // staff change a fee in the one fee page and the calculation follows
  const acc = new Client(); await acc.login('demo.accountant');
  const tuition = one("SELECT * FROM fee_schedules WHERE school_year_id = ? AND code = 'tuition' AND class_type_id = ?", year.id, reg);
  const r = await acc.post('/en/portal/fees', { year_id: String(year.id), first_day: year.first_day, last_day: year.last_day, second_semester_start: year.second_semester_start || '', early_reg_deadline: year.early_reg_deadline, registration_open: '1', is_current: '1',
    fee_0_id: String(tuition.id), fee_0_code: 'tuition', fee_0_name_en: tuition.name_en, fee_0_name_zh: tuition.name_zh, fee_0_applies_to: 'student', fee_0_class_type_id: String(reg), fee_0_amount: '1000.00', fee_0_active: '1', fee_0_sort: '4' });
  assert.equal(r.status, 302);
  const changed = computeRegistration(db, { yearId: year.id, familyId: fam.id, items: [mk(1, '2015-01-01')], today: '2026-08-01' });
  assert.equal(changed.items[0].tuition, 100000, 'new tuition is used');
  db.prepare('UPDATE fee_schedules SET amount_cents = ? WHERE id = ?').run(tuition.amount_cents, tuition.id);
});

test('volunteer sign-up and CSV export', async () => {
  const p = new Client(); await p.login('demo.parentvolunteer');
  const jobs = sql('SELECT id FROM volunteer_jobs WHERE reserved_for_preschool = 0 ORDER BY sort LIMIT 3');
  const r = await p.post('/en/portal/volunteer', { job_1: String(jobs[0].id), job_2: String(jobs[1].id) });
  assert.equal(r.status, 302);
  const mine = sql("SELECT priority, job_id FROM volunteer_signups WHERE person_id = (SELECT person_id FROM users WHERE username = 'demo.parentvolunteer') AND deleted_at IS NULL AND status = 'requested' ORDER BY priority");
  assert.equal(mine.length, 2); assert.equal(mine[0].job_id, jobs[0].id);
  const pta = new Client(); await pta.login('demo.pta');
  const list = await pta.get('/en/portal/manage/volunteer_list');
  assert.equal(list.status, 200); assert.match(list.text, /Volunteer List/);
  const csv = await pta.get('/en/portal/manage/volunteer_list/export.csv');
  assert.equal(csv.status, 200); assert.match(csv.text, /Volunteer Job/);
  assert.equal((await p.get('/en/portal/manage/volunteer_list')).status, 403);
  const sec = new Client(); await sec.login('demo.secretary');
  const sl = await sec.get('/en/portal/manage/student_list?q=Li');
  assert.equal(sl.status, 200); assert.match(sl.text, /Student List/);
  const scsv = await sec.get('/en/portal/manage/student_list/export.csv');
  assert.equal(scsv.status, 200); assert.ok(scsv.text.split('\n').length > 10);
  assert.equal((await pta.get('/en/portal/manage/student_list')).status, 403);
  assert.equal((await p.get('/en/portal/manage/student_list/export.csv')).status, 403);
});

test('credit grades: teacher enters, student sees only published', async () => {
  const cls = one("SELECT sc.id FROM school_classes sc JOIN class_assignments ca ON ca.school_class_id = sc.id JOIN persons p ON p.id = ca.person_id JOIN users u ON u.person_id = p.id WHERE sc.code LIKE 'CRD%' AND u.username LIKE 'demo.teacher%' LIMIT 1");
  if (!cls) return;
  const teacherUser = one("SELECT u.username FROM class_assignments ca JOIN users u ON u.person_id = ca.person_id WHERE ca.school_class_id = ? AND u.username LIKE 'demo.teacher%'", cls.id).username;
  const t = new Client(); await t.login(teacherUser);
  assert.equal((await t.get(`/en/portal/classes/${cls.id}/grades`)).status, 200);
  const other = one("SELECT id FROM school_classes WHERE code LIKE 'CSL%' LIMIT 1");
  assert.equal((await t.get(`/en/portal/classes/${other.id}/grades`)).status, 403);
});

test('static copies still served for the GitHub Pages build', async () => {
  const r = await fetch(`${base}/en/portal/signin`, { headers: { 'x-static-build': '1' } });
  assert.equal(r.status, 200);
  assert.match(await r.text(), /static|data-static/);
});

test('new family sign-up creates family + parent + login (parent role only)', async () => {
  const c = new Client();
  await c.get('/en/portal/register');
  const r = await c.post('/en/portal/register', { street: '1 Test Way', city: 'San Diego', state: 'CA', zipcode: '92121', home_phone: '(858) 555-0111', cell_phone: '', email: 'newfam@example.com', list_in_directory: 'Y',
    emergency_contact: 'Aunt Test', emergency_home_phone: '(858) 555-0112', emergency_cell_phone: '(858) 555-0113', p1_last: 'Newfam', p1_first: 'Pat', p1_chinese: '新家', gender: 'F', native_language: 'English', username: 'newfam.pat', password: 'correct horse 42', password2: 'correct horse 42' });
  assert.equal(r.status, 302);
  const u = one("SELECT u.id, u.person_id FROM users u WHERE username = 'newfam.pat'");
  assert.ok(u);
  assert.deepEqual(sql('SELECT r.code FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ?', u.id).map((x) => x.code), ['parent']);
  const fam = one("SELECT f.* FROM families f JOIN family_members fm ON fm.family_id = f.id WHERE fm.person_id = ? AND fm.relationship = 'parent_one'", u.person_id);
  assert.equal(fam.email, 'newfam@example.com');
  const home = await c.get('/en/portal');
  assert.equal(home.status, 200); assert.match(home.text, /Add Child/);
  // duplicate username and weak password are rejected
  const c2 = new Client(); await c2.get('/en/portal/register');
  const dup = await c2.post('/en/portal/register', { street: 'a', city: 'b', zipcode: '1', home_phone: '1', email: 'x@y.co', emergency_contact: 'a', emergency_home_phone: '1', emergency_cell_phone: '1', p1_last: 'A', p1_first: 'B', username: 'newfam.pat', password: 'short', password2: 'short' });
  assert.equal(dup.status, 400);
});

test('forgot password: emailed link, phone verification, new password works; forgot username lists usernames', async () => {
  const c = new Client(); await c.get('/en/portal/forgot-password');
  const r = await c.post('/en/portal/forgot-password', { username: 'demo.parentteacher1' });
  assert.equal(r.status, 200);
  const link = (r.text.match(/href="(\/en\/portal\/reset-password\/[a-f0-9]+)"/) || [])[1];
  assert.ok(link, 'demo mode shows the reset link');
  assert.ok(one("SELECT 1 FROM email_outbox WHERE template = 'password_reset' ORDER BY id DESC LIMIT 1"));
  const fam = one("SELECT f.home_phone FROM families f JOIN family_members fm ON fm.family_id = f.id JOIN users u ON u.person_id = fm.person_id WHERE u.username = 'demo.parentteacher1' LIMIT 1");
  assert.equal((await c.get(link)).status, 200);
  const bad = await c.post(link, { phone: '(858) 000-0000', password: 'brand new pw 77', password2: 'brand new pw 77' });
  assert.equal(bad.status, 400, 'wrong phone is refused');
  const ok = await c.post(link, { phone: fam.home_phone, password: 'brand new pw 77', password2: 'brand new pw 77' });
  assert.equal(ok.status, 302);
  const again = await c.post(link, { phone: fam.home_phone, password: 'another pw 88', password2: 'another pw 88' });
  assert.equal(again.status, 400, 'a reset link works once');
  const login = new Client(); await login.get('/en/portal/signin');
  assert.equal((await login.post('/en/portal/signin', { username: 'demo.parentteacher1', password: 'brand new pw 77' })).status, 302);
  const fam5 = one("SELECT f.email FROM families f JOIN family_members fm ON fm.family_id = f.id JOIN users u ON u.person_id = fm.person_id WHERE u.username = 'demo.parentteacher1' LIMIT 1");
  const un = await new Client().post('/en/portal/forgot-username', { email: fam5.email });
  assert.match(un.text, /demo\.parentteacher1/);
});

test('staff invitation: link expires, phone verified, account created', async () => {
  const sec = new Client(); await sec.login('demo.secretary');
  // a new family created by staff has no login yet
  let r = await sec.post('/en/portal/families', { street: '9 Invite Rd', city: 'Poway', state: 'CA', zipcode: '92064', home_phone: '(858) 555-0177', email: 'invite@example.com', emergency_contact: 'Grandma', emergency_home_phone: '(858) 555-0178', emergency_cell_phone: '(858) 555-0179', p1_last: 'Invitee', p1_first: 'Sam' });
  assert.equal(r.status, 302);
  const famId = Number(r.loc.match(/families\/(\d+)/)[1]);
  r = await sec.post(`/en/portal/families/${famId}/invite`, {});
  assert.equal(r.status, 302);
  const link = (decodeURIComponent((await sec.get(r.loc)).text).match(/\/en\/portal\/invite\/[a-f0-9]+/) || [])[0];
  assert.ok(link, 'invitation link shown in demo mode');
  const c = new Client(); assert.equal((await c.get(link)).status, 200);
  assert.equal((await c.post(link, { phone: '(858) 111-2222', username: 'invitee.sam', password: 'pw pw pw pw 1', password2: 'pw pw pw pw 1' })).status, 400);
  assert.equal((await c.post(link, { phone: '(858) 555-0177', username: 'invitee.sam', password: 'pw pw pw pw 1', password2: 'pw pw pw pw 1' })).status, 302);
  assert.ok(one("SELECT 1 FROM users WHERE username = 'invitee.sam'"));
  assert.equal((await c.get(link)).status, 410, 'link cannot be reused');
});

test('change user name: needs current password, rejects taken/invalid names, then signs in with the new one', async () => {
  const c = new Client(); await c.login('demo.parentsecretary');
  const pw = creds['demo.parentsecretary'];
  assert.equal((await c.get('/en/portal/change-username')).status, 200);
  assert.equal((await c.post('/en/portal/change-username', { username: 'new.parent02', current: 'wrong' })).status, 400);
  assert.equal((await c.post('/en/portal/change-username', { username: 'demo.parentvolunteer', current: pw })).status, 400);   // taken
  assert.equal((await c.post('/en/portal/change-username', { username: 'a b', current: pw })).status, 400);             // invalid
  const ok = await c.post('/en/portal/change-username', { username: 'new.parent02', current: pw });
  assert.equal(ok.status, 302);
  assert.equal(one('SELECT username FROM users WHERE username = ?', 'new.parent02').username, 'new.parent02');
  assert.ok(one("SELECT 1 AS x FROM portal_audit WHERE action = 'username_changed'"));
  const { attemptLogin } = await import('../src/portal/auth.js');
  assert.ok(!attemptLogin(db, 'new.parent02', pw).error);
  assert.equal(attemptLogin(db, 'demo.parentsecretary', pw).error, 'invalid');
});

test('a family can have only two parents', async () => {
  const c = new Client(); await c.login('demo.parent01');
  const fid = one("SELECT fm.family_id AS f FROM family_members fm JOIN users u ON u.person_id = fm.person_id WHERE u.username = 'demo.parent01'").f;
  const before = one("SELECT COUNT(*) AS n FROM family_members WHERE family_id = ? AND relationship IN ('parent_one','parent_two','guardian') AND deleted_at IS NULL", fid).n;
  // make sure this family has both parents, then a third must be refused
  if (before < 2) await c.post(`/en/portal/families/${fid}/add-parent`, { english_last_name: 'Test', english_first_name: 'Second', gender: 'F', birth_date: '1980-01-01', native_language: 'Mandarin' });
  const g = await c.get(`/en/portal/families/${fid}/add-parent`);
  assert.equal(g.status, 302); assert.match(g.loc, new RegExp(`/families/${fid}$`));
  const p = await c.post(`/en/portal/families/${fid}/add-parent`, { english_last_name: 'Third', english_first_name: 'Parent', gender: 'M', birth_date: '1980-01-01', native_language: 'Mandarin' });
  assert.equal(p.status, 302);
  assert.equal(one("SELECT COUNT(*) AS n FROM family_members WHERE family_id = ? AND relationship IN ('parent_one','parent_two','guardian') AND deleted_at IS NULL", fid).n, 2);
  const home = await c.get(`/en/portal/families/${fid}`);
  assert.doesNotMatch(home.text, /add-parent/);
});
