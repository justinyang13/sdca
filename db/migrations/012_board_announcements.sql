-- 012_board_announcements.sql — board positions & members (who is on the board, and which portal role that gives) and
-- class announcements (teachers / room parents / staff post to a class; its parents and students read).

CREATE TABLE IF NOT EXISTS board_positions (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,                       -- same wording as the public Board of Directors page (people.role_en)
  name_zh TEXT NOT NULL DEFAULT '',
  role_code TEXT NOT NULL DEFAULT '',          -- the portal role a holder of this position receives
  sort INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS board_members (
  id INTEGER PRIMARY KEY,
  person_id INTEGER NOT NULL REFERENCES persons(id),
  board_position_id INTEGER NOT NULL REFERENCES board_positions(id),
  school_year_id INTEGER REFERENCES school_years(id),
  start_date TEXT,                              -- calendar days; the membership counts today when start <= today <= end (blank = open)
  end_date TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_board_members_person   ON board_members(person_id);
CREATE INDEX IF NOT EXISTS idx_board_members_position ON board_members(board_position_id);
CREATE INDEX IF NOT EXISTS idx_board_members_year     ON board_members(school_year_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_board_member_term ON board_members(board_position_id, person_id, IFNULL(school_year_id, 0)) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS class_announcements (
  id INTEGER PRIMARY KEY,
  school_class_id INTEGER NOT NULL REFERENCES school_classes(id),
  title_en TEXT NOT NULL DEFAULT '',
  title_zh TEXT NOT NULL DEFAULT '',
  body_en TEXT NOT NULL DEFAULT '',
  body_zh TEXT NOT NULL DEFAULT '',
  pinned INTEGER NOT NULL DEFAULT 0,
  posted_by_user_id INTEGER REFERENCES users(id),
  emailed_at TEXT,                              -- when parents were e-mailed (outbox) about it
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  deleted_at TEXT,
  CHECK (title_en <> '' OR title_zh <> '')
);
CREATE INDEX IF NOT EXISTS idx_class_announcements_class ON class_announcements(school_class_id, created_at);
CREATE INDEX IF NOT EXISTS idx_class_announcements_user  ON class_announcements(posted_by_user_id);
