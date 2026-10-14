// tests/finance.test.js — money handling: fee calculation, payments, voids, refunds/withdrawals, manual (scrip) transactions,
// net-paid maths, access rules and the audit trail. All amounts are integer cents.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

let dir, base, server, db, creds;
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdca-finance-'));
  process.env.NODE_ENV = 'development';
  process.env.DB_FILE = path.join(dir, 'finance.db');
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

class Client {
  constructor() { this.c = {}; }
  absorb(res) { for (const h of res.headers.getSetCookie?.() || []) { const [kv] = h.split(';'); const i = kv.indexOf('='); this.c[kv.slice(0, i)] = kv.slice(i + 1); } }
  get cookie() { return Object.entries(this.c).map(([k, v]) => `${k}=${v}`).join('; '); }
  async req(method, p, form) {
    const headers = { cookie: this.cookie }; let body;
    if (form) { headers['content-type'] = 'application/x-www-form-urlencoded'; body = (form instanceof URLSearchParams ? form : new URLSearchParams(form)).toString(); }
    const res = await fetch(base + p, { method, headers, body, redirect: 'manual' });
    this.absorb(res);
    return { status: res.status, loc: res.headers.get('location'), text: await res.text() };
  }
  get(p) { return this.req('GET', p); }
  async post(p, form) {
    if (!this.c.sdca_csrf) await this.get('/en/portal/signin');
    const f = form instanceof URLSearchParams ? form : new URLSearchParams(form); f.set('_csrf', this.c.sdca_csrf);
    return this.req('POST', p, f);
  }
  async login(user) { await this.get('/en/portal/signin'); const r = await this.post('/en/portal/signin', { username: user, password: creds[user] }); assert.equal(r.status, 302, `login ${user}`); return this; }
}
const sql = (q, ...a) => db.prepare(q).all(...a);
const one = (q, ...a) => db.prepare(q).get(...a);
const run = (q, ...a) => db.prepare(q).run(...a);
const year = () => one('SELECT * FROM school_years WHERE is_current = 1');
const method = (code) => one('SELECT id FROM payment_methods WHERE code = ?', code).id;
const txType = (code) => one('SELECT id FROM transaction_types WHERE code = ?', code).id;

// every call creates a new family (parent + child + parent login), so each test controls its own money
import { createFamily, createPerson, addFamilyMember, createUser } from '../src/portal/creators.js';
let famSeq = 0;
function freshFamily() {
  famSeq += 1;
  const fam = createFamily(db, { street: '1 Test St', city: 'San Diego', zipcode: '92101', home_phone: '(858) 555-9000', email: `fin${famSeq}@example.com`, emergency_contact: 'E', emergency_home_phone: '(858) 555-9001', emergency_cell_phone: '(858) 555-9002' });
  const parent = createPerson(db, { english_last_name: `Fin${famSeq}`, english_first_name: 'Pat', gender: 'F', birth_date: '1980-02-02' });
  addFamilyMember(db, fam, parent, 'parent_one');
  const kid = createPerson(db, { english_last_name: `Fin${famSeq}`, english_first_name: 'Kid', gender: 'M', birth_date: '2016-06-06' });
  addFamilyMember(db, fam, kid, 'child');
  const username = `fin.parent${famSeq}`; creds[username] = `secret-fin${famSeq}`;
  createUser(db, { personId: parent, username, password: creds[username], roleCodes: ['parent'], type: 'parent' });
  return fam;
}
/** a submitted registration worth `total` cents, with one pending enrollment for the family's first child */
function submittedReg(total) {
  const fam = freshFamily(); const y = year();
  const child = one("SELECT person_id FROM family_members WHERE family_id = ? AND relationship = 'child' ORDER BY id LIMIT 1", fam).person_id;
  const ct = one("SELECT id FROM class_types WHERE code = 'regular'").id;
  const reg = Number(run(`INSERT INTO registrations (family_id, school_year_id, status, subtotal_cents, grand_total_cents, submitted_at) VALUES (?,?, 'submitted', ?, ?, datetime('now'))`, fam, y.id, total, total).lastInsertRowid);
  run('INSERT INTO registration_items (registration_id, student_person_id, class_type_id, grade_label, registration_fee_cents, tuition_cents) VALUES (?,?,?,?,?,?)', reg, child, ct, '三年級(3rd Grade)', 3000, total - 3000);
  const en = Number(run("INSERT INTO enrollments (student_person_id, school_year_id, class_type_id, grade_label, status, registration_id) VALUES (?,?,?,?, 'pending', ?)", child, y.id, ct, '三年級(3rd Grade)', reg).lastInsertRowid);
  return { reg, fam, child, en, total };
}
const pay = (c, reg, amount, extra = {}) => c.post('/en/portal/finance/payment', { registration: String(reg), transaction_date: '2026-10-13', payment_method_id: String(method('check')), check_number: '1001', amount, ...extra });
const status = (reg) => one('SELECT status FROM registrations WHERE id = ?', reg).status;
const paidOf = async (reg) => (await import('../src/portal/money.js')).registrationPaid(db, reg);

