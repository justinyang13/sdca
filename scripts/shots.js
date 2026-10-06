#!/usr/bin/env node
// scripts/shots.js — screenshot helper (DP visual review, Phase V, Phase 7).
//   node scripts/shots.js [--base http://localhost:3100] [--w=1280,375] [--lang=en,zh] [route ...]
// Headless Chrome captures viewport shots to work/shots/<lang><route>-<W>.png.
// Default route list = the 24 DP-ported pages.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ROUTES = [
  '/about', '/about/board', '/about/staff', '/about/principal',
  '/programs/classes', '/programs/tcml', '/programs/ta', '/programs/recreational',
  '/enroll', '/contact', '/parents/handbook', '/parents/scrip', '/parents/volunteer',
  '/support/sponsors', '/education-resource', '/disclaimer', '/privacy',
  '/adult', '/student-store-schedule', '/classroom-map', '/guitar-poster',
  '/pre-k-program', '/new-student-ads', '/yearbook-contest',
];

function arg(name, def) {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
}

const base = arg('base', 'http://localhost:3100');
const widths = arg('w', '1280,375').split(',').map(Number);
const langs = arg('lang', 'en,zh').split(',');
const only = process.argv.slice(2).filter((a) => a.startsWith('/') && !a.endsWith('.js'));
const routes = only.length ? only : ROUTES;
const outDir = path.join(ROOT, 'work', 'shots');
fs.mkdirSync(outDir, { recursive: true });

let ok = 0, fail = 0;
for (const lang of langs) {
  for (const route of routes) {
    for (const w of widths) {
      const name = `${lang}${route === '/' ? '-home' : route.replace(/\//g, '-')}-${w}.png`;
      const out = path.join(outDir, name);
      const url = `${base}/${lang}${route}`;
      const r = spawnSync(CHROME, [
        '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
        `--window-size=${w},3000`, '--virtual-time-budget=9000',
        `--screenshot=${out}`, url,
      ], { encoding: 'utf8', timeout: 60000 });
      if (r.status === 0 && fs.existsSync(out)) { ok++; }
      else { fail++; console.log(`FAIL ${url} @${w}: ${(r.stderr || '').slice(0, 160)}`); }
    }
  }
}
console.log(`shots: ${ok} ok, ${fail} failed -> ${path.relative(ROOT, outDir)}/`);
process.exit(fail ? 1 : 0);
