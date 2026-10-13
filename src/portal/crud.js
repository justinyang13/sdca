// src/portal/crud.js — generic list / get / create / update / soft-delete for the entities in entities.js.
import { ENTITIES } from './entities.js';
import { hashPassword } from '../admin/auth.js';

const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
const q = (s) => `"${String(s).replace(/"/g, '')}"`;       // identifier quoting (names come from our own definitions)
export const getEntity = (key) => ENTITIES[key] || null;
const isAddr = (fd) => !!fd.addr;
const isVirtual = (fd) => !!fd.virtual;

/** SQL fragment that yields the label of a referenced row (alias r). */
export function labelSqlOf(ent) {
  if (ent.labelSql) return ent.labelSql;
  const first = ent.fields.find((x) => x.list && ['text', 'email'].includes(x.type));
  return first ? `r.${q(first.name)}` : 'CAST(r.id AS TEXT)';
}

function colSql(ent, fd) {
  if (isAddr(fd)) return `(SELECT a.${q(fd.addr.col)} FROM addresses a WHERE a.id = t.${q(fd.addr.fk)})`;
  return `t.${q(fd.name)}`;
}

/** Columns shown in the list, in order: [{key, label, type, field?, sortSql}] */
export function listColumns(ent) {
  const cols = [];
  for (const fd of ent.fields) {
    if (!fd.list) continue;
    cols.push({ key: fd.name, label: fd.label, type: fd.type, field: fd });
  }
  for (const ex of ent.listExtra || []) cols.push({ key: ex.key, label: ex.label, type: 'text', extra: ex });
  if (ent.listOrder) {
    const idCol = { key: 'id', label: { en: 'ID', zh: 'ID' }, type: 'number' };
    const map = new Map([...cols, idCol].map((c) => [c.key, c]));
    return ent.listOrder.map((k) => map.get(k)).filter(Boolean);
  }
  return cols;
}

function refTable(fd) { const r = ENTITIES[fd.ref]; return r ? r.table : fd.ref; }

function selectList(ent) {
  const parts = ['t.*'];
  for (const fd of ent.fields) {
    if (isAddr(fd)) parts.push(`${colSql(ent, fd)} AS ${q(fd.name)}`);
    else if (fd.type === 'ref') {
      const r = ENTITIES[fd.ref];
      parts.push(`(SELECT ${labelSqlOf(r)} FROM ${q(r.table)} r WHERE r.id = t.${q(fd.name)}) AS ${q(fd.name + '__label')}`);
    }
  }
  for (const ex of ent.listExtra || []) parts.push(`${ex.sql} AS ${q(ex.key)}`);
  return parts.join(', ');
}

/**
 * List with search / filters / sort / paging.
 * params: { q, filters:{name:value}, sort, dir, page, pageSize }
 */
