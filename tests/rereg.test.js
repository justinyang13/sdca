// tests/rereg.test.js — re-registration: next year's registration pre-filled from last year (students, class type, next grade,
// volunteer choices, regular-school information), only while that year is open, only for the family's own parents.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createFamily, createPerson, addFamilyMember, createUser } from '../src/portal/creators.js';
import { makeClient } from './support/client.js';
import { bootPortalApp } from './support/portalApp.js';

let app, base, db, creds;

before(async () => { app = await bootPortalApp('rereg'); ({ base, db, creds } = app); });
after(() => app.close());

const Client = makeClient({ base: () => base, creds: () => creds });
const sql = (q, ...a) => db.prepare(q).all(...a);
const one = (q, ...a) => db.prepare(q).get(...a);
const run = (q, ...a) => db.prepare(q).run(...a);
const yr = (label) => one('SELECT * FROM school_years WHERE label = ?', label);
const ct = (code) => one('SELECT id FROM class_types WHERE code = ?', code).id;
const openNext = (open = 1) => run('UPDATE school_years SET registration_open = ? WHERE label = ?', open, '2027-2028');

// a family with one child enrolled last (current) year in a chosen grade / class type — everything else is neutral
let seq = 0;
function family({ grade = '三年級(3rd Grade)', type = 'regular', birth = '2018-03-03', status = 'placed' } = {}) {
  seq += 1;
  const fam = createFamily(db, { street: '2 Test Ave', city: 'San Diego', zipcode: '92101', home_phone: '(858) 555-7000', email: `rr${seq}@example.com`, emergency_contact: 'Em', emergency_home_phone: '(858) 555-7001', emergency_cell_phone: '(858) 555-7002' });
  const parent = createPerson(db, { english_last_name: `Rr${seq}`, english_first_name: 'Pat', gender: 'F', birth_date: '1980-01-01' });
  addFamilyMember(db, fam, parent, 'parent_one');
  const kid = createPerson(db, { english_last_name: `Rr${seq}`, english_first_name: 'Kid', chinese_name: '小', gender: 'M', birth_date: birth });
  addFamilyMember(db, fam, kid, 'child');
  const username = `rr.parent${seq}`; creds[username] = `secret-rr${seq}`;
  createUser(db, { personId: parent, username, password: creds[username], roleCodes: ['parent'], type: 'parent' });
  const en = Number(run("INSERT INTO enrollments (student_person_id, school_year_id, class_type_id, grade_label, status) VALUES (?,?,?,?,?)", kid, yr('2026-2027').id, ct(type), grade, status).lastInsertRowid);
  return { fam, parent, kid, username, en };
}

// ------------------------------------------------------------------ the suggestions
test('gradeNumber(): parses the stored grade labels', async () => {
  const { gradeNumber } = await import('../src/portal/rereg.js');
  assert.equal(gradeNumber('三年級(3rd Grade)'), 3); assert.equal(gradeNumber('十二年級(12th Grade)'), 12); assert.equal(gradeNumber('幼稚園(Kindergarten)'), 0);
  assert.equal(gradeNumber('學前 (Preschool)'), null); assert.equal(gradeNumber(''), null); assert.equal(gradeNumber(null), null);
});

test('suggestFor(): same class type, next grade; preschool moves to regular; grade 12 graduates; new and withdrawn students have no history', async () => {
  const { suggestFor } = await import('../src/portal/rereg.js');
  const next = yr('2027-2028');
  const a = family({ grade: '三年級(3rd Grade)', type: 'bilingual' });
  const sa = suggestFor(db, one('SELECT * FROM persons WHERE id = ?', a.kid), next);
  assert.deepEqual([sa.hadPrevious, sa.graduated, sa.grade, sa.classTypeId], [true, false, 4, ct('bilingual')]);
  assert.match(sa.label, /4th Grade/);
  const b = family({ grade: '學前 (Preschool)', type: 'preschool', birth: '2022-06-01' });
  const sb = suggestFor(db, one('SELECT * FROM persons WHERE id = ?', b.kid), next);
  assert.equal(sb.classTypeId, ct('regular'), 'preschool → regular'); assert.equal(sb.grade, 0, 'age-based grade for a preschooler');
  const c = family({ grade: '十二年級(12th Grade)', type: 'credit', birth: '2009-01-01' });
  assert.equal(suggestFor(db, one('SELECT * FROM persons WHERE id = ?', c.kid), next).graduated, true);
  const d = family({ status: 'withdrawn' });
  assert.equal(suggestFor(db, one('SELECT * FROM persons WHERE id = ?', d.kid), next).hadPrevious, false, 'a withdrawn student is not "continuing"');
  const newbie = createPerson(db, { english_last_name: 'New', english_first_name: 'Kid', gender: 'F', birth_date: '2019-02-02' });
  assert.equal(suggestFor(db, one('SELECT * FROM persons WHERE id = ?', newbie), next).hadPrevious, false);
  assert.equal(suggestFor(db, one('SELECT * FROM persons WHERE id = ?', a.kid), yr('2026-2027')).hadPrevious, false, 'nothing earlier than the current year here');
});

