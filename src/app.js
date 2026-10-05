// src/app.js — Express app factory
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import ejs from 'ejs';
import { config } from './config.js';
import { t, SUPPORTED } from './i18n/index.js';
import { applyBaseMiddleware } from './middleware/index.js';
import { openDb } from './db/open.js';
import * as H from './helpers.js';
import { imageManifest } from './helpers.js';
import { registerPublicRoutes } from './routes-public.js';
import { registerPhase5Routes } from './routes-phase5.js';
import { registerAdminRoutes } from './admin/routes.js';
import { lookupRedirect } from './redirects.js';
import { buildSitemap } from './sitemap.js';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

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

  // Helper for templates: render a partial (views/partials/*.ejs) with locals.
  // Wraps locals as `L` to avoid colliding with partial top-level `const`
  // declarations of the same name (which would cause TDZ issues).
  function makeRenderPart(lang) {
    const tFn = (k) => t(lang, k);
    function renderPart(file, locals) {
      const full = path.join(config.viewsDir, file);
      const src = fs.readFileSync(full, 'utf8');
      return ejs.render(src, { lang, t: tFn, renderPart, L: locals || {}, imageManifest });
    }
    return renderPart;
  }

  // Helper for pages: pre-render header + footer partials for the layout.
  function renderShell(lang, locals) {
    const rp = makeRenderPart(lang);
    const ctx = { langPath: (locals && locals.langPath) || '/' };
    return {
      header: rp('partials/header.ejs', ctx),
      footer: rp('partials/footer.ejs', ctx),
    };
  }

  // Render markdown to safe HTML (marked + sanitize-html).
  function renderMarkdown(md) {
    if (!md) return '';
    const raw = marked.parse(md, { mangle: false, headerIds: false, breaks: false });
    return sanitizeHtml(raw, {
      allowedTags: ['h1','h2','h3','h4','h5','p','ul','ol','li','strong','em','del',
        'a','code','pre','blockquote','table','thead','tbody','tr','th','td','br','hr','span','img','details','summary'],
      allowedAttributes: { a: ['href','title','rel','target'], img: ['src','alt','width','height'] },
      allowedSchemes: ['http','https','mailto','tel'],
    });
  }

  // Render a views/pages/*.ejs template with `renderPart` available in scope.
  function pageView(viewFile, ctx) {
    const full = path.join(config.viewsDir, 'pages', viewFile);
    return ejs.render(fs.readFileSync(full, 'utf8'), ctx);
  }

  // JSON + form bodies
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  applyBaseMiddleware(app);

  app.use(express.static(config.publicDir, { maxAge: '1h', etag: true }));

  // ---------- Admin (mounted before /:lang routing) ----------
  registerAdminRoutes(app, { db });

  // /healthz
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

  // /robots.txt
  app.get('/robots.txt', (req, res) => {
    res.type('text/plain').send('User-agent: *\nAllow: /\nDisallow: /admin\n');
  });

  // ---------- Style guide (dev only) ----------
  if (!config.isProduction) {
    for (const lang of SUPPORTED) {
      app.get(`/${lang}/dev/styleguide`, (req, res) => {
        const tFn = (k) => t(lang, k);
        const renderPart = makeRenderPart(lang);
        const body = ejs.render(
          fs.readFileSync(path.join(config.viewsDir, 'pages', 'styleguide.ejs'), 'utf8'),
          { lang, t: tFn, renderPart }
        );
        const shell = renderShell(lang, { langPath: '/dev/styleguide' });
        res.render('layouts/main.ejs', {
          lang,
          t: tFn,
          renderPart,
          title: lang === 'zh' ? 'SDCA 樣式指南' : 'SDCA Style Guide',
          description: 'SDCA design system style guide.',
          body,
          header: shell.header,
          footer: shell.footer,
        });
      });
    }
  }

  // ---------- 301 redirects (from research/wiki/url-map.md) ----------
  app.use(function redirectsMiddleware(req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const url = new URL(req.originalUrl, 'http://localhost');
    const pathname = url.pathname;
    if (!pathname || pathname === '/' || pathname.startsWith('/en/') || pathname.startsWith('/zh/')) return next();
    const hit = lookupRedirect(pathname);
    if (!hit) return next();
    res.redirect(301, hit[1]);
  });

  // ---------- /sitemap.xml (mounted early so it is not swallowed by /:lang) ----------
  app.get('/sitemap.xml', (req, res) => {
    const base = `${req.protocol}://${req.get('host') || 'localhost:3000'}`;
    const xml = buildSitemap({ base });
    res.type('application/xml; charset=utf-8').send(xml);
  });


  // ---------- Phase 4 public pages ----------
  registerPublicRoutes(app, { makeRenderPart, renderShell, pageView, renderMarkdown, t, db, SUPPORTED });

  // ---------- Phase 5 public pages + platform features ----------
  registerPhase5Routes(app, { makeRenderPart, renderShell, pageView, renderMarkdown, t, db, SUPPORTED });

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
