// src/portal/fees.js — registration fee calculation from the configurable fee_schedules of a school year.
// Every number comes from the fee table (staff edit it in one place: /portal/fees). Nothing is hard-coded.

import { todayLocal } from '../datetime.js';
import { withdrawalRules } from '../queries/schoolYears.js';

const cents = (n) => Math.round(Number(n) || 0);

export function currentYear(db) {
  return db.prepare('SELECT * FROM school_years WHERE is_current = 1 AND deleted_at IS NULL LIMIT 1').get()
    || db.prepare('SELECT * FROM school_years WHERE deleted_at IS NULL ORDER BY label DESC LIMIT 1').get() || null;
}

export function feeRows(db, yearId) {
  return db.prepare('SELECT * FROM fee_schedules WHERE school_year_id = ? AND deleted_at IS NULL AND active = 1 ORDER BY sort, id').all(yearId);
}

function pick(rows, code, classTypeId) {
  const specific = rows.find((r) => r.code === code && r.class_type_id === classTypeId);
  return specific || rows.find((r) => r.code === code && !r.class_type_id) || null;
}

/**
 * items: [{ studentId, classTypeId, gradeLabel, birthDate }]
 * Sibling discount: children are ordered oldest → youngest across ALL children of the family registered for the year
 * (other registrations that are not cancelled + this one); the Nth child and later get the discount.
 */
export function computeRegistration(db, { yearId, familyId, registrationId = null, items, scripPurchaseCents = 0, today = todayLocal() }) {
  const rows = feeRows(db, yearId);
  const year = db.prepare('SELECT * FROM school_years WHERE id = ?').get(yearId);
  const regFee = (ct) => pick(rows, 'registration_fee', ct);
  const early = rows.find((r) => r.code === 'early_reg_discount');
  const earlyActive = !!early && (!early.deadline || today <= early.deadline);
  const sib = rows.find((r) => r.code === 'sibling_discount');
  const misc = (ct) => pick(rows, 'misc_fee', ct);
  const tuition = (ct) => pick(rows, 'tuition', ct);
  const service = rows.find((r) => r.code === 'service_fee');
  const deposit = rows.find((r) => r.code === 'scrip_deposit');
  const faculty = rows.find((r) => r.code === 'faculty_discount');

  // siblings already registered this year (other, non-cancelled registrations)
  const already = db.prepare(`SELECT ri.student_person_id AS id, p.birth_date FROM registration_items ri JOIN registrations r ON r.id = ri.registration_id
    JOIN persons p ON p.id = ri.student_person_id WHERE r.family_id = ? AND r.school_year_id = ? AND r.status <> 'cancelled' AND r.deleted_at IS NULL
    AND (? IS NULL OR r.id <> ?) AND ri.deleted_at IS NULL`).all(familyId, yearId, registrationId, registrationId);
  const everyone = [...already.map((a) => ({ id: a.id, birth: a.birth_date || '9999' })), ...items.map((i) => ({ id: i.studentId, birth: i.birthDate || '9999' }))];
  const seen = new Set();
  const order = everyone.filter((e) => (seen.has(e.id) ? false : seen.add(e.id))).sort((a, b) => String(a.birth).localeCompare(String(b.birth))).map((e) => e.id);
  const rank = (id) => order.indexOf(id) + 1;

  const hasFacultyParent = !!db.prepare(`SELECT 1 FROM family_members fm JOIN persons p ON p.id = fm.person_id WHERE fm.family_id = ? AND fm.relationship <> 'child' AND p.is_faculty = 1 AND fm.deleted_at IS NULL`).get(familyId);

  const out = items.map((it) => {
    const rf = regFee(it.classTypeId); const tu = tuition(it.classTypeId); const mi = misc(it.classTypeId);
    const registration = cents(rf?.amount_cents);
    const earlyDisc = earlyActive ? Math.min(registration, cents(early.amount_cents) || registration) : 0;
    const sibDisc = sib && sib.from_nth_child && rank(it.studentId) >= sib.from_nth_child ? cents(sib.amount_cents) : 0;
    const tuitionCents = cents(tu?.amount_cents);
    const row = {
      studentId: it.studentId, classTypeId: it.classTypeId, gradeLabel: it.gradeLabel || '', birthDate: it.birthDate || null,
      registrationFee: registration, earlyRegDiscount: earlyDisc, registrationNet: registration - earlyDisc,
      tuition: tuitionCents, misc: cents(mi?.amount_cents), siblingDiscount: sibDisc,
      facultyDiscountPending: hasFacultyParent && faculty?.percent ? Math.round(tuitionCents * faculty.percent / 100) : 0,
    };
    row.subtotal = row.registrationNet + row.tuition + row.misc - row.siblingDiscount;
    return row;
  });

  // service fee is charged once per family per school year
  const alreadyService = db.prepare(`SELECT 1 FROM registrations WHERE family_id = ? AND school_year_id = ? AND status <> 'cancelled' AND service_fee_cents > 0 AND deleted_at IS NULL AND (? IS NULL OR id <> ?)`).get(familyId, yearId, registrationId, registrationId);
  const serviceFee = service && !alreadyService ? cents(service.amount_cents) : 0;
  const scripDeposit = deposit ? cents(deposit.amount_cents) : 0;
  const scripPurchase = cents(scripPurchaseCents);
  const grand = out.reduce((s, r) => s + r.subtotal, 0) + serviceFee + scripDeposit + scripPurchase;
  return { items: out, serviceFee, scripDeposit, scripPurchase, grand, earlyActive, earlyDeadline: early?.deadline || null, year };
}

/** Withdrawal processing fee for an application date (fee rules of the year). */
export function withdrawalFee(db, yearId, appliedOn) {
  const rules = withdrawalRules(db, yearId);
  const hit = rules.find((r) => (!r.from_date || appliedOn >= r.from_date) && (!r.to_date || appliedOn <= r.to_date));
  return hit ? { rule: hit, feeCents: hit.no_refund ? null : cents(hit.fee_cents), noRefund: !!hit.no_refund } : { rule: null, feeCents: 0, noRefund: false };
}

/** cents → "$1,130.50" (negative: "-$25.00"). Integer maths only, so no floating-point drift. */
export const money = (c) => {
  const n = Math.round(Number(c) || 0); const abs = Math.abs(n);
  const dollars = String(Math.trunc(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${n < 0 ? '-' : ''}$${dollars}.${String(abs % 100).padStart(2, '0')}`;
};
