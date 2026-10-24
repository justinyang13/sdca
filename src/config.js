// src/config.js — central configuration from env
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// The school's time zone. The whole process runs in it, so "today", local Date getters and SQLite's 'localtime' always
// mean school time whatever the host's own zone is (see src/datetime.js and ARCHITECTURE.md → Dates and times).
export const SCHOOL_TZ = process.env.SCHOOL_TZ || 'America/Los_Angeles';
process.env.TZ = SCHOOL_TZ;

/** Session-signing secret: SESSION_SECRET if set, else a random one created once and kept in data/.session-secret (never the repo's default). */
function loadSessionSecret(dataDir) {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const file = path.join(dataDir, '.session-secret');
  try { const v = fs.readFileSync(file, 'utf8').trim(); if (v.length >= 32) return v; } catch { /* first run */ }
  const v = crypto.randomBytes(48).toString('hex');
  try { fs.mkdirSync(dataDir, { recursive: true }); fs.writeFileSync(file, v, { mode: 0o600 }); } catch { /* read-only disk: fall back to a per-process secret */ }
  return v;
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  timezone: SCHOOL_TZ,
  isProduction: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || '0.0.0.0',
  // https: true when the server is served behind a TLS terminator (or on
  // https:// URLs directly). The demo runs on plain http over
  // Tailscale, so this must stay false — otherwise helmet's
  // upgrade-insecure-requests CSP breaks CSS/JS.
  https: process.env.HTTPS === 'true',
  // minutes of inactivity before portal / admin sessions end (every request or "stay signed in" ping restarts the clock)
  sessionIdleMinutes: Math.max(1, Number(process.env.SESSION_IDLE_MINUTES) || 30),
  root,
  dataDir: process.env.DATA_DIR || path.join(root, 'data'),
  /** 'live' (real school data, default) or 'demo' (invented people/classes/fees). Each has its own DB file; see src/db/guard.js. */
  dataset: process.env.DATASET === 'demo' ? 'demo' : 'live',
  dbFile: process.env.DB_FILE || path.join(process.env.DATA_DIR || path.join(root, 'data'), process.env.DATASET === 'demo' ? 'demo.db' : 'sdca.db'),
  liveDbFile: path.join(process.env.DATA_DIR || path.join(root, 'data'), 'sdca.db'),
  publicDir: path.join(root, 'public'),
  viewsDir: path.join(root, 'views'),
  storageDir: path.join(root, 'storage'),
  logDir: path.join(root, 'logs'),
  sessionSecret: loadSessionSecret(process.env.DATA_DIR || path.join(root, 'data')),
  baseLangs: ['en', 'zh'],
  defaultLang: 'en',
};
