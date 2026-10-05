// src/db/open.js — open the SQLite database (node:sqlite, WAL, FK on)
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

let cached = null;

export function openDb(file = config.dbFile) {
  if (cached) return cached;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  if (file === config.dbFile) cached = db;
  return db;
}

export function closeDb() {
  if (cached) { cached.close(); cached = null; }
}

// standalone DB on an explicit file (used by tests / backups)
export function newDb(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  return db;
}
