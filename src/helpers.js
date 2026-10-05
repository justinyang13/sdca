// src/helpers.js — shared render/query helpers for public pages
import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { config } from './config.js';

/**
 * Load the image manifest once. Returns { name: {sw, sh, alt_en, alt_zh, files:[{file,w,h}], role, source} }
 * keyed by base name, or null if the manifest is missing.
 */
let manifestCache = null;
export function imageManifest() {
  if (manifestCache !== null) return manifestCache;
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(config.publicDir, 'img', 'manifest.json'), 'utf8'));
    const map = {};
    for (const img of raw.images || []) map[img.name] = img;
    manifestCache = map;
  } catch {
    manifestCache = {};
  }
  return manifestCache;
}

/**
 * Build an <img> tag with srcset/sizes/width/height from a manifest entry name.
 * Falls back to a plain file if the name is not in the manifest.
 */
export function imgTag({ name, file, altEn, altZh, lang, cls, loading = 'lazy' }) {
  const m = (name && imageManifest()[name]) || null;
  const alt = lang === 'zh' ? (altZh || m?.alt_zh || altEn || '') : (altEn || m?.alt_en || altZh || '');
  const classes = cls ? ` class="${cls}"` : '';
  const load = loading === 'eager' ? '' : ' loading="lazy"';
  if (!m || !m.files || m.files.length === 0) {
    if (!file) return '';
    return `<img src="${file.startsWith('/') ? file : '/' + file}" alt="${escapeAttr(alt)}"${classes}${load}>`;
  }
  const srcset = m.files.map(f => `${f.file.startsWith('/') ? f.file : '/' + f.file} ${f.w}w`).join(', ');
  const best = m.files[m.files.length - 1];
  const bestSrc = best.file.startsWith('/') ? best.file : '/' + best.file;
  return `<img src="${bestSrc}" srcset="${srcset}" sizes="(max-width: 768px) 100vw, 1600px" `
    + `width="${best.w}" height="${best.h}" alt="${escapeAttr(alt)}"${classes}${load}>`;
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}


/**
 * Normalize any image path (relative, root-absolute, manifest base name)
 * to a ROOT-ABSOLUTE /img/... URL. Never returns a relative path.
 */
export function imgUrl(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  if (s.startsWith('/') || s.startsWith('http') || s.startsWith('data:')) return s;
  const noLead = s.replace(/^\/+/, '');
  if (imageManifest()[noLead]) {
    // manifest base name → largest variant, root-absolute
    const m = imageManifest()[noLead];
    if (m.files && m.files.length) {
      const best = m.files[m.files.length - 1];
      return best.file.startsWith('/') ? best.file : '/' + best.file;
    }
  }
  return '/' + noLead;
}

/** Get a settings row value for the given language (falls back to the other language). */
export function setting(db, key, lang) {
  const row = db.prepare('SELECT value_en, value_zh FROM settings WHERE key = ?').get(key);
  if (!row) return '';
  if (lang === 'zh') return row.value_zh || row.value_en || '';
  return row.value_en || row.value_zh || '';
}

/** Fetch a page row by slug. */
export function pageBySlug(db, slug) {
  return db.prepare('SELECT * FROM pages WHERE slug = ?').get(slug) || null;
}

/** Render page markdown to safe HTML (shared by mdBody and callers). */
export function mdToHtml(md, { title = '' } = {}) {
  if (!md) return '';
  const raw = marked.parse(md, { mangle: false, headerIds: false, breaks: false });
  return withAssetUrls(withPdfTargets(sanitizeHtml(raw, {
    allowedTags: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'del',
      'a', 'code', 'pre', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'br', 'hr', 'span', 'img', 'details', 'summary',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'rel', 'target'],
      img: ['src', 'alt', 'width', 'height'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  })));
}

/**
 * Normalise img src attributes in rendered HTML through assetUrl() so that
 * markdown-borne local paths (img/..., storage/...) become root-absolute.
 */
