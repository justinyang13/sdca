// src/chat/clock.js — the model has no clock, so the assistant tells it today's date (school time) and turns
// "today / tomorrow / next week / 明天…" into real dates that the content search can match.
import { dayKey } from '../datetime.js';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); return x; };
const long = (d) => `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
const usDate = (d) => `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
const nextSunday = (d) => addDays(d, ((7 - d.getDay()) % 7) || 7);

/** The sentence that goes into the system prompt. */
export function todayLine(now = new Date()) {
  return `Today is ${long(now)}. Tomorrow is ${long(addDays(now, 1))}. Yesterday was ${long(addDays(now, -1))}. The next Sunday is ${long(nextSunday(now))}. Use these for "today", "tomorrow", "yesterday", "this week" and "next week".`;
}

const WORDS = [
  { re: /\btoday\b|\btonight\b|今天|今日|今晚/i, day: (n) => n },
  { re: /\btomorrow\b|明天|明日/i, day: (n) => addDays(n, 1) },
  { re: /\byesterday\b|昨天|昨日/i, day: (n) => addDays(n, -1) },
  { re: /day after tomorrow|後天|后天/i, day: (n) => addDays(n, 2) },
  { re: /next (class|sunday|week|school)|next time|下週|下周|下一次|下個?週日|下堂/i, day: (n) => nextSunday(n) },
  { re: /this (week|weekend|sunday)|本週|本周|這週|這周|週末|周末/i, day: (n) => (n.getDay() === 0 ? n : nextSunday(n)) },
];

/** Extra search words for relative-date questions: the real date (ISO and US forms) and weekday, e.g. "2026-10-25 10/25/2026 Sunday". */
export function dateHints(question, now = new Date()) {
  const out = [];
  for (const w of WORDS) {
    if (!w.re.test(question)) continue;
    const d = w.day(now);
    out.push(dayKey(d), usDate(d), WEEKDAYS[d.getDay()]);
  }
  return out.join(' ');
}
