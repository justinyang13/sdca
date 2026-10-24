-- 019: one row per sign-in attempt / sign-out, for both areas (admin site and family portal). Read at /admin/logins (admins only).
CREATE TABLE login_events (
  id INTEGER PRIMARY KEY,
  at TEXT NOT NULL DEFAULT (datetime('now')),
  area TEXT NOT NULL CHECK (area IN ('admin','portal')),
  event TEXT NOT NULL CHECK (event IN ('login','login_failed','logout')),
  username TEXT NOT NULL DEFAULT '',
  user_id INTEGER,
  ip TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_login_events_at ON login_events (at);
CREATE INDEX idx_login_events_user ON login_events (username, at);
CREATE INDEX idx_login_events_ip ON login_events (ip, at);

-- earlier admin sign-ins were only noted in audit_log (no IP); keep them in the history
INSERT INTO login_events (at, area, event, username, detail)
SELECT at, 'admin', 'login', user, 'imported from audit log (no IP recorded)' FROM audit_log WHERE action = 'login';
