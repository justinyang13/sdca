// src/portal/board.js — board positions → portal roles. A board membership (person + position + term) gives that person's login the
// position's role while the term is current, and takes it away again afterwards. Only the roles named in board_positions are touched.
import { todayLocal } from '../datetime.js';

/** Insert the standard positions (idempotent; names match the public Board of Directors page). */
export function seedBoardPositions(db, positions) {
  const ins = db.prepare('INSERT OR IGNORE INTO board_positions (code, name_en, name_zh, role_code, sort) VALUES (?,?,?,?,?)');
  for (const p of positions) ins.run(p.code, p.name_en, p.name_zh, p.role_code, p.sort);
}

/** Portal roles of each board role code a person currently deserves: { personId → Set(roleCode) }. */
function currentHolders(db, today) {
  const rows = db.prepare(`SELECT bm.person_id, bp.role_code FROM board_members bm JOIN board_positions bp ON bp.id = bm.board_position_id
    WHERE bm.deleted_at IS NULL AND bp.deleted_at IS NULL AND bp.role_code <> '' AND (bm.start_date IS NULL OR bm.start_date <= ?) AND (bm.end_date IS NULL OR bm.end_date >= ?)`).all(today, today);
  const map = new Map();
  for (const r of rows) { if (!map.has(r.person_id)) map.set(r.person_id, new Set()); map.get(r.person_id).add(r.role_code); }
  return map;
}

/** Make user_roles match the current memberships. Returns { granted, revoked }. */
export function syncBoardRoles(db, today = todayLocal()) {
  const managed = db.prepare("SELECT DISTINCT role_code FROM board_positions WHERE role_code <> '' AND deleted_at IS NULL").all().map((r) => r.role_code);
  if (!managed.length) return { granted: 0, revoked: 0 };
  const roleId = new Map(db.prepare(`SELECT code, id FROM roles WHERE code IN (${managed.map(() => '?').join(',')})`).all(...managed).map((r) => [r.code, r.id]));
  const holders = currentHolders(db, today);
  let granted = 0; let revoked = 0;
  const users = db.prepare('SELECT id, person_id FROM users WHERE deleted_at IS NULL').all();
  for (const u of users) {
    const want = holders.get(u.person_id) || new Set();
    for (const code of managed) {
      const rid = roleId.get(code); if (!rid) continue;
      const row = db.prepare('SELECT id, deleted_at FROM user_roles WHERE user_id = ? AND role_id = ?').get(u.id, rid);
      if (want.has(code)) {
        if (!row) { db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?,?)').run(u.id, rid); granted++; }
        else if (row.deleted_at) { db.prepare("UPDATE user_roles SET deleted_at = NULL, updated_at = datetime('now') WHERE id = ?").run(row.id); granted++; }
      } else if (row && !row.deleted_at) { db.prepare("UPDATE user_roles SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(row.id); revoked++; }
    }
  }
  return { granted, revoked };
}

/** The board positions a person holds today (for badges / lists). */
export function boardPositionsOf(db, personId, today = todayLocal()) {
  return db.prepare(`SELECT bp.name_en, bp.name_zh, bp.role_code FROM board_members bm JOIN board_positions bp ON bp.id = bm.board_position_id
    WHERE bm.person_id = ? AND bm.deleted_at IS NULL AND (bm.start_date IS NULL OR bm.start_date <= ?) AND (bm.end_date IS NULL OR bm.end_date >= ?) ORDER BY bp.sort`).all(personId, today, today);
}