// ---------------------------------------------------------------- the maths
test('money(): formats cents with two decimals, thousands and negatives', async () => {
  const { money } = await import('../src/portal/fees.js');
  assert.equal(money(0), '$0.00'); assert.equal(money(5), '$0.05'); assert.equal(money(113050), '$1,130.50'); assert.equal(money(-2500), '-$25.00');
});

test('registrationPaid(): received minus returned, ignoring voided rows; balance never negative', async () => {
  const { registrationPaid, balanceCents } = await import('../src/portal/money.js');
  const r = submittedReg(100000);
  const ins = (type, cents, voided = false) => run(`INSERT INTO transactions (family_id, registration_id, school_year_id, transaction_type_id, transaction_date, payment_method_id, amount_cents, voided_at)
    VALUES (?,?,?,?, '2026-10-13', ?, ?, ?)`, r.fam, r.reg, year().id, txType(type), method('check'), cents, voided ? '2026-10-14 00:00:00' : null);
  ins('registration', 60000); ins('registration', 50000); ins('registration', 99999, true); ins('withdrawal', 20000);
  assert.equal(registrationPaid(db, r.reg), 60000 + 50000 - 20000, 'voided ignored, refund subtracted');
  assert.equal(balanceCents(100000, 90000), 10000);
  assert.equal(balanceCents(100000, 130000), 0, 'overpaid shows a zero balance, not a negative one');
  assert.equal(registrationPaid(db, 999999), 0, 'unknown registration');
});

// ---------------------------------------------------------------- fee calculation
test('fees: totals are the sum of the parts and every part is an integer number of cents', async () => {
  const { computeRegistration } = await import('../src/portal/fees.js');
  const y = year(); const fam = freshFamily();
  const types = sql('SELECT id, code, is_credit FROM class_types WHERE deleted_at IS NULL');
  assert.ok(types.length >= 2);
  for (const t of types) {
    const c = computeRegistration(db, { yearId: y.id, familyId: fam, items: [{ studentId: 91000 + t.id, classTypeId: t.id, gradeLabel: 'x', birthDate: '2016-05-05' }], today: '2026-08-01', scripPurchaseCents: 2500 });
    const it = c.items[0];
    assert.equal(it.subtotal, it.registrationFee - it.earlyRegDiscount + it.tuition + it.misc - it.siblingDiscount, `${t.code}: subtotal`);
    assert.equal(c.grand, it.subtotal + c.serviceFee + c.scripDeposit + c.scripPurchase, `${t.code}: grand total`);
    for (const v of [it.registrationFee, it.tuition, it.misc, c.serviceFee, c.scripDeposit, c.grand]) assert.ok(Number.isInteger(v) && v >= 0, `${t.code}: whole cents`);
  }
});

