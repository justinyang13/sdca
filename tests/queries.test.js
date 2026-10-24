// tests/queries.test.js — the shared queries in src/queries/.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { newDb } from '../src/db/open.js';
import { applyMigrations, MIGRATIONS_DIR } from '../src/db/migrate.js';
import { publishedEvent, heroSlides, peopleInGroup } from '../src/queries/content.js';
import { familyName } from '../src/queries/families.js';
import { addSignups, familySignups } from '../src/queries/volunteers.js';
import { classById } from '../src/queries/classes.js';

let dir, db;
before(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdca-data-'));
  db = newDb(path.join(dir, 'd.db'));
  applyMigrations(db, MIGRATIONS_DIR);
  db.exec('PRAGMA foreign_keys = OFF');   // these tests insert only the rows they look at
});
after(() => { db.close(); fs.rmSync(dir, { recursive: true, force: true }); });

test('publishedEvent returns only published, not-deleted events', () => {
  const ins = db.prepare('INSERT INTO events (slug, title_en, starts_at, published, deleted_at) VALUES (?,?,?,?,?)');
  ins.run('live', 'Live', '2030-01-01', 1, null); ins.run('draft', 'Draft', '2030-01-01', 0, null); ins.run('gone', 'Gone', '2030-01-01', 1, '2030-01-02 00:00:00');
  assert.equal(publishedEvent(db, 'live').title_en, 'Live');
  assert.equal(publishedEvent(db, 'draft'), undefined);
  assert.equal(publishedEvent(db, 'gone'), undefined);
});

test('heroSlides skips unpublished and deleted slides, in sort order', () => {
  const ins = db.prepare('INSERT INTO slides (image, sort, published, deleted_at) VALUES (?,?,?,?)');
  ins.run('b.jpg', 2, 1, null); ins.run('a.jpg', 1, 1, null); ins.run('hidden.jpg', 0, 0, null); ins.run('deleted.jpg', 0, 1, '2030-01-01 00:00:00');
  const images = heroSlides(db).map((s) => s.image);   // the migrations also seed a few slides, so look only at ours
  assert.deepEqual(images.filter((i) => i.endsWith('.jpg')), ['a.jpg', 'b.jpg']);
});

test('peopleInGroup filters by group and orders by sort then name', () => {
  const ins = db.prepare('INSERT INTO people (name_en, "group", sort) VALUES (?,?,?)');
  ins.run('Zed', 'board', 1); ins.run('Amy', 'board', 1); ins.run('Bob', 'board', 0); ins.run('Cat', 'staff', 0);
  assert.deepEqual(peopleInGroup(db, 'board').map((p) => p.name_en), ['Bob', 'Amy', 'Zed']);
  assert.deepEqual(peopleInGroup(db, 'staff').map((p) => p.name_en), ['Cat']);
});

test('familyName falls back to the family number', () => {
  assert.equal(familyName(db, 99), 'Family #99');
});

test('addSignups ranks jobs by position and skips empty slots; familySignups reads them back in order', () => {
  addSignups(db, { familyId: 5, personId: 1, yearId: 1, jobIds: [30, 0, 10], by: 7 });
  const rows = familySignups(db, 5, 1);
  assert.deepEqual(rows.map((r) => [r.job_id, r.priority]), [[30, 1], [10, 3]]);
  assert.equal(rows[0].created_by, 7);
});

test('classById accepts a number or numeric text, and ignores deleted classes', () => {
  assert.equal(classById(db, 'abc'), undefined);
  db.prepare("INSERT INTO school_classes (id, school_year_id, class_type_id, code, deleted_at) VALUES (900, 1, 1, 'X', NULL), (901, 1, 1, 'Y', '2030-01-01 00:00:00')").run();
  assert.equal(classById(db, '900').code, 'X');
  assert.equal(classById(db, 901), undefined);
});
