// src/admin/auth.js — password hashing (scrypt) + auth middleware.
import crypto from 'node:crypto';
import { t } from '../i18n/index.js';

const SALT_BYTES = 16;
const KEYLEN = 64;

/** Hash a password with scrypt. Returns "salt:hash" hex. */
export function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_BYTES);
  const hash = crypto.scryptSync(String(password), salt, KEYLEN);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

/** Verify a password against a "salt:hash" hex string. Constant-time compare. */
export function verifyPassword(password, stored) {
  if (!stored) return false;
  const [saltHex, hashHex] = String(stored).split(':');
  if (!saltHex || !hashHex) return false;
  let salt, expected;
  try {
    salt = Buffer.from(saltHex, 'hex');
    expected = Buffer.from(hashHex, 'hex');
  } catch { return false; }
  const actual = crypto.scryptSync(String(password), salt, KEYLEN);
  return crypto.timingSafeEqual(actual, expected);
}

/** Middleware: require an authenticated admin user in session. */
export function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.status(401).json({ error: 'Unauthenticated' });
}

/** Middleware: require role "admin" (for destructive ops). */
export function requireAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') return next();
  return res.status(403).json({ error: 'Forbidden' });
}
