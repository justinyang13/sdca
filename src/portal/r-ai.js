// src/portal/r-ai.js — staff pages for the AI helpers: translate-draft endpoint, report questions, chat inbox, data quality, volunteer matching.
// Everything here is a suggestion for a person to confirm; nothing is written without a staff click.
import { csrfMiddleware } from '../middleware/csrf.js';
import { can } from './perm.js';
import { currentYear } from './fees.js';
import { audit } from './crud.js';
import { portalHelpers } from './util.js';
import { translateAnnouncement } from '../ai/translate.js';
import { parseReportQuestion } from '../ai/nl-report.js';
import { allSchoolYears } from '../queries/schoolYears.js';
import { postableClassIds } from './announcements.js';
import { duplicatePersons, duplicateFamilies, orphanChecks } from './duplicates.js';
import { suggestVolunteerAssignments, assignSignup } from './volunteer-match.js';
import { nowUtc } from '../datetime.js';
import { createLimiter } from '../middleware/index.js';

export function registerAiRoutes(app, { db, page, requireLogin }) {
  const { go, forbidden, staffCan, P } = portalHelpers(page);
  const R = '/:lang/portal';
  const limiter = createLimiter({ windowMs: 10 * 60 * 1000, max: Number(process.env.AI_RATE_LIMIT || 40), message: { error: 'Too many requests. Please wait a few minutes.' } });

  // ---- translate draft (announcement form button) ----
  app.post(`${R}/ai/translate`, requireLogin, limiter, csrfMiddleware, async (req, res) => {
    const a = req.portal.access;
    if (!(can(a, 'class_announcements.create') || can(a, 'class_announcements.post_own') || can(a, 'announcements.create')) || (!postableClassIds(db, req.portal).length && !can(a, 'announcements.create'))) return res.status(403).json({ error: 'forbidden' });
    const { title, body, to } = req.body || {};
    if (typeof title !== 'string' && typeof body !== 'string') return res.status(400).json({ error: 'text required' });
    try { res.json(await translateAnnouncement({ title: String(title ?? ''), body: String(body ?? ''), to })); }
    catch { res.status(503).json({ error: 'The translation helper is not available right now.' }); }
  });

  // ---- "ask" the finance reports ----
  app.get(`${R}/finance/reports/ask`, requireLogin, limiter, async (req, res) => {
    if (!staffCan(req, 'finance.reports')) return forbidden(req, res);
    const q = String(req.query.q ?? '').trim();
    if (!q) return go(req, res, '/finance/reports');
    const spec = await parseReportQuestion(q, { years: allSchoolYears(db) });
    if (!spec) return go(req, res, '/finance/reports', { type: 'warn', msg: 'I could not match that question to a report. Try e.g. “unpaid registrations over 30 days” or “deposits last Friday”. 無法對應到報表，請換個說法。' });
    const p = new URLSearchParams({ report: spec.report });
    if (spec.from) p.set('from', spec.from);
    if (spec.to) p.set('to', spec.to);
    if (spec.yearId) p.set('year', String(spec.yearId));
    if (spec.minDays) p.set('min_days', String(spec.minDays));
    audit(db, 'transactions', null, 'finance_report_ask', null, { q: q.slice(0, 200), report: spec.report }, req.portal.user.id, req.ip);
    res.redirect(P(req, `/finance/reports?${p}`));
  });

  // ---- chat inbox ----
  const mayStaff = (req) => can(req.portal.access, 'portal.staff');
  app.get(`${R}/chat-inbox`, requireLogin, (req, res) => {
    if (!mayStaff(req)) return forbidden(req, res);
    const handoffs = db.prepare("SELECT * FROM chat_inbox WHERE kind = 'handoff' ORDER BY status, id DESC LIMIT 200").all();
    const unanswered = db.prepare("SELECT question, lang, COUNT(*) AS n, MAX(created_at) AS last_at, MIN(status) AS status FROM chat_inbox WHERE kind = 'unanswered' AND status = 'open' GROUP BY lower(question) ORDER BY n DESC, last_at DESC LIMIT 100").all();
    page(req, res, 'chat-inbox.ejs', { handoffs, unanswered }, { title: 'Chat Inbox' });
  });
  app.post(`${R}/chat-inbox/:id/done`, requireLogin, csrfMiddleware, (req, res) => {
    if (!mayStaff(req)) return forbidden(req, res);
    db.prepare("UPDATE chat_inbox SET status = 'done', handled_at = ?, handled_by = ? WHERE id = ?").run(nowUtc(), req.portal.user.id, Number(req.params.id));
    go(req, res, '/chat-inbox', { type: 'ok', msg: 'Marked done. 已完成。' });
  });
  app.post(`${R}/chat-inbox/clear-unanswered`, requireLogin, csrfMiddleware, (req, res) => {
    if (!mayStaff(req)) return forbidden(req, res);
    db.prepare("UPDATE chat_inbox SET status = 'done', handled_at = ?, handled_by = ? WHERE kind = 'unanswered' AND status = 'open'").run(nowUtc(), req.portal.user.id);
    go(req, res, '/chat-inbox', { type: 'ok', msg: 'Cleared. 已清除。' });
  });

  // ---- data quality ----
  app.get(`${R}/data-quality`, requireLogin, (req, res) => {
    if (!mayStaff(req)) return forbidden(req, res);
    page(req, res, 'data-quality.ejs', { people: duplicatePersons(db), families: duplicateFamilies(db), orphans: orphanChecks(db) }, { title: 'Data Quality' });
  });

  // ---- volunteer matching ----
  const mayMatch = (req) => staffCan(req, 'volunteer_signups.update');
  app.get(`${R}/volunteer-match`, requireLogin, (req, res) => {
    if (!mayMatch(req)) return forbidden(req, res);
    const year = currentYear(db);
    page(req, res, 'volunteer-match.ejs', { year, ...(year ? suggestVolunteerAssignments(db, year.id) : { suggestions: [], load: [] }) }, { title: 'Volunteer Matching' });
  });
  app.post(`${R}/volunteer-match/accept`, requireLogin, csrfMiddleware, (req, res) => {
    if (!mayMatch(req)) return forbidden(req, res);
    const year = currentYear(db);
    const wanted = new Set([].concat(req.body.signup ?? []).map(Number));
    let n = 0;
    // recompute on the server: only an actual current suggestion can be accepted, whatever the form says
    for (const s of year ? suggestVolunteerAssignments(db, year.id).suggestions : []) {
      if (!wanted.has(s.signupId)) continue;
      if (assignSignup(db, { signupId: s.signupId, jobId: s.jobId, by: req.portal.user.id })) { n += 1; audit(db, 'volunteer_signups', s.signupId, 'assign', null, { job: s.jobId, via: 'match' }, req.portal.user.id, req.ip); }
    }
    go(req, res, '/volunteer-match', { type: 'ok', msg: `${n} assigned. 已指派 ${n} 筆。` });
  });
}
