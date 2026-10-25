-- 021: AI features — chat questions the bot could not answer and "send this to the office" hand-offs.
CREATE TABLE IF NOT EXISTS chat_inbox (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('unanswered','handoff')),
  question TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'en',
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','done')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  handled_at TEXT,
  handled_by INTEGER REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_chat_inbox_status ON chat_inbox(status, kind, created_at);