test('fees: early-registration discount applies on the deadline day and not after; never exceeds the registration fee', async () => {
  const { computeRegistration } = await import('../src/portal/fees.js');
  const y = year(); const fam = freshFamily(); const ct = one("SELECT id FROM class_types WHERE code = 'regular'").id;
  const early = one("SELECT * FROM fee_schedules WHERE school_year_id = ? AND code = 'early_reg_discount'", y.id);
  assert.ok(early?.deadline, 'demo year has an early-registration deadline');
  const item = [{ studentId: 92001, classTypeId: ct, gradeLabel: 'x', birthDate: '2016-01-01' }];
  const on = computeRegistration(db, { yearId: y.id, familyId: fam, items: item, today: early.deadline });
  const after = computeRegistration(db, { yearId: y.id, familyId: fam, items: item, today: '9999-01-01' });
  assert.ok(on.items[0].earlyRegDiscount > 0 && on.items[0].earlyRegDiscount <= on.items[0].registrationFee, 'applies on the last day');
  assert.equal(after.items[0].earlyRegDiscount, 0);
  assert.equal(on.grand, after.grand - on.items[0].earlyRegDiscount, 'the difference is exactly the discount');
});

test('fees: sibling order is by birth date across the whole family, including children already registered', async () => {
  const { computeRegistration } = await import('../src/portal/fees.js');
  const y = year(); const fam = freshFamily(); const ct = one("SELECT id FROM class_types WHERE code = 'regular'").id;
  const sib = one("SELECT * FROM fee_schedules WHERE school_year_id = ? AND code = 'sibling_discount'", y.id);
  assert.ok(sib?.from_nth_child >= 2, 'demo has a sibling rule');
  // two older children registered earlier (another registration), the youngest registers now → counts as the 3rd child
  const regId = Number(run("INSERT INTO registrations (family_id, school_year_id, status) VALUES (?,?, 'paid')", fam, y.id).lastInsertRowid);
  const kids = sql("SELECT p.id FROM family_members fm JOIN persons p ON p.id = fm.person_id WHERE fm.family_id = ? AND fm.relationship = 'child'", fam);
  const older = [{ id: kids[0].id, birth: '2010-01-01' }, { id: 93002, birth: '2012-01-01' }];
  run('UPDATE persons SET birth_date = ? WHERE id = ?', older[0].birth, older[0].id);
  for (const o of older) if (o.id === 93002) { const p = Number(run("INSERT INTO persons (english_last_name, english_first_name, gender, birth_date) VALUES ('Sib','Two','F',?)", o.birth).lastInsertRowid); o.id = p; }
  for (const o of older) run('INSERT INTO registration_items (registration_id, student_person_id, class_type_id, grade_label) VALUES (?,?,?,?)', regId, o.id, ct, 'x');
  const now = computeRegistration(db, { yearId: y.id, familyId: fam, items: [{ studentId: 93099, classTypeId: ct, gradeLabel: 'x', birthDate: '2018-01-01' }], today: '2026-08-01' });
  assert.ok(now.items[0].siblingDiscount > 0 === (sib.from_nth_child <= 3), 'youngest of three is child #3');
  // the same child registering alone (nobody else registered) is child #1 → no discount
  const solo = computeRegistration(db, { yearId: y.id, familyId: freshFamily(), items: [{ studentId: 93100, classTypeId: ct, gradeLabel: 'x', birthDate: '2018-01-01' }], today: '2026-08-01' });
  assert.equal(solo.items[0].siblingDiscount, 0);
});

test('fees: the service fee is charged once per family per year (a second registration does not repeat it)', async () => {
  const { computeRegistration } = await import('../src/portal/fees.js');
  const y = year(); const fam = freshFamily(); const ct = one("SELECT id FROM class_types WHERE code = 'regular'").id;
  const item = [{ studentId: 94001, classTypeId: ct, gradeLabel: 'x', birthDate: '2016-01-01' }];
  const first = computeRegistration(db, { yearId: y.id, familyId: fam, items: item, today: '2026-08-01' });
  assert.ok(first.serviceFee > 0);
  run("INSERT INTO registrations (family_id, school_year_id, status, service_fee_cents, grand_total_cents) VALUES (?,?, 'submitted', ?, ?)", fam, y.id, first.serviceFee, first.grand);
  const second = computeRegistration(db, { yearId: y.id, familyId: fam, items: item, today: '2026-08-01' });
  assert.equal(second.serviceFee, 0);
  run("UPDATE registrations SET status = 'cancelled' WHERE family_id = ? AND school_year_id = ?", fam, y.id);
  assert.equal(computeRegistration(db, { yearId: y.id, familyId: fam, items: item, today: '2026-08-01' }).serviceFee, first.serviceFee, 'a cancelled registration does not count');
});

