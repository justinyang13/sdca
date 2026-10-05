// src/middleware/lang.js — /<lang>/... routing + / language redirect
import { SUPPORTED } from '../i18n/index.js';

const LANG_COOKIE = 'lang';
const LANG_HEADER = 'x-lang';
const LANG_REGEX = new RegExp(`^/(${SUPPORTED.join('|')})(/|$)`);

/**
 * Detect desired language: explicit /en/ /zh/ prefix wins, then cookie,
 * then Accept-Language (any zh* → zh), else en.
 */
export function detectLang(req) {
  const m = req.path.match(LANG_REGEX);
  if (m) return m[1];
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/(?:^|;\s*)lang=([a-zA-Z-]+)/);
  if (match && SUPPORTED.includes(match[1])) return match[1];
  const accept = req.headers['accept-language'] || '';
  if (/zh[-_]/i.test(accept) || /^zh\b/i.test(accept)) return 'zh';
  return 'en';
}

/** Map the current path to its equivalent in the other language. */
export function otherLangPath(req, lang) {
  const current = req.path;
  const m = current.match(LANG_REGEX);
  if (m) {
    return current.replace(`^/${m[1]}`, `/${lang}`);
  }
  // no prefix: keep path, add prefix
  return `/${lang}${current === '/' ? '' : current}` + (req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '');
}

/**
 * Middleware: attach req.lang, req.langPath (path without the /en|/zh prefix).
 * For requests to the bare root `/`, 302 to /en/ or /zh/ (cookie → Accept-Language).
 * Returns 302 and stops the chain when the redirect happens.
 */
export function langMiddleware(req, res, next) {
  if (req.path === '/' || req.path === '') {
    const lang = detectLang(req);
    res.set(LANG_HEADER, lang);
    res.redirect(302, `/${lang}/`);
    return;
  }
  const lang = detectLang(req);
  req.lang = lang;
  const m = req.path.match(LANG_REGEX);
  req.langPath = m ? req.path.slice(m[1].length) || '/' : req.path;
  req.langQuery = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
  next();
}
