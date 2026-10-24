// src/admin/crud.js — registers list / new / edit / save / delete routes for every entity declared in entities.js.
import { csrfMiddleware } from '../middleware/csrf.js';
import { nowUtc } from '../datetime.js';
import { F } from './entities.js';

const q = (col) => `"${col}"`;   // quoted, so a column called "group" works

export function registerAdminCrud(app, { db, renderAdmin, audit, entities }) {
  for (const e of entities) {
    const extra = () => (e.extra ? e.extra(db) : {});
    const getRow = (id) => db.prepare(`SELECT * FROM ${e.table} WHERE id = ?`).get(id);

    app.get(e.base, (req, res) => {
      const rows = db.prepare(`SELECT * FROM ${e.table}${e.softDelete ? ' WHERE deleted_at IS NULL' : ''} ORDER BY ${e.orderBy}`).all();
      renderAdmin(req, res, e.listView, { rows });
    });

    if (e.create !== false) app.get(`${e.base}/new`, (req, res) => renderAdmin(req, res, e.editView, { item: null, ...extra() }));

    app.get(`${e.base}/:id`, (req, res) => {
      const item = getRow(req.params.id);
      if (!item) return res.status(404).send('Not found');
      renderAdmin(req, res, e.editView, { item, ...extra() });
    });

    app.post(e.base, csrfMiddleware, (req, res) => {
      const b = req.body || {};
      const values = Object.fromEntries(Object.entries(e.fields).map(([col, coerce]) => [col, coerce(b[col])]));
      const user = req.session.user.username;
      let existing = null;
      let keyValue = null;
      if (e.key.by === 'id') {
        const id = F.text(b.id);
        existing = id ? { id: parseInt(id, 10) } : null;
      } else {
        keyValue = F.text(b[e.key.by]) || e.key.fallback();
        existing = db.prepare(`SELECT id FROM ${e.table} WHERE ${q(e.key.by)} = ?`).get(keyValue);
        if (e.key.by in values) values[e.key.by] = keyValue;
      }

      if (existing) {
        const set = { ...values, ...e.onUpdate };
        db.prepare(`UPDATE ${e.table} SET ${Object.keys(set).map((c) => `${q(c)} = ?`).join(', ')} WHERE id = ?`).run(...Object.values(set), existing.id);
        audit(db, user, 'update', e.table, String(existing.id));
      } else if (e.create !== false) {
        const row = e.key.by === 'id' || e.key.by in values ? values : { [e.key.by]: keyValue, ...values };
        const info = db.prepare(`INSERT INTO ${e.table} (${Object.keys(row).map(q).join(', ')}) VALUES (${Object.keys(row).map(() => '?').join(', ')})`).run(...Object.values(row));
        audit(db, user, 'create', e.table, String(info.lastInsertRowid));
      }
      res.redirect(e.base);
    });

    app.post(`${e.base}/:id/delete`, csrfMiddleware, (req, res) => {
      const id = req.params.id;
      if (e.softDelete) db.prepare(`UPDATE ${e.table} SET deleted_at = ? WHERE id = ?`).run(nowUtc(), id);
      else db.prepare(`DELETE FROM ${e.table} WHERE id = ?`).run(id);
      audit(db, req.session.user.username, 'delete', e.table, id);
      res.redirect(e.base);
    });
  }
}
