// src/i18n/index.js — load en/zh string tables and expose t()
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const SUPPORTED = ['en', 'zh'];

function load(lang) {
  const file = path.join(dir, `${lang}.json`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const tables = Object.fromEntries(SUPPORTED.map(l => [l, load(l)]));

/** All keys present in the given language file. */
export function keys(lang) {
  return Object.keys(tables[lang]).sort();
}

/** True if en and zh have the same key set. */
export function parity() {
  const en = keys('en'), zh = keys('zh');
  return en.length === zh.length && en.every((k, i) => k === zh[i]);
}

/** Translate a key; falls back to en, then to the key itself. */
export function t(lang, key) {
  const table = tables[lang] || tables.en;
  return table[key] ?? tables.en[key] ?? key;
}

export { SUPPORTED };
