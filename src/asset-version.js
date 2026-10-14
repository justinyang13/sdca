// src/asset-version.js — cache busting by content: asset('/css/x.css') → '/css/x.css?v=<8 hex of the file's hash>'.
// The hash changes whenever the file changes, so browsers always fetch new CSS/JS/images and may cache the old ones forever.
// (Replaces the hand-bumped ?v=N numbers.)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './config.js';

const cache = new Map();   // url path → { mtimeMs, size, v }

export function asset(url) {
  const raw = String(url || '');
  const [p] = raw.split('?');
  if (!p.startsWith('/') || p.includes('..')) return raw;
  const file = path.join(config.publicDir, p);
  try {
    const st = fs.statSync(file);
    const hit = cache.get(p);
    if (hit && hit.mtimeMs === st.mtimeMs && hit.size === st.size) return `${p}?v=${hit.v}`;
    const v = crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex').slice(0, 8);
    cache.set(p, { mtimeMs: st.mtimeMs, size: st.size, v });
    return `${p}?v=${v}`;
  } catch {
    return p;   // missing file: leave the plain URL (the 404 shows up as usual)
  }
}
