// Phase 3 — events table
// Source: research/wiki/pages/home.md § 2 "Upcoming Event" table (6 events, 2026)
// All all-day, at La Jolla Country Day School.

const EVENTS = [
  {
    slug: '2026-10-04-parents-meeting',
    title_en: 'Teachers/Parents Meeting, Room Parents Meeting (1)',
    title_zh: '各班親師座談會、班代表會議(1)',
    description_en: 'Class teachers\' and parents\' meeting, plus the first Room Parents Meeting.',
    description_zh: '各班親師座談會，以及第一次班代表會議。',
    starts_at: '2026-10-04', ends_at: null, all_day: 1,
    location: 'La Jolla Country Day School', category: 'meeting', image: '',
  },
  {
    slug: '2026-10-11-refund-deadline',
    title_en: 'Last Day of Tuition Refund and Class Change',
    title_zh: '退費及轉班截止',
    description_en: 'Final day to request a tuition refund or change classes.',
    description_zh: '退費及轉班的最後截止日。',
    starts_at: '2026-10-11', ends_at: null, all_day: 1,
    location: 'La Jolla Country Day School', category: 'deadline', image: '',
  },
  {
    slug: '2026-10-18-teachers-meeting-fire-drill',
    title_en: 'Teachers Meeting (2), Fire Drill',
    title_zh: '教務研討會議（2）、防火演習',
    description_en: 'Second teachers\' meeting and a fire safety drill.',
    description_zh: '第二次教務研討會議及防火演習。',
    starts_at: '2026-10-18', ends_at: null, all_day: 1,
    location: 'La Jolla Country Day School', category: 'meeting', image: '',
  },
  {
    slug: '2026-10-24-credit-culture',
    title_en: 'Credit Class Culture Lesson (1)',
    title_zh: '學分班文化課(1)',
    description_en: 'First culture lesson for the Credit Class.',
    description_zh: '學分班第一次文化課。',
    starts_at: '2026-10-24', ends_at: null, all_day: 1,
    location: 'La Jolla Country Day School', category: 'class', image: '',
  },
  {
    slug: '2026-10-25-midterm-exam',
    title_en: 'Mid-term Exam',
    title_zh: '上學期期中考',
    description_en: 'First-semester mid-term examination for all classes.',
    description_zh: '上學期所有班級的期中考試。',
    starts_at: '2026-10-25', ends_at: null, all_day: 1,
    location: 'La Jolla Country Day School', category: 'exam', image: '',
  },
  {
    slug: '2026-11-01-writing-halloween-parents',
    title_en: 'Class Chinese Character Writing Contest, Halloween Activities, Room Parents Meeting (2)',
    title_zh: '班級寫字比賽、萬聖節活動、班代表會議(2)',
    description_en: 'Chinese character writing contest, Halloween celebration, and second Room Parents Meeting.',
    description_zh: '班級寫字比賽、萬聖節慶祝活動，以及第二次班代表會議。',
    starts_at: '2026-11-01', ends_at: null, all_day: 1,
    location: 'La Jolla Country Day School', category: 'contest', image: '',
  },
];

export function seedEvents(db, log, skipped) {
  let count = 0;
  for (const e of EVENTS) {
    db.prepare(`
      INSERT INTO events (slug, title_en, title_zh, description_en, description_zh,
                          starts_at, ends_at, all_day, location, category, image, published)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      ON CONFLICT(slug) DO UPDATE SET
        title_en=excluded.title_en, title_zh=excluded.title_zh,
        description_en=excluded.description_en, description_zh=excluded.description_zh,
        starts_at=excluded.starts_at, ends_at=excluded.ends_at, all_day=excluded.all_day,
        location=excluded.location, category=excluded.category, image=excluded.image,
        updated_at=datetime('now')
    `).run(e.slug, e.title_en, e.title_zh, e.description_en, e.description_zh,
           e.starts_at, e.ends_at, e.all_day, e.location, e.category, e.image);
    count++;
  }
  log.push(`events: ${count} rows`);
  return count;
}
