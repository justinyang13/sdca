// src/db/session-store.js — express-session store backed by SQLite `sessions` table.
// Implements the Store interface required by express-session:
//   get / set / destroy / touch / clear
//   on / emit / length
//   createSession / generate
// Session objects are minimal: { cookie, user }.

export function createSessionStore(db) {
  const listeners = {};

  const store = {
    name: 'sdca-sqlite',

    on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); return store; },
    emit(ev, ...args) { (listeners[ev] || []).forEach(fn => fn(...args)); return store; },
    length(cb) {
      try {
        const row = db.prepare('SELECT COUNT(*) c FROM sessions').get();
        return cb(null, row.c);
      } catch (err) { return cb(err); }
    },

    // Build a session object for a fresh sid.
    generate(req) {
      const sess = { cookie: { originalMaxAge: null, originalExpires: null, path: '/', httpOnly: true } };
      sess.touch = (cb) => cb && cb();
      sess.reset = (cb) => { sess.cookie = { path: '/', httpOnly: true }; cb && cb(); };
      sess.reload = (cb) => cb && cb();
      sess.save = (cb) => cb && cb();
      sess.destroy = (cb) => { sess.user = undefined; cb && cb(); };
      req.session = sess;
    },

    // Wrap a deserialized session object with the expected cookie shape.
    createSession(req, sess) {
      if (!sess.cookie) sess.cookie = { path: '/', httpOnly: true };
      if (typeof sess.touch !== 'function') sess.touch = (cb) => cb && cb();
      if (typeof sess.reset !== 'function') sess.reset = (cb) => { sess.cookie = { path: '/', httpOnly: true }; cb && cb(); };
      if (typeof sess.reload !== 'function') sess.reload = (cb) => cb && cb();
      if (typeof sess.save !== 'function') sess.save = (cb) => cb && cb();
      if (typeof sess.destroy !== 'function') sess.destroy = (cb) => { sess.user = undefined; cb && cb(); };
      req.session = sess;
    },

    get(sid, cb) {
      try {
        const row = db.prepare('SELECT data FROM sessions WHERE sid = ? AND (expires IS NULL OR expires > ?)').get(sid, Date.now());
        if (!row) return cb(null, null);
        let value;
        try { value = JSON.parse(row.data); } catch { return cb(null, null); }
        return cb(null, value);
      } catch (err) { return cb(err); }
    },

    set(sid, session, cb) {
      try {
        const data = JSON.stringify(session);
        const expires = session && session.cookie && session.cookie.expires
          ? new Date(session.cookie.expires).getTime()
          : null;
        db.prepare(`
          INSERT INTO sessions (sid, data, expires) VALUES (?, ?, ?)
          ON CONFLICT(sid) DO UPDATE SET data = excluded.data, expires = excluded.expires
        `).run(sid, data, expires);
        return cb && cb(null);
      } catch (err) { return cb && cb(err); }
    },

    destroy(sid, cb) {
      try {
        db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
        return cb && cb(null);
      } catch (err) { return cb && cb(err); }
    },

    clear(cb) {
      try { db.prepare('DELETE FROM sessions').run(); return cb && cb(null); }
      catch (err) { return cb && cb(err); }
    },

    touch(sid, session, cb) { return this.set(sid, session, cb); },
  };
  return store;
}
