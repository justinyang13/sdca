-- 002_slides.sql — home hero carousel slides (Phase 8)
CREATE TABLE IF NOT EXISTS slides (
  id INTEGER PRIMARY KEY,
  image TEXT NOT NULL DEFAULT '',
  caption_en TEXT NOT NULL DEFAULT '',
  caption_zh TEXT NOT NULL DEFAULT '',
  link_url TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_slides_sort ON slides(sort, published);
