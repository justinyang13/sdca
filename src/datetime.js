// src/datetime.js — the one place that knows how dates and times are stored and shown.
//
//   Stored (see ARCHITECTURE.md → Dates and times)
//     • a moment something happened (created_at, paid_at, last_login_at …)   'YYYY-MM-DD HH:MM:SS' in UTC  (SQLite's datetime('now'))
//     • a calendar day (birthday, transaction_date, deadlines, school-year dates, all-day events)   'YYYY-MM-DD', no time zone
//     • an event's clock time (events.starts_at / ends_at when not all-day)   'YYYY-MM-DD HH:MM' in school time ("wall clock")
//   Shown
//     • portal / admin tables and forms:  2026-10-13   and   2026-10-13 14:30   (UTC moments converted to school time)
//     • public pages:  Oct 13, 2026 / 2026年10月13日   and   2:30 PM / 下午 2:30
//
// The process time zone is the school's (config.js sets TZ), so the local Date getters below are school time.
import { SCHOOL_TZ } from './config.js';

export { SCHOOL_TZ };
const pad = (n) => String(n).padStart(2, '0');
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_EN_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DT_RE = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z)?$/;

/** Date → 'YYYY-MM-DD HH:MM:SS' in UTC (the stored format for moments). */
export function nowUtc(date = new Date()) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}
/** Date → 'YYYY-MM-DD' in school time (the stored format for calendar days). */
export function dayKey(date = new Date()) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
/** Today's date at the school. */
export const todayLocal = () => dayKey(new Date());

/** A stored UTC moment ('YYYY-MM-DD HH:MM[:SS]' — legacy ISO 'T…Z' accepted) → Date, or null. */
export function parseUtc(v) {
  const m = DT_RE.exec(String(v || '').trim()); if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)));
}
/** A stored calendar day → Date at local midnight (never shifted by UTC), or null. */
export function parseDay(v) {
  const m = DATE_RE.exec(String(v || '').slice(0, 10)); if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3]);
}
/** UTC moment → { date:'YYYY-MM-DD', time:'HH:MM' } in school time (empty strings when unparsable). */
export function utcToLocalParts(v) {
  const d = parseUtc(v); if (!d) return { date: '', time: '' };
  return { date: dayKey(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}
/** Form input in school time ('YYYY-MM-DD' + optional 'HH:MM') → stored UTC 'YYYY-MM-DD HH:MM:SS' (null when empty / invalid). */
export function localToUtc(date, time = '') {
  const m = DATE_RE.exec(String(date || '').trim()); if (!m) return null;
  const t = /^(\d{2}):(\d{2})/.exec(String(time || '').trim()) || [null, '00', '00'];
  return nowUtc(new Date(+m[1], +m[2] - 1, +m[3], +t[1], +t[2], 0));
}

/** '2026-10-13' (any value that starts with a day) or ''. */
export const fmtDate = (v) => (DATE_RE.test(String(v || '').slice(0, 10)) ? String(v).slice(0, 10) : (v ? String(v) : ''));
/** UTC moment → '2026-10-13 14:30' in school time; a plain day stays '2026-10-13'. */
export function fmtDateTime(v) {
  if (!v) return '';
  if (DATE_RE.test(String(v).trim())) return String(v).trim();
  const p = utcToLocalParts(v); return p.date ? `${p.date} ${p.time}` : String(v);
}
/** An already-local value (events) → '2026-10-13 14:30' / '2026-10-13'. */
export function fmtLocalDateTime(v) {
  const m = DT_RE.exec(String(v || '').trim());
  return m ? `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}` : fmtDate(v);
}

/** Public style: 'Oct 13, 2026' / '2026年10月13日'. Accepts a day, a local datetime or a Date; a bare year stays a year. */
export function fmtLong(v, lang = 'en') {
  if (v instanceof Date) v = dayKey(v);
  if (/^\d{4}$/.test(String(v || ''))) return String(v);
  const d = parseDay(v); if (!d) return '';
  return lang === 'zh' ? `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日` : `${MONTHS_EN[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
/** 'HH:MM' (24 h) → '2:30 PM' / '下午 2:30'. */
export function fmtTime(hhmm, lang = 'en') {
  const m = /^(\d{2}):(\d{2})/.exec(String(hhmm || '')); if (!m) return '';
  const h = +m[1]; const h12 = h % 12 || 12;
  return lang === 'zh' ? `${h < 12 ? '上午' : '下午'} ${h12}:${m[2]}` : `${h12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}
/** Event start: 'Oct 13, 2026' for all-day / date-only, else 'Oct 13, 2026 · 2:30 PM'. */
export function fmtEventWhen(startsAt, allDay, lang = 'en') {
  const m = DT_RE.exec(String(startsAt || ''));
  if (allDay || !m) return fmtLong(startsAt, lang);
  return `${fmtLong(`${m[1]}-${m[2]}-${m[3]}`, lang)} · ${fmtTime(`${m[4]}:${m[5]}`, lang)}`;
}
/** 'October 2026' / '2026 年 10 月' for a Date (calendar headings). */
export function fmtMonthYear(date, lang = 'en') {
  return lang === 'zh' ? `${date.getFullYear()} 年 ${date.getMonth() + 1} 月` : `${MONTHS_EN_LONG[date.getMonth()]} ${date.getFullYear()}`;
}
