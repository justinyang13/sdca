// src/app.js — Express app factory
import express from 'express';
import path from 'node:path';
import { config } from './config.js';
import { t, SUPPORTED, pickLang, localized } from './i18n/index.js';
import { applyBaseMiddleware } from './middleware/index.js';
import { openDb } from './db/open.js';
import { renderPage, requestFlags, dt } from './web/render.js';
import { registerPageRoutes } from './routes-pages.js';
import { registerContentRoutes } from './routes-content.js';
import { registerChatRoutes } from './chat/routes.js';
import { registerAdminRoutes } from './admin/routes.js';
import { registerPortalRoutes } from './portal/index.js';
import { markPortalButtons } from './portal/public-links.js';
import { asset } from './asset-version.js';
import { lookupRedirect } from './redirects.js';
import { portedCtx } from './ported.js';
import { buildSitemap } from './sitemap.js';

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
  app.locals.idleMinutes = config.sessionIdleMinutes;
  app.locals.asset = asset;
  app.locals.dt = dt;
  app.set('trust proxy', 'loopback');   // Tailscale Funnel (and any local proxy) forwards the real client address / https flag
  app.set('view engine', 'ejs');
  app.set('views', config.viewsDir);
  app.locals.t = t;
  app.locals.pickLang = pickLang;   // templates choose wording with pickLang(lang, en, zh) / localized(row, 'title', lang)
  app.locals.localized = localized;
  app.locals.langs = SUPPORTED;
  // every route with a :lang segment: anything but a supported language skips the route (and ends in the 404 page)
  app.param('lang', (req, res, next, lang) => (SUPPORTED.includes(lang) ? next() : next('route')));

  // JSON + form bodies
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  applyBaseMiddleware(app, { db });

  // Public pages: remember whether a portal user is signed in (footer shows "Portal Logout"), and make every
  // public button that goes to the portal sign-in / new-family pages sign the current portal user out first
  // (adds ?logout=1) so nobody lands in the wrong account. Not applied inside the portal itself or in the static build.
  app.use((req, res, next) => {
    const portalIn = !!req.session?.portalUserId;
    const inPortal = /^\/(en|zh)\/portal(\/|$)/.test(req.path);
    if (!inPortal && req.get('x-static-build') !== '1') {
      const send = res.send;
      res.send = function (body) {
        if (typeof body === 'string' && /text\/html/.test(String(res.get('Content-Type') || 'text/html'))) {
          body = markPortalButtons(body);
        }
        return send.call(this, body);
      };
    }
    requestFlags.run({ portalIn }, next);
  });

  // files requested with ?v=<hash> (see asset()) never change under that URL → cache them for a year; everything else for an hour
  app.use(express.static(config.publicDir, { maxAge: '1h', etag: true, setHeaders: (res) => { if (res.req?.query?.v) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); } }));

  registerChatRoutes(app, { db });

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
      app.get(`/${lang}/dev/styleguide`, (req, res) => renderPage(res, {
        lang, view: 'styleguide.ejs', title: pickLang(lang, 'SDCA Style Guide', 'SDCA 樣式指南'),
        description: 'SDCA design system style guide.', path: '/dev/styleguide', db,
      }));
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


  // ---------- School portal (accounts, families, registration, finance, volunteers, roles) ----------
  registerPortalRoutes(app, { db });

  // ---------- Main public pages: home, about, programs, enroll, contact, support, sponsors ----------
  registerPageRoutes(app, { db });

  // ---------- Content pages and features: news, events, media, documents, archive, parents, search, legal ----------
  registerContentRoutes(app, { db });

  // ---------- Fallback: serve any pages row that has an imported block
  // tree but no dedicated route (e.g. /en/classroom-map). Runs last, 404s otherwise.
  app.get('/:lang/:slug', function (req, res, next) {
    const lang = req.params.lang;
    const { pg, blocks, useBlocks, adminHtml, bodyNote } = portedCtx(db, req.params.slug, lang);
    if (!pg || !useBlocks) return next();
    const title = localized(pg, 'title', lang);
    renderPage(res, { lang, view: 'ported.ejs', ctx: { pg, blocks, useBlocks, adminHtml, bodyNote }, title, description: title, path: `/${req.params.slug}`, db });
  });

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
