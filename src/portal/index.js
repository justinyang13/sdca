// src/portal/index.js — mounts the portal (families, registration, finance, volunteers, roles & permissions) under /:lang/portal.
import { SUPPORTED } from '../i18n/index.js';
import { makeRenderer, ensureCsrf } from './render.js';
import { portalSession } from './auth.js';
import { registerAuthRoutes } from './r-auth.js';
import { registerManageRoutes } from './r-manage.js';
import { registerHomeRoutes } from './r-home.js';
import { registerPeopleRoutes } from './r-people.js';
import { registerRegistrationRoutes } from './r-register.js';
import { registerFinanceRoutes } from './r-finance.js';
import { registerVolunteerRoutes } from './r-volunteer.js';
import { registerStaffRoutes } from './r-staff.js';
import { registerHubRoutes } from './r-hubs.js';
import { registerEventRoutes } from './r-events.js';

export function registerPortalRoutes(app, { db, makeRenderPart, renderShell, t }) {
  const page = makeRenderer({ makeRenderPart, renderShell, t, db });
  const isStaticBuild = (req) => req.get('x-static-build') === '1';

  // language guard + session user + csrf cookie for every /:lang/portal/* request
  app.use('/:lang/portal', (req, res, next) => (SUPPORTED.includes(req.params.lang) ? next() : next('route')));
  app.use('/:lang/portal', portalSession(db));
  app.use('/:lang/portal', (req, res, next) => { ensureCsrf(req, res); next(); });

  // Public-page buttons (and the footer "Portal Logout") arrive with ?logout=1: end the portal session first, then show the
  // page clean (or go back to the public page in `next`). A short notice is shown on the sign-in / sign-up page.
  app.use('/:lang/portal', (req, res, next) => {
    if (req.method !== 'GET' || req.query.logout !== '1' || !['/signin', '/register'].includes(req.path)) return next();
    const lang = req.params.lang;
    const back = /^\/(en|zh)(\/[A-Za-z0-9_\-.\/]*)?$/.test(String(req.query.next || '')) ? String(req.query.next) : `/${lang}/portal${req.path}`;
    const wasIn = !!req.session?.portalUserId;
    const finish = () => {
      res.clearCookie('sdca_sid', { path: '/' });
      if (wasIn && back.includes('/portal/')) res.cookie('sdca_loggedout', '1', { path: '/', maxAge: 60000, sameSite: 'Lax', httpOnly: true });
      res.redirect(302, back);
    };
    if (req.session) req.session.destroy(finish); else finish();
  });

  const requireLogin = (req, res, next) => {
    if (req.portal) return next();
    if (req.method !== 'GET') return res.redirect(`/${req.params.lang}/portal/signin`);
    req.session.portalNext = req.originalUrl;
    return res.redirect(`/${req.params.lang}/portal/signin`);
  };

  const deps = { db, page, requireLogin, isStaticBuild };
  registerAuthRoutes(app, deps);
  registerHomeRoutes(app, deps);
  registerPeopleRoutes(app, deps);
  registerRegistrationRoutes(app, deps);
  registerFinanceRoutes(app, deps);
  registerVolunteerRoutes(app, deps);
  registerStaffRoutes(app, deps);
  registerHubRoutes(app, deps);
  registerEventRoutes(app, deps);
  registerManageRoutes(app, deps);   // last: its /manage/:entity/:id patterns are the most generic
}
