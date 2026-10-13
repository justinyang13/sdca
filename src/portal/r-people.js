// src/portal/r-people.js — person + family pages (staff and parents), add child / parent, edit, school info, instructor assignment.
import { csrfMiddleware } from '../middleware/csrf.js';
import { ENTITIES } from './entities.js';
import { can, canAll } from './perm.js';
import { currentYear } from './fees.js';
import { fromBody, validate, updateRow, createRow, audit } from './crud.js';
import { ownsFamily, ownsPerson, createInvitation, queueEmail } from './auth.js';
import { DEMO_EMAIL } from './r-auth.js';
import { familyView } from './r-home.js';
import { createPerson, createFamily, addFamilyMember } from './r-auth.js';

const PERSON_MAIN = ['english_last_name', 'english_first_name', 'chinese_name', 'title', 'gender', 'birth_date', 'native_language', 'regular_school', 'regular_grade'];
const PERSON_MEDICAL = ['allergy', 'special_medical_needs'];
const PERSON_BG = ['speak_chinese_home', 'took_chinese_lessons', 'prior_chinese_school', 'prior_chinese_years', 'prior_chinese_hours_week', 'notes'];
const PERSON_STAFF = ['email', 'mobile', 'is_faculty'];
const FAMILY_FIELDS = ['street', 'city', 'state', 'zipcode', 'home_phone', 'cell_phone', 'email', 'list_in_directory', 'emergency_contact', 'emergency_home_phone', 'emergency_cell_phone'];

