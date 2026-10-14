// tests/datetime.test.js — one stored format per kind of value, one display style per place (src/datetime.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const dt = await import('../src/datetime.js');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

test('the process runs in the school time zone (not the host\'s)', () => {
  assert.equal(process.env.TZ, dt.SCHOOL_TZ);
  assert.equal(dt.SCHOOL_TZ, 'America/Los_Angeles');
});

test('moments are stored as UTC "YYYY-MM-DD HH:MM:SS"; "today" is the school\'s date, not the UTC date', () => {
  assert.equal(dt.nowUtc(new Date('2026-10-13T21:30:05Z')), '2026-10-13 21:30:05');
  assert.match(dt.nowUtc(), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  assert.equal(dt.dayKey(new Date('2026-10-14T01:30:00Z')), '2026-10-13', '6:30 pm in San Diego is still Oct 13 (UTC says Oct 14)');
  assert.equal(dt.dayKey(new Date('2026-10-13T08:00:00Z')), '2026-10-13');
  assert.match(dt.todayLocal(), /^\d{4}-\d{2}-\d{2}$/);
});

test('UTC ↔ school time round trip, summer (PDT) and winter (PST)', () => {
  assert.deepEqual(dt.utcToLocalParts('2026-10-13 21:30:00'), { date: '2026-10-13', time: '14:30' });
  assert.deepEqual(dt.utcToLocalParts('2026-12-15 20:00:00'), { date: '2026-12-15', time: '12:00' });
  assert.deepEqual(dt.utcToLocalParts('2026-10-14 03:15:00'), { date: '2026-10-13', time: '20:15' }, 'the local date can differ from the UTC date');
  assert.deepEqual(dt.utcToLocalParts('2026-10-13T21:30:00.000Z'), { date: '2026-10-13', time: '14:30' }, 'legacy ISO values still read');
  assert.equal(dt.localToUtc('2026-10-13', '14:30'), '2026-10-13 21:30:00');
  assert.equal(dt.localToUtc('2026-12-15', '12:00'), '2026-12-15 20:00:00');
  assert.equal(dt.localToUtc('2026-10-13', ''), '2026-10-13 07:00:00', 'no time = local midnight');
  for (const [d, t] of [['2026-03-08', '09:00'], ['2026-11-01', '12:30'], ['2027-01-02', '23:59']]) {
    const back = dt.utcToLocalParts(dt.localToUtc(d, t)); assert.deepEqual(back, { date: d, time: t }, `${d} ${t}`);
  }
  assert.equal(dt.localToUtc('', '10:00'), null); assert.equal(dt.localToUtc('nonsense'), null);
  assert.deepEqual(dt.utcToLocalParts(''), { date: '', time: '' });
});

test('portal display: days stay days, moments are converted, event times are shown as typed', () => {
  assert.equal(dt.fmtDate('2026-10-13'), '2026-10-13'); assert.equal(dt.fmtDate('2026-10-13 21:30:00'), '2026-10-13'); assert.equal(dt.fmtDate(''), ''); assert.equal(dt.fmtDate(null), '');
  assert.equal(dt.fmtDateTime('2026-10-13 21:30:00'), '2026-10-13 14:30');
  assert.equal(dt.fmtDateTime('2026-10-13'), '2026-10-13', 'a plain day is never shifted by the time zone');
  assert.equal(dt.fmtDateTime(''), '');
  assert.equal(dt.fmtLocalDateTime('2026-11-14 10:30'), '2026-11-14 10:30'); assert.equal(dt.fmtLocalDateTime('2026-11-14'), '2026-11-14');
});

test('public display: long dates and 12-hour times in both languages', () => {
  assert.equal(dt.fmtLong('2026-10-05', 'en'), 'Oct 5, 2026'); assert.equal(dt.fmtLong('2026-10-05', 'zh'), '2026年10月5日');
  assert.equal(dt.fmtLong('2018', 'en'), '2018', 'archive items that only know the year'); assert.equal(dt.fmtLong('', 'en'), ''); assert.equal(dt.fmtLong('2026-10-05 14:30', 'en'), 'Oct 5, 2026');
  assert.equal(dt.fmtTime('14:30', 'en'), '2:30 PM'); assert.equal(dt.fmtTime('00:05', 'en'), '12:05 AM'); assert.equal(dt.fmtTime('12:00', 'en'), '12:00 PM');
  assert.equal(dt.fmtTime('14:30', 'zh'), '下午 2:30'); assert.equal(dt.fmtTime('09:00', 'zh'), '上午 9:00');
  assert.equal(dt.fmtEventWhen('2026-11-14 10:30', false, 'en'), 'Nov 14, 2026 · 10:30 AM');
  assert.equal(dt.fmtEventWhen('2026-11-14', true, 'zh'), '2026年11月14日'); assert.equal(dt.fmtEventWhen('2026-11-14 10:30', true, 'en'), 'Nov 14, 2026', 'all-day hides the time');
  assert.equal(dt.fmtMonthYear(new Date(2026, 9, 1), 'en'), 'October 2026'); assert.equal(dt.fmtMonthYear(new Date(2026, 9, 1), 'zh'), '2026 年 10 月');
});

test('form fields: "datetime" (moment) is typed in school time and stored UTC; "localdt" (events) is stored as typed', async () => {
  const { coerce, fromBody } = await import('../src/portal/crud.js');
  assert.equal(coerce({ type: 'datetime' }, '2026-10-13T14:30'), '2026-10-13 21:30:00');
  assert.equal(coerce({ type: 'datetime' }, ''), null);
  assert.equal(coerce({ type: 'localdt' }, '2026-11-14T10:30'), '2026-11-14 10:30');
  const ent = { fields: [{ name: 'when_at', type: 'datetime' }, { name: 'starts_at', type: 'localdt' }] };
  assert.deepEqual(fromBody(ent, { when_at_date: '2026-10-13', when_at_time: '14:30', starts_at_date: '2026-11-14', starts_at_time: '10:30' }), { when_at: '2026-10-13 21:30:00', starts_at: '2026-11-14 10:30' });
  assert.deepEqual(fromBody(ent, { when_at_date: '', when_at_time: '', starts_at_date: '2026-11-14', starts_at_time: '' }), { when_at: null, starts_at: '2026-11-14' });
});

test('no code writes ISO "T…Z" timestamps or the UTC date as "today" any more', () => {
  const offenders = [];
  const walk = (dir) => { for (const f of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, f.name); if (f.isDirectory()) walk(p); else if (p.endsWith('.js')) {
    const src = fs.readFileSync(p, 'utf8').split('\n');
    src.forEach((line, i) => { if (/toISOString\(\)\.slice\(0, ?10\)/.test(line) && !/T00:00:00Z|setUTCDate/.test(src.slice(Math.max(0, i - 1), i + 2).join(' ')) && !p.endsWith('datetime.js')) offenders.push(`${path.relative(ROOT, p)}:${i + 1}`); }); } } };
  walk(path.join(ROOT, 'src'));
  assert.deepEqual(offenders, [], 'use todayLocal() / dayKey() from src/datetime.js');
});

test('iCal export: multi-day all-day events end the day after their last day; timed events are real UTC instants; no end → one hour', async () => {
  const { icsForEvents } = await import('../src/ics.js');
  const ics = icsForEvents([
    { title: 'Break', slug: 'b', starts_at: '2026-11-22', ends_at: '2026-11-29', all_day: true },
    { title: 'One day', slug: 'o', starts_at: '2026-10-25', all_day: true },
    { title: 'Picnic', slug: 'p', starts_at: '2026-11-14 10:30', ends_at: '2026-11-14 12:00', all_day: false },
    { title: 'Meeting', slug: 'm', starts_at: '2026-11-15 09:00', all_day: false },
  ]);
  assert.match(ics, /DTSTART;VALUE=DATE:20261122\r\nDTEND;VALUE=DATE:20261130/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261025\r\nDTEND;VALUE=DATE:20261026/);
  assert.match(ics, /DTSTART:20261114T183000Z\r\nDTEND:20261114T200000Z/, '10:30 PST is 18:30 UTC');
  assert.match(ics, /DTSTART:20261115T170000Z\r\nDTEND:20261115T180000Z/);
});
