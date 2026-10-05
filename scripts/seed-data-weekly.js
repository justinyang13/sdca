// Phase 3 — weekly announcements (kind='weekly')
// Source: research/wiki/pages/weekly-announcements.md (full table)
// Each week-pair (EN+ZH) becomes ONE announcement row with both languages + both PDFs.
// The 2018-19 W07 pair is seeded with a note (spam comments are NOT imported).
function findDocId(db, slug) {
  return db.prepare('SELECT id FROM documents WHERE slug = ?').get(slug)?.id ?? null;
}

const WEEKS = [
  // [weekNo, schoolYear, enDocSlug, zhDocSlug, publishedAt, pinned]
  [7,  '2018-19', 'weekly-2018-19-w07-en', 'weekly-2018-19-w07-zh', '2018-10-19', 0],
  [1,  '2025-26', 'weekly-w01-en', 'weekly-w01-zh', '2026-09-14', 0],
  [2,  '2025-26', 'weekly-w02-en', 'weekly-w02-zh', '2026-09-21', 0],
  [3,  '2025-26', 'weekly-w03-en', 'weekly-w03-zh', '2026-09-28', 0],
  [4,  '2025-26', 'weekly-w04-en', 'weekly-w04-zh', '2026-10-05', 0],
  [12, '2024-25', 'weekly-w12-en', 'weekly-w12-zh', '2025-12-21', 0],
  [13, '2024-25', 'weekly-w13-en', 'weekly-w13-zh', '2025-12-28', 0],
  [14, '2024-25', 'weekly-w14-en', 'weekly-w14-zh', '2026-01-04', 0],
  [15, '2024-25', 'weekly-w15-en', 'weekly-w15-zh', '2026-01-11', 0],
  [16, '2024-25', 'weekly-w16-en', 'weekly-w16-zh', '2026-01-18', 0],
  [17, '2024-25', 'weekly-w17-en', 'weekly-w17-zh', '2026-01-25', 0],
  [18, '2024-25', 'weekly-w18-en', 'weekly-w18-zh', '2026-02-01', 0],
  [19, '2024-25', 'weekly-w19-en', 'weekly-w19-zh', '2026-02-08', 0],
  [20, '2024-25', 'weekly-w20-en', 'weekly-w20-zh', '2026-02-15', 0],
  [21, '2024-25', 'weekly-w21-en', 'weekly-w21-zh', '2026-02-22', 0],
  [22, '2024-25', 'weekly-w22-en', 'weekly-w22-zh', '2026-03-01', 0],
  [23, '2024-25', 'weekly-w23-en', 'weekly-w23-zh', '2026-03-08', 0],
  [24, '2024-25', 'weekly-w24-en', 'weekly-w24-zh', '2026-03-15', 0],
  [25, '2024-25', 'weekly-w25-en', 'weekly-w25-zh', '2026-03-22', 0],
  [26, '2024-25', 'weekly-w26-en', 'weekly-w26-zh', '2026-03-29', 0],
  [27, '2024-25', 'weekly-w27-en', 'weekly-w27-zh', '2026-04-05', 0],
  [28, '2024-25', 'weekly-w28-en', 'weekly-w28-zh', '2026-04-12', 0],
  [29, '2024-25', 'weekly-w29-en', 'weekly-w29-zh', '2026-04-19', 0],
];

export function seedWeekly(db, log, skipped) {
  let count = 0;
  for (const [weekNo, year, enDoc, zhDoc, pub, pinned] of WEEKS) {
    const slug = `weekly-w${String(weekNo).padStart(2, '0')}`;
    const docEn = findDocId(db, enDoc);
    const docZh = findDocId(db, zhDoc);

    let titleEn, titleZh, bodyEn, bodyZh;
    if (year === '2018-19') {
      titleEn = 'Weekly Announcement — Week 7, 2018-19';
      titleZh = '家庭聯絡事項 第7週 2018-19學年';
      bodyEn = 'Note: the 2018-19 Week 7 posts on the old site contained thousands of spam comments. Only the attached PDFs are preserved here; comment data was not imported.';
      bodyZh = '注意：舊站2018-19學年第7週的貼文含有大量垃圾留言。本站僅保留附帶PDF檔案，未匯入留言資料。';
    } else {
      titleEn = `Weekly Announcement — Week ${weekNo}`;
      titleZh = `家庭聯絡事項 第${weekNo}週`;
      bodyEn = `Download the weekly parent announcement PDF for week ${weekNo} (English and Chinese versions attached).`;
      bodyZh = `下載第${weekNo}週的家庭聯絡事項PDF（英文及中文版本已附於下方）。`;
    }

    // Use the EN doc as primary document_id (first PDF shown)
    const primaryDoc = docEn || docZh;

    db.prepare(`
      INSERT INTO announcements (slug, title_en, title_zh, summary_en, summary_zh, body_en, body_zh,
                                  kind, week_no, school_year, published_at, pinned, document_id, published)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'weekly', ?, ?, ?, ?, ?, 1)
      ON CONFLICT(slug) DO UPDATE SET
        title_en=excluded.title_en, title_zh=excluded.title_zh,
        summary_en=excluded.summary_en, summary_zh=excluded.summary_zh,
        body_en=excluded.body_en, body_zh=excluded.body_zh,
        week_no=excluded.week_no, school_year=excluded.school_year,
        published_at=excluded.published_at, pinned=excluded.pinned,
        document_id=excluded.document_id, updated_at=datetime('now')
    `).run(slug, titleEn, titleZh, '', '', bodyEn, bodyZh,
           weekNo, year, pub, pinned, primaryDoc);
    count++;
  }
  log.push(`weekly announcements: ${count} rows`);
  return count;
}
