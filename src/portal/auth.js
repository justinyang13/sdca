// src/portal/auth.js — portal login, lockout, reset/invitation tokens, email outbox, family lookups.
import crypto from 'node:crypto';
import { hashPassword, verifyPassword } from '../admin/auth.js';
import { audit } from './crud.js';
import { loadAccess } from './perm.js';

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;
export const RESET_HOURS = 6;
export const INVITE_HOURS = 72;
const iso = (d) => d.toISOString().replace('T', ' ').slice(0, 19);
const nowIso = () => iso(new Date());
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

export function queueEmail(db, { to, template, subject, body, relatedType = '', relatedId = null }) {
  // Demo mode: every email is logged to the outbox (status "logged"); a real sender can pick up status "queued" later.
  db.prepare('INSERT INTO email_outbox (to_email, template, subject, body, status, related_type, related_id) VALUES (?,?,?,?,?,?,?)')
    .run(to || '', template || '', subject, body || '', 'logged', relatedType, relatedId);
}

export function passwordPolicyError(pw) {
  if (!pw || String(pw).length < 8) return 'Password must be at least 8 characters 密碼至少八個字';
  return null;
}

export function attemptLogin(db, username, password, ip = '') {
  const u = db.prepare('SELECT * FROM users WHERE username = ? AND deleted_at IS NULL').get(String(username || '').trim());
  if (!u) { verifyPassword('x', 'aa:bb'); return { ok: false, error: 'invalid' }; }
  if (u.status === 'disabled' || u.status === 'pending') return { ok: false, error: u.status };
  if (u.locked_until && u.locked_until > nowIso()) return { ok: false, error: 'locked' };
  if (!verifyPassword(password, u.password_hash)) {
    const fails = (u.failed_attempts || 0) + 1;
    if (fails >= MAX_FAILS) db.prepare('UPDATE users SET failed_attempts = 0, locked_until = ? WHERE id = ?').run(iso(new Date(Date.now() + LOCK_MINUTES * 60000)), u.id);
    else db.prepare('UPDATE users SET failed_attempts = ? WHERE id = ?').run(fails, u.id);
    audit(db, 'users', u.id, 'login_failed', null, null, u.id, ip);
    return { ok: false, error: fails >= MAX_FAILS ? 'locked' : 'invalid' };
  }
  db.prepare('UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = ? WHERE id = ?').run(nowIso(), u.id);
  audit(db, 'users', u.id, 'login', null, null, u.id, ip);
  return { ok: true, user: u };
}

/** Families a person belongs to (as parent/guardian or as child). */
export function familiesOfPerson(db, personId) {
  return db.prepare(`SELECT DISTINCT fm.family_id AS id, fm.relationship FROM family_members fm WHERE fm.person_id = ? AND fm.deleted_at IS NULL`).all(personId);
}
export function parentFamilyIds(db, personId) {
  return familiesOfPerson(db, personId).filter((f) => f.relationship !== 'child').map((f) => f.id);
}
export function familyOfStudent(db, studentId) {
  return db.prepare("SELECT family_id FROM family_members WHERE person_id = ? AND relationship = 'child' AND deleted_at IS NULL LIMIT 1").get(studentId)?.family_id || null;
}
export function ownsFamily(db, personId, familyId) {
  return parentFamilyIds(db, personId).includes(Number(familyId));
}
export function ownsPerson(db, personId, targetPersonId) {
  if (Number(personId) === Number(targetPersonId)) return true;
  const fams = parentFamilyIds(db, personId);
  if (!fams.length) return false;
  return !!db.prepare(`SELECT 1 FROM family_members WHERE person_id = ? AND deleted_at IS NULL AND family_id IN (${fams.map(() => '?').join(',')})`).get(targetPersonId, ...fams);
}
/** Class ids the user teaches or is room parent for (current school year). */
export function myClassIds(db, personId, { currentOnly = true } = {}) {
  const sql = `SELECT DISTINCT ca.school_class_id AS id FROM class_assignments ca ${currentOnly ? 'JOIN school_years y ON y.id = ca.school_year_id AND y.is_current = 1' : ''}
    WHERE ca.person_id = ? AND ca.deleted_at IS NULL`;
  return db.prepare(sql).all(personId).map((r) => r.id);
}

/** Express middleware: load req.portal = { user, person, access, familyIds, lang } from the session. */
export function portalSession(db) {
  return (req, res, next) => {
    req.portal = null;
    const uid = req.session?.portalUserId;
    if (uid) {
      const user = db.prepare('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL').get(uid);
      if (user && user.status === 'active') {
        const person = db.prepare('SELECT * FROM persons WHERE id = ?').get(user.person_id);
        const access = loadAccess(db, user.id);
        req.portal = { user, person, access, familyIds: parentFamilyIds(db, user.person_id) };
      } else delete req.session.portalUserId;
    }
    next();
  };
}

// ---------- password reset / invitations ----------
export function createPasswordReset(db, user) {
  const raw = crypto.randomBytes(20).toString('hex');
  db.prepare('INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?,?,?)').run(user.id, sha(raw), iso(new Date(Date.now() + RESET_HOURS * 3600000)));
  return raw;
}
export function findReset(db, raw) {
  const r = db.prepare('SELECT * FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND deleted_at IS NULL').get(sha(String(raw || '')));
  return r && r.expires_at > nowIso() ? r : null;
}
export function createInvitation(db, familyId, email) {
  const raw = crypto.randomBytes(20).toString('hex');
  db.prepare('INSERT INTO invitations (family_id, email, token_hash, expires_at) VALUES (?,?,?,?)').run(familyId, email || '', sha(raw), iso(new Date(Date.now() + INVITE_HOURS * 3600000)));
  return raw;
}
export function findInvitation(db, raw) {
  const r = db.prepare('SELECT * FROM invitations WHERE token_hash = ? AND used_at IS NULL AND deleted_at IS NULL').get(sha(String(raw || '')));
  return r && r.expires_at > nowIso() ? r : null;
}
const digits = (s) => String(s || '').replace(/\D/g, '');
/** The reset / invitation page asks for a phone number on file (home, cell or emergency) as verification. */
export function phoneMatchesFamily(db, familyId, phone) {
  const d = digits(phone);
  if (d.length < 7) return false;
  const f = db.prepare('SELECT home_phone, cell_phone, emergency_home_phone, emergency_cell_phone FROM families WHERE id = ?').get(familyId);
  return !!f && [f.home_phone, f.cell_phone, f.emergency_home_phone, f.emergency_cell_phone].some((p) => digits(p) && digits(p).endsWith(d.slice(-7)));
}
/** Staff / student accounts have no family: verify against the mobile number on the person record. */
export function phoneMatchesPerson(db, personId, phone) {
  const d = digits(phone);
  const m = digits(db.prepare('SELECT mobile FROM persons WHERE id = ?').get(personId)?.mobile);
  return d.length >= 7 && m.length >= 7 && m.endsWith(d.slice(-7));
}
export function setPassword(db, userId, newPassword, actorId = null) {
  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0, failed_attempts = 0, locked_until = NULL, updated_at = ?, updated_by = ? WHERE id = ?')
    .run(hashPassword(newPassword), nowIso(), actorId || userId, userId);
  audit(db, 'users', userId, 'password_changed', null, null, actorId || userId);
}
export function markUsed(db, table, id) { db.prepare(`UPDATE ${table} SET used_at = ? WHERE id = ?`).run(nowIso(), id); }
