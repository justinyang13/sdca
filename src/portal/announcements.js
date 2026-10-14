// src/portal/announcements.js — class announcements: who may read / post in which class, and the queries behind the pages.
import { can, canAll } from './perm.js';
import { currentYear } from './fees.js';
import { myClassIds, familyOfStudent } from './auth.js';
import { placementVisible } from './r-home.js';
import { audit } from './crud.js';
import { queueEmail } from './auth.js';
import { nowUtc } from '../datetime.js';

/** Ids of the classes (this school year) the signed-in user may READ announcements of. */
export function readableClassIds(db, portal) {
  const a = portal.access; const year = currentYear(db);
  if (!year) return [];
  if (canAll(a, 'class_announcements.list')) return db.prepare('SELECT id FROM school_classes WHERE school_year_id = ? AND deleted_at IS NULL').all(year.id).map((r) => r.id);
  const ids = new Set();
  if (can(a, 'class_announcements.post_own')) myClassIds(db, portal.person.id).forEach((id) => ids.add(id));
  const showPlacement = placementVisible(year);
  if (can(a, 'class_announcements.view_own') && showPlacement) {
    // parents: classes of their children; students: their own class
    const kids = portal.familyIds.length
      ? db.prepare(`SELECT person_id FROM family_members WHERE family_id IN (${portal.familyIds.map(() => '?').join(',')}) AND relationship = 'child' AND deleted_at IS NULL`).all(...portal.familyIds).map((r) => r.person_id)
      : [portal.person.id];
    if (kids.length) {
      db.prepare(`SELECT DISTINCT school_class_id AS id FROM enrollments WHERE school_year_id = ? AND student_person_id IN (${kids.map(() => '?').join(',')}) AND school_class_id IS NOT NULL
        AND status IN ('registered','placed') AND deleted_at IS NULL`).all(year.id, ...kids).forEach((r) => ids.add(r.id));
    }
  }
  return [...ids];
}

/** Classes the user may POST in. */
export function postableClassIds(db, portal) {
  const a = portal.access; const year = currentYear(db);
  if (!year) return [];
  if (canAll(a, 'class_announcements.create')) return db.prepare('SELECT id FROM school_classes WHERE school_year_id = ? AND deleted_at IS NULL').all(year.id).map((r) => r.id);
  return can(a, 'class_announcements.post_own') ? myClassIds(db, portal.person.id) : [];
}

export const mayPostIn = (db, portal, classId) => postableClassIds(db, portal).includes(Number(classId));

/** Announcements the user can read, pinned first then newest; optional class filter and limit. */
export function visibleAnnouncements(db, portal, { classId = null, limit = 50 } = {}) {
  let ids = readableClassIds(db, portal);
  if (classId) ids = ids.filter((id) => id === Number(classId));
  if (!ids.length) return [];
  return db.prepare(`SELECT ca.*, sc.code AS class_code, sc.name_en AS class_en, sc.name_zh AS class_zh,
      (SELECT p.english_first_name || ' ' || p.english_last_name || ' ' || p.chinese_name FROM users u JOIN persons p ON p.id = u.person_id WHERE u.id = ca.posted_by_user_id) AS author
    FROM class_announcements ca JOIN school_classes sc ON sc.id = ca.school_class_id
    WHERE ca.deleted_at IS NULL AND ca.school_class_id IN (${ids.map(() => '?').join(',')})
    ORDER BY ca.pinned DESC, ca.created_at DESC, ca.id DESC LIMIT ?`).all(...ids, limit);
}

/** E-mail (outbox) the families of a class about a new announcement. Returns how many addresses. */
export function notifyClassFamilies(db, ann, classRow) {
  const rows = db.prepare(`SELECT DISTINCT f.email FROM enrollments e JOIN family_members fm ON fm.person_id = e.student_person_id AND fm.relationship = 'child' AND fm.deleted_at IS NULL
    JOIN families f ON f.id = fm.family_id WHERE e.school_class_id = ? AND e.status IN ('registered','placed') AND e.deleted_at IS NULL AND f.email <> '' AND f.deleted_at IS NULL`).all(classRow.id);
  const title = ann.title_en || ann.title_zh;
  for (const r of rows) queueEmail(db, { to: r.email, template: 'class_announcement', subject: `[${classRow.code}] ${title}`,
    body: `${ann.title_en ? ann.title_en + '\n' + ann.body_en : ''}\n\n${ann.title_zh ? ann.title_zh + '\n' + ann.body_zh : ''}`.trim(), relatedType: 'class_announcements', relatedId: ann.id });
  db.prepare('UPDATE class_announcements SET emailed_at = ? WHERE id = ?').run(nowUtc(), ann.id);
  return rows.length;
}
export { audit, familyOfStudent };
