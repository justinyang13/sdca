// src/chat/retriever.js — builds an in-memory FTS5 index over all knowledge sources and searches it.
import { DatabaseSync } from 'node:sqlite';
import { SOURCES } from './sources.js';
import { chunk, tokens } from './text.js';

export function createRetriever(db, { sources = SOURCES } = {}) {
  let idx = null;

  function build() {
    const mem = new DatabaseSync(':memory:');
    mem.exec("CREATE VIRTUAL TABLE c USING fts5(body, tokenize='unicode61')");
    mem.exec('CREATE TABLE meta(id INTEGER PRIMARY KEY, source TEXT, title TEXT, url TEXT, text TEXT, boost REAL)');
    const insM = mem.prepare('INSERT INTO meta(id,source,title,url,text,boost) VALUES (?,?,?,?,?,?)');
    const insC = mem.prepare('INSERT INTO c(rowid, body) VALUES (?,?)');
    let id = 0;
    const counts = {};
    for (const s of sources) {
      let docs = [];
      try { docs = s.load(db); } catch (e) { console.error(`[chat] source ${s.name} failed:`, e.message); }
      for (const d of docs) {
        for (const piece of (d.source === 'faq' ? [d.text] : chunk(d.text))) {
          id += 1;
          insM.run(id, d.source, d.title || '', d.url || '', `${d.title}\n${piece}`, d.boost || 1);
          insC.run(id, tokens(`${d.title} ${piece}`).join(' '));
          counts[d.source] = (counts[d.source] || 0) + 1;
        }
      }
    }
    idx = { mem, counts, builtAt: Date.now() };
  }

  /** @returns passages [{source,title,url,text,score}] best first */
  function search(query, { limit = 6, audience = 'public' } = {}) {
    if (!idx) build();
    const toks = [...new Set(tokens(query))];
    if (!toks.length) return [];
    const expr = toks.map((t) => `"${t.replace(/"/g, '')}"`).join(' OR ');
    const allowed = new Set(sources.filter((s) => s.audiences.includes(audience)).map((s) => s.name));
    let rows = [];
    try {
      rows = idx.mem.prepare(`SELECT m.source, m.title, m.url, m.text, m.boost, bm25(c) AS r
        FROM c JOIN meta m ON m.id = c.rowid WHERE c MATCH ? ORDER BY r LIMIT ?`).all(expr, limit * 3);
    } catch { return []; }
    return rows.filter((r) => allowed.has(r.source))
      .map((r) => ({ source: r.source, title: r.title, url: r.url, text: r.text, score: -r.r * r.boost }))
      .sort((a, b) => b.score - a.score).slice(0, limit);
  }

  return { search, rebuild: build, stats: () => { if (!idx) build(); return idx.counts; } };
}