test('previousVolunteerJobs(): the latest earlier year, up to three active jobs in priority order', async () => {
  const { previousVolunteerJobs } = await import('../src/portal/rereg.js');
  const f = family(); const [j1, j2, j3, j4] = sql('SELECT id FROM volunteer_jobs WHERE active = 1 ORDER BY id LIMIT 4').map((j) => j.id);
  const ins = (year, job, pr) => run('INSERT INTO volunteer_signups (family_id, person_id, school_year_id, job_id, priority) VALUES (?,?,?,?,?)', f.fam, f.parent, yr(year).id, job, pr);
  ins('2025-2026', j4, 1); ins('2026-2027', j2, 2); ins('2026-2027', j1, 1); ins('2026-2027', j3, 3);
  assert.deepEqual(previousVolunteerJobs(db, f.fam, yr('2027-2028')), [j1, j2, j3], 'last year only, in priority order');
  run('UPDATE volunteer_jobs SET active = 0 WHERE id = ?', j2);
  assert.deepEqual(previousVolunteerJobs(db, f.fam, yr('2027-2028')), [j1, j3], 'inactive jobs are dropped');
  run('UPDATE volunteer_jobs SET active = 1 WHERE id = ?', j2);
  assert.deepEqual(previousVolunteerJobs(db, family().fam, yr('2027-2028')), []);
});

test('copySchoolInfo(): copies last year\'s regular-school info with grade + 1, never overwrites, caps at 12', async () => {
  const { copySchoolInfo } = await import('../src/portal/rereg.js');
  const f = family();
  const info = (kid, y, grade) => run(`INSERT INTO student_school_info (student_person_id, school_year_id, school_name, grade, mailing_address, city, state, zipcode, counselor_name) VALUES (?,?,?,?,?,?,?,?,?)`,
    kid, yr(y).id, 'Pine Elementary', grade, '9 Pine St', 'San Diego', 'CA', '92101', 'Ms Lee');
  info(f.kid, '2026-2027', 3);
  assert.equal(copySchoolInfo(db, [f.kid], yr('2027-2028'), null), 1);
  const copy = one('SELECT * FROM student_school_info WHERE student_person_id = ? AND school_year_id = ?', f.kid, yr('2027-2028').id);
  assert.equal(copy.grade, 4); assert.equal(copy.school_name, 'Pine Elementary'); assert.equal(copy.counselor_name, 'Ms Lee');
  assert.equal(copySchoolInfo(db, [f.kid], yr('2027-2028'), null), 0, 'second run copies nothing');
  const g = family(); info(g.kid, '2026-2027', 12);
  copySchoolInfo(db, [g.kid], yr('2027-2028'), null);
  assert.equal(one('SELECT grade FROM student_school_info WHERE student_person_id = ? AND school_year_id = ?', g.kid, yr('2027-2028').id).grade, 12);
  assert.equal(copySchoolInfo(db, [family().kid], yr('2027-2028'), null), 0, 'nothing to copy');
});

// ------------------------------------------------------------------ the pages
test('re-registration page: closed until staff open the year; then pre-filled and clearly labelled', async () => {
  const f = family({ grade: '三年級(3rd Grade)', type: 'bilingual' });
  const jobs = sql('SELECT id FROM volunteer_jobs WHERE active = 1 ORDER BY id LIMIT 2').map((j) => j.id);
  run('INSERT INTO volunteer_signups (family_id, person_id, school_year_id, job_id, priority) VALUES (?,?,?,?,1)', f.fam, f.parent, yr('2026-2027').id, jobs[0]);
  const p = await new Client().login(f.username);
  openNext(0);
  assert.doesNotMatch((await p.get('/en/portal')).text, /2027-2028 School Year/, 'no button while closed');
  const closed = await p.get(`/en/portal/families/${f.fam}/register?year=${yr('2027-2028').id}`);
  assert.equal(closed.status, 302); assert.equal(closed.loc, '/en/portal', 'not open → back home');
  openNext(1);
  try {
    const home = (await p.get('/en/portal')).text;
    assert.match(home, /Re-register For 2027-2028 School Year/);
    const page = await p.get(`/en/portal/families/${f.fam}/register?year=${yr('2027-2028').id}`);
    assert.equal(page.status, 200);
    assert.match(page.text, /Registration For 2027-2028 School Year/);
    assert.match(page.text, /Re-registration/); assert.match(page.text, /Please review your family information/); assert.match(page.text, /2 Test Ave/);
    assert.match(page.text, /Last year → this year/); assert.match(page.text, /3rd Grade[^<]*→[^<]*<strong>4th Grade/, 'grade 3 → 4');
    assert.match(page.text, new RegExp(`name="student" value="${f.kid}" id="st_${f.kid}" checked`), 'the child is ticked');
    assert.match(page.text, new RegExp(`<option value="${ct('bilingual')}" selected`), 'last year\'s class type is selected');
    assert.match(page.text, new RegExp(`name="year" value="${yr('2027-2028').id}"`));
    assert.match(page.text, new RegExp(`<option value="${jobs[0]}" selected`), 'first volunteer choice carried over');
    assert.match(page.text, /Re-register|2027-2028/);
  } finally { openNext(0); }
});

