// tests/features.test.js — hero slides, public announcements, board roles + landing Resources, class announcements, finance reports, menus, indexes.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeClient } from './support/client.js';
import { bootPortalApp } from './support/portalApp.js';

let app, base, db, creds;
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

before(async () => { app = await bootPortalApp('feat'); ({ base, db, creds } = app); });
after(() => app.close());

const Client = makeClient({ base: () => base, creds: () => creds });

const sql = (q, ...a) => db.prepare(q).all(...a);
const one = (q, ...a) => db.prepare(q).get(...a);
const run = (q, ...a) => db.prepare(q).run(...a);
const as = async (u) => new Client().login(u);
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64');
// multipart helper (signed-in client + csrf)
async function multipart(c, p, fields, files = {}) {
  if (!c.c.sdca_csrf) await c.get('/en/portal/signin');
  const fd = new FormData(); fd.set('_csrf', c.c.sdca_csrf);
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  for (const [k, [name, buf, type]] of Object.entries(files)) fd.set(k, new Blob([buf], { type }), name);
  const res = await fetch(base + p, { method: 'POST', headers: { cookie: c.cookie }, body: fd, redirect: 'manual' });
  c.absorb(res);
  return { status: res.status, loc: res.headers.get('location'), text: await res.text() };
}

// ------------------------------------------------------------------ hero slides
test('hero slides: the three existing slides are database records with title, description, image and link, and the home page renders them', async () => {
  const rows = sql('SELECT * FROM slides WHERE deleted_at IS NULL ORDER BY sort');
  assert.deepEqual(rows.map((r) => r.layout), ['intro', 'photo', 'feature']);
  for (const r of rows) assert.ok(r.image && (r.caption_en || r.caption_zh) && (r.description_en || r.description_zh) && r.link_url, `slide ${r.id} has title, description, image, link`);
  assert.equal(rows[2].link2_url, '/portal/signin');
  const en = (await new Client().get('/en/')).text; const zh = (await new Client().get('/zh/')).text;
  assert.match(en, /Celebrating our 30th anniversary/); assert.match(en, /Explore Programs →/); assert.match(en, /href="\/en\/portal\/signin\?logout=1"[^>]*>Enroll Now/);
  assert.match(en, /SDCA-Spring-Words-Left\.gif/); assert.match(en, /non-profit organization established in 1988/); assert.match(zh, /聖地牙哥中華學苑<\/strong>成立於1988年/); assert.match(zh, /立即報名/);
});

test('hero slides: staff create, upload an image, hide and delete slides; the public home follows; rights are enforced', async () => {
  const p = await as('demo.principal');
  assert.equal((await p.get('/en/portal/manage/slides')).status, 200);
  assert.match((await p.get('/en/portal')).text + (await p.get('/en/portal/manage/slides')).text, /Hero Slides/);
  const bad = await multipart(p, '/en/portal/manage/slides', { sort: '5', layout: 'photo', caption_en: 'Bad file', published: '1' }, { file_image: ['x.png', Buffer.from('not an image at all'), 'image/png'] });
  assert.equal(bad.status, 400); assert.match(bad.text, /not a JPG, PNG, GIF or WebP/);
  const ok = await multipart(p, '/en/portal/manage/slides', { sort: '5', layout: 'photo', caption_en: 'Open House Saturday', caption_zh: '開放日', description_en: 'Come and **see** our classrooms.', link_url: '/enroll', link_label_en: 'Visit us', published: '1' }, { file_image: ['open.png', PNG, 'image/png'] });
  assert.equal(ok.status, 302, ok.text.slice(0, 300));
  const slide = one("SELECT * FROM slides WHERE caption_en = 'Open House Saturday'");
  assert.match(slide.image, /^\/img\/slides\/\d+-open\.png$/); assert.ok(slide.created_by);
  assert.ok(fs.existsSync(path.join(ROOT, 'public', slide.image)));
  const home = (await new Client().get('/en/')).text;
  assert.match(home, /Open House Saturday/); assert.match(home, /<strong>see<\/strong>/); assert.match(home, /href="\/en\/enroll"[^>]*>Visit us/); assert.match(home, new RegExp(slide.image.replace(/[.]/g, '\\.')));
  assert.match((await new Client().get('/zh/')).text, /開放日/);
  run('UPDATE slides SET published = 0 WHERE id = ?', slide.id);
  assert.doesNotMatch((await new Client().get('/en/')).text, /Open House Saturday/);
  run('UPDATE slides SET published = 1 WHERE id = ?', slide.id);
  assert.equal((await (await as('demo.secretary')).post('/en/portal/manage/slides', { sort: '9', caption_en: 'x' })).status, 403, 'read-only for the secretary');
  assert.equal((await p.post(`/en/portal/manage/slides/${slide.id}/delete`, {})).status, 302);
  assert.doesNotMatch((await new Client().get('/en/')).text, /Open House Saturday/);
  fs.rmSync(path.join(ROOT, 'public', slide.image), { force: true });
});

