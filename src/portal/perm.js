// src/portal/perm.js — roles, permissions, default grants, and per-user access loading.
import { ENTITIES, entityPermissions, SPECIAL_PERMISSIONS, entityActions } from './entities.js';

const READ = ['list', 'view', 'export'];
const CRUD = ['list', 'view', 'create', 'update', 'delete', 'export'];
const E = (perm, acts) => acts.map((a) => [`${perm}.${a}`, 'all']);
const S = (...codes) => codes.map((c) => [c, 'all']);
const own = (code, scope) => [[code, scope]];

const SETUP_READ = ['school_years', 'class_types', 'class_levels', 'rooms', 'textbooks', 'student_types', 'school_districts', 'assignment_roles',
  'transaction_types', 'payment_methods', 'scrip_products', 'volunteer_jobs', 'waivers'].flatMap((p) => E(p, READ));

/** Default roles. Admin gets everything (computed); others as listed. */
export const ROLE_DEFS = [
  { code: 'admin', en: 'Admin', zh: '系統管理員', staff: 1, sort: 1, type: 'staff', desc: 'Full access, including role & permission management.', grants: 'ALL' },
  { code: 'principal', en: 'Principal', zh: '校長', staff: 1, sort: 2, type: 'staff', desc: 'Oversees classes, staff, rosters and reports.', grants: [
    ...S('portal.staff', 'dashboard.principal', 'reports.class_roster'),
    ...['persons', 'families', 'enrollments', 'classes', 'registrations', 'volunteer_signups', 'student_school_info', 'credit_grades', 'transactions', 'withdrawals'].flatMap((p) => E(p, READ)),
    ...E('assignments', CRUD), ...E('student_list', READ), ...E('volunteer_list', READ), ...SETUP_READ] },
  { code: 'secretary', en: 'Secretary / Registrar', zh: '秘書/註冊組', staff: 1, sort: 3, type: 'staff', desc: 'Registration desk: people, families, enrollments, payments, exports.', grants: [
    ...S('portal.staff', 'dashboard.secretary', 'finance.record_payment', 'placement.assign', 'withdrawal.process', 'reports.class_roster'),
    ...['persons', 'families', 'family_members', 'parent_students', 'enrollments', 'student_school_info', 'assignments', 'volunteer_signups', 'withdrawals'].flatMap((p) => E(p, CRUD)),
    ...['registrations', 'transactions', 'classes', 'credit_grades', 'users', 'student_list', 'volunteer_list'].flatMap((p) => E(p, READ)), ...E('registrations', ['update']), ...SETUP_READ] },
  { code: 'accountant', en: 'Accountant / Treasurer', zh: '財務', staff: 1, sort: 4, type: 'staff', desc: 'Payments, fees and receipts.', grants: [
    ...S('portal.staff', 'dashboard.finance', 'finance.record_payment', 'finance.void', 'fees.configure'),
    ...['transactions', 'fee_schedules', 'withdrawal_fee_rules', 'scrip_products', 'payment_methods', 'transaction_types', 'withdrawals'].flatMap((p) => E(p, CRUD)),
    ...['persons', 'families', 'registrations', 'enrollments', 'classes', 'school_years', 'student_list'].flatMap((p) => E(p, READ)), ...E('registrations', ['update'])] },
  { code: 'teacher', en: 'Teacher / Instructor', zh: '老師', staff: 1, sort: 5, type: 'staff', desc: 'Sees the class list of own classes; enters credit grades.', grants: [
    ...own('class.view_own', 'own_classes'), ...own('grades.enter_own_classes', 'own_classes'), ...S('portal.staff')] },
  { code: 'pta_coordinator', en: 'PTA / Volunteer Coordinator', zh: '家長會義工組', staff: 1, sort: 6, type: 'staff', desc: 'Volunteer jobs, sign-ups and the volunteer list.', grants: [
    ...S('portal.staff', 'dashboard.pta'), ...E('volunteer_jobs', CRUD), ...E('volunteer_signups', CRUD), ...E('volunteer_list', READ),
    ...E('persons', ['list', 'view']), ...E('families', ['list', 'view']), ...E('school_years', READ)] },
  { code: 'room_parent', en: 'Room Parent', zh: '班媽/班爸', staff: 0, sort: 7, type: 'room_parent', desc: 'A parent who also helps a classroom.', grants: [...own('class.view_own', 'own_classes')] },
  { code: 'parent', en: 'Parent', zh: '家長', staff: 0, sort: 8, type: 'parent', desc: 'Manages own family, registers children, volunteers, sees payments.', grants: [
    ...own('family.own', 'own_family'), ...own('registration.own', 'own_family'), ...own('volunteer.own', 'own_family'), ...own('transactions.own', 'own_family'), ...own('grades.view_own', 'own_family')] },
  { code: 'volunteer', en: 'Volunteer', zh: '義工', staff: 0, sort: 9, type: 'volunteer', desc: 'Volunteer sign-ups.', grants: [...own('volunteer.own', 'own_family')] },
  { code: 'student', en: 'Student (credit class)', zh: '學生 (學分班)', staff: 0, sort: 10, type: 'student', desc: 'Own school, class, teacher and credit grades only.', grants: [
    ...own('student.own', 'own_record'), ...own('grades.view_own', 'own_record')] },
];

