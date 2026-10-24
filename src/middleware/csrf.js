// src/middleware/csrf.js — double-submit token (no extra deps)
import crypto from 'node:crypto';
import { t } from '../i18n/index.js';

const TOKEN_COOKIE = 'sdca_csrf';

function randomToken() {
  return crypto.randomBytes(32).toString('hex');
}

/** The token in this browser's cookie ('' when it has none yet). */
export function csrfTokenFrom(req) {
  return req.cookies?.[TOKEN_COOKIE] || '';
}

/** This browser's CSRF token: the cookie it already has, or a new one set now. The cookie is HttpOnly (forms get the token from the server) and Secure over https. */
export function ensureCsrf(req, res) {
  let tok = csrfTokenFrom(req);
  if (!tok) {
    tok = randomToken();
    res.cookie(TOKEN_COOKIE, tok, { httpOnly: true, sameSite: 'Lax', path: '/', secure: !!req.secure });
    req.cookies = { ...(req.cookies || {}), [TOKEN_COOKIE]: tok };
  }
  return tok;
}

/**
 * GET/HEAD/...: issue a token cookie (idempotent) and expose req.csrfToken().
 * POST/PUT/PATCH/DELETE: X-CSRF-Token header or _csrf body field must match the cookie.
 */
export function csrfMiddleware(req, res, next) {
  if (/^(GET|HEAD|OPTIONS|TRACE)$/.test(req.method)) {
    ensureCsrf(req, res);
    return next();
  }
  const cookieToken = csrfTokenFrom(req);
  const sent = req.headers['x-csrf-token']
    || (req.body && (req.body._csrf || req.body.csrf));
  if (!cookieToken || !sent || cookieToken !== sent) {
    const lang = req.lang || 'en';
    return res.status(403).render('errors/403', {
      lang,
      title: t(lang, 'errors.server_title'),
      message: 'Invalid or missing CSRF token.',
    });
  }
  next();
}
