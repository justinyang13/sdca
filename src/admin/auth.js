// src/admin/auth.js — password hashing (scrypt) + auth middleware.
import crypto from 'node:crypto';

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
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