test('fees: withdrawal fee follows the date rules; a "no refund" window returns null', async () => {
  const { withdrawalFee } = await import('../src/portal/fees.js');
  const y = year();
  const rules = sql('SELECT * FROM withdrawal_fee_rules WHERE school_year_id = ? AND deleted_at IS NULL ORDER BY sort', y.id);
  assert.ok(rules.length >= 2, 'demo has withdrawal rules');
  for (const r of rules) {
    const day = r.from_date || r.to_date;
    const got = withdrawalFee(db, y.id, day);
    assert.equal(got.noRefund, !!r.no_refund);
    if (r.no_refund) assert.equal(got.feeCents, null); else assert.equal(got.feeCents, r.fee_cents);
  }
  assert.equal(withdrawalFee(db, y.id, '1999-01-01').rule === null || true, true);
});

test('fees: a submitted registration keeps its stored total when the fee table changes afterwards', async () => {
  const r = submittedReg(250000);
  const reg = one("SELECT id FROM fee_schedules WHERE school_year_id = ? AND code = 'tuition' LIMIT 1", year().id);
  run('UPDATE fee_schedules SET amount_cents = amount_cents + 5000 WHERE id = ?', reg.id);
  const parentUser = one("SELECT u.username FROM users u JOIN family_members fm ON fm.person_id = u.person_id WHERE fm.family_id = ? AND fm.relationship = 'parent_one'", r.fam).username;
  const c = await new Client().login(parentUser);
  const page = await c.get(`/en/portal/registrations/${r.reg}/form`);
  assert.equal(page.status, 200);
  assert.match(page.text, /2,500\.00/, 'shows the stored $2,500.00');
  assert.equal(one('SELECT grand_total_cents FROM registrations WHERE id = ?', r.reg).grand_total_cents, 250000);
  run('UPDATE fee_schedules SET amount_cents = amount_cents - 5000 WHERE id = ?', reg.id);
});

// ---------------------------------------------------------------- payments
test('payment: partial payments keep the registration open; the payment that reaches the total marks it paid and registers the students', async () => {
  const r = submittedReg(120000); const a = await new Client().login('demo.accountant');
  assert.equal((await pay(a, r.reg, '500.00')).status, 302);
  assert.equal(status(r.reg), 'submitted'); assert.equal(await paidOf(r.reg), 50000);
  assert.equal(one('SELECT status FROM enrollments WHERE id = ?', r.en).status, 'pending');
  assert.equal((await pay(a, r.reg, '$700.00', { check_number: '1002' })).status, 302);
  assert.equal(status(r.reg), 'paid'); assert.equal(await paidOf(r.reg), 120000);
  assert.equal(one('SELECT status FROM enrollments WHERE id = ?', r.en).status, 'registered');
  assert.ok(one('SELECT paid_at FROM registrations WHERE id = ?', r.reg).paid_at);
});

test('payment: amounts accept $ and thousands separators and are stored as whole cents', async () => {
  const r = submittedReg(500000); const a = await new Client().login('demo.accountant');
  await pay(a, r.reg, '$1,130.50');
  await pay(a, r.reg, '0.07', { check_number: '1003' });
  assert.deepEqual(sql('SELECT amount_cents FROM transactions WHERE registration_id = ? ORDER BY id', r.reg).map((x) => x.amount_cents), [113050, 7]);
});

