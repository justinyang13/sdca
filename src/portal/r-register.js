// src/portal/r-register.js — the 3-step registration wizard for a family, plus the printable form.
import { csrfMiddleware } from '../middleware/csrf.js';
import { can } from './perm.js';
import { currentYear, computeRegistration, money } from './fees.js';
import { ownsFamily } from './auth.js';
import { audit } from './crud.js';
import { gradeLabel, gradeFromBirth, ageOn, startYear } from './grades.js';
import { queueEmail } from './auth.js';
import { portalHelpers } from './util.js';
import { suggestFor, previousVolunteerJobs, copySchoolInfo, gradeNumber } from './rereg.js';

const n2 = (s) => String(s || '').trim();

export function registerRegistrationRoutes(app, { db, page, requireLogin }) {
  const { lang, go, forbidden, staffCan } = portalHelpers(page);
  const R = '/:lang/portal';
  const mayRegister = (req, fid) => (can(req.portal.access, 'registration.own') && ownsFamily(db, req.portal.person.id, fid)) || staffCan(req, 'registrations.update');
  const mayView = (req, fid) => mayRegister(req, fid) || staffCan(req, 'registrations.view') || (can(req.portal.access, 'transactions.own') && ownsFamily(db, req.portal.person.id, fid));
  const regOf = (id) => db.prepare('SELECT * FROM registrations WHERE id = ? AND deleted_at IS NULL').get(Number(id));
  const famName = (fid) => db.prepare(`SELECT p.english_last_name || ' ' || p.english_first_name || ' ' || p.chinese_name AS n FROM family_members fm JOIN persons p ON p.id = fm.person_id WHERE fm.family_id = ? AND fm.relationship = 'parent_one' AND fm.deleted_at IS NULL`).get(fid)?.n || `Family #${fid}`;

  // The year being registered for: ?year= / posted year when it is open (or staff), otherwise the current year.
  const yearOf = (req) => {
    const id = Number(req.query?.year || req.body?.year || 0);
    if (!id) return currentYear(db);
    const y = db.prepare('SELECT * FROM school_years WHERE id = ? AND deleted_at IS NULL').get(id);
    return y && (y.registration_open || staffCan(req, 'registrations.update')) ? y : null;    // null → that year is not open for this person
  };
  const notOpen = (req, res) => go(req, res, '', { type: 'warn', msg: 'Registration is not open yet. 註冊尚未開放。' });

  // ---------- step 1 ----------
  function step1(req, res, fid, values = {}, errors = {}, status = 200) {
    const year = yearOf(req);
    const kids = db.prepare(`SELECT p.* FROM family_members fm JOIN persons p ON p.id = fm.person_id WHERE fm.family_id = ? AND fm.relationship = 'child' AND fm.deleted_at IS NULL ORDER BY p.birth_date`).all(fid);
    const enr = new Map(db.prepare(`SELECT e.*, sc.code, sc.name_zh, sc.name_en FROM enrollments e LEFT JOIN school_classes sc ON sc.id = e.school_class_id WHERE e.school_year_id = ? AND e.deleted_at IS NULL AND e.status <> 'withdrawn'
      AND e.student_person_id IN (SELECT person_id FROM family_members WHERE family_id = ?)`).all(year.id, fid).map((e) => [e.student_person_id, e]));
    const paidIds = new Set(db.prepare(`SELECT ri.student_person_id AS id FROM registration_items ri JOIN registrations r ON r.id = ri.registration_id WHERE r.family_id = ? AND r.school_year_id = ? AND r.status IN ('submitted','paid') AND r.deleted_at IS NULL`).all(fid, year.id).map((r) => r.id));
    const already = kids.filter((k) => paidIds.has(k.id));
    const selectable = kids.filter((k) => !paidIds.has(k.id));
    const draft = db.prepare("SELECT * FROM registrations WHERE family_id = ? AND school_year_id = ? AND status = 'draft' AND deleted_at IS NULL ORDER BY id DESC").get(fid, year.id);
    const draftItems = draft ? new Map(db.prepare('SELECT * FROM registration_items WHERE registration_id = ?').all(draft.id).map((i) => [i.student_person_id, i])) : new Map();
    const preschoolEligible = db.prepare("SELECT 1 FROM enrollments e JOIN class_types ct ON ct.id = e.class_type_id WHERE e.school_year_id = ? AND ct.code = 'preschool' AND e.student_person_id IN (SELECT person_id FROM family_members WHERE family_id = ?)").get(year.id, fid) ? true : false;
    const jobs = db.prepare('SELECT * FROM volunteer_jobs WHERE active = 1 AND deleted_at IS NULL ORDER BY sort, id').all();
    const mine = db.prepare('SELECT * FROM volunteer_signups WHERE family_id = ? AND school_year_id = ? AND deleted_at IS NULL ORDER BY priority').all(fid, year.id);
    const types = db.prepare('SELECT * FROM class_types WHERE deleted_at IS NULL ORDER BY sort').all().filter((c) => c.code !== 'adult');
    // re-registration: what we know from last year, per child (class type, next grade, graduated?) and the volunteer choices
    const plan = new Map(selectable.map((k) => [k.id, suggestFor(db, k, year)]));
    const rereg = !draft && [...plan.values()].some((p) => p.hadPrevious);
    const prevJobs = rereg && !mine.length ? previousVolunteerJobs(db, fid, year) : [];
    const fam = db.prepare('SELECT f.*, a.street, a.city, a.state, a.zipcode FROM families f LEFT JOIN addresses a ON a.id = f.address_id WHERE f.id = ?').get(fid);
    page(req, res, 'register-1.ejs', {
      plan, rereg, prevJobs, fam, gl2: gradeNumber,
      fid, year, kids, already: already.map((k) => ({ ...k, enrollment: enr.get(k.id) })), selectable, draftItems, types, jobs, preschoolEligible, mine,
      values, errors, draft, faq: '/pdf/registration-notice-english', famName: famName(fid), classTypeOf: (id) => db.prepare('SELECT * FROM class_types WHERE id=?').get(id),
    }, { title: 'Registration', status });
  }
  app.get(`${R}/families/:id/register`, requireLogin, (req, res) => {
    const fid = Number(req.params.id);
    if (!mayRegister(req, fid)) return forbidden(req, res);
    const year = yearOf(req);
    if (!year || (!year.registration_open && !staffCan(req, 'registrations.update'))) return notOpen(req, res);
    step1(req, res, fid);
  });
  app.post(`${R}/families/:id/register`, requireLogin, csrfMiddleware, (req, res) => {
    const fid = Number(req.params.id);
    if (!mayRegister(req, fid)) return forbidden(req, res);
    const year = yearOf(req);
    if (!year) return notOpen(req, res);
    const selected = [].concat(req.body.student || []).map(Number).filter(Boolean);
    const errors = {};
    const items = [];
    for (const sid of selected) {
      const ok = db.prepare("SELECT 1 FROM family_members WHERE family_id = ? AND person_id = ? AND relationship = 'child'").get(fid, sid);
      if (!ok) continue;
      const birth = n2(req.body[`birth_${sid}`]); const ct = Number(req.body[`ctype_${sid}`] || 0);
      if (!birth) errors[`birth_${sid}`] = 'required'; if (!ct) errors[`ctype_${sid}`] = 'required';
      items.push({ studentId: sid, birth, classTypeId: ct });
    }
    if (!items.length) errors._form = 'Please check at least one student to register. 請勾選要註冊的學生。';
    const prio = [1, 2, 3].map((i) => Number(req.body[`job_${i}`] || 0) || null);
    const scripRaw = n2(req.body.scrip).replace(/[$,]/g, ''); const scrip = scripRaw ? Math.round(parseFloat(scripRaw) * 100) : 0;
    if (scripRaw && !(scrip >= 0)) errors.scrip = 'invalid amount';
    if (Object.keys(errors).length) return step1(req, res, fid, req.body, errors, 400);
    const uid = req.portal.user.id; const sy = startYear(year.label);
    db.exec('BEGIN');
    try {
      db.prepare("UPDATE registrations SET status = 'cancelled', updated_at = datetime('now') WHERE family_id = ? AND school_year_id = ? AND status = 'draft'").run(fid, year.id);
      const reg = db.prepare('INSERT INTO registrations (family_id, school_year_id, registered_by_user_id, status, scrip_purchase_cents, created_by, updated_by) VALUES (?,?,?,?,?,?,?)').run(fid, year.id, uid, 'draft', scrip, uid, uid);
      const rid = Number(reg.lastInsertRowid);
      for (const it of items) {
        db.prepare('UPDATE persons SET birth_date = ?, updated_at = datetime(\'now\'), updated_by = ? WHERE id = ?').run(it.birth, uid, it.studentId);
        const ct = db.prepare('SELECT * FROM class_types WHERE id = ?').get(it.classTypeId);
        const prev = db.prepare(`SELECT e.grade_label FROM enrollments e JOIN school_years y ON y.id = e.school_year_id WHERE e.student_person_id = ? AND y.label < ? AND e.deleted_at IS NULL ORDER BY y.label DESC LIMIT 1`).get(it.studentId, year.label);
        let g = gradeFromBirth(it.birth, sy);
        if (prev?.grade_label) { const m = prev.grade_label.match(/\((\d+)(?:st|nd|rd|th) Grade\)/); if (m) g = Number(m[1]) + 1; else if (/Kinder/i.test(prev.grade_label)) g = 1; }
        const label = ct.code === 'preschool' ? '學前 (Preschool)' : gradeLabel(g);
        db.prepare('INSERT INTO registration_items (registration_id, student_person_id, class_type_id, grade_label, birth_date_snapshot, created_by, updated_by) VALUES (?,?,?,?,?,?,?)').run(rid, it.studentId, it.classTypeId, label, it.birth, uid, uid);
      }
      // volunteer priorities (up to three) belong to the registering parent
      const parent = req.portal.person.id;
      db.prepare("UPDATE volunteer_signups SET deleted_at = datetime('now') WHERE family_id = ? AND school_year_id = ? AND deleted_at IS NULL AND status = 'requested'").run(fid, year.id);
      prio.forEach((jid, i) => { if (jid) db.prepare('INSERT INTO volunteer_signups (family_id, person_id, school_year_id, job_id, priority, created_by, updated_by) VALUES (?,?,?,?,?,?,?)').run(fid, parent, year.id, jid, i + 1, uid, uid); });
      const copied = copySchoolInfo(db, items.map((i) => i.studentId), year, uid);   // last year's regular-school info → this year (parent reviews it)
      audit(db, 'registrations', rid, 'draft_created', null, { students: items.length, schoolInfoCopied: copied }, uid, req.ip);
      db.exec('COMMIT');
      go(req, res, `/registrations/${rid}/waiver`);
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  });

  // ---------- step 2: waiver ----------
  app.get(`${R}/registrations/:id/waiver`, requireLogin, (req, res) => {
    const reg = regOf(req.params.id);
    if (!reg || !mayRegister(req, reg.family_id)) return forbidden(req, res);
    if (reg.status !== 'draft') return go(req, res, `/registrations/${reg.id}/form`);
    const year = db.prepare('SELECT * FROM school_years WHERE id = ?').get(reg.school_year_id);
    const young = db.prepare(`SELECT p.birth_date FROM registration_items ri JOIN persons p ON p.id = ri.student_person_id WHERE ri.registration_id = ?`).all(reg.id).some((r) => ageOn(r.birth_date, year.first_day) < 5);
    const docs = db.prepare('SELECT * FROM waiver_documents WHERE deleted_at IS NULL ORDER BY sort, id').all().filter((d) => !d.applies_under_age || young);
    page(req, res, 'register-2.ejs', { reg, docs, year }, { title: 'Registration — Waiver' });
  });
  app.post(`${R}/registrations/:id/waiver`, requireLogin, csrfMiddleware, (req, res) => {
    const reg = regOf(req.params.id);
    if (!reg || !mayRegister(req, reg.family_id)) return forbidden(req, res);
    if (!req.body.agree) return go(req, res, `/registrations/${reg.id}/waiver`, { type: 'warn', msg: 'Please tick the agreement box. 請勾選同意。' });
    const uid = req.portal.user.id;
    const year = db.prepare('SELECT * FROM school_years WHERE id = ?').get(reg.school_year_id);
    const young = db.prepare(`SELECT p.birth_date FROM registration_items ri JOIN persons p ON p.id = ri.student_person_id WHERE ri.registration_id = ?`).all(reg.id).some((r) => ageOn(r.birth_date, year.first_day) < 5);
    for (const d of db.prepare('SELECT * FROM waiver_documents WHERE deleted_at IS NULL').all().filter((x) => !x.applies_under_age || young))
      db.prepare('INSERT INTO waiver_acceptances (person_id, family_id, registration_id, waiver_document_id, ip, created_by, updated_by) VALUES (?,?,?,?,?,?,?)').run(req.portal.person.id, reg.family_id, reg.id, d.id, req.ip || '', uid, uid);
    db.prepare("UPDATE registrations SET waiver_accepted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(reg.id);
    go(req, res, `/registrations/${reg.id}/form`);
  });

  // ---------- step 3: fee form ----------
  function price(reg) {
    const items = db.prepare(`SELECT ri.*, p.birth_date, p.english_last_name, p.english_first_name, p.chinese_name FROM registration_items ri JOIN persons p ON p.id = ri.student_person_id WHERE ri.registration_id = ? ORDER BY p.birth_date`).all(reg.id);
    const calc = computeRegistration(db, { yearId: reg.school_year_id, familyId: reg.family_id, registrationId: reg.id, scripPurchaseCents: reg.scrip_purchase_cents,
      items: items.map((i) => ({ studentId: i.student_person_id, classTypeId: i.class_type_id, gradeLabel: i.grade_label, birthDate: i.birth_date })) });
    return { items, calc };
  }
  // Submitted / paid / cancelled registrations show the amounts stored at submission time (never re-priced).
  function storedCalc(reg) {
    const year = db.prepare('SELECT * FROM school_years WHERE id = ?').get(reg.school_year_id);
    const items = db.prepare(`SELECT ri.*, p.birth_date, p.english_last_name, p.english_first_name, p.chinese_name FROM registration_items ri JOIN persons p ON p.id = ri.student_person_id WHERE ri.registration_id = ? ORDER BY p.birth_date`).all(reg.id);
    const calc = {
      year, items: items.map((i) => ({ studentId: i.student_person_id, classTypeId: i.class_type_id, gradeLabel: i.grade_label, birthDate: i.birth_date,
        registrationFee: i.registration_fee_cents, earlyRegDiscount: i.early_reg_discount_cents, registrationNet: i.registration_fee_cents - i.early_reg_discount_cents,
        tuition: i.tuition_cents, misc: i.misc_fee_cents, siblingDiscount: i.sibling_discount_cents, facultyDiscountPending: 0,
        subtotal: i.registration_fee_cents - i.early_reg_discount_cents + i.tuition_cents + i.misc_fee_cents - i.sibling_discount_cents })),
      serviceFee: reg.service_fee_cents, scripDeposit: reg.scrip_deposit_cents, scripPurchase: reg.scrip_purchase_cents, grand: reg.grand_total_cents,
    };
    return { items, calc };
  }
  const regView = (req, res, reg, print = false) => {
    const { items, calc } = reg.status === 'draft' ? price(reg) : storedCalc(reg);
    const types = new Map(db.prepare('SELECT * FROM class_types').all().map((c) => [c.id, c]));
    const rows = calc.items.map((r) => ({ ...r, who: items.find((i) => i.student_person_id === r.studentId), ct: types.get(r.classTypeId) }));
    const school = db.prepare('SELECT * FROM schools LIMIT 1').get();
    const payments = db.prepare(`SELECT t.*, pm.name_en AS method FROM transactions t JOIN payment_methods pm ON pm.id = t.payment_method_id WHERE t.registration_id = ? AND t.voided_at IS NULL AND t.deleted_at IS NULL ORDER BY t.transaction_date`).all(reg.id);
    page(req, res, print ? 'register-print.ejs' : 'register-3.ejs', { reg, calc, rows, school, payments, parent: famName(reg.family_id), year: calc.year,
      staffView: staffCan(req, 'registrations.view') && !ownsFamily(db, req.portal.person.id, reg.family_id), canPay: can(req.portal.access, 'finance.record_payment') }, { title: 'Registration form', shell: print ? 'bare' : undefined });
  };
  app.get(`${R}/registrations/:id/form`, requireLogin, (req, res) => {
    const reg = regOf(req.params.id);
    if (!reg || !mayView(req, reg.family_id)) return forbidden(req, res);
    if (reg.status === 'draft') {
      if (!reg.waiver_accepted_at) return go(req, res, `/registrations/${reg.id}/waiver`);
      // lock in the prices and submit (payment is still due)
      const { items, calc } = price(reg); const uid = req.portal.user.id;
      db.exec('BEGIN');
      try {
        for (const r of calc.items) db.prepare('UPDATE registration_items SET registration_fee_cents=?, early_reg_discount_cents=?, tuition_cents=?, misc_fee_cents=?, sibling_discount_cents=?, updated_at=datetime(\'now\') WHERE registration_id=? AND student_person_id=?')
          .run(r.registrationFee, r.earlyRegDiscount, r.tuition, r.misc, r.siblingDiscount, reg.id, r.studentId);
        db.prepare("UPDATE registrations SET status='submitted', service_fee_cents=?, scrip_deposit_cents=?, subtotal_cents=?, grand_total_cents=?, submitted_at=datetime('now'), updated_at=datetime('now'), updated_by=? WHERE id=?")
          .run(calc.serviceFee, calc.scripDeposit, calc.grand - calc.serviceFee - calc.scripDeposit - calc.scripPurchase, calc.grand, uid, reg.id);
        for (const it of items) {
          const ex = db.prepare('SELECT id FROM enrollments WHERE student_person_id = ? AND school_year_id = ? AND deleted_at IS NULL').get(it.student_person_id, reg.school_year_id);
          if (ex) db.prepare("UPDATE enrollments SET class_type_id=?, grade_label=?, registration_id=?, status=CASE WHEN status='withdrawn' THEN 'pending' ELSE status END, updated_at=datetime('now'), updated_by=? WHERE id=?").run(it.class_type_id, it.grade_label, reg.id, uid, ex.id);
          else db.prepare("INSERT INTO enrollments (student_person_id, school_year_id, class_type_id, grade_label, status, registration_id, student_type_id, created_by, updated_by) VALUES (?,?,?,?,'pending',?,(SELECT id FROM student_types WHERE code = ?),?,?)")
            .run(it.student_person_id, reg.school_year_id, it.class_type_id, it.grade_label,  reg.id, db.prepare("SELECT 1 FROM enrollments e JOIN school_years y ON y.id = e.school_year_id WHERE e.student_person_id = ? AND e.deleted_at IS NULL AND e.status <> 'pending'").get(it.student_person_id) ? 'returning' : 'new', uid, uid);
        }
        audit(db, 'registrations', reg.id, 'submitted', null, { total: calc.grand }, uid, req.ip);
        const fam = db.prepare('SELECT email FROM families WHERE id = ?').get(reg.family_id);
        queueEmail(db, { to: fam?.email, template: 'registration_received', subject: 'San Diego Chinese Academy - Registration received 已收到註冊', body: `Total due ${money(calc.grand)}. Please submit the printed form with your check or cash. 請附上列印的註冊表與支票或現金。`, relatedType: 'registrations', relatedId: reg.id });
        db.exec('COMMIT');
      } catch (e) { db.exec('ROLLBACK'); throw e; }
      return regView(req, res, regOf(reg.id));
    }
    regView(req, res, reg);
  });
  app.get(`${R}/registrations/:id/print`, requireLogin, (req, res) => {
    const reg = regOf(req.params.id);
    if (!reg || !mayView(req, reg.family_id)) return forbidden(req, res);
    db.prepare("UPDATE registrations SET form_printed_at = datetime('now') WHERE id = ?").run(reg.id);
    regView(req, res, reg, true);
  });
  app.get(`${R}/registrations/:id`, requireLogin, (req, res) => res.redirect(`/${lang(req)}/portal/registrations/${req.params.id}/form`));
  app.post(`${R}/registrations/:id/cancel`, requireLogin, csrfMiddleware, (req, res) => {
    const reg = regOf(req.params.id);
    if (!reg || !mayRegister(req, reg.family_id)) return forbidden(req, res);
    if (reg.status === 'paid') return go(req, res, `/registrations/${reg.id}/form`, { type: 'warn', msg: 'A paid registration cannot be cancelled online; please contact the office. 已付款的註冊請洽辦公室。' });
    db.exec('BEGIN');
    db.prepare("UPDATE registrations SET status='cancelled', updated_at=datetime('now'), updated_by=? WHERE id=?").run(req.portal.user.id, reg.id);
    db.prepare("DELETE FROM enrollments WHERE registration_id = ? AND status = 'pending' AND school_class_id IS NULL").run(reg.id);
    db.exec('COMMIT');
    audit(db, 'registrations', reg.id, 'cancelled', null, null, req.portal.user.id, req.ip);
    go(req, res, '', { type: 'ok', msg: 'Registration cancelled. 註冊已取消。' });
  });
}