export function listRows(db, ent, params = {}) {
  const where = [];
  const args = [];
  if (!ent.noSoftDelete) where.push('t.deleted_at IS NULL');
  const cols = listColumns(ent);
  // filters
  for (const fd of ent.fields) {
    const v = params.filters?.[fd.name];
    if (v === undefined || v === '') continue;
    if (!fd.filter && !fd.list) continue;
    if (['text', 'email', 'tel', 'textarea'].includes(fd.type)) { where.push(`${colSql(ent, fd)} LIKE ?`); args.push(`%${v}%`); }
    else { where.push(`${colSql(ent, fd)} = ?`); args.push(v); }
  }
  // extra filter on computed columns (exact)
  for (const ex of ent.listExtra || []) {
    const v = params.filters?.[ex.key];
    if (v) { where.push(`${ex.sql} LIKE ?`); args.push(`%${v}%`); }
  }
  // search
  const term = String(params.q || '').trim();
  if (term) {
    const ors = [];
    for (const fd of ent.fields) if (fd.search) { ors.push(`${colSql(ent, fd)} LIKE ?`); args.push(`%${term}%`); }
    for (const ex of ent.listExtra || []) if (ex.search) { ors.push(`${ex.sql} LIKE ?`); args.push(`%${term}%`); }
    if (/^\d+$/.test(term)) { ors.push('t.id = ?'); args.push(Number(term)); }
    if (ors.length) where.push(`(${ors.join(' OR ')})`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  // sort (whitelist)
  const sortable = new Map();
  for (const c of cols) sortable.set(c.key, c.field?.type === 'ref' ? q(c.key + '__label') : (c.extra ? q(c.key) : (c.field && isAddr(c.field) ? q(c.key) : `t.${q(c.key)}`)));
  sortable.set('id', 't.id');
  let sortKey = sortable.has(params.sort) ? params.sort : (sortable.has(ent.defaultSort) ? ent.defaultSort : 'id');
  const dir = String(params.dir || ent.defaultDir || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const orderSql = `ORDER BY ${sortable.get(sortKey)} COLLATE NOCASE ${dir}, t.id ${dir}`;
  const pageSize = Math.min(500, Math.max(5, Number(params.pageSize) || 25));
  const page = Math.max(1, Number(params.page) || 1);
  const total = db.prepare(`SELECT COUNT(*) AS n FROM ${q(ent.table)} t ${whereSql}`).get(...args).n;
  const rows = db.prepare(`SELECT ${selectList(ent)} FROM ${q(ent.table)} t ${whereSql} ${orderSql} LIMIT ? OFFSET ?`).all(...args, pageSize, (page - 1) * pageSize);
  return { rows, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)), sort: sortKey, dir: dir.toLowerCase(), cols };
}

export function getRow(db, ent, id) {
  const row = db.prepare(`SELECT ${selectList(ent)} FROM ${q(ent.table)} t WHERE t.id = ?${ent.noSoftDelete ? '' : ' AND t.deleted_at IS NULL'}`).get(Number(id));
  return row || null;
}

// ---------- value coercion ----------
export function coerce(fd, raw) {
  const v = raw === undefined || raw === null ? '' : String(raw).trim();
  switch (fd.type) {
    case 'bool': return raw === '1' || raw === 'on' || raw === 'true' || raw === 1 || raw === true ? 1 : 0;
    case 'number': return v === '' ? null : Number(v);
    case 'money': { if (v === '') return null; const n = Math.round(parseFloat(v.replace(/[$,]/g, '')) * 100); return Number.isFinite(n) ? n : null; }
    case 'ref': return v === '' ? null : Number(v);
    case 'date': return v === '' ? null : v.slice(0, 10);
    case 'datetime': return v === '' ? null : v.replace('T', ' ').slice(0, 19);
    default: return v;
  }
}

export function validate(ent, data, { creating = false } = {}) {
  const errors = {};
  for (const fd of ent.fields) {
    if (fd.type === 'readonly') continue;
    if (fd.required && !isVirtual(fd)) {
      const v = data[fd.name];
      if (v === null || v === undefined || v === '') errors[fd.name] = 'required';
    }
    if (fd.type === 'email' && data[fd.name] && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data[fd.name])) errors[fd.name] = 'invalid email';
    if (fd.type === 'number' && data[fd.name] !== null && data[fd.name] !== undefined && data[fd.name] !== '' && !Number.isFinite(data[fd.name])) errors[fd.name] = 'must be a number';
  }
  if (creating && ent.table === 'users' && !data.password) errors.password = 'required';
  return errors;
}

/** Read form values into a typed object (only the entity's own fields). */
export function fromBody(ent, body, only = null) {
  const out = {};
  for (const fd of ent.fields) {
    if (fd.type === 'readonly') continue;
    if (only && !only.includes(fd.name)) continue;
    if (fd.type === 'bool') { out[fd.name] = coerce(fd, body[fd.name]); continue; }
    if (body[fd.name] === undefined) continue;
    out[fd.name] = isVirtual(fd) ? String(body[fd.name] || '') : coerce(fd, body[fd.name]);
  }
  return out;
}

function upsertAddress(db, fkValue, parts, userId) {
  const has = Object.values(parts).some((x) => String(x || '').trim() !== '');
  if (!has && !fkValue) return null;
  if (fkValue) {
    const sets = Object.keys(parts).map((c) => `${q(c)} = ?`);
    db.prepare(`UPDATE addresses SET ${sets.join(', ')}, updated_at = ?, updated_by = ? WHERE id = ?`).run(...Object.values(parts), now(), userId || null, fkValue);
    return fkValue;
  }
  const cols = Object.keys(parts);
  const r = db.prepare(`INSERT INTO addresses (${cols.map(q).join(',')}, created_by, updated_by) VALUES (${cols.map(() => '?').join(',')}, ?, ?)`).run(...Object.values(parts), userId || null, userId || null);
  return Number(r.lastInsertRowid);
}

export function audit(db, table, rowId, action, before, after, userId, ip = '') {
  db.prepare('INSERT INTO portal_audit (table_name, row_id, action, before_json, after_json, user_id, ip) VALUES (?,?,?,?,?,?,?)')
    .run(table, rowId ?? null, action, before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null, userId || null, ip);
}

