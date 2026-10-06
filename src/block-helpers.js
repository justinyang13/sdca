// src/block-helpers.js — Phase DP: text helpers for the block renderer.
// Verbatim old-site text is stored raw in the block tree; these helpers only
// escape HTML and auto-link bare URLs (never rewrite words).
const TRAIL = /[.,;:!?)\]}"'’”」』】）]+$/;

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function escAttr(s) {
  return esc(s).replace(/\n/g, ' ');
}

/** Escape then auto-link http(s) URLs and bare emails. Returns safe HTML. */
export function linkify(s) {
  const parts = String(s ?? '').split(/(https?:\/\/[^\s<>"')\]]+|[\w.+-]+@[\w-]+\.[\w.]+)/g);
  return parts.map((p) => {
    const m = p.match(/^(https?:\/\/[^\s<>"')\]]+)$/);
    if (m) {
      let url = m[1];
      let trail = '';
      const t = url.match(TRAIL);
      if (t) { trail = t[0]; url = url.slice(0, -trail.length); }
      return `<a href="${escAttr(url)}" rel="noopener">${esc(url)}</a>${esc(trail)}`;
    }
    if (/^[\w.+-]+@[\w-]+\.[\w.]+$/.test(p)) {
      return `<a href="mailto:${escAttr(p)}">${esc(p)}</a>`;
    }
    return esc(p);
  }).join('');
}

/** Verbatim paragraphs: split on blank lines / newlines, linkify each. */
export function paras(s) {
  return String(s ?? '')
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => `<p>${linkify(l)}</p>`)
    .join('\n');
}

/** Extract a YouTube video id from watch/share/embed/shorts URLs. */
export function ytId(url) {
  const u = String(url || '');
  let m = u.match(/(?:youtube\.com\/(?:watch\?[^#]*v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  return m ? m[1] : null;
}

export function isExternal(href) {
  return /^(https?:)?\/\//i.test(String(href || ''));
}

function regexEsc(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Escape text, then link in ONE pass (no rescan, so href attributes created
 * below are never re-linked):
 *   1. verbatim link map [{t, href}] (longest first, whitespace-flexible,
 *      all occurrences) — reproduces the old page's inline links exactly;
 *   2. bare http(s) URLs; 3. bare emails.
 * Returns safe HTML.
 */
export function linkifySmart(s, links) {
  const e = esc(s ?? '');
  const alts = [];
  const map = Array.isArray(links) ? links.filter((l) => l && l.t && l.href) : [];
  map.sort((a, b) => String(b.t).length - String(a.t).length);
  map.forEach((l, i) => {
    alts.push(`(?<m${i}>${regexEsc(esc(l.t)).replace(/\s+/g, '\\s+')})`);
  });
  alts.push('(?<url>https?://[^\\s<>"\')\\]]+)');
  alts.push('(?<em>[\\w.+-]+@[\\w-]+\\.[\\w.]+)');
  const re = new RegExp(alts.join('|'), 'g');
  return e.replace(re, (match, ...rest) => {
    const groups = rest[rest.length - 1] || {};
    if (groups.url) {
      let url = groups.url;
      let trail = '';
      const t = url.match(TRAIL);
      if (t) { trail = t[0]; url = url.slice(0, -trail.length); }
      return `<a href="${escAttr(url)}" rel="noopener">${esc(url)}</a>${esc(trail)}`;
    }
    if (groups.em) return `<a href="mailto:${escAttr(groups.em)}">${esc(groups.em)}</a>`;
    for (let i = 0; i < map.length; i++) {
      if (groups[`m${i}`] !== undefined) {
        const href = map[i].href;
        const pdf = /\.pdf(\?|#|$)/i.test(href) || /^\/pdf\//.test(href);
        const extra = pdf ? ' target="_blank" rel="noopener"' : '';
        return `<a href="${escAttr(href)}"${extra}>${match}</a>`;
      }
    }
    return match;
  });
}

/** Split linked HTML into paragraphs on newlines OUTSIDE <a> elements. */
function splitParas(linked) {
  const out = [];
  let depth = 0, cur = '';
  const tokens = linked.split(/(<a\b[^>]*>|<\/a>|\n)/g);
  for (const tok of tokens) {
    if (/^<a\b/i.test(tok)) { depth++; cur += tok; }
    else if (/^<\/a>/i.test(tok)) { depth = Math.max(0, depth - 1); cur += tok; }
    else if (tok === '\n' && depth === 0) {
      if (cur.trim()) out.push(cur);
      cur = '';
    } else cur += tok;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

/** Verbatim paragraphs with inline links preserved. */
export function parasSmart(s, links) {
  return splitParas(linkifySmart(s, links)).map((p) => `<p>${marks(p)}</p>`).join('\n');
}

/** Private-use bold/italic markers (written by scripts/parse-page.js) -> tags. */
export function marks(h) {
  return String(h).replace(/\uE000/g, '<strong>').replace(/\uE001/g, '</strong>')
    .replace(/\uE002/g, '<em>').replace(/\uE003/g, '</em>');
}
export const stripMarks = (s) => String(s ?? '').replace(/[\uE000-\uE003]/g, '');

export const blockHelpers = { esc, escAttr, linkify, paras, parasSmart, linkifySmart, ytId, isExternal };
