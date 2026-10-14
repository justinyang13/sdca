// src/portal/r-volunteer.js — PTA volunteer sign-up (up to three priorities, or "I cannot volunteer").
import { csrfMiddleware } from '../middleware/csrf.js';
import { can } from './perm.js';
import { currentYear } from './fees.js';
import { ownsFamily, parentFamilyIds } from './auth.js';
import { audit } from './crud.js';
import { portalHelpers } from './util.js';

export function registerVolunteerRoutes(app, { db, page, requireLogin }) {
  const { go, forbidden } = portalHelpers(page);
  const R = '/:lang/portal';
  const familyFor = (req) => {
    const q = Number(req.query.family || req.body?.family || 0);
    if (q && (ownsFamily(db, req.portal.person.id, q) || can(req.portal.access, 'volunteer_signups.create'))) return q;
    return parentFamilyIds(db, req.portal.person.id)[0] || null;
  };
  function form(req, res, fid, values = {}, error = null, status = 200) {
    const year = currentYear(db);
    const jobs = db.prepare('SELECT * FROM volunteer_jobs WHERE active = 1 AND deleted_at IS NULL ORDER BY sort, id').all();
    const preschool = !!db.prepare("SELECT 1 FROM enrollments e JOIN class_types ct ON ct.id = e.class_type_id WHERE e.school_year_id = ? AND ct.code = 'preschool' AND e.deleted_at IS NULL AND e.student_person_id IN (SELECT person_id FROM family_members WHERE family_id = ?)").get(year.id, fid);
    const mine = db.prepare('SELECT * FROM volunteer_signups WHERE family_id = ? AND school_year_id = ? AND deleted_at IS NULL ORDER BY priority').all(fid, year.id);
    const svc = db.prepare("SELECT amount_cents FROM fee_schedules WHERE school_year_id = ? AND code = 'service_fee' AND deleted_at IS NULL AND active = 1").get(year.id);
    page(req, res, 'volunteer.ejs', { fid, year, jobs: jobs.filter((j) => !j.reserved_for_preschool || preschool), mine, values, error, serviceFee: svc?.amount_cents ?? null }, { title: 'PTA Volunteer Sign Up', status });
  }
  app.get(`${R}/volunteer`, requireLogin, (req, res) => {
    if (!can(req.portal.access, 'volunteer.own')) return forbidden(req, res);
    const fid = familyFor(req);
    if (!fid) return go(req, res, '', { type: 'warn', msg: 'No family on your account.' });
    form(req, res, fid);
  });
  app.post(`${R}/volunteer`, requireLogin, csrfMiddleware, (req, res) => {
    if (!can(req.portal.access, 'volunteer.own')) return forbidden(req, res);
    const fid = familyFor(req);
    if (!fid) return go(req, res, '');
    const year = currentYear(db); const uid = req.portal.user.id; const pid = req.portal.person.id;
    db.exec('BEGIN');
    try {
      db.prepare("UPDATE volunteer_signups SET deleted_at = datetime('now'), updated_by = ? WHERE family_id = ? AND school_year_id = ? AND deleted_at IS NULL AND status IN ('requested','declined')").run(uid, fid, year.id);
      if (req.body.cannot) {
        db.prepare("INSERT INTO volunteer_signups (family_id, person_id, school_year_id, job_id, priority, status, created_by, updated_by) VALUES (?,?,?,NULL,1,'declined',?,?)").run(fid, pid, year.id, uid, uid);
      } else {
        const jobs = [1, 2, 3].map((i) => Number(req.body[`job_${i}`] || 0) || null);
        if (!jobs.some(Boolean)) { db.exec('ROLLBACK'); return form(req, res, fid, req.body, 'Please choose at least one job, or “I cannot volunteer”. 請至少選一項，或按「我無法擔任義工」。', 400); }
        jobs.forEach((j, i) => { if (j) db.prepare('INSERT INTO volunteer_signups (family_id, person_id, school_year_id, job_id, priority, created_by, updated_by) VALUES (?,?,?,?,?,?,?)').run(fid, pid, year.id, j, i + 1, uid, uid); });
      }
      audit(db, 'volunteer_signups', fid, 'signup', null, { cannot: !!req.body.cannot }, uid, req.ip);
      db.exec('COMMIT');
    } catch (e) { try { db.exec('ROLLBACK'); } catch { /* already rolled back */ } throw e; }
    go(req, res, '', { type: 'ok', msg: req.body.cannot ? 'Noted — thank you. 已記錄，謝謝。' : 'Volunteer sign-up saved. PTA will contact you. 義工報名已儲存，家長會將與您聯繫。' });
  });
}
