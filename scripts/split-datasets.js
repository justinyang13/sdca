#!/usr/bin/env node
// scripts/split-datasets.js — one-time split of the mixed data/sdca.db into
//   data/demo.db  (a full copy, every placeholder row flagged is_demo = 1, dataset = 'demo')
//   data/sdca.db  (live: demo rows removed, dataset = 'live')
// A timestamped backup of the original goes to data/backups/ first. Refuses to run twice.
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../src/config.js';
import { applyMigrations } from '../src/db/migrate.js';
import { DEMO_TABLES, demoRowCount } from '../src/db/guard.js';

const live = config.liveDbFile;
const demoFile = path.join(path.dirname(live), 'demo.db');
const backupDir = path.join(path.dirname(live), 'backups');
if (fs.existsSync(demoFile)) { console.error(`${demoFile} already exists; nothing done.`); process.exit(1); }

const open = (f) => { const d = new DatabaseSync(f); d.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = OFF;'); return d; };
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
fs.mkdirSync(backupDir, { recursive: true });
const src = open(live);
src.exec('PRAGMA wal_checkpoint(TRUNCATE)');
const backup = path.join(backupDir, `sdca-pre-split-${stamp}.db`);
src.exec(`VACUUM INTO '${backup}'`);
console.log('backup:', backup);

applyMigrations(src);
// 1. flag every placeholder row (all of these tables hold demo/placeholder data, except the real portal admin login)
for (const t of DEMO_TABLES) src.exec(`UPDATE ${t} SET is_demo = 1`);
const admin = src.prepare("SELECT id, person_id FROM users WHERE username = 'admin'").get();
if (admin) { src.prepare('UPDATE users SET is_demo = 0 WHERE id = ?').run(admin.id); if (admin.person_id) src.prepare('UPDATE persons SET is_demo = 0 WHERE id = ?').run(admin.person_id); }
console.log('flagged demo rows:', demoRowCount(src));

// 2. demo.db = full copy
src.exec('PRAGMA wal_checkpoint(TRUNCATE)');
src.exec(`VACUUM INTO '${demoFile}'`);
const demo = open(demoFile);
demo.prepare("UPDATE settings SET value_en = 'demo' WHERE key = 'dataset'").run();
demo.close();

// 3. live: delete demo rows and everything hanging off them (child tables hold only demo data)
const CHILD = ['class_announcements', 'portal_audit', 'email_outbox', 'waiver_acceptances', 'volunteer_signups', 'withdrawals', 'transaction_lines', 'transactions', 'credit_grades', 'student_school_info',
  'registration_items', 'enrollments', 'registrations', 'class_assignments', 'parent_students', 'family_members', 'invitations', 'password_resets', 'addresses'];
src.exec('BEGIN');
for (const t of CHILD) src.exec(`DELETE FROM ${t}`);
src.exec('DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE is_demo = 1)');
for (const t of ['board_members', 'school_classes', 'users', 'families', 'persons', 'rooms', 'fee_schedules', 'textbooks']) src.exec(`DELETE FROM ${t} WHERE is_demo = 1`);
src.exec('DELETE FROM withdrawal_fee_rules');
src.exec('DELETE FROM sessions');
src.exec('UPDATE events SET created_by = NULL WHERE created_by IS NOT NULL AND created_by NOT IN (SELECT id FROM users)');   // events edited by demo users
src.exec('UPDATE events SET updated_by = NULL WHERE updated_by IS NOT NULL AND updated_by NOT IN (SELECT id FROM users)');   // signs everyone out; sessions may point at removed demo users
src.exec("UPDATE settings SET value_en = 'live' WHERE key = 'dataset'");
src.exec('COMMIT');
console.log('live demo rows left:', demoRowCount(src));
const fk = src.prepare('PRAGMA foreign_key_check').all();
console.log('foreign key problems:', fk.length);
src.close();
console.log('done. live: data/sdca.db   demo: data/demo.db  (run it with: npm run start:demo)');