export function withAssetUrls(html) {
  if (!html) return '';
  return String(html).replace(/<img([^>]*?)src="([^"]*)"/g,
    (m, attrs, src) => {
      const fixed = assetUrl(src);
      if (fixed === src) return m;
      return `<img${attrs}src="${fixed}"`;
    });
}

/**
 * Auto-add target="_blank" rel="noopener" to any link whose href is a PDF
 * (local or external). Per Phase 8, every PDF link must open in a new tab.
 */
export function withPdfTargets(html) {
  if (!html) return '';
  return String(html).replace(
    /<a([^>]*?)href="([^"]*?\.pdf(?:\?[^"]*)?)"/g,
    (m, attrs, href) => {
      if (/\starget=/i.test(attrs)) return m;
      const relPart = /\srel=/i.test(attrs) ? '' : ' rel="noopener"';
      return `<a${attrs}${relPart} target="_blank" href="${href}"`;
    }
  );
}

/**
 * Build the canonical inline-PDF URL for a document slug (no lang prefix,
 * served by the /pdf/:slug route with Content-Disposition: inline).
 */
export function pdfUrl(slug) {
  return `/pdf/${String(slug)}`;
}

/**
 * Pick the best body for the given lang. Returns { html, langNote } where
 * langNote is i18n key or null.
 */
export function bodyFor(page, lang) {
  const en = page?.body_en || '';
  const zh = page?.body_zh || '';
  if (lang === 'zh') {
    if (zh) return { html: mdToHtml(zh), note: null };
    if (en) return { html: mdToHtml(en), note: 'meta.lang_note_zh' };
    return { html: '', note: null };
  }
  if (en) return { html: mdToHtml(en), note: null };
  if (zh) return { html: mdToHtml(zh), note: 'meta.lang_note_en' };
  return { html: '', note: null };
}

/**
 * Upcoming events starting from today, newest first, capped at `limit`.
 */
export function upcomingEvents(db, { limit = 5 } = {}) {
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return db.prepare(
    'SELECT * FROM events WHERE published = 1 AND (all_day = 1 OR date(starts_at) >= ?) ORDER BY starts_at DESC LIMIT ?'
  ).all(today, limit);
}

/** Latest N published announcements, newest first. */
export function latestAnnouncements(db, { limit = 5 } = {}) {
  return db.prepare(
    'SELECT a.*, d.title_en AS doc_title_en, d.title_zh AS doc_title_zh, d.file_path AS doc_path '
    + 'FROM announcements a LEFT JOIN documents d ON d.id = a.document_id '
    + 'WHERE a.published = 1 ORDER BY a.published_at DESC LIMIT ?'
  ).all(limit);
}

/** Programs ordered by sort. */
export function allPrograms(db) {
  return db.prepare('SELECT * FROM programs ORDER BY sort, name_en').all();
}

/** Sponsors ordered by sort. */
export function allSponsors(db) {
  return db.prepare('SELECT * FROM sponsors ORDER BY sort, name').all();
}

/** People in a group. */
export function peopleByGroup(db, group) {
  return db.prepare('SELECT * FROM people WHERE "group" = ? ORDER BY sort, name_en').all(group);
}

/**
 * assetUrl(v) — Phase 9 single source of truth for asset URLs.
 * - empty → ''
 * - http(s)://, data:, mailto:, tel:, # → returned unchanged
 * - local paths (img/..., /img/..., storage/..., brand/..., css/..., any
 *   repo-root-relative or already root-absolute path) → root-absolute
 * Used by EVERY template, route, markdown renderer, admin preview and JSON-LD.
 */
export function assetUrl(v) {
  const s = String(v == null ? '' : v).trim();
  if (!s) return '';
  if (/^(https?:|data:|mailto:|tel:|#)/i.test(s)) return s;
  return '/' + s.replace(/^\/+/, '');
}
