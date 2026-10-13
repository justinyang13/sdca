// src/portal/r-manage.js — generic management pages for every entity (list+search+filter+sort+page, CRUD, CSV export),
// the lookup API used by typeahead fields, and the admin-only Role & Permission matrix.
import { csrfMiddleware } from '../middleware/csrf.js';
import { ENTITIES, entityActions } from './entities.js';
import { can, canAll, allPermissionDefs } from './perm.js';
import { currentYear } from './fees.js';
import {
  listRows, getRow, createRow, updateRow, softDelete, fromBody, validate, refOptions, refCount, refLabel, csvEscape, listColumns, audit,
} from './crud.js';

const SMALL_REF = 150;

export function registerManageRoutes(app, { db, page, requireLogin }) {
  const R = '/:lang/portal';
  const lang = (req) => req.params.lang;
  const back = (req, res, p, flash) => { if (flash) req.session.portalFlash = flash; res.redirect(`/${lang(req)}/portal${p}`); };

  function guard(action) {
    return (req, res, next) => {
      const ent = ENTITIES[req.params.entity];
      if (!ent) return next('route');
      const a = req.portal?.access;
      const ok = canAll(a, `${ent.perm}.${action}`) && !(ent.adminOnly && !can(a, 'roles.manage')) && entityActions(ent).includes(action);
      if (!ok) return page(req, res, 'forbidden.ejs', {}, { title: 'Not allowed', status: 403 });
      req.ent = ent; req.entKey = req.params.entity;
      next();
    };
  }

  function filtersOf(req, ent) {
    const filters = {};
    for (const [k, v] of Object.entries(req.query)) if (k.startsWith('f_') && v !== '') filters[k.slice(2)] = String(v);
    return filters;
  }

  /** filter widgets for the list toolbar */
  function filterWidgets(ent, filters) {
    const out = [];
    for (const fd of ent.fields) {
      if (!fd.filter) continue;
      let w = { name: fd.name, label: fd.label, value: filters[fd.name] ?? '' };
      if (fd.type === 'select') w = { ...w, kind: 'select', options: fd.options.map((o) => ({ v: o.v, en: o.en, zh: o.zh })) };
      else if (['yn', 'gender'].includes(fd.type)) w = { ...w, kind: 'select', options: (fd.type === 'yn' ? [['Y', 'Yes 是'], ['N', 'No 否']] : [['M', 'M 男'], ['F', 'F 女']]).map(([v, l]) => ({ v, en: l, zh: l })) };
      else if (fd.type === 'bool') w = { ...w, kind: 'select', options: [{ v: '1', en: 'Yes', zh: '是' }, { v: '0', en: 'No', zh: '否' }] };
      else if (fd.type === 'ref') {
        if (refCount(db, fd.ref) > SMALL_REF) continue;
        w = { ...w, kind: 'select', options: refOptions(db, fd.ref, { limit: SMALL_REF }).map((o) => ({ v: String(o.id), en: o.label, zh: o.label })) };
      } else w = { ...w, kind: 'text' };
      out.push(w);
    }
    return out;
  }

  function formRefs(ent, values) {
    const refs = {};
    for (const fd of ent.fields) {
      if (fd.type !== 'ref') continue;
      if (refCount(db, fd.ref) <= SMALL_REF) refs[fd.name] = { mode: 'select', options: refOptions(db, fd.ref, { limit: SMALL_REF }) };
      else refs[fd.name] = { mode: 'search', label: refLabel(db, fd.ref, values?.[fd.name]) };
    }
    return refs;
  }

  // ---------- lookup API (typeahead) ----------
  app.get(`${R}/api/lookup/:entity`, requireLogin, (req, res) => {
    const ent = ENTITIES[req.params.entity];
    if (!ent || !can(req.portal.access, `${ent.perm}.list`)) return res.status(403).json([]);
    res.json(refOptions(db, req.params.entity, { term: String(req.query.q || ''), limit: 20 }));
  });

  // ---------- Roles: permission matrix (Admin only) ----------
  app.get(`${R}/manage/roles/:id/permissions`, requireLogin, (req, res) => {
    if (!can(req.portal.access, 'roles.manage')) return page(req, res, 'forbidden.ejs', {}, { title: 'Not allowed', status: 403 });
    const role = db.prepare('SELECT * FROM roles WHERE id = ? AND deleted_at IS NULL').get(Number(req.params.id));
    if (!role) return back(req, res, '/manage/roles', { type: 'warn', msg: 'Role not found' });
    const granted = new Map(db.prepare('SELECT p.code, rp.scope FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = ? AND rp.deleted_at IS NULL').all(role.id).map((r) => [r.code, r.scope]));
    const defs = allPermissionDefs();
    const rows = [];
    for (const e of Object.values(ENTITIES)) rows.push({ resource: e.perm, label: e.label, actions: entityActions(e).map((a) => ({ a, code: `${e.perm}.${a}`, scope: granted.get(`${e.perm}.${a}`) || '' })) });
    const special = defs.filter((d) => !Object.values(ENTITIES).some((e) => e.perm === d.resource && d.code.startsWith(e.perm + '.')) || ['roles.manage'].includes(d.code))
      .map((d) => ({ ...d, scope: granted.get(d.code) || '' }));
    page(req, res, 'roles-matrix.ejs', { role, rows, special, locked: role.code === 'admin' }, { title: `Permissions: ${role.name_en}` });
  });
  app.post(`${R}/manage/roles/:id/permissions`, requireLogin, csrfMiddleware, (req, res) => {
    if (!can(req.portal.access, 'roles.manage')) return page(req, res, 'forbidden.ejs', {}, { title: 'Not allowed', status: 403 });
    const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(Number(req.params.id));
    if (!role) return back(req, res, '/manage/roles');
    if (role.code === 'admin') return back(req, res, `/manage/roles/${role.id}/permissions`, { type: 'warn', msg: 'The Admin role always has every permission.' });
    const body = req.body || {};
    const before = db.prepare('SELECT p.code, rp.scope FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = ?').all(role.id);
    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(role.id);
      const pid = new Map(db.prepare('SELECT id, code FROM permissions').all().map((r) => [r.code, r.id]));
      const ins = db.prepare('INSERT INTO role_permissions (role_id, permission_id, scope, created_by, updated_by) VALUES (?,?,?,?,?)');
      const after = [];
      for (const [k, v] of Object.entries(body)) {
        if (!k.startsWith('p:') || !v) continue;
        const code = k.slice(2);
        const scope = ['all', 'own_family', 'own_classes', 'own_record'].includes(String(v)) ? String(v) : 'all';
        if (pid.has(code)) { ins.run(role.id, pid.get(code), scope, req.portal.user.id, req.portal.user.id); after.push({ code, scope }); }
      }
      audit(db, 'role_permissions', role.id, 'update', before, after, req.portal.user.id, req.ip);
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    back(req, res, `/manage/roles/${role.id}/permissions`, { type: 'ok', msg: 'Permissions saved. 權限已儲存。' });
  });

  // ---------- user roles (inside the user form) ----------
  const saveUserRoles = (userId, body, actorId) => {
    const wanted = new Set([].concat(body.roles || []).map(Number).filter(Boolean));
    const have = db.prepare('SELECT id, role_id FROM user_roles WHERE user_id = ? AND deleted_at IS NULL').all(userId);
    for (const h of have) if (!wanted.has(h.role_id)) db.prepare("UPDATE user_roles SET deleted_at = datetime('now'), updated_by = ? WHERE id = ?").run(actorId, h.id);
    for (const rid of wanted) if (!have.some((h) => h.role_id === rid)) db.prepare('INSERT INTO user_roles (user_id, role_id, created_by, updated_by) VALUES (?,?,?,?)').run(userId, rid, actorId, actorId);
    audit(db, 'user_roles', userId, 'set_roles', null, [...wanted], actorId);
  };
  const rolesFor = (userId) => {
    const all = db.prepare('SELECT id, code, name_en, name_zh FROM roles WHERE deleted_at IS NULL ORDER BY sort').all();
    const mine = new Set(userId ? db.prepare('SELECT role_id FROM user_roles WHERE user_id = ? AND deleted_at IS NULL').all(userId).map((r) => r.role_id) : []);
    return all.map((r) => ({ ...r, checked: mine.has(r.id) }));
  };

  // ---------- list ----------
  app.get(`${R}/manage/:entity`, requireLogin, guard('list'), (req, res) => {
    const ent = req.ent;
    const filters = filtersOf(req, ent);
    const year = currentYear(db);
    // default to the current school year for year-scoped lists the first time (no filter chosen yet)
    if (!('yr' in req.query) && year) { const fd = ent.fields.find((x) => x.defaultCurrentYear && x.filter); if (fd && !filters[fd.name]) filters[fd.name] = String(year.id); }
    const params = { q: req.query.q, filters, sort: req.query.sort, dir: req.query.dir, page: req.query.page, pageSize: req.query.ps };
    const result = listRows(db, ent, params);
    page(req, res, 'manage-list.ejs', {
      ent, key: req.entKey, result, filters, widgets: filterWidgets(ent, filters), q: String(req.query.q || ''),
      canCreate: !ent.readOnly && !ent.noCreate && canAll(req.portal.access, `${ent.perm}.create`),
      canUpdate: !ent.readOnly && canAll(req.portal.access, `${ent.perm}.update`),
      canDelete: !ent.readOnly && canAll(req.portal.access, `${ent.perm}.delete`),
      canExport: canAll(req.portal.access, `${ent.perm}.export`),
      qs: (over = {}) => { const p = new URLSearchParams(); if (req.query.q) p.set('q', req.query.q); for (const [k, v] of Object.entries(filters)) p.set('f_' + k, v); p.set('yr', '1'); if (req.query.ps) p.set('ps', req.query.ps); if (result.sort) { p.set('sort', result.sort); p.set('dir', result.dir); } for (const [k, v] of Object.entries(over)) { if (v === null) p.delete(k); else p.set(k, v); } return p.toString(); },
      detailUrl: (row) => (ent.detail ? ent.detail.replace(':id', row[ent.detailKey || 'id']) : null),
    }, { title: ent.label.en });
  });

  app.get(`${R}/manage/:entity/export.csv`, requireLogin, guard('export'), (req, res) => {
    const ent = req.ent;
    const filters = filtersOf(req, ent); const yr0 = currentYear(db);
    if (!('yr' in req.query) && yr0) { const fd = ent.fields.find((x) => x.defaultCurrentYear && x.filter); if (fd && !filters[fd.name]) filters[fd.name] = String(yr0.id); }
    const result = listRows(db, ent, { q: req.query.q, filters, sort: req.query.sort, dir: req.query.dir, page: 1, pageSize: 500 });
    const cols = result.cols;
    const lines = [cols.map((c) => csvEscape(c.label.en)).join(',')];
    let pageNo = 1; let rows = result.rows;
    const val = (r, c) => (c.field?.type === 'ref' ? r[c.key + '__label'] : r[c.key]);
    for (;;) {
      for (const r of rows) lines.push(cols.map((c) => csvEscape(val(r, c))).join(','));
      if (pageNo >= result.pages) break;
      pageNo += 1;
      rows = listRows(db, ent, { q: req.query.q, filters, sort: req.query.sort, dir: req.query.dir, page: pageNo, pageSize: 500 }).rows;
    }
    audit(db, ent.table, null, 'export_csv', null, { rows: result.total }, req.portal.user.id, req.ip);
    res.type('text/csv; charset=utf-8').set('Content-Disposition', `attachment; filename="${req.entKey}.csv"`).send('﻿' + lines.join('\r\n'));
  });

  // ---------- create / edit ----------
  const renderForm = (req, res, ent, key, values, errors, id, status = 200) => page(req, res, 'manage-form.ejs', {
    ent, key, values, errors, id, refs: formRefs(ent, values),
    userRoles: ent.table === 'users' ? rolesFor(id) : null,
    detailUrl: id && ent.detail ? ent.detail.replace(':id', (values && values[ent.detailKey || 'id']) ?? id) : null,
    canDelete: id && !ent.readOnly && canAll(req.portal.access, `${ent.perm}.delete`),
    readOnly: !!ent.readOnly || !canAll(req.portal.access, `${ent.perm}.update`) && !!id,
  }, { title: `${id ? 'Edit' : 'New'} ${ent.singular.en}`, status });

  app.get(`${R}/manage/:entity/new`, requireLogin, guard('create'), (req, res) => {
    const ent = req.ent;
    if (ent.noCreate) return back(req, res, `/manage/${req.entKey}`);
    const values = {};
    const year = currentYear(db);
    for (const fd of ent.fields) {
      if (fd.defaultCurrentYear && year) values[fd.name] = year.id;
      if (fd.type === 'select' && fd.options?.length && !values[fd.name]) values[fd.name] = fd.options[0].v;
      if (fd.type === 'bool' && ['active', 'is_current'].includes(fd.name) === false) values[fd.name] = fd.name === 'active' ? 1 : 0;
      if (req.query[fd.name] !== undefined) values[fd.name] = req.query[fd.name];
    }
    renderForm(req, res, ent, req.entKey, values, {}, null);
  });
  app.post(`${R}/manage/:entity`, requireLogin, csrfMiddleware, guard('create'), (req, res) => {
    const ent = req.ent;
    const data = fromBody(ent, req.body);
    const errors = validate(ent, data, { creating: true });
    if (Object.keys(errors).length) return renderForm(req, res, ent, req.entKey, { ...data }, errors, null, 400);
    try {
      const id = createRow(db, ent, data, req.portal.user.id, req.ip);
      if (ent.table === 'users') saveUserRoles(id, req.body, req.portal.user.id);
      back(req, res, `/manage/${req.entKey}`, { type: 'ok', msg: `${ent.singular.en} created. 已建立。` });
    } catch (e) {
      const msg = /UNIQUE/i.test(e.message) ? 'That value already exists (must be unique).' : e.message;
      renderForm(req, res, ent, req.entKey, { ...data }, { _form: msg }, null, 400);
    }
  });
  app.get(`${R}/manage/:entity/:id`, requireLogin, guard('view'), (req, res) => {
    const ent = req.ent;
    const row = getRow(db, ent, req.params.id);
    if (!row) return back(req, res, `/manage/${req.entKey}`, { type: 'warn', msg: 'Not found' });
    renderForm(req, res, ent, req.entKey, row, {}, row.id);
  });
  app.post(`${R}/manage/:entity/:id`, requireLogin, csrfMiddleware, guard('update'), (req, res) => {
    const ent = req.ent;
    const row = getRow(db, ent, req.params.id);
    if (!row) return back(req, res, `/manage/${req.entKey}`, { type: 'warn', msg: 'Not found' });
    const data = fromBody(ent, req.body);
    const errors = validate(ent, data);
    if (Object.keys(errors).length) return renderForm(req, res, ent, req.entKey, { ...row, ...data }, errors, row.id, 400);
    try {
      updateRow(db, ent, row.id, data, req.portal.user.id, req.ip);
      if (ent.table === 'users') saveUserRoles(row.id, req.body, req.portal.user.id);
      back(req, res, `/manage/${req.entKey}`, { type: 'ok', msg: `${ent.singular.en} saved. 已儲存。` });
    } catch (e) {
      const msg = /UNIQUE/i.test(e.message) ? 'That value already exists (must be unique).' : e.message;
      renderForm(req, res, ent, req.entKey, { ...row, ...data }, { _form: msg }, row.id, 400);
    }
  });
  app.post(`${R}/manage/:entity/:id/delete`, requireLogin, csrfMiddleware, guard('delete'), (req, res) => {
    const ent = req.ent;
    if (ent.table === 'users' && Number(req.params.id) === req.portal.user.id) return back(req, res, `/manage/${req.entKey}`, { type: 'warn', msg: 'You cannot delete your own account.' });
    if (ent.table === 'roles') { const r = db.prepare('SELECT is_system FROM roles WHERE id = ?').get(Number(req.params.id)); if (r?.is_system) return back(req, res, '/manage/roles', { type: 'warn', msg: 'Built-in roles cannot be deleted (you can change their permissions).' }); }
    softDelete(db, ent, req.params.id, req.portal.user.id, req.ip);
    back(req, res, `/manage/${req.entKey}`, { type: 'ok', msg: `${ent.singular.en} deleted. 已刪除。` });
  });
}
