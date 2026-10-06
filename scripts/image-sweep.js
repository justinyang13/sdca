#!/usr/bin/env node
// scripts/image-sweep.js — crawl every public page (EN + ZH) and report any
// image (img src/srcset, lightbox data-full / href) that does not load (non-200
// or not an image). Usage: node scripts/image-sweep.js [base=http://localhost:3100]
import { DatabaseSync } from 'node:sqlite';
const BASE = process.argv[2] || process.env.SWEEP_BASE || 'http://localhost:3100';
const db = new DatabaseSync(new URL('../data/sdca.db', import.meta.url).pathname, { readOnly: true });
const paths = new Set(['/', '/about', '/about/board', '/about/staff', '/about/principal', '/programs/classes', '/programs/tcml', '/programs/recreational', '/programs/ta', '/enroll', '/calendar', '/news', '/events', '/media', '/media/archive', '/parents/handbook', '/parents/volunteer', '/parents/scrip', '/documents', '/support', '/support/sponsors', '/contact', '/privacy', '/disclaimer']);
for (const r of db.prepare('SELECT slug FROM pages').all()) paths.add('/' + r.slug.replace(/-/g, '/'));
const imgRe = /(?:src|data-full|data-src|poster)="([^"]+)"|href="([^"]+\.(?:jpe?g|png|gif|webp|svg)(?:\?[^"]*)?)"|srcset="([^"]+)"/gi;
const seen = new Map(); const bad = [];
async function check(u, page) {
  if (!seen.has(u)) {
    let r; try { r = await fetch(u, { method: 'GET' }); const ct = r.headers.get('content-type') || ''; seen.set(u, r.ok && /image|svg/.test(ct) ? 'ok' : `HTTP ${r.status} ${ct}`); await r.arrayBuffer(); } catch (e) { seen.set(u, 'ERR ' + e.message); }
  }
  if (seen.get(u) !== 'ok') bad.push(`${seen.get(u)}  ${u.replace(BASE, '')}   (on ${page})`);
}
let pages = 0;
for (const lang of ['en', 'zh']) for (const p of paths) {
  const url = `${BASE}/${lang}${p === '/' ? '/' : p}`;
  let r; try { r = await fetch(url); } catch { continue; }
  if (!r.ok) continue; pages++;
  const html = await r.text(); const urls = new Set(); let m;
  while ((m = imgRe.exec(html))) {
    const list = m[3] ? m[3].split(',').map((s) => s.trim().split(/\s+/)[0]) : [m[1] || m[2]];
    for (const s of list) if (s && !/^(data:|https?:\/\/(?!localhost))/.test(s) && !s.startsWith('#') && /\.(jpe?g|png|gif|webp|svg)|\/img\//i.test(s)) urls.add(new URL(s, url).href);
  }
  for (const u of urls) await check(u, `/${lang}${p}`);
}
console.log(`pages crawled: ${pages}, unique images: ${seen.size}, broken: ${new Set(bad).size}`);
for (const b of new Set(bad)) console.log('  ✗', b);
process.exit(bad.length ? 1 : 0);
