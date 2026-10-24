// src/portal/r-announce.js — Class Announcements: read (parents, students, teachers, staff) and post / edit / delete (teachers and room
// parents of their classes; staff with the entity permission).
import { csrfMiddleware } from '../middleware/csrf.js';
import { can } from './perm.js';
import { currentYear } from './fees.js';
import { audit } from './crud.js';
import { portalHelpers, s } from './util.js';
import { visibleAnnouncements, postableClassIds, readableClassIds, mayPostIn, notifyClassFamilies } from './announcements.js';
import { classById, classAnnouncementById } from '../queries/classes.js';

export function registerClassAnnouncementRoutes(app, { db, page, requireLogin }) {
  const { go, forbidden, staffCan } = portalHelpers(page);
  const R = '/:lang/portal';
  const mayUse = (req) => can(req.portal.access, 'class_announcements.list') || can(req.portal.access, 'class_announcements.post_own') || can(req.portal.access, 'class_announcements.view_own');
  const classRow = (id) => classById(db, id);
  // may this user change this announcement? (poster of that class, or staff with update / delete rights)
  const mayManage = (req, ann, action) => staffCan(req, `class_announcements.${action}`) || (can(req.portal.access, 'class_announcements.post_own') && mayPostIn(db, req.portal, ann.school_class_id));

  app.get(`${R}/class-announcements`, requireLogin, (req, res) => {
    if (!mayUse(req)) return forbidden(req, res);
    const year = currentYear(db);
    const classId = Number(req.query.class) || null;
    const posts = visibleAnnouncements(db, req.portal, { classId, limit: 100 }).map((p) => ({ ...p, canEdit: mayManage(req, p, 'update'), canDelete: mayManage(req, p, 'delete') }));
    const postable = postableClassIds(db, req.portal);
    const classes = db.prepare(`SELECT id, code, name_en, name_zh FROM school_classes WHERE id IN (${[0, ...readableClassIds(db, req.portal)].map(() => '?').join(',')}) ORDER BY code`).all(0, ...readableClassIds(db, req.portal));
    const postClasses = classes.filter((c) => postable.includes(c.id));
    const edit = Number(req.query.edit) ? classAnnouncementById(db, req.query.edit) : null;
    page(req, res, 'class-announcements.ejs', { year, posts, classes, postClasses, classId, edit: edit && mayManage(req, edit, 'update') ? edit : null, v: {}, errors: {} }, { title: 'Class Announcements' });
  });

  const fields = (b) => ({ school_class_id: Number(b.school_class_id) || 0, title_en: s(b.title_en), title_zh: s(b.title_zh), body_en: s(b.body_en), body_zh: s(b.body_zh), pinned: b.pinned ? 1 : 0 });
  const invalid = (req, res, f, id) => {
    const errors = {};
    if (!f.school_class_id || !classRow(f.school_class_id)) errors.school_class_id = 'required';
    if (!f.title_en && !f.title_zh) errors.title_en = 'a title is required (English or 中文)';
    if (!f.body_en && !f.body_zh) errors.body_en = 'a message is required';
    if (!Object.keys(errors).length) return false;
    const year = currentYear(db);
    const classes = db.prepare('SELECT id, code, name_en, name_zh FROM school_classes WHERE school_year_id = ? AND deleted_at IS NULL ORDER BY code').all(year.id);
    const posts = visibleAnnouncements(db, req.portal, { limit: 100 }).map((p) => ({ ...p, canEdit: mayManage(req, p, 'update'), canDelete: mayManage(req, p, 'delete') }));
    const postable = postableClassIds(db, req.portal);
    page(req, res, 'class-announcements.ejs', { year, posts, classes, postClasses: classes.filter((c) => postable.includes(c.id)), classId: null, edit: id ? { id } : null, v: f, errors }, { title: 'Class Announcements', status: 400 });
    return true;
  };

  app.post(`${R}/class-announcements`, requireLogin, csrfMiddleware, (req, res) => {
    const f = fields(req.body);
    if (!mayPostIn(db, req.portal, f.school_class_id)) return forbidden(req, res);
    if (invalid(req, res, f, null)) return;
    const uid = req.portal.user.id;
    const r = db.prepare('INSERT INTO class_announcements (school_class_id, title_en, title_zh, body_en, body_zh, pinned, posted_by_user_id, created_by, updated_by) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(f.school_class_id, f.title_en, f.title_zh, f.body_en, f.body_zh, f.pinned, uid, uid, uid);
    const id = Number(r.lastInsertRowid);
    audit(db, 'class_announcements', id, 'create', null, { class: f.school_class_id }, uid, req.ip);
    let msg = 'Announcement posted. 已發佈。';
    if (req.body.notify) { const n = notifyClassFamilies(db, { id, ...f }, classRow(f.school_class_id)); msg += ` (${n} e-mails queued 已排入 ${n} 封電郵)`; }
    go(req, res, `/class-announcements?class=${f.school_class_id}`, { type: 'ok', msg });
  });

  app.post(`${R}/class-announcements/:id`, requireLogin, csrfMiddleware, (req, res) => {
    const ann = classAnnouncementById(db, req.params.id);
    if (!ann || !mayManage(req, ann, 'update')) return forbidden(req, res);
    const f = fields({ ...req.body, school_class_id: ann.school_class_id });          // the class cannot be moved
    if (invalid(req, res, f, ann.id)) return;
    const uid = req.portal.user.id;
    db.prepare("UPDATE class_announcements SET title_en=?, title_zh=?, body_en=?, body_zh=?, pinned=?, updated_at=datetime('now'), updated_by=? WHERE id=?").run(f.title_en, f.title_zh, f.body_en, f.body_zh, f.pinned, uid, ann.id);
    audit(db, 'class_announcements', ann.id, 'update', null, null, uid, req.ip);
    go(req, res, `/class-announcements?class=${ann.school_class_id}`, { type: 'ok', msg: 'Announcement saved. 已儲存。' });
  });

  app.post(`${R}/class-announcements/:id/delete`, requireLogin, csrfMiddleware, (req, res) => {
    const ann = classAnnouncementById(db, req.params.id);
    if (!ann || !mayManage(req, ann, 'delete')) return forbidden(req, res);
    const uid = req.portal.user.id;
    db.prepare("UPDATE class_announcements SET deleted_at = datetime('now'), updated_at = datetime('now'), updated_by = ? WHERE id = ?").run(uid, ann.id);
    audit(db, 'class_announcements', ann.id, 'delete', null, null, uid, req.ip);
    go(req, res, '/class-announcements', { type: 'ok', msg: 'Announcement deleted. 已刪除。' });
  });
}