export function registerPeopleRoutes(app, { db, page, requireLogin }) {
  const R = '/:lang/portal';
  const lang = (req) => req.params.lang;
  const go = (req, res, p, flash) => { if (flash) req.session.portalFlash = flash; res.redirect(`/${lang(req)}/portal${p}`); };
  const forbidden = (req, res) => page(req, res, 'forbidden.ejs', {}, { title: 'Not allowed', status: 403 });
  const staffCan = (req, c) => canAll(req.portal.access, c);
  const mayViewFamily = (req, fid) => staffCan(req, 'families.view') || (can(req.portal.access, 'family.own') && ownsFamily(db, req.portal.person.id, fid));
  const mayEditFamily = (req, fid) => staffCan(req, 'families.update') || (can(req.portal.access, 'family.own') && ownsFamily(db, req.portal.person.id, fid));
  const mayEditPerson = (req, pid) => staffCan(req, 'persons.update') || (can(req.portal.access, 'family.own') && ownsPerson(db, req.portal.person.id, pid));
  const personFamily = (pid) => db.prepare('SELECT family_id FROM family_members WHERE person_id = ? AND deleted_at IS NULL ORDER BY (relationship = \'child\') DESC LIMIT 1').get(pid)?.family_id || null;

  // ---------- family page ----------
  app.get(`${R}/families/:id`, requireLogin, (req, res) => {
    if (req.params.id === 'new') return page(req, res, 'staff-new-family.ejs', { v: { state: 'CA', list_in_directory: 'Y', gender: 'M', native_language: 'Mandarin' }, errors: {} }, { title: 'New Family' });
    const id = Number(req.params.id);
    if (!mayViewFamily(req, id)) return forbidden(req, res);
    const F = familyView(db, id, { staff: staffCan(req, 'families.view') });
    if (!F) return go(req, res, '', { type: 'warn', msg: 'Family not found' });
    const history = db.prepare(`SELECT t.id, t.transaction_date, t.amount_cents, t.voided_at, tt.name_en AS type FROM transactions t JOIN transaction_types tt ON tt.id = t.transaction_type_id WHERE t.family_id = ? AND t.deleted_at IS NULL ORDER BY t.transaction_date DESC LIMIT 10`).all(id);
    page(req, res, 'family.ejs', { F, hasLogin: !!db.prepare("SELECT 1 FROM users u JOIN family_members fm ON fm.person_id = u.person_id WHERE fm.family_id = ? AND fm.relationship <> 'child' AND u.deleted_at IS NULL").get(id), staffView: staffCan(req, 'families.view'), canRegister: can(req.portal.access, 'registration.own') || staffCan(req, 'registrations.update'), history, me: null }, { title: 'Family' });
  });
  // staff: create a family (+ parent one, optional login)
  app.post(`${R}/families`, requireLogin, csrfMiddleware, (req, res) => {
    if (!staffCan(req, 'families.create')) return forbidden(req, res);
    const v = {}; for (const k of Object.keys(req.body)) v[k] = String(req.body[k] ?? '').trim();
    const errors = {};
    for (const k of ['street', 'city', 'zipcode', 'home_phone', 'email', 'emergency_contact', 'emergency_home_phone', 'emergency_cell_phone', 'p1_last', 'p1_first']) if (!v[k]) errors[k] = 'required';
    if (Object.keys(errors).length) return page(req, res, 'staff-new-family.ejs', { v, errors }, { title: 'New Family', status: 400 });
    const uid = req.portal.user.id;
    db.exec('BEGIN');
    try {
      const fid = createFamily(db, v, uid);
      const p1 = createPerson(db, { english_last_name: v.p1_last, english_first_name: v.p1_first, chinese_name: v.p1_chinese, gender: v.gender || 'M', native_language: v.native_language || 'Mandarin', email: v.email }, uid);
      addFamilyMember(db, fid, p1, 'parent_one', uid);
      audit(db, 'families', fid, 'create', null, { by: 'staff' }, uid, req.ip);
      db.exec('COMMIT');
      go(req, res, `/families/${fid}`, { type: 'ok', msg: 'Family created. Add children and a login from here. 已建立家庭。' });
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  });

  // staff: invite a family that has no login yet (72-hour link, phone verification on the page)
  app.post(`${R}/families/:id/invite`, requireLogin, csrfMiddleware, (req, res) => {
    if (!staffCan(req, 'families.update')) return forbidden(req, res);
    const id = Number(req.params.id);
    const fam = db.prepare('SELECT * FROM families WHERE id = ? AND deleted_at IS NULL').get(id);
    if (!fam) return go(req, res, '/manage/families');
    const raw = createInvitation(db, id, fam.email);
    const link = `/${lang(req)}/portal/invite/${raw}`;
    queueEmail(db, { to: fam.email, template: 'invitation', subject: 'San Diego Chinese Academy - Registration Invitation 註冊邀請', body: `Create your account within 72 hours 請於七十二小時內建立帳戶: ${link}`, relatedType: 'families', relatedId: id });
    audit(db, 'invitations', id, 'create', null, { to: fam.email }, req.portal.user.id, req.ip);
    go(req, res, `/families/${id}`, { type: 'ok', msg: `Invitation emailed to ${fam.email}. 已寄出邀請。${DEMO_EMAIL ? ' (Demo mode, link: ' + link + ')' : ''}` });
  });

  // edit address / emergency
  app.get(`${R}/families/:id/edit`, requireLogin, (req, res) => {
    const id = Number(req.params.id);
    if (!mayEditFamily(req, id)) return forbidden(req, res);
    const row = db.prepare('SELECT f.*, a.street, a.city, a.state, a.zipcode FROM families f LEFT JOIN addresses a ON a.id = f.address_id WHERE f.id = ?').get(id);
    page(req, res, 'family-form.ejs', { values: row, errors: {}, id }, { title: 'Edit Family Address' });
  });
  app.post(`${R}/families/:id/edit`, requireLogin, csrfMiddleware, (req, res) => {
    const id = Number(req.params.id);
    if (!mayEditFamily(req, id)) return forbidden(req, res);
    const ent = ENTITIES.families;
    const data = fromBody(ent, req.body, FAMILY_FIELDS);
    const errors = validate({ ...ent, fields: ent.fields.filter((f) => FAMILY_FIELDS.includes(f.name)) }, data);
    if (Object.keys(errors).length) return page(req, res, 'family-form.ejs', { values: { ...req.body, id }, errors, id }, { title: 'Edit Family Address', status: 400 });
    updateRow(db, ent, id, data, req.portal.user.id, req.ip);
    go(req, res, `/families/${id}`, { type: 'ok', msg: 'Family saved. 已儲存。' });
  });

  // add child / parent
  const personFormPage = (req, res, { values, errors = {}, action, title, isNew }) => page(req, res, 'person-form.ejs', {
    values, errors, action, isNew, staffFields: staffCan(req, 'persons.update'), cancelUrl: req.get('referer') || `/${lang(req)}/portal`,
  }, { title, status: Object.keys(errors).length ? 400 : 200 });
  app.get(`${R}/families/:id/add-child`, requireLogin, (req, res) => {
    const id = Number(req.params.id);
    if (!mayEditFamily(req, id)) return forbidden(req, res);
    personFormPage(req, res, { values: { gender: 'M', native_language: 'Mandarin', speak_chinese_home: 'N', took_chinese_lessons: 'N' }, action: `/families/${id}/add-child`, title: 'Add Child To Family', isNew: true });
  });
  app.post(`${R}/families/:id/add-child`, requireLogin, csrfMiddleware, (req, res) => {
    const id = Number(req.params.id);
    if (!mayEditFamily(req, id)) return forbidden(req, res);
    const ent = ENTITIES.persons;
    const fields = [...PERSON_MAIN, ...PERSON_MEDICAL, ...PERSON_BG];
    const data = fromBody(ent, req.body, fields);
    const errors = validate({ ...ent, fields: ent.fields.filter((f) => fields.includes(f.name)) }, data);
    if (Object.keys(errors).length) return personFormPage(req, res, { values: data, errors, action: `/families/${id}/add-child`, title: 'Add Child To Family', isNew: true });
    db.exec('BEGIN');
    try {
      const pid = createPerson(db, data, req.portal.user.id);
      addFamilyMember(db, id, pid, 'child', req.portal.user.id, 10);
      audit(db, 'persons', pid, 'add_child', null, { family: id }, req.portal.user.id, req.ip);
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    go(req, res, `/families/${id}`, { type: 'ok', msg: 'Child added. 已加入學生。' });
  });
  app.get(`${R}/families/:id/add-parent`, requireLogin, (req, res) => {
    const id = Number(req.params.id);
    if (!mayEditFamily(req, id)) return forbidden(req, res);
    personFormPage(req, res, { values: { gender: 'F', native_language: 'Mandarin' }, action: `/families/${id}/add-parent`, title: 'Add Parent', isNew: true });
  });
  app.post(`${R}/families/:id/add-parent`, requireLogin, csrfMiddleware, (req, res) => {
    const id = Number(req.params.id);
    if (!mayEditFamily(req, id)) return forbidden(req, res);
    const ent = ENTITIES.persons;
    const fields = [...PERSON_MAIN];
    const data = fromBody(ent, req.body, fields);
    const errors = validate({ ...ent, fields: ent.fields.filter((f) => fields.includes(f.name)) }, data);
    if (Object.keys(errors).length) return personFormPage(req, res, { values: data, errors, action: `/families/${id}/add-parent`, title: 'Add Parent', isNew: true });
    const hasTwo = db.prepare("SELECT 1 FROM family_members WHERE family_id = ? AND relationship = 'parent_two' AND deleted_at IS NULL").get(id);
    const pid = createPerson(db, data, req.portal.user.id);
    addFamilyMember(db, id, pid, hasTwo ? 'guardian' : 'parent_two', req.portal.user.id, 2);
    go(req, res, `/families/${id}`, { type: 'ok', msg: 'Parent added. 已加入家長。' });
  });

  // ---------- person: view (staff) + edit ----------
  app.get(`${R}/people/:id`, requireLogin, (req, res) => {
    const id = Number(req.params.id);
    const person = db.prepare('SELECT p.*, a.street AS p_street, a.city AS p_city, a.state AS p_state, a.zipcode AS p_zip FROM persons p LEFT JOIN addresses a ON a.id = p.personal_address_id WHERE p.id = ? AND p.deleted_at IS NULL').get(id);
    if (!person) return go(req, res, '', { type: 'warn', msg: 'Person not found' });
    const staff = staffCan(req, 'persons.view');
    if (!staff && !ownsPerson(db, req.portal.person.id, id)) return forbidden(req, res);
    if (!staff) { const fid = personFamily(id); return go(req, res, fid ? `/families/${fid}` : ''); }
    const year = currentYear(db);
    const fid = personFamily(id);
    const F = fid ? familyView(db, fid, { staff: true }) : null;
    const assignments = db.prepare(`SELECT ca.id, ca.start_date, ca.end_date, y.label AS year, sc.id AS class_id, sc.code, sc.name_zh, sc.name_en, ar.name_en AS role_en, ar.name_zh AS role_zh FROM class_assignments ca
      JOIN school_years y ON y.id = ca.school_year_id JOIN school_classes sc ON sc.id = ca.school_class_id JOIN assignment_roles ar ON ar.id = ca.assignment_role_id WHERE ca.person_id = ? AND ca.deleted_at IS NULL ORDER BY y.label DESC, sc.code`).all(id);
    const enrollments = db.prepare(`SELECT e.*, y.label AS year, sc.code, sc.name_zh, sc.name_en, ct.name_en AS ct_en, ct.name_zh AS ct_zh FROM enrollments e JOIN school_years y ON y.id = e.school_year_id
      LEFT JOIN school_classes sc ON sc.id = e.school_class_id LEFT JOIN class_types ct ON ct.id = e.class_type_id WHERE e.student_person_id = ? AND e.deleted_at IS NULL ORDER BY y.label DESC`).all(id);
    const tx = fid ? db.prepare(`SELECT t.id, t.transaction_date, t.amount_cents, t.voided_at, tt.name_en AS type FROM transactions t JOIN transaction_types tt ON tt.id = t.transaction_type_id WHERE t.family_id = ? AND (t.person_id = ? OR t.person_id IS NULL) AND t.deleted_at IS NULL ORDER BY t.transaction_date DESC LIMIT 10`).all(fid, id) : [];
    const user = db.prepare('SELECT id, username, status FROM users WHERE person_id = ? AND deleted_at IS NULL').get(id);
    page(req, res, 'person.ejs', { person, year, F, fid, assignments, enrollments, tx, user, canUpdate: staffCan(req, 'persons.update'), canAssign: staffCan(req, 'assignments.create'), canPay: can(req.portal.access, 'finance.record_payment') }, { title: `${person.english_first_name} ${person.english_last_name}` });
  });
  app.get(`${R}/people/:id/edit`, requireLogin, (req, res) => {
    const id = Number(req.params.id);
    if (!mayEditPerson(req, id)) return forbidden(req, res);
    const row = db.prepare('SELECT * FROM persons WHERE id = ? AND deleted_at IS NULL').get(id);
    if (!row) return go(req, res, '', { type: 'warn', msg: 'Not found' });
    personFormPage(req, res, { values: row, action: `/people/${id}/edit`, title: 'Edit Person', isNew: false });
  });
  app.post(`${R}/people/:id/edit`, requireLogin, csrfMiddleware, (req, res) => {
    const id = Number(req.params.id);
    if (!mayEditPerson(req, id)) return forbidden(req, res);
    const ent = ENTITIES.persons;
    const fields = [...PERSON_MAIN, ...PERSON_MEDICAL, ...PERSON_BG, ...(staffCan(req, 'persons.update') ? PERSON_STAFF : [])];
    const data = fromBody(ent, req.body, fields);
    const errors = validate({ ...ent, fields: ent.fields.filter((f) => fields.includes(f.name)) }, data);
    if (Object.keys(errors).length) return personFormPage(req, res, { values: { ...data, id }, errors, action: `/people/${id}/edit`, title: 'Edit Person', isNew: false });
    updateRow(db, ent, id, data, req.portal.user.id, req.ip);
    const fid = personFamily(id);
    go(req, res, staffCan(req, 'persons.view') ? `/people/${id}` : (fid ? `/families/${fid}` : ''), { type: 'ok', msg: 'Saved. 已儲存。' });
  });

  // ---------- credit-class middle / high school info ----------
  const schoolForm = (req, res, id, values, errors = {}, status = 200) => {
    const person = db.prepare('SELECT * FROM persons WHERE id = ?').get(id);
    page(req, res, 'school-info-form.ejs', { person, values, errors, districts: db.prepare('SELECT id, name FROM school_districts WHERE deleted_at IS NULL ORDER BY name').all() }, { title: 'Middle / High School Info', status });
  };
  app.get(`${R}/people/:id/school-info`, requireLogin, (req, res) => {
    const id = Number(req.params.id);
    if (!mayEditPerson(req, id)) return forbidden(req, res);
    const year = currentYear(db);
    const row = db.prepare('SELECT * FROM student_school_info WHERE student_person_id = ? AND school_year_id = ? AND deleted_at IS NULL').get(id, year.id) || { state: 'CA' };
    schoolForm(req, res, id, row);
  });
  app.post(`${R}/people/:id/school-info`, requireLogin, csrfMiddleware, (req, res) => {
    const id = Number(req.params.id);
    if (!mayEditPerson(req, id)) return forbidden(req, res);
    const year = currentYear(db);
    const ent = ENTITIES.student_school_info;
    const only = ['school_name', 'grade', 'mailing_address', 'city', 'state', 'zipcode', 'counselor_name', 'counselor_phone', 'counselor_extension', 'school_district_id', 'other_school_district', 'notes'];
    const data = fromBody(ent, req.body, only);
    const errors = validate({ ...ent, fields: ent.fields.filter((f) => only.includes(f.name)) }, data);
    if (!data.school_district_id && !data.other_school_district) errors.school_district_id = 'required';
    if (Object.keys(errors).length) return schoolForm(req, res, id, { ...data }, errors, 400);
    const ex = db.prepare('SELECT id FROM student_school_info WHERE student_person_id = ? AND school_year_id = ? AND deleted_at IS NULL').get(id, year.id);
    if (ex) updateRow(db, ent, ex.id, data, req.portal.user.id, req.ip);
    else createRow(db, ent, { ...data, student_person_id: id, school_year_id: year.id }, req.portal.user.id, req.ip);
    const fid = personFamily(id);
    go(req, res, staffCan(req, 'persons.view') ? `/people/${id}` : (fid ? `/families/${fid}` : ''), { type: 'ok', msg: 'School information saved. 學校資料已儲存。' });
  });

  // ---------- add instructor assignment (staff) ----------
  const assignForm = (req, res, id, values, errors = {}, status = 200) => {
    const person = db.prepare('SELECT * FROM persons WHERE id = ?').get(id);
    page(req, res, 'assign-form.ejs', {
      person, values, errors,
      years: db.prepare('SELECT id, label FROM school_years WHERE deleted_at IS NULL ORDER BY label DESC').all(),
      classes: db.prepare('SELECT id, code, name_zh, name_en, school_year_id FROM school_classes WHERE deleted_at IS NULL ORDER BY code').all(),
      roles: db.prepare('SELECT id, name_en, name_zh FROM assignment_roles WHERE deleted_at IS NULL ORDER BY id').all(),
    }, { title: 'Add Instructor Assignment', status });
  };
  app.get(`${R}/people/:id/assign`, requireLogin, (req, res) => {
    if (!staffCan(req, 'assignments.create')) return forbidden(req, res);
    const year = currentYear(db); const today = new Date().toISOString().slice(0, 10);
    assignForm(req, res, Number(req.params.id), { school_year_id: year?.id, start_date: year?.first_day || today, end_date: year?.last_day || today });
  });
  app.post(`${R}/people/:id/assign`, requireLogin, csrfMiddleware, (req, res) => {
    if (!staffCan(req, 'assignments.create')) return forbidden(req, res);
    const id = Number(req.params.id);
    const ent = ENTITIES.class_assignments;
    const data = fromBody(ent, req.body, ['school_year_id', 'school_class_id', 'assignment_role_id', 'start_date', 'end_date']);
    const errors = {};
    for (const k of ['school_year_id', 'school_class_id', 'assignment_role_id']) if (!data[k]) errors[k] = 'required';
    if (Object.keys(errors).length) return assignForm(req, res, id, data, errors, 400);
    createRow(db, ent, { ...data, person_id: id }, req.portal.user.id, req.ip);
    go(req, res, `/people/${id}`, { type: 'ok', msg: 'Assignment added. 已指派。' });
  });
  app.post(`${R}/people/:id/assign/:aid/delete`, requireLogin, csrfMiddleware, (req, res) => {
    if (!staffCan(req, 'assignments.delete')) return forbidden(req, res);
    db.prepare("UPDATE class_assignments SET deleted_at = datetime('now'), updated_by = ? WHERE id = ? AND person_id = ?").run(req.portal.user.id, Number(req.params.aid), Number(req.params.id));
    audit(db, 'class_assignments', Number(req.params.aid), 'delete', null, null, req.portal.user.id, req.ip);
    go(req, res, `/people/${req.params.id}`, { type: 'ok', msg: 'Assignment removed. 已移除。' });
  });
}
