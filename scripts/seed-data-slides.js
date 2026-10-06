// Phase 8 — seed the home hero carousel `slides` table.
// Phase 9 (R1 item 3) — made fully idempotent: stable key (image+sort),
// delete-then-insert so re-runs NEVER accumulate duplicates
// (the old `ON CONFLICT(id)` upsert silently inserted a new row on
// every run: 32 rows for 8 distinct slides).
//
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
    image: 'anniversary-30th',
    caption_en: 'Celebrating our 30th anniversary',
    caption_zh: '慶祝 30 週年',
    link_url: '/about',
    sort: 1,
  },
  {
    // Enroll slide: generated background (design/generated/enroll-bg.png); the template shows the
    // tagline + Explore Programs / Enroll Now buttons for image 'enroll-bg'.
    image: 'enroll-bg',
    caption_en: 'Enroll now — Mandarin and Chinese culture since 1988',
    caption_zh: '立即報名 — 自 1988 年起教授華語和中華文化',
    link_url: '/enroll',
    sort: 2,
  },
];

export function seedSlides(db, log, skipped) {
  const now = new Date().toISOString();
  // Idempotent: clear the seeded set, then insert exactly SLIDES.
  db.prepare('DELETE FROM slides').run();
  const ins = db.prepare(`
    INSERT INTO slides (image, caption_en, caption_zh, link_url, sort, published, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
  `);
  for (const s of SLIDES) ins.run(s.image, s.caption_en, s.caption_zh, s.link_url, s.sort, now, now);
  log.push(`slides: ${SLIDES.length} rows (idempotent replace)`);
  return SLIDES.length;
}
