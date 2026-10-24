// src/routes-content.js — content pages and features: news, events, media, documents, archive, parents, search, legal.
// Routes: /news, /news/:slug, /events + /events/view/month (redirect to /calendar), /events/:slug,
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
import { bodyFor, setting } from './helpers.js';
import { todayLocal } from './datetime.js';
import { portedCtx, usePorted } from './ported.js';
import { t, pickLang, localized } from './i18n/index.js';
import { renderPage, renderMarkdown } from './web/render.js';
import { publishedEvent, heroSlides } from './queries/content.js';

const PER_PAGE = 12;
const ANN_KINDS = ['all', 'weekly', 'news', 'press', 'notice'];
const DOC_CATS = ['weekly', 'calendar', 'handbook', 'class-info', 'contest', 'registration', 'event', 'form', 'scrip'];

export function registerContentRoutes(app, bridge) {
  const { db } = bridge;

  // ---------- /sitemap.xml ----------
  app.get('/sitemap.xml', function (req, res) {
    const base = `${req.protocol}://${req.get('host') || 'localhost:3000'}`;
    res.type('application/xml; charset=utf-8').send(buildSitemap({ base }));
  });


  function page(lang, req, res, routePath, viewFile, ctx, title, desc, jsonLd) {
    renderPage(res, { lang, view: viewFile, ctx, title, description: desc, path: routePath, jsonLd, db });
  }

  function notFound(req, res) {
    const lang = req.params.lang || 'en';
    return res.status(404).render('errors/404', {
      lang, t,
      title: t(lang, 'errors.not_found_title'),
      message: t(lang, 'errors.not_found_body'),
    });
  }

  // ---------- /news (tabs + pagination) ----------
  app.get('/:lang/news', function (req, res) {
    const lang = req.params.lang;
    const kind = ANN_KINDS.includes(req.query.kind) ? req.query.kind : 'all';
    const pgNum = Math.max(1, parseInt(req.query.page || '1', 10) || 1);

    const where = kind === 'all' ? 'a.published = 1 AND a.deleted_at IS NULL' : 'a.published = 1 AND a.deleted_at IS NULL AND a.kind = ?';
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
      pickLang(lang, 'News & Announcements', '新聞與通告'),
      pickLang(lang, 'Weekly announcements, news, press archive and notices.', '每週通告、新聞、媒體剪報與通知。'));
  });

  // ---------- /news/:slug ----------
  app.get('/:lang/news/:slug', function (req, res) {
    const lang = req.params.lang;
    const ann = db.prepare(
      `SELECT a.*, d.slug AS doc_slug, d.file_path AS doc_path, d.bytes AS doc_bytes,
              d.title_en AS doc_title_en, d.title_zh AS doc_title_zh
       FROM announcements a LEFT JOIN documents d ON d.id = a.document_id
       WHERE a.slug = ? AND a.published = 1 AND a.deleted_at IS NULL`
    ).get(req.params.slug);
    if (!ann) return notFound(req, res);
    const doc = ann.doc_slug ? {
      slug: ann.doc_slug, file_path: ann.doc_path, bytes: ann.doc_bytes,
      title_en: ann.doc_title_en, title_zh: ann.doc_title_zh,
    } : null;
    const bodyHtml = renderMarkdown(
      localized(ann, 'body', lang));
    const related = db.prepare(
      `SELECT slug, title_en, title_zh, published_at FROM announcements
       WHERE published = 1 AND deleted_at IS NULL AND slug != ? ORDER BY pinned DESC, published_at DESC LIMIT 5`
    ).all(ann.slug);

    page(lang, req, res, `/news/${ann.slug}`, 'news-detail.ejs',
      { ann, doc, bodyHtml, related },
      localized(ann, 'title', lang),
      localized(ann, 'summary', lang),
      {
        '@context': 'https://schema.org', '@type': 'Article',
        headline: localized(ann, 'title', lang),
        datePublished: ann.published_at,
        inLanguage: pickLang(lang, 'en', 'zh-Hant'),
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

  // The old /events list and /events/view/month pages are merged into /calendar ("Events and Calendar").
  app.get('/:lang/events', function (req, res) {
    res.redirect(301, `/${req.params.lang}/calendar?view=list`);
  });
  app.get('/:lang/events/view/month', function (req, res) {
    res.redirect(301, `/${req.params.lang}/calendar${req.query.month ? '?month=' + encodeURIComponent(String(req.query.month)) : ''}`);
  });

  // ---------- /events/:slug.ics (iCal export) ----------
  // Middleware: intercept any /:lang/events/<slug>.ics before the :slug route.
  app.use('/:lang/events/:slug', function (req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (!String(req.params.slug || '').endsWith('.ics')) return next();
    const lang = req.params.lang;
    const slug = req.params.slug.slice(0, -4); // strip .ics
    const ev = publishedEvent(db, slug);
    if (!ev) return notFound(req, res);
    const ics = icsForEvents([{
      title: localized(ev, 'title', lang),
      description: localized(ev, 'description', lang),
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
    const ev = publishedEvent(db, req.params.slug);
    if (!ev) return notFound(req, res);
    const bodyHtml = renderMarkdown(
      localized(ev, 'description', lang));
    const related = db.prepare(
      `SELECT * FROM events WHERE deleted_at IS NULL AND published = 1 AND slug != ? ORDER BY starts_at DESC LIMIT 4`
    ).all(ev.slug);
    page(lang, req, res, `/events/${ev.slug}`, 'event-detail.ejs',
      { ev, bodyHtml, related },
      localized(ev, 'title', lang),
      localized(ev, 'description', lang),
      {
        '@context': 'https://schema.org', '@type': 'Event',
        name: localized(ev, 'title', lang),
        startDate: ev.starts_at,
        endDate: ev.ends_at || undefined,
        location: ev.location ? { '@type': 'Place', name: ev.location } : undefined,
      });
  });

  // ---------- /calendar ----------
  app.get('/:lang/calendar', function (req, res) {
    const lang = req.params.lang;
    const docs = db.prepare(
      `SELECT * FROM documents WHERE published = 1 AND category = 'calendar'
       ORDER BY school_year DESC, sort, id`
    ).all();
    // full-size month calendar: every published event touching the visible weeks (events are managed in the portal)
    const first = parseMonthParam(req);
    const pad = (n) => String(n).padStart(2, '0');
    const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const gridStart = new Date(first); gridStart.setDate(1 - first.getDay());
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    const gridEnd = new Date(last); gridEnd.setDate(last.getDate() + (6 - last.getDay()));
    const view = req.query.view === 'list' ? 'list' : 'month';
    const events = view === 'list'
      ? db.prepare('SELECT * FROM events WHERE deleted_at IS NULL AND published = 1 ORDER BY starts_at ASC, id ASC').all()
      : db.prepare("SELECT * FROM events WHERE deleted_at IS NULL AND published = 1 AND date(starts_at) <= ? AND date(COALESCE(ends_at, starts_at)) >= ? ORDER BY starts_at ASC, id ASC").all(ymd(gridEnd), ymd(gridStart));
    const mk = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    page(lang, req, res, '/calendar', 'calendar.ejs',
      { docs, events, view, month: first, gridStart, gridEnd, prevMonth: mk(new Date(first.getFullYear(), first.getMonth() - 1, 1)), nextMonth: mk(new Date(first.getFullYear(), first.getMonth() + 1, 1)), thisMonth: mk(new Date()) },
      pickLang(lang, 'Events and Calendar', '活動與行事曆'),
      pickLang(lang, 'School-year events, the calendar and key dates.', '學年活動、行事曆與重要日期。'));
  });

  // ---------- /media ----------
  app.get('/:lang/media', function (req, res) {
    const lang = req.params.lang;
    const photos = db.prepare(`SELECT * FROM media_items WHERE kind = 'photo' AND image != '' ORDER BY taken_at DESC, id`).all();
    const videos = db.prepare(`SELECT * FROM media_items WHERE kind = 'video' AND url != '' ORDER BY id`).all();
    const albums = db.prepare(`SELECT * FROM media_items WHERE kind = 'album' AND url != '' ORDER BY id`).all();
    const slides = heroSlides(db);
    page(lang, req, res, '/media', usePorted(db, 'media', 'media.ejs'),
      { photos, videos, albums, heroSlides: slides, ...portedCtx(db, 'media', lang), _pg: db.prepare('SELECT * FROM pages WHERE slug = ?').get('media') || { title_en: 'Media', title_zh: '影音媒體' } },
      pickLang(lang, 'Photos & Videos', '照片與影片'),
      pickLang(lang, 'Moments from SDCA classrooms, festivals and events.', 'SDCA 課堂、節慶與活動的精彩瞬間。'),
      {
        '@context': 'https://schema.org', '@type': 'ImageGallery',
        name: pickLang(lang, 'SDCA photo gallery', 'SDCA 照片集'),
        image: photos.map((p) => p.image ? (p.image.startsWith('/') ? p.image : `/img/${p.image.replace(/^img\//, '')}`) : null).filter(Boolean),
      });
  });

  // ---------- /media/archive (uncurated old-site photos) ----------
  app.get('/:lang/media/archive', function (req, res) {
    const lang = req.params.lang;
    const photos = db.prepare(
      'SELECT * FROM archive_photos WHERE published = 1 ORDER BY taken_year DESC, sort, id'
    ).all();
    // group by group_en, preserving order (year desc)
    const groupOrder = [];
    const byGroup = new Map();
    for (const p of photos) {
      const g = p.group_en || 'Other';
      if (!byGroup.has(g)) { byGroup.set(g, []); groupOrder.push(g); }
      byGroup.get(g).push(p);
    }
    const groups = groupOrder.map((g) => ({
      group_en: g,
      group_zh: (byGroup.get(g)[0] || {}).group_zh || '',
      photos: byGroup.get(g),
    }));
    page(lang, req, res, '/media/archive', 'media-archive.ejs',
      { groups, total: photos.length },
      pickLang(lang, 'Photo Archive', '照片檔案'),
      pickLang(lang, 'Real event photos preserved from the original SDCA website.', '原網站保存的真實活動照片。'),
      { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'SDCA Photo Archive' });
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
      const pg = db.prepare('SELECT * FROM pages WHERE slug = ?').get(r.slug);
      const relatedDocs = db.prepare(
        `SELECT * FROM documents WHERE published = 1 AND category = ? ORDER BY sort, id LIMIT 6`
      ).all(r.cat);
      const bf = pg ? bodyFor(pg, lang) : { html: '', note: null };
      const subLinks = PARENT_LINKS.filter((l) => l.p !== r.path).map((l) => ({
        href: `/${lang}${l.p}`,
        label: lang === 'zh' ? l.zh : l.en,
      }));
      const view = r.slug === 'parents-volunteer' ? 'volunteer.ejs' : 'parents.ejs';
      page(lang, req, res, r.path, view,
        { page: pg, relatedDocs, subLinks, mdBody: bf.html, bodyNote: bf.note, ...portedCtx(db, r.slug, lang) },
        pg ? localized(pg, 'title', lang) : (pickLang(lang, 'Parents', '家長專區')),
        pickLang(lang, 'SDCA parent resources: handbook, volunteer, scrip and forms.', 'SDCA 家長專區：手冊、志工、書券與表單。'));
    });
  }

  // ---------- /documents ----------
  app.get('/:lang/documents', function (req, res) {
    const lang = req.params.lang;
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
      pickLang(lang, 'Documents & Forms', '文件與表單'),
      pickLang(lang, 'School calendars, handbooks, contest rules, weekly PDFs and more.', '學年行事曆、手冊、比賽規則、每週 PDF 等。'));
  });

  // ---------- Inline PDF delivery  ----------
  // /pdf/:slug — serve any published document's file inline (browser renders
  // PDFs). Used by every PDF link on the site (documents library, news detail,
  // parents, calendar, handbook, scrip, archive, markdown bodies…).
  // /pdf/:slug/download — force-download variant (documents library icon).
  function cleanFilename(doc) {
    const base = path.basename(doc.file_path || '').replace(/\.[a-z0-9]+$/i, '');
    return (base || doc.slug || 'document').replace(/[\\/:*?"<>|\s]+/g, '-');
  }
  function serveDocFile(req, res, doc, { disposition, forceType } = {}) {
    const file = path.join(config.root, doc.file_path);
    if (!fs.existsSync(file)) return false;
    const mime = (doc.mime && doc.mime !== 'application/octet-stream') ? doc.mime
      : (doc.file_path && doc.file_path.toLowerCase().endsWith('.pdf') ? 'application/pdf'
      : (doc.mime || 'application/octet-stream'));
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `${disposition}; filename="${cleanFilename(doc)}${path.extname(doc.file_path || '') || '.pdf'}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.sendFile(file);
    return true;
  }
  app.get('/pdf/:slug', function (req, res, next) {
    const doc = db.prepare('SELECT * FROM documents WHERE slug = ? AND published = 1').get(req.params.slug);
    if (!doc) return next();
    if (serveDocFile(req, res, doc, { disposition: 'inline' })) return;
    return next();
  });
  app.get('/pdf/:slug/download', function (req, res, next) {
    const doc = db.prepare('SELECT * FROM documents WHERE slug = ? AND published = 1').get(req.params.slug);
    if (!doc) return next();
    if (serveDocFile(req, res, doc, { disposition: 'attachment' })) return;
    return next();
  });

  // ---------- /documents/:slug (serves the PDF when present) ----------
  app.get('/:lang/documents/:slug', function (req, res) {
    const lang = req.params.lang;
    const doc = db.prepare('SELECT * FROM documents WHERE slug = ? AND published = 1').get(req.params.slug);
    if (!doc) return notFound(req, res);
    if (serveDocFile(req, res, doc, { disposition: 'inline' })) return;
    const related = db.prepare(
      `SELECT * FROM documents WHERE published = 1 AND category = ? AND slug != ? ORDER BY sort, id LIMIT 5`
    ).all(doc.category, doc.slug);
    page(lang, req, res, `/documents/${doc.slug}`, 'document-detail.ejs',
      { doc, relatedDocs: related },
      localized(doc, 'title', lang),
      doc.category || 'SDCA document',
      {
        '@context': 'https://schema.org', '@type': 'Document',
        name: localized(doc, 'title', lang),
        encodingFormat: doc.mime,
      });
  });

  // ---------- /archive (content preservation) ----------
  app.get('/:lang/archive', function (req, res) {
    const lang = req.params.lang;
    const pg = db.prepare('SELECT * FROM pages WHERE slug = ?').get('archive');
    const bf = pg ? bodyFor(pg, lang) : { html: '', note: null };
    // Archived PDFs: older documents not in the main library (school-year specific,
    // contest rules, old calendars). Grouped by category.
    const archivedDocs = db.prepare(
      "SELECT * FROM documents WHERE published = 1 AND category IN ('weekly','contest','calendar','class-info') ORDER BY school_year DESC, sort, id LIMIT 40"
    ).all();
    page(lang, req, res, '/archive', 'content-page.ejs',
      { pg, mdBody: bf.html, bodyNote: bf.note, archivedDocs },
      pickLang(lang, 'Archive', '檔案'),
      pickLang(lang, 'Older posts, notices and PDFs from the original site.', '保存原網站的舊文章、通告與 PDF。'),
      {
        '@context': 'https://schema.org', '@type': 'CollectionPage',
        name: pickLang(lang, 'SDCA Archive', 'SDCA 檔案'),
      });
  });

  // ---------- /programs/bell (Bell Schedule & Textbooks) ----------
  app.get('/:lang/programs/bell', function (req, res) {
    const lang = req.params.lang;
    const bellTimes = setting(db, 'bell_times', lang);
    const classDays = setting(db, 'class_days', lang);
    const textbooks = db.prepare(
      "SELECT * FROM documents WHERE published = 1 AND category = 'class-info' ORDER BY sort, id"
    ).all();
    const calendar = db.prepare(
      "SELECT * FROM documents WHERE published = 1 AND category = 'calendar' ORDER BY sort, id"
    ).all();
    const bodyHtml = (lang === 'zh' ? (
      `上課時間：${bellTimes || '週日 1:30 PM & 4:30 PM'}。上課日：${classDays || '週日'}。\n\n以下為教材清單與學年行事曆（PDF，點一下即可開啟）。`
    ) : (
      `Class times: ${bellTimes || '1:30 PM & 4:30 PM (Sundays)'} · Class days: ${classDays || 'Sundays'}.\n\nBelow are the textbook lists and school-year calendars (click to open the PDF).`
    ));
    // Combine textbooks + calendars into one archivedDocs list for the template
    const allDocs = [...textbooks, ...calendar];
    page(lang, req, res, '/programs/bell', 'content-page.ejs',
      { pg: { title_en: 'Bell Schedule & Textbooks', title_zh: '鐘點表與教材' }, mdBody: bodyHtml, bodyNote: null, archivedDocs: allDocs },
      pickLang(lang, 'Bell Schedule & Textbooks', '鐘點表與教材'),
      pickLang(lang, 'Class times, textbook lists and classroom maps.', '上課時間、教材清單與教室地圖。'),
      null);
  });

  // ---------- /search?q= ----------
  app.get('/:lang/search', function (req, res) {
    const lang = req.params.lang;
    const q = String(req.query.q || '').trim();
    const { rows, engine } = searchContent(db, q, { limit: 30, lang });
    page(lang, req, res, '/search', 'search.ejs',
      { q, rows, engine },
      pickLang(lang, 'Search', '搜尋'),
      pickLang(lang, 'Search the SDCA website.', '搜尋 SDCA 網站。'));
  });

  // ---------- /privacy, /disclaimer ----------
  for (const slug of ['privacy', 'disclaimer']) {
    app.get(`/:lang/${slug}`, function (req, res) {
      const lang = req.params.lang;
      const pg = db.prepare('SELECT * FROM pages WHERE slug = ?').get(slug);
      const bf = pg ? bodyFor(pg, lang) : { html: '', note: null };
      page(lang, req, res, `/${slug}`, usePorted(db, slug, 'static-page.ejs'),
        { pg, mdBody: bf.html, bodyNote: bf.note, ...portedCtx(db, slug, lang) },
        pg ? localized(pg, 'title', lang) : slug,
        pickLang(lang, 'SDCA legal page.', 'SDCA 法律頁面。'));
    });
  }

}
