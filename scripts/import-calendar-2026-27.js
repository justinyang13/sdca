#!/usr/bin/env node
// scripts/import-calendar-2026-27.js — loads every activity of the 2026-27 school calendar PDF
// (storage/documents/2026-27-school-calendar.pdf, "Revised: 8/28/2026") into the `events` table.
// One event per activity, English + Chinese titles taken from the two PDF pages. Safe to re-run (upsert by slug).
// The six events that were seeded earlier from the same calendar (combined titles) are soft-deleted and replaced.
import { openDb } from '../src/db/open.js';

const LOC = 'La Jolla Country Day School';
// [start date, end date | null, category, English title, 中文標題, location]
const cm = (en, zh) => [en, zh];
const D = [
  ['2026-08-30', null, 'meeting', 'Teachers Meeting (1)', '教務研討會（1）'],
  ['2026-09-13', null, 'class', 'School Opening', '開學'], ['2026-09-13', null, 'class', 'Registration', '註冊'], ['2026-09-13', null, 'exam', 'Placement Test', '插班考試'],
  ['2026-09-20', null, 'class', 'Registration', '註冊'], ['2026-09-20', null, 'class', 'Adult Fall Class Starts', '成人秋季班開學'], ['2026-09-20', null, 'performance', 'Celebrate Moon Festival', '慶祝中秋節'],
  ['2026-09-27', null, 'class', 'Registration', '註冊'], ['2026-09-27', null, 'performance', 'Celebrate Teacher’s Day', '慶祝教師節'],
  ['2026-09-27', null, 'meeting', 'School/Parents Meeting', '全校家長說明會'], ['2026-09-27', null, 'meeting', 'Credit Class Parents/Principal Meeting', '學分班說明會'], ['2026-09-27', null, 'meeting', 'PTA Meeting', '家長大會'],
  ['2026-09-27', null, 'deadline', 'Last Day of Credit Class Registration and Class Change', '學分班報名及轉班截止'],
  ['2026-10-04', null, 'meeting', 'Teachers/Parents Meeting', '各班親師座談會'], ['2026-10-04', null, 'meeting', 'Room Parents Meeting (1)', '班代表會議(1)'],
  ['2026-10-11', null, 'deadline', 'Last Day of Tuition Refund and Class Change', '退費及轉班截止'],
  ['2026-10-18', null, 'meeting', 'Teachers Meeting (2)', '教務研討會議（2）'], ['2026-10-18', null, 'other', 'Fire Drill', '防火演習'],
  ['2026-10-24', null, 'class', 'Credit Class Culture Lesson (1)', '學分班文化課(1)'],
  ['2026-10-25', null, 'exam', 'Mid-term Exam', '上學期期中考'], ['2026-10-25', null, 'meeting', 'Room Parents Meeting (2)', '班代表會議(2)'],
  ['2026-11-01', null, 'contest', 'Class Chinese Character Writing Contest', '班級寫字比賽'], ['2026-11-01', null, 'performance', 'Halloween Activities', '萬聖節活動'],
  ['2026-11-08', null, 'meeting', 'Room Parents Meeting (3)', '班代表會議(3)'],
  ['2026-11-14', null, 'class', 'Credit Class Culture Lesson (2)', '學分班文化課(2)'],
  ['2026-11-15', null, 'performance', 'SDCA Cultural Day', '文化節'], ['2026-11-15', null, 'contest', 'Yearbook Cover Contest Entry Begins', '校刊封面設計比賽開始'],
  ['2026-11-22', '2026-11-29', 'holiday', 'Thanksgiving Break (No School)', '感恩節放假', ''],
  ['2026-12-13', null, 'contest', 'Class Storytelling Contest', '班級說故事比賽'],
  ['2026-12-20', null, 'exam', 'First Semester Final Exam', '上學期期末考'],
  ['2026-12-27', '2027-01-03', 'holiday', 'Winter Break (No School)', '寒假', ''],
  ['2027-01-10', null, 'other', 'Student Store Order Begins (1)', '學生商店訂購開始(1)'],
  ['2027-01-16', null, 'class', 'Credit Class Culture Lesson (3)', '學分班文化課(3)'],
  ['2027-01-17', null, 'deadline', 'Begin accepting applications for 6,9,12-year Study Award', '就讀六,九,十二年的學生申請獎勵開始'], ['2027-01-17', null, 'deadline', 'Student Store Order Deadline (1)', '學生商店訂購截止(1)'], ['2027-01-17', null, 'meeting', 'Room Parents Meeting (4)', '班代表會議(4)'],
  ['2027-01-24', null, 'class', 'Report Card Distribution', '發成績單'], ['2027-01-24', null, 'contest', 'Poetry Recitation Contest Registration Begins', '詩詞朗誦比賽報名開始'], ['2027-01-24', null, 'class', 'Adult Spring Class Starts', '成人春季班開學'],
  ['2027-01-31', null, 'deadline', 'Return Report Card', '交回上學期成績單'], ['2027-01-31', null, 'other', 'Coupon Day (1)', '學生商店(1)'], ['2027-01-31', null, 'performance', 'Chinese New Year Rehearsal', '新年彩排'],
  ['2027-02-07', null, 'performance', 'Lunar New Year Festival, 39th Anniversary', '慶祝農曆新年及三十九週年校慶'],
  ['2027-02-14', null, 'holiday', 'No School', '放假', ''],
  ['2027-02-21', null, 'deadline', 'Last Day of Poetry Recitation Contest Registration', '詩詞朗誦比賽報名截止'], ['2027-02-21', null, 'deadline', '6,9,12-year Study Award Application Deadline', '就讀六,九,十二年的學生申請獎勵截止'],
  ['2027-02-28', null, 'meeting', 'Teachers Meeting (3)', '教務研討會(3)'], ['2027-02-28', null, 'contest', 'Poetry Recitation Order Draw', '詩詞朗誦比賽抽籤'], ['2027-02-28', null, 'contest', 'Essay Contest Entry Begins', '作文比賽開始'],
  ['2027-03-07', null, 'contest', 'Poetry Recitation Contest', '詩詞朗誦比賽'],
  ['2027-03-13', null, 'class', 'Credit Class Culture Lesson (4)', '學分班文化課(4)'],
  ['2027-03-14', null, 'deadline', 'Yearbook Cover Entries Due', '校刊封面設計比賽截止、年刊截稿'], ['2027-03-14', null, 'other', 'Picture Day, 6,9,12-year Study Award Recipients’ Photos', '就讀六,九,十二年的學生照相、拍攝班級師生照'],
  ['2027-03-21', null, 'exam', 'Mid-term Exam', '下學期期中考'],
  ['2027-03-28', null, 'holiday', 'Spring Break (No School)', '春假', ''],
  ['2027-04-04', null, 'contest', 'Class Chinese Character Recognition Contest', '班級認字比賽'], ['2027-04-04', null, 'deadline', 'Essay Contest Entries Due', '作文比賽截止'],
  ['2027-04-11', null, 'exam', 'CSL Class Oral Exam', '雙語班口試'],
  ['2027-04-18', null, 'exam', 'Credit Class Written and Oral Exam', '學分班口試及筆試'], ['2027-04-18', null, 'meeting', 'Room Parents Meeting (5)', '班代表會議(5)'],
  ['2027-04-25', null, 'meeting', 'Introduction Credit Class Meeting', '學分班説明會'], ['2027-04-25', null, 'other', 'Student Store Order Begins (2)', '學生商店訂購開始(2)'],
  ['2027-05-02', null, 'class', 'Pre-Registration (1)', '預註冊（1）'], ['2027-05-02', null, 'meeting', 'PTA Board Election', '家長大會--理事改選'], ['2027-05-02', null, 'performance', 'Volunteer Appreciation Party', '義工表揚同樂會'], ['2027-05-02', null, 'deadline', 'Student Store Order Deadline (2)', '學生商店訂購截止(2)'],
  ['2027-05-09', null, 'holiday', 'Mother’s Day (No School)', '母親節放假', ''],
  ['2027-05-16', null, 'class', 'Pre-Registration (2)', '預註冊（2）'], ['2027-05-16', null, 'meeting', 'Teachers Meeting (4)', '教務研討會（4）'], ['2027-05-16', null, 'exam', 'Final Exam', '下學期期末考'], ['2027-05-16', null, 'other', 'Coupon Day (2)', '學生商店（2）'], ['2027-05-16', null, 'performance', 'Rehearsal', '彩排'],
  ['2027-05-23', null, 'performance', 'Graduation and Award Ceremony', '結業典禮'], ['2027-05-23', null, 'class', 'Pre-Registration (3)', '預註冊（3）'], ['2027-05-23', null, 'performance', 'Teacher Appreciation Dinner', '謝師宴'],
];

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);

