// src/portal/util.js — small helpers shared by every portal route module (one definition each).
import { canAll } from './perm.js';

/** trimmed string ('' for null/undefined) */
export const s = (v) => String(v ?? '').trim();
/** "$1,130.50" or "1130.5" → integer cents; '' or text → null */
export const dollars = (v) => { const t = s(v).replace(/[$,]/g, ''); if (t === '') return null; const n = Math.round(parseFloat(t) * 100); return Number.isFinite(n) ? n : null; };
/** number or null for '' */
export const num = (v) => { const t = s(v); return t === '' ? null : Number(t); };
/** today at the school, YYYY-MM-DD (not the UTC date) */
export { todayLocal as today } from '../datetime.js';

/** Per-module helpers bound to the portal page renderer. */
export function portalHelpers(page) {
  const lang = (req) => req.params.lang;
  const P = (req, p = '') => `/${lang(req)}/portal${p}`;
  /** redirect inside the portal, optionally leaving a one-time flash message */
  const go = (req, res, p, flash) => { if (flash) req.session.portalFlash = flash; res.redirect(P(req, p)); };
  const forbidden = (req, res) => page(req, res, 'forbidden.ejs', {}, { title: 'Not allowed', status: 403 });
  /** true when the signed-in user holds the permission with scope "all" (staff-wide) */
  const staffCan = (req, c) => canAll(req.portal.access, c);
  return { lang, P, go, forbidden, staffCan };
}