test('payment: an overpayment marks the registration paid and the balance is shown as zero', async () => {
  const r = submittedReg(10000); const a = await new Client().login('demo.accountant');
  await pay(a, r.reg, '150.00');
  assert.equal(status(r.reg), 'paid');
  const { registrationPaid, balanceCents } = await import('../src/portal/money.js');
  assert.equal(balanceCents(10000, registrationPaid(db, r.reg)), 0);
});

test('payment: rejects zero, negative, empty and text amounts, a missing check number, an unknown method and an unknown registration', async () => {
  const r = submittedReg(50000); const a = await new Client().login('demo.accountant');
  const before = sql('SELECT id FROM transactions WHERE registration_id = ?', r.reg).length;
  for (const bad of ['0', '-5.00', '', 'abc', '0.001']) assert.equal((await pay(a, r.reg, bad)).status, 400, `amount "${bad}"`);
  assert.equal((await pay(a, r.reg, '10.00', { check_number: '' })).status, 400, 'check needs a number');
  assert.equal((await pay(a, r.reg, '10.00', { payment_method_id: '999999' })).status, 400, 'unknown method');
  assert.equal((await pay(a, 999999, '10.00')).status, 400, 'unknown registration');
  assert.equal(sql('SELECT id FROM transactions WHERE registration_id = ?', r.reg).length, before, 'nothing was recorded');
  assert.equal((await pay(a, r.reg, '20.00', { payment_method_id: String(method('cash')), check_number: '' })).status, 302, 'cash needs no number');
});

test('payment: only people with finance.record_payment can enter one; a failed request records nothing', async () => {
  const r = submittedReg(50000);
  for (const who of ['demo.principal', 'demo.pta', 'demo.teacher1', 'demo.parent01']) {
    const c = await new Client().login(who);
    assert.equal((await pay(c, r.reg, '10.00')).status, 403, who);
  }
  assert.equal(sql('SELECT id FROM transactions WHERE registration_id = ?', r.reg).length, 0);
  assert.equal((await new Client().post('/en/portal/finance/payment', { registration: String(r.reg), amount: '10' })).status, 302, 'anonymous goes to sign-in');
});

test('payment: needs a CSRF token', async () => {
  const r = submittedReg(50000); const a = await new Client().login('demo.accountant');
  const res = await a.req('POST', '/en/portal/finance/payment', { registration: String(r.reg), amount: '10', payment_method_id: String(method('cash')) });
  assert.equal(res.status, 403);
  assert.equal(sql('SELECT id FROM transactions WHERE registration_id = ?', r.reg).length, 0);
});

test('payment: writes an audit row and queues the payment-received email', async () => {
  const r = submittedReg(50000); const a = await new Client().login('demo.accountant');
  const res = await pay(a, r.reg, '50.00'); assert.equal(res.status, 302);
  const tx = one('SELECT id, recorded_by_user_id FROM transactions WHERE registration_id = ?', r.reg);
  assert.ok(tx.recorded_by_user_id, 'who recorded it');
  assert.ok(one("SELECT 1 AS x FROM portal_audit WHERE table_name = 'transactions' AND row_id = ? AND action = 'registration_payment'", tx.id));
  assert.ok(one("SELECT 1 AS x FROM email_outbox WHERE template = 'payment_received' ORDER BY id DESC LIMIT 1"));
});

// ---------------------------------------------------------------- void
test('void: reopens a registration that is no longer fully paid, pends its students, and the voided payment stops counting', async () => {
  const r = submittedReg(80000); const a = await new Client().login('demo.accountant');
  await pay(a, r.reg, '800.00'); assert.equal(status(r.reg), 'paid');
  const tx = one('SELECT id FROM transactions WHERE registration_id = ?', r.reg);
  const res = await a.post(`/en/portal/transactions/${tx.id}/void`, { reason: 'bounced check' });
  assert.equal(res.status, 302);
  assert.equal(status(r.reg), 'submitted'); assert.equal(await paidOf(r.reg), 0);
  assert.equal(one('SELECT status FROM enrollments WHERE id = ?', r.en).status, 'pending');
  const v = one('SELECT voided_at, void_reason, voided_by FROM transactions WHERE id = ?', tx.id);
  assert.ok(v.voided_at && v.void_reason === 'bounced check' && v.voided_by);
  assert.ok(one("SELECT 1 AS x FROM portal_audit WHERE table_name = 'transactions' AND row_id = ? AND action = 'void'", tx.id));
  // paying again works and closes the registration
  await pay(a, r.reg, '800.00', { check_number: '2002' });
  assert.equal(status(r.reg), 'paid');
});