export const USER_TYPES = [
  ['staff', 'Staff', '員工'], ['parent', 'Parent', '家長'], ['room_parent', 'Room Parent', '班媽/班爸'], ['volunteer', 'Volunteer', '義工'], ['student', 'Student', '學生'],
];

export function allPermissionDefs() { return [...entityPermissions(), ...SPECIAL_PERMISSIONS]; }

/** Idempotent: create permissions, roles and (for roles that have no grants yet) default grants. */
export function seedRolesAndPermissions(db, { resetGrants = false } = {}) {
  const permDefs = allPermissionDefs();
  const known = new Set(db.prepare('SELECT code FROM permissions').all().map((r) => r.code));   // permissions that existed before this run
  const insP = db.prepare('INSERT OR IGNORE INTO permissions (code, resource, action, description) VALUES (?,?,?,?)');
  for (const p of permDefs) insP.run(p.code, p.resource, p.action, p.description);
  const pid = new Map(db.prepare('SELECT id, code FROM permissions').all().map((r) => [r.code, r.id]));
  const insT = db.prepare('INSERT OR IGNORE INTO user_types (code, name_en, name_zh, landing_route, sort) VALUES (?,?,?,?,?)');
  USER_TYPES.forEach(([c, en, zh], i) => insT.run(c, en, zh, '/portal', i + 1));
  for (const r of ROLE_DEFS) {
    db.prepare('INSERT OR IGNORE INTO roles (code, name_en, name_zh, description, is_staff, is_system, sort) VALUES (?,?,?,?,?,1,?)').run(r.code, r.en, r.zh, r.desc, r.staff, r.sort);
    const rid = db.prepare('SELECT id FROM roles WHERE code = ?').get(r.code).id;
    const has = db.prepare('SELECT COUNT(*) AS n FROM role_permissions WHERE role_id = ? AND deleted_at IS NULL').get(rid).n;
    const grants0 = r.grants === 'ALL' ? permDefs.map((p) => [p.code, 'all']) : r.grants;
    if (has && !resetGrants) {   // existing role: only add defaults for brand-new permissions (never re-grant what an admin removed)
      const insN = db.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_id, scope) VALUES (?,?,?)');
      for (const [code, scope] of grants0) if (!known.has(code) && pid.has(code)) insN.run(rid, pid.get(code), scope);
      continue;
    }
    if (resetGrants) db.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(rid);
    const grants = r.grants === 'ALL' ? permDefs.map((p) => [p.code, 'all']) : r.grants;
    const ins = db.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_id, scope) VALUES (?,?,?)');
    for (const [code, scope] of grants) if (pid.has(code)) ins.run(rid, pid.get(code), scope);
  }
}

const RANK = { all: 3, own_classes: 2, own_family: 2, own_record: 2 };

/** Load a user's effective roles + permissions (best scope per permission). */
export function loadAccess(db, userId) {
  const roles = db.prepare(`SELECT DISTINCT r.id, r.code, r.name_en, r.name_zh, r.is_staff FROM user_roles ur JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = ? AND ur.deleted_at IS NULL AND r.deleted_at IS NULL AND (ur.ends_on IS NULL OR ur.ends_on >= date('now')) ORDER BY r.sort`).all(userId);
  const perms = new Map();
  if (roles.length) {
    const rows = db.prepare(`SELECT p.code, rp.scope FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.deleted_at IS NULL AND rp.role_id IN (${roles.map(() => '?').join(',')})`).all(...roles.map((r) => r.id));
    for (const { code, scope } of rows) if (!perms.has(code) || RANK[scope] > RANK[perms.get(code)]) perms.set(code, scope);
  }
  return { roles, roleCodes: roles.map((r) => r.code), perms };
}

export const can = (access, code) => !!access && access.perms.has(code);
export const canAll = (access, code) => !!access && access.perms.get(code) === 'all';
export const hasRole = (access, ...codes) => !!access && codes.some((c) => access.roleCodes.includes(c));

export { ENTITIES, entityActions };
