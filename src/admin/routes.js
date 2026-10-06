// src/admin/routes.js — /admin routes (English UI).
// Login, dashboard, CRUD for announcements/events/pages/programs/people/sponsors/documents/media_items,
// settings, inbox, subscribers, audit log.
import fs from 'node:fs';
import path from 'node:path';
import ejs from 'ejs';
import sanitizeHtml from 'sanitize-html';
import { t, SUPPORTED } from '../i18n/index.js';
import { assetUrl } from '../helpers.js';
import { verifyPassword } from './auth.js';
import crypto from 'node:crypto';
import { uploader, uploadDir } from './uploads.js';
import { loginLimiter } from '../middleware/index.js';
import { csrfMiddleware } from '../middleware/csrf.js';
import { config } from '../config.js';

const ADMIN_CSS = '/css/admin.css';

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}


// ---------- CSRF + auth middleware for /admin ----------
function requireLogin(req, res, next) {
  if (req.session && req.session.user) return next();
  const nextPath = req.path === '/admin' ? '/admin' : req.path;
  const csrf = csrfTokenFrom(req);
  const body = ejs.render(fs.readFileSync(path.join(config.viewsDir, 'admin', 'login.ejs'), 'utf8'), {
    csrfToken: csrf,
    error: null,
    nextPath,
  });
  res.status(401).render('admin/login-shell.ejs', { body, csrfToken: csrf, t: (k) => t('en', k) });
}

function csrfTokenFrom(req) {
  return req.cookies?.sdca_csrf || '';
}

function audit(db, user, action, entity, entity_id) {
  db.prepare('INSERT INTO audit_log (user, action, entity, entity_id) VALUES (?, ?, ?, ?)')
    .run(String(user || ''), String(action), String(entity), String(entity_id || ''));
}

