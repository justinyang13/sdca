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
  for (const ev of events) {
    const start = new Date(ev.starts_at);
    let end = ev.ends_at ? new Date(ev.ends_at) : null;
    const allDay = !ev.ends_at; // all-day or date-only
    if (allDay) {
      // For all-day events, DTEND is EXCLUSIVE: next day
      end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    }
    const dtstamp = toIcsDateUTC(new Date());
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${ev.uid || ev.slug || Date.now()}@sdca`);
    lines.push(`DTSTAMP:${dtstamp}`);
    if (allDay) {
      const ds = start.toISOString().slice(0, 10).replace(/-/g, '');
      const de = end.toISOString().slice(0, 10).replace(/-/g, '');
      lines.push(`DTSTART;VALUE=DATE:${ds}`);
      lines.push(`DTEND;VALUE=DATE:${de}`);
    } else {
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
