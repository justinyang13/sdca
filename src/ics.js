// src/ics.js — minimal RFC 5545 iCal export for SDCA events.
// No external deps; we build a VEVENT per event and fold long lines.

function toIcsDateUTC(d) {
  // d: Date
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function foldLine(line) {
  // RFC 5545 §3.1: lines SHOULD NOT exceed 75 octets; fold with CRLF + space.
  if (Buffer.byteLength(line, 'utf8') <= 75) return line;
  const out = [];
  let cur = '';
  let limit = 75;
  for (const ch of line) {
    const b = Buffer.byteLength(ch, 'utf8');
    if (Buffer.byteLength(cur, 'utf8') + b > limit) {
      out.push(cur);
      cur = ' ' + ch;
      limit = 75;
    } else {
      cur += ch;
    }
  }
  if (cur) out.push(cur);
  return out.join('\r\n');
}

function icsEscape(s) {
  return String(s || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * events: array of { title, description?, location?, starts_at (ISO or 'YYYY-MM-DD'), ends_at? }
 */
export function icsForEvents(events, { calendarName = 'SDCA events' } = {}) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SDCA//Website//EN',
    `CALSCALE:GREGORIAN`,
    `X-WR-CALNAME:${icsEscape(calendarName)}`,
  ];
  const DATE = /^(\d{4})-(\d{2})-(\d{2})/; const DT = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/;
  const ymd = (y, m, d) => `${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`;
  for (const ev of events) {
    // all-day when flagged or when there is no clock time; times are school wall-clock time (the process runs in it)
    const sm = DT.exec(String(ev.starts_at || ''));
    const allDay = !!ev.all_day || !sm;
    const dtstamp = toIcsDateUTC(new Date());
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${ev.uid || ev.slug || Date.now()}@sdca`);
    lines.push(`DTSTAMP:${dtstamp}`);
    if (allDay) {
      const a = DATE.exec(String(ev.starts_at || '')); const b = DATE.exec(String(ev.ends_at || '')) || a;
      const last = new Date(Date.UTC(+b[1], +b[2] - 1, +b[3] + 1));          // DTEND is exclusive: the day after the last day
      lines.push(`DTSTART;VALUE=DATE:${ymd(a[1], a[2], a[3])}`);
      lines.push(`DTEND;VALUE=DATE:${ymd(last.getUTCFullYear(), last.getUTCMonth() + 1, last.getUTCDate())}`);
    } else {
      const at = (m, str) => (/Z$/.test(str) ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])) : new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));   // explicit "Z" = a UTC instant
      const start = at(sm, String(ev.starts_at));
      const em = DT.exec(String(ev.ends_at || ''));
      const end = em ? at(em, String(ev.ends_at)) : new Date(start.getTime() + 60 * 60 * 1000);
      lines.push(`DTSTART:${toIcsDateUTC(start)}`);
      lines.push(`DTEND:${toIcsDateUTC(end)}`);
    }
    lines.push(`SUMMARY:${icsEscape(ev.title)}`);
    if (ev.description) lines.push(`DESCRIPTION:${icsEscape(ev.description)}`);
    if (ev.location) lines.push(`LOCATION:${icsEscape(ev.location)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
