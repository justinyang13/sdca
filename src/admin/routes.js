// src/admin/routes.js — /admin routes (English UI).
// Login, dashboard, CRUD for announcements/events/pages/programs/people/sponsors/documents/media_items,
// settings, inbox, subscribers, audit log.
import fs from 'node:fs';
import path from 'node:path';
import ejs from 'ejs';
import { t, SUPPORTED } from '../i18n/index.js';
import { assetUrl } from '../helpers.js';
import { verifyPassword } from './auth.js';
import { uploader, uploadDir, verifyUploadContent } from './uploads.js';
import { loginLimiter } from '../middleware/index.js';
import { csrfMiddleware, csrfTokenFrom, ensureCsrf } from '../middleware/csrf.js';
import { config } from '../config.js';
import { asset } from '../asset-version.js';
import { nowUtc } from '../datetime.js';
import { recordLogin, loginSummary } from '../login-events.js';
import { ENTITIES, F } from './entities.js';
import { registerAdminCrud } from './crud.js';
import { isLocked, recordFailure, clearFailures } from '../auth/lockout.js';

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

const text = F.text;

/**
 * Register /admin routes on the given express app.
 * `db` is required.
 */
/** Only same-site /admin paths are allowed after sign-in (no open redirect). */
export const safeNext = (n) => (/^\/admin(\/[A-Za-z0-9_\-./]*)?$/.test(String(n || '')) ? String(n) : '/admin/dashboard');

