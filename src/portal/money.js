// src/portal/money.js — one definition of "how much has been paid" for a registration.
// Transactions store positive cents plus the type's direction ('in' = money received, 'out' = money returned).
// A registration's paid amount is received minus returned, ignoring voided / deleted rows.

/** SQL expression (scalar subquery) for the net paid cents of the registration row aliased `alias`. */
export const paidSql = (alias = 'r') => `COALESCE((SELECT SUM(CASE tt.direction WHEN 'out' THEN -t.amount_cents ELSE t.amount_cents END)
  FROM transactions t JOIN transaction_types tt ON tt.id = t.transaction_type_id
  WHERE t.registration_id = ${alias}.id AND t.voided_at IS NULL AND t.deleted_at IS NULL), 0)`;

export function registrationPaid(db, registrationId) {
  return db.prepare(`SELECT ${paidSql('r')} AS n FROM registrations r WHERE r.id = ?`).get(Number(registrationId))?.n ?? 0;
}

export const balanceCents = (grandTotalCents, paidCents) => Math.max(0, (grandTotalCents || 0) - (paidCents || 0));
