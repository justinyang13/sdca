// src/ported.js — Phase DP: shared helper deciding whether a page renders its
// imported faithful block tree (views/pages/ported.ejs) or its normal template.
// A page uses blocks when it has a non-empty tree and was not edited in admin
// after import (body_source='admin' wins, per BUILD-PLAN Phase DP item 5).
import { bodyFor } from './helpers.js';

export function parseBlocks(pg) {
  if (!pg || !pg.blocks) return [];
  try {
    const j = JSON.parse(pg.blocks);
    return Array.isArray(j) ? j : [];
  } catch {
    return [];
  }
}

/** Full ctx fragment for ported-capable routes: { pg, blocks, useBlocks, adminHtml, bodyNote }. */
export function portedCtx(db, slug, lang) {
  const pg = db.prepare('SELECT * FROM pages WHERE slug = ?').get(slug) || null;
  const blocks = parseBlocks(pg);
  const adminEdited = pg && pg.body_source === 'admin';
  const useBlocks = Boolean(pg && !adminEdited && blocks.length > 0);
  const bf = pg ? bodyFor(pg, lang) : { html: '', note: null };
  return { pg, blocks, useBlocks, adminHtml: adminEdited ? bf.html : '', bodyNote: bf.note };
}

/** View file switch for routes: 'ported.ejs' when the page has usable blocks. */
export function usePorted(db, slug, fallback) {
  try {
    const pg = db.prepare('SELECT blocks, body_source FROM pages WHERE slug = ?').get(slug);
    const blocks = parseBlocks(pg);
    if (pg && pg.body_source !== 'admin' && blocks.length > 0) return 'ported.ejs';
  } catch { /* fall through */ }
  return fallback;
}
