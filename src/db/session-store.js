// src/db/session-store.js — express-session store backed by the SQLite `sessions` table.
// A real express-session Store subclass, so req.session.save() / regenerate() / destroy() behave normally.
import session from 'express-session';

const expiresOf = (sess) => (sess && sess.cookie && sess.cookie.expires ? new Date(sess.cookie.expires).getTime() : Date.now() + 7 * 24 * 3600 * 1000);

class SqliteStore extends session.Store {
  constructor(db) {
    super();
    this.db = db;
    this.name = 'sdca-sqlite';
    this.writes = 0;
  }

  get(sid, cb) {
    try {
      const row = this.db.prepare('SELECT data FROM sessions WHERE sid = ? AND (expires IS NULL OR expires > ?)').get(sid, Date.now());
      if (!row) return cb(null, null);
      try { return cb(null, JSON.parse(row.data)); } catch { return cb(null, null); }
    } catch (err) { return cb(err); }
  }

  set(sid, sess, cb) {
    try {
      this.db.prepare(`INSERT INTO sessions (sid, data, expires) VALUES (?, ?, ?)
        ON CONFLICT(sid) DO UPDATE SET data = excluded.data, expires = excluded.expires`).run(sid, JSON.stringify(sess), expiresOf(sess));
      // sweep expired sessions on every 100th write (a counter, not a dice roll, so behaviour is predictable)
      if (++this.writes % 100 === 0) this.db.prepare('DELETE FROM sessions WHERE expires IS NOT NULL AND expires < ?').run(Date.now());
      return cb && cb(null);
    } catch (err) { return cb && cb(err); }
  }

  touch(sid, sess, cb) {
    try {
      this.db.prepare('UPDATE sessions SET expires = ? WHERE sid = ?').run(expiresOf(sess), sid);
      return cb && cb(null);
    } catch (err) { return cb && cb(err); }
  }

  destroy(sid, cb) {
    try { this.db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid); return cb && cb(null); } catch (err) { return cb && cb(err); }
  }

  clear(cb) {
    try { this.db.prepare('DELETE FROM sessions').run(); return cb && cb(null); } catch (err) { return cb && cb(err); }
  }

  length(cb) {
    try { return cb(null, this.db.prepare('SELECT COUNT(*) AS c FROM sessions').get().c); } catch (err) { return cb(err); }
  }
}

export function createSessionStore(db) { return new SqliteStore(db); }
