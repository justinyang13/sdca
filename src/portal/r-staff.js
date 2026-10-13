// src/portal/r-staff.js — reports & exports, class placement, and the one-place fee configuration page.
import { csrfMiddleware } from '../middleware/csrf.js';
import { can, canAll } from './perm.js';
import { currentYear } from './fees.js';
import { csvEscape, audit } from './crud.js';
import { ENTITIES } from './entities.js';

const s = (v) => String(v ?? '').trim();
const dollars = (v) => { const t = s(v).replace(/[$,]/g, ''); if (t === '') return null; const n = Math.round(parseFloat(t) * 100); return Number.isFinite(n) ? n : null; };
const num = (v) => { const t = s(v); return t === '' ? null : Number(t); };

export function registerStaffRoutes(app, { db, page, requireLogin }) {
  const R = '/:lang/portal';
  const go = (req, res, p, flash) => { if (flash) req.session.portalFlash = flash; res.redirect(`/${req.params.lang}/portal${p}`); };
  const forbidden = (req, res) => page(req, res, 'forbidden.ejs', {}, { title: 'Not allowed', status: 403 });
  const staffCan = (req, c) => canAll(req.portal.access, c);
  const csv = (res, name, header, rows) => {
    const lines = [header.map(csvEscape).join(',')].concat(rows.map((r) => r.map(csvEscape).join(',')));
    res.type('text/csv; charset=utf-8').set('Content-Disposition', `attachment; filename="${name}"`).send('﻿' + lines.join('\r\n'));
  };

  // ---------- reports (links to the list pages) ----------
  app.get(`${R}/reports`, requireLogin, (req, res) => {
    const a = req.portal.access;
    if (!can(a, 'student_list.list') && !can(a, 'volunteer_list.list') && !can(a, 'transactions.list')) return forbidden(req, res);
    page(req, res, 'reports.ejs', { year: currentYear(db) }, { title: 'Reports & Exports' });
  });

  // ---------- class roster (sortable) ----------
  app.get(`${R}/class-roster`, requireLogin, (req, res) => {
    if (!can(req.portal.access, 'reports.class_roster')) return forbidden(req, res);
    const year = currentYear(db);
    const SORTS = { code: 'sc.code', name: 'sc.name_en', room: 'rm.code', teacher: 'teacher', n: 'n' };
    const sort = SORTS[req.query.sort] ? req.query.sort : 'code';
    const dir = req.query.dir === 'desc' ? 'DESC' : 'ASC';
    const classes = year ? db.prepare(`SELECT sc.id, sc.code, sc.name_zh, sc.name_en, rm.code AS room, (SELECT COUNT(*) FROM enrollments e WHERE e.school_class_id = sc.id AND e.status IN ('registered','placed') AND e.deleted_at IS NULL) AS n,
      (SELECT p.english_last_name || ' ' || p.chinese_name FROM class_assignments ca JOIN assignment_roles ar ON ar.id = ca.assignment_role_id JOIN persons p ON p.id = ca.person_id WHERE ca.school_class_id = sc.id AND ar.code = 'primary_instructor' AND ca.deleted_at IS NULL LIMIT 1) AS teacher
      FROM school_classes sc LEFT JOIN rooms rm ON rm.id = sc.room_id WHERE sc.school_year_id = ? AND sc.deleted_at IS NULL ORDER BY ${SORTS[sort]} COLLATE NOCASE ${dir}, sc.code`).all(year.id) : [];
    page(req, res, 'class-roster.ejs', { year, classes, sort, dir }, { title: 'Class Roster' });
  });

  // ---------- class placement ----------
  app.get(`${R}/placement`, requireLogin, (req, res) => {
    if (!staffCan(req, 'placement.assign')) return forbidden(req, res);
    const year = currentYear(db);
    const filter = ['unplaced', 'all'].includes(req.query.show) ? req.query.show : 'unplaced';
    const rows = db.prepare(`SELECT e.id, e.status, e.grade_label, e.school_class_id, e.class_type_id, p.english_first_name, p.english_last_name, p.chinese_name, p.birth_date, ct.name_en AS ct_en, ct.name_zh AS ct_zh
      FROM enrollments e JOIN persons p ON p.id = e.student_person_id LEFT JOIN class_types ct ON ct.id = e.class_type_id
      WHERE e.school_year_id = ? AND e.status IN ('registered','placed','pending') AND e.deleted_at IS NULL ${filter === 'unplaced' ? 'AND e.school_class_id IS NULL' : ''} ORDER BY ct.sort, p.birth_date LIMIT 300`).all(year.id);
    const classes = db.prepare(`SELECT sc.id, sc.code, sc.name_zh, sc.name_en, sc.class_type_id, sc.capacity, (SELECT COUNT(*) FROM enrollments e WHERE e.school_class_id = sc.id AND e.status IN ('registered','placed') AND e.deleted_at IS NULL) AS n
      FROM school_classes sc WHERE sc.school_year_id = ? AND sc.deleted_at IS NULL ORDER BY sc.code`).all(year.id);
    page(req, res, 'placement.ejs', { year, rows, classes, filter }, { title: 'Class Placement' });
  });
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
    go(req, res, '/placement', { type: 'ok', msg: `${n} student(s) placed. 已分班。` });
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
