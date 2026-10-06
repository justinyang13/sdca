#!/usr/bin/env node
// scripts/check-static.js — every /sdca/... URL referenced by the built pages must exist in dist/.
import fs from 'node:fs';
import path from 'node:path';
const OUT = path.resolve(process.argv[2] || 'dist'); const BASE = process.argv[3] || '/sdca';
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const miss = new Map(); let pages = 0;
for (const f of walk(OUT).filter((x) => /\.(html|css)$/.test(x))) {
  const s = fs.readFileSync(f, 'utf8'); pages++;
  for (const m of s.matchAll(new RegExp(`(?:href|src|data-full|poster|action)="(${BASE}/[^"#?]*)|url\\((?:['"]?)(${BASE}/[^)'"#?]*)`, 'g'))) {
    const u = decodeURIComponent(m[1] || m[2]);
    const rel = u.slice(BASE.length);
    const p = path.join(OUT, rel);
    const ok = fs.existsSync(p) && (fs.statSync(p).isFile() || fs.existsSync(path.join(p, 'index.html')));
    if (!ok) { if (!miss.has(u)) miss.set(u, path.relative(OUT, f)); }
  }
}
console.log(`files checked: ${pages}, missing targets: ${miss.size}`);
for (const [u, f] of [...miss].slice(0, 25)) console.log('  ✗', u, '  (in', f + ')');
process.exit(miss.size ? 1 : 0);
