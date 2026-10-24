// src/web/render.js — the one place that turns templates into public pages.
//   renderPage(res, {...})  a page inside layouts/main.ejs (header, footer, hreflang links, JSON-LD)
//   pageView / makeRenderPart / renderShell / renderMarkdown  the pieces, for callers that build their own layout (the portal)
import path from 'node:path';
import fs from 'node:fs';
import ejs from 'ejs';
import { AsyncLocalStorage } from 'node:async_hooks';
import { config } from '../config.js';
import { t, pickLang, localized } from '../i18n/index.js';
import { asset } from '../asset-version.js';
import { fmtLong, fmtTime, fmtEventWhen, fmtMonthYear, fmtDate, todayLocal } from '../datetime.js';
import { imageManifest, assetUrl, mdToHtml } from '../helpers.js';
import { blockHelpers } from '../block-helpers.js';

/** Per-request flags the shared header/footer need (is a portal user signed in?). Set by a middleware in app.js. */
export const requestFlags = new AsyncLocalStorage();

/** Date/time formatters available to every template as `dt`. */
export const dt = { fmtLong, fmtTime, fmtEventWhen, fmtMonthYear, fmtDate, todayLocal };

export const renderMarkdown = mdToHtml;

/** A function that renders a partial (views/**.ejs) in one language. Locals are wrapped as `L` so a partial's own top-level `const`s cannot collide with them. */
export function makeRenderPart(lang) {
  const tFn = (k) => t(lang, k);
  function renderPart(file, locals) {
    const src = fs.readFileSync(path.join(config.viewsDir, file), 'utf8');
    const L = locals || {};
    if (file.startsWith('blocks/')) L.h = blockHelpers;   // block renderers get the text helpers as L.h
    return ejs.render(src, { lang, langPath: L.langPath, portalIn: L.portalIn, asset, dt, t: tFn, renderPart, L, imageManifest, assetUrl, pickLang, localized });
  }
  return renderPart;
}

/** The pre-rendered header and footer for the layout. */
export function renderShell(lang, locals) {
  const rp = makeRenderPart(lang);
  const ctx = { langPath: (locals && locals.langPath) || '/', portalIn: !!requestFlags.getStore()?.portalIn };
  return { header: rp('partials/header.ejs', ctx), footer: rp('partials/footer.ejs', ctx) };
}

/** Render a views/pages/*.ejs template with `renderMarkdown` and the date helpers in scope. */
export function pageView(viewFile, ctx) {
  const full = path.join(config.viewsDir, 'pages', viewFile);
  return ejs.render(fs.readFileSync(full, 'utf8'), { renderMarkdown, assetUrl, dt, pickLang, localized, ...ctx });
}

/**
 * Send a public page: `view` (views/pages/<view>) inside the site layout.
 * `path` is the route without the language prefix (used for canonical and the EN/ZH alternate links).
 * `ctx` may already carry `t` and `renderPart`; otherwise they are made here.
 */
export function renderPage(res, { lang, view, ctx = {}, title, description = '', path: routePath, jsonLd = null, status = 200, db }) {
  const tFn = ctx.t || ((k) => t(lang, k));
  const renderPart = ctx.renderPart || makeRenderPart(lang);
  const body = pageView(view, { lang, t: tFn, renderPart, db, ...ctx });
  res.status(status).render('layouts/main.ejs', {
    lang, t: tFn, renderPart,
    title, description,
    canonical: `/${lang}${routePath}`,
    enUrl: `/en${routePath}`, zhUrl: `/zh${routePath}`,
    jsonLd,
    body,
    ...renderShell(lang, { langPath: routePath }),
  });
}
