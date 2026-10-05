// src/redirects.js — 301 redirects from research/wiki/url-map.md
// Source of truth: research/wiki/url-map.md (do not edit that file).
// Each entry: [oldPath, newSitePath]. newSitePath is the canonical (no trailing
// slash) path on the NEW site. Where the url-map names a path that we did not
// build (e.g. /classes/..., /get-involved/..., /legal/...), the target is
// remapped to the closest real route per ARCHITECTURE §4.
//
// Paths are normalized before lookup: trailing slashes removed, compared
// case-sensitively. Query strings are NOT part of the key.

export const REDIRECTS = [
  // --- Core pages ---
  ['/', '/en/'],
  ['/about-sdca', '/en/about'],
  ['/%E6%A0%A1%E9%95%B7%E7%9A%84%E8%A9%B1', '/en/about/principal'],
  ['/board-of-directors', '/en/about/board'],
  ['/bod', '/en/about/board'],
  ['/staff', '/en/about/staff'],
  ['/class-placement', '/en/programs/classes'],
  ['/tcml', '/en/programs/tcml'],
  ['/adult-recreational-programs', '/en/programs/recreational'],
  ['/ta-program', '/en/programs/ta'],
  ['/volunteer-opportunity', '/en/parents/volunteer'],
  ['/parent-info-old', '/en/parents/handbook'],
  ['/handbook-and-policy', '/en/parents/handbook'],
  ['/scrip', '/en/parents/scrip'],
  ['/education-resource', '/en/documents'],
  ['/sponsors', '/en/support/sponsors'],
  ['/sponsors-2', '/en/support/sponsors'],
  ['/sdca-ad-half-page', '/en/support/sponsors'],
  ['/registration', '/en/enroll'],
  ['/countact-us', '/en/contact'],
  ['/news', '/en/news'],
  ['/news-archive', '/en/news'],
  ['/media', '/en/media'],
  ['/upcoming-event', '/en/news?kind=weekly'],
  ['/category/weekly-announcement', '/en/news?kind=weekly'],
  ['/disclaimer', '/en/disclaimer'],
  ['/privacy-policy', '/en/privacy'],
  ['/new-student-advertisments-2026', '/en/enroll'],
  ['/sample-page/2026-essay-ad', '/en/news/2026-essay-application'],
  ['/%E5%90%89%E4%BB%96%E6%B5%B7%E5%A0%B1', '/en/programs/tcml'],
  ['/author/admin', '/en/'],
  ['/author/webmaster', '/en/'],

  // --- Event / announcement posts (collapsed to index or detail) ---
  ['/2018-10-22/pre-k-program', '/en/news'],
  ['/2025-2026-38th-anniversary-spring-fair', '/en/news'],
  ['/2025-2026-poetry-recitation-rules', '/en/news'],
  ['/2025-2026-poetry-recitation-rules-2', '/en/news'],
  ['/2025-2026_school_calendar-03152026', '/en/calendar'],
  ['/2025-26_sdca_essay', '/en/news'],
  ['/2026-chinese-center-contest', '/en/news'],
  ['/2026-2027-first-day-of-school', '/en/news'],
  ['/2026-first-day-of-school-2', '/en/news'],
  ['/2026-27_school_calendar', '/en/calendar'],
  ['/2026-27_school_calendar-2', '/en/calendar'],
  ['/2026-essay-application', '/en/news/2026-essay-application'],
  ['/2026-hoc-essay-english-announcement', '/en/news'],
  ['/2026-pre-registration', '/en/enroll'],
  ['/2026_2027_classroom-map', '/en/calendar'],
  ['/sdca-yearbook-cover-art-contest-guidelines-2025-2026', '/en/news'],
  ['/student-store-schedule', '/en/news'],
  ['/dinner-3', '/en/news'],
  ['/screenshot', '/en/media'],
  ['/screenshot-2', '/en/media'],
  ['/screenshot-3', '/en/media'],
  ['/upcoming-event/summer-break-2', '/en/news'],

  // --- Old-site 404s ---
  ['/registration/signin', '/en/enroll'],
  ['/registration/signin/register', '/en/enroll'],

  // --- Weekly-announcement wrapper posts (w01..w29, with _chn/_eng and -2..-6) ---
  ...weeklyWrappers(),

  // --- Stray photo posts (12 + 4) collapsed into the gallery ---
  ...photoPosts(),
];

function weeklyWrappers() {
  const rows = [];
  const langs = ['', '_chn', '_eng'];
  const suffixes = ['', '-2', '-3', '-4', '-5', '-6'];
  for (let w = 1; w <= 29; w++) {
    const base = `w${String(w).padStart(2, '0')}_news`;
    for (const lang of langs) {
      for (const suf of suffixes) {
        rows.push([`/${base}${lang}${suf}`, '/en/news?kind=weekly']);
      }
    }
  }
  rows.push(
    ['/2018-10-19/2018-19_week_07_announcement_chinese', '/en/news?kind=weekly'],
    ['/2018-10-19/2018-19_week_07_announcement_english', '/en/news?kind=weekly'],
  );
  return rows;
}

function photoPosts() {
  const ids = [2885, 3470, 4300, 4650, 4900, 5010, 5200, 5600, 6100, 7200, 8500, 8989];
  const rows = ids.map((id) => [`/img_${id}`, '/en/media']);
  for (const id of [5806, 5814, 5822, 5828]) rows.push([`/upcoming-event/img_${id}`, '/en/media']);
  return rows;
}

// Lookup by exact path (trailing slash optional). Returns [from, to] or null.
export function lookupRedirect(pathname) {
  if (!pathname || pathname === '/') return null;
  const key = pathname.replace(/\/+$/, '');
  const hit = REDIRECTS.find(([from]) => from === key);
  return hit || null;
}
