// Phase 8 — seed the home hero carousel `slides` table.
// Content is derived from the old site's home slider (Smart Slider 3 on the
// old homepage: research/wiki/pages/home.md, research/raw/pages/home.html,
// slider n2-ss-6) mapped to our REAL photos in public/img/manifest.json.
// The old slider showed: 30th anniversary, Pre-K class, Fundamental/Regular
// class, Bilingual class, Credit-Class cultural activity, Chinese Typing,
// 2017-18 graduates, Poetry Recitation contest, Cultural Day, Qigong seminar,
// plus text slides (remote learning, online registration). We preserve the
// photo slides as an 8-slide bilingual carousel (no invented facts).

const SLIDES = [
  {
    image: 'classroom-bilingual',
    caption_en: 'SDCA Bilingual Class — real classroom learning every Sunday',
    caption_zh: 'SDCA 雙語班 — 每個週日真實的課堂學習',
    link_url: '/programs/classes',
    sort: 1,
  },
  {
    image: 'preschool-class',
    caption_en: 'Pre-K Program — our youngest learners',
    caption_zh: '學前班 — 我們最年幼的學童',
    link_url: '/programs/classes',
    sort: 2,
  },
  {
    image: 'regular-class',
    caption_en: 'Fundamental & Regular classes, Grades 1–6',
    caption_zh: '基礎班與普通班，1–6 年級',
    link_url: '/programs/classes',
    sort: 3,
  },
  {
    image: 'graduation-2023',
    caption_en: 'Class of 2023 — graduation ceremony',
    caption_zh: '2023 屆畢業典禮',
    link_url: '/media',
    sort: 4,
  },
  {
    image: 'poetry-award',
    caption_en: 'Poetry Recitation Contest winners',
    caption_zh: '朗誦比賽得獎者',
    link_url: '/media',
    sort: 5,
  },
  {
    image: 'cultural-day',
    caption_en: 'Cultural Day — students show off what they learn',
    caption_zh: '文化日 — 學生展示所學',
    link_url: '/media',
    sort: 6,
  },
  {
    image: 'stage-performance',
    caption_en: 'Spring ceremony performances',
    caption_zh: '春季典禮表演',
    link_url: '/media',
    sort: 7,
  },
  {
    image: 'anniversary-30th',
    caption_en: 'Celebrating our 30th anniversary',
    caption_zh: '慶祝 30 週年',
    link_url: '/about',
    sort: 8,
  },
];

export function seedSlides(db, log, skipped) {
  const now = new Date().toISOString();
  let upsert = db.prepare(`
    INSERT INTO slides (image, caption_en, caption_zh, link_url, sort, published, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      image=excluded.image,
      caption_en=excluded.caption_en,
      caption_zh=excluded.caption_zh,
      link_url=excluded.link_url,
      sort=excluded.sort,
      updated_at=excluded.updated_at
  `);
  let i = 0;
  for (const s of SLIDES) {
    i += 1;
    upsert.run(s.image, s.caption_en, s.caption_zh, s.link_url, s.sort, now, now);
  }
  log.push(`slides: ${SLIDES.length} rows`);
  return SLIDES.length;
}