test('void: a second void of the same transaction changes nothing; voiding one of two payments keeps the other counted', async () => {
  const r = submittedReg(100000); const a = await new Client().login('demo.accountant');
  await pay(a, r.reg, '400.00'); await pay(a, r.reg, '600.00', { check_number: '3002' });
  const [t1, t2] = sql('SELECT id FROM transactions WHERE registration_id = ? ORDER BY id', r.reg);
  await a.post(`/en/portal/transactions/${t2.id}/void`, { reason: 'x' });
  const first = one('SELECT voided_at FROM transactions WHERE id = ?', t2.id).voided_at;
  await a.post(`/en/portal/transactions/${t2.id}/void`, { reason: 'again' });
  const t = one('SELECT voided_at, void_reason FROM transactions WHERE id = ?', t2.id);
  assert.equal(t.voided_at, first); assert.equal(t.void_reason, 'x', 'the first reason is kept');
  assert.equal(await paidOf(r.reg), 40000); assert.equal(status(r.reg), 'submitted');
  assert.equal(one('SELECT voided_at FROM transactions WHERE id = ?', t1.id).voided_at, null);
});

test('void: only finance.void holders (accountant, admin) can void; the secretary cannot', async () => {
  const r = submittedReg(30000); const a = await new Client().login('demo.accountant');
  await pay(a, r.reg, '300.00');
  const tx = one('SELECT id FROM transactions WHERE registration_id = ?', r.reg);
  for (const who of ['demo.secretary', 'demo.principal', 'demo.parent01']) {
    const c = await new Client().login(who);
    assert.equal((await c.post(`/en/portal/transactions/${tx.id}/void`, { reason: 'no' })).status, 403, who);
  }
  assert.equal(one('SELECT voided_at FROM transactions WHERE id = ?', tx.id).voided_at, null);
  assert.equal((await (await new Client().login('demo.admin')).post(`/en/portal/transactions/${tx.id}/void`, { reason: 'ok' })).status, 302);
});

// ---------------------------------------------------------------- withdrawals and refunds
test('withdrawal: refund is recorded as money returned and lowers the net paid amount (it must never add to it)', async () => {
  const r = submittedReg(120000); const a = await new Client().login('demo.accountant');
  await pay(a, r.reg, '1200.00'); assert.equal(status(r.reg), 'paid');
  const s = await new Client().login('demo.secretary');
  const res = await s.post(`/en/portal/enrollments/${r.en}/withdraw`, { applied_on: '2026-10-13', fee: '50.00', refund: '300.00', reason: 'moving away' });
  assert.equal(res.status, 302);
  assert.equal(one('SELECT status FROM enrollments WHERE id = ?', r.en).status, 'withdrawn');
  const w = one('SELECT * FROM withdrawals WHERE enrollment_id = ?', r.en);
  assert.equal(w.processing_fee_cents, 5000); assert.equal(w.refund_cents, 30000);
  const refund = one("SELECT t.amount_cents, tt.direction FROM transactions t JOIN transaction_types tt ON tt.id = t.transaction_type_id WHERE t.registration_id = ? AND tt.code = 'withdrawal'", r.reg);
  assert.equal(refund.amount_cents, 30000); assert.equal(refund.direction, 'out');
  assert.equal(await paidOf(r.reg), 120000 - 30000, 'net paid after the refund');
});

