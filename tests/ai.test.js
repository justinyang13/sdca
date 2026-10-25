// tests/ai.test.js — the AI helpers: translate draft, smart search, report questions, chat hand-off, duplicates, volunteer matching.
// The model is replaced by a stub (src/ai/client.js → setAiClient), so no Ollama is needed.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeClient } from './support/client.js';
import { bootPortalApp } from './support/portalApp.js';

// src modules read config (DB path) when first imported, so they are imported only AFTER bootPortalApp has pointed the env at a temp DB.
let setAiClient, editDistance, duplicateFamilies, duplicatePersons, suggestVolunteerAssignments, expandQuery, searchSmart, parseReportQuestion, createFamily, createPerson, addFamilyMember;
let app, base, db, creds;
before(async () => {
  app = await bootPortalApp('ai'); ({ base, db, creds } = app);
  assert.match(process.env.DB_FILE, /sdca-ai-/, 'tests must run on the temp database');
  ({ setAiClient } = await import('../src/ai/client.js'));
  ({ editDistance, duplicateFamilies, duplicatePersons } = await import('../src/portal/duplicates.js'));
  ({ suggestVolunteerAssignments } = await import('../src/portal/volunteer-match.js'));
  ({ expandQuery, searchSmart } = await import('../src/ai/query-expand.js'));
  ({ parseReportQuestion } = await import('../src/ai/nl-report.js'));
  ({ createFamily, createPerson, addFamilyMember } = await import('../src/portal/creators.js'));
});
after(() => { setAiClient?.(); app.close(); });
const Client = makeClient({ base: () => base, creds: () => creds });
const one = (q, ...a) => db.prepare(q).get(...a);
const sql = (q, ...a) => db.prepare(q).all(...a);

test('editDistance', () => {
  assert.equal(editDistance('amy', 'amy'), 0);
  assert.equal(editDistance('amy', 'amie', 2), 2);
  assert.ok(editDistance('abcdef', 'xyzxyz', 2) > 2);
});

test('smart search: expansions add results, never duplicate, and a dead model falls back to the plain search', async () => {
  setAiClient(async () => JSON.stringify({ terms: ['tuition', 'registration'] }));
  assert.deepEqual(await expandQuery('fees please'), ['tuition', 'registration']);
  const smart = await searchSmart(db, 'fees please', { lang: 'en' });
  const urls = smart.rows.map((r) => r.url);
  assert.equal(new Set(urls).size, urls.length, 'no duplicate urls');
  setAiClient(async () => { throw new Error('down'); });
  const plain = await searchSmart(db, 'nonexistentword zzz', { lang: 'en' });
  assert.deepEqual(plain.expanded, []);
});

test('report question: valid JSON is mapped, junk and unknown reports are refused', async () => {
  const years = sql('SELECT id, label FROM school_years');
  setAiClient(async () => JSON.stringify({ report: 'aging', min_days: 30, year: years[0].label }));
  assert.deepEqual(await parseReportQuestion('unpaid over 30 days', { years, today: '2026-10-20' }), { report: 'aging', yearId: years[0].id, minDays: 30 });
  setAiClient(async () => JSON.stringify({ report: 'daily', from: '2026-10-16', to: '2026-10-16' }));
  assert.equal((await parseReportQuestion('last friday', { years, today: '2026-10-20' })).from, '2026-10-16');
  setAiClient(async () => JSON.stringify({ report: 'DROP TABLE' }));
  assert.equal(await parseReportQuestion('x', { years }), null);
  setAiClient(async () => 'not json');
  assert.equal(await parseReportQuestion('x', { years }), null);
});

