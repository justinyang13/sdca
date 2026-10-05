// src/db/migrate.js — apply db/migrations/*.sql in order, idempotent
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './open.js';

export const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'db', 'migrations');

export function listMigrations(dir = MIGRATIONS_DIR) {
  return fs.readdirSync(dir).filter(f => /^\d+_.*\.sql$/.test(f)).sort();
}

export function applyMigrations(db, dir = MIGRATIONS_DIR) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  const done = new Set(db.prepare('SELECT name FROM schema_migrations').all().map(r => r.name));
  const applied = [];
  for (const name of listMigrations(dir)) {
    if (done.has(name)) continue;
    const sql = fs.readFileSync(path.join(dir, name), 'utf8');
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(name);
      db.exec('COMMIT');
      applied.push(name);
    } catch (err) {
      db.exec('ROLLBACK');
      throw new Error(`Migration ${name} failed: ${err.message}`);
    }
  }
  return applied;
}

export function migrate(db = openDb()) {
  return applyMigrations(db);
}
