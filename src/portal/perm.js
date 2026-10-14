// src/portal/perm.js — roles, permissions, default grants, and per-user access loading.
import { todayLocal } from '../datetime.js';
import { ENTITIES, entityPermissions, SPECIAL_PERMISSIONS, entityActions } from './entities.js';

const READ = ['list', 'view', 'export'];
const CRUD = ['list', 'view', 'create', 'update', 'delete', 'export'];
const E = (perm, acts) => acts.map((a) => [`${perm}.${a}`, 'all']);
const S = (...codes) => codes.map((c) => [c, 'all']);
const own = (code, scope) => [[code, scope]];

const SETUP_READ = ['school_years', 'class_types', 'class_levels', 'rooms', 'textbooks', 'student_types', 'school_districts', 'assignment_roles',
  'transaction_types', 'payment_methods', 'scrip_products', 'volunteer_jobs', 'waivers'].flatMap((p) => E(p, READ));

// ---- Board of Directors roles: one portal role per board position (titles as on the public Board page) ----
const LOOKUP_READ = ['persons', 'families', 'enrollments', 'registrations', 'transactions', 'volunteer_signups', 'student_school_info', 'withdrawals', 'classes'];
const BOARD_ROLES = [
  { code: 'board_president', position: 'President', zh: '理事長', pzh: '理事長', sort: 20, desc: 'Leads the board; sees everything (read-only) and manages events, banners, announcements and board members.', grants: [
    ...S('portal.staff', 'reports.class_roster', 'finance.reports'), ...LOOKUP_READ.flatMap((p) => E(p, READ)), ...E('events', CRUD), ...E('slides', CRUD), ...E('announcements', CRUD), ...E('class_announcements', CRUD),
    ...E('board_members', CRUD), ...E('board_positions', READ), ...E('documents', READ), ...E('student_list', READ), ...E('volunteer_list', READ), ...SETUP_READ] },
  { code: 'board_vice_president', position: 'Vice President', zh: '副理事長', pzh: '副理事長', sort: 21, desc: 'Supports the president; read-only view of the school plus events and announcements.', grants: [
    ...S('portal.staff', 'reports.class_roster', 'finance.reports'), ...LOOKUP_READ.flatMap((p) => E(p, READ)), ...E('events', CRUD), ...E('announcements', CRUD), ...E('class_announcements', READ),
    ...E('board_members', READ), ...E('board_positions', READ), ...E('student_list', READ), ...E('volunteer_list', READ), ...SETUP_READ] },
  { code: 'board_secretary', position: 'Secretary', zh: '執行祕書', pzh: '執行祕書', sort: 22, desc: 'Board secretary: meetings, events, public and class announcements.', grants: [
    ...S('portal.staff', 'reports.class_roster'), ...E('persons', ['list', 'view']), ...E('families', ['list', 'view']), ...E('events', CRUD), ...E('announcements', CRUD), ...E('class_announcements', CRUD), ...E('slides', READ),
    ...E('board_members', READ), ...E('board_positions', READ), ...E('student_list', READ), ...E('volunteer_list', READ), ...SETUP_READ] },
  { code: 'board_treasurer', position: 'Treasurer', zh: '財務理事', pzh: '財務理事', sort: 23, desc: 'Money: payments, voids, fees, transactions and finance reports.', grants: [
    ...S('portal.staff', 'finance.record_payment', 'finance.void', 'fees.configure', 'finance.reports'),
    ...['transactions', 'fee_schedules', 'withdrawal_fee_rules', 'scrip_products', 'payment_methods', 'transaction_types', 'withdrawals'].flatMap((p) => E(p, CRUD)),
    ...['persons', 'families', 'registrations', 'enrollments', 'classes', 'school_years', 'student_list'].flatMap((p) => E(p, READ)), ...E('registrations', ['update']), ...E('events', READ)] },
  { code: 'board_editorial', position: 'Editorial Director', zh: '編輯組理事', pzh: '編輯組理事', sort: 24, desc: 'Publications and the website: banners, public announcements, events, class announcements.', grants: [
    ...S('portal.staff'), ...E('slides', CRUD), ...E('announcements', CRUD), ...E('events', CRUD), ...E('class_announcements', CRUD), ...E('documents', READ), ...E('student_list', READ), ...E('volunteer_list', READ), ...SETUP_READ] },
  { code: 'board_pta', position: 'PTA Director', zh: '家長會理事', pzh: '家長會理事', sort: 25, desc: 'Parent volunteers: jobs, sign-ups and the volunteer list.', grants: [
    ...S('portal.staff'), ...E('volunteer_jobs', CRUD), ...E('volunteer_signups', CRUD), ...E('volunteer_list', READ), ...E('events', READ), ...E('persons', ['list', 'view']), ...E('families', ['list', 'view']), ...E('school_years', READ)] },
  { code: 'board_scrip', position: 'Scrip Director', zh: '禮券組理事', pzh: '禮券組理事', sort: 26, desc: 'Scrip (gift card) fundraising: products, purchases and the scrip report.', grants: [
    ...S('portal.staff', 'finance.reports', 'finance.record_scrip'), ...E('scrip_products', CRUD), ...E('transactions', READ), ...E('persons', ['list', 'view']), ...E('families', ['list', 'view']),
    ...E('school_years', READ), ...E('payment_methods', READ), ...E('transaction_types', READ)] },
  { code: 'board_activity', position: 'Activity Director', zh: '活動組理事', pzh: '活動組理事', sort: 27, desc: 'School activities and contests: events, announcements, the calendar.', grants: [
    ...S('portal.staff'), ...E('events', CRUD), ...E('announcements', CRUD), ...E('class_announcements', CRUD), ...E('volunteer_list', READ), ...E('student_list', READ), ...SETUP_READ] },
  { code: 'board_operation', position: 'Operation Director', zh: '業務組理事', pzh: '業務組理事', sort: 28, desc: 'Operations: classrooms, textbooks, classes and rosters.', grants: [
    ...S('portal.staff', 'reports.class_roster'), ...E('rooms', CRUD), ...E('textbooks', CRUD), ...E('classes', CRUD), ...E('assignments', CRUD), ...E('enrollments', READ), ...E('student_list', READ), ...E('volunteer_list', READ), ...E('events', READ), ...SETUP_READ] },
].map((r) => ({ ...r, grants: [...r.grants, ...E('slides', CRUD)] })).map((r) => ({ code: r.code, en: `${r.position} (Board)`, zh: `${r.zh} (理事)`, staff: 1, sort: r.sort, type: 'board', desc: r.desc, grants: r.grants, boardPosition: r.position, boardPositionZh: r.pzh }));

