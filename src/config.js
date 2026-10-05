// src/config.js — central configuration from env
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const config = {
  env: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || '0.0.0.0',
  // https: true when the server is served behind a TLS terminator (or on
  // https:// URLs directly). The Phase 1 demo runs on plain http over
  // Tailscale, so this must stay false — otherwise helmet's
  // upgrade-insecure-requests CSP breaks CSS/JS.
  https: process.env.HTTPS === 'true',
  root,
  dataDir: process.env.DATA_DIR || path.join(root, 'data'),
  dbFile: process.env.DB_FILE || path.join(root, 'data', 'sdca.db'),
  publicDir: path.join(root, 'public'),
  viewsDir: path.join(root, 'views'),
  storageDir: path.join(root, 'storage'),
  logDir: path.join(root, 'logs'),
  sessionSecret: process.env.SESSION_SECRET || 'sdca-dev-secret-change-me',
  baseLangs: ['en', 'zh'],
  defaultLang: 'en',
};
