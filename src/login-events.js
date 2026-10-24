// src/login-events.js — record sign-ins for the admin site and the family portal. Never throws: logging must not break sign-in.
const clip = (s, n) => String(s ?? '').slice(0, n);

export function recordLogin(db, { area, event, username = '', userId = null, ip = '', userAgent = '', detail = '' }) {
  try {
    db.prepare('INSERT INTO login_events (area, event, username, user_id, ip, user_agent, detail) VALUES (?,?,?,?,?,?,?)')
      .run(area, event, clip(username, 80), userId, clip(ip, 64), clip(userAgent, 200), clip(detail, 120));
  } catch (e) { console.error('[login-events]', e.message); }
}

/** Numbers and tables for /admin/logins. `since` is a SQLite datetime string or null for all time. */
export function loginSummary(db, { since = null, area = '', event = '', q = '', limit = 200 } = {}) {
  const where = []; const args = [];
  if (since) { where.push('at >= ?'); args.push(since); }
  if (area) { where.push('area = ?'); args.push(area); }
  if (event) { where.push('event = ?'); args.push(event); }
  if (q) { where.push('(username LIKE ? OR ip LIKE ?)'); args.push(`%${q}%`, `%${q}%`); }
  const W = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT * FROM login_events ${W} ORDER BY at DESC, id DESC LIMIT ?`).all(...args, limit);
  const week = db.prepare("SELECT event, COUNT(*) n FROM login_events WHERE at >= datetime('now','-7 days') GROUP BY event").all();
  const wk = (e) => week.find((r) => r.event === e)?.n || 0;
  const ips = db.prepare("SELECT COUNT(DISTINCT ip) n FROM login_events WHERE at >= datetime('now','-7 days') AND ip != ''").get().n;
  const lastSeen = db.prepare(`SELECT area, username, MAX(at) last_login, COUNT(*) logins FROM login_events WHERE event = 'login' AND username != '' GROUP BY area, username ORDER BY last_login DESC LIMIT 50`).all();
  const failedIps = db.prepare(`SELECT ip, COUNT(*) n, MAX(at) last_at FROM login_events WHERE event = 'login_failed' AND at >= datetime('now','-7 days') AND ip != '' GROUP BY ip HAVING n >= 3 ORDER BY n DESC LIMIT 20`).all();
  return { rows, logins7: wk('login'), failed7: wk('login_failed'), ips7: ips, lastSeen, failedIps };
}