/** Board positions in the public order; each one maps to a role above. */
export const BOARD_POSITIONS = BOARD_ROLES.map((r, i) => ({ code: r.code.replace(/^board_/, ''), name_en: r.boardPosition, name_zh: r.boardPositionZh, role_code: r.code, sort: i + 1 }));

/** Default roles. Admin gets everything (computed); others as listed. */
export const ROLE_DEFS = [
  { code: 'admin', en: 'Admin', zh: '系統管理員', staff: 1, sort: 1, type: 'staff', desc: 'Full access, including role & permission management.', grants: 'ALL' },
  { code: 'principal', en: 'Principal', zh: '校長', staff: 1, sort: 2, type: 'staff', desc: 'Oversees classes, staff, rosters and reports.', grants: [
    ...S('portal.staff', 'dashboard.principal', 'reports.class_roster'),
    ...['persons', 'families', 'enrollments', 'classes', 'registrations', 'volunteer_signups', 'student_school_info', 'credit_grades', 'transactions', 'withdrawals'].flatMap((p) => E(p, READ)),
    ...E('assignments', CRUD), ...E('events', CRUD), ...E('slides', CRUD), ...E('announcements', CRUD), ...E('class_announcements', CRUD), ...E('documents', READ), ...E('board_members', READ), ...E('board_positions', READ), ...S('finance.reports'), ...E('student_list', READ), ...E('volunteer_list', READ), ...SETUP_READ] },
  { code: 'secretary', en: 'Secretary / Registrar', zh: '秘書/註冊組', staff: 1, sort: 3, type: 'staff', desc: 'Registration desk: people, families, enrollments, payments, exports.', grants: [
    ...S('portal.staff', 'dashboard.secretary', 'finance.record_payment', 'placement.assign', 'withdrawal.process', 'reports.class_roster'),
    ...['persons', 'families', 'family_members', 'parent_students', 'enrollments', 'student_school_info', 'assignments', 'volunteer_signups', 'withdrawals', 'events', 'announcements', 'class_announcements'].flatMap((p) => E(p, CRUD)), ...E('slides', READ), ...E('documents', READ),
    ...['registrations', 'transactions', 'classes', 'credit_grades', 'users', 'student_list', 'volunteer_list'].flatMap((p) => E(p, READ)), ...E('registrations', ['update']), ...SETUP_READ] },
  { code: 'accountant', en: 'Accountant / Treasurer', zh: '財務', staff: 1, sort: 4, type: 'staff', desc: 'Payments, fees and receipts.', grants: [
    ...S('portal.staff', 'dashboard.finance', 'finance.record_payment', 'finance.void', 'fees.configure', 'finance.reports'),
    ...['transactions', 'fee_schedules', 'withdrawal_fee_rules', 'scrip_products', 'payment_methods', 'transaction_types', 'withdrawals'].flatMap((p) => E(p, CRUD)),
    ...['persons', 'families', 'registrations', 'enrollments', 'classes', 'school_years', 'student_list'].flatMap((p) => E(p, READ)), ...E('registrations', ['update'])] },
  { code: 'teacher', en: 'Teacher / Instructor', zh: '老師', staff: 1, sort: 5, type: 'staff', desc: 'Sees the class list of own classes; enters credit grades.', grants: [
    ...own('class.view_own', 'own_classes'), ...own('grades.enter_own_classes', 'own_classes'), ...own('class_announcements.post_own', 'own_classes'), ...S('portal.staff')] },
  { code: 'pta_coordinator', en: 'PTA / Volunteer Coordinator', zh: '家長會義工組', staff: 1, sort: 6, type: 'staff', desc: 'Volunteer jobs, sign-ups and the volunteer list.', grants: [
    ...S('portal.staff', 'dashboard.pta'), ...E('volunteer_jobs', CRUD), ...E('volunteer_signups', CRUD), ...E('volunteer_list', READ), ...E('events', READ),
    ...E('persons', ['list', 'view']), ...E('families', ['list', 'view']), ...E('school_years', READ)] },
  { code: 'room_parent', en: 'Room Parent', zh: '班媽/班爸', staff: 0, sort: 7, type: 'room_parent', desc: 'A parent who also helps a classroom.', grants: [...own('class.view_own', 'own_classes'), ...own('class_announcements.post_own', 'own_classes')] },
  { code: 'parent', en: 'Parent', zh: '家長', staff: 0, sort: 8, type: 'parent', desc: 'Manages own family, registers children, volunteers, sees payments.', grants: [
    ...own('family.own', 'own_family'), ...own('registration.own', 'own_family'), ...own('volunteer.own', 'own_family'), ...own('transactions.own', 'own_family'), ...own('grades.view_own', 'own_family'), ...own('class_announcements.view_own', 'own_family')] },
  { code: 'volunteer', en: 'Volunteer', zh: '義工', staff: 0, sort: 9, type: 'volunteer', desc: 'Volunteer sign-ups.', grants: [...own('volunteer.own', 'own_family')] },
  ...BOARD_ROLES,
  { code: 'student', en: 'Student (credit class)', zh: '學生 (學分班)', staff: 0, sort: 10, type: 'student', desc: 'Own school, class, teacher and credit grades only.', grants: [
    ...own('student.own', 'own_record'), ...own('grades.view_own', 'own_record'), ...own('class_announcements.view_own', 'own_record')] },
];


export const USER_TYPES = [
  ['staff', 'Staff', '員工'], ['board', 'Board Member', '理事'], ['parent', 'Parent', '家長'], ['room_parent', 'Room Parent', '班媽/班爸'], ['volunteer', 'Volunteer', '義工'], ['student', 'Student', '學生'],
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
    WHERE ur.user_id = ? AND ur.deleted_at IS NULL AND r.deleted_at IS NULL AND (ur.ends_on IS NULL OR ur.ends_on >= ?) ORDER BY r.sort`).all(userId, todayLocal());
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