export function registerAdminRoutes(app, { db }) {
  const views = path.join(config.viewsDir, 'admin');
  const renderAdmin = (req, res, file, locals = {}, status = 200) => {
    const csrf = csrfTokenFrom(req);
    const html = ejs.render(fs.readFileSync(path.join(views, file), 'utf8'), {
      csrfToken: csrf,
      user: req.session.user,
      t: (k) => t('en', k),
      assetUrl,
      error: null,   // templates read `error` unguarded; callers override it
      ...locals,
    });
    const shell = ejs.render(fs.readFileSync(path.join(views, 'layout.ejs'), 'utf8'), {
      title: locals.title || 'SDCA Admin',
      body: html,
      asset,
      idleMinutes: config.sessionIdleMinutes,
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
    const csrf = ensureCsrf(req, res);
    const body = ejs.render(fs.readFileSync(path.join(views, 'login.ejs'), 'utf8'), {
      csrfToken: csrf, error: null, nextPath: '/admin/dashboard',
    });
    const shell = ejs.render(fs.readFileSync(path.join(views, 'login-shell.ejs'), 'utf8'), {
      title: 'Sign in', body, csrfToken: csrf, t: (k) => t('en', k),
    });
    res.status(401).type('html').send(shell);
  });

  app.get('/admin/login', (req, res) => {
    const csrf = ensureCsrf(req, res);
    renderAdmin(req, res, 'login.ejs', { error: null, nextPath: safeNext(req.query.next) });
  });

  app.post('/admin/login', loginLimiter, csrfMiddleware, (req, res) => {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);
    const locked = isLocked(user);
    const passwordOk = verifyPassword(password, user ? user.password_hash : 'aa:bb');   // always hash, so timing does not reveal the username
    if (!user || locked || !passwordOk) {
      let detail = user ? 'wrong password' : 'unknown username';
      if (user && locked) detail = 'account locked';
      else if (user && recordFailure(db, 'admin_users', user)) detail = 'wrong password; account locked';
      recordLogin(db, { area: 'admin', event: 'login_failed', username, userId: user?.id ?? null, ip: req.ip, userAgent: req.get('user-agent'), detail });
      const err = 'Invalid username or password';   // the same message for every failure, locked or not
      return renderAdmin(req, res, 'login.ejs', { error: err, nextPath: safeNext(req.body?.next) }, 401);
    }
    const next = safeNext(req.body?.next);
    // new session id at sign-in (prevents session fixation)
    req.session.regenerate((regenErr) => {
      if (regenErr) return res.status(500).type('text').send('Session error');
      req.session.user = { id: user.id, username: user.username, role: user.role };
      clearFailures(db, 'admin_users', user.id);
      db.prepare('UPDATE admin_users SET last_login = ? WHERE id = ?').run(nowUtc(), user.id);
      audit(db, user.username, 'login', 'admin_users', String(user.id));
      recordLogin(db, { area: 'admin', event: 'login', username: user.username, userId: user.id, ip: req.ip, userAgent: req.get('user-agent') });
      req.session.save(() => res.redirect(next));
    });
  });

  app.post('/admin/logout', csrfMiddleware, (req, res) => {
    const sid = req.sessionID;
    if (req.session?.user) recordLogin(db, { area: 'admin', event: 'logout', username: req.session.user.username, userId: req.session.user.id, ip: req.ip, userAgent: req.get('user-agent') });
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
    if (!csrfTokenFrom(req)) {
      ensureCsrf(req, res);
      return res.redirect(req.path);
    }
    return next();
  });

  // keep-alive for the idle-timeout "stay signed in" button
  app.get('/admin/ping', (req, res) => res.status(204).set('Cache-Control', 'no-store').end());

  // ---------- Dashboard ----------
  app.get('/admin/dashboard', (req, res) => {
    const counts = {
      announcements: db.prepare('SELECT COUNT(*) c FROM announcements').get().c,
      events: db.prepare('SELECT COUNT(*) c FROM events WHERE deleted_at IS NULL').get().c,
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

  // ---------- Login activity (admins only; editors get 403) ----------
  app.get('/admin/logins', (req, res) => {
    if (req.session.user.role !== 'admin') return res.status(403).type('text').send('Forbidden: admins only');
    const q = req.query;
    const days = { '1': 1, '7': 7, '30': 30 }[String(q.days)] || 0;
    const since = days ? new Date(Date.now() - days * 86400000).toISOString().slice(0, 19).replace('T', ' ') : null;
    const filters = { area: ['admin', 'portal'].includes(q.area) ? q.area : '', event: ['login', 'login_failed', 'logout'].includes(q.event) ? q.event : '', q: String(q.q || '').trim().slice(0, 60), days: days || '' };
    const data = loginSummary(db, { since, area: filters.area, event: filters.event, q: filters.q });
    renderAdmin(req, res, 'logins.ejs', { title: 'Login activity', filters, ...data });
  });

  const getRow = (table, id) => db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);

  // ---------- Content entities (announcements, events, slides, archive photos, pages, programs, people, sponsors, media) ----------
  registerAdminCrud(app, { db, renderAdmin, audit, entities: ENTITIES });

  // ---------- Documents ----------
  app.get('/admin/documents', (req, res) => {
    renderAdmin(req, res, 'documents-list.ejs', { rows: db.prepare('SELECT * FROM documents ORDER BY category, title_en').all() });
  });
  app.get('/admin/documents/new', (req, res) => { renderAdmin(req, res, 'document-edit.ejs', { item: null, file: null }); });
  app.get('/admin/documents/:id', (req, res) => {
    const item = getRow('documents', req.params.id);
    if (!item) return res.status(404).send('Not found');
    renderAdmin(req, res, 'document-edit.ejs', { item, file: item.file_path ? { size: item.bytes, name: path.basename(item.file_path) } : null });
  });
  app.post('/admin/documents', uploader.single('file'), verifyUploadContent, csrfMiddleware, (req, res) => {
    const b = req.body || {};
    const f = req.file;
    if (!f) return renderAdmin(req, res, 'document-edit.ejs', { item: null, file: null, error: req.uploadRejected ? 'The file contents do not match its type (PDF, JPG, PNG, DOCX or XLSX).' : 'File is required' }, 400);
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
        if (field === 'en') db.prepare('UPDATE settings SET value_en=?, updated_at=? WHERE key=?').run(value, nowUtc(), key);
        else if (field === 'zh') db.prepare('UPDATE settings SET value_zh=?, updated_at=? WHERE key=?').run(value, nowUtc(), key);
      } else {
        const other = field === 'en' ? '' : value;
        db.prepare('INSERT INTO settings (key, value_en, value_zh, updated_at) VALUES (?,?,?,?)')
          .run(key, field === 'en' ? value : other, field === 'zh' ? value : other, nowUtc());
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
      .run(status, nowUtc(), req.params.id);
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
