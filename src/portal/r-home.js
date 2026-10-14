// src/portal/r-home.js — role-aware landing page (/portal), class lists, student home, privacy + waiver pages.
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { can, hasRole } from './perm.js';
import { currentYear, money } from './fees.js';
import { myClassIds } from './auth.js';
import { csrfMiddleware } from '../middleware/csrf.js';
import { registrationOptions } from './rereg.js';
import { resourcesFor } from './resources.js';
import { visibleAnnouncements } from './announcements.js';
import { todayLocal, nowUtc } from '../datetime.js';
import { portalHelpers } from './util.js';

export function placementVisible(year, today = todayLocal()) {
  if (!year?.first_day) return true;
  const d = new Date(year.first_day + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - (year.placement_visible_days_before ?? 7));
  return today >= d.toISOString().slice(0, 10);
}

/** Everything the family-home partial needs for one family. */
export function familyView(db, familyId, { staff = false } = {}) {
  const year = currentYear(db);
  const fam = db.prepare(`SELECT f.*, a.street, a.city, a.state, a.zipcode FROM families f LEFT JOIN addresses a ON a.id = f.address_id WHERE f.id = ? AND f.deleted_at IS NULL`).get(familyId);
  if (!fam) return null;
  const members = db.prepare(`SELECT fm.relationship, p.* FROM family_members fm JOIN persons p ON p.id = fm.person_id WHERE fm.family_id = ? AND fm.deleted_at IS NULL ORDER BY fm.sort, p.birth_date`).all(familyId);
  const parent1 = members.find((m) => m.relationship === 'parent_one');
  const parent2 = members.find((m) => m.relationship === 'parent_two');
  const visible = staff || placementVisible(year);
  const children = members.filter((m) => m.relationship === 'child').map((c) => {
    const en = year ? db.prepare(`SELECT e.*, sc.code AS class_code, sc.name_zh, sc.name_en, rm.code AS room, ct.is_credit, ct.name_en AS ct_en, ct.name_zh AS ct_zh,
      (SELECT p.english_last_name || ' ' || p.english_first_name || ' ' || p.chinese_name FROM class_assignments ca JOIN assignment_roles ar ON ar.id = ca.assignment_role_id JOIN persons p ON p.id = ca.person_id
        WHERE ca.school_class_id = e.school_class_id AND ar.code = 'primary_instructor' AND ca.deleted_at IS NULL LIMIT 1) AS teacher
      FROM enrollments e LEFT JOIN school_classes sc ON sc.id = e.school_class_id LEFT JOIN rooms rm ON rm.id = sc.room_id LEFT JOIN class_types ct ON ct.id = e.class_type_id
      WHERE e.student_person_id = ? AND e.school_year_id = ? AND e.deleted_at IS NULL AND e.status <> 'withdrawn'`).get(c.id, year.id) : null;
    const info = year ? db.prepare('SELECT 1 FROM student_school_info WHERE student_person_id = ? AND school_year_id = ? AND deleted_at IS NULL').get(c.id, year.id) : null;
    return { ...c, enrollment: en, showPlacement: visible && en?.school_class_id, hasSchoolInfo: !!info };
  });
  const registrations = year ? db.prepare(`SELECT * FROM registrations WHERE family_id = ? AND school_year_id = ? AND status <> 'cancelled' AND deleted_at IS NULL ORDER BY id DESC`).all(familyId, year.id) : [];
  return { fam, year, parent1, parent2, children, registrations, members, regOptions: registrationOptions(db, familyId) };
}

