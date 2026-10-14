// src/portal/finance-reports.js — the numbers behind the finance reports (all money in integer cents; money out is negative).
import { paidSql } from './money.js';
import { todayLocal } from '../datetime.js';

const signed = (alias = 't') => `CASE tt.direction WHEN 'out' THEN -${alias}.amount_cents ELSE ${alias}.amount_cents END`;

/** Daily deposit: every non-voided transaction in the date range, grouped by payment method with sub-totals. */
export function dailyDeposit(db, from, to) {
  const rows = db.prepare(`SELECT t.id, t.transaction_date, t.check_number, t.registration_id, t.note, t.amount_cents, ${signed()} AS signed_cents, tt.name_en AS type_en, tt.name_zh AS type_zh, tt.direction,
      pm.id AS method_id, pm.code AS method_code, pm.name_en AS method_en, pm.name_zh AS method_zh, u.username AS recorded_by,
      (SELECT p.english_last_name || ' ' || p.english_first_name || ' ' || p.chinese_name FROM family_members fm JOIN persons p ON p.id = fm.person_id WHERE fm.family_id = t.family_id AND fm.relationship = 'parent_one' AND fm.deleted_at IS NULL LIMIT 1) AS family
    FROM transactions t JOIN transaction_types tt ON tt.id = t.transaction_type_id JOIN payment_methods pm ON pm.id = t.payment_method_id LEFT JOIN users u ON u.id = t.recorded_by_user_id
    WHERE t.deleted_at IS NULL AND t.voided_at IS NULL AND t.transaction_date BETWEEN ? AND ? ORDER BY pm.id, t.transaction_date, t.id`).all(from, to);
  const voided = db.prepare(`SELECT t.id, t.transaction_date, t.amount_cents, t.void_reason, tt.name_en AS type_en, tt.name_zh AS type_zh, pm.name_en AS method_en, pm.name_zh AS method_zh FROM transactions t
    JOIN transaction_types tt ON tt.id = t.transaction_type_id JOIN payment_methods pm ON pm.id = t.payment_method_id WHERE t.deleted_at IS NULL AND t.voided_at IS NOT NULL AND t.transaction_date BETWEEN ? AND ? ORDER BY t.id`).all(from, to);
  const groups = [];
  for (const r of rows) {
    let g = groups[groups.length - 1];
    if (!g || g.method_id !== r.method_id) { g = { method_id: r.method_id, method_code: r.method_code, method_en: r.method_en, method_zh: r.method_zh, rows: [], received: 0, returned: 0, net: 0 }; groups.push(g); }
    g.rows.push(r);
    if (r.direction === 'out') g.returned += r.amount_cents; else g.received += r.amount_cents;
    g.net += r.signed_cents;
  }
  return { from, to, groups, voided, received: groups.reduce((s, g) => s + g.received, 0), returned: groups.reduce((s, g) => s + g.returned, 0), net: groups.reduce((s, g) => s + g.net, 0), count: rows.length };
}

/** Unpaid registrations of a year with how long they have been waiting. */
export function aging(db, yearId, today = todayLocal()) {
  const rows = db.prepare(`SELECT r.id, r.family_id, r.status, r.grand_total_cents, ${paidSql('r')} AS paid_cents, date(r.submitted_at, 'localtime') AS submitted_on,
      CAST(julianday(?) - julianday(date(r.submitted_at, 'localtime')) AS INTEGER) AS days,
      (SELECT p.english_last_name || ' ' || p.english_first_name || ' ' || p.chinese_name FROM family_members fm JOIN persons p ON p.id = fm.person_id WHERE fm.family_id = r.family_id AND fm.relationship = 'parent_one' AND fm.deleted_at IS NULL LIMIT 1) AS family,
      (SELECT f.email FROM families f WHERE f.id = r.family_id) AS email
    FROM registrations r WHERE r.school_year_id = ? AND r.status = 'submitted' AND r.deleted_at IS NULL ORDER BY r.submitted_at`).all(today, yearId)
    .map((r) => ({ ...r, balance_cents: Math.max(0, r.grand_total_cents - r.paid_cents) })).filter((r) => r.balance_cents > 0);
  const buckets = [['0–7 days', 0, 7], ['8–30 days', 8, 30], ['31–60 days', 31, 60], ['Over 60 days', 61, 99999]].map(([label, lo, hi]) => {
    const inB = rows.filter((r) => r.days >= lo && r.days <= hi);
    return { label, n: inB.length, cents: inB.reduce((s, r) => s + r.balance_cents, 0) };
  });
  return { rows, buckets, total: rows.reduce((s, r) => s + r.balance_cents, 0) };
}