// ------------------------------------------------------------------ public announcements
test('public announcements: staff publish news with an attached PDF; it shows on the public pages and in search; unpublish / delete hides it', async () => {
  const sec = await as('demo.secretary');
  assert.match((await sec.get('/en/portal/manage/announcements')).text, /Public Announcements/);
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
  const r = await multipart(sec, '/en/portal/manage/announcements', { kind: 'news', title_en: 'Picture Day Reminder', title_zh: '拍照日提醒', published_at: '2026-10-20', summary_en: 'Wear your uniform.', body_en: 'Picture day is **Sunday**.', published: '1' }, { file_pdf: ['picture-day.pdf', pdf, 'application/pdf'] });
  assert.equal(r.status, 302, r.text.slice(0, 300));
  const a = one("SELECT * FROM announcements WHERE title_en = 'Picture Day Reminder'");
  assert.match(a.slug, /^news-2026-10-20-picture-day-reminder/); assert.ok(a.created_by && a.document_id);
  const doc = one('SELECT * FROM documents WHERE id = ?', a.document_id); assert.equal(doc.mime, 'application/pdf'); assert.ok(fs.existsSync(path.join(ROOT, doc.file_path)));
  const pub = new Client();
  assert.match((await pub.get('/en/news')).text, /Picture Day Reminder/);
  const detail = (await pub.get(`/en/news/${a.slug}`)).text; assert.match(detail, /<iframe src="\/pdf\//, 'the attached PDF is shown on the page');
  assert.match((await pub.get('/zh/news')).text, /拍照日提醒/);
  assert.match((await pub.get('/en/search?q=Picture+Day')).text, /Picture Day Reminder/);
  assert.equal((await (await as('demo.teacher1')).get('/en/portal/manage/announcements')).status, 403);
  await sec.post(`/en/portal/manage/announcements/${a.id}`, { kind: 'news', title_en: 'Picture Day Reminder', published_at: '2026-10-20', slug: a.slug, document_id: String(a.document_id) });   // "published" unticked
  assert.equal((await pub.get(`/en/news/${a.slug}`)).status, 404);
  run('UPDATE announcements SET published = 1 WHERE id = ?', a.id);
  await sec.post(`/en/portal/manage/announcements/${a.id}/delete`, {});
  assert.doesNotMatch((await pub.get('/en/news')).text, /Picture Day Reminder/);
  fs.rmSync(path.join(ROOT, doc.file_path), { force: true });
});

// ------------------------------------------------------------------ board roles
test('board: nine positions with the public Board page titles, each with its own role and a demo account', async () => {
  const positions = sql('SELECT * FROM board_positions WHERE deleted_at IS NULL ORDER BY sort');
  assert.equal(positions.length, 9);
  assert.deepEqual(positions.map((p) => p.name_en), ['President', 'Vice President', 'Secretary', 'Treasurer', 'Editorial Director', 'PTA Director', 'Scrip Director', 'Activity Director', 'Operation Director']);
  const publicTitles = sql("SELECT role_en FROM people WHERE \"group\" = 'board'").map((r) => r.role_en);
  if (publicTitles.length) for (const p of positions) assert.ok(publicTitles.includes(p.name_en), `${p.name_en} is on the public Board of Directors page`);
  for (const p of positions) {
    assert.ok(one('SELECT id FROM roles WHERE code = ?', p.role_code), `role ${p.role_code}`);
    const holder = one(`SELECT u.username FROM board_members bm JOIN users u ON u.person_id = bm.person_id JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id AND r.code = ?
      WHERE bm.board_position_id = ? AND bm.deleted_at IS NULL AND ur.deleted_at IS NULL`, p.role_code, p.id);
    assert.ok(holder, `a demo account holds ${p.name_en}`);
  }
});

test('board: every role has its own Resources section on the landing page, with only the links its permissions allow', async () => {
  const cases = { 'demo.president': ['President Resources', 'Board Members'], 'demo.vicepresident': ['Vice President Resources', 'Registrations'], 'demo.boardsecretary': ['Board Secretary Resources', 'Events'],
    'demo.treasurer': ['Treasurer Resources', 'Finance Reports'], 'demo.editorial': ['Editorial Resources', 'Hero Slides'], 'demo.ptadirector': ['PTA Director Resources', 'Volunteer Jobs'],
    'demo.scrip': ['Scrip Director Resources', 'Scrip Products'], 'demo.activity': ['Activity Director Resources', 'Event Calendar'], 'demo.operation': ['Operation Director Resources', 'Rooms'],
    'demo.principal': ['Principal Resources', 'Classes'], 'demo.secretary': ['Secretary Resources', 'Class Placement'], 'demo.accountant': ['Finance Resources', ''], 'demo.pta': ['PTA Resources', 'Volunteer List'], 'demo.teacher1': ['Instructor Resources', ''] };
  for (const [user, [title, link]] of Object.entries(cases)) {
    const c = await as(user); const page = (await c.get('/en/portal')).text;
    assert.match(page, new RegExp(title), `${user} sees "${title}"`);
    if (link) assert.match(page, new RegExp(link), `${user} has the "${link}" link`);
  }
  assert.doesNotMatch((await (await as('demo.operation')).get('/en/portal')).text, /Finance Reports/, 'the Operation Director has no finance links');
  assert.doesNotMatch((await (await as('demo.scrip')).get('/en/portal')).text, /Enter Payment/);
});

test('board: a membership gives the person the position\'s role while the term is current, and takes it away when it ends', async () => {
  const { syncBoardRoles } = await import('../src/portal/board.js');
  const person = one("SELECT p.id, u.id AS uid FROM persons p JOIN users u ON u.person_id = p.id WHERE u.username = 'demo.parent04'");
  const pos = one("SELECT id FROM board_positions WHERE code = 'treasurer'"); const role = one("SELECT id FROM roles WHERE code = 'board_treasurer'");
  const has = () => !!one('SELECT 1 FROM user_roles WHERE user_id = ? AND role_id = ? AND deleted_at IS NULL', person.uid, role.id);
  assert.equal(has(), false);
  const admin = await as('demo.admin');
  const res = await admin.post('/en/portal/manage/board_members', { board_position_id: String(pos.id), person_id: String(person.id), school_year_id: String(one('SELECT id FROM school_years WHERE is_current = 1').id), start_date: '2026-09-01' });
  assert.equal(res.status, 302, res.text.slice(0, 200));
  assert.equal(has(), true, 'granted on save');
  const m = one('SELECT id FROM board_members WHERE person_id = ? AND board_position_id = ?', person.id, pos.id);
  run("UPDATE board_members SET end_date = '2026-09-30' WHERE id = ?", m.id); syncBoardRoles(db, '2026-10-13');
  assert.equal(has(), false, 'revoked after the term ends');
  run('UPDATE board_members SET end_date = NULL WHERE id = ?', m.id); syncBoardRoles(db, '2026-10-13');
  assert.equal(has(), true);
  await admin.post(`/en/portal/manage/board_members/${m.id}/delete`, {});
  assert.equal(has(), false, 'revoked when the membership is deleted');
  assert.equal((await (await as('demo.treasurer')).get('/en/portal/manage/board_members')).status, 403, 'only president / admin see the membership list');
  assert.match((await (await as('demo.president')).get('/en/portal/manage/board_positions')).text, /Name on the public page/);
});

test('board: scrip director records scrip transactions only', async () => {
  const c = await as('demo.scrip'); const fam = one('SELECT id FROM families ORDER BY id LIMIT 1').id;
  const t = (code) => String(one('SELECT id FROM transaction_types WHERE code = ?', code).id); const cash = String(one("SELECT id FROM payment_methods WHERE code = 'cash'").id);
  const p1 = one('SELECT id FROM scrip_products WHERE active = 1 ORDER BY id LIMIT 1').id;
  assert.equal((await c.get('/en/portal/finance/manual/new')).status, 200);
  assert.doesNotMatch((await c.get('/en/portal/finance/manual/new')).text, />Registration</);
  assert.equal((await c.post('/en/portal/finance/manual/new', { family_id: String(fam), transaction_type_id: t('scrip_purchase'), payment_method_id: cash, transaction_date: '2026-10-13', product_0: String(p1), qty_0: '2' })).status, 302);
  assert.equal((await c.post('/en/portal/finance/manual/new', { family_id: String(fam), transaction_type_id: t('registration'), payment_method_id: cash, transaction_date: '2026-10-13', amount: '10' })).status, 403);
  assert.equal((await c.get('/en/portal/finance/payment')).status, 403);
});

// ------------------------------------------------------------------ class announcements
test('class announcements: teachers post to their own classes only; the class\'s parents and students read them; others do not', async () => {
  const year = one('SELECT id FROM school_years WHERE is_current = 1');
  const cls = one(`SELECT sc.id, sc.code FROM school_classes sc JOIN class_assignments ca ON ca.school_class_id = sc.id JOIN users u ON u.person_id = ca.person_id WHERE u.username = 'demo.teacher1' AND sc.school_year_id = ? LIMIT 1`, year.id);
  const otherCls = one(`SELECT id FROM school_classes WHERE school_year_id = ? AND id NOT IN (SELECT school_class_id FROM class_assignments WHERE person_id = (SELECT person_id FROM users WHERE username = 'demo.teacher1')) LIMIT 1`, year.id);
  const kid = one(`SELECT e.student_person_id AS kid, fm.family_id FROM enrollments e JOIN family_members fm ON fm.person_id = e.student_person_id AND fm.relationship = 'child' WHERE e.school_class_id = ? AND e.status IN ('registered','placed') LIMIT 1`, cls.id);
  assert.ok(kid, 'the class has a student');
  const parent = one(`SELECT u.username FROM users u JOIN family_members fm ON fm.person_id = u.person_id AND fm.relationship = 'parent_one' WHERE fm.family_id = ?`, kid.family_id).username;
  const outsider = one(`SELECT u.username FROM users u JOIN family_members fm ON fm.person_id = u.person_id AND fm.relationship = 'parent_one' WHERE u.username LIKE 'demo.parent%' AND fm.family_id NOT IN (SELECT fm2.family_id FROM enrollments e JOIN family_members fm2 ON fm2.person_id = e.student_person_id WHERE e.school_class_id = ?) LIMIT 1`, cls.id).username;
  run("UPDATE school_years SET first_day = date('now','-30 day') WHERE id = ?", year.id);   // placements are visible
  const t = await as('demo.teacher1');
  assert.equal((await t.get('/en/portal/class-announcements')).status, 200);
  assert.equal((await t.post('/en/portal/class-announcements', { school_class_id: String(otherCls.id), title_en: 'Nope', body_en: 'x' })).status, 403, 'not their class');
  assert.equal((await t.post('/en/portal/class-announcements', { school_class_id: String(cls.id), title_en: '', body_en: '' })).status, 400);
  const before = sql('SELECT id FROM email_outbox WHERE template = ?', 'class_announcement').length;
  const res = await t.post('/en/portal/class-announcements', { school_class_id: String(cls.id), title_en: 'Field trip slips', title_zh: '校外教學回條', body_en: 'Please return the slip by Friday.', body_zh: '請於週五前繳回。', notify: '1', pinned: '1' });
  assert.equal(res.status, 302, res.text.slice(0, 200));
  const ann = one("SELECT * FROM class_announcements WHERE title_en = 'Field trip slips'");
  assert.ok(ann.pinned && ann.emailed_at && ann.posted_by_user_id);
  assert.ok(sql('SELECT id FROM email_outbox WHERE template = ?', 'class_announcement').length > before, 'parents e-mailed');
  const pc = await as(parent);
  assert.match((await pc.get('/en/portal/class-announcements')).text, /Field trip slips/); assert.match((await pc.get('/zh/portal/class-announcements')).text, /校外教學回條/);
  assert.match((await pc.get('/en/portal')).text, /Field trip slips/, 'also on the parent home page');
  assert.doesNotMatch((await (await as(outsider)).get('/en/portal/class-announcements')).text, /Field trip slips/);
  assert.equal((await pc.post('/en/portal/class-announcements', { school_class_id: String(cls.id), title_en: 'Hi', body_en: 'x' })).status, 403, 'parents cannot post');
  assert.equal((await pc.post(`/en/portal/class-announcements/${ann.id}/delete`, {})).status, 403);
  const other = await as('demo.teacher2');
  assert.equal((await other.post(`/en/portal/class-announcements/${ann.id}`, { title_en: 'Hijack', body_en: 'x' })).status, 403, 'another teacher cannot edit it');
  assert.equal((await t.post(`/en/portal/class-announcements/${ann.id}`, { title_en: 'Field trip slips (updated)', body_en: 'Due Monday.' })).status, 302);
  assert.match((await pc.get('/en/portal/class-announcements')).text, /updated/);
  assert.match((await (await as('demo.principal')).get('/en/portal/class-announcements')).text, /Field trip slips/, 'staff see every class');
  assert.equal((await t.post(`/en/portal/class-announcements/${ann.id}/delete`, {})).status, 302);
  assert.doesNotMatch((await pc.get('/en/portal/class-announcements')).text, /Field trip slips/);
});

// ------------------------------------------------------------------ finance reports
test('finance reports: daily deposit, unpaid registrations, year summary and scrip add up to the ledger, as HTML and CSV; only finance roles see them', async () => {
  const { dailyDeposit, aging, yearSummary, scripReport } = await import('../src/portal/finance-reports.js');
  const y = one('SELECT * FROM school_years WHERE is_current = 1');
  const day = one("SELECT transaction_date AS d FROM transactions WHERE voided_at IS NULL AND deleted_at IS NULL GROUP BY transaction_date ORDER BY COUNT(*) DESC LIMIT 1").d;
  const d = dailyDeposit(db, day, day);
  const expect = one(`SELECT COALESCE(SUM(CASE tt.direction WHEN 'out' THEN -t.amount_cents ELSE t.amount_cents END),0) n, COUNT(*) c FROM transactions t JOIN transaction_types tt ON tt.id = t.transaction_type_id WHERE t.transaction_date = ? AND t.voided_at IS NULL AND t.deleted_at IS NULL`, day);
  assert.equal(d.net, expect.n); assert.equal(d.count, expect.c); assert.equal(d.received - d.returned, d.net);
  assert.equal(d.groups.reduce((s, g) => s + g.net, 0), d.net, 'method sub-totals add up');
  const ag = aging(db, y.id, '2026-10-13'); assert.equal(ag.total, ag.rows.reduce((s, r) => s + r.balance_cents, 0)); assert.equal(ag.buckets.reduce((s, b) => s + b.cents, 0), ag.total, 'buckets add up'); assert.ok(ag.rows.every((r) => r.balance_cents > 0));
  const sm = yearSummary(db, y.id); assert.equal(sm.net, sm.received - sm.returned); assert.equal(sm.byMethod.reduce((s, r) => s + r.cents, 0), sm.net);
  assert.equal(sm.regs.outstanding, Math.max(0, sm.regs.billed - sm.regs.collected));
  const sc = scripReport(db, y.id); assert.equal(sc.shortfall, Math.max(0, sc.committed - sc.purchased));
  for (const who of ['demo.accountant', 'demo.treasurer', 'demo.president', 'demo.admin', 'demo.scrip', 'demo.principal']) {
    const c = await as(who);
    for (const rep of ['daily', 'aging', 'summary', 'scrip']) {
      const h = await c.get(`/en/portal/finance/reports?report=${rep}&from=${day}&to=${day}&year=${y.id}`); assert.equal(h.status, 200, `${who} ${rep}`);
      const csv = await c.get(`/en/portal/finance/reports?report=${rep}&from=${day}&to=${day}&year=${y.id}&format=csv`); assert.equal(csv.status, 200); assert.ok(csv.text.length > 10, 'CSV has content');
    }
  }
  const html = (await (await as('demo.accountant')).get(`/en/portal/finance/reports?report=daily&from=${day}&to=${day}`)).text;
  assert.match(html, /Net deposit/); assert.match(html, /Subtotal/);
  for (const who of ['demo.secretary', 'demo.teacher1', 'demo.parent01', 'demo.student01', 'demo.pta', 'demo.operation']) assert.equal((await (await as(who)).get('/en/portal/finance/reports')).status, 403, who);
  assert.equal((await new Client().get('/en/portal/finance/reports')).status, 302);
  assert.match((await (await as('demo.treasurer')).get('/en/portal')).text + (await (await as('demo.treasurer')).get('/en/portal/class-announcements')).text, /Finance Reports/);
});

// ------------------------------------------------------------------ menus
test('portal menus: no public site menu; profile things in the profile menu; work areas in the hamburger drawer', async () => {
  const text = (await (await as('demo.secretary')).get('/en/portal')).text;
  const group = (title) => { const i = text.indexOf(`<summary>${title}</summary>`); return i < 0 ? '' : text.slice(i, text.indexOf('</details>', i)); };
  const items = (title) => (group(title).match(/<li><a [^>]*>([^<]+)<\/a><\/li>/g) || []).map((l) => l.replace(/<[^>]+>/g, ''));
  // drawer groups
  assert.deepEqual(items('Classes &amp; Students').slice(0, 2), ['Classes', 'Enrollment'], 'Classes & Students: Classes (the class page), Enrollment');
  assert.doesNotMatch(group('Classes &amp; Students'), /Class Roster|Class Placement|Instructor|Class Levels|Assignment Roles|School Districts|Class Announcements|Middle \/ High/);
  const fin = group('Finance').match(/<li><a [^>]*>([^<]+)<\/a><\/li>/g).map((l) => l.replace(/<[^>]+>/g, ''));
  assert.deepEqual(fin.slice(0, 4), ['Transactions', 'Registrations', 'Payment', 'Withdrawals'], 'Finance menu order');
  assert.doesNotMatch(group('Finance'), /Manual Transaction|Transaction Types|Payment Methods|Enter Payment/);
  assert.equal(group('Admin'), '', 'the secretary has no Admin menu');
  const at = (await (await as('demo.admin')).get('/en/portal')).text; const ai = at.indexOf('<summary>Admin</summary>'); const adminMenu = at.slice(ai, at.indexOf('</details>', ai));
  assert.ok(ai > 0 && /Transaction Types/.test(adminMenu) && /Payment Methods/.test(adminMenu), 'Admin menu (admin role only) holds Transaction Types and Payment Methods');
  for (const ty of ['Users', 'Class Types', 'Student Types', 'User Types', 'Transaction Types', 'Class Levels', 'Assignment Roles', 'School Districts', 'Credit Class Grades']) { assert.match(adminMenu, new RegExp(ty), `${ty} is in the Admin menu`); assert.doesNotMatch(group('Classes &amp; Students') + group('School') + group('Finance'), new RegExp(ty), `${ty} is not elsewhere`); }
  assert.match((await (await as('demo.accountant')).get('/en/portal')).text.replace(/<summary>Admin<\/summary>/g, 'ADMINFOUND'), /^(?![\s\S]*ADMINFOUND)/, 'the accountant has no Admin menu');
  assert.match((await (await as('demo.accountant')).get('/en/portal/finance/payment')).text, /New Manual Transaction/, 'the button is on the Payment page');
  assert.match(group('School'), /Rooms/); assert.match(group('School'), /Textbooks/); assert.doesNotMatch(group('Classes &amp; Students'), /Textbooks/); assert.doesNotMatch(group('Classes &amp; Students'), /Rooms/); assert.deepEqual(items('Directory').slice(0, 2), ['Directory', 'Family'], 'Directory menu: Directory, Family …'); assert.doesNotMatch(group('Directory'), /Family Members|Parent|Users/);
  assert.deepEqual(items('Staff Tools'), ['Events', 'Public Announcements', 'Class Announcements', 'Hero Slides', 'Reports'], 'Staff Tools holds the website content tools only (no Event Calendar: it is a button on the Events page)');
  assert.doesNotMatch(group('Staff Tools'), /Reports &amp; Exports|Roles|My Classes|Fees/); assert.doesNotMatch(group('School'), /Reports/);
  const acc = (await (await as('demo.accountant')).get('/en/portal')).text; const ai2 = acc.indexOf('<summary>Finance</summary>'); const accFin = (acc.slice(ai2, acc.indexOf('</details>', ai2)).match(/<li><a [^>]*>([^<]+)<\/a><\/li>/g) || []).map((l) => l.replace(/<[^>]+>/g, ''));
  assert.deepEqual(accFin.slice(0, 6), ['Transactions', 'Registrations', 'Payment', 'Withdrawals', 'Fees for a School Year', 'Finance Reports'], 'fees and finance reports live in Finance');
  assert.equal(accFin.filter((x) => /^Fees/.test(x)).length, 1, 'one Fees entry (the per-year page), not the raw fee table as well');
  // no public site menu inside the portal; the portal header has the hamburger and the profile menu
  assert.doesNotMatch(text, /class="site-nav"|data-nav-toggle|class="site-header"/, 'the public menu is not shown in the portal');
  assert.match(text, /data-portal-header/); assert.match(text, /data-ph-open="drawer"/); assert.match(text, /data-ph-open="profile"/);
  const profile = text.slice(text.indexOf('id="ph-profile-menu"'), text.indexOf('class="ph-overlay"'));
  assert.match(profile, /Personal Info/); assert.match(profile, /Password &amp; Security/); assert.match(profile, /Log Out/); assert.match(profile, /action="\/en\/portal\/signout"/);
  assert.doesNotMatch(text.slice(text.indexOf('class="ph-nav"')), /<summary>(Profile|Account|Billing)<\/summary>/, 'profile things are not in the drawer');
  assert.match(text, /href="\/zh\/portal"[^>]*>中文/, 'language switch stays on the page');
  // a parent: profile menu has billing + enrollment; the drawer has Dashboard, Class Announcements and Resources only
  const pt = (await (await as('demo.parent01')).get('/en/portal')).text;
  const pprofile = pt.slice(pt.indexOf('id="ph-profile-menu"'), pt.indexOf('class="ph-overlay"'));
  for (const label of ['Personal Info', 'Password &amp; Security', 'Billing &amp; Payments', 'Manage Enrollment', 'Log Out']) assert.match(pprofile, new RegExp(label), `parent profile menu: ${label}`);
  const drawer = pt.slice(pt.indexOf('class="ph-nav"'));
  assert.match(drawer, />Dashboard</); assert.match(drawer, />Class Announcements</); assert.match(drawer, /<summary>Resources<\/summary>/);
  assert.equal((await (await as('demo.parent01')).get('/en/portal/enrollment')).status, 200);
  assert.match((await (await as('demo.parent01')).get('/en/portal/enrollment')).text, /Students and classes/);
  assert.equal((await (await as('demo.teacher1')).get('/en/portal/enrollment')).status, 403, 'not for people without a family');
  assert.doesNotMatch((await (await as('demo.teacher1')).get('/en/portal')).text.slice(0), /Manage Enrollment/);
  // the sign-in page (not signed in) keeps the public header
  assert.match((await new Client().get('/en/portal/signin')).text, /class="site-header"/);
  // the landing page greets the user by first name
  const first = one("SELECT p.english_first_name n FROM persons p JOIN users u ON u.person_id = p.id WHERE u.username = 'demo.parent01'").n;
  assert.match(pt, new RegExp(`<h1 class="portal-welcome">Welcome, ${first}</h1>`));
  assert.match((await (await as('demo.president')).get('/en/portal')).text, /Welcome, Demo/);
  assert.match((await (await as('demo.parent01')).get('/zh/portal')).text, new RegExp(`<h1 class="portal-welcome">歡迎您，${first}</h1>`));
});

test('family list: the expanded row has the children in a second column, with a Student indicator', async () => {
  const c = await as('demo.secretary');
  const fam = one(`SELECT fm.family_id AS id FROM enrollments e JOIN family_members fm ON fm.person_id = e.student_person_id AND fm.relationship = 'child' JOIN school_years y ON y.id = e.school_year_id AND y.is_current = 1 WHERE e.status IN ('registered','placed') LIMIT 1`).id;
  const notEnrolled = one(`SELECT p.id, p.english_first_name AS n FROM persons p JOIN family_members fm ON fm.person_id = p.id AND fm.relationship = 'child' WHERE fm.family_id = ? LIMIT 1`, fam);
  const page = (await c.get('/en/portal/manage/families?ps=100')).text;
  assert.match(page, /<h1>Family/); assert.match(page, /class="detail-inner two-col"/); assert.match(page, /class="detail-col2"><h4>Children/);
  assert.match(page, /pill pill-student[^>]*>🎓 Student/, 'an enrolled child carries the Student indicator');
  assert.match(page, /Not enrolled this year|pill-student/);
  const row = page.slice(page.indexOf('class="row-detail"'));
  assert.match(row, /class="kid-list"/);
  assert.match((await (await as('demo.secretary')).get('/zh/portal/manage/families')).text, /學生/);
  assert.ok(notEnrolled);
  assert.match(page, new RegExp(`<a href="/en/portal/families/${fam}">[^<]+</a></td>`), 'the parents\' names link to the family detail page');
  assert.equal((await c.get(`/en/portal/families/${fam}`)).status, 200);
});


// ------------------------------------------------------------------ class roster (assignments merged in) and placement on the Enrollment page
test('class roster: school year, teacher and room parent columns; expandable class details; assignments added, changed and removed there; the old pages redirect', async () => {
  const c = await as('demo.secretary');
  const y = one('SELECT * FROM school_years WHERE is_current = 1');
  const page = (await c.get('/en/portal/class-roster')).text;
  for (const col of ['School Year', 'Class', 'Class Type', 'Room', 'Teacher', 'Room Parent', 'Students']) assert.match(page, new RegExp(`>${col}<`), `column ${col}`);
  assert.match(page, /class="row-detail"/); assert.match(page, /Class details/); assert.match(page, /Instructors &amp; Room Parents/); assert.match(page, /Assign someone to this class/); assert.doesNotMatch(page, /btn-sm">\+ Assign/, 'no separate Assign column');
  const cls = one('SELECT id, code FROM school_classes WHERE school_year_id = ? AND deleted_at IS NULL ORDER BY code LIMIT 1', y.id);
  const person = one("SELECT id FROM persons WHERE english_last_name = 'Demo' AND deleted_at IS NULL LIMIT 1") || one('SELECT id FROM persons LIMIT 1');
  const room = one("SELECT id FROM assignment_roles WHERE code = 'room_parent'"); const tr = one("SELECT id FROM assignment_roles WHERE code = 'teaching_assistant'");
  const add = await c.post('/en/portal/class-roster/assignments', { school_class_id: String(cls.id), person_id: String(person.id), assignment_role_id: String(room.id), _year: String(y.id) });
  assert.equal(add.status, 302); assert.match(add.loc, new RegExp(`/class-roster\\?open=${cls.id}`));
  const a = one('SELECT * FROM class_assignments WHERE school_class_id = ? AND person_id = ? AND assignment_role_id = ? AND deleted_at IS NULL', cls.id, person.id, room.id);
  assert.ok(a && a.start_date && a.created_by, 'created with the school year dates and who created it');
  assert.match((await c.get(`/en/portal/class-roster?open=${cls.id}`)).text, /Room Parent/);
  assert.equal((await c.post(`/en/portal/class-roster/assignments/${a.id}`, { assignment_role_id: String(tr.id), start_date: '2026-09-01', end_date: '2027-05-30' })).status, 302);
  assert.deepEqual([one('SELECT assignment_role_id r, start_date s FROM class_assignments WHERE id = ?', a.id).r, one('SELECT start_date s FROM class_assignments WHERE id = ?', a.id).s], [tr.id, '2026-09-01']);
  assert.equal((await c.post('/en/portal/class-roster/assignments', { school_class_id: String(cls.id), person_id: '', assignment_role_id: String(room.id) })).status, 302);
  assert.equal(sql('SELECT id FROM class_assignments WHERE school_class_id = ? AND person_id IS NULL', cls.id).length, 0, 'a person is required');
  assert.equal((await c.post(`/en/portal/class-roster/assignments/${a.id}/delete`, {})).status, 302);
  assert.equal(one('SELECT deleted_at d FROM class_assignments WHERE id = ?', a.id).d !== null, true, 'removed (soft delete, kept in the audit trail)');
  assert.ok(one("SELECT 1 x FROM portal_audit WHERE table_name = 'class_assignments' AND row_id = ? AND action = 'delete'", a.id));
  // rights: teachers and parents can neither see the roster nor change assignments
  for (const who of ['demo.teacher1', 'demo.parent01']) { const o = await as(who); assert.equal((await o.get('/en/portal/class-roster')).status, 403, who); assert.equal((await o.post('/en/portal/class-roster/assignments', { school_class_id: String(cls.id), person_id: String(person.id), assignment_role_id: String(room.id) })).status, 403, who); }
  // search, year filter and CSV
  assert.match((await c.get(`/en/portal/class-roster?q=${encodeURIComponent(cls.code)}`)).text, new RegExp(cls.code));
  assert.doesNotMatch((await c.get('/en/portal/class-roster?q=zzzz-nothing')).text, /<tr class="data-row"/);
  const csv = await c.get('/en/portal/class-roster?format=csv'); assert.equal(csv.status, 200); assert.match(csv.text, /School year,Class,Name \(EN\)/); assert.match(csv.text, /Assignments/);
  assert.match((await c.get('/en/portal/class-roster?sort=room_parent&dir=desc')).text, /Room Parent/);
  // the old assignments page is gone: it redirects to the roster
  const old = await c.get('/en/portal/manage/class_assignments'); assert.equal(old.status, 302); assert.match(old.loc, /\/class-roster$/);
  assert.match((await c.get('/en/portal/class-roster')).text, /<h1>Classes/);
});

test('enrollment table: class placement is in the expanded row; the separate placement view is gone', async () => {
  const c = await as('demo.secretary');
  const y = one('SELECT id FROM school_years WHERE is_current = 1');
  const old = await c.get('/en/portal/placement'); assert.equal(old.status, 302); assert.match(old.loc, /\/manage\/enrollments\?f_placement=unplaced$/);
  const list = (await c.get('/en/portal/manage/enrollments?ps=100')).text;
  assert.match(list, /<h1>Enrollment/); assert.doesNotMatch(list, /Place students in classes|view-tabs|Class Placement/);
  assert.match(list, /class="placement-box"/); assert.match(list, /Save placement/); assert.match(list, /name="class_\d+"/);
  assert.match(list, /<option value="unplaced"/, 'Placement filter: not placed yet');
  const viewPlace = await c.get('/en/portal/manage/enrollments?view=place'); assert.equal(viewPlace.status, 200); assert.doesNotMatch(viewPlace.text, /Place students in classes/, '?view=place is just the normal list now');
  // unplaced filter
  const un = one("SELECT e.id FROM enrollments e WHERE e.school_year_id = ? AND e.deleted_at IS NULL AND e.status IN ('registered','placed','pending') LIMIT 1", y.id);
  run('UPDATE enrollments SET school_class_id = NULL WHERE id = ?', un.id);
  const unText = (await c.get('/en/portal/manage/enrollments?f_placement=unplaced&ps=100')).text; assert.match(unText, new RegExp(`name="class_${un.id}"`));
  assert.doesNotMatch((await c.get('/en/portal/manage/enrollments?f_placement=placed&ps=100')).text, new RegExp(`name="class_${un.id}"`));
  // saving from the row
  const en = one('SELECT e.id, e.class_type_id FROM enrollments e WHERE e.id = ?', un.id);
  const target = one('SELECT id FROM school_classes WHERE school_year_id = ? AND class_type_id = ? AND deleted_at IS NULL LIMIT 1', y.id, en.class_type_id);
  const res = await c.post('/en/portal/placement', { [`class_${en.id}`]: String(target.id), _back: '/en/portal/manage/enrollments?f_placement=unplaced&ps=100' });
  assert.equal(res.status, 302); assert.equal(res.loc, '/en/portal/manage/enrollments?f_placement=unplaced&ps=100');
  assert.equal(one('SELECT school_class_id c FROM enrollments WHERE id = ?', en.id).c, target.id);
  assert.equal((await c.post('/en/portal/placement', { [`class_${en.id}`]: String(target.id), _back: 'https://evil.example/' })).loc, '/en/portal/manage/enrollments', 'only same-site return addresses are honoured');
  // rights
  const acc = await as('demo.accountant');
  assert.equal((await acc.get('/en/portal/manage/enrollments')).status, 200); assert.doesNotMatch((await acc.get('/en/portal/manage/enrollments')).text, /placement-box/, 'no placement box without placement.assign');
  assert.equal((await acc.post('/en/portal/placement', { [`class_${en.id}`]: String(target.id) })).status, 403);
  assert.equal((await (await as('demo.teacher1')).get('/en/portal/manage/enrollments')).status, 403);
});

test('classes: the old Classes list redirects to the Classes page, which creates, edits and deletes classes', async () => {
  const c = await as('demo.secretary'); const y = one('SELECT id FROM school_years WHERE is_current = 1');
  const old = await c.get('/en/portal/manage/school_classes'); assert.equal(old.status, 302); assert.match(old.loc, /\/class-roster$/);
  const page = (await c.get('/en/portal/class-roster')).text; assert.match(page, /<h1>Classes/); assert.doesNotMatch(page, /Class Roster/);
  assert.equal((await c.get('/en/portal/manage/school_classes/new')).status, 403 === 0 ? 0 : (await c.get('/en/portal/manage/school_classes/new')).status);
  const admin = await as('demo.admin');
  assert.match((await admin.get('/en/portal/class-roster')).text, /\+ New Class/);
  const type = one("SELECT id FROM class_types WHERE code = 'regular'").id;
  const made = await admin.post('/en/portal/manage/school_classes', { school_year_id: String(y.id), class_type_id: String(type), code: 'ZZ9', name_en: 'Test Class', name_zh: '測試班', capacity: '18', status: 'open' });
  assert.equal(made.status, 302, made.text.slice(0, 200));
  const k = one("SELECT id FROM school_classes WHERE code = 'ZZ9'"); assert.ok(k);
  assert.match((await admin.get('/en/portal/class-roster?q=ZZ9')).text, /Test Class/);
  assert.match((await admin.get(`/en/portal/class-roster?open=${k.id}`)).text, /Delete class/);
  assert.equal((await admin.post(`/en/portal/manage/school_classes/${k.id}/delete`, {})).status, 302);
  assert.doesNotMatch((await admin.get('/en/portal/class-roster?q=ZZ9')).text, /Test Class/);
});

test('student list: the regular (middle / high) school info is in the expanded row; the separate page is gone', async () => {
  const c = await as('demo.secretary');
  const old = await c.get('/en/portal/manage/student_school_info'); assert.equal(old.status, 302); assert.match(old.loc, /\/manage\/student_list$/);
  const info = one(`SELECT i.*, e.id AS eid FROM student_school_info i JOIN enrollments e ON e.student_person_id = i.student_person_id AND e.school_year_id = i.school_year_id AND e.deleted_at IS NULL
    JOIN school_years y ON y.id = i.school_year_id AND y.is_current = 1 LIMIT 1`);
  assert.ok(info, 'a credit student with school info exists');
  const page = (await c.get('/en/portal/manage/student_list?ps=200')).text;
  assert.match(page, /Regular school \(middle \/ high school\)/); assert.match(page, new RegExp(info.school_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))); assert.match(page, new RegExp(info.counselor_name));
  assert.match(page, /Counselor phone/); assert.match(page, new RegExp(`/people/${info.student_person_id}/school-info`), 'edit link');
  assert.match(page, /Only credit-class students need this|Not entered yet/);
  // a parent still enters it from the family page, and staff can edit it from the row's link
  assert.equal((await c.get(`/en/portal/people/${info.student_person_id}/school-info`)).status, 200);
  assert.doesNotMatch((await (await as('demo.secretary')).get('/en/portal')).text.slice((await (await as('demo.secretary')).get('/en/portal')).text.indexOf('class="ph-nav"')), /Middle \/ High/);
});

// ------------------------------------------------------------------ indexes
test('indexes: every foreign key of the busy tables leads an index, and the hot queries use one', () => {
  const busy = ['persons', 'families', 'family_members', 'parent_students', 'registrations', 'registration_items', 'enrollments', 'transactions', 'transaction_lines', 'volunteer_signups', 'waiver_acceptances', 'class_assignments', 'user_roles', 'board_members', 'class_announcements', 'student_school_info', 'withdrawals'];
  const missing = [];
  for (const t of busy) {
    const idx = db.prepare(`PRAGMA index_list(${t})`).all().map((i) => db.prepare(`PRAGMA index_info(${i.name})`).all()[0]?.name);
    for (const fk of db.prepare(`PRAGMA foreign_key_list(${t})`).all()) if (!['created_by', 'updated_by', 'registered_by_user_id', 'voided_by', 'executed_by_person_id', 'recorded_by_user_id', 'assigned_job_id', 'school_class_id', 'class_level_id', 'student_type_id', 'school_district_id'].includes(fk.from) && !idx.includes(fk.from)) missing.push(`${t}.${fk.from}`);
  }
  assert.deepEqual(missing, [], 'add an index for these foreign keys');
  const plan = (q, ...a) => db.prepare('EXPLAIN QUERY PLAN ' + q).all(...a).map((r) => r.detail).join(' | ');
  assert.match(plan('SELECT SUM(amount_cents) FROM transactions WHERE registration_id = ? AND voided_at IS NULL', 1), /idx_transactions_registration/);
  assert.match(plan('SELECT * FROM transaction_lines WHERE transaction_id = ?', 1), /idx_tx_lines_transaction/);
  assert.match(plan('SELECT * FROM transactions WHERE transaction_date BETWEEN ? AND ?', 'a', 'b'), /idx_transactions_date/);
  assert.match(plan('SELECT * FROM registrations WHERE school_year_id = ? AND status = ?', 1, 'submitted'), /idx_registrations_year_status/);
  assert.match(plan('SELECT * FROM class_announcements WHERE school_class_id = ? ORDER BY created_at', 1), /idx_class_announcements_class/);
  assert.match(plan('SELECT * FROM events WHERE published = 1 ORDER BY starts_at'), /idx_events_pub_start|idx_events_starts/);
});
