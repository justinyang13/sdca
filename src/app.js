// src/app.js — Express app factory
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import ejs from 'ejs';
import { config } from './config.js';
import { t, SUPPORTED } from './i18n/index.js';
import { applyBaseMiddleware } from './middleware/index.js';
import { openDb } from './db/open.js';

function renderError(app, res, status, lang, opts = {}) {
  const view = ['404', '500', '403', '400'].includes(String(status)) ? String(status) : '500';
  return res.status(status).render(`errors/${view}`, {
    lang,
    t,
    title: opts.title,
    message: opts.message,
  });
}

export function createApp({ db = openDb() } = {}) {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', config.viewsDir);
  app.locals.t = t;
  app.locals.langs = SUPPORTED;

  // JSON + form bodies
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  applyBaseMiddleware(app);

  // Static assets (hashed query string in later phases; fine here)
  app.use(express.static(config.publicDir, { maxAge: '1h', etag: true }));

  // Health check — outside lang prefix, JSON, no auth
  app.get('/healthz', (req, res) => {
    let dbOk = false;
    try {
      const row = db.prepare('SELECT 1 AS ok').get();
      dbOk = row.ok === 1;
    } catch { dbOk = false; }
    res.status(dbOk ? 200 : 500).json({
      ok: dbOk,
      time: new Date().toISOString(),
      version: process.env.npm_package_version || '0.0.1',
    });
  });

  // robots.txt (Phase 5 will expand)
  app.get('/robots.txt', (req, res) => {
    res.type('text/plain').send('User-agent: *\nAllow: /\nDisallow: /admin\n');
  });

  // Locale home pages — render the scaffold home
  for (const lang of SUPPORTED) {
    app.get(`/${lang}`, (req, res) => {
      const body = ejs.render(fs.readFileSync(path.join(config.viewsDir, 'pages', 'home.ejs'), 'utf8'), {
        lang,
        t: (k) => t(lang, k),
      });
      res.render('layouts/main.ejs', {
        lang,
        t: (k) => t(lang, k),
        title: lang === 'zh' ? 'SDCA — 聖地牙哥中華學苑' : 'SDCA — San Diego Chinese Academy',
        description: 'Non-profit Chinese language school in San Diego since 1988.',
        body,
      });
    });
    // /en/anything-unknown → 404 (via the below catch-all)
  }

  // 404
  app.use((req, res) => renderError(app, res, 404, req.lang || 'en', {
    title: t(req.lang || 'en', 'errors.not_found_title'),
    message: t(req.lang || 'en', 'errors.not_found_body'),
  }));

  // 500
  app.use((err, req, res, next) => {
    // eslint-disable-next-line no-console
    console.error('[sdca] 500:', err && err.stack ? err.stack : err);
    if (res.headersSent) return next(err);
    renderError(app, res, 500, req.lang || 'en', {
      title: t(req.lang || 'en', 'errors.server_title'),
      message: t(req.lang || 'en', 'errors.server_body'),
    });
  });

  return app;
}