/** Year summary: cash movement by type and method, and what the registrations billed vs collected. */
export function yearSummary(db, yearId) {
  const byType = db.prepare(`SELECT tt.name_en AS type_en, tt.name_zh AS type_zh, tt.direction, COUNT(*) AS n, SUM(t.amount_cents) AS cents FROM transactions t JOIN transaction_types tt ON tt.id = t.transaction_type_id
    WHERE t.school_year_id = ? AND t.deleted_at IS NULL AND t.voided_at IS NULL GROUP BY tt.id ORDER BY tt.direction DESC, tt.id`).all(yearId);
  const byMethod = db.prepare(`SELECT pm.name_en AS method_en, pm.name_zh AS method_zh, COUNT(*) AS n, SUM(${signed()}) AS cents FROM transactions t JOIN transaction_types tt ON tt.id = t.transaction_type_id JOIN payment_methods pm ON pm.id = t.payment_method_id
    WHERE t.school_year_id = ? AND t.deleted_at IS NULL AND t.voided_at IS NULL GROUP BY pm.id ORDER BY pm.id`).all(yearId);
  const billing = db.prepare(`SELECT ct.name_en AS class_en, ct.name_zh AS class_zh, COUNT(*) AS students, SUM(ri.registration_fee_cents) AS registration, SUM(ri.early_reg_discount_cents) AS early, SUM(ri.tuition_cents) AS tuition,
      SUM(ri.misc_fee_cents) AS misc, SUM(ri.sibling_discount_cents) AS sibling FROM registration_items ri JOIN registrations r ON r.id = ri.registration_id JOIN class_types ct ON ct.id = ri.class_type_id
    WHERE r.school_year_id = ? AND r.status IN ('submitted','paid') AND r.deleted_at IS NULL AND ri.deleted_at IS NULL GROUP BY ct.id ORDER BY ct.sort`).all(yearId)
    .map((r) => ({ ...r, net: r.registration - r.early + r.tuition + r.misc - r.sibling }));
  const regs = db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(r.grand_total_cents),0) AS billed, COALESCE(SUM(r.service_fee_cents),0) AS service, COALESCE(SUM(r.scrip_deposit_cents),0) AS deposit,
      COALESCE(SUM(r.scrip_purchase_cents),0) AS scrip, COALESCE(SUM(${paidSql('r')}),0) AS collected FROM registrations r WHERE r.school_year_id = ? AND r.status IN ('submitted','paid') AND r.deleted_at IS NULL`).get(yearId);
  const received = byType.filter((r) => r.direction === 'in').reduce((s, r) => s + r.cents, 0); const returned = byType.filter((r) => r.direction === 'out').reduce((s, r) => s + r.cents, 0);
  return { byType, byMethod, billing, regs: { ...regs, outstanding: Math.max(0, regs.billed - regs.collected) }, received, returned, net: received - returned };
}

/** Scrip: cards sold / redeemed per product, and what families committed to buy at registration vs what was recorded. */
export function scripReport(db, yearId) {
  const products = db.prepare(`SELECT COALESCE(sp.vendor, '—') AS vendor, COALESCE(sp.name, tl.description) AS product, sp.denomination_cents AS denomination,
      SUM(CASE tt.direction WHEN 'in' THEN tl.quantity ELSE 0 END) AS sold_qty, SUM(CASE tt.direction WHEN 'in' THEN tl.amount_cents ELSE 0 END) AS sold_cents,
      SUM(CASE tt.direction WHEN 'out' THEN tl.quantity ELSE 0 END) AS out_qty, SUM(CASE tt.direction WHEN 'out' THEN tl.amount_cents ELSE 0 END) AS out_cents
    FROM transaction_lines tl JOIN transactions t ON t.id = tl.transaction_id JOIN transaction_types tt ON tt.id = t.transaction_type_id LEFT JOIN scrip_products sp ON sp.id = tl.scrip_product_id
    WHERE t.school_year_id = ? AND t.deleted_at IS NULL AND t.voided_at IS NULL AND tl.deleted_at IS NULL GROUP BY COALESCE(sp.id, tl.description) ORDER BY vendor, denomination`).all(yearId);
  const committed = db.prepare("SELECT COALESCE(SUM(scrip_purchase_cents),0) AS n FROM registrations WHERE school_year_id = ? AND status IN ('submitted','paid') AND deleted_at IS NULL").get(yearId).n;
  const purchased = db.prepare(`SELECT COALESCE(SUM(t.amount_cents),0) AS n FROM transactions t JOIN transaction_types tt ON tt.id = t.transaction_type_id WHERE t.school_year_id = ? AND tt.code = 'scrip_purchase' AND t.deleted_at IS NULL AND t.voided_at IS NULL`).get(yearId).n;
  const refunded = db.prepare(`SELECT COALESCE(SUM(t.amount_cents),0) AS n FROM transactions t JOIN transaction_types tt ON tt.id = t.transaction_type_id WHERE t.school_year_id = ? AND tt.code IN ('scrip_redeem','scrip_refund','service_refund') AND t.deleted_at IS NULL AND t.voided_at IS NULL`).get(yearId).n;
  return { products, committed, purchased, refunded, shortfall: Math.max(0, committed - purchased) };
}
