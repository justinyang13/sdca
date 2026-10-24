// src/db/guard.js — keep demo data and live data apart.
//   assertDatasetMatches(db): the DB's settings.dataset must equal config.dataset (never serve demo.db as live, or the reverse);
//                             a live DB containing any is_demo = 1 row is refused.
//   isLiveTarget(): true when the configured DB file is the real school database (seeds must not put placeholders in it).
import path from 'node:path';
import { config } from '../config.js';

export const DEMO_TABLES = ['persons', 'users', 'families', 'school_classes', 'rooms', 'board_members', 'fee_schedules', 'textbooks'];

export function isLiveTarget() {
  return path.resolve(config.dbFile) === path.resolve(config.liveDbFile) && config.dataset === 'live';
}

export function demoRowCount(db) {
  return DEMO_TABLES.reduce((n, t) => n + db.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE is_demo = 1`).get().n, 0);
}

export function assertDatasetMatches(db, dataset = config.dataset) {
  const row = db.prepare("SELECT value_en FROM settings WHERE key = 'dataset'").get();
  const have = row ? row.value_en : 'live';
  if (have !== dataset) throw new Error(`Refusing to start: this database is marked '${have}' but DATASET is '${dataset}'.`);
  if (dataset === 'live') {
    const n = demoRowCount(db);
    if (n) throw new Error(`Refusing to start: the live database contains ${n} demo row(s) (is_demo = 1). Move them to data/demo.db (node scripts/split-datasets.js).`);
  }
}
