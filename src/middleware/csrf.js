// src/middleware/csrf.js — double-submit token (no extra deps)
import crypto from 'node:crypto';
import { t } from '../i18n/index.js';

const TOKEN_COOKIE = 'sdca_csrf';

function randomToken() {
  return crypto.randomBytes(32).toString('hex');
}

function getToken(req) {
  return req.cookies && req.cookies[TOKEN_COOKIE];
}

/**
 * GET/HEAD/...: issue a token cookie (idempotent) and expose req.csrfToken().
 * POST/PUT/PATCH/DELETE: X-CSRF-Token header or _csrf body field must match the cookie.
 */
export function csrfMiddleware(req, res, next) {
  if (/^(GET|HEAD|OPTIONS|TRACE)$/.test(req.method)) {
    if (!getToken(req)) {
      res.setCookie(TOKEN_COOKIE, randomToken(), { httpOnly: true, sameSite: 'Lax', path: '/' });
    }
    return next();
  }
  const cookieToken = getToken(req);
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