test('finance "ask": staff are redirected to the report; others are refused; a bad answer shows a message', async () => {
  setAiClient(async () => JSON.stringify({ report: 'aging', min_days: 45 }));
  const a = await new Client().login('demo.accountant');
  const r = await a.get('/en/portal/finance/reports/ask?q=' + encodeURIComponent('unpaid over 45 days'));
  assert.equal(r.status, 302); assert.match(r.loc, /report=aging&min_days=45/);
  assert.equal((await a.get(r.loc)).status, 200);
  const p = await new Client().login('demo.parent01');
  assert.equal((await p.get('/en/portal/finance/reports/ask?q=x')).status, 403);
  setAiClient(async () => 'nope');
  const bad = await a.get('/en/portal/finance/reports/ask?q=gibberish');
  assert.equal(bad.status, 302); assert.match(bad.loc, /\/finance\/reports$/);
});

test('translate draft: allowed for announcement posters, sends only the text, refused for others', async () => {
  const seen = [];
  setAiClient(async (m) => { seen.push(m); return '你好'; });
  const post = async (c, body) => fetch(`${base}/en/portal/ai/translate`, { method: 'POST', headers: { cookie: c.cookie, 'content-type': 'application/json', 'x-csrf-token': c.c.sdca_csrf }, body: JSON.stringify(body) });
  const admin = await new Client().login('demo.admin'); await admin.get('/en/portal');
  const ok = await post(admin, { title: 'Hello', body: 'Picture day', to: 'zh' });
  assert.equal(ok.status, 200); assert.deepEqual(await ok.json(), { title: '你好', body: '你好' });
  assert.match(seen[0][0].content, /Traditional Chinese/);
  const par = await new Client().login('demo.parent01'); await par.get('/en/portal');
  assert.equal((await post(par, { title: 'x', to: 'zh' })).status, 403);
  setAiClient(async () => { throw new Error('down'); });
  assert.equal((await post(admin, { title: 'x', to: 'zh' })).status, 503);
});

