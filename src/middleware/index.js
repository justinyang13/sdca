// src/middleware/index.js — assemble the app middleware stack
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import { config } from '../config.js';
import { openDb } from '../db/open.js';
import { createSessionStore } from '../db/session-store.js';
import { langMiddleware } from './lang.js';
import { csrfMiddleware } from './csrf.js';

export function createLimiter({ windowMs, max, message } = {}) {
  return rateLimit({
    windowMs: windowMs || 15 * 60 * 1000,
    limit: max || 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: message || { error: 'Too many requests, please try again later.' },
  });
}

/** General limiter for public pages (generous). RATE_LIMIT env overrides the
    cap — used by the Phase 8 linkcheck crawler which legitimately makes
    hundreds of requests. */
const GENERAL_MAX = Number(process.env.RATE_LIMIT || 300);
export const generalLimiter = createLimiter({ max: GENERAL_MAX });
/** Contact form / login limiter (strict). */
export const strictLimiter = createLimiter({ max: 10 });
/** Admin login limiter (very strict). */
// Login rate limiter. Reads LOGIN_RATE_LIMIT at call time (not module load)
// so tests can override it via process.env after import.
export function loginLimiter(req, res, next) {
  const max = Number(process.env.LOGIN_RATE_LIMIT || 5);
  // Lazily create the limiter (cached per max value)
  if (!loginLimiter._cache) loginLimiter._cache = {};
  if (!loginLimiter._cache[max]) {
    loginLimiter._cache[max] = createLimiter({ max, message: { error: 'Too many login attempts. Try again in a few minutes.' } });
  }
  return loginLimiter._cache[max](req, res, next);
}


function buildCsp() {
  const directives = {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https://www.youtube.com', 'https://www.youtube-nocookie.com'],
    frameSrc: ["'self'", 'https://www.youtube-nocookie.com', 'https://register.sandiegochineseschool.com'],
    connectSrc: ["'self'"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'", 'https://register.sandiegochineseschool.com'],
  };
  // Only enable upgrade-insecure-requests when we know we're on https.
  // Plain-http demo (Tailscale) needs CSS/JS to load without being
  // upgraded to https, so we keep it disabled unless config.https.
  if (config.https) {
    directives.upgradeInsecureRequests = [];
  } else {
    directives.upgradeInsecureRequests = null;
  }
  return { directives };
}

export function buildHelmet() {
  return helmet({
    contentSecurityPolicy: buildCsp(),
    // HSTS must be off on http demo; enable only if HTTPS is real.
    hsts: config.https ? {} : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });
}

export function applyBaseMiddleware(app) {
  app.disable('x-powered-by');
  app.use(buildHelmet());
  app.use(compression());
  app.use(generalLimiter);

  // simple cookie parser (no deps)
  app.use((req, res, next) => {
    req.cookies = {};
    const header = req.headers.cookie;
    if (header) {
      for (const part of header.split(';')) {
        const idx = part.indexOf('=');
        if (idx > 0) {
          const k = part.slice(0, idx).trim();
          const v = part.slice(idx + 1).trim();
          try { req.cookies[k] = decodeURIComponent(v); } catch { req.cookies[k] = v; }
        }
      }
    }
    next();
  });

  // session — SQLite-backed (survives restarts; Phase 6 adds the admin).
  const db = openDb();
  app.use(session({
    store: createSessionStore(db),
    secret: process.env.SESSION_SECRET || 'sdca-dev-secret',
    resave: false,
    saveUninitialized: false,
    name: 'sdca_sid',
    httpOnly: true,
    sameSite: 'Lax',
    cookie: { maxAge: 7 * 24 * 3600 * 1000 },
  }));

  app.use(langMiddleware);
}

export { csrfMiddleware };
