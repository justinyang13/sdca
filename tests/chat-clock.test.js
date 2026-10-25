// tests/chat-clock.test.js — the assistant knows today's date and understands "tomorrow", "next class", 明天…
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todayLine, dateHints } from '../src/chat/clock.js';
import { answer } from '../src/chat/orchestrator.js';

const SAT = new Date(2026, 9, 24, 15, 0);   // Saturday, October 24, 2026
const SUN = new Date(2026, 9, 25, 9, 0);

test('todayLine names today, tomorrow, yesterday and the next Sunday', () => {
  const l = todayLine(SAT);
  assert.match(l, /Today is Saturday, October 24, 2026/);
  assert.match(l, /Tomorrow is Sunday, October 25, 2026/);
  assert.match(l, /Yesterday was Friday, October 23, 2026/);
  assert.match(l, /next Sunday is Sunday, October 25, 2026/);
  assert.match(todayLine(SUN), /next Sunday is Sunday, November 1, 2026/);   // on a Sunday, "next" means the following one
});

test('dateHints turns relative words (English and Chinese) into real dates and the weekday', () => {
  assert.equal(dateHints('Is there a class tomorrow?', SAT), '2026-10-25 10/25/2026 Sunday');
  assert.equal(dateHints('明天有課嗎', SAT), '2026-10-25 10/25/2026 Sunday');
  assert.equal(dateHints('what is today', SAT), '2026-10-24 10/24/2026 Saturday');
  assert.equal(dateHints('when is the next class', SUN), '2026-11-01 11/01/2026 Sunday');
  assert.equal(dateHints('is school this weekend', SUN), '2026-10-25 10/25/2026 Sunday', 'on a Sunday, this week is today');
  assert.equal(dateHints('How much is tuition?', SAT), '');
});

test('answer() puts today\'s date in the prompt and the real dates in the content search', async () => {
  let searched = ''; let system = '';
  const retriever = { search(q) { searched = q; return [{ source: 'pages', title: 'Calendar', url: '/en/x', text: 'Classes meet on Sundays.', score: 5 }]; } };
  const provider = { async *stream(messages) { system = messages[0].content; yield 'ok'; } };
  const out = [];
  for await (const ev of answer({ message: 'Is there a class tomorrow?', lang: 'en', retriever, provider, contact: { email: 'a@b.c', phone: '1' }, now: SAT })) out.push(ev);
  assert.match(system, /Today is Saturday, October 24, 2026/);
  assert.match(searched, /2026-10-25 10\/25\/2026 Sunday/);
  assert.ok(out.some((e) => e.type === 'delta' && e.text === 'ok'));
});
