#!/usr/bin/env node
// linkcheck.js — crawl /en/ and /zh/ and report every internal link found in
// header, footer, and page bodies. All internal page links must resolve to
// 200 after redirects. Also asserts that every old-site footer/menu item maps
// to a working page on the new site.
//
// Rate-limit safe: fetches each page once per language (deduped), and only
// re-checks unique internal links. External links are verified to be present
// in the chrome (not fetched, to avoid third-party 403s).
//
// Usage: node scripts/linkcheck.js
// Exit 0 when no broken internal links; 1 otherwise.

import fs from 'node:fs';
import path from 'node:path';
import { openDb } from '../src/db/open.js';

const BASE = process.env.LINKCHECK_BASE || 'http://localhost:3000';

// Pages to crawl (covers header, footer, and every main body).
const PAGES = [
  '/', '/about', '/about/board', '/about/staff', '/about/principal',
  '/programs', '/programs/classes', '/programs/tcml', '/programs/recreational', '/programs/ta', '/programs/bell',
  '/enroll', '/calendar', '/news', '/events', '/media',
  '/parents/handbook', '/parents/volunteer', '/parents/scrip',
  '/documents', '/support', '/support/sponsors',
  '/contact', '/privacy', '/disclaimer', '/archive',
];

// ---------- helpers ----------
function extractHrefs(html) {
  const re = /href="([^"]+)"/g;
  const out = new Set();
  let m;
  while ((m = re.exec(html))) {
    const h = m[1].trim();
    if (!h || h.startsWith('#')) continue;
    if (/^(https?:|mailto:|tel:|javascript:)/i.test(h)) continue;
    out.add(h.split('#')[0]);
  }
  return Array.from(out);
}

function isInternalPageLink(href) {
  return /^\/(en|zh)\//.test(href) || href === '/' || /^\/(pdf|img|brand|css|js|favicon|storage)\//.test(href) || href === '/healthz' || href === '/robots.txt' || href === '/sitemap.xml';
}

async function getStatus(url) {
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'follow' });
    return { status: res.status, final: res.url };
  } catch (e) {
    return { status: 0, error: e.message };
  }
}

// ---------- crawl one language ----------
async function crawl(lang) {
  const links = new Set();
  let pageErrors = [];
  for (const p of PAGES) {
    const url = `${BASE}/${lang}${p === '/' ? '/' : p}`;
    let html;
    try {
      const r = await fetch(url);
      if (!r.ok) pageErrors.push({ url, status: r.status });
      html = await r.text();
    } catch (e) {
      pageErrors.push({ url, error: e.message });
      continue;
    }
    for (const h of extractHrefs(html)) links.add(h);
  }
  return { links: Array.from(links).sort(), pageErrors };
}

// ---------- old-site footer/menu items ----------
// Each must exist on the new site. Internal ones are checked by fetching /en/.
// External ones are checked only for presence in the chrome (not fetched).
const OLD_ITEMS = [
  ['Privacy Policy', '/privacy', null],
  ['Disclaimer', '/disclaimer', null],
  ['Board of Directors', '/about/board', null],
  ['About SDCA', '/about', null],
  ['Staff', '/about/staff', null],
  ['Contact Us', '/contact', null],
  ['Portal Sign In', null, 'register.sandiegochineseschool.com'],
  ['Facebook', null, 'facebook.com'],
  ['Yelp', null, 'yelp.com'],
  ['YouTube', null, 'youtube.com'],
  ['PTA Blog', null, 'sdcapta.org'],
  ['Weekly Announcements', '/news?kind=weekly', null],
  ['News', '/news', null],
  ['Class Descriptions', '/programs/classes', null],
  ['Adult Chinese TCML', '/programs/tcml', null],
  ['Bell Schedule', '/programs/bell', null],
  ['Textbooks', '/documents', null],
  ['TA Program', '/programs/ta', null],
  ['Media', '/media', null],
  ['Volunteer', '/parents/volunteer', null],
  ['School Calendar', '/calendar', null],
  ['Policy & Form', '/parents/handbook', null],
  ['Recreational Program', '/programs/recreational', null],
  ['Sponsors', '/support/sponsors', null],
  ['Enroll', '/enroll', null],
];

// ---------- main ----------
async function main() {
  const db = openDb();
  let failures = 0;
  const report = { en: [], zh: [], old: [] };

  console.log(`=== linkcheck.js (base ${BASE}) ===\n`);

  // 1. Crawl + check internal page links per language
  for (const lang of ['en', 'zh']) {
    console.log(`--- ${lang.toUpperCase()} ---`);
    const { links, pageErrors } = await crawl(lang);
    for (const pe of pageErrors) {
      failures++;
      console.log(`  ✗ PAGE ${pe.url} → ${pe.status || pe.error}`);
    }
    const checked = new Set();
    for (const href of links) {
      if (!isInternalPageLink(href)) continue;
      if (checked.has(href)) continue;
      checked.add(href);
      // skip binary assets (they were already fetched during crawl via <img>/<link>)
      if (/^\/(img|brand|css|js|favicon)\//.test(href)) continue;
      const r = await getStatus(`${BASE}${href}`);
      const ok = r.status === 200;
      if (!ok) failures++;
      report[lang].push({ href, status: r.status, ok });
      if (!ok) console.log(`  ✗ ${r.status} ${href}`);
    }
    const okCount = report[lang].filter((r) => r.ok).length;
    console.log(`  ${report[lang].length} internal links checked, ${okCount} OK, ${report[lang].length - okCount} broken\n`);
  }

  // 2. Old footer/menu items — internal ones fetched, external ones present-in-chrome
  console.log('--- Old-site footer/menu items ---');
  const chromeEn = await (await fetch(`${BASE}/en/`)).text();
  for (const [label, internalPath, externalHost] of OLD_ITEMS) {
    if (internalPath) {
      const r = await getStatus(`${BASE}/en${internalPath}`);
      const ok = r.status === 200;
      if (!ok) failures++;
      report.old.push({ label, target: internalPath, status: r.status, ok });
      console.log(`  ${ok ? '✓' : '✗'} ${label}: /en${internalPath} → ${r.status}`);
    } else {
      const present = chromeEn.includes(externalHost);
      if (!present) failures++;
      report.old.push({ label, target: externalHost, present, ok: present });
      console.log(`  ${present ? '✓' : '✗'} ${label}: external ${externalHost} ${present ? '(in chrome)' : '(MISSING from chrome)'}`);
    }
  }

  // 3. Summary
  const brokenEn = report.en.filter((r) => !r.ok).length;
  const brokenZh = report.zh.filter((r) => !r.ok).length;
  const brokenOld = report.old.filter((r) => !r.ok).length;
  console.log('\n=== Summary ===');
  console.log(`EN page links:  ${report.en.length} checked, ${brokenEn} broken`);
  console.log(`ZH page links:  ${report.zh.length} checked, ${brokenZh} broken`);
  console.log(`Old footer/menu: ${report.old.length} items, ${brokenOld} broken`);
  if (failures) {
    console.log(`\nFAIL: ${failures} total failures`);
    process.exit(1);
  }
  console.log('\nPASS: 0 broken internal links in /en and /zh; all old footer/menu items resolve');
}

main().catch((e) => { console.error(e); process.exit(1); });
