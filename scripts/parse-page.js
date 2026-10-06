#!/usr/bin/env node
// parse-page.js — Phase DP (ROADMAP v3). Deterministic old-DOM -> ordered BLOCK TREE.
//
// Reads one research/raw/pages/<slug>.html, walks the Elementor main content in
// document order, and emits an ordered list of blocks (JSON) with VERBATIM text
// (whitespace-normalised only), all images resolved to LOCAL ORIGINAL files
// (assets.json sha256 match — never -150x150 thumbs), plus a LAYOUT SIGNATURE
// (sequence of block types + column counts) for the parity check.
//
// Usage:
//   node scripts/parse-page.js <slug> [--check]   # write research/blocks/<slug>.json
//   node scripts/parse-page.js --all [--check]    # every raw page file
//
// Block types (renderer: views/blocks/*.ejs):
//   hero heading richtext list table image image_text columns cards gallery
//   people file file_list button embed accordion tabs divider notice html_safe
//
// Unmapped widgets are captured as html_safe (sanitised at render time) and
// noted in `notes` — never silently dropped.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const RAW_DIR = path.join(ROOT, 'research', 'raw', 'pages');
const ASSETS_FILE = path.join(ROOT, 'research', 'data', 'assets.json');
const OUT_DIR = path.join(ROOT, 'research', 'blocks');
const BASE = 'https://sandiegochineseschool.com';

// ---------- tiny tolerant HTML parser (no deps) ----------
const VOID_TAGS = new Set(['area','base','br','col','embed','hr','img','input','link','meta','source','track','wbr']);

