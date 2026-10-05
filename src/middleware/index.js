// src/middleware/index.js — assemble the app middleware stack
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
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

/** General limiter for public pages (generous). */
export const generalLimiter = createLimiter({ max: 300 });
/** Contact form / login limiter (strict). */
export const strictLimiter = createLimiter({ max: 10 });

export function applyBaseMiddleware(app) {
  app.disable('x-powered-by');
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https://www.youtube.com', 'https://www.youtube-nocookie.com'],
        frameSrc: ["'self'", 'https://www.youtube-nocookie.com', 'https://register.sandiegochineseschool.com'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'", 'https://register.sandiegochineseschool.com'],
      },
    },
    hsts: false, // demo runs over http
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }));
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

  // session (SQLite-backed store is added in Phase 6; in-memory for now)
  app.use(session({
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