export function registerHomeRoutes(app, { db, page, requireLogin, requirePerm, isStaticBuild }) {
  const { lang, P } = portalHelpers(page);
  const R = '/:lang/portal';

  app.get(R, (req, res) => {
    if (!req.portal) return res.redirect(P(req, '/signin'));
    const a = req.portal.access;
    const year = currentYear(db);
    const w = { overview: null, classNews: [], resources: resourcesFor(a, can, (p) => P(req, p)), year, admin: null, secretary: null, finance: null, pta: null, instructor: null, families: null, canRegister: false, volunteer: null, student: null };
    const count = (sql, ...args) => db.prepare(sql).get(...args).n;
    const personId = req.portal.person.id;
    w.classNews = (can(a, 'class_announcements.view_own') || can(a, 'class_announcements.post_own')) && !can(a, 'class_announcements.list') ? visibleAnnouncements(db, req.portal, { limit: 3 }) : [];

    if (can(a, 'dashboard.admin')) {
      w.admin = {
        families: count('SELECT COUNT(*) n FROM families WHERE deleted_at IS NULL'),
        persons: count('SELECT COUNT(*) n FROM persons WHERE deleted_at IS NULL'),
        users: count('SELECT COUNT(*) n FROM users WHERE deleted_at IS NULL'),
        students: year ? count("SELECT COUNT(*) n FROM enrollments WHERE school_year_id = ? AND status IN ('registered','placed') AND deleted_at IS NULL", year.id) : 0,
        regs: year ? db.prepare("SELECT status, COUNT(*) n FROM registrations WHERE school_year_id = ? AND deleted_at IS NULL GROUP BY status").all(year.id) : [],
        classes: year ? count('SELECT COUNT(*) n FROM school_classes WHERE school_year_id = ? AND deleted_at IS NULL', year.id) : 0,
        recent: db.prepare("SELECT a.at, a.action, a.table_name, a.row_id, COALESCE(u.username,'') AS username FROM portal_audit a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 8").all(),
        outbox: count('SELECT COUNT(*) n FROM email_outbox WHERE deleted_at IS NULL'),
      };
    }
    if (a.roleCodes.some((c) => c.startsWith('board_') || c === 'secretary') || w.admin) {   // every board member, the school secretary and the admin see the same school totals as the admin dashboard
      const allow = (e) => can(a, `${e}.list`);
      w.overview = {
        families: count('SELECT COUNT(*) n FROM families WHERE deleted_at IS NULL'),
        persons: count('SELECT COUNT(*) n FROM persons WHERE deleted_at IS NULL'),
        users: count('SELECT COUNT(*) n FROM users WHERE deleted_at IS NULL'),
        students: year ? count("SELECT COUNT(*) n FROM enrollments WHERE school_year_id = ? AND status IN ('registered','placed') AND deleted_at IS NULL", year.id) : 0,
        classes: year ? count('SELECT COUNT(*) n FROM school_classes WHERE school_year_id = ? AND deleted_at IS NULL', year.id) : 0,
        regs: year ? db.prepare("SELECT status, COUNT(*) n FROM registrations WHERE school_year_id = ? AND deleted_at IS NULL GROUP BY status").all(year.id) : [],
        transactions: year ? count('SELECT COUNT(*) n FROM transactions WHERE school_year_id = ? AND voided_at IS NULL AND deleted_at IS NULL', year.id) : 0,
        events: count('SELECT COUNT(*) n FROM events WHERE deleted_at IS NULL'),
        more: [
          { n: count('SELECT COUNT(*) n FROM announcements WHERE published = 1 AND deleted_at IS NULL'), en: 'Announcements', zh: '公開通告', path: '/manage/announcements', ok: allow('announcements') },
          { n: count('SELECT COUNT(*) n FROM class_announcements WHERE deleted_at IS NULL'), en: 'Class announcements', zh: '班級通告', path: '/class-announcements', ok: allow('class_announcements') },
          { n: year ? count('SELECT COUNT(DISTINCT person_id) n FROM volunteer_signups WHERE school_year_id = ? AND deleted_at IS NULL', year.id) : 0, en: 'Volunteers', zh: '義工', path: '/manage/volunteer_signups', ok: allow('volunteer_signups') },
          { n: year ? count("SELECT COUNT(DISTINCT ca.person_id) n FROM class_assignments ca JOIN assignment_roles ar ON ar.id = ca.assignment_role_id WHERE ca.school_year_id = ? AND ar.code = 'room_parent' AND ca.deleted_at IS NULL", year.id) : 0, en: 'Room parents', zh: '班媽/班爸', path: '/class-roster', ok: can(a, 'reports.class_roster') },
          { n: year ? count("SELECT COUNT(DISTINCT ca.person_id) n FROM class_assignments ca JOIN assignment_roles ar ON ar.id = ca.assignment_role_id WHERE ca.school_year_id = ? AND ar.code <> 'room_parent' AND ca.deleted_at IS NULL", year.id) : 0, en: 'Teachers and assistants', zh: '老師與助教', path: '/class-roster', ok: can(a, 'reports.class_roster') },
          { n: count("SELECT COUNT(DISTINCT person_id) n FROM board_members WHERE deleted_at IS NULL AND (start_date IS NULL OR start_date <= date('now','localtime')) AND (end_date IS NULL OR end_date >= date('now','localtime'))"), en: 'Board members', zh: '理事', path: '/manage/board_members', ok: allow('board_members') },
        ],
        links: { families: allow('families'), persons: allow('persons'), students: allow('enrollments'), classes: allow('classes') || allow('school_classes'), users: allow('users'), regs: allow('registrations'), transactions: allow('transactions'), events: allow('events') },
      };
      const o = w.overview;
      const tiles = [
        { n: o.families, en: 'Families', zh: '家庭', path: '/manage/families', ok: o.links.families },
        { n: o.persons, en: 'Directory', zh: '通訊錄', path: '/manage/persons', ok: o.links.persons },
        { n: o.students, en: 'Students this year', zh: '本學年學生', path: '/manage/enrollments', ok: o.links.students },
        { n: o.classes, en: 'Classes', zh: '班級', path: '/manage/school_classes', ok: o.links.classes },
        { n: o.users, en: 'Users', zh: '用戶', path: '/manage/users', ok: o.links.users },
        { n: o.transactions, en: 'Transactions this year', zh: '本學年交易', path: '/manage/transactions', ok: o.links.transactions },
        { n: o.events, en: 'Events', zh: '活動', path: '/manage/events', ok: o.links.events },
        ...o.more,
      ];
      const enrolled = "e.status IN ('registered','placed') AND e.deleted_at IS NULL";
      o.charts = {
        classes: year ? db.prepare(`SELECT sc.code, sc.name_en, sc.name_zh, sc.capacity, (SELECT COUNT(*) FROM enrollments e WHERE e.school_class_id = sc.id AND ${enrolled}) AS n
          FROM school_classes sc WHERE sc.school_year_id = ? AND sc.deleted_at IS NULL ORDER BY sc.code`).all(year.id) : [],
        years: db.prepare(`SELECT y.label, (SELECT COUNT(*) FROM enrollments e WHERE e.school_year_id = y.id AND ${enrolled}) AS n FROM school_years y WHERE y.deleted_at IS NULL ORDER BY y.label`).all(),
        jobs: year ? db.prepare(`SELECT j.name_en, j.name_zh,
            SUM(CASE WHEN s.status = 'requested' THEN 1 ELSE 0 END) AS requested, SUM(CASE WHEN s.status = 'assigned' THEN 1 ELSE 0 END) AS assigned, SUM(CASE WHEN s.status = 'completed' THEN 1 ELSE 0 END) AS completed
          FROM volunteer_signups s JOIN volunteer_jobs j ON j.id = COALESCE(s.assigned_job_id, s.job_id)
          WHERE s.school_year_id = ? AND s.deleted_at IS NULL AND s.status <> 'declined' GROUP BY j.id ORDER BY j.sort, j.name_en`).all(year.id) : [],
      };
      if (w.admin) tiles.push({ n: w.admin.outbox, en: 'Emails (demo outbox)', zh: '郵件 (示範寄件匣)', path: '/manage/email_outbox', ok: allow('email_outbox') });
      const zh = lang(req) === 'zh';
      o.tiles = tiles.sort((x, y) => (zh ? x.zh.localeCompare(y.zh, 'zh-Hant') : x.en.localeCompare(y.en)));
    }
    if (can(a, 'dashboard.secretary') || can(a, 'dashboard.principal')) {
      w.secretary = {
        pendingPay: year ? db.prepare(`SELECT r.id, r.grand_total_cents, r.submitted_at, (SELECT p.english_last_name || ' ' || p.english_first_name FROM family_members fm JOIN persons p ON p.id = fm.person_id WHERE fm.family_id = r.family_id AND fm.relationship = 'parent_one' LIMIT 1) AS parent, r.family_id
          FROM registrations r WHERE r.school_year_id = ? AND r.status = 'submitted' AND r.deleted_at IS NULL ORDER BY r.submitted_at LIMIT 10`).all(year.id) : [],
        unplaced: year ? count("SELECT COUNT(*) n FROM enrollments WHERE school_year_id = ? AND school_class_id IS NULL AND status IN ('registered','placed') AND deleted_at IS NULL", year.id) : 0,
        tools: can(a, 'dashboard.secretary'),
      };
    }
    if (can(a, 'dashboard.finance')) {
      w.finance = {
        pendingPay: year ? db.prepare(`SELECT r.id, r.grand_total_cents, r.submitted_at, r.family_id, (SELECT p.english_last_name || ' ' || p.english_first_name FROM family_members fm JOIN persons p ON p.id = fm.person_id WHERE fm.family_id = r.family_id AND fm.relationship = 'parent_one' LIMIT 1) AS parent
          FROM registrations r WHERE r.school_year_id = ? AND r.status = 'submitted' AND r.deleted_at IS NULL ORDER BY r.submitted_at LIMIT 10`).all(year.id) : [],
        recent: db.prepare(`SELECT t.id, t.transaction_date, t.amount_cents, t.voided_at, tt.name_en AS type, pm.name_en AS method FROM transactions t JOIN transaction_types tt ON tt.id = t.transaction_type_id JOIN payment_methods pm ON pm.id = t.payment_method_id WHERE t.deleted_at IS NULL ORDER BY t.id DESC LIMIT 8`).all(),
        totals: year ? db.prepare(`SELECT tt.name_en AS type, tt.direction, SUM(t.amount_cents) AS total, COUNT(*) AS n FROM transactions t JOIN transaction_types tt ON tt.id = t.transaction_type_id WHERE t.school_year_id = ? AND t.voided_at IS NULL AND t.deleted_at IS NULL GROUP BY tt.id ORDER BY total DESC`).all(year.id) : [],
      };
    }
    if (can(a, 'dashboard.pta')) {
      w.pta = year ? {
        byJob: db.prepare(`SELECT COALESCE(j.name_en,'(none)') AS en, COALESCE(j.name_zh,'') AS zh, COUNT(*) AS n FROM volunteer_signups s LEFT JOIN volunteer_jobs j ON j.id = s.job_id WHERE s.school_year_id = ? AND s.deleted_at IS NULL GROUP BY s.job_id ORDER BY n DESC`).all(year.id),
        unassigned: count("SELECT COUNT(*) n FROM volunteer_signups WHERE school_year_id = ? AND status = 'requested' AND deleted_at IS NULL", year.id),
        declined: count("SELECT COUNT(*) n FROM volunteer_signups WHERE school_year_id = ? AND status = 'declined' AND deleted_at IS NULL", year.id),
      } : null;
    }
    if (can(a, 'class.view_own') || can(a, 'grades.enter_own_classes')) {
      const ids = myClassIds(db, personId);
      w.instructor = ids.length ? db.prepare(`SELECT sc.id, sc.code, sc.name_zh, sc.name_en, rm.code AS room, ar.name_en AS role_en, ar.name_zh AS role_zh, ct.is_credit,
        (SELECT COUNT(*) FROM enrollments e WHERE e.school_class_id = sc.id AND e.status IN ('registered','placed') AND e.deleted_at IS NULL) AS students
        FROM school_classes sc LEFT JOIN rooms rm ON rm.id = sc.room_id JOIN class_types ct ON ct.id = sc.class_type_id
        JOIN class_assignments ca ON ca.school_class_id = sc.id AND ca.person_id = ? AND ca.deleted_at IS NULL JOIN assignment_roles ar ON ar.id = ca.assignment_role_id
        WHERE sc.id IN (${ids.map(() => '?').join(',')}) ORDER BY sc.code`).all(personId, ...ids) : [];
    }
    if (can(a, 'family.own') && req.portal.familyIds.length) {
      w.families = req.portal.familyIds.map((id) => familyView(db, id)).filter(Boolean);
      w.canRegister = can(a, 'registration.own');
    }
    if (can(a, 'volunteer.own')) {
      w.volunteer = year ? db.prepare(`SELECT s.*, j.name_en, j.name_zh, aj.name_en AS aname, aj.name_zh AS aname_zh FROM volunteer_signups s LEFT JOIN volunteer_jobs j ON j.id = s.job_id LEFT JOIN volunteer_jobs aj ON aj.id = s.assigned_job_id
        WHERE s.person_id = ? AND s.school_year_id = ? AND s.deleted_at IS NULL ORDER BY s.priority`).all(personId, year.id) : [];
    }
    if (can(a, 'student.own')) {
      const me = personId;
      const en = year ? db.prepare(`SELECT e.*, sc.code, sc.name_zh, sc.name_en, rm.code AS room, ct.name_en AS ct_en, ct.name_zh AS ct_zh, ct.is_credit, sy.label AS year_label FROM enrollments e
        LEFT JOIN school_classes sc ON sc.id = e.school_class_id LEFT JOIN rooms rm ON rm.id = sc.room_id LEFT JOIN class_types ct ON ct.id = e.class_type_id JOIN school_years sy ON sy.id = e.school_year_id
        WHERE e.student_person_id = ? AND e.school_year_id = ? AND e.deleted_at IS NULL AND e.status <> 'withdrawn'`).get(me, year.id) : null;
      const teachers = en?.school_class_id ? db.prepare(`SELECT p.english_last_name, p.english_first_name, p.chinese_name, ar.name_en AS role_en, ar.name_zh AS role_zh FROM class_assignments ca JOIN persons p ON p.id = ca.person_id
        JOIN assignment_roles ar ON ar.id = ca.assignment_role_id WHERE ca.school_class_id = ? AND ca.deleted_at IS NULL AND ar.code <> 'room_parent' ORDER BY ar.id`).all(en.school_class_id) : [];
      const school = year ? db.prepare(`SELECT s.*, d.name AS district FROM student_school_info s LEFT JOIN school_districts d ON d.id = s.school_district_id WHERE s.student_person_id = ? AND s.school_year_id = ? AND s.deleted_at IS NULL`).get(me, year.id) : null;
      const grades = db.prepare(`SELECT g.*, sy.label AS year_label FROM credit_grades g JOIN enrollments e ON e.id = g.enrollment_id JOIN school_years sy ON sy.id = e.school_year_id
        WHERE e.student_person_id = ? AND g.published = 1 AND g.deleted_at IS NULL ORDER BY sy.label DESC, g.term, g.course_name`).all(me);
      w.student = { person: req.portal.person, enrollment: en, teachers, school, grades, showPlacement: en && placementVisible(year) };
    }
    page(req, res, 'home.ejs', w, { title: 'Home' });
  });

  // ---------- class lists ----------
  const classAccess = (req, classId) => {
    const a = req.portal.access;
    if (can(a, 'reports.class_roster') || can(a, 'classes.view')) return true;
    return can(a, 'class.view_own') && myClassIds(db, req.portal.person.id, { currentOnly: false }).includes(Number(classId));
  };
  app.get(`${R}/classes/:id`, requireLogin, (req, res) => {
    const cls = db.prepare(`SELECT sc.*, ct.name_en AS ct_en, ct.name_zh AS ct_zh, ct.is_credit, rm.code AS room, y.label AS year_label FROM school_classes sc JOIN class_types ct ON ct.id = sc.class_type_id
      JOIN school_years y ON y.id = sc.school_year_id LEFT JOIN rooms rm ON rm.id = sc.room_id WHERE sc.id = ? AND sc.deleted_at IS NULL`).get(Number(req.params.id));
    if (!cls || !classAccess(req, cls.id)) return page(req, res, 'forbidden.ejs', {}, { title: 'Not allowed', status: 403 });
    const staffAssign = db.prepare(`SELECT p.english_last_name, p.english_first_name, p.chinese_name, ar.code, ar.name_en, ar.name_zh FROM class_assignments ca JOIN persons p ON p.id = ca.person_id JOIN assignment_roles ar ON ar.id = ca.assignment_role_id
      WHERE ca.school_class_id = ? AND ca.deleted_at IS NULL ORDER BY ar.id`).all(cls.id);
    const students = db.prepare(`SELECT p.id, p.english_last_name, p.english_first_name, p.chinese_name, p.gender, p.allergy, p.special_medical_needs, e.status FROM enrollments e JOIN persons p ON p.id = e.student_person_id
      WHERE e.school_class_id = ? AND e.status IN ('registered','placed') AND e.deleted_at IS NULL ORDER BY p.english_last_name, p.english_first_name`).all(cls.id);
    const isStaff = can(req.portal.access, 'reports.class_roster');
    const grades = cls.is_credit && (can(req.portal.access, 'grades.enter_own_classes') || can(req.portal.access, 'credit_grades.update')) && classAccess(req, cls.id);
    page(req, res, 'class-list.ejs', { cls, staffAssign, students, isStaff, grades, now: nowUtc(), print: req.query.print === '1' }, { title: `Class ${cls.code}` });
  });
  // ---------- credit grades (teacher enters / staff edits) ----------
  app.get(`${R}/classes/:id/grades`, requireLogin, (req, res) => {
    const cls = db.prepare('SELECT sc.*, ct.is_credit, ct.name_en AS ct_en, ct.name_zh AS ct_zh FROM school_classes sc JOIN class_types ct ON ct.id = sc.class_type_id WHERE sc.id = ? AND sc.deleted_at IS NULL').get(Number(req.params.id));
    const a = req.portal.access;
    const ok = cls && cls.is_credit && (can(a, 'credit_grades.update') || (can(a, 'grades.enter_own_classes') && myClassIds(db, req.portal.person.id, { currentOnly: false }).includes(cls.id)));
    if (!ok) return page(req, res, 'forbidden.ejs', {}, { title: 'Not allowed', status: 403 });
    const term = ['S1', 'S2', 'FINAL'].includes(req.query.term) ? req.query.term : 'S1';
    const rows = db.prepare(`SELECT e.id AS enrollment_id, p.english_last_name, p.english_first_name, p.chinese_name,
      g.id AS gid, g.letter_grade, g.percent, g.credits, g.teacher_comment, g.published, g.course_name FROM enrollments e JOIN persons p ON p.id = e.student_person_id
      LEFT JOIN credit_grades g ON g.enrollment_id = e.id AND g.term = ? AND g.deleted_at IS NULL WHERE e.school_class_id = ? AND e.status IN ('registered','placed') AND e.deleted_at IS NULL ORDER BY p.english_last_name, p.english_first_name`).all(term, cls.id);
    page(req, res, 'class-grades.ejs', { cls, rows, term }, { title: `Grades ${cls.code}` });
  });
  app.post(`${R}/classes/:id/grades`, requireLogin, csrfMiddleware, (req, res) => {
    const cls = db.prepare('SELECT sc.*, ct.is_credit FROM school_classes sc JOIN class_types ct ON ct.id = sc.class_type_id WHERE sc.id = ? AND sc.deleted_at IS NULL').get(Number(req.params.id));
    const a = req.portal.access;
    const ok = cls && cls.is_credit && (can(a, 'credit_grades.update') || (can(a, 'grades.enter_own_classes') && myClassIds(db, req.portal.person.id, { currentOnly: false }).includes(cls.id)));
    if (!ok) return page(req, res, 'forbidden.ejs', {}, { title: 'Not allowed', status: 403 });
    const term = ['S1', 'S2', 'FINAL'].includes(req.body.term) ? req.body.term : 'S1';
    const uid = req.portal.user.id;
    const enr = db.prepare("SELECT id FROM enrollments WHERE school_class_id = ? AND status IN ('registered','placed') AND deleted_at IS NULL").all(cls.id).map((x) => x.id);
    for (const eid of enr) {
      const letter = String(req.body[`letter_${eid}`] || '').trim(); const pct = String(req.body[`pct_${eid}`] || '').trim();
      const credits = Number(req.body[`credits_${eid}`] || 0.5); const comment = String(req.body[`comment_${eid}`] || '').trim(); const pub = req.body[`pub_${eid}`] ? 1 : 0;
      const ex = db.prepare('SELECT id FROM credit_grades WHERE enrollment_id = ? AND term = ? AND deleted_at IS NULL').get(eid, term);
      if (!letter && !pct && !comment && !ex) continue;
      if (ex) db.prepare("UPDATE credit_grades SET letter_grade=?, percent=?, credits=?, teacher_comment=?, published=?, course_name=?, updated_at=datetime('now'), updated_by=? WHERE id=?").run(letter, pct === '' ? null : Number(pct), credits, comment, pub, cls.name_en || cls.code, uid, ex.id);
      else db.prepare('INSERT INTO credit_grades (enrollment_id, term, course_name, letter_grade, percent, credits, teacher_comment, published, created_by, updated_by) VALUES (?,?,?,?,?,?,?,?,?,?)').run(eid, term, cls.name_en || cls.code, letter, pct === '' ? null : Number(pct), credits, comment, pub, uid, uid);
    }
    req.session.portalFlash = { type: 'ok', msg: 'Grades saved. 成績已儲存。' };
    res.redirect(P(req, `/classes/${cls.id}/grades?term=${term}`));
  });

  // ---------- public text pages ----------
  app.get(`${R}/privacy`, (req, res, next) => {
    if (isStaticBuild(req)) return next('route');
    const file = path.join(config.viewsDir, 'portal', 'privacy.html');
    page(req, res, 'html-page.ejs', { html: fs.readFileSync(file, 'utf8').replace(/\{\{L\}\}/g, lang(req)), title: 'Privacy Policy' }, { title: 'Privacy Policy', shell: req.portal ? 'app' : 'bare' });
  });
  app.get(`${R}/waiver`, (req, res) => {
    const docs = db.prepare('SELECT * FROM waiver_documents WHERE deleted_at IS NULL ORDER BY sort, id').all();
    page(req, res, 'waiver.ejs', { docs }, { title: 'Waiver', shell: req.portal ? 'app' : 'bare' });
  });
}