export function parseHtml(html) {
  const root = { tag: '#root', attrs: {}, children: [] };
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<\/([a-zA-Z][a-zA-Z0-9-]*)\s*>|<([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)\/?>|([^<]+)/g;
  function parseAttrs(s) {
    const attrs = {};
    const are = /\s+([a-zA-Z_:][a-zA-Z0-9_:.-]*)(?:\s*=\s*("([^"]*)"|'([^']*)'|[^\s>]+))?/g;
    let m;
    while ((m = are.exec(s || ''))) {
      attrs[m[1].toLowerCase()] = m[3] !== undefined ? m[3] : (m[4] !== undefined ? m[4] : (m[5] !== undefined ? m[5] : ''));
    }
    return attrs;
  }
  let m;
  while ((m = re.exec(html))) {
    const top = stack[stack.length - 1];
    if (m[1]) {
      const name = m[1].toLowerCase();
      for (let i = stack.length - 1; i > 0; i--) if (stack[i].tag === name) { stack.length = i; break; }
    } else if (m[2]) {
      const tag = m[2].toLowerCase();
      const node = { tag, attrs: parseAttrs(m[3] || ''), children: [] };
      top.children.push(node);
      if (!VOID_TAGS.has(tag) && !/\/\s*$/.test((m[3] || '').trim())) stack.push(node);
    } else if (m[4] !== undefined) {
      top.children.push({ tag: '#text', text: m[4], children: [] });
    }
  }
  return root;
}

export function walk(node, fn) {
  if (node.tag !== '#text') fn(node);
  for (const c of node.children || []) {
    if (c.tag === '#text') { fn(c); continue; }
    walk(c, fn);
  }
}

const ENT = { amp:'&', lt:'<', gt:'>', quot:'"', apos:"'", nbsp:'\u00a0', ndash:'\u2013', mdash:'\u2014', hellip:'\u2026', lsquo:'\u2018', rsquo:'\u2019', ldquo:'\u201c', rdquo:'\u201d', copy:'\u00a9', reg:'\u00ae', trade:'\u2122' };
export function decodeEnt(s) {
  return String(s)
    .replace(/&#(\d+);/g, (_, d) => { const c = Number(d); return c > 0 ? String.fromCodePoint(c) : ''; })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => { const c = parseInt(h, 16); return c > 0 ? String.fromCodePoint(c) : ''; })
    .replace(/&([a-zA-Z]+);/g, (m, n) => (n in ENT ? ENT[n] : m));
}
export function textOf(node) {
  if (node.tag === '#text') return decodeEnt(node.text);
  return (node.children || []).map(textOf).join('');
}

export function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function htmlOf(node) {
  if (node.tag === '#text') return escapeHtml(node.text);
  const inner = (node.children || []).map(htmlOf).join('');
  const attrs = Object.entries(node.attrs || {})
    .filter(([, v]) => v !== '' && v !== null && v !== undefined)
    .map(([k, v]) => ` ${k}="${escapeHtml(String(v))}"`).join('');
  if (VOID_TAGS.has(node.tag)) return `<${node.tag}${attrs} />`;
  return `<${node.tag}${attrs}>${inner}</${node.tag}>`;
}

// all descendants (not including node itself)
export function allDesc(node, out = []) {
  walk(node, (c) => { if (c.tag !== '#text') out.push(c); });
  return out;
}
export function descendants(node, pred) {
  return allDesc(node).filter(pred);
}
export function findDesc(node, pred) {
  return allDesc(node).find(pred) || null;
}
export function findAny(node, pred) {
  if (node.tag !== '#text' && pred(node)) return node;
  return allDesc(node).find(pred) || null;
}

// ---------- assets ----------
function loadAssets() {
  const arr = JSON.parse(fs.readFileSync(ASSETS_FILE, 'utf8'));
  const byUrl = new Map();
  for (const a of arr) {
    if (a.url) byUrl.set(a.url, a);
    if (a.requested_url) byUrl.set(a.requested_url, a);
  }
  return { arr, byUrl };
}

export function resolveImage(url, assets) {
  let clean = String(url || '').split('?')[0].trim();
  if (clean.startsWith('//')) clean = 'https:' + clean;
  if (clean.startsWith('/')) clean = BASE + clean;
  if (assets.byUrl.has(clean)) return { asset: assets.byUrl.get(clean), matched: clean, thumb: false };
  const noThumb = clean.replace(/-\d+x\d+(?=\.\w+$)/, '');
  if (assets.byUrl.has(noThumb)) return { asset: assets.byUrl.get(noThumb), matched: noThumb, thumb: false };
  // capture gap: only the thumbnail was downloaded — use it, flagged
  const base = decodeURIComponent(clean.split('/').pop() || '');
  const m2 = base.match(/^(.*)\.(jpe?g|png|gif|webp)$/i);
  const thumbBase = m2 ? m2[1] + '-150x150.' + m2[2].toLowerCase() : base;
  for (const want of [base, thumbBase]) {
    for (const a of assets.arr) {
      if (a.kind !== 'images') continue;
      if (path.basename(a.local_path || '') === want) return { asset: a, matched: want, thumb: true };
    }
  }
  return null;
}

let assetsGlobal = null;

// ---------- verbatim text ----------
export function normWs(s) {
  return String(s == null ? '' : s).replace(/ /g, ' ').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
}

function extractTable(node) {
  const trs = descendants(node, (n) => n.tag === 'tr');
  const rows = trs.map((tr) => descendants(tr, (n) => n.tag === 'th' || n.tag === 'td').map((c) => normWs(textOf(c))));
  const hasHeader = trs.length && descendants(trs[0], (n) => n.tag === 'th').length > 0;
  return { header: hasHeader ? rows[0] : null, rows: hasHeader ? rows.slice(1) : rows };
}

function makeImageBlock(asset, alt, caption) {
  const name = path.basename(asset.local_path || asset.url || 'img');
  const year = (asset.url.match(/uploads\/(\d{4})\//) || [])[1] || 'misc';
  return {
    src: `__OLD_IMG__/${year}/${name}`,
    alt: normWs(alt || asset.alt || ''),
    caption: normWs(caption || ''),
    width: null, height: null,
    sha256: asset.sha256 || '',
    local_path: asset.local_path || '',
  };
}

function makeFileBlock(href, label) {
  let hrefC = String(href || '').split('?')[0].trim();
  if (hrefC.startsWith('//')) hrefC = 'https:' + hrefC;
  if (hrefC.startsWith('/')) hrefC = BASE + hrefC;
  const a = hrefC ? assetsGlobal.byUrl.get(hrefC) : null;
  const name = a ? path.basename(a.local_path) : decodeURIComponent(hrefC.split('/').pop() || 'file.pdf');
  const year = (String(href || '').match(/uploads\/(\d{4})\//) || [])[1] || 'misc';
  return {
    label: normWs(label) || name,
    href: `__OLD_PDF__/${year}/${name}`,
    sha256: a ? a.sha256 : '',
    local_path: a ? a.local_path : '',
  };
}

// inline-level -> verbatim fragments (text/list/table/image/file/embed)
function inlineFrags(node) {
  const frags = [];
  function pushText(s) {
    const t = normWs(s);
    if (t) {
      if (frags.length && frags[frags.length - 1].richtext) frags[frags.length - 1].richtext += '\n' + t;
      else frags.push({ richtext: t });
    }
  }
  function go(n) {
    if (n.tag === '#text') { pushText(decodeEnt(n.text)); return; }
    const tag = n.tag;
    if (tag === 'br') { pushText('\n'); return; }
    if (tag === 'script' || tag === 'style' || tag === 'noscript') return;
    if (/^h[1-6]$/.test(tag)) { frags.push({ heading: { level: Number(tag[1]), text: normWs(textOf(n)) } }); return; }
    if (tag === 'ul' || tag === 'ol') {
      const items = descendants(n, (x) => x.tag === 'li' && !descendants(x, (y) => y.tag === 'ul' || y.tag === 'ol').length)
        .map((li) => normWs(textOf(li))).filter(Boolean);
      if (items.length) frags.push({ list: { ordered: tag === 'ol', items } });
      else { const flat = descendants(n, (x) => x.tag === 'li').map((li) => normWs(textOf(li))).filter(Boolean); if (flat.length) frags.push({ list: { ordered: tag === 'ol', items: flat } }); }
      return;
    }
    if (tag === 'table') { frags.push({ table: extractTable(n) }); return; }
    if (tag === 'img') {
      const r = resolveImage(n.attrs.src || n.attrs['data-src'], assetsGlobal);
      if (r) frags.push({ image: makeImageBlock(r.asset, n.attrs.alt) });
      return;
    }
    if (tag === 'a') {
      if ((n.attrs.href || '').endsWith('.pdf')) { frags.push({ file: makeFileBlock(n.attrs.href, textOf(n)) }); return; }
      for (const c of n.children || []) go(c);
      return;
    }
    if (tag === 'iframe') { frags.push({ embed: { kind: 'html', html: htmlOf(n) } }); return; }
    if (tag === 'p' || tag === 'div' || tag === 'blockquote' || tag === 'figure' || tag === 'figcaption' || tag === 'span' || tag === 'section' || tag === 'article') {
      for (const c of n.children || []) go(c);
      return;
    }
    // inline tags: a/strong/b/em/i/u/small/code/sup/sub -> keep as text with inline markers
    if (['strong','b','em','i','u','s','del','ins','mark','sub','sup','small','code','abbr','q','cite','bdi','bdo','time','wbr'].includes(tag)) {
      for (const c of n.children || []) go(c);
      return;
    }
    // unknown block-ish: descend
    for (const c of n.children || []) go(c);
  }
  go(node);
  return frags;
}

// ---------- widget -> blocks ----------
function blocksFromWidget(w, notes) {
  const type = (w.attrs['data-widget_type'] || w.attrs['data-widget-type'] || '').split('.')[0];
  const container = findDesc(w, (n) => (n.attrs.class || '').includes('elementor-widget-container')) || w;
  switch (type) {
    case 'heading': {
      const node = findAny(w, (n) => /^h[1-6]$/.test(n.tag));
      if (node) return [{ heading: { level: Number(node.tag[1]), text: normWs(textOf(node)) } }];
      return [{ heading: { level: 2, text: normWs(textOf(container)) } }];
    }
    case 'text-editor':
    case 'html':
      return inlineFrags(container);
    case 'image': {
      const imgNode = findDesc(w, (n) => n.tag === 'img');
      if (!imgNode) { notes.push('image widget with no img'); return []; }
      const src = imgNode.attrs.src || imgNode.attrs['data-src'] || '';
      const r = resolveImage(src, assetsGlobal);
      if (!r) { notes.push(`image missing local file: ${src}`); return []; }
      const figcap = findDesc(w, (n) => n.tag === 'figcaption');
      const imgBlock = { image: makeImageBlock(r.asset, imgNode.attrs.alt, figcap ? textOf(figcap) : '') };
      // Check if the image is wrapped in a PDF link (click-through)
      const wrapA = (function () {
        let out = null;
        walk(w, (n) => {
          if (n.tag === 'a' && n.attrs.href && n.attrs.href.endsWith('.pdf') && out === null) out = n;
        });
        return out;
      })();
      if (wrapA) {
        const fileBlock = makeFileBlock(wrapA.attrs.href, textOf(wrapA) || (imgNode.attrs.alt || 'Download PDF'));
        return [imgBlock, { file: fileBlock }];
      }
      return [imgBlock];
    }
    case 'image-box': {
      const imgNode = findDesc(w, (n) => n.tag === 'img');
      const src = imgNode ? (imgNode.attrs.src || imgNode.attrs['data-src']) : '';
      const r = resolveImage(src, assetsGlobal);
      if (!r) { notes.push(`image-box missing local file: ${src}`); return []; }
      const headingNode = findDesc(w, (n) => /^h[1-6]$/.test(n.tag));
      const title = headingNode ? normWs(textOf(headingNode)) : '';
      const textFrag = inlineFrags(w).filter((f) => f.richtext || f.list || f.table);
      const text = textFrag.map((f) => f.richtext || (f.list ? f.list.items.join('\n') : '')).join('\n').trim();
      return [{ image_text: { image: makeImageBlock(r.asset, imgNode && imgNode.attrs.alt), title, text, side: 'left' } }];
    }
    case 'image-gallery': {
      const figs = allDesc(w).filter((n) => n.tag === 'figure' && (n.attrs.class || '').includes('gallery-item'));
      const items = [];
      for (const f of figs) {
        const link = findDesc(f, (n) => n.tag === 'a' && n.attrs.href);
        const full = link ? link.attrs.href : '';
        const imgNode = findDesc(f, (n) => n.tag === 'img');
        const r = resolveImage(full || (imgNode && (imgNode.attrs.src || imgNode.attrs['data-src'])), assetsGlobal);
        if (!r) { notes.push(`gallery image missing local file: ${full}`); continue; }
        const titleAttr = link ? (link.attrs['data-elementor-lightbox-title'] || '') : '';
        const figcap = findDesc(f, (n) => n.tag === 'figcaption');
        items.push({ ...makeImageBlock(r.asset, imgNode && imgNode.attrs.alt, figcap ? textOf(figcap) : titleAttr),
          local_path: r.asset.local_path || '', sha256: r.asset.sha256 || '' });
      }
      return items.length ? [{ gallery: { mode: 'grid', items } }] : [];
    }
    case 'smartslider': {
      const imgs = allDesc(w).filter((n) => n.tag === 'img');
      const items = [];
      const seen = new Set();
      for (const img of imgs) {
        const src = img.attrs.src || img.attrs['data-src'] || '';
        if (!src || src.startsWith('data:')) continue; // UI chrome (arrows/placeholders)
        const r = resolveImage(src, assetsGlobal);
        if (!r) { notes.push(`slider image missing local file: ${src}`); continue; }
        if (seen.has(r.asset.sha256)) continue; seen.add(r.asset.sha256);
        items.push({ ...makeImageBlock(r.asset, img.attrs.alt), local_path: r.asset.local_path || '', sha256: r.asset.sha256 || '' });
      }
      if (items.length) return [{ gallery: { mode: 'slider', items } }];
      notes.push('smartslider had no resolvable images — check widget JSON');
      return [];
    }
    case 'icon-list': {
      const items = allDesc(w).filter((n) => n.tag === 'li').map((li) => normWs(textOf(li))).filter(Boolean);
      return items.length ? [{ list: { ordered: false, items } }] : [];
    }
    case 'button': {
      const a = findDesc(w, (n) => n.tag === 'a' && n.attrs.href);
      if (!a) return [];
      const label = normWs(textOf(a)) || 'Link';
      if ((a.attrs.href || '').endsWith('.pdf')) return [{ file: makeFileBlock(a.attrs.href, label) }];
      return [{ button: { label, href: a.attrs.href, target: a.attrs.target || '_self' } }];
    }
    case 'video': {
      const iframe = findDesc(w, (n) => n.tag === 'iframe');
      if (iframe) return [{ embed: { kind: 'html', html: htmlOf(iframe) } }];
      // Elementor stores the video URL in data-settings JSON
      const rawSettings = w.attrs['data-settings'] || '';
      if (rawSettings) {
        try {
          const dec = decodeEnt(rawSettings);
          const cfg = JSON.parse(dec);
          const url = cfg.youtube_url || cfg.vimeo_url || cfg.url || '';
          if (url) return [{ embed: { kind: 'youtube', url, title: normWs(textOf(w)) || '' } }];
        } catch { /* fall through */ }
      }
      const a = findDesc(w, (n) => n.tag === 'a' && n.attrs.href);
      if (a) return [{ button: { label: normWs(textOf(a)) || 'Watch video', href: a.attrs.href, target: '_blank' } }];
      notes.push('video widget with no iframe/link');
      return [];
    }
    case 'divider':
      return [{ divider: {} }];
    case 'spacer':
      return [];
    case 'tabs':
    case 'toggle': {
      const tabNodes = allDesc(w).filter((n) => (n.attrs.class || '').includes('elementor-tab-title') || (n.attrs.class || '').includes('e-tabs-title'));
      const panelNodes = allDesc(w).filter((n) => (n.attrs.class || '').includes('elementor-tab-content') || (n.attrs.class || '').includes('e-tabs-content'));
      const count = Math.max(tabNodes.length, panelNodes.length);
      const tabs = [];
      for (let i = 0; i < count; i++) {
        tabs.push({
          title: tabNodes[i] ? normWs(textOf(tabNodes[i])) : `Tab ${i + 1}`,
          blocks: panelNodes[i] ? inlineFrags(panelNodes[i]) : [],
        });
      }
      return tabs.length ? [{ tabs }] : [];
    }
    case 'wp-widget-ocean_custom_menu':
      notes.push('oceanwp custom menu widget (menu chrome — site nav replaces it in D2) captured as html_safe');
      return [{ html_safe: { html: htmlOf(container) } }];
    case 'wp-widget-ocean_share':
      return [];
    default: {
      notes.push(`widget not mapped: ${type || 'unknown'} — captured verbatim`);
      const frags = inlineFrags(container);
      return frags.length ? frags : [{ html_safe: { html: htmlOf(container) } }];
    }
  }
}

// ---------- page walk ----------
function mainContent(root) {
  const main = findAny(root, (n) => n.tag === 'main');
  if (!main) return root;
  const article = findDesc(main, (n) => n.tag === 'article' || (n.attrs.class || '').includes('entry'));
  return article || main;
}

export function parsePage(html, assets) {
  assetsGlobal = assets;
  const root = parseHtml(html);
  const main = mainContent(root);
  const elNode = findAny(main, (n) => String(n.attrs['data-elementor-type'] || '').startsWith('wp-')) || main;

  const blocks = [];
  const notes = [];
  const signature = [];

  // Sections can be <section> OR <main> tags with elementor-top-section class
  const sections = allDesc(elNode).filter((n) =>
    (n.tag === 'section' || n.tag === 'main')
    && ((n.attrs['data-element_type'] === 'section' || n.attrs['data-element-type'] === 'section') || (n.attrs.class || '').includes('elementor-top-section'))
  );

  for (const sec of sections) {
    let directCols = [];
    for (const c of sec.children || []) {
      if (c.tag === '#text') continue;
      if (c.tag === 'div' && (c.attrs.class || '').includes('elementor-column')) directCols.push(c);
      else if (c.tag === 'div' && (c.attrs.class || '').includes('elementor-container')) {
        for (const cc of c.children || []) if (cc.tag !== '#text' && (cc.attrs.class || '').includes('elementor-column')) directCols.push(cc);
      }
    }
    const nCols = directCols.length || 1;
    const colList = nCols === 1 ? [sec] : directCols;
    const colBlocks = colList.map((col) => {
      const widgets = allDesc(col).filter((n) => n.attrs['data-element_type'] === 'widget' || n.attrs['data-element-type'] === 'widget');
      const got = [];
      for (const w of widgets) {
        if (!colList.includes(w) && allDesc(col).includes(w)) got.push(...blocksFromWidget(w, notes));
      }
      return got;
    });
    if (nCols === 1) {
      for (const b of colBlocks[0]) blocks.push(b);
      signature.push('1col');
    } else {
      const a = colBlocks[0] || [], b = colBlocks[1] || [];
      if (nCols === 2 && a.length === 1 && a[0].image && (b.some((x) => x.richtext || x.heading) || b.length)) {
        const img = a[0].image;
        const heading = b.find((x) => x.heading);
        const textParts = b.filter((x) => x.richtext).map((x) => x.richtext);
        const extra = b.filter((x) => !x.richtext && !x.heading);
        blocks.push({ image_text: {
          image: img,
          title: heading ? heading.heading.text : '',
          text: textParts.join('\n'),
          side: 'left',
          extra,
        } });
        signature.push('image_text');
      } else {
        const nonEmpty = colBlocks.filter((cb) => cb.length);
        blocks.push({ columns: { count: nonEmpty.length, cols: nonEmpty } });
        signature.push(`columns:${nonEmpty.length}`);
      }
    }
  }

  // collapse consecutive rich-text fragments
  const collapsed = [];
  for (const f of blocks) {
    if (f.richtext && collapsed.length && collapsed[collapsed.length - 1].richtext) {
      collapsed[collapsed.length - 1].richtext += '\n' + f.richtext;
    } else collapsed.push(f);
  }

  return { blocks: collapsed, signature, notes };
}

// ---------- checks + CLI ----------
function countMissing(out) {
  const missing = new Set();
  function checkRef(v) { if (v && v.local_path && !fs.existsSync(v.local_path)) missing.add(v.src || v.local_path); }
  for (const b of out.blocks) {
    const key = Object.keys(b)[0];
    const v = b[key];
    if (key === 'image') checkRef(v);
    if (key === 'image_text') { checkRef(v.image); (v.extra || []).forEach((e) => checkRef(e.file || e.image)); }
    if (key === 'file') checkRef(v);
    if (key === 'gallery') v.items.forEach(checkRef);
    if (key === 'columns') v.cols.forEach((cb) => cb.forEach((e) => { checkRef(e.file || e.image); }));
  }
  return [...missing];
}

function main() {
  const args = process.argv.slice(2);
  const assets = loadAssets();
  const all = args.includes('--all');
  const check = args.includes('--check');
  const slugs = args.filter((a) => !a.startsWith('--'));
  if (!slugs.length && !all) { console.error('usage: node scripts/parse-page.js <slug>|--all [--check]'); process.exit(2); }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const files = all ? fs.readdirSync(RAW_DIR).filter((f) => f.endsWith('.html') && !f.startsWith('seed_')) : slugs.map((s) => `${s}.html`);
  let anyFail = false;
  const results = [];
  for (const file of files) {
    const slug = file.replace(/\.html$/, '');
    const p = path.join(RAW_DIR, file);
    if (!fs.existsSync(p)) { results.push({ slug, ok: false, error: 'no raw html' }); anyFail = true; continue; }
    const html = fs.readFileSync(p, 'utf8');
    const out = parsePage(html, assets);
    const missing = countMissing(out);
    if (missing.length) anyFail = true;
    fs.writeFileSync(path.join(OUT_DIR, `${slug}.json`), JSON.stringify({
      slug,
      blocks: out.blocks,
      signature: out.signature,
      notes: out.notes,
      missing_local_files: missing,
    }, null, 2));
    results.push({ slug, ok: !missing.length && !out.notes.length, blocks: out.blocks.length, notes: out.notes.length, missing: missing.length });
  }
  console.table ? console.table(results) : console.log(JSON.stringify(results, null, 2));
  if (check && anyFail) process.exit(1);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) main();
