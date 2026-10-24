// src/chat/text.js — turn block trees into plain text, and tokenise bilingual text for FTS5.
const SKIP_KEYS = new Set(['src', 'href', 'local_path', 'sha256', 'width', 'height', 'target', 'level', 'ordered', 'alt', 'image', 'links', 'style', 'class']);
const CJK = /[㐀-䶿一-鿿豈-﫿]/;

/** Collect human-readable strings from a block tree, in order. */
export function blocksToText(node, out = []) {
  if (node == null) return out;
  if (typeof node === 'string') { const s = node.trim(); if (s) out.push(s); return out; }
  if (Array.isArray(node)) { for (const n of node) blocksToText(n, out); return out; }
  if (typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) if (!SKIP_KEYS.has(k)) blocksToText(v, out);
  }
  return out;
}

/** Split text into passages of roughly maxLen characters on paragraph/sentence boundaries. */
export function chunk(text, maxLen = 700) {
  const parts = String(text).split(/\n+/).map((s) => s.trim()).filter(Boolean);
  const out = [];
  let cur = '';
  for (const p of parts) {
    if (cur && cur.length + p.length + 1 > maxLen) { out.push(cur); cur = ''; }
    cur = cur ? `${cur}\n${p}` : p;
  }
  if (cur) out.push(cur);
  return out;
}

/** Index/query form: Latin words lowercased, CJK as overlapping bigrams (so 2-char words match). */
const STOP = new Set('a an and are as at be but by can do does for from has have how i if in is it its me my of on or our so than that the their there this to us was we what when where which who why will with you your much many any about'.split(' '));

export function tokens(text) {
  const out = [];
  const s = String(text).toLowerCase().replace(/mid[- ]term/g, 'midterm');
  for (const m of s.matchAll(/[a-z0-9]+|[㐀-䶿一-鿿豈-﫿]+/g)) {
    const w = m[0];
    if (CJK.test(w[0])) {
      if (w.length === 1) out.push(w);
      for (let i = 0; i < w.length - 1; i++) out.push(w.slice(i, i + 2));
    } else if (w.length > 1 && !STOP.has(w)) out.push(w);
  }
  return out;
}

export const hasCjk = (s) => CJK.test(String(s));