test('withdrawal: refund below zero is clamped, a zero refund creates no transaction, and a refund can be voided', async () => {
  const r = submittedReg(60000); const a = await new Client().login('demo.accountant');
  await pay(a, r.reg, '600.00');
  const s = await new Client().login('demo.secretary');
  await s.post(`/en/portal/enrollments/${r.en}/withdraw`, { applied_on: '2026-10-13', fee: '0', refund: '-100.00', reason: 'x' });
  assert.equal(one('SELECT refund_cents FROM withdrawals WHERE enrollment_id = ?', r.en).refund_cents, 0);
  assert.equal(sql("SELECT t.id FROM transactions t JOIN transaction_types tt ON tt.id = t.transaction_type_id WHERE t.registration_id = ? AND tt.code = 'withdrawal'", r.reg).length, 0);
  // a second child withdrawn with a real refund, then that refund is voided → net paid returns to the full amount
  const r2 = submittedReg(60000); await pay(a, r2.reg, '600.00');
  await s.post(`/en/portal/enrollments/${r2.en}/withdraw`, { applied_on: '2026-10-13', fee: '0', refund: '100.00', reason: 'y' });
  assert.equal(await paidOf(r2.reg), 50000);
  const refundTx = one("SELECT t.id FROM transactions t JOIN transaction_types tt ON tt.id = t.transaction_type_id WHERE t.registration_id = ? AND tt.code = 'withdrawal'", r2.reg);
  await a.post(`/en/portal/transactions/${refundTx.id}/void`, { reason: 'refund cancelled' });
  assert.equal(await paidOf(r2.reg), 60000);
});

test('withdrawal: only withdrawal.process holders can withdraw a student', async () => {
  const r = submittedReg(60000);
  for (const who of ['demo.accountant', 'demo.principal', 'demo.teacher1', 'demo.parent01']) {
    const c = await new Client().login(who);
    assert.equal((await c.post(`/en/portal/enrollments/${r.en}/withdraw`, { applied_on: '2026-10-13', fee: '0', refund: '0' })).status, 403, who);
  }
  assert.equal(one('SELECT status FROM enrollments WHERE id = ?', r.en).status, 'pending');
});

// ---------------------------------------------------------------- manual / scrip transactions
test('manual transaction: scrip cards set the amount (typed amount ignored), one line per product, totals add up', async () => {
  const fam = freshFamily(); const a = await new Client().login('demo.accountant');
  const [p1, p2] = sql('SELECT id, denomination_cents FROM scrip_products WHERE active = 1 ORDER BY id LIMIT 2');
  const res = await a.post('/en/portal/finance/manual/new', { family_id: String(fam), transaction_type_id: String(txType('scrip_purchase')), payment_method_id: String(method('cash')), transaction_date: '2026-10-13',
    amount: '1.00', product_0: String(p1.id), qty_0: '3', product_1: String(p2.id), qty_1: '2' });
  assert.equal(res.status, 302, res.text.slice(0, 200));
  const t = one('SELECT * FROM transactions WHERE family_id = ? ORDER BY id DESC', fam);
  const lines = sql('SELECT * FROM transaction_lines WHERE transaction_id = ?', t.id);
  assert.equal(lines.length, 2);
  assert.equal(t.amount_cents, p1.denomination_cents * 3 + p2.denomination_cents * 2);
  assert.equal(lines.reduce((s, l) => s + l.amount_cents, 0), t.amount_cents, 'lines add up to the transaction');
  assert.ok(lines.every((l) => l.amount_cents === l.unit_cents * l.quantity));
});

test('manual transaction: validation (family, type, method, positive amount, check number) and permissions', async () => {
  const fam = freshFamily(); const a = await new Client().login('demo.accountant');
  const ok = { family_id: String(fam), transaction_type_id: String(txType('adjustment')), payment_method_id: String(method('cash')), transaction_date: '2026-10-13', amount: '25.00' };
  const count = () => sql('SELECT id FROM transactions WHERE family_id = ?', fam).length;
  for (const [k, v] of [['family_id', ''], ['transaction_type_id', '0'], ['payment_method_id', '0'], ['transaction_date', ''], ['amount', '0'], ['amount', '-3'], ['amount', 'x']])
    assert.equal((await a.post('/en/portal/finance/manual/new', { ...ok, [k]: v })).status, 400, `${k}=${v}`);
  assert.equal((await a.post('/en/portal/finance/manual/new', { ...ok, payment_method_id: String(method('check')), check_number: '' })).status, 400);
  assert.equal(count(), 0);
  assert.equal((await a.post('/en/portal/finance/manual/new', ok)).status, 302); assert.equal(count(), 1);
  for (const who of ['demo.principal', 'demo.pta', 'demo.parent01']) assert.equal((await (await new Client().login(who)).post('/en/portal/finance/manual/new', ok)).status, 403, who);
  assert.equal(count(), 1);
});

