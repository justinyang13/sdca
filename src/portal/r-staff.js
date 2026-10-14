// src/portal/r-staff.js — reports & exports, class placement, and the one-place fee configuration page.
import { csrfMiddleware } from '../middleware/csrf.js';
import { can } from './perm.js';
import { currentYear } from './fees.js';
import { csvEscape, audit, createRow, updateRow, softDelete } from './crud.js';
import { ENTITIES } from './entities.js';
import { s, dollars, num, portalHelpers } from './util.js';


export function registerStaffRoutes(app, { db, page, requireLogin }) {
  const { go, forbidden, staffCan } = portalHelpers(page);
  const R = '/:lang/portal';
  const csv = (res, name, header, rows) => {
    const lines = [header.map(csvEscape).join(',')].concat(rows.map((r) => r.map(csvEscape).join(',')));
    res.type('text/csv; charset=utf-8').set('Content-Disposition', `attachment; filename="${name}"`).send('﻿' + lines.join('\r\n'));
  };

  // ---------- reports (links to the list pages) ----------
  app.get(`${R}/reports`, requireLogin, (req, res) => {
    const a = req.portal.access;
    if (!can(a, 'student_list.list') && !can(a, 'volunteer_list.list') && !can(a, 'transactions.list')) return forbidden(req, res);
    page(req, res, 'reports.ejs', { year: currentYear(db) }, { title: 'Reports' });
  });

  // ---------- class roster: classes with teachers, room parents, and the assignments (add / change / remove) ----------
  const ROLE_TEACH = ['primary_instructor', 'assistant_instructor', 'teaching_assistant', 'substitute'];
  const rosterData = (req) => {
    const years = db.prepare('SELECT * FROM school_years WHERE deleted_at IS NULL ORDER BY label DESC').all();
    const year = years.find((y) => y.id === Number(req.query.year)) || currentYear(db);
    const q = String(req.query.q || '').trim();
    const type = Number(req.query.type) || null; const status = String(req.query.status || '');
    const SORTS = { code: 'sc.code', year: 'y.label', name: 'sc.name_en', room: 'rm.code', teacher: 'teacher', room_parent: 'room_parents', n: 'n', type: 'ct.sort' };
    const sort = SORTS[req.query.sort] ? req.query.sort : 'code';
    const dir = req.query.dir === 'desc' ? 'DESC' : 'ASC';
    const nameOf = (role) => `(SELECT group_concat(p.english_first_name || ' ' || p.english_last_name, ', ') FROM class_assignments ca JOIN assignment_roles ar ON ar.id = ca.assignment_role_id JOIN persons p ON p.id = ca.person_id
      WHERE ca.school_class_id = sc.id AND ca.deleted_at IS NULL AND ${role})`;
    const where = ['sc.school_year_id = ?', 'sc.deleted_at IS NULL']; const args = [year.id];
    if (type) { where.push('sc.class_type_id = ?'); args.push(type); }
    if (status) { where.push('sc.status = ?'); args.push(status); }
    if (q) { where.push(`(sc.code LIKE ? OR sc.name_en LIKE ? OR sc.name_zh LIKE ? OR EXISTS (SELECT 1 FROM class_assignments ca JOIN persons p ON p.id = ca.person_id WHERE ca.school_class_id = sc.id AND ca.deleted_at IS NULL AND (p.english_first_name || ' ' || p.english_last_name || p.chinese_name) LIKE ?))`); args.push(...Array(4).fill(`%${q}%`)); }
    const classes = db.prepare(`SELECT sc.*, y.label AS year_label, ct.name_en AS ct_en, ct.name_zh AS ct_zh, cl.name_en AS level_en, cl.name_zh AS level_zh, rm.code AS room, tb.title_en AS book_en, tb.title_zh AS book_zh,
        (SELECT COUNT(*) FROM enrollments e WHERE e.school_class_id = sc.id AND e.status IN ('registered','placed') AND e.deleted_at IS NULL) AS n,
        ${nameOf(`ar.code = 'primary_instructor'`)} AS teacher, ${nameOf(`ar.code = 'room_parent'`)} AS room_parents
      FROM school_classes sc JOIN school_years y ON y.id = sc.school_year_id LEFT JOIN class_types ct ON ct.id = sc.class_type_id LEFT JOIN class_levels cl ON cl.id = sc.class_level_id
      LEFT JOIN rooms rm ON rm.id = sc.room_id LEFT JOIN textbooks tb ON tb.id = sc.textbook_id WHERE ${where.join(' AND ')} ORDER BY ${SORTS[sort]} COLLATE NOCASE ${dir}, sc.code`).all(...args);
    const ids = classes.map((c) => c.id);
    const byClass = {}; const studentsBy = {};
    if (ids.length) {
      const ph = ids.map(() => '?').join(',');
      for (const a of db.prepare(`SELECT ca.id, ca.school_class_id, ca.person_id, ca.assignment_role_id, ca.start_date, ca.end_date, ar.code AS role_code, ar.name_en AS role_en, ar.name_zh AS role_zh,
          p.english_first_name, p.english_last_name, p.chinese_name FROM class_assignments ca JOIN assignment_roles ar ON ar.id = ca.assignment_role_id JOIN persons p ON p.id = ca.person_id
        WHERE ca.school_class_id IN (${ph}) AND ca.deleted_at IS NULL ORDER BY ar.id, p.english_last_name`).all(...ids)) (byClass[a.school_class_id] ||= []).push(a);
      for (const st of db.prepare(`SELECT e.school_class_id, p.id, p.english_first_name, p.english_last_name, p.chinese_name, e.grade_label FROM enrollments e JOIN persons p ON p.id = e.student_person_id
        WHERE e.school_class_id IN (${ph}) AND e.status IN ('registered','placed') AND e.deleted_at IS NULL ORDER BY p.english_last_name, p.english_first_name`).all(...ids)) (studentsBy[st.school_class_id] ||= []).push(st);
    }
    return { years, year, classes, byClass, studentsBy, q, type, status, sort, dir, open: Number(req.query.open) || null,
      types: db.prepare('SELECT id, name_en, name_zh FROM class_types WHERE deleted_at IS NULL ORDER BY sort').all(),
      roles: db.prepare('SELECT id, code, name_en, name_zh FROM assignment_roles WHERE deleted_at IS NULL ORDER BY id').all() };
  };
  app.get(`${R}/class-roster`, requireLogin, (req, res) => {
    if (!can(req.portal.access, 'reports.class_roster')) return forbidden(req, res);
    const d = rosterData(req);
    if (req.query.format === 'csv') {
      const lines = [['School year', 'Class', 'Name (EN)', 'Name (中文)', 'Class type', 'Level', 'Room', 'Status', 'Capacity', 'Students', 'Teacher', 'Room parent', 'Textbook']];
      d.classes.forEach((c) => lines.push([c.year_label, c.code, c.name_en, c.name_zh, c.ct_en, c.level_en || '', c.room || '', c.status, c.capacity || '', c.n, c.teacher || '', c.room_parents || '', c.book_en || '']));
      lines.push([], ['Assignments'], ['School year', 'Class', 'Role', 'Person', 'Start', 'End']);
      d.classes.forEach((c) => (d.byClass[c.id] || []).forEach((a) => lines.push([c.year_label, c.code, a.role_en, `${a.english_first_name} ${a.english_last_name} ${a.chinese_name}`.trim(), a.start_date || '', a.end_date || ''])));
      audit(db, 'school_classes', null, 'export_class_roster_csv', null, { rows: d.classes.length }, req.portal.user.id, req.ip);
      return res.type('text/csv; charset=utf-8').set('Content-Disposition', `attachment; filename="classes-${d.year.label}.csv"`).send('﻿' + lines.map((l) => l.map(csvEscape).join(',')).join('\r\n'));
    }
    page(req, res, 'class-roster.ejs', { ...d, canAssign: staffCan(req, 'assignments.create'), canChange: staffCan(req, 'assignments.update'), canRemove: staffCan(req, 'assignments.delete'), canEditClass: staffCan(req, 'classes.update'), canCreateClass: staffCan(req, 'classes.create'), canDeleteClass: staffCan(req, 'classes.delete') }, { title: 'Classes' });
  });
  const backToRoster = (req, res, classId, msg, type = 'ok') => { req.session.portalFlash = { type, msg }; res.redirect(`/${req.params.lang}/portal/class-roster?open=${classId}${req.body._year ? '&year=' + encodeURIComponent(req.body._year) : ''}#class-${classId}`); };
  app.post(`${R}/class-roster/assignments`, requireLogin, csrfMiddleware, (req, res) => {
    if (!staffCan(req, 'assignments.create')) return forbidden(req, res);
    const cls = db.prepare('SELECT * FROM school_classes WHERE id = ? AND deleted_at IS NULL').get(Number(req.body.school_class_id));
    const person = Number(req.body.person_id); const role = Number(req.body.assignment_role_id);
    if (!cls) return go(req, res, '/class-roster');
    if (!person || !db.prepare('SELECT 1 FROM persons WHERE id = ? AND deleted_at IS NULL').get(person) || !db.prepare('SELECT 1 FROM assignment_roles WHERE id = ?').get(role))
      return backToRoster(req, res, cls.id, 'Choose a person and a role. 請選擇人員與角色。', 'warn');
    const yr = db.prepare('SELECT * FROM school_years WHERE id = ?').get(cls.school_year_id);
    createRow(db, ENTITIES.class_assignments, { school_year_id: cls.school_year_id, school_class_id: cls.id, person_id: person, assignment_role_id: role, start_date: s(req.body.start_date) || yr?.first_day || null, end_date: s(req.body.end_date) || yr?.last_day || null }, req.portal.user.id, req.ip);
    backToRoster(req, res, cls.id, 'Assignment added. 已指派。');
  });
  app.post(`${R}/class-roster/assignments/:id`, requireLogin, csrfMiddleware, (req, res) => {
    if (!staffCan(req, 'assignments.update')) return forbidden(req, res);
    const a = db.prepare('SELECT * FROM class_assignments WHERE id = ? AND deleted_at IS NULL').get(Number(req.params.id));
    if (!a) return go(req, res, '/class-roster');
    const role = Number(req.body.assignment_role_id) || a.assignment_role_id;
    updateRow(db, ENTITIES.class_assignments, a.id, { assignment_role_id: role, start_date: s(req.body.start_date) || null, end_date: s(req.body.end_date) || null }, req.portal.user.id, req.ip);
    backToRoster(req, res, a.school_class_id, 'Assignment saved. 已儲存。');
  });
  app.post(`${R}/class-roster/assignments/:id/delete`, requireLogin, csrfMiddleware, (req, res) => {
    if (!staffCan(req, 'assignments.delete')) return forbidden(req, res);
    const a = db.prepare('SELECT * FROM class_assignments WHERE id = ? AND deleted_at IS NULL').get(Number(req.params.id));
    if (!a) return go(req, res, '/class-roster');
    softDelete(db, ENTITIES.class_assignments, a.id, req.portal.user.id, req.ip);
    backToRoster(req, res, a.school_class_id, 'Assignment removed. 已移除。');
  });

  // ---------- class placement: saved from the expanded row of the Enrollment table (and kept for old links) ----------
  app.get(`${R}/placement`, requireLogin, (req, res) => res.redirect(`/${req.params.lang}/portal/manage/enrollments?f_placement=unplaced`));
  app.post(`${R}/placement`, requireLogin, csrfMiddleware, (req, res) => {
    if (!staffCan(req, 'placement.assign')) return forbidden(req, res);
    const uid = req.portal.user.id; let n = 0;
    for (const [k, v] of Object.entries(req.body)) {
      const m = k.match(/^class_(\d+)$/); if (!m || !v) continue;
      const cls = Number(v); if (!db.prepare('SELECT 1 FROM school_classes WHERE id = ? AND deleted_at IS NULL').get(cls)) continue;
      const en = db.prepare('SELECT * FROM enrollments WHERE id = ?').get(Number(m[1]));
      if (!en || en.school_class_id === cls) continue;
      const paid = en.status !== 'pending';
      db.prepare("UPDATE enrollments SET school_class_id = ?, status = CASE WHEN status='pending' THEN 'pending' ELSE 'placed' END, placed_at = datetime('now'), updated_at = datetime('now'), updated_by = ? WHERE id = ?").run(cls, uid, en.id);
      audit(db, 'enrollments', en.id, 'placed', { class: en.school_class_id }, { class: cls, paid }, uid, req.ip); n += 1;
    }
    const back = /^\/(en|zh)\/portal\/manage\/enrollments(\?[A-Za-z0-9_=&%.+-]*)?$/.test(String(req.body._back || '')) ? String(req.body._back) : `/${req.params.lang}/portal/manage/enrollments`;
    req.session.portalFlash = { type: 'ok', msg: n ? `${n} student(s) placed. 已分班。` : 'Nothing changed. 沒有變更。' };
    res.redirect(back);
  });

  // ---------- fees: everything for one school year in one place ----------
  const FEE_CODES = ENTITIES.fee_schedules.fields.find((f) => f.name === 'code').options;
  function feesPage(req, res, yearId, errors = {}, status = 200) {
    const years = db.prepare('SELECT * FROM school_years WHERE deleted_at IS NULL ORDER BY label DESC').all();
    const year = years.find((y) => y.id === yearId) || currentYear(db);
    const fees = db.prepare('SELECT f.*, ct.name_en AS ct_en FROM fee_schedules f LEFT JOIN class_types ct ON ct.id = f.class_type_id WHERE f.school_year_id = ? AND f.deleted_at IS NULL ORDER BY f.sort, f.id').all(year.id);
    const rules = db.prepare('SELECT * FROM withdrawal_fee_rules WHERE school_year_id = ? AND deleted_at IS NULL ORDER BY sort, id').all(year.id);
    const types = db.prepare('SELECT id, code, name_en, name_zh FROM class_types WHERE deleted_at IS NULL ORDER BY sort').all();
    page(req, res, 'fees.ejs', { years, year, fees, rules, types, codes: FEE_CODES, errors, previous: years.find((y) => y.label < year.label) }, { title: 'Fees for a School Year', status });
  }
  app.get(`${R}/fees`, requireLogin, (req, res) => { if (!staffCan(req, 'fees.configure')) return forbidden(req, res); feesPage(req, res, Number(req.query.year) || currentYear(db).id); });
  app.post(`${R}/fees`, requireLogin, csrfMiddleware, (req, res) => {
    if (!staffCan(req, 'fees.configure')) return forbidden(req, res);
    const yearId = Number(req.body.year_id); const uid = req.portal.user.id;
    if (!db.prepare('SELECT 1 FROM school_years WHERE id = ?').get(yearId)) return go(req, res, '/fees');
    db.exec('BEGIN');
    try {
      // key dates / flags of the year
      db.prepare('UPDATE school_years SET first_day = ?, last_day = ?, second_semester_start = ?, early_reg_deadline = ?, registration_open = ?, is_current = ?, updated_at = datetime(\'now\'), updated_by = ? WHERE id = ?')
        .run(s(req.body.first_day) || null, s(req.body.last_day) || null, s(req.body.second_semester_start) || null, s(req.body.early_reg_deadline) || null, req.body.registration_open ? 1 : 0, req.body.is_current ? 1 : 0, uid, yearId);
      if (req.body.is_current) db.prepare('UPDATE school_years SET is_current = 0 WHERE id <> ?').run(yearId);
      // fee rows (fee_<i>_<field>)
      const idx = new Set(Object.keys(req.body).map((k) => (k.match(/^fee_(\d+)_/) || [])[1]).filter(Boolean));
      for (const i of idx) {
        const g = (f) => req.body[`fee_${i}_${f}`]; const id = Number(g('id')) || null;
        if (g('del')) { if (id) db.prepare("UPDATE fee_schedules SET deleted_at = datetime('now'), updated_by = ? WHERE id = ?").run(uid, id); continue; }
        if (!s(g('code')) || !s(g('name_en'))) continue;
        const vals = [s(g('code')), s(g('name_en')), s(g('name_zh')), s(g('applies_to')) === 'family' ? 'family' : 'student', Number(g('class_type_id')) || null, dollars(g('amount')) ?? 0, num(g('percent')), num(g('from_nth_child')), s(g('deadline')) || null, g('active') ? 1 : 0, num(g('sort')) ?? 0];
        if (id) db.prepare("UPDATE fee_schedules SET code=?, name_en=?, name_zh=?, applies_to=?, class_type_id=?, amount_cents=?, percent=?, from_nth_child=?, deadline=?, active=?, sort=?, updated_at=datetime('now'), updated_by=? WHERE id = ?").run(...vals, uid, id);
        else db.prepare('INSERT INTO fee_schedules (school_year_id, code, name_en, name_zh, applies_to, class_type_id, amount_cents, percent, from_nth_child, deadline, active, sort, created_by, updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(yearId, ...vals, uid, uid);
      }
      // withdrawal rules (wd_<i>_<field>)
      const widx = new Set(Object.keys(req.body).map((k) => (k.match(/^wd_(\d+)_/) || [])[1]).filter(Boolean));
      for (const i of widx) {
        const g = (f) => req.body[`wd_${i}_${f}`]; const id = Number(g('id')) || null;
        if (g('del')) { if (id) db.prepare("UPDATE withdrawal_fee_rules SET deleted_at = datetime('now') WHERE id = ?").run(id); continue; }
        if (!s(g('label_en'))) continue;
        const vals = [s(g('label_en')), s(g('label_zh')), s(g('from_date')) || null, s(g('to_date')) || null, dollars(g('fee')) ?? 0, g('no_refund') ? 1 : 0, num(g('sort')) ?? 0];
        if (id) db.prepare("UPDATE withdrawal_fee_rules SET label_en=?, label_zh=?, from_date=?, to_date=?, fee_cents=?, no_refund=?, sort=?, updated_at=datetime('now'), updated_by=? WHERE id = ?").run(...vals, uid, id);
        else db.prepare('INSERT INTO withdrawal_fee_rules (school_year_id, label_en, label_zh, from_date, to_date, fee_cents, no_refund, sort, created_by, updated_by) VALUES (?,?,?,?,?,?,?,?,?,?)').run(yearId, ...vals, uid, uid);
      }
      audit(db, 'fee_schedules', yearId, 'fees_saved', null, { year: yearId }, uid, req.ip);
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); if (/UNIQUE/.test(e.message)) return feesPage(req, res, yearId, { _form: 'Two fee rows share the same code and class type. 兩列費用的代碼與班別重複。' }, 400); throw e; }
    go(req, res, `/fees?year=${yearId}`, { type: 'ok', msg: 'Fees saved. 費用已儲存。' });
  });
  // copy every fee + withdrawal rule from another year (next year's setup in one click)
  app.post(`${R}/fees/copy`, requireLogin, csrfMiddleware, (req, res) => {
    if (!staffCan(req, 'fees.configure')) return forbidden(req, res);
    const from = Number(req.body.from); const to = Number(req.body.to); const uid = req.portal.user.id;
    if (!from || !to || from === to) return go(req, res, `/fees?year=${to}`, { type: 'warn', msg: 'Choose a different year to copy from.' });
    if (db.prepare('SELECT COUNT(*) AS n FROM fee_schedules WHERE school_year_id = ? AND deleted_at IS NULL').get(to).n) return go(req, res, `/fees?year=${to}`, { type: 'warn', msg: 'That year already has fees. Delete them first, or edit them here. 該學年已有費用。' });
    db.exec('BEGIN');
    db.prepare(`INSERT INTO fee_schedules (school_year_id, code, name_en, name_zh, amount_cents, applies_to, class_type_id, percent, from_nth_child, deadline, active, notes, sort, created_by, updated_by)
      SELECT ?, code, name_en, name_zh, amount_cents, applies_to, class_type_id, percent, from_nth_child, NULL, active, notes, sort, ?, ? FROM fee_schedules WHERE school_year_id = ? AND deleted_at IS NULL`).run(to, uid, uid, from);
    db.prepare(`INSERT INTO withdrawal_fee_rules (school_year_id, label_en, label_zh, from_date, to_date, fee_cents, no_refund, sort, created_by, updated_by)
      SELECT ?, label_en, label_zh, NULL, NULL, fee_cents, no_refund, sort, ?, ? FROM withdrawal_fee_rules WHERE school_year_id = ? AND deleted_at IS NULL`).run(to, uid, uid, from);
    audit(db, 'fee_schedules', to, 'fees_copied', null, { from, to }, uid, req.ip);
    db.exec('COMMIT');
    go(req, res, `/fees?year=${to}`, { type: 'ok', msg: 'Fees copied. Review the amounts and dates below. 已複製，請確認金額與日期。' });
  });
}
