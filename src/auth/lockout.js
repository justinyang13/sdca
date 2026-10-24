// src/auth/lockout.js — one lockout rule for both sign-in areas: 5 wrong passwords lock the account for 15 minutes.
// `table` is 'users' (family portal) or 'admin_users' (admin site); both have failed_attempts and locked_until.
import { nowUtc } from '../datetime.js';

export const MAX_FAILS = 5;
export const LOCK_MINUTES = 15;
const TABLES = new Set(['users', 'admin_users']);
const check = (table) => { if (!TABLES.has(table)) throw new Error(`lockout: unknown table ${table}`); return table; };

export const isLocked = (row) => !!(row && row.locked_until && row.locked_until > nowUtc());

/** Count one wrong password. Returns true when this failure locked the account. */
export function recordFailure(db, table, row) {
  const fails = (row.failed_attempts || 0) + 1;
  if (fails >= MAX_FAILS) {
    db.prepare(`UPDATE ${check(table)} SET failed_attempts = 0, locked_until = ? WHERE id = ?`).run(nowUtc(new Date(Date.now() + LOCK_MINUTES * 60000)), row.id);
    return true;
  }
  db.prepare(`UPDATE ${check(table)} SET failed_attempts = ? WHERE id = ?`).run(fails, row.id);
  return false;
}

/** After a successful sign-in. */
export function clearFailures(db, table, id) {
  db.prepare(`UPDATE ${check(table)} SET failed_attempts = 0, locked_until = NULL WHERE id = ?`).run(id);
}