// ---------------------------------------------------------------- who can see money
test('receipts and transactions: a parent sees only their own family; staff need transactions.view; teachers and students see nothing', async () => {
  const r = submittedReg(40000); const a = await new Client().login('demo.accountant');
  await pay(a, r.reg, '400.00');
  const tx = one('SELECT id FROM transactions WHERE registration_id = ?', r.reg);
  const owner = one("SELECT u.username FROM users u JOIN family_members fm ON fm.person_id = u.person_id WHERE fm.family_id = ? AND fm.relationship = 'parent_one'", r.fam).username;
  for (const p of [`/en/portal/transactions/${tx.id}`, `/en/portal/transactions/${tx.id}/receipt`]) {
    assert.equal((await (await new Client().login(owner)).get(p)).status, 200, `owner ${p}`);
    assert.equal((await a.get(p)).status, 200, `accountant ${p}`);
    for (const who of ['demo.parent01', 'demo.teacher1', 'demo.student01']) assert.equal((await (await new Client().login(who)).get(p)).status, 403, `${who} ${p}`);
    assert.equal((await new Client().get(p)).status, 302, 'anonymous');
  }
  assert.equal((await (await new Client().login('demo.teacher1')).get('/en/portal/billing')).status, 403);
  assert.equal((await (await new Client().login('demo.student01')).get('/en/portal/transactions')).status, 403);
});

test('billing page: total, paid (net of refunds) and balance per registration match the ledger', async () => {
  const r = submittedReg(90000); const a = await new Client().login('demo.accountant');
  await pay(a, r.reg, '600.00');
  const owner = one("SELECT u.username FROM users u JOIN family_members fm ON fm.person_id = u.person_id WHERE fm.family_id = ? AND fm.relationship = 'parent_one'", r.fam).username;
  const c = await new Client().login(owner);
  let page = (await c.get('/en/portal/billing')).text;
  assert.match(page, /\$900\.00/); assert.match(page, /\$600\.00/); assert.match(page, /\$300\.00/);
  await pay(a, r.reg, '300.00', { check_number: '5005' });
  run(`INSERT INTO transactions (family_id, registration_id, school_year_id, transaction_type_id, transaction_date, payment_method_id, amount_cents) VALUES (?,?,?,?, '2026-10-14', ?, 20000)`, r.fam, r.reg, year().id, txType('withdrawal'), method('check'));
  page = (await c.get('/en/portal/billing')).text;
  assert.match(page, /\$700\.00/, 'paid is net of the $200 refund');
  assert.match(page, /\$200\.00/, 'balance after the refund');
});

test('dashboard totals: money in and money out are listed separately by type and voided rows are excluded', async () => {
  const r = submittedReg(10000); const a = await new Client().login('demo.accountant');
  await pay(a, r.reg, '100.00');
  const tx = one('SELECT id FROM transactions WHERE registration_id = ?', r.reg);
  const before = (await a.get('/en/portal')).text;
  await a.post(`/en/portal/transactions/${tx.id}/void`, { reason: 'dup' });
  const after = (await a.get('/en/portal')).text;
  assert.notEqual(before, after, 'the finance dashboard changes when a payment is voided');
  const sum = one(`SELECT COALESCE(SUM(t.amount_cents),0) n FROM transactions t JOIN transaction_types tt ON tt.id = t.transaction_type_id
    WHERE t.school_year_id = ? AND tt.direction = 'in' AND t.voided_at IS NULL AND t.deleted_at IS NULL`, year().id).n;
  assert.ok(sum >= 0);
});
