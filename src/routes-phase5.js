// src/routes-phase5.js — Phase 5 public pages + platform features.
// Routes: /news, /news/:slug, /events, /events/view/month, /events/:slug,
//         /events/:slug.ics, /calendar, /media, /parents/*, /documents,
//         /documents/:slug, /search, /privacy, /disclaimer, /sitemap.xml.
// Plus 301 redirects from research/wiki/url-map.md.

import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { searchContent } from './search.js';
import { icsForEvents } from './ics.js';
import { buildSitemap } from './sitemap.js';
import { lookupRedirect } from './redirects.js';
import { bodyFor } from './helpers.js';

const PER_PAGE = 12;
const ANN_KINDS = ['all', 'weekly', 'news', 'press', 'notice'];
const DOC_CATS = ['weekly', 'calendar', 'handbook', 'class-info', 'contest', 'registration', 'event', 'form', 'scrip'];

export function registerPhase5Routes(app, bridge) {
  const { makeRenderPart, renderShell, pageView, t, db, SUPPORTED, renderMarkdown } = bridge;

  // ---------- /sitemap.xml ----------
  app.get('/sitemap.xml', function (req, res) {
    const base = `${req.protocol}://${req.get('host') || 'localhost:3000'}`;
    res.type('application/xml; charset=utf-8').send(buildSitemap({ base }));
  });


  function page(lang, req, res, routePath, viewFile, ctx, title, desc, jsonLd) {
    const tFn = (key) => t(lang, key);
    const renderPart = makeRenderPart(lang);
    const body = pageView(viewFile, { lang, t: tFn, renderPart, db, ...ctx });
    res.render('layouts/main.ejs', {
      lang, t: tFn, renderPart,
      title, description: desc,
      canonical: `/${lang}${routePath}`,
      enUrl: `/en${routePath}`, zhUrl: `/zh${routePath}`,
      jsonLd,
      body,
      ...renderShell(lang, { langPath: routePath }),
    });
  }

  function notFound(req, res) {
    const lang = req.params.lang || 'en';
    return res.status(404).render('errors/404', {
      lang, t,
      title: t(lang, 'errors.not_found_title'),
      message: t(lang, 'errors.not_found_body'),
    });
  }

  function pickTitle(r, lang) {
    return lang === 'zh' ? (r.title_zh || r.title_en || '') : (r.title_en || r.title_zh || '');
  }

  // ---------- /news (tabs + pagination) ----------
  app.get('/:lang/news', function (req, res) {
    const lang = req.params.lang;
    if (!SUPPORTED.includes(lang)) return notFound(req, res);
    const kind = ANN_KINDS.includes(req.query.kind) ? req.query.kind : 'all';
    const pgNum = Math.max(1, parseInt(req.query.page || '1', 10) || 1);

    const where = kind === 'all' ? 'a.published = 1' : 'a.published = 1 AND a.kind = ?';
    const params = kind === 'all' ? [] : [kind];
    const total = db.prepare(`SELECT COUNT(*) c FROM announcements a WHERE ${where}`).get(...params).c;
    const anns = db.prepare(
      `SELECT a.*, d.title_en AS doc_title_en, d.title_zh AS doc_title_zh
       FROM announcements a LEFT JOIN documents d ON d.id = a.document_id
       WHERE ${where}
       ORDER BY a.pinned DESC, a.published_at DESC, a.id DESC
       LIMIT ? OFFSET ?`
    ).all(...params, PER_PAGE, (pgNum - 1) * PER_PAGE);

    page(lang, req, res, '/news', 'news.ejs',
      { news: { kind, page: pgNum, perPage: PER_PAGE, total, anns } },
      lang === 'zh' ? '新聞與通告' : 'News & Announcements',
      lang === 'zh' ? '每週通告、新聞、媒體剪報與通知。' : 'Weekly announcements, news, press archive and notices.');
  });

  // ---------- /news/:slug ----------
  app.get('/:lang/news/:slug', function (req, res) {
    const lang = req.params.lang;
    if (!SUPPORTED.includes(lang)) return notFound(req, res);
    const ann = db.prepare(
      `SELECT a.*, d.slug AS doc_slug, d.file_path AS doc_path, d.bytes AS doc_bytes,
              d.title_en AS doc_title_en, d.title_zh AS doc_title_zh
       FROM announcements a LEFT JOIN documents d ON d.id = a.document_id
       WHERE a.slug = ? AND a.published = 1`
    ).get(req.params.slug);
    if (!ann) return notFound(req, res);
    const doc = ann.doc_slug ? {
      slug: ann.doc_slug, file_path: ann.doc_path, bytes: ann.doc_bytes,
      title_en: ann.doc_title_en, title_zh: ann.doc_title_zh,
    } : null;
    const bodyHtml = renderMarkdown(
      lang === 'zh' ? (ann.body_zh || ann.body_en) : (ann.body_en || ann.body_zh));
    const related = db.prepare(
      `SELECT slug, title_en, title_zh, published_at FROM announcements
       WHERE published = 1 AND slug != ? ORDER BY pinned DESC, published_at DESC LIMIT 5`
    ).all(ann.slug);

    page(lang, req, res, `/news/${ann.slug}`, 'news-detail.ejs',
      { ann, doc, bodyHtml, related },
      pickTitle(ann, lang),
      lang === 'zh' ? (ann.summary_zh || ann.summary_en || '') : (ann.summary_en || ann.summary_zh || ''),
      {
        '@context': 'https://schema.org', '@type': 'Article',
        headline: pickTitle(ann, lang),
        datePublished: ann.published_at,
        inLanguage: lang === 'zh' ? 'zh-Hant' : 'en',
      });
  });

  // ---------- /events (list + month) ----------
  function parseMonthParam(req) {
    const m = req.query.month;
    if (!m) return new Date();
    const [y, mo] = String(m).split('-').map(Number);
    if (!y || !mo || mo < 1 || mo > 12) return new Date();
    return new Date(y, mo - 1, 1);
  }

  function allEvents() {
    return db.prepare('SELECT * FROM events WHERE published = 1 ORDER BY starts_at ASC, id ASC').all();
  }

  app.get('/:lang/events', function (req, res) {
    const lang = req.params.lang;
    if (!SUPPORTED.includes(lang)) return notFound(req, res);
    const events = allEvents();
    page(lang, req, res, '/events', 'events.ejs',
      { events, view: 'list' },
      lang === 'zh' ? '活動' : 'Events',
      lang === 'zh' ? '即將舉行的活動與學年行事曆。' : 'Upcoming events and the school-year calendar.',
      {
        '@context': 'https://schema.org', '@type': 'ItemList',
        itemListElement: events.map((e, i) => ({
          '@type': 'ListItem', position: i + 1,
          name: pickTitle(e, lang), url: `/${lang}/events/${e.slug}`,
        })),
      });
  });

  app.get('/:lang/events/view/month', function (req, res) {
    const lang = req.params.lang;
    if (!SUPPORTED.includes(lang)) return notFound(req, res);
    page(lang, req, res, '/events/view/month', 'events.ejs',
      { events: allEvents(), month: parseMonthParam(req), view: 'month' },
      lang === 'zh' ? '活動 — 月曆' : 'Events — Calendar',
      lang === 'zh' ? '以月曆檢視 SDCA 活動。' : 'Browse SDCA events on a calendar.');
  });

  // ---------- /events/:slug.ics (iCal export) ----------
  // Middleware: intercept any /:lang/events/<slug>.ics before the :slug route.
  app.use('/:lang/events/:slug', function (req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (!String(req.params.slug || '').endsWith('.ics')) return next();
    const lang = req.params.lang;
    if (!SUPPORTED.includes(lang)) return notFound(req, res);
    const slug = req.params.slug.slice(0, -4); // strip .ics
    const ev = db.prepare('SELECT * FROM events WHERE slug = ? AND published = 1').get(slug);
    if (!ev) return notFound(req, res);
    const ics = icsForEvents([{
      title: pickTitle(ev, lang),
      description: lang === 'zh' ? (ev.description_zh || ev.description_en || '') : (ev.description_en || ev.description_zh || ''),
      location: ev.location || '',
      starts_at: ev.starts_at,
      ends_at: ev.ends_at,
      slug: ev.slug,
      all_day: !!ev.all_day,
    }], { calendarName: 'SDCA events' });
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${ev.slug}.ics"`);
    res.send(ics);
  });

  // ---------- /events/:slug ----------
  app.get('/:lang/events/:slug', function (req, res) {
    const lang = req.params.lang;
    if (!SUPPORTED.includes(lang)) return notFound(req, res);
    const ev = db.prepare('SELECT * FROM events WHERE slug = ? AND published = 1').get(req.params.slug);
    if (!ev) return notFound(req, res);
    const bodyHtml = renderMarkdown(
      lang === 'zh' ? (ev.description_zh || ev.description_en) : (ev.description_en || ev.description_zh));
    const related = db.prepare(
      `SELECT * FROM events WHERE published = 1 AND slug != ? ORDER BY starts_at DESC LIMIT 4`
    ).all(ev.slug);
    page(lang, req, res, `/events/${ev.slug}`, 'event-detail.ejs',
      { ev, bodyHtml, related },
      pickTitle(ev, lang),
      lang === 'zh' ? (ev.description_zh || ev.description_en || '') : (ev.description_en || ev.description_zh || ''),
      {
        '@context': 'https://schema.org', '@type': 'Event',
        name: pickTitle(ev, lang),
        startDate: ev.starts_at,
        endDate: ev.ends_at || undefined,
        location: ev.location ? { '@type': 'Place', name: ev.location } : undefined,
      });
  });

  // ---------- /calendar ----------
  app.get('/:lang/calendar', function (req, res) {
    const lang = req.params.lang;
    if (!SUPPORTED.includes(lang)) return notFound(req, res);
    const docs = db.prepare(
      `SELECT * FROM documents WHERE published = 1 AND category = 'calendar'
       ORDER BY school_year DESC, sort, id`
    ).all();
    const events = db.prepare('SELECT * FROM events WHERE published = 1 ORDER BY starts_at ASC LIMIT 30').all();
    page(lang, req, res, '/calendar', 'calendar.ejs',
      { docs, events },
      lang === 'zh' ? '行事曆' : 'Calendar',
      lang === 'zh' ? '學年行事曆、教室地圖與重要日期。' : 'School-year calendars, the classroom map and key dates.');
  });

  // ---------- /media ----------
  app.get('/:lang/media', function (req, res) {
    const lang = req.params.lang;
    if (!SUPPORTED.includes(lang)) return notFound(req, res);
    const photos = db.prepare(`SELECT * FROM media_items WHERE kind = 'photo' AND image != '' ORDER BY taken_at DESC, id`).all();
    const videos = db.prepare(`SELECT * FROM media_items WHERE kind = 'video' AND url != '' ORDER BY id`).all();
    const albums = db.prepare(`SELECT * FROM media_items WHERE kind = 'album' AND url != '' ORDER BY id`).all();
    page(lang, req, res, '/media', 'media.ejs',
      { photos, videos, albums },
      lang === 'zh' ? '照片與影片' : 'Photos & Videos',
      lang === 'zh' ? 'SDCA 課堂、節慶與活動的精彩瞬間。' : 'Moments from SDCA classrooms, festivals and events.',
      {
        '@context': 'https://schema.org', '@type': 'ImageGallery',
        name: lang === 'zh' ? 'SDCA 照片集' : 'SDCA photo gallery',
        image: photos.map((p) => p.image ? (p.image.startsWith('/') ? p.image : `/img/${p.image.replace(/^img\//, '')}`) : null).filter(Boolean),
      });
  });

  // ---------- /parents/* ----------
  const PARENT_LINKS = [
    { p: '/parents/handbook', en: 'Handbook & Policies', zh: '手冊與政策' },
    { p: '/parents/volunteer', en: 'Volunteer', zh: '志工' },
    { p: '/parents/scrip', en: 'Scrip', zh: '書券' },
  ];
  const PARENT_ROUTES = [
    { path: '/parents/handbook', slug: 'parents-handbook', cat: 'handbook' },
    { path: '/parents/volunteer', slug: 'parents-volunteer', cat: 'form' },
    { path: '/parents/scrip', slug: 'parents-scrip', cat: 'scrip' },
  ];
  for (const r of PARENT_ROUTES) {
    app.get(`/:lang${r.path}`, function (req, res) {
      const lang = req.params.lang;
      if (!SUPPORTED.includes(lang)) return notFound(req, res);
      const pg = db.prepare('SELECT * FROM pages WHERE slug = ?').get(r.slug);
      const relatedDocs = db.prepare(
        `SELECT * FROM documents WHERE published = 1 AND category = ? ORDER BY sort, id LIMIT 6`
      ).all(r.cat);
      const bf = pg ? bodyFor(pg, lang) : { html: '', note: null };
      const subLinks = PARENT_LINKS.filter((l) => l.p !== r.path).map((l) => ({
        href: `/${lang}${l.p}`,
        label: lang === 'zh' ? l.zh : l.en,
      }));
      page(lang, req, res, r.path, 'parents.ejs',
        { page: pg, relatedDocs, subLinks, mdBody: bf.html, bodyNote: bf.note },
        pg ? pickTitle(pg, lang) : (lang === 'zh' ? '家長專區' : 'Parents'),
        lang === 'zh' ? 'SDCA 家長專區：手冊、志工、書券與表單。' : 'SDCA parent resources: handbook, volunteer, scrip and forms.');
    });
  }

  // ---------- /documents ----------
  app.get('/:lang/documents', function (req, res) {
    const lang = req.params.lang;
    if (!SUPPORTED.includes(lang)) return notFound(req, res);
    const cat = DOC_CATS.includes(req.query.cat) ? req.query.cat : 'all';
    const q = String(req.query.q || '').trim();
    const cats = db.prepare(
      `SELECT category, COUNT(*) c FROM documents WHERE published = 1 GROUP BY category ORDER BY c DESC, category`
    ).all();
    let sql = 'SELECT * FROM documents WHERE published = 1';
    const params = [];
    if (cat !== 'all') { sql += ' AND category = ?'; params.push(cat); }
    if (q) {
      sql += ' AND (title_en LIKE ? OR title_zh LIKE ? OR slug LIKE ?)';
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    sql += ' ORDER BY school_year DESC, sort, id';
    const docs = db.prepare(sql).all(...params);
    page(lang, req, res, '/documents', 'documents.ejs',
      { docs, cat, q, cats: cats.map((c) => ({ id: c.category, count: c.c })) },
      lang === 'zh' ? '文件與表單' : 'Documents & Forms',
      lang === 'zh' ? '學年行事曆、手冊、比賽規則、每週 PDF 等。' : 'School calendars, handbooks, contest rules, weekly PDFs and more.');
  });

  // ---------- /documents/:slug (serves the PDF when present) ----------
  app.get('/:lang/documents/:slug', function (req, res) {
    const lang = req.params.lang;
    if (!SUPPORTED.includes(lang)) return notFound(req, res);
    const doc = db.prepare('SELECT * FROM documents WHERE slug = ? AND published = 1').get(req.params.slug);
    if (!doc) return notFound(req, res);
    const file = path.join(config.root, doc.file_path);
    if (fs.existsSync(file)) {
      res.setHeader('Content-Type', doc.mime || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${path.basename(doc.file_path)}"`);
      return res.sendFile(file);
    }
    const related = db.prepare(
      `SELECT * FROM documents WHERE published = 1 AND category = ? AND slug != ? ORDER BY sort, id LIMIT 5`
    ).all(doc.category, doc.slug);
    page(lang, req, res, `/documents/${doc.slug}`, 'document-detail.ejs',
      { doc, relatedDocs: related },
      lang === 'zh' ? (doc.title_zh || doc.title_en) : (doc.title_en || doc.title_zh),
      doc.category || 'SDCA document',
      {
        '@context': 'https://schema.org', '@type': 'Document',
        name: lang === 'zh' ? (doc.title_zh || doc.title_en) : (doc.title_en || doc.title_zh),
        encodingFormat: doc.mime,
      });
  });

  // ---------- /search?q= ----------
  app.get('/:lang/search', function (req, res) {
    const lang = req.params.lang;
    if (!SUPPORTED.includes(lang)) return notFound(req, res);
    const q = String(req.query.q || '').trim();
    const { rows, engine } = searchContent(db, q, { limit: 30, lang });
    page(lang, req, res, '/search', 'search.ejs',
      { q, rows, engine },
      lang === 'zh' ? '搜尋' : 'Search',
      lang === 'zh' ? '搜尋 SDCA 網站。' : 'Search the SDCA website.');
  });

  // ---------- /privacy, /disclaimer ----------
  for (const slug of ['privacy', 'disclaimer']) {
    app.get(`/:lang/${slug}`, function (req, res) {
      const lang = req.params.lang;
      if (!SUPPORTED.includes(lang)) return notFound(req, res);
      const pg = db.prepare('SELECT * FROM pages WHERE slug = ?').get(slug);
      const bf = pg ? bodyFor(pg, lang) : { html: '', note: null };
      page(lang, req, res, `/${slug}`, 'static-page.ejs',
        { pg, mdBody: bf.html, bodyNote: bf.note },
        pg ? pickTitle(pg, lang) : slug,
        lang === 'zh' ? 'SDCA 法律頁面。' : 'SDCA legal page.');
    });
  }

}
