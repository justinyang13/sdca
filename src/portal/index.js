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

export function registerPortalRoutes(app, { db, makeRenderPart, renderShell, t }) {
  const page = makeRenderer({ makeRenderPart, renderShell, t, db });
  const isStaticBuild = (req) => req.get('x-static-build') === '1';

  // language guard + session user + csrf cookie for every /:lang/portal/* request
  app.use('/:lang/portal', (req, res, next) => (SUPPORTED.includes(req.params.lang) ? next() : next('route')));
  app.use('/:lang/portal', portalSession(db));
  app.use('/:lang/portal', (req, res, next) => { ensureCsrf(req, res); next(); });

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
  registerManageRoutes(app, deps);   // last: its /manage/:entity/:id patterns are the most generic
}
