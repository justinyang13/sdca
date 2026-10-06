#!/usr/bin/env node
// scripts/build-static.js — frozen copy of the site for GitHub Pages (no server needed).
//   node scripts/build-static.js [--base=/sdca] [--out=dist]
// Starts the app on a spare port, crawls every public page (EN + ZH, from the
// sitemap + links), saves HTML / PDFs / the assets the pages reference, and
// rewrites root-absolute URLs to live under BASE. Forms stay inert (the site has
// no backend on Pages). Publish with scripts/publish-pages.sh.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').slice(k.length + 3) || d;
const BASE = arg('base', '/sdca').replace(/\/$/, '');
const OUT = path.resolve(ROOT, arg('out', 'dist'));
const PORT = 3199;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const SKIP = /^\/(admin|api|search|healthz|robots\.txt|sitemap\.xml)(\/|$|\?)|[?&](year|date)=|[?&]month=(?!(2026-(0[89]|1[0-2])|2027-(0[1-7]))$)/;

const html = new Map();   // urlPath(+query) -> { file, body }
const assets = new Set(); // url paths to copy from the server
const redirects = new Map();
let pdfSlugs = new Set();

const sanitize = (q) => q.replace(/[^a-z0-9=&]+/gi, '_').replace(/&/g, '__');
function mapUrl(href) {
  // href: root-absolute ("/en/news?kind=weekly#x") -> new URL under BASE
  const m = href.match(/^(\/[^?#]*)(\?[^#]*)?(#.*)?$/);
  if (!m) return href;
  let [, p, q, h] = m;
  q = q || ''; h = h || '';
  if (/^\/pdf\/[^/]+$/.test(p) && !p.endsWith('/download')) return `${BASE}${p}.pdf${h}`;
  if (/^\/pdf\/[^/]+\/download$/.test(p)) return `${BASE}${p.replace(/\/download$/, '')}.pdf${h}`;
  if (/\.[a-z0-9]{2,5}$/i.test(p)) return `${BASE}${p}${q ? '' : ''}${h}`; // asset: query dropped (cache-buster)
  const dir = p.replace(/\/$/, '') + (q ? '__' + sanitize(q.slice(1)) : '');
  return `${BASE}${dir}/${h}`.replace(/\/\/$/, '/');
}
function fileFor(p, q) {
  if (/^\/pdf\/[^/]+(\/download)?$/.test(p)) return p.replace(/\/download$/, '') + '.pdf';
  if (/\.[a-z0-9]{2,5}$/i.test(p)) return p;
  return (p.replace(/\/$/, '') + (q ? '__' + sanitize(q.slice(1)) : '')) + '/index.html';
}

function rewriteHtml(s) {
  const fix = (u) => (SKIP.test(u) ? '#' : u.startsWith('/') && !u.startsWith('//') ? mapUrl(u) : u);
  s = s.replace(/\b(href|src|action|poster|data-full|data-src|data-href)="([^"]*)"/g, (m, a, u) => `${a}="${fix(u.replace(/&amp;/g, '&'))}"`);
  s = s.replace(/\bcontent="(\/[^"]*)"/g, (m, u) => `content="${fix(u)}"`);
  s = s.replace(/\bsrcset="([^"]*)"/g, (m, v) => `srcset="${v.split(',').map((part) => { const t = part.trim().split(/\s+/); t[0] = fix(t[0]); return t.join(' '); }).join(', ')}"`);
  s = s.replace(/url\((['"]?)(\/[^)'"]+)\1\)/g, (m, q, u) => `url(${q}${fix(u)}${q})`);
  return s;
}
function rewriteCss(s) {
  return s.replace(/url\((['"]?)(\/[^)'"]+)\1\)/g, (m, q, u) => `url(${q}${mapUrl(u)}${q})`);
}

function refsOf(body) {
  const out = new Set();
  const add = (u) => { if (u && u.startsWith('/') && !u.startsWith('//')) out.add(u.replace(/&amp;/g, '&')); };
  for (const m of body.matchAll(/\b(?:href|src|poster|data-full|data-src|data-href)="([^"]*)"/g)) add(m[1]);
  for (const m of body.matchAll(/\bcontent="(\/[^"]*)"/g)) add(m[1]);
  for (const m of body.matchAll(/\bsrcset="([^"]*)"/g)) m[1].split(',').forEach((p) => add(p.trim().split(/\s+/)[0]));
  for (const m of body.matchAll(/url\((['"]?)(\/[^)'"]+)\1\)/g)) add(m[2]);
  return out;
}

function save(rel, data) {
  const f = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, data);
}

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const child = spawn('node', ['src/server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), NODE_ENV: 'production' }, stdio: 'ignore' });
  try {
    for (let i = 0; i < 40; i++) { try { const r = await fetch(`${ORIGIN}/en/`); if (r.ok) break; } catch { /* wait */ } await new Promise((r) => setTimeout(r, 500)); }
    const queue = ['/en/', '/zh/'];
    const sm = await (await fetch(`${ORIGIN}/sitemap.xml`)).text();
    for (const m of sm.matchAll(/<loc>[^<]*?(\/(?:en|zh)\/?[^<]*)<\/loc>/g)) queue.push(m[1]);
    const seen = new Set();
    while (queue.length) {
      const u = queue.shift();
      if (seen.has(u) || SKIP.test(u)) continue;
      if (seen.size > 2500) { console.warn('crawl cap reached'); break; }
      seen.add(u); if (seen.size % 25 === 0) console.log('crawl', seen.size, queue.length, u);
      let r;
      try { r = await fetch(ORIGIN + u, { redirect: 'manual' }); } catch (e) { console.warn('fetch failed', u); continue; }
      const loc = r.headers.get('location');
      if (r.status >= 300 && r.status < 400 && loc) {
        redirects.set(u, loc.replace(ORIGIN, ''));
        queue.push(loc.replace(ORIGIN, ''));
        continue;
      }
      if (!r.ok) { console.warn(r.status, u); continue; }
      const ct = r.headers.get('content-type') || '';
      const [p, q] = [u.split('?')[0], u.includes('?') ? '?' + u.split('?').slice(1).join('?').split('#')[0] : ''];
      if (ct.includes('text/html')) {
        const body = await r.text();
        html.set(u, { file: fileFor(p, q), body });
        for (const ref of refsOf(body)) {
          const rp = ref.split('#')[0];
          if (SKIP.test(rp)) continue;
          if (/^\/(en|zh)(\/|$)/.test(rp) || /^\/pdf\//.test(rp) || !/\.[a-z0-9]{2,5}$/i.test(rp)) queue.push(rp);
          else assets.add(rp);
        }
      } else if (ct.includes('pdf')) {
        save(fileFor(p, ''), Buffer.from(await r.arrayBuffer()));
      } else {
        assets.add(u);
      }
    }
    // assets (css first: they reference more assets)
    const done = new Set();
    const pending = [...assets];
    while (pending.length) {
      const u = pending.shift();
      const p = u.split('?')[0];
      if (done.has(p)) continue;
      done.add(p);
      const r = await fetch(ORIGIN + p);
      if (!r.ok) { console.warn('asset', r.status, p); continue; }
      if (p.endsWith('.css')) {
        const css = await r.text();
        for (const ref of refsOf(css)) if (!done.has(ref.split('?')[0])) pending.push(ref);
        save(p, rewriteCss(css));
      } else if (p.endsWith('.js')) {
        save(p, Buffer.from(await r.arrayBuffer()));
      } else {
        save(p, Buffer.from(await r.arrayBuffer()));
      }
    }
    // pages
    for (const [u, { file, body }] of html) save(file, rewriteHtml(body));
    // redirects -> tiny meta-refresh pages
    for (const [from, to] of redirects) {
      if (html.has(from)) continue;
      const [p, q] = [from.split('?')[0], from.includes('?') ? '?' + from.split('?')[1] : ''];
      if (/\.[a-z0-9]{2,5}$/i.test(p)) continue;
      const target = mapUrl(to);
      save(fileFor(p, q), `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=${target}"><link rel="canonical" href="${target}"><a href="${target}">Continue</a>`);
    }
    // root + 404
    save('index.html', `<!doctype html><meta charset="utf-8"><title>SDCA</title><meta http-equiv="refresh" content="0; url=${BASE}/en/"><a href="${BASE}/en/">San Diego Chinese Academy 聖地牙哥中華學苑</a>`);
    const nf = await fetch(`${ORIGIN}/en/__not-found__`);
    save('404.html', rewriteHtml(await nf.text()));
    save('.nojekyll', '');
    console.log(`static site: ${html.size} pages, ${done.size} assets → ${path.relative(ROOT, OUT)} (base ${BASE})`);
  } finally {
    child.kill();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
