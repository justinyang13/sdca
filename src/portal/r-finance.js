// src/portal/r-finance.js — transaction history & receipts (parents), payment entry / manual transactions / void / withdrawal (staff).
import { csrfMiddleware } from '../middleware/csrf.js';
import { can } from './perm.js';
import { currentYear, money, withdrawalFee } from './fees.js';
import { ownsFamily, queueEmail } from './auth.js';
import { audit, refOptions } from './crud.js';
import { paidSql, registrationPaid } from './money.js';
import { s, dollars, today, portalHelpers } from './util.js';


export function registerFinanceRoutes(app, { db, page, requireLogin }) {
  const { lang, go, forbidden, staffCan } = portalHelpers(page);
  const R = '/:lang/portal';
  const famName = (fid) => db.prepare(`SELECT p.english_last_name || ' ' || p.english_first_name || ' ' || p.chinese_name AS n FROM family_members fm JOIN persons p ON p.id = fm.person_id WHERE fm.family_id = ? AND fm.relationship = 'parent_one' AND fm.deleted_at IS NULL`).get(fid)?.n || `Family #${fid}`;
  const txOf = (id) => db.prepare(`SELECT t.*, tt.name_en AS type_en, tt.name_zh AS type_zh, tt.is_registration, pm.name_en AS method_en, pm.name_zh AS method_zh,
    (SELECT p.english_first_name || ' ' || p.english_last_name || ' ' || p.chinese_name FROM persons p WHERE p.id = t.executed_by_person_id) AS executed_by,
    (SELECT u.username FROM users u WHERE u.id = t.recorded_by_user_id) AS recorded_by, y.label AS year_label
    FROM transactions t JOIN transaction_types tt ON tt.id = t.transaction_type_id JOIN payment_methods pm ON pm.id = t.payment_method_id LEFT JOIN school_years y ON y.id = t.school_year_id WHERE t.id = ? AND t.deleted_at IS NULL`).get(Number(id));
  const mayViewTx = (req, tx) => staffCan(req, 'transactions.view') || (can(req.portal.access, 'transactions.own') && ownsFamily(db, req.portal.person.id, tx.family_id));

  // ---------- parent: transaction history ----------
  app.get(`${R}/transactions`, requireLogin, (req, res) => {
    const fams = req.portal.familyIds.length ? req.portal.familyIds : [];
    if (!can(req.portal.access, 'transactions.own') || !fams.length) return forbidden(req, res);
    const q = `SELECT t.id, t.transaction_date, t.amount_cents, t.voided_at, tt.name_en AS type_en, tt.name_zh AS type_zh, tt.is_registration FROM transactions t JOIN transaction_types tt ON tt.id = t.transaction_type_id
      WHERE t.family_id IN (${fams.map(() => '?').join(',')}) AND t.deleted_at IS NULL ORDER BY t.transaction_date DESC, t.id DESC`;
    const all = db.prepare(q).all(...fams);
    page(req, res, 'transactions.ejs', { registrations: all.filter((t) => t.is_registration), others: all.filter((t) => !t.is_registration) }, { title: 'Transaction History' });
  });
  app.get(`${R}/transactions/:id`, requireLogin, (req, res) => {
    const tx = txOf(req.params.id);
    if (!tx || !mayViewTx(req, tx)) return forbidden(req, res);
    const lines = db.prepare('SELECT * FROM transaction_lines WHERE transaction_id = ? AND deleted_at IS NULL').all(tx.id);
    const reg = tx.registration_id ? db.prepare('SELECT * FROM registrations WHERE id = ?').get(tx.registration_id) : null;
    page(req, res, 'transaction.ejs', { tx, lines, reg, canVoid: staffCan(req, 'finance.void') && !tx.voided_at, famName: famName(tx.family_id) }, { title: 'Transaction' });
  });
  // printable receipt (registration payment)
  app.get(`${R}/transactions/:id/receipt`, requireLogin, (req, res) => {
    const tx = txOf(req.params.id);
    if (!tx || !mayViewTx(req, tx)) return forbidden(req, res);
    const reg = tx.registration_id ? db.prepare('SELECT * FROM registrations WHERE id = ?').get(tx.registration_id) : null;
    const items = reg ? db.prepare(`SELECT ri.*, p.english_first_name, p.english_last_name, p.chinese_name, ct.name_en AS ct_en, ct.name_zh AS ct_zh FROM registration_items ri JOIN persons p ON p.id = ri.student_person_id JOIN class_types ct ON ct.id = ri.class_type_id WHERE ri.registration_id = ?`).all(reg.id) : [];
    const school = db.prepare('SELECT * FROM schools LIMIT 1').get();
    page(req, res, 'receipt.ejs', { tx, reg, items, school, parent: famName(tx.family_id) }, { title: 'Registration Receipt', shell: 'bare' });
  });
  app.post(`${R}/transactions/:id/void`, requireLogin, csrfMiddleware, (req, res) => {
    if (!staffCan(req, 'finance.void')) return forbidden(req, res);
    const tx = txOf(req.params.id);
    if (!tx || tx.voided_at) return go(req, res, '/manage/transactions');
    const uid = req.portal.user.id;
    db.exec('BEGIN');
    db.prepare("UPDATE transactions SET voided_at = datetime('now'), voided_by = ?, void_reason = ?, updated_at = datetime('now'), updated_by = ? WHERE id = ?").run(uid, s(req.body.reason), uid, tx.id);
    if (tx.registration_id) {
      const paid = registrationPaid(db, tx.registration_id);
      const reg = db.prepare('SELECT * FROM registrations WHERE id = ?').get(tx.registration_id);
      if (reg && paid < reg.grand_total_cents && reg.status === 'paid') {
        db.prepare("UPDATE registrations SET status = 'submitted', paid_at = NULL WHERE id = ?").run(reg.id);
        db.prepare("UPDATE enrollments SET status = 'pending' WHERE registration_id = ? AND status = 'registered' AND school_class_id IS NULL").run(reg.id);
      }
    }
    audit(db, 'transactions', tx.id, 'void', null, { reason: s(req.body.reason) }, uid, req.ip);
    db.exec('COMMIT');
    go(req, res, `/transactions/${tx.id}`, { type: 'ok', msg: 'Transaction voided. 交易已作廢。' });
  });

  // ---------- staff: enter a registration payment ----------
  const methods = () => db.prepare('SELECT * FROM payment_methods WHERE active = 1 AND deleted_at IS NULL ORDER BY id').all();
  app.get(`${R}/finance/payment`, requireLogin, (req, res) => {
    if (!staffCan(req, 'finance.record_payment')) return forbidden(req, res);
    const year = currentYear(db);
    const pending = db.prepare(`SELECT r.id, r.family_id, r.status, r.grand_total_cents, ${paidSql('r')} AS paid,
      (SELECT p.english_last_name || ' ' || p.english_first_name || ' ' || p.chinese_name FROM family_members fm JOIN persons p ON p.id = fm.person_id WHERE fm.family_id = r.family_id AND fm.relationship = 'parent_one' LIMIT 1) AS parent
      FROM registrations r WHERE r.school_year_id = ? AND r.status = 'submitted' AND r.deleted_at IS NULL ORDER BY r.submitted_at`).all(year.id);
    const chosen = Number(req.query.registration || 0) || (req.query.family ? pending.find((r) => r.family_id === Number(req.query.family))?.id : 0) || 0;
    const reg = pending.find((r) => r.id === chosen);
    page(req, res, 'payment-form.ejs', { pending, chosen, reg, methods: methods(), v: { transaction_date: today(), amount: reg ? ((reg.grand_total_cents - reg.paid) / 100).toFixed(2) : '' }, errors: {} }, { title: 'Enter Registration Payment' });
  });
  app.post(`${R}/finance/payment`, requireLogin, csrfMiddleware, (req, res) => {
    if (!staffCan(req, 'finance.record_payment')) return forbidden(req, res);
    const reg = db.prepare('SELECT * FROM registrations WHERE id = ? AND deleted_at IS NULL').get(Number(req.body.registration));
    const errors = {}; const cents = dollars(req.body.amount);
    const m = db.prepare('SELECT * FROM payment_methods WHERE id = ?').get(Number(req.body.payment_method_id));
    if (!reg) errors.registration = 'required';
    if (!m) errors.payment_method_id = 'required';
    if (!(cents > 0)) errors.amount = 'enter a positive amount';
    if (m?.needs_check_number && !s(req.body.check_number)) errors.check_number = 'required for checks';
    const year = currentYear(db);
    if (Object.keys(errors).length) {
      const pending = db.prepare("SELECT r.id, r.family_id, r.status, r.grand_total_cents, 0 AS paid, '' AS parent FROM registrations r WHERE r.school_year_id = ? AND r.status = 'submitted' AND r.deleted_at IS NULL").all(year.id);
      return page(req, res, 'payment-form.ejs', { pending, chosen: reg?.id || 0, reg, methods: methods(), v: req.body, errors }, { title: 'Enter Registration Payment', status: 400 });
    }
    const uid = req.portal.user.id;
    db.exec('BEGIN');
    try {
      const type = db.prepare("SELECT id FROM transaction_types WHERE code = 'registration'").get().id;
      const date = s(req.body.transaction_date) || today();
      const t = db.prepare(`INSERT INTO transactions (family_id, registration_id, school_year_id, transaction_type_id, transaction_date, payment_method_id, check_number, amount_cents, note, recorded_by_user_id, created_by, updated_by)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(reg.family_id, reg.id, reg.school_year_id, type, date, m.id, s(req.body.check_number), cents, s(req.body.note), uid, uid, uid);
      const paid = registrationPaid(db, reg.id);
      if (paid >= reg.grand_total_cents) {
        db.prepare("UPDATE registrations SET status = 'paid', paid_at = datetime('now'), updated_at = datetime('now'), updated_by = ? WHERE id = ?").run(uid, reg.id);
        db.prepare("UPDATE enrollments SET status = CASE WHEN school_class_id IS NULL THEN 'registered' ELSE 'placed' END, updated_at = datetime('now') WHERE registration_id = ? AND status = 'pending'").run(reg.id);
      }
      const fam = db.prepare('SELECT email FROM families WHERE id = ?').get(reg.family_id);
      queueEmail(db, { to: fam?.email, template: 'payment_received', subject: 'San Diego Chinese Academy - Payment received 已收到付款', body: `We received ${money(cents)}. You can print the receipt from Transaction History. 您可在「付款紀錄」列印收據。`, relatedType: 'transactions', relatedId: Number(t.lastInsertRowid) });
      audit(db, 'transactions', Number(t.lastInsertRowid), 'registration_payment', null, { amount: cents, registration: reg.id }, uid, req.ip);
      db.exec('COMMIT');
      go(req, res, `/transactions/${Number(t.lastInsertRowid)}`, { type: 'ok', msg: `Payment of ${money(cents)} recorded. 已記錄付款。` });
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  });

  // ---------- staff: manual transaction (scrip purchase / redeem / refund, service refund, adjustments) ----------
  const manualForm = (req, res, v, errors = {}, status = 200) => {
    const fid = Number(v.family_id || req.query.family || 0) || null;
    const members = fid ? db.prepare(`SELECT p.id, p.english_first_name, p.english_last_name, p.chinese_name, fm.relationship FROM family_members fm JOIN persons p ON p.id = fm.person_id WHERE fm.family_id = ? AND fm.deleted_at IS NULL ORDER BY fm.relationship, p.birth_date`).all(fid) : [];
    page(req, res, 'manual-form.ejs', {
      v: { transaction_date: today(), ...v, family_id: fid || '' }, errors, members, famName: fid ? famName(fid) : '',
      types: db.prepare('SELECT * FROM transaction_types WHERE deleted_at IS NULL ORDER BY id').all().filter((t) => !scripOnly(req) || /^scrip_/.test(t.code)), methods: methods(),
      products: db.prepare('SELECT * FROM scrip_products WHERE active = 1 AND deleted_at IS NULL ORDER BY vendor, denomination_cents').all(),
      families: fid ? [] : refOptions(db, 'families', { limit: 60 }),
    }, { title: 'New Manual Transaction', status });
  };
  const scripOnly = (req) => !staffCan(req, 'finance.record_payment') && staffCan(req, 'finance.record_scrip');
  app.get(`${R}/finance/manual/new`, requireLogin, (req, res) => { if (!staffCan(req, 'finance.record_payment') && !staffCan(req, 'finance.record_scrip')) return forbidden(req, res); manualForm(req, res, { person_id: req.query.person || '' }); });
  app.post(`${R}/finance/manual/new`, requireLogin, csrfMiddleware, (req, res) => {
    if (!staffCan(req, 'finance.record_payment') && !staffCan(req, 'finance.record_scrip')) return forbidden(req, res);
    const b = req.body; const errors = {};
    const fid = Number(b.family_id) || null;
    const type = db.prepare('SELECT * FROM transaction_types WHERE id = ?').get(Number(b.transaction_type_id));
    if (type && scripOnly(req) && !/^scrip_/.test(type.code)) return forbidden(req, res);   // the Scrip Director records scrip purchases / redemptions only
    const m = db.prepare('SELECT * FROM payment_methods WHERE id = ?').get(Number(b.payment_method_id));
    if (!fid) errors.family_id = 'required'; if (!type) errors.transaction_type_id = 'required'; if (!m) errors.payment_method_id = 'required'; if (!s(b.transaction_date)) errors.transaction_date = 'required';
    // scrip lines: product_i + qty_i
    const lines = [];
    for (let i = 0; i < 8; i++) {
      const pid = Number(b[`product_${i}`] || 0); const q = Number(b[`qty_${i}`] || 0);
      if (pid && q > 0) { const p = db.prepare('SELECT * FROM scrip_products WHERE id = ?').get(pid); if (p) lines.push({ p, q }); }
    }
    let cents = dollars(b.amount);
    if (lines.length) cents = lines.reduce((sum, l) => sum + l.p.denomination_cents * l.q, 0);
    if (!(cents > 0)) errors.amount = 'enter an amount (or scrip cards)';
    if (m?.needs_check_number && !s(b.check_number)) errors.check_number = 'required for checks';
    if (Object.keys(errors).length) return manualForm(req, res, b, errors, 400);
    const uid = req.portal.user.id;
    db.exec('BEGIN');
    try {
      const year = currentYear(db);
      const t = db.prepare(`INSERT INTO transactions (family_id, person_id, school_year_id, transaction_type_id, transaction_date, payment_method_id, check_number, amount_cents, note, executed_by_person_id, recorded_by_user_id, created_by, updated_by)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(fid, Number(b.person_id) || null, year?.id || null, type.id, s(b.transaction_date), m.id, s(b.check_number), cents, s(b.note), Number(b.executed_by_person_id) || null, uid, uid, uid);
      const tid = Number(t.lastInsertRowid);
      for (const l of lines) db.prepare('INSERT INTO transaction_lines (transaction_id, description, scrip_product_id, quantity, unit_cents, amount_cents, created_by, updated_by) VALUES (?,?,?,?,?,?,?,?)')
        .run(tid, `${l.p.name} (${money(l.p.denomination_cents)})`, l.p.id, l.q, l.p.denomination_cents, l.p.denomination_cents * l.q, uid, uid);
      audit(db, 'transactions', tid, 'manual_transaction', null, { type: type.code, amount: cents }, uid, req.ip);
      db.exec('COMMIT');
      go(req, res, `/transactions/${tid}`, { type: 'ok', msg: 'Transaction recorded. 已記錄交易。' });
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  });

  // ---------- staff: withdraw a student (fee by rule, refund transaction) ----------
  app.get(`${R}/enrollments/:id/withdraw`, requireLogin, (req, res) => {
    if (!staffCan(req, 'withdrawal.process')) return forbidden(req, res);
    const en = db.prepare(`SELECT e.*, p.english_first_name, p.english_last_name, p.chinese_name FROM enrollments e JOIN persons p ON p.id = e.student_person_id WHERE e.id = ? AND e.deleted_at IS NULL`).get(Number(req.params.id));
    if (!en) return go(req, res, '/manage/enrollments');
    const applied = today();
    const fee = withdrawalFee(db, en.school_year_id, applied);
    const item = en.registration_id ? db.prepare('SELECT * FROM registration_items WHERE registration_id = ? AND student_person_id = ?').get(en.registration_id, en.student_person_id) : null;
    const paidItem = item ? item.registration_fee_cents - item.early_reg_discount_cents + item.tuition_cents + item.misc_fee_cents - item.sibling_discount_cents : 0;
    page(req, res, 'withdraw-form.ejs', { en, applied, fee, paidItem, v: {}, rules: db.prepare('SELECT * FROM withdrawal_fee_rules WHERE school_year_id = ? AND deleted_at IS NULL ORDER BY sort').all(en.school_year_id) }, { title: 'Withdraw student' });
  });
  app.post(`${R}/enrollments/:id/withdraw`, requireLogin, csrfMiddleware, (req, res) => {
    if (!staffCan(req, 'withdrawal.process')) return forbidden(req, res);
    const en = db.prepare('SELECT * FROM enrollments WHERE id = ? AND deleted_at IS NULL').get(Number(req.params.id));
    if (!en) return go(req, res, '/manage/enrollments');
    const uid = req.portal.user.id; const applied = s(req.body.applied_on) || today();
    const feeC = dollars(req.body.fee) ?? 0; const refundC = Math.max(0, dollars(req.body.refund) ?? 0);
    db.exec('BEGIN');
    try {
      db.prepare('INSERT INTO withdrawals (enrollment_id, applied_on, processing_fee_cents, refund_cents, status, reason, created_by, updated_by) VALUES (?,?,?,?,?,?,?,?)').run(en.id, applied, feeC, refundC, 'processed', s(req.body.reason), uid, uid);
      db.prepare("UPDATE enrollments SET status = 'withdrawn', withdrawn_at = datetime('now'), withdrawal_reason = ?, updated_at = datetime('now'), updated_by = ? WHERE id = ?").run(s(req.body.reason), uid, en.id);
      if (refundC > 0 && en.registration_id) {
        const reg = db.prepare('SELECT family_id FROM registrations WHERE id = ?').get(en.registration_id);
        const type = db.prepare("SELECT id FROM transaction_types WHERE code = 'withdrawal'").get()?.id;
        const meth = db.prepare("SELECT id FROM payment_methods WHERE code = 'check'").get()?.id;
        if (type && meth) db.prepare('INSERT INTO transactions (family_id, person_id, registration_id, school_year_id, transaction_type_id, transaction_date, payment_method_id, amount_cents, note, recorded_by_user_id, created_by, updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
          .run(reg.family_id, en.student_person_id, en.registration_id, en.school_year_id, type, applied, meth, refundC, `Withdrawal refund (fee ${money(feeC)})`, uid, uid, uid);
      }
      audit(db, 'enrollments', en.id, 'withdrawn', null, { fee: feeC, refund: refundC }, uid, req.ip);
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    go(req, res, '/manage/enrollments', { type: 'ok', msg: 'Student withdrawn. 已辦理退學。' });
  });
}