test('re-registration: submitting creates next year\'s draft with the next grade, copies school info, and leaves this year alone', async () => {
  const f = family({ grade: '五年級(5th Grade)', type: 'regular', birth: '2016-04-04' });
  run(`INSERT INTO student_school_info (student_person_id, school_year_id, school_name, grade, mailing_address, city, state, zipcode, counselor_name) VALUES (?,?,?,?,?,?,?,?,?)`,
    f.kid, yr('2026-2027').id, 'Oak Middle', 5, '1 Oak', 'San Diego', 'CA', '92101', 'Mr Chan');
  const p = await new Client().login(f.username); const y = yr('2027-2028');
  openNext(1);
  try {
    const res = await p.post(`/en/portal/families/${f.fam}/register`, new URLSearchParams({ year: String(y.id), student: String(f.kid), [`birth_${f.kid}`]: '2016-04-04', [`ctype_${f.kid}`]: String(ct('regular')), scrip: '' }));
    assert.equal(res.status, 302, res.text.slice(0, 200));
    const reg = one("SELECT * FROM registrations WHERE family_id = ? AND status = 'draft'", f.fam);
    assert.equal(reg.school_year_id, y.id, 'the draft belongs to next year');
    const item = one('SELECT grade_label FROM registration_items WHERE registration_id = ?', reg.id);
    assert.match(item.grade_label, /6th Grade/, 'next grade');
    const copy = one('SELECT grade, school_name FROM student_school_info WHERE student_person_id = ? AND school_year_id = ?', f.kid, y.id);
    assert.deepEqual([copy.grade, copy.school_name], [6, 'Oak Middle']);
    assert.equal(one('SELECT status FROM enrollments WHERE id = ?', f.en).status, 'placed', 'this year\'s enrollment is untouched');
    assert.equal(sql('SELECT id FROM registrations WHERE family_id = ? AND school_year_id = ?', f.fam, yr('2026-2027').id).length, 0);
    // the fee form prices it from next year's fee table
    await p.post(`/en/portal/registrations/${reg.id}/waiver`, { agree: '1' });
    const form = await p.get(`/en/portal/registrations/${reg.id}/form`);
    assert.match(form.text, /2027-2028/); assert.equal(one('SELECT status FROM registrations WHERE id = ?', reg.id).status, 'submitted');
    assert.ok(one('SELECT grand_total_cents FROM registrations WHERE id = ?', reg.id).grand_total_cents > 0);
  } finally { openNext(0); }
});

test('re-registration: graduates are shown but not pre-ticked; posting for a closed year or someone else\'s family is refused', async () => {
  const g = family({ grade: '十二年級(12th Grade)', type: 'credit', birth: '2009-01-01' });
  const p = await new Client().login(g.username); const y = yr('2027-2028');
  openNext(1);
  try {
    const page = await p.get(`/en/portal/families/${g.fam}/register?year=${y.id}`);
    assert.match(page.text, /Graduated/);
    assert.doesNotMatch(page.text, new RegExp(`value="${g.kid}" id="st_${g.kid}" checked`));
    const other = family();
    assert.equal((await p.get(`/en/portal/families/${other.fam}/register?year=${y.id}`)).status, 403, 'not your family');
    assert.equal((await p.post(`/en/portal/families/${other.fam}/register`, { year: String(y.id), student: String(other.kid) })).status, 403);
  } finally { openNext(0); }
  const res = await p.post(`/en/portal/families/${g.fam}/register`, { year: String(y.id), student: String(g.kid), [`birth_${g.kid}`]: '2009-01-01', [`ctype_${g.kid}`]: String(ct('credit')) });
  assert.equal(res.status, 302); assert.equal(res.loc, '/en/portal', 'closed year → refused');
  assert.equal(sql("SELECT id FROM registrations WHERE family_id = ? AND school_year_id = ?", g.fam, y.id).length, 0);
});

test('a family with no history gets the normal "Register" button and a plain (not re-registration) form', async () => {
  const f = family(); run('DELETE FROM enrollments WHERE id = ?', f.en);
  const p = await new Client().login(f.username);
  const cy = yr('2026-2027');
  run('UPDATE school_years SET registration_open = 1 WHERE id = ?', cy.id);
  const home = (await p.get('/en/portal')).text;
  assert.match(home, /Register For 2026-2027 School Year/); assert.doesNotMatch(home, /Re-register For 2026-2027/);
  const page = (await p.get(`/en/portal/families/${f.fam}/register?year=${cy.id}`)).text;
  assert.doesNotMatch(page, /filled in from last year/);
});
