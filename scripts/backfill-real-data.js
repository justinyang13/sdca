#!/usr/bin/env node
// scripts/backfill-real-data.js — load REAL school data into the live database from the school's own documents.
// Idempotent (safe to re-run). Refuses to run on the demo dataset. Every block names its source document.
//   board         <- Board of Directors page (/en/about/board; old site /board-of-directors/)
//   rooms+classes <- storage/documents/2026-2027-classroom-map.pdf (revised 9/3/2026), viewed page image
//   fees+refunds  <- storage/documents/reg-notice.pdf (Registration for School Year 2026-2027)
//   events        <- already imported from 2026-27-school-calendar.pdf; here only the stray "Test" event is removed
import { openDb } from '../src/db/open.js';
import { applyMigrations } from '../src/db/migrate.js';
import { config } from '../src/config.js';
import { assertDatasetMatches } from '../src/db/guard.js';

if (config.dataset !== 'live') { console.error('Refusing: backfill is for the live dataset only.'); process.exit(1); }
const db = openDb();
applyMigrations(db);
assertDatasetMatches(db, 'live');
const one = (sql, ...a) => db.prepare(sql).get(...a);
const run = (sql, ...a) => db.prepare(sql).run(...a);
const year = one('SELECT * FROM school_years WHERE is_current = 1');
if (!year) throw new Error('no current school year');
const stats = {};
const bump = (k) => { stats[k] = (stats[k] || 0) + 1; };

