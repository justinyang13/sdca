// src/portal/overview.js — the "School overview" on the dashboard: A–Z count tiles and four charts (class sizes, students per year,
// registration status, volunteer jobs). Shown to the admin, every board member and the school secretary.
import { can } from './perm.js';

const ENROLLED = "e.status IN ('registered','placed') AND e.deleted_at IS NULL";
const TODAY = "date('now','localtime')";

// One tile per row: sql counts rows (":y" = the current school year id); perm = the list permission that makes the tile a link.
const TILES = [
  { en: 'Families', zh: '家庭', path: '/manage/families', perm: 'families', sql: 'SELECT COUNT(*) n FROM families WHERE deleted_at IS NULL' },
  { en: 'Directory', zh: '通訊錄', path: '/manage/persons', perm: 'persons', sql: 'SELECT COUNT(*) n FROM persons WHERE deleted_at IS NULL' },
  { en: 'Students this year', zh: '本學年學生', path: '/manage/enrollments', perm: 'enrollments', year: true, sql: `SELECT COUNT(*) n FROM enrollments e WHERE e.school_year_id = :y AND ${ENROLLED}` },
  { en: 'Classes', zh: '班級', path: '/manage/school_classes', perm: 'classes', year: true, sql: 'SELECT COUNT(*) n FROM school_classes WHERE school_year_id = :y AND deleted_at IS NULL' },
  { en: 'Users', zh: '用戶', path: '/manage/users', perm: 'users', sql: 'SELECT COUNT(*) n FROM users WHERE deleted_at IS NULL' },
  { en: 'Transactions this year', zh: '本學年交易', path: '/manage/transactions', perm: 'transactions', year: true, sql: 'SELECT COUNT(*) n FROM transactions WHERE school_year_id = :y AND voided_at IS NULL AND deleted_at IS NULL' },
  { en: 'Events', zh: '活動', path: '/manage/events', perm: 'events', sql: 'SELECT COUNT(*) n FROM events WHERE deleted_at IS NULL' },
  { en: 'Announcements', zh: '公開通告', path: '/manage/announcements', perm: 'announcements', sql: 'SELECT COUNT(*) n FROM announcements WHERE published = 1 AND deleted_at IS NULL' },
  { en: 'Class announcements', zh: '班級通告', path: '/class-announcements', perm: 'class_announcements', sql: 'SELECT COUNT(*) n FROM class_announcements WHERE deleted_at IS NULL' },
  { en: 'Volunteers', zh: '義工', path: '/manage/volunteer_signups', perm: 'volunteer_signups', year: true, sql: 'SELECT COUNT(DISTINCT person_id) n FROM volunteer_signups WHERE school_year_id = :y AND deleted_at IS NULL' },
  { en: 'Room parents', zh: '班媽/班爸', path: '/class-roster', code: 'reports.class_roster', year: true,
    sql: "SELECT COUNT(DISTINCT ca.person_id) n FROM class_assignments ca JOIN assignment_roles ar ON ar.id = ca.assignment_role_id WHERE ca.school_year_id = :y AND ar.code = 'room_parent' AND ca.deleted_at IS NULL" },
  { en: 'Teachers and assistants', zh: '老師與助教', path: '/class-roster', code: 'reports.class_roster', year: true,
    sql: "SELECT COUNT(DISTINCT ca.person_id) n FROM class_assignments ca JOIN assignment_roles ar ON ar.id = ca.assignment_role_id WHERE ca.school_year_id = :y AND ar.code <> 'room_parent' AND ca.deleted_at IS NULL" },
  { en: 'Board members', zh: '理事', path: '/manage/board_members', perm: 'board_members',
    sql: `SELECT COUNT(DISTINCT person_id) n FROM board_members WHERE deleted_at IS NULL AND (start_date IS NULL OR start_date <= ${TODAY}) AND (end_date IS NULL OR end_date >= ${TODAY})` },
];

/** Who sees the overview: the admin, every board role and the school secretary. */
export const showsOverview = (a) => can(a, 'dashboard.admin') || a.roleCodes.some((c) => c.startsWith('board_') || c === 'secretary');

/** { tiles (sorted A–Z in the page language), charts }. `extraTiles` are added before sorting (the admin's e-mail outbox). */
export function buildOverview(db, a, year, { zh = false, extraTiles = [] } = {}) {
  const run = (sql) => (/:y\b/.test(sql) ? (year ? db.prepare(sql.replace(/:y\b/g, '?')).get(year.id)?.n ?? 0 : 0) : db.prepare(sql).get()?.n ?? 0);
  const tiles = TILES.map((t) => ({ n: run(t.sql), en: t.en, zh: t.zh, path: t.path, ok: t.code ? can(a, t.code) : can(a, `${t.perm}.list`) }))
    .concat(extraTiles.map((t) => ({ ...t, ok: can(a, `${t.perm}.list`) })))
    .sort((x, y) => (zh ? x.zh.localeCompare(y.zh, 'zh-Hant') : x.en.localeCompare(y.en)));
  const all = (sql) => (year ? db.prepare(sql).all(year.id) : []);
  const charts = {
    classes: all(`SELECT sc.code, sc.name_en, sc.name_zh, sc.capacity, (SELECT COUNT(*) FROM enrollments e WHERE e.school_class_id = sc.id AND ${ENROLLED}) AS n
      FROM school_classes sc WHERE sc.school_year_id = ? AND sc.deleted_at IS NULL ORDER BY sc.code`),
    years: db.prepare(`SELECT y.label, (SELECT COUNT(*) FROM enrollments e WHERE e.school_year_id = y.id AND ${ENROLLED}) AS n FROM school_years y WHERE y.deleted_at IS NULL ORDER BY y.label`).all(),
    jobs: all(`SELECT j.name_en, j.name_zh, SUM(s.status = 'requested') AS requested, SUM(s.status = 'assigned') AS assigned, SUM(s.status = 'completed') AS completed
      FROM volunteer_signups s JOIN volunteer_jobs j ON j.id = COALESCE(s.assigned_job_id, s.job_id)
      WHERE s.school_year_id = ? AND s.deleted_at IS NULL AND s.status <> 'declined' GROUP BY j.id ORDER BY j.sort, j.name_en`),
  };
  const regs = all('SELECT status, COUNT(*) n FROM registrations WHERE school_year_id = ? AND deleted_at IS NULL GROUP BY status');
  return { tiles, charts, regs };
}