export function importCalendar(db) {
  const seen = new Set(); const stats = { added: 0, updated: 0, retired: 0 };
  db.exec('BEGIN');
  try {
    const sel = db.prepare('SELECT id FROM events WHERE slug = ?');
    const ins = db.prepare(`INSERT INTO events (slug, title_en, title_zh, starts_at, ends_at, all_day, location, category, published) VALUES (?,?,?,?,?,1,?,?,1)`);
    const upd = db.prepare(`UPDATE events SET title_en=?, title_zh=?, starts_at=?, ends_at=?, all_day=1, location=?, category=?, published=1, deleted_at=NULL, updated_at=datetime('now') WHERE id=?`);
    for (const [start, end, cat, en, zh, loc = LOC] of D) {
      let slug = `${start}-${slugify(en)}`; seen.add(slug);
      const ex = sel.get(slug);
      if (ex) { upd.run(en, zh, start, end, loc, cat, ex.id); stats.updated++; } else { ins.run(slug, en, zh, start, end, loc, cat); stats.added++; }
    }
    // retire the earlier combined-title events for the same days (they are replaced by the per-activity events above)
    const old = db.prepare("SELECT id, slug FROM events WHERE deleted_at IS NULL AND created_by IS NULL AND date(starts_at) BETWEEN '2026-08-30' AND '2027-05-23'").all();
    const del = db.prepare("UPDATE events SET deleted_at = datetime('now') WHERE id = ?");
    for (const o of old) if (!seen.has(o.slug)) { del.run(o.id); stats.retired++; }
    // keep the site search in step
    try {
      db.exec("DELETE FROM search_index WHERE kind = 'event'");
      const si = db.prepare('INSERT INTO search_index (kind, slug, title_en, title_zh, body_en, body_zh) VALUES (?,?,?,?,?,?)');
      for (const r of db.prepare('SELECT slug, title_en, title_zh, description_en, description_zh FROM events WHERE deleted_at IS NULL AND published = 1').all()) si.run('event', r.slug, r.title_en, r.title_zh, r.description_en, r.description_zh);
    } catch { /* optional */ }
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  return stats;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const db = openDb();
  console.log(importCalendar(db), `activities in the PDF: ${D.length}`);
}