db.exec('BEGIN');
try {
  // ---- board (current school year) -------------------------------------------------------------
  const BOARD = [   // [position code, English first, English last, Chinese name]
    ['president', 'Ana', 'Wang', '王慧琪'], ['vice_president', 'Chun-Yu', 'Chuang', '莊淳宇'], ['secretary', 'Gillian', 'Lin', '林子倫'],
    ['treasurer', 'Christine', 'Gibbs', '賴靜頴'], ['editorial', 'Ling', 'Chan', '陳菱'], ['pta', 'Kathy', 'Kang', '康欣汝'],
    ['scrip', 'Hung', 'Wang', '王元弘'], ['activity', 'Ray', 'Shan', '單子睿'], ['operation', 'James', 'Yu', '游弘鈞'],
  ];
  for (const [pos, first, last, zh] of BOARD) {
    const position = one('SELECT id FROM board_positions WHERE code = ?', pos);
    if (!position) throw new Error(`missing board position ${pos}`);
    let p = one('SELECT id FROM persons WHERE is_demo = 0 AND english_first_name = ? AND english_last_name = ? AND chinese_name = ?', first, last, zh);
    if (!p) {
      const r = run(`INSERT INTO persons (english_last_name, english_first_name, chinese_name, notes) VALUES (?,?,?,?)`, last, first, zh,
        'Board member (source: Board of Directors page). Gender not recorded: the column default is a placeholder.');
      p = { id: Number(r.lastInsertRowid) }; bump('persons');
    }
    if (!one('SELECT id FROM board_members WHERE person_id = ? AND board_position_id = ? AND school_year_id = ? AND deleted_at IS NULL', p.id, position.id, year.id)) {
      run('INSERT INTO board_members (person_id, board_position_id, school_year_id, start_date, notes) VALUES (?,?,?,?,?)', p.id, position.id, year.id, year.start_date, 'Source: Board of Directors page');
      bump('board_members');
    }
  }

  // ---- rooms (2026-2027 classroom map; capacity and building are not on the map, so left blank) ----
  const ROOMS = ['MS101', 'MS102', 'MS103', 'MS104', 'MS105', 'MS109', 'MS110', 'MS111', 'MS112', 'MS201', 'MS202', 'MS203', 'MS204', 'MS205', 'MS210', 'MS211', 'MS212', 'MS213', 'LS16', 'LS17', 'LS18', 'LS19'];
  const ROOM_NOTE = { MS104: 'Meeting Room', LS19: 'Parent Lounge', MS112: 'No class assigned on the map', MS210: 'No class assigned on the map' };
  const SRC = 'Source: 2026-2027 classroom map (revised 9/3/2026)';
  for (const code of ROOMS) {
    if (!one('SELECT id FROM rooms WHERE code = ?', code)) {
      run('INSERT INTO rooms (code, notes) VALUES (?,?)', code, [ROOM_NOTE[code], SRC].filter(Boolean).join('. ')); bump('rooms');
    }
  }

  // ---- classes: [code, 中文 name, English name, class type code, level code, room] ----
  const CLASSES = [
    ['PA', '學前甲', 'Preschool A', 'preschool', 'P', 'LS18'],
    ['KA', '注音甲', 'ZhuYin Beginners A (K)', 'regular', 'RK', 'LS16'],
    ['CSLKA', '拼音甲', 'Pin-Yin Beginners A', 'bilingual', null, 'LS17'],
    ['1A', '一甲', 'Regular 1A', 'regular', 'R1', 'MS109'], ['2A', '二甲', 'Regular 2A', 'regular', 'R2', 'MS110'], ['3A', '三甲', 'Regular 3A', 'regular', 'R3', 'MS111'],
    ['4A', '四甲', 'Regular 4A', 'regular', 'R4', 'MS105'], ['5A', '五甲', 'Regular 5A', 'regular', 'R5', 'MS202'], ['6A', '六甲', 'Regular 6A', 'regular', 'R6', 'MS203'],
    ['CSL1A', '雙一甲', 'Bilingual 1A', 'bilingual', 'B1', 'MS101'], ['CSL2A', '雙二甲', 'Bilingual 2A', 'bilingual', 'B2', 'MS102'],
    ['CSL3A', '雙三甲', 'Bilingual 3A', 'bilingual', 'B3', 'MS103'], ['CSL4A', '雙四甲', 'Bilingual 4A', 'bilingual', 'B4', 'MS201'],
    ['C1A', '學分一甲', 'Credit 1A', 'credit', 'C1', 'MS211'], ['C1B', '學分一乙', 'Credit 1B', 'credit', 'C1', 'MS212'],
    ['C2A', '學分二甲', 'Credit 2A', 'credit', 'C2', 'MS213'], ['C3A', '學分三甲', 'Credit 3A', 'credit', 'C3', 'MS205'],
    ['ADT1', '成人班', 'Adult 1', 'adult', null, 'MS204'],
  ];
  for (const [code, zh, en, typeCode, levelCode, room] of CLASSES) {
    if (one('SELECT id FROM school_classes WHERE school_year_id = ? AND code = ? AND deleted_at IS NULL', year.id, code)) continue;
    const type = one('SELECT id FROM class_types WHERE code = ?', typeCode);
    const level = levelCode ? one('SELECT id FROM class_levels WHERE code = ?', levelCode) : null;
    run('INSERT INTO school_classes (school_year_id, class_type_id, class_level_id, code, name_zh, name_en, room_id) VALUES (?,?,?,?,?,?,?)',
      year.id, type.id, level?.id ?? null, code, zh, en, one('SELECT id FROM rooms WHERE code = ?', room).id); bump('school_classes');
  }

  // ---- fees 2026-2027 (Registration Notice). The notice has no scrip-deposit line, so none is entered. ----
  const FEE_SRC = 'Source: Registration for School Year 2026-2027 (reg-notice.pdf)';
  const typeId = (c) => one('SELECT id FROM class_types WHERE code = ?', c).id;
  const FEES = [   // code, en, zh, cents, applies_to, class_type, percent, from_nth_child, deadline, sort
    ['registration_fee', 'Registration Fee', '報名費', 5000, 'student', null, null, null, null, 1],
    ['early_reg_discount', 'Early Registration Discount (register by 5/17)', '提早註冊折扣 (5/17 前)', 5000, 'student', null, null, null, '2026-05-17', 2],
    ['tuition', 'Tuition – Preschool', '學費 – 學前班', 93000, 'student', typeId('preschool'), null, null, null, 3],
    ['tuition', 'Tuition – Regular', '學費 – 普通班', 93000, 'student', typeId('regular'), null, null, null, 4],
    ['tuition', 'Tuition – Bilingual', '學費 – 雙語班', 93000, 'student', typeId('bilingual'), null, null, null, 5],
    ['tuition', 'Tuition – Credit (books not included)', '學費 – 學分班 (不含課本)', 119500, 'student', typeId('credit'), null, null, null, 6],
    ['misc_fee', 'Miscellaneous Fees', '學雜費', 10000, 'student', null, null, null, null, 7],
    ['sibling_discount', 'Sibling Discount (from the 3rd child)', '手足折扣 (第三位子女起)', 10000, 'student', null, null, 3, null, 8],
    ['faculty_discount', 'Faculty / Board Discount (reimbursed 2nd semester)', '教職員/董事折扣 (第二學期退還)', 0, 'student', null, 10, null, null, 9],
    ['service_fee', 'Service Fee (refundable after volunteer duty)', '代勞費 (完成義工後退還)', 10000, 'family', null, null, null, null, 10],
  ];
  for (const [code, en, zh, cents, applies, ct, pct, nth, deadline, sort] of FEES) {
    if (one('SELECT id FROM fee_schedules WHERE school_year_id = ? AND code = ? AND name_en = ? AND deleted_at IS NULL AND is_demo = 0', year.id, code, en)) continue;
    run(`INSERT INTO fee_schedules (school_year_id, code, name_en, name_zh, amount_cents, applies_to, class_type_id, percent, from_nth_child, deadline, active, sort, notes, is_demo)
         VALUES (?,?,?,?,?,?,?,?,?,?,1,?,?,0)`, year.id, code, en, zh, cents, applies, ct, pct, nth, deadline, sort, FEE_SRC); bump('fee_schedules');
  }
  // withdrawal processing fees: "Before 8/31/2026 full refund; 8/31/2026 to first week $100; weeks 2-5 $110-$140; sixth week on: no refund"
  if (!one('SELECT id FROM withdrawal_fee_rules WHERE school_year_id = ? AND deleted_at IS NULL', year.id)) {
    const day = (n) => { const t = new Date(`${year.first_day}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
    const W = [['Before 8/31/2026 (full refund)', '8/31 前 (全額退費)', null, '2026-08-30', 0, 0], ['8/31/2026 to the end of the first week of school', '8/31 至開學第一週', '2026-08-31', day(6), 10000, 0],
      ['Second week of school', '第二週', day(7), day(13), 11000, 0], ['Third week of school', '第三週', day(14), day(20), 12000, 0], ['Fourth week of school', '第四週', day(21), day(27), 13000, 0],
      ['Fifth week of school', '第五週', day(28), day(34), 14000, 0], ['Sixth week of school and beyond (no refund)', '第六週起 (不退費)', day(35), null, 0, 1]];
    W.forEach((w, i) => { run('INSERT INTO withdrawal_fee_rules (school_year_id, label_en, label_zh, from_date, to_date, fee_cents, no_refund, sort) VALUES (?,?,?,?,?,?,?,?)', year.id, ...w, i + 1); bump('withdrawal_fee_rules'); });
  }

  // ---- events: remove the stray "Test" entry made in the admin (soft delete, restorable) ----
  const t = db.prepare("UPDATE events SET deleted_at = datetime('now') WHERE slug = '2026-10-01-test' AND deleted_at IS NULL").run();
  if (t.changes) stats.events_removed = t.changes;

  db.exec('COMMIT');
} catch (e) { db.exec('ROLLBACK'); throw e; }
console.log('backfill done:', stats);
assertDatasetMatches(db, 'live');
console.log('live DB still clean (no is_demo rows).');