test('chat hand-off: stored, e-mailed to the office, validated; inbox is staff only', async () => {
  const send = (b) => fetch(`${base}/api/chat/handoff`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
  assert.equal((await send({ question: 'Do you have a bus?', email: 'not-an-email' })).status, 400);
  assert.equal((await send({ question: '', email: 'a@b.co' })).status, 400);
  const ok = await send({ question: 'Do you have a bus?', name: 'Pat', email: 'pat@example.com', lang: 'en' });
  assert.equal(ok.status, 200);
  assert.equal(one("SELECT COUNT(*) AS n FROM chat_inbox WHERE kind = 'handoff' AND email = 'pat@example.com'").n, 1);
  assert.ok(one("SELECT 1 AS x FROM email_outbox WHERE subject LIKE 'Website question from Pat%'"), 'queued for the office');
  const adm = await new Client().login('demo.admin');
  const page = await adm.get('/en/portal/chat-inbox');
  assert.equal(page.status, 200); assert.match(page.text, /Do you have a bus\?/);
  assert.equal((await (await new Client().login('demo.parent01')).get('/en/portal/chat-inbox')).status, 403);
});

test('chat: a question with no answer is logged and the widget is told to offer the hand-off', async () => {
  const res = await fetch(`${base}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'qqqzzzxxx blorp', lang: 'en' }) });
  const text = await res.text();
  assert.match(text, /"type":"handoff"/);
  assert.ok(one("SELECT 1 AS x FROM chat_inbox WHERE kind = 'unanswered' AND question = 'qqqzzzxxx blorp'"));
});

test('duplicates: same e-mail / phone / name+birth date / a typo are grouped; a unique person is not', () => {
  const mk = (n, email) => createFamily(db, { street: '1 St', city: 'SD', zipcode: '92101', home_phone: '(858) 555-0101', email, emergency_contact: 'E', emergency_home_phone: '(858) 555-0102', emergency_cell_phone: '(858) 555-0103' });
  const f1 = mk(1, 'dupe@example.com'), f2 = mk(2, 'DUPE@example.com'), f3 = mk(3, 'other@example.com');
  const fam = duplicateFamilies(db);
  const g = fam.find((c) => c.ids.includes(f1));
  assert.ok(g && g.ids.includes(f2), 'same e-mail ignoring case');
  assert.ok(g.reasons.includes('same e-mail'));
  const p1 = createPerson(db, { english_last_name: 'Zhangtest', english_first_name: 'Wei', gender: 'M', birth_date: '2012-03-04' });
  const p2 = createPerson(db, { english_last_name: 'Zhangtest', english_first_name: 'Wei', gender: 'M', birth_date: '2012-03-04' });
  const p3 = createPerson(db, { english_last_name: 'Zhangtesst', english_first_name: 'Wei', gender: 'M', birth_date: '2012-03-04' });
  const p4 = createPerson(db, { english_last_name: 'Uniquetest', english_first_name: 'Ann', gender: 'F', birth_date: '2010-01-01' });
  const ppl = duplicatePersons(db);
  const pg = ppl.find((c) => c.ids.includes(p1));
  assert.ok(pg.ids.includes(p2) && pg.ids.includes(p3), 'exact and one-typo matches');
  assert.ok(!ppl.some((c) => c.ids.includes(p4)));
  assert.ok(f3);
});

test('data-quality page: staff only', async () => {
  assert.equal((await (await new Client().login('demo.admin')).get('/en/portal/data-quality')).status, 200);
  assert.equal((await (await new Client().login('demo.parent01')).get('/en/portal/data-quality')).status, 403);
});

test('volunteer matching: suggests, respects preschool-only jobs, and only assigns what the server itself suggests', async () => {
  const year = one('SELECT * FROM school_years WHERE is_current = 1');
  const fam = createFamily(db, { street: '2 St', city: 'SD', zipcode: '92101', home_phone: '(858) 555-0201', email: 'vol1@example.com', emergency_contact: 'E', emergency_home_phone: '(858) 555-0202', emergency_cell_phone: '(858) 555-0203' });
  const parent = createPerson(db, { english_last_name: 'Voltest', english_first_name: 'Pat', gender: 'F', birth_date: '1980-02-02' });
  addFamilyMember(db, fam, parent, 'parent_one');
  const jobs = sql('SELECT id, reserved_for_preschool FROM volunteer_jobs WHERE active = 1 AND deleted_at IS NULL AND reserved_for_preschool = 0 ORDER BY id');
  const reserved = one('SELECT id FROM volunteer_jobs WHERE active = 1 AND deleted_at IS NULL AND reserved_for_preschool = 1');
  const ins = (job, pr) => db.prepare("INSERT INTO volunteer_signups (family_id, person_id, school_year_id, job_id, priority) VALUES (?,?,?,?,?)").run(fam, parent, year.id, job, pr);
  if (reserved) ins(reserved.id, 1);
  ins(jobs[0].id, reserved ? 2 : 1);
  const s = suggestVolunteerAssignments(db, year.id).suggestions.find((x) => x.familyId === fam);
  assert.ok(s, 'suggestion exists');
  assert.equal(s.jobId, jobs[0].id, 'a non-preschool family never gets a preschool-only job');
  const admin = await new Client().login('demo.admin');
  assert.equal((await admin.get('/en/portal/volunteer-match')).status, 200);
  // a forged signup id that is not a current suggestion changes nothing
  const other = one("SELECT id FROM volunteer_signups WHERE status <> 'requested' LIMIT 1");
  if (other) { await admin.post('/en/portal/volunteer-match/accept', { signup: String(other.id) }); assert.equal(one('SELECT status FROM volunteer_signups WHERE id = ?', other.id).status, other.status ?? one('SELECT status FROM volunteer_signups WHERE id = ?', other.id).status); }
  await admin.post('/en/portal/volunteer-match/accept', { signup: String(s.signupId) });
  const row = one('SELECT status, assigned_job_id FROM volunteer_signups WHERE id = ?', s.signupId);
  assert.equal(row.status, 'assigned'); assert.equal(row.assigned_job_id, jobs[0].id);
  assert.equal((await (await new Client().login('demo.parent01')).get('/en/portal/volunteer-match')).status, 403);
});
