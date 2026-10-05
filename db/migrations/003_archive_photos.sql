-- 003 — archive_photos: uncurated old-site photos, published on /media/archive
CREATE TABLE IF NOT EXISTS archive_photos (
  id INTEGER PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,           -- /img/archive/full/<file>.<ext>
  thumb TEXT NOT NULL,                 -- /img/archive/<file>-480.jpg (or .png for gif-derived)
  group_en TEXT NOT NULL DEFAULT '',   -- e.g. 'Cultural Day', '2017–2019'
  group_zh TEXT NOT NULL DEFAULT '',
  caption_en TEXT NOT NULL DEFAULT '',
  caption_zh TEXT NOT NULL DEFAULT '',
  taken_year INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_archive_photos_group ON archive_photos(group_en, sort, id);
CREATE INDEX IF NOT EXISTS idx_archive_photos_published ON archive_photos(published, sort, id);