function splitData(ent, data, existing) {
  const own = {}; const addr = {}; const addrFk = {};
  let password = null;
  for (const fd of ent.fields) {
    if (fd.type === 'readonly' || !(fd.name in data)) continue;
    if (fd.type === 'password') { password = data[fd.name]; continue; }
    if (isAddr(fd)) { (addr[fd.addr.fk] ||= {})[fd.addr.col] = data[fd.name]; addrFk[fd.addr.fk] = existing ? existing[fd.addr.fk] : null; continue; }
    own[fd.name] = data[fd.name];
  }
  return { own, addr, addrFk, password };
}

export function createRow(db, ent, data, userId, ip = '') {
  const { own, addr, password } = splitData(ent, data, null);
  for (const [fk, parts] of Object.entries(addr)) { const id = upsertAddress(db, null, parts, userId); if (id) own[fk] = id; }
  if (ent.table === 'users' && password) own.password_hash = hashPassword(password);
  own.created_by = userId || null; own.updated_by = userId || null;
  const cols = Object.keys(own);
  const r = db.prepare(`INSERT INTO ${q(ent.table)} (${cols.map(q).join(',')}) VALUES (${cols.map(() => '?').join(',')})`).run(...Object.values(own));
  const id = Number(r.lastInsertRowid);
  audit(db, ent.table, id, 'create', null, { ...own, password_hash: undefined }, userId, ip);
  return id;
}

export function updateRow(db, ent, id, data, userId, ip = '') {
  const before = db.prepare(`SELECT * FROM ${q(ent.table)} WHERE id = ?`).get(Number(id));
  if (!before) return false;
  const { own, addr, password } = splitData(ent, data, before);
  for (const [fk, parts] of Object.entries(addr)) { const aid = upsertAddress(db, before[fk], parts, userId); if (aid) own[fk] = aid; }
  if (ent.table === 'users' && password) own.password_hash = hashPassword(password);
  own.updated_at = now(); own.updated_by = userId || null;
  const cols = Object.keys(own);
  db.prepare(`UPDATE ${q(ent.table)} SET ${cols.map((c) => `${q(c)} = ?`).join(', ')} WHERE id = ?`).run(...Object.values(own), Number(id));
  audit(db, ent.table, Number(id), 'update', { ...before, password_hash: undefined }, { ...own, password_hash: undefined }, userId, ip);
  return true;
}

export function softDelete(db, ent, id, userId, ip = '') {
  if (ent.noSoftDelete) return false;
  const before = db.prepare(`SELECT * FROM ${q(ent.table)} WHERE id = ?`).get(Number(id));
  if (!before || before.deleted_at) return false;
  db.prepare(`UPDATE ${q(ent.table)} SET deleted_at = ?, updated_at = ?, updated_by = ? WHERE id = ?`).run(now(), now(), userId || null, Number(id));
  audit(db, ent.table, Number(id), 'delete', { ...before, password_hash: undefined }, null, userId, ip);
  return true;
}

/** Options for a ref field: all rows when the table is small, otherwise a search (q). */
export function refOptions(db, refKey, { term = '', limit = 30, ids = [] } = {}) {
  const r = ENTITIES[refKey];
  if (!r) return [];
  const label = labelSqlOf(r);
  const del = r.noSoftDelete ? '' : 'WHERE r.deleted_at IS NULL';
  if (term) {
    const searchCols = r.fields.filter((x) => x.search || (x.list && ['text', 'email'].includes(x.type)));
    const ors = searchCols.map((x) => `r.${q(x.name)} LIKE ?`);
    const args = searchCols.map(() => `%${term}%`);
    if (/^\d+$/.test(term)) { ors.push('r.id = ?'); args.push(Number(term)); }
    const w = `${del ? del + ' AND' : 'WHERE'} (${ors.join(' OR ') || '1=0'})`;
    return db.prepare(`SELECT r.id, ${label} AS label FROM ${q(r.table)} r ${w} ORDER BY label COLLATE NOCASE LIMIT ?`).all(...args, limit);
  }
  return db.prepare(`SELECT r.id, ${label} AS label FROM ${q(r.table)} r ${del} ORDER BY label COLLATE NOCASE LIMIT ?`).all(limit);
}

export function refCount(db, refKey) {
  const r = ENTITIES[refKey];
  return db.prepare(`SELECT COUNT(*) AS n FROM ${q(r.table)}${r.noSoftDelete ? '' : ' WHERE deleted_at IS NULL'}`).get().n;
}

export function refLabel(db, refKey, id) {
  const r = ENTITIES[refKey];
  if (!r || id === null || id === undefined || id === '') return '';
  const row = db.prepare(`SELECT ${labelSqlOf(r)} AS label FROM ${q(r.table)} r WHERE r.id = ?`).get(Number(id));
  return row ? row.label : '';
}

export function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