function csvRow(v) {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function csv(headers, rows) {
  const lines = [headers.map(csvRow).join(',')];
  for (const r of rows) lines.push(r.map(csvRow).join(','));
  return lines.join('\n');
}

// ---------- body field sanitization for markdown bodies ----------
function sanitizeBody(s) {
  if (!s) return '';
  return sanitizeHtml(String(s), {
    allowedTags: ['h1','h2','h3','h4','h5','h6','p','ul','ol','li','strong','em','del','a','code','pre','blockquote','table','thead','tbody','tr','th','td','br','hr','span','img','details','summary'],
    allowedAttributes: { a: ['href','title','rel','target'], img: ['src','alt','width','height'] },
    allowedSchemes: ['http','https','mailto','tel'],
  });
}

// ---------- text field (plain) ----------
function text(s) {
  return String(s ?? '').replace(/<[^>]+>/g, '').trim();
}

/**
 * Register /admin routes on the given express app.
 * `db` is required.
 */
export function registerAdminRoutes(app, { db }) {
  const views = path.join(config.viewsDir, 'admin');
  const renderAdmin = (req, res, file, locals = {}, status = 200) => {
    const csrf = csrfTokenFrom(req);
    const html = ejs.render(fs.readFileSync(path.join(views, file), 'utf8'), {
      csrfToken: csrf,
      user: req.session.user,
      t: (k) => t('en', k),
      assetUrl,
      ...locals,
    });
    const shell = ejs.render(fs.readFileSync(path.join(views, 'layout.ejs'), 'utf8'), {
      title: locals.title || 'SDCA Admin',
      body: html,
      user: req.session.user,
      csrfToken: csrf,
      flash: locals.flash,
      error: locals.error,
      t: (k) => t('en', k),
      assetUrl,
      css: ADMIN_CSS,
    });
    res.status(status).type('html').send(shell);
  };

  // ---------- Login ----------
  app.get('/admin', (req, res) => {
    if (req.session && req.session.user) return res.redirect('/admin/dashboard');
    let csrf = req.cookies?.sdca_csrf;
    if (!csrf) {
      csrf = crypto.randomBytes(32).toString('hex');
      res.cookie('sdca_csrf', csrf, { sameSite: 'Lax', path: '/' });
    }
    const body = ejs.render(fs.readFileSync(path.join(views, 'login.ejs'), 'utf8'), {
      csrfToken: csrf, error: null, nextPath: '/admin/dashboard',
    });
    const shell = ejs.render(fs.readFileSync(path.join(views, 'login-shell.ejs'), 'utf8'), {
      title: 'Sign in', body, csrfToken: csrf, t: (k) => t('en', k),
    });
    res.status(401).type('html').send(shell);
  });

  app.get('/admin/login', (req, res) => {
    let csrf = req.cookies?.sdca_csrf;
    if (!csrf) {
      csrf = crypto.randomBytes(32).toString('hex');
      res.cookie('sdca_csrf', csrf, { sameSite: 'Lax', path: '/' });
    }
    renderAdmin(req, res, 'login.ejs', { error: null, nextPath: req.query.next || '/admin/dashboard' });
  });

  app.post('/admin/login', loginLimiter, csrfMiddleware, (req, res) => {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);
    if (!user || !verifyPassword(password, user.password_hash)) {
      const err = 'Invalid username or password';
      return renderAdmin(req, res, 'login.ejs', { error: err, nextPath: req.body?.next || '/admin/dashboard' }, 401);
    }
    req.session.user = { id: user.id, username: user.username, role: user.role };
    // Explicitly persist the session to the SQLite store.
    const sid = req.sessionID;
    const data = JSON.stringify(req.session);
    const expires = req.session.cookie && req.session.cookie.expires
      ? new Date(req.session.cookie.expires).getTime()
      : null;
    db.prepare(`
      INSERT INTO sessions (sid, data, expires) VALUES (?, ?, ?)
      ON CONFLICT(sid) DO UPDATE SET data = excluded.data, expires = excluded.expires
    `).run(sid, data, expires);
    db.prepare('UPDATE admin_users SET last_login = ? WHERE id = ?').run(new Date().toISOString(), user.id);
    audit(db, user.username, 'login', 'admin_users', String(user.id));
    res.redirect(req.body?.next || '/admin/dashboard');
  });

  app.post('/admin/logout', csrfMiddleware, (req, res) => {
    const sid = req.sessionID;
    // Manually delete the session from the store and clear the cookie.
    db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
    req.session = null;
    res.clearCookie('sdca_sid');
    res.redirect('/admin/login');
  });

  // Everything below requires login AND a valid CSRF cookie (issued by the
  // login GET). The cookie itself is the double-submit token; POST handlers
  // compare the form's `_csrf` field against it.
  app.use('/admin', (req, res, next) => {
    if (!req.session || !req.session.user) {
      const csrf = csrfTokenFrom(req);
      const body = ejs.render(fs.readFileSync(path.join(views, 'login.ejs'), 'utf8'), {
        csrfToken: csrf, error: null, nextPath: req.path,
      });
      const shell = ejs.render(fs.readFileSync(path.join(views, 'login-shell.ejs'), 'utf8'), {
        title: 'Sign in', body, csrfToken: csrf, t: (k) => t('en', k),
      });
      return res.status(401).type('html').send(shell);
    }
    // If the CSRF cookie is missing (e.g. a test client that POSTs directly),
    // issue one and redirect back to the page so the user can re-submit.
    if (!req.cookies?.sdca_csrf) {
      const tok = crypto.randomBytes(32).toString('hex');
      res.cookie('sdca_csrf', tok, { sameSite: 'Lax', path: '/' });
      return res.redirect(req.path);
    }
    return next();
  });

  // ---------- Dashboard ----------
  app.get('/admin/dashboard', (req, res) => {
    const counts = {
      announcements: db.prepare('SELECT COUNT(*) c FROM announcements').get().c,
      events: db.prepare('SELECT COUNT(*) c FROM events').get().c,
      pages: db.prepare('SELECT COUNT(*) c FROM pages').get().c,
      programs: db.prepare('SELECT COUNT(*) c FROM programs').get().c,
      people: db.prepare('SELECT COUNT(*) c FROM people').get().c,
      sponsors: db.prepare('SELECT COUNT(*) c FROM sponsors').get().c,
      documents: db.prepare('SELECT COUNT(*) c FROM documents').get().c,
      media: db.prepare('SELECT COUNT(*) c FROM media_items').get().c,
      archivePhotos: db.prepare('SELECT COUNT(*) c FROM archive_photos').get().c,
      newMessages: db.prepare("SELECT COUNT(*) c FROM contact_messages WHERE status='new'").get().c,
      subscribers: db.prepare('SELECT COUNT(*) c FROM newsletter_subscribers').get().c,
    };
    const recentAudit = db.prepare('SELECT * FROM audit_log ORDER BY at DESC LIMIT 10').all();
    renderAdmin(req, res, 'dashboard.ejs', { counts, recentAudit });
  });

  // ---------- Audit log ----------
  app.get('/admin/audit', (req, res) => {
    const rows = db.prepare('SELECT * FROM audit_log ORDER BY at DESC LIMIT 500').all();
    renderAdmin(req, res, 'audit.ejs', { rows });
  });

  // ---------- Generic list helper ----------
  function listRows(table, orderBy) {
    return db.prepare(`SELECT * FROM ${table} ORDER BY ${orderBy}`).all();
  }
  function getRow(table, id) {
    return db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
  }

  // ---------- Announcements ----------
  app.get('/admin/announcements', (req, res) => {
    const rows = listRows('announcements', 'published_at DESC');
    renderAdmin(req, res, 'announcements-list.ejs', { rows });
  });

  app.get('/admin/announcements/new', (req, res) => {
    renderAdmin(req, res, 'announcement-edit.ejs', { item: null, docs: listRows('documents', 'title_en') });
  });

  app.get('/admin/announcements/:id', (req, res) => {
    const item = getRow('announcements', req.params.id);
    if (!item) return res.status(404).send('Not found');
    renderAdmin(req, res, 'announcement-edit.ejs', { item, docs: listRows('documents', 'title_en') });
  });

  app.post('/admin/announcements', csrfMiddleware, (req, res) => {
    const b = req.body || {};
    const slug = text(b.slug) || `ann-${Date.now()}`;
    const existing = db.prepare('SELECT id FROM announcements WHERE slug = ?').get(slug);
    if (existing) {
      const id = existing.id;
      db.prepare(`
        UPDATE announcements SET
          title_en=?, title_zh=?, summary_en=?, summary_zh=?, body_en=?, body_zh=?,
          kind=?, week_no=?, school_year=?, published_at=?, pinned=?, document_id=?, external_url=?, published=?
        WHERE id=?
      `).run(
        text(b.title_en), text(b.title_zh),
        text(b.summary_en), text(b.summary_zh),
        sanitizeBody(b.body_en), sanitizeBody(b.body_zh),
        ['weekly','news','press','notice'].includes(b.kind) ? b.kind : 'weekly',
        b.week_no ? Number(b.week_no) : null,
        text(b.school_year), text(b.published_at) || null,
        b.pinned ? 1 : 0, b.document_id ? Number(b.document_id) : null,
        text(b.external_url), b.published ? 1 : 0, id
      );
      audit(db, req.session.user.username, 'update', 'announcements', String(id));
      return res.redirect('/admin/announcements');
    }
    const info = db.prepare(`
      INSERT INTO announcements (slug, title_en, title_zh, summary_en, summary_zh, body_en, body_zh,
        kind, week_no, school_year, published_at, pinned, document_id, external_url, published)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      slug, text(b.title_en), text(b.title_zh),
      text(b.summary_en), text(b.summary_zh),
      sanitizeBody(b.body_en), sanitizeBody(b.body_zh),
      ['weekly','news','press','notice'].includes(b.kind) ? b.kind : 'weekly',
      b.week_no ? Number(b.week_no) : null,
      text(b.school_year), text(b.published_at) || null,
      b.pinned ? 1 : 0, b.document_id ? Number(b.document_id) : null,
      text(b.external_url), b.published ? 1 : 0
    );
    audit(db, req.session.user.username, 'create', 'announcements', String(info.lastInsertRowid));
    res.redirect('/admin/announcements');
  });

  app.post('/admin/announcements/:id/delete', csrfMiddleware, (req, res) => {
    const id = req.params.id;
    db.prepare('DELETE FROM announcements WHERE id = ?').run(id);
    audit(db, req.session.user.username, 'delete', 'announcements', id);
    res.redirect('/admin/announcements');
  });

  // ---------- Events ----------
  app.get('/admin/events', (req, res) => {
    renderAdmin(req, res, 'events-list.ejs', { rows: listRows('events', 'starts_at DESC') });
  });
  app.get('/admin/events/new', (req, res) => {
    renderAdmin(req, res, 'event-edit.ejs', { item: null });
  });
  app.get('/admin/events/:id', (req, res) => {
    const item = getRow('events', req.params.id);
    if (!item) return res.status(404).send('Not found');
    renderAdmin(req, res, 'event-edit.ejs', { item });
  });
  app.post('/admin/events', csrfMiddleware, (req, res) => {
    const b = req.body || {};
    const slug = text(b.slug) || `event-${Date.now()}`;
    const existing = db.prepare('SELECT id FROM events WHERE slug = ?').get(slug);
    if (existing) {
      const id = existing.id;
      db.prepare(`
        UPDATE events SET title_en=?, title_zh=?, description_en=?, description_zh=?,
          starts_at=?, ends_at=?, all_day=?, location=?, category=?, image=?, published=?
        WHERE id=?
      `).run(
        text(b.title_en), text(b.title_zh), sanitizeBody(b.description_en), sanitizeBody(b.description_zh),
        text(b.starts_at), text(b.ends_at) || null, b.all_day ? 1 : 0,
        text(b.location), text(b.category), text(b.image), b.published ? 1 : 0, id
      );
      audit(db, req.session.user.username, 'update', 'events', String(id));
    } else {
      const info = db.prepare(`
        INSERT INTO events (slug, title_en, title_zh, description_en, description_zh,
          starts_at, ends_at, all_day, location, category, image, published)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        slug, text(b.title_en), text(b.title_zh), sanitizeBody(b.description_en), sanitizeBody(b.description_zh),
        text(b.starts_at), text(b.ends_at) || null, b.all_day ? 1 : 0,
        text(b.location), text(b.category), text(b.image), b.published ? 1 : 0
      );
      audit(db, req.session.user.username, 'create', 'events', String(info.lastInsertRowid));
    }
    res.redirect('/admin/events');
  });
  app.post('/admin/events/:id/delete', csrfMiddleware, (req, res) => {
    db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
    audit(db, req.session.user.username, 'delete', 'events', req.params.id);
    res.redirect('/admin/events');
  });

  // ---------- Slides (home hero carousel) ----------
  app.get('/admin/slides', (req, res) => {
    renderAdmin(req, res, 'slides-list.ejs', { rows: listRows('slides', 'sort, id') });
  });
  app.get('/admin/slides/new', (req, res) => {
    renderAdmin(req, res, 'slide-edit.ejs', { item: null });
  });
  app.get('/admin/slides/:id', (req, res) => {
    const item = getRow('slides', req.params.id);
    if (!item) return res.status(404).send('Not found');
    renderAdmin(req, res, 'slide-edit.ejs', { item });
  });
  app.post('/admin/slides', csrfMiddleware, (req, res) => {
    const b = req.body || {};
    const id = text(b.id);
    if (id) {
      db.prepare(`
        UPDATE slides SET image=?, caption_en=?, caption_zh=?, link_url=?, sort=?, published=?
        WHERE id=?
      `).run(
        text(b.image), text(b.caption_en), text(b.caption_zh), text(b.link_url),
        parseInt(b.sort, 10) || 0, b.published ? 1 : 0, parseInt(id, 10)
      );
      audit(db, req.session.user.username, 'update', 'slides', id);
    } else {
      const info = db.prepare(`
        INSERT INTO slides (image, caption_en, caption_zh, link_url, sort, published)
        VALUES (?,?,?,?,?,?)
      `).run(
        text(b.image), text(b.caption_en), text(b.caption_zh), text(b.link_url),
        parseInt(b.sort, 10) || 0, b.published ? 1 : 0
      );
      audit(db, req.session.user.username, 'create', 'slides', String(info.lastInsertRowid));
    }
    res.redirect('/admin/slides');
  });
  app.post('/admin/slides/:id/delete', csrfMiddleware, (req, res) => {
    const id = req.params.id;
    db.prepare('DELETE FROM slides WHERE id = ?').run(id);
    audit(db, req.session.user.username, 'delete', 'slides', id);
    res.redirect('/admin/slides');
  });

  // ---------- Archive photos (Phase 8b) ----------
  app.get('/admin/archive-photos', (req, res) => {
    const rows = listRows('archive_photos', 'taken_year DESC, sort, id');
    renderAdmin(req, res, 'archive-photos-list.ejs', { rows });
  });
  app.get('/admin/archive-photos/:id', (req, res) => {
    const item = getRow('archive_photos', req.params.id);
    if (!item) return res.status(404).send('Not found');
    renderAdmin(req, res, 'archive-photo-edit.ejs', { item });
  });
  app.post('/admin/archive-photos', csrfMiddleware, (req, res) => {
    const b = req.body || {};
    const id = text(b.id);
    if (id) {
      db.prepare(
        'UPDATE archive_photos SET group_en=?, group_zh=?, caption_en=?, caption_zh=?, ' +
        'taken_year=?, sort=?, published=? WHERE id=?'
      ).run(
        text(b.group_en), text(b.group_zh), text(b.caption_en), text(b.caption_zh),
        parseInt(b.taken_year, 10) || 0, parseInt(b.sort, 10) || 0,
        b.published ? 1 : 0, parseInt(id, 10)
      );
      audit(db, req.session.user.username, 'update', 'archive_photos', id);
    }
    res.redirect('/admin/archive-photos');
  });
  app.post('/admin/archive-photos/:id/delete', csrfMiddleware, (req, res) => {
    const id = req.params.id;
    db.prepare('DELETE FROM archive_photos WHERE id = ?').run(id);
    audit(db, req.session.user.username, 'delete', 'archive_photos', id);
    res.redirect('/admin/archive-photos');
  });

  // ---------- Pages ----------
  app.get('/admin/pages', (req, res) => {
    renderAdmin(req, res, 'pages-list.ejs', { rows: listRows('pages', 'nav_order, slug') });
  });
  app.get('/admin/pages/new', (req, res) => {
    renderAdmin(req, res, 'page-edit.ejs', { item: null });
  });
  app.get('/admin/pages/:id', (req, res) => {
    const item = getRow('pages', req.params.id);
    if (!item) return res.status(404).send('Not found');
    renderAdmin(req, res, 'page-edit.ejs', { item });
  });
  app.post('/admin/pages', csrfMiddleware, (req, res) => {
    const b = req.body || {};
    const slug = text(b.slug) || `page-${Date.now()}`;
    const existing = db.prepare('SELECT id FROM pages WHERE slug = ?').get(slug);
    if (existing) {
      const id = existing.id;
      db.prepare(`
        UPDATE pages SET title_en=?, title_zh=?, body_en=?, body_zh=?, hero_image=?, nav_section=?, nav_order=?, published=?, body_source='admin'
        WHERE id=?
      `).run(
        text(b.title_en), text(b.title_zh), sanitizeBody(b.body_en), sanitizeBody(b.body_zh),
        text(b.hero_image), text(b.nav_section), b.nav_order ? Number(b.nav_order) : 0,
        b.published ? 1 : 0, id
      );
      audit(db, req.session.user.username, 'update', 'pages', String(id));
    } else {
      const info = db.prepare(`
        INSERT INTO pages (slug, title_en, title_zh, body_en, body_zh, hero_image, nav_section, nav_order, published)
        VALUES (?,?,?,?,?,?,?,?,?)
      `).run(
        slug, text(b.title_en), text(b.title_zh), sanitizeBody(b.body_en), sanitizeBody(b.body_zh),
        text(b.hero_image), text(b.nav_section), b.nav_order ? Number(b.nav_order) : 0, b.published ? 1 : 0
      );
      audit(db, req.session.user.username, 'create', 'pages', String(info.lastInsertRowid));
    }
    res.redirect('/admin/pages');
  });
  app.post('/admin/pages/:id/delete', csrfMiddleware, (req, res) => {
    db.prepare('DELETE FROM pages WHERE id = ?').run(req.params.id);
    audit(db, req.session.user.username, 'delete', 'pages', req.params.id);
    res.redirect('/admin/pages');
  });

  // ---------- Programs ----------
  app.get('/admin/programs', (req, res) => {
    renderAdmin(req, res, 'programs-list.ejs', { rows: listRows('programs', 'sort, name_en') });
  });
  app.get('/admin/programs/new', (req, res) => { renderAdmin(req, res, 'program-edit.ejs', { item: null }); });
  app.get('/admin/programs/:id', (req, res) => {
    const item = getRow('programs', req.params.id);
    if (!item) return res.status(404).send('Not found');
    renderAdmin(req, res, 'program-edit.ejs', { item });
  });
  app.post('/admin/programs', csrfMiddleware, (req, res) => {
    const b = req.body || {};
    const slug = text(b.slug) || `prog-${Date.now()}`;
    const existing = db.prepare('SELECT id FROM programs WHERE slug = ?').get(slug);
    if (existing) {
      const id = existing.id;
      db.prepare(`
        UPDATE programs SET name_en=?, name_zh=?, grades_en=?, grades_zh=?, description_en=?, description_zh=?,
          schedule_en=?, schedule_zh=?, tuition_en=?, tuition_zh=?, sort=?, image=?
        WHERE id=?
      `).run(
        text(b.name_en), text(b.name_zh), text(b.grades_en), text(b.grades_zh),
        sanitizeBody(b.description_en), sanitizeBody(b.description_zh),
        sanitizeBody(b.schedule_en), sanitizeBody(b.schedule_zh),
        text(b.tuition_en), text(b.tuition_zh),
        b.sort ? Number(b.sort) : 0, text(b.image), id
      );
      audit(db, req.session.user.username, 'update', 'programs', String(id));
    } else {
      const info = db.prepare(`
        INSERT INTO programs (slug, name_en, name_zh, grades_en, grades_zh, description_en, description_zh,
          schedule_en, schedule_zh, tuition_en, tuition_zh, sort, image)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        slug, text(b.name_en), text(b.name_zh), text(b.grades_en), text(b.grades_zh),
        sanitizeBody(b.description_en), sanitizeBody(b.description_zh),
        sanitizeBody(b.schedule_en), sanitizeBody(b.schedule_zh),
        text(b.tuition_en), text(b.tuition_zh),
        b.sort ? Number(b.sort) : 0, text(b.image)
      );
      audit(db, req.session.user.username, 'create', 'programs', String(info.lastInsertRowid));
    }
    res.redirect('/admin/programs');
  });
  app.post('/admin/programs/:id/delete', csrfMiddleware, (req, res) => {
    db.prepare('DELETE FROM programs WHERE id = ?').run(req.params.id);
    audit(db, req.session.user.username, 'delete', 'programs', req.params.id);
    res.redirect('/admin/programs');
  });

  // ---------- People ----------
  app.get('/admin/people', (req, res) => {
    renderAdmin(req, res, 'people-list.ejs', { rows: listRows('people', 'sort, name_en') });
  });
  app.get('/admin/people/new', (req, res) => { renderAdmin(req, res, 'person-edit.ejs', { item: null }); });
  app.get('/admin/people/:id', (req, res) => {
    const item = getRow('people', req.params.id);
    if (!item) return res.status(404).send('Not found');
    renderAdmin(req, res, 'person-edit.ejs', { item });
  });
  app.post('/admin/people', csrfMiddleware, (req, res) => {
    const b = req.body || {};
    const group = ['board','staff','teacher','volunteer'].includes(b.group) ? b.group : 'staff';
    const nameEn = text(b.name_en) || `Person-${Date.now()}`;
    const existing = db.prepare('SELECT id FROM people WHERE name_en = ?').get(nameEn);
    if (existing) {
      const id = existing.id;
      db.prepare(`
        UPDATE people SET name_en=?, name_zh=?, role_en=?, role_zh=?, "group"=?, bio_en=?, bio_zh=?, photo=?, sort=?
        WHERE id=?
      `).run(
        nameEn, text(b.name_zh), text(b.role_en), text(b.role_zh), group,
        sanitizeBody(b.bio_en), sanitizeBody(b.bio_zh), text(b.photo),
        b.sort ? Number(b.sort) : 0, id
      );
      audit(db, req.session.user.username, 'update', 'people', String(id));
    } else {
      const info = db.prepare(`
        INSERT INTO people (name_en, name_zh, role_en, role_zh, "group", bio_en, bio_zh, photo, sort)
        VALUES (?,?,?,?,?,?,?,?,?)
      `).run(
        nameEn, text(b.name_zh), text(b.role_en), text(b.role_zh), group,
        sanitizeBody(b.bio_en), sanitizeBody(b.bio_zh), text(b.photo),
        b.sort ? Number(b.sort) : 0
      );
      audit(db, req.session.user.username, 'create', 'people', String(info.lastInsertRowid));
    }
    res.redirect('/admin/people');
  });
  app.post('/admin/people/:id/delete', csrfMiddleware, (req, res) => {
    db.prepare('DELETE FROM people WHERE id = ?').run(req.params.id);
    audit(db, req.session.user.username, 'delete', 'people', req.params.id);
    res.redirect('/admin/people');
  });

  // ---------- Sponsors ----------
  app.get('/admin/sponsors', (req, res) => {
    renderAdmin(req, res, 'sponsors-list.ejs', { rows: listRows('sponsors', 'sort, name') });
  });
  app.get('/admin/sponsors/new', (req, res) => { renderAdmin(req, res, 'sponsor-edit.ejs', { item: null }); });
  app.get('/admin/sponsors/:id', (req, res) => {
    const item = getRow('sponsors', req.params.id);
    if (!item) return res.status(404).send('Not found');
    renderAdmin(req, res, 'sponsor-edit.ejs', { item });
  });
  app.post('/admin/sponsors', csrfMiddleware, (req, res) => {
    const b = req.body || {};
    const name = text(b.name) || `Sponsor-${Date.now()}`;
    const existing = db.prepare('SELECT id FROM sponsors WHERE name = ?').get(name);
    if (existing) {
      const id = existing.id;
      db.prepare('UPDATE sponsors SET name=?, logo=?, url=?, tier=?, sort=? WHERE id=?')
        .run(name, text(b.logo), text(b.url), text(b.tier), b.sort ? Number(b.sort) : 0, id);
      audit(db, req.session.user.username, 'update', 'sponsors', String(id));
    } else {
      const info = db.prepare('INSERT INTO sponsors (name, logo, url, tier, sort) VALUES (?,?,?,?,?)')
        .run(name, text(b.logo), text(b.url), text(b.tier), b.sort ? Number(b.sort) : 0);
      audit(db, req.session.user.username, 'create', 'sponsors', String(info.lastInsertRowid));
    }
    res.redirect('/admin/sponsors');
  });
  app.post('/admin/sponsors/:id/delete', csrfMiddleware, (req, res) => {
    db.prepare('DELETE FROM sponsors WHERE id = ?').run(req.params.id);
    audit(db, req.session.user.username, 'delete', 'sponsors', req.params.id);
    res.redirect('/admin/sponsors');
  });

  // ---------- Documents ----------
  app.get('/admin/documents', (req, res) => {
    renderAdmin(req, res, 'documents-list.ejs', { rows: listRows('documents', 'category, title_en') });
  });
  app.get('/admin/documents/new', (req, res) => { renderAdmin(req, res, 'document-edit.ejs', { item: null, file: null }); });
  app.get('/admin/documents/:id', (req, res) => {
    const item = getRow('documents', req.params.id);
    if (!item) return res.status(404).send('Not found');
    renderAdmin(req, res, 'document-edit.ejs', { item, file: item.file_path ? { size: item.bytes, name: path.basename(item.file_path) } : null });
  });
  app.post('/admin/documents', uploader.single('file'), csrfMiddleware, (req, res) => {
    const b = req.body || {};
    const f = req.file;
    if (!f) return renderAdmin(req, res, 'document-edit.ejs', { item: null, file: null, error: 'File is required' }, 400);
    const slug = text(b.slug) || f.originalname.replace(/\.[^.]+$/, '');
    const ext = path.extname(f.originalname).toLowerCase();
    const mimeMap = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
    const mime = mimeMap[ext] || 'application/octet-stream';
    const rel = path.join('storage', 'uploads', f.filename);
    const published = ['1','true','yes','on'].includes(String(b.published || '').toLowerCase()) ? 1 : 0;
    const sort = b.sort ? Number(b.sort) : 0;
    const existing = db.prepare('SELECT id FROM documents WHERE slug = ?').get(slug);
    if (existing) {
      const id = existing.id;
      db.prepare('UPDATE documents SET title_en=?, title_zh=?, category=?, file_path=?, mime=?, bytes=?, school_year=?, sort=?, published=? WHERE id=?')
        .run(text(b.title_en), text(b.title_zh), text(b.category), rel, mime, f.size, text(b.school_year), sort, published, id);
      audit(db, req.session.user.username, 'update', 'documents', String(id));
    } else {
      const info = db.prepare(`
        INSERT INTO documents (slug, title_en, title_zh, category, file_path, mime, bytes, school_year, sort, published)
        VALUES (?,?,?,?,?,?,?,?,?,?)
      `).run(slug, text(b.title_en), text(b.title_zh), text(b.category), rel, mime, f.size, text(b.school_year), sort, published);
      audit(db, req.session.user.username, 'create', 'documents', String(info.lastInsertRowid));
    }
    res.redirect('/admin/documents');
  });
  app.post('/admin/documents/:id/delete', csrfMiddleware, (req, res) => {
    const item = getRow('documents', req.params.id);
    if (item && item.file_path) {
      try {
        const full = path.join(config.root, item.file_path);
        if (full.startsWith(config.storageDir) && fs.existsSync(full)) fs.unlinkSync(full);
      } catch {}
    }
    db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);
    audit(db, req.session.user.username, 'delete', 'documents', req.params.id);
    res.redirect('/admin/documents');
  });

  // ---------- Media items ----------
  app.get('/admin/media', (req, res) => {
    renderAdmin(req, res, 'media-list.ejs', { rows: listRows('media_items', 'taken_at DESC, id DESC') });
  });
  app.get('/admin/media/new', (req, res) => { renderAdmin(req, res, 'media-edit.ejs', { item: null }); });
  app.get('/admin/media/:id', (req, res) => {
    const item = getRow('media_items', req.params.id);
    if (!item) return res.status(404).send('Not found');
    renderAdmin(req, res, 'media-edit.ejs', { item });
  });
  app.post('/admin/media', csrfMiddleware, (req, res) => {
    const b = req.body || {};
    const kind = ['photo','video','album'].includes(b.kind) ? b.kind : 'photo';
    const titleEn = text(b.title_en) || `Media-${Date.now()}`;
    const existing = db.prepare('SELECT id FROM media_items WHERE title_en = ?').get(titleEn);
    if (existing) {
      const id = existing.id;
      db.prepare('UPDATE media_items SET kind=?, title_en=?, title_zh=?, url=?, image=?, taken_at=? WHERE id=?')
        .run(kind, titleEn, text(b.title_zh), text(b.url), text(b.image), text(b.taken_at) || null, id);
      audit(db, req.session.user.username, 'update', 'media_items', String(id));
    } else {
      const info = db.prepare('INSERT INTO media_items (kind, title_en, title_zh, url, image, taken_at) VALUES (?,?,?,?,?,?)')
        .run(kind, titleEn, text(b.title_zh), text(b.url), text(b.image), text(b.taken_at) || null);
      audit(db, req.session.user.username, 'create', 'media_items', String(info.lastInsertRowid));
    }
    res.redirect('/admin/media');
  });
  app.post('/admin/media/:id/delete', csrfMiddleware, (req, res) => {
    db.prepare('DELETE FROM media_items WHERE id = ?').run(req.params.id);
    audit(db, req.session.user.username, 'delete', 'media_items', req.params.id);
    res.redirect('/admin/media');
  });

  // ---------- Settings ----------
  app.get('/admin/settings', (req, res) => {
    const rows = db.prepare('SELECT * FROM settings ORDER BY key').all();
    renderAdmin(req, res, 'settings.ejs', { rows });
  });
  app.post('/admin/settings', csrfMiddleware, (req, res) => {
    for (const [k, v] of Object.entries(req.body || {})) {
      if (k === '_csrf') continue;
      const [key, field] = k.split('|');
      if (!key || !field) continue;
      const value = String(v ?? '');
      const existing = db.prepare('SELECT key FROM settings WHERE key = ?').get(key);
      if (existing) {
        if (field === 'en') db.prepare('UPDATE settings SET value_en=?, updated_at=? WHERE key=?').run(value, new Date().toISOString(), key);
        else if (field === 'zh') db.prepare('UPDATE settings SET value_zh=?, updated_at=? WHERE key=?').run(value, new Date().toISOString(), key);
      } else {
        const other = field === 'en' ? '' : value;
        db.prepare('INSERT INTO settings (key, value_en, value_zh, updated_at) VALUES (?,?,?,?)')
          .run(key, field === 'en' ? value : other, field === 'zh' ? value : other, new Date().toISOString());
      }
      audit(db, req.session.user.username, 'update', 'settings', key);
    }
    res.redirect('/admin/settings');
  });

  // ---------- Inbox ----------
  app.get('/admin/inbox', (req, res) => {
    const rows = db.prepare('SELECT * FROM contact_messages ORDER BY created_at DESC').all();
    renderAdmin(req, res, 'inbox.ejs', { rows });
  });
  app.post('/admin/inbox/:id/status', csrfMiddleware, (req, res) => {
    const status = ['new','read','archived'].includes(req.body?.status) ? req.body.status : 'read';
    db.prepare('UPDATE contact_messages SET status=?, updated_at=? WHERE id=?')
      .run(status, new Date().toISOString(), req.params.id);
    audit(db, req.session.user.username, 'update', 'contact_messages', req.params.id);
    res.redirect('/admin/inbox');
  });
  app.get('/admin/inbox/export.csv', (req, res) => {
    const rows = db.prepare('SELECT * FROM contact_messages ORDER BY created_at DESC').all();
    const body = csv(
      ['id','name','email','phone','topic','message','lang','status','created_at'],
      rows.map(r => [r.id, r.name, r.email, r.phone, r.topic, r.message, r.lang, r.status, r.created_at])
    );
    res.type('text/csv').attachment('contact-messages.csv').send(body);
    audit(db, req.session.user.username, 'export', 'contact_messages', '');
  });

  // ---------- Subscribers ----------
  app.get('/admin/subscribers', (req, res) => {
    const rows = db.prepare('SELECT * FROM newsletter_subscribers ORDER BY created_at DESC').all();
    renderAdmin(req, res, 'subscribers.ejs', { rows });
  });
  app.get('/admin/subscribers/export.csv', (req, res) => {
    const rows = db.prepare('SELECT * FROM newsletter_subscribers ORDER BY created_at DESC').all();
    const body = csv(
      ['id','email','lang','confirmed','created_at'],
      rows.map(r => [r.id, r.email, r.lang, r.confirmed, r.created_at])
    );
    res.type('text/csv').attachment('subscribers.csv').send(body);
    audit(db, req.session.user.username, 'export', 'newsletter_subscribers', '');
  });

  // ---------- Serve uploaded files (for admin preview / download) ----------
  app.get('/admin/uploads/:name', (req, res) => {
    const name = path.basename(req.params.name);
    const full = path.join(uploadDir, name);
    if (!full.startsWith(uploadDir) || !fs.existsSync(full)) return res.status(404).send('Not found');
    res.download(full);
  });
}
