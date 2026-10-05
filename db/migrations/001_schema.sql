-- 001_schema.sql — full SDCA schema (ARCHITECTURE.md §5)

CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title_en TEXT NOT NULL DEFAULT '',
  title_zh TEXT NOT NULL DEFAULT '',
  body_en TEXT NOT NULL DEFAULT '',
  body_zh TEXT NOT NULL DEFAULT '',
  hero_image TEXT NOT NULL DEFAULT '',
  nav_section TEXT NOT NULL DEFAULT '',
  nav_order INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title_en TEXT NOT NULL DEFAULT '',
  title_zh TEXT NOT NULL DEFAULT '',
  summary_en TEXT NOT NULL DEFAULT '',
  summary_zh TEXT NOT NULL DEFAULT '',
  body_en TEXT NOT NULL DEFAULT '',
  body_zh TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'weekly' CHECK (kind IN ('weekly','news','press','notice')),
  week_no INTEGER,
  school_year TEXT NOT NULL DEFAULT '',
  published_at TEXT,
  pinned INTEGER NOT NULL DEFAULT 0,
  document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  external_url TEXT NOT NULL DEFAULT '',
  published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_announcements_kind ON announcements(kind, published_at);
CREATE INDEX IF NOT EXISTS idx_announcements_pinned ON announcements(pinned DESC, published_at DESC);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title_en TEXT NOT NULL DEFAULT '',
  title_zh TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  description_zh TEXT NOT NULL DEFAULT '',
  starts_at TEXT NOT NULL,
  ends_at TEXT,
  all_day INTEGER NOT NULL DEFAULT 0,
  location TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '',
  published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_starts ON events(starts_at);

CREATE TABLE IF NOT EXISTS programs (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL DEFAULT '',
  name_zh TEXT NOT NULL DEFAULT '',
  grades_en TEXT NOT NULL DEFAULT '',
  grades_zh TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  description_zh TEXT NOT NULL DEFAULT '',
  schedule_en TEXT NOT NULL DEFAULT '',
  schedule_zh TEXT NOT NULL DEFAULT '',
  tuition_en TEXT NOT NULL DEFAULT '',
  tuition_zh TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0,
  image TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS people (
  id INTEGER PRIMARY KEY,
  name_en TEXT NOT NULL DEFAULT '',
  name_zh TEXT NOT NULL DEFAULT '',
  role_en TEXT NOT NULL DEFAULT '',
  role_zh TEXT NOT NULL DEFAULT '',
  "group" TEXT NOT NULL DEFAULT 'staff' CHECK ("group" IN ('board','staff','teacher','volunteer')),
  bio_en TEXT NOT NULL DEFAULT '',
  bio_zh TEXT NOT NULL DEFAULT '',
  photo TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_people_group ON people("group", sort);

CREATE TABLE IF NOT EXISTS sponsors (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  logo TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  tier TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title_en TEXT NOT NULL DEFAULT '',
  title_zh TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  file_path TEXT NOT NULL,
  mime TEXT NOT NULL DEFAULT '',
  bytes INTEGER NOT NULL DEFAULT 0,
  school_year TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);

CREATE TABLE IF NOT EXISTS media_items (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'photo' CHECK (kind IN ('photo','video','album')),
  title_en TEXT NOT NULL DEFAULT '',
  title_zh TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '',
  taken_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_media_kind ON media_items(kind);

CREATE TABLE IF NOT EXISTS contact_messages (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  lang TEXT NOT NULL DEFAULT 'en',
  ip_hash TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','read','archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  lang TEXT NOT NULL DEFAULT 'en',
  confirmed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('admin','editor')),
  last_login TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  sid TEXT NOT NULL UNIQUE,
  data TEXT NOT NULL DEFAULT '',
  expires INTEGER
);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY,
  user TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL DEFAULT '',
  entity TEXT NOT NULL DEFAULT '',
  entity_id TEXT NOT NULL DEFAULT '',
  at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log(at);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value_en TEXT NOT NULL DEFAULT '',
  value_zh TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- FTS5 full-text search over announcements, events and pages (en + zh)
CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
  kind,
  slug,
  title_en,
  title_zh,
  body_en,
  body_zh,
  tokenize = 'unicode61 remove_diacritics 2'
);
