#!/usr/bin/env node
// scripts/portal-import.js — static copy of the public pages of the old
// registration portal (https://register.sandiegochineseschool.com/).
//   node scripts/portal-import.js
// Fetches the 5 public pages + 4 PDFs, saves raw HTML under research/raw/register/,
// writes cleaned, inert page bodies to views/portal/<name>.html (links rewritten to
// the new site; {{L}} = language prefix) and registers the PDFs as documents
// (served inline at /pdf/<slug>). Forms are static: nothing is submitted.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://register.sandiegochineseschool.com';
const RAW = path.join(ROOT, 'research', 'raw', 'register');
const OUT = path.join(ROOT, 'views', 'portal');
const DOCS = path.join(ROOT, 'storage', 'documents');

const PAGES = [
  { name: 'signin', url: '/signin' },
  { name: 'register', url: '/signin/register' },
  { name: 'forgot-username', url: '/forgot_username' },
  { name: 'forgot-password', url: '/forgot_password' },
  { name: 'privacy', url: '/public/privacy.html' },
];
const PDFS = [
  { slug: 'registration-notice-english', file: '/public/upload/Registration%20Notice%20English.pdf', en: 'Registration Notice & Online Registration FAQ', zh: '註冊須知與網上註冊常見問答集' },
  { slug: 'registration-notice-chinese', file: '/public/upload/Registration%20Notice%20Chinese.pdf', en: 'Registration Notice (Chinese)', zh: '註冊須知與網上註冊常見問答集' },
  { slug: 'online-registration-user-guide', file: '/public/Online%20Registration%20User%20Guide.pdf', en: 'Online Registration User Guide', zh: '網上註冊說明' },
  { slug: 'portal-user-manual', file: '/public/SDCA%20School%20Portal%20User%20Manual%20(User%20Edition).pdf', en: 'SDCA School Portal User Manual (User Edition)', zh: '使用手冊' },
];

// old portal href -> new-site href ({{L}} = /en or /zh)
function mapHref(h) {
  const d = decodeURIComponent(h.trim());
  if (/^mailto:/i.test(d)) return h;
  if (/sandiegochineseschool\.com\/class-placement/i.test(d)) return '/{{L}}/programs/classes';
  if (/Registration Notice English/i.test(d)) return '/pdf/registration-notice-english';
  if (/Registration Notice Chinese/i.test(d)) return '/pdf/registration-notice-chinese';
  if (/Online Registration User Guide/i.test(d)) return '/pdf/online-registration-user-guide';
  if (/Portal Manual|User Manual/i.test(d)) return '/pdf/portal-user-manual';
  if (/privacy\.html/i.test(d)) return '/{{L}}/portal/privacy';
  if (/signin\/register/i.test(d) || /^register$/i.test(d)) return '/{{L}}/portal/register';
  if (/forgot_username/i.test(d)) return '/{{L}}/portal/forgot-username';
  if (/forgot_password/i.test(d)) return '/{{L}}/portal/forgot-password';
  if (/^\/?signin$/i.test(d)) return '/{{L}}/portal/signin';
  return h;
}

function clean(html, name) {
  let b = html.slice(html.search(/<body/i));
  b = b.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  b = b.replace(/<body[^>]*>/i, '').replace(/<\/body>[\s\S]*$/i, '');
  b = b.replace(/<div id="top-bar">[\s\S]*?<\/div>/i, '').replace(/<p id="flash-notice">[\s\S]*?<\/p>/i, '');
  b = b.replace(/<a\s+([^>]*?)href="([^"]*)"([^>]*)>/gi, (m, a, href, c) => `<a ${a}href="${mapHref(href)}"${c.replace(/,/g, '')}>`);
  b = b.replace(/<form[^>]*>/gi, '<form data-static action="#" method="get" novalidate>');
  b = b.replace(/\srequired(="[^"]*")?/gi, '');
  b = b.replace(/<img[^>]*sdca_logo3[^>]*>/gi, '');
  b = b.replace(/<br\s*\/?>\s*/gi, '').replace(/&nbsp;/g, ' ');
  b = b.replace(/\n\s*\n+/g, '\n').trim();
  return `<div class="portal-body portal-${name}">\n${b}\n</div>\n`;
}

async function get(u) {
  const r = await fetch(BASE + u);
  if (!r.ok) throw new Error(`${u}: HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

fs.mkdirSync(RAW, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(DOCS, { recursive: true });
for (const p of PAGES) {
  const rawFile = path.join(RAW, `${p.name}.html`);
  const html = fs.existsSync(rawFile) ? fs.readFileSync(rawFile, 'utf8') : (await get(p.url)).toString('utf8');
  fs.writeFileSync(rawFile, html);
  fs.writeFileSync(path.join(OUT, `${p.name}.html`), clean(html, p.name));
  console.log('page', p.name);
}
const db = new DatabaseSync(path.join(ROOT, 'data', 'sdca.db'));
for (const d of PDFS) {
  const dest = path.join(DOCS, `${d.slug}.pdf`);
  if (!fs.existsSync(dest)) fs.writeFileSync(dest, await get(d.file));
  const bytes = fs.statSync(dest).size;
  const row = db.prepare('SELECT id FROM documents WHERE slug = ?').get(d.slug);
  if (row) db.prepare('UPDATE documents SET title_en=?, title_zh=?, file_path=?, bytes=?, published=1 WHERE slug=?').run(d.en, d.zh, `storage/documents/${d.slug}.pdf`, bytes, d.slug);
  else db.prepare("INSERT INTO documents (slug,title_en,title_zh,category,file_path,mime,bytes,school_year,published) VALUES (?,?,?,?,?,?,?,?,1)").run(d.slug, d.en, d.zh, 'registration', `storage/documents/${d.slug}.pdf`, 'application/pdf', bytes, '');
  console.log('pdf', d.slug, bytes);
}
console.log('OK');
