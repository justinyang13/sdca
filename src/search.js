// src/search.js — bilingual search over search_index (FTS5) with a LIKE fallback
// for CJK queries, where unicode61 full-string matching does not work.
//
// Public API:
//   searchContent(db, query, { limit = 20, lang = 'en' } = {})
//     -> { rows: [{kind, slug, title, snippet, url}], query, engine }
//
// `url` is the language-neutral canonical path on the new site (e.g. `/en/news/foo`);
// callers may rewrite the `/en` prefix to the active language.

const CJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f]/;

// Quote each whitespace-separated token so FTS treats them as literals.
// Returns null if the query is empty or only punctuation.
function ftsMatchExpr(q) {
  const toks = String(q).trim().split(/\s+/).filter(Boolean);
  if (!toks.length) return null;
  return toks.map((t) => `"${t.replace(/"/g, '""')}"`).join(' ');
}

function tryFts(db, expr, limit) {
  if (!expr) return [];
  try {
    return db.prepare(
      `SELECT kind, slug, title_en, title_zh, body_en, body_zh
       FROM search_index WHERE search_index MATCH ?
       ORDER BY rank LIMIT ?`
    ).all(expr, limit);
  } catch { return []; }
}

function likeRows(db, q, limit) {
  const like = `%${q}%`;
  return db.prepare(
    `SELECT kind, slug, title_en, title_zh, body_en, body_zh
     FROM search_index
     WHERE title_en LIKE ? OR title_zh LIKE ? OR body_en LIKE ? OR body_zh LIKE ?
     ORDER BY kind, slug LIMIT ?`
  ).all(like, like, like, like, limit);
}

function snippetFor(row, q, lang) {
  const body = lang === 'zh'
    ? (row.body_zh || row.body_en || '')
    : (row.body_en || row.body_zh || '');
  if (!body) return '';
  const flat = body.replace(/\s+/g, ' ');
  const idx = flat.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return flat.slice(0, 120);
  const start = Math.max(0, idx - 40);
  const end = Math.min(flat.length, start + 160);
  return (start > 0 ? '…' : '') + flat.slice(start, end) + (end < flat.length ? '…' : '');
}

// Canonical page slugs → new-site routes (from the pages table in ARCHITECTURE §4).
const PAGE_ROUTE = {
  about: '/en/about',
  'about-board': '/en/about/board',
  'about-staff': '/en/about/staff',
  'about-principal': '/en/about/principal',
  programs: '/en/programs',
  'programs-classes': '/en/programs/classes',
  'programs-tcml': '/en/programs/tcml',
  'programs-recreational': '/en/programs/recreational',
  'programs-ta': '/en/programs/ta',
  enroll: '/en/enroll',
  news: '/en/news',
  media: '/en/media',
  'parents-handbook': '/en/parents/handbook',
  'parents-volunteer': '/en/parents/volunteer',
  'parents-scrip': '/en/parents/scrip',
  documents: '/en/documents',
  support: '/en/support',
  'support-sponsors': '/en/support/sponsors',
  contact: '/en/contact',
  privacy: '/en/privacy',
  disclaimer: '/en/disclaimer',
};

export function urlFor(kind, slug) {
  if (kind === 'page') return PAGE_ROUTE[slug] || `/en/${slug}`;
  if (kind === 'announcement') return `/en/news/${slug}`;
  if (kind === 'event') return `/en/events/${slug}`;
  return '/en/';
}

export function searchContent(db, query, { limit = 20, lang = 'en' } = {}) {
  const q = String(query || '').trim();
  if (!q) return { rows: [], query: q, engine: 'none' };

  let engine = 'fts';
  let raw = tryFts(db, ftsMatchExpr(q), limit);
  if (raw.length === 0) {
    if (CJK.test(q)) {
      raw = likeRows(db, q, limit);
      engine = 'like';
    }
  }

  const rows = raw.map((r) => ({
    kind: r.kind,
    slug: r.slug,
    title: (lang === 'zh'
      ? (r.title_zh || r.title_en || r.slug)
      : (r.title_en || r.title_zh || r.slug)),
    snippet: snippetFor(r, q, lang),
    url: urlFor(r.kind, r.slug),
  }));

  return { rows, query: q, engine };
}
