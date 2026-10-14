// tests/unit.test.js — UNIT tests: small pure functions and modules, no server. (Grades, text helpers, URL helpers, permissions,
// navigation, CSV/coercion, session store, limiter.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

// ------------------------------------------------------------------ grades
test('grades: gradeLabel covers preschool, K–12 and adult', async () => {
  const { gradeLabel } = await import('../src/portal/grades.js');
  assert.equal(gradeLabel(null), '學前 (Preschool)'); assert.equal(gradeLabel(undefined), '學前 (Preschool)'); assert.equal(gradeLabel(-1), '學前 (Preschool)');
  assert.equal(gradeLabel(0), '幼稚園(Kindergarten)'); assert.equal(gradeLabel(1), '一年級(1st Grade)'); assert.equal(gradeLabel(3), '三年級(3rd Grade)');
  assert.equal(gradeLabel(11), '十一年級(11th Grade)'); assert.equal(gradeLabel(12), '十二年級(12th Grade)'); assert.equal(gradeLabel(13), '成人 (Adult)');
});
test('grades: gradeFromBirth uses age on September 1 minus 5 (the cut-off day belongs to the older group)', async () => {
  const { gradeFromBirth } = await import('../src/portal/grades.js');
  assert.equal(gradeFromBirth('2021-09-01', 2026), 0, 'turns 5 on Sept 1 → kindergarten');
  assert.equal(gradeFromBirth('2021-09-02', 2026), -1, 'turns 5 one day later → still preschool');
  assert.equal(gradeFromBirth('2018-03-03', 2026), 3); assert.equal(gradeFromBirth('2009-01-01', 2026), 12);
  assert.equal(gradeFromBirth('', 2026), null); assert.equal(gradeFromBirth(null, 2026), null);
});
test('grades: ageOn and startYear', async () => {
  const { ageOn, startYear } = await import('../src/portal/grades.js');
  assert.equal(ageOn('2020-02-29', '2026-02-28'), 5); assert.equal(ageOn('2020-02-29', '2026-03-01'), 6); assert.equal(ageOn('2020-06-15', '2026-06-15'), 6); assert.equal(ageOn(null, '2026-01-01'), null);
  assert.equal(startYear('2026-2027'), 2026); assert.equal(startYear('2027-2028'), 2027); assert.ok(startYear('') >= 2026);
});

// ------------------------------------------------------------------ text helpers (public pages)
test('block helpers: esc / escAttr escape every HTML special character', async () => {
  const { esc, escAttr } = await import('../src/block-helpers.js');
  assert.equal(esc('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;'); assert.equal(esc(null), ''); assert.equal(esc(undefined), ''); assert.equal(esc(12), '12');
  assert.equal(escAttr('a\nb"c'), 'a b&quot;c');
});
test('block helpers: linkify links URLs and e-mail addresses, keeps trailing punctuation outside, escapes everything else', async () => {
  const { linkify, paras } = await import('../src/block-helpers.js');
  assert.equal(linkify('see https://example.com/a.'), 'see <a href="https://example.com/a" rel="noopener">https://example.com/a</a>.');
  assert.equal(linkify('mail Office.SDCA@gmail.com now'), 'mail <a href="mailto:Office.SDCA@gmail.com">Office.SDCA@gmail.com</a> now');
  assert.equal(linkify('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.equal(linkify('say "hi" & bye'), 'say &quot;hi&quot; &amp; bye');
  assert.equal(paras('one\n\n  two  \nhttp://x.org'), '<p>one</p>\n<p>two</p>\n<p><a href="http://x.org" rel="noopener">http://x.org</a></p>'); assert.equal(paras(''), '');
});
test('block helpers: ytId and isExternal', async () => {
  const { ytId, isExternal } = await import('../src/block-helpers.js');
  for (const u of ['https://www.youtube.com/watch?v=abcdEFG123', 'https://youtu.be/abcdEFG123', 'https://www.youtube.com/embed/abcdEFG123', 'https://www.youtube.com/shorts/abcdEFG123', 'https://www.youtube.com/watch?list=x&v=abcdEFG123']) assert.equal(ytId(u), 'abcdEFG123', u);
  assert.equal(ytId('https://example.com/video'), null); assert.equal(ytId(''), null);
  assert.equal(isExternal('https://a.b'), true); assert.equal(isExternal('//cdn.x/y'), true); assert.equal(isExternal('/en/about'), false); assert.equal(isExternal('mailto:a@b.c'), false);
});
test('block helpers: linkifySmart uses the verbatim link map first, never double-links, and marks survive stripMarks', async () => {
  const { linkifySmart, parasSmart, stripMarks, marks } = await import('../src/block-helpers.js');
  const html = linkifySmart('Visit Our Page or https://x.org', [{ t: 'Our Page', href: '/en/about' }]);
  assert.match(html, /<a href="\/en\/about"[^>]*>Our Page<\/a>/); assert.match(html, /<a href="https:\/\/x\.org"/); assert.equal((html.match(/<a /g) || []).length, 2);
  assert.equal(stripMarks('abc'), 'abc'); assert.equal(typeof marks('x'), 'string'); assert.equal(typeof parasSmart('a\nb', []), 'string');
});

// ------------------------------------------------------------------ URL / markdown helpers
test('helpers: assetUrl and imgUrl always return root-absolute or external URLs', async () => {
  const { assetUrl, imgUrl, pdfUrl } = await import('../src/helpers.js');
  assert.equal(assetUrl(''), ''); assert.equal(assetUrl(null), ''); assert.equal(assetUrl('img/x.jpg'), '/img/x.jpg'); assert.equal(assetUrl('/img/x.jpg'), '/img/x.jpg'); assert.equal(assetUrl('///a'), '/a');
  for (const keep of ['https://a.b/c', 'http://a.b', 'data:image/png;base64,AA', 'mailto:a@b.c', 'tel:123', '#top']) assert.equal(assetUrl(keep), keep);
  assert.equal(imgUrl('img/y.png'), '/img/y.png'); assert.equal(imgUrl('/already'), '/already'); assert.equal(imgUrl(''), ''); assert.equal(pdfUrl('2026-27-school-calendar'), '/pdf/2026-27-school-calendar');
});
test('helpers: withPdfTargets opens PDF links in a new tab once; withAssetUrls fixes relative images', async () => {
  const { withPdfTargets, withAssetUrls } = await import('../src/helpers.js');
  assert.match(withPdfTargets('<a href="/pdf/x.pdf">x</a>'), /<a\s+rel="noopener" target="_blank" href="\/pdf\/x\.pdf"/);
  assert.equal(withPdfTargets('<a target="_self" href="/a.pdf">x</a>'), '<a target="_self" href="/a.pdf">x</a>', 'an explicit target is respected'); assert.equal(withPdfTargets('<a href="/page">p</a>'), '<a href="/page">p</a>'); assert.equal(withPdfTargets(''), '');
  assert.equal(withAssetUrls('<img alt="" src="img/a.jpg">'), '<img alt="" src="/img/a.jpg">'); assert.equal(withAssetUrls('<img src="https://x/y.jpg">'), '<img src="https://x/y.jpg">');
});
test('helpers: mdToHtml sanitises (no scripts, handlers or javascript: links) and bodyFor falls back across languages', async () => {
  const { mdToHtml, bodyFor } = await import('../src/helpers.js');
  const out = mdToHtml('**ok** <script>alert(1)</script> [x](javascript:alert(1)) <img src=x onerror=alert(1)>');
  assert.match(out, /<strong>ok<\/strong>/); assert.doesNotMatch(out, /<script|onerror|javascript:/i); assert.equal(mdToHtml(''), '');
  assert.deepEqual(bodyFor({ body_en: 'EN', body_zh: '' }, 'zh').note, 'meta.lang_note_zh'); assert.match(bodyFor({ body_en: 'EN', body_zh: '' }, 'zh').html, /EN/);
  assert.equal(bodyFor({ body_en: '', body_zh: '中' }, 'en').note, 'meta.lang_note_en'); assert.equal(bodyFor({ body_en: 'a', body_zh: 'b' }, 'en').note, null); assert.deepEqual(bodyFor({}, 'en'), { html: '', note: null });
});

// ------------------------------------------------------------------ passwords, CSV, coercion, validation
test('auth: password policy (8+ characters) and scrypt hashing', async () => {
  const { passwordPolicyError } = await import('../src/portal/auth.js'); const { hashPassword, verifyPassword } = await import('../src/admin/auth.js');
  assert.ok(passwordPolicyError('short')); assert.ok(passwordPolicyError('')); assert.ok(passwordPolicyError(null)); assert.equal(passwordPolicyError('longenough'), null);
  const h = hashPassword('secret-pass'); assert.notEqual(h, 'secret-pass'); assert.ok(verifyPassword('secret-pass', h)); assert.equal(verifyPassword('wrong', h), false);
  assert.equal(h === hashPassword('secret-pass'), false, 'salted'); assert.equal(verifyPassword('x', ''), false); assert.equal(verifyPassword('x', 'garbage'), false); assert.equal(verifyPassword('x', 'aa:bb'), false, 'wrong-length hash is a clean "no", not an error');
});
test('crud: csvEscape quotes commas, quotes and line breaks', async () => {
  const { csvEscape } = await import('../src/portal/crud.js');
  assert.equal(csvEscape('plain'), 'plain'); assert.equal(csvEscape('a,b'), '"a,b"'); assert.equal(csvEscape('say "hi"'), '"say ""hi"""'); assert.equal(csvEscape('l1\nl2'), '"l1\nl2"'); assert.equal(csvEscape(null), ''); assert.equal(csvEscape(0), '0');
});
test('crud: coerce converts form text to stored values for every field type', async () => {
  const { coerce } = await import('../src/portal/crud.js');
  assert.equal(coerce({ type: 'money' }, '$1,130.50'), 113050); assert.equal(coerce({ type: 'money' }, ''), null); assert.equal(coerce({ type: 'money' }, '0.07'), 7);
  assert.equal(coerce({ type: 'number' }, '42'), 42); assert.equal(coerce({ type: 'number' }, ''), null); assert.ok(Number.isNaN(coerce({ type: 'number' }, 'x')));
  assert.equal(coerce({ type: 'bool' }, '1'), 1); assert.equal(coerce({ type: 'bool' }, 'on'), 1); assert.equal(coerce({ type: 'bool' }, undefined), 0); assert.equal(coerce({ type: 'bool' }, ''), 0);
  assert.equal(coerce({ type: 'date' }, '2026-10-13T10:00'), '2026-10-13'); assert.equal(coerce({ type: 'date' }, ''), null); assert.equal(coerce({ type: 'ref' }, '7'), 7); assert.equal(coerce({ type: 'ref' }, ''), null);
  assert.equal(coerce({ type: 'text' }, '  hi  '), 'hi'); assert.equal(coerce({ type: 'text' }, null), '');
});
test('crud: validate reports required, bad numbers and bad e-mails', async () => {
  const { validate } = await import('../src/portal/crud.js');
  const ent = { table: 't', fields: [{ name: 'a', type: 'text', required: true }, { name: 'n', type: 'number' }, { name: 'e', type: 'email' }] };
  assert.deepEqual(Object.keys(validate(ent, {})), ['a']); assert.deepEqual(validate(ent, { a: 'x' }), {}); assert.ok(validate(ent, { a: 'x', n: NaN }).n);
  assert.equal(validate({ table: 'users', fields: [] }, {}, { creating: true }).password, 'required');
});

// ------------------------------------------------------------------ permissions and navigation
test('perm: can / canAll / hasRole and scope ranking', async () => {
  const { can, canAll, hasRole } = await import('../src/portal/perm.js');
  const access = { perms: new Map([['a.list', 'all'], ['b.view_own', 'own_family']]), roleCodes: ['parent', 'secretary'] };
  assert.equal(can(access, 'a.list'), true); assert.equal(can(access, 'z.list'), false); assert.equal(can(null, 'a.list'), false); assert.equal(can(undefined, 'a.list'), false);
  assert.equal(canAll(access, 'a.list'), true); assert.equal(canAll(access, 'b.view_own'), false, 'own-scope is not staff-wide');
  assert.equal(hasRole(access, 'secretary'), true); assert.equal(hasRole(access, 'admin', 'secretary'), true); assert.equal(hasRole(access, 'admin'), false); assert.equal(hasRole(null, 'admin'), false);
});
test('perm: every role in ROLE_DEFS has a unique code, valid grants and a user type; board roles map to board positions', async () => {
  const { ROLE_DEFS, BOARD_POSITIONS, allPermissionDefs, USER_TYPES } = await import('../src/portal/perm.js');
  const codes = new Set(allPermissionDefs().map((p) => p.code)); const roleCodes = ROLE_DEFS.map((r) => r.code);
  assert.equal(new Set(roleCodes).size, roleCodes.length, 'unique role codes');
  const types = new Set(USER_TYPES.map((t) => t[0]));
  for (const r of ROLE_DEFS) { assert.ok(types.has(r.type), `${r.code}: user type ${r.type}`); if (r.grants !== 'ALL') for (const [code, scope] of r.grants) { assert.ok(codes.has(code), `${r.code} grants unknown permission ${code}`); assert.ok(['all', 'own_family', 'own_classes', 'own_record'].includes(scope), `${r.code} ${code} scope`); } }
  for (const p of BOARD_POSITIONS) assert.ok(roleCodes.includes(p.role_code), `board position ${p.name_en} → role ${p.role_code}`);
});
test('nav: buildNav gives each kind of user the right drawer, profile menu and no extras', async () => {
  const { buildNav } = await import('../src/portal/render.js'); const { ROLE_DEFS, allPermissionDefs } = await import('../src/portal/perm.js');
  const access = (code) => { const r = ROLE_DEFS.find((x) => x.code === code); const grants = r.grants === 'ALL' ? allPermissionDefs().map((p) => [p.code, 'all']) : r.grants; return { perms: new Map(grants), roleCodes: [code], roles: [] }; };
  const label = (nav) => nav.drawer.map((e) => (e.link ? e.link.en : e.group.title.en));
  const parent = buildNav({ access: access('parent'), familyIds: [5], person: { id: 1 } }, 'en');
  assert.deepEqual(parent.profileMenu.map((i) => i.en), ['Personal Info', 'Password & Security', 'Billing & Payments', 'Manage Enrollment']);
  assert.deepEqual(label(parent), ['Dashboard', 'Class Announcements', 'Resources']);
  const student = buildNav({ access: access('student'), familyIds: [], person: { id: 2 } }, 'en');
  assert.deepEqual(student.profileMenu.map((i) => i.en), ['Personal Info', 'Password & Security'], 'no billing / enrollment without a family');
  const admin = buildNav({ access: access('admin'), familyIds: [], person: { id: 3 } }, 'zh');
  assert.ok(label(admin).includes('Admin') && label(admin).includes('Finance') && label(admin).includes('Staff Tools'));
  const adminGroup = admin.drawer.find((e) => e.group?.title.en === 'Admin').group.items.map((i) => i.en);
  for (const x of ['Users', 'Class Types', 'Transaction Types', 'Payment Methods', 'Roles & Permissions']) assert.ok(adminGroup.includes(x), x);
  const secretary = buildNav({ access: access('secretary'), familyIds: [], person: { id: 4 } }, 'en'); assert.ok(!label(secretary).includes('Admin'));
  for (const e of admin.drawer) for (const i of e.link ? [e.link] : e.group.items) assert.match(i.href, /^\/(zh|en|pdf)\//, `${i.en} has a language-prefixed (or /pdf/) link`);
});
test('resources: resourcesFor shows a section per role and only the links the user may open', async () => {
  const { resourcesFor, ROLE_RESOURCES } = await import('../src/portal/resources.js'); const { can } = await import('../src/portal/perm.js');
  const a = { roleCodes: ['board_treasurer'], perms: new Map([['finance.reports', 'all'], ['transactions.list', 'all']]) };
  const secs = resourcesFor(a, can, (p) => `/en/portal${p}`);
  assert.equal(secs.length, 1); assert.equal(secs[0].title.en, 'Treasurer Resources'); assert.deepEqual(secs[0].links.map((l) => l.en).sort(), ['Finance Reports', 'Transactions']);
  assert.deepEqual(resourcesFor({ roleCodes: ['parent'], perms: new Map() }, can, (p) => p), [], 'no section without an entry');
  assert.deepEqual(resourcesFor({ roleCodes: ['board_scrip'], perms: new Map() }, can, (p) => p), [], 'no section when no link is allowed');
  assert.ok(Object.keys(ROLE_RESOURCES).includes('board_president') && Object.keys(ROLE_RESOURCES).length >= 10);
});
test('entities: every entity has labels in both languages, a permission group, valid field types and refs that exist', async () => {
  const { ENTITIES, GROUPS, entityPermissions } = await import('../src/portal/entities.js');
  const groups = new Set(GROUPS.map((g) => g.key)); const types = new Set(['text', 'textarea', 'email', 'tel', 'number', 'money', 'date', 'datetime', 'localdt', 'bool', 'yn', 'gender', 'select', 'ref', 'password', 'readonly', 'image']);
  for (const [k, e] of Object.entries(ENTITIES)) {
    assert.ok(e.label.en && e.label.zh && e.singular.en && e.singular.zh, `${k}: labels`); assert.ok(groups.has(e.group), `${k}: group ${e.group}`); assert.ok(e.table && e.perm, `${k}: table / perm`);
    for (const f of e.fields) { assert.ok(types.has(f.type), `${k}.${f.name}: type ${f.type}`); assert.ok(f.label.en && f.label.zh, `${k}.${f.name}: labels`); if (f.type === 'ref') assert.ok(ENTITIES[f.ref], `${k}.${f.name}: ref ${f.ref}`); if (f.type === 'select') assert.ok(Array.isArray(f.options) && f.options.length, `${k}.${f.name}: options`); }
  }
  const permCodes = entityPermissions().map((p) => p.code); assert.equal(new Set(permCodes).size, permCodes.length, 'no duplicate permission codes');
});

// ------------------------------------------------------------------ session store, limiter
test('session store: set / get / touch / destroy / expiry / clear / length', async () => {
  const { createSessionStore } = await import('../src/db/session-store.js');
  const db = new DatabaseSync(':memory:'); db.exec('CREATE TABLE sessions (sid TEXT PRIMARY KEY, data TEXT NOT NULL, expires INTEGER)');
  const store = createSessionStore(db); const cb = (fn) => new Promise((res, rej) => fn((e, v) => (e ? rej(e) : res(v))));
  const soon = new Date(Date.now() + 60000).toISOString();
  await cb((c) => store.set('a', { cookie: { expires: soon }, user: 1 }, c));
  assert.equal((await cb((c) => store.get('a', c))).user, 1); assert.equal(await cb((c) => store.get('missing', c)), null);
  await cb((c) => store.touch('a', { cookie: { expires: new Date(Date.now() + 3600000).toISOString() } }, c));
  assert.ok(db.prepare("SELECT expires FROM sessions WHERE sid = 'a'").get().expires > Date.now() + 3000000, 'touch renews the expiry');
  await cb((c) => store.set('old', { cookie: { expires: new Date(Date.now() - 1000).toISOString() } }, c)); assert.equal(await cb((c) => store.get('old', c)), null, 'expired sessions are not returned');
  assert.equal(await cb((c) => store.length(c)), 2); await cb((c) => store.destroy('a', c)); assert.equal(await cb((c) => store.get('a', c)), null);
  await cb((c) => store.clear(c)); assert.equal(await cb((c) => store.length(c)), 0);
  db.prepare('INSERT INTO sessions VALUES (?,?,?)').run('bad', '{not json', Date.now() + 1000); assert.equal(await cb((c) => store.get('bad', c)), null, 'corrupt data reads as "no session"');
});
test('limiter: createLimiter returns an express middleware with the configured limit', async () => {
  const { createLimiter } = await import('../src/middleware/index.js');
  const mw = createLimiter({ windowMs: 60000, max: 2, message: 'slow down' }); assert.equal(typeof mw, 'function');
});

// ------------------------------------------------------------------ iCal
test('ics: text is escaped and folded; every event has UID, DTSTAMP and a summary', async () => {
  const { icsForEvents } = await import('../src/ics.js');
  const out = icsForEvents([{ title: 'Comma, semi; back\\slash', description: 'Line1\nLine2', slug: 's', starts_at: '2026-10-25', all_day: true, location: 'La Jolla, CA' }]);
  const lines = out.split('\r\n');
  assert.ok(lines.includes('SUMMARY:Comma\\, semi\\; back\\\\slash'), 'commas, semicolons and backslashes are escaped'); assert.ok(lines.includes('DESCRIPTION:Line1\\nLine2')); assert.ok(lines.includes('LOCATION:La Jolla\\, CA'));
  assert.match(out, /UID:s@sdca/); assert.match(out, /DTSTAMP:\d{8}T\d{6}Z/);
  assert.ok(out.split('\r\n').every((l) => l.length <= 75), 'lines are folded at 75 characters'); assert.match(icsForEvents([]), /BEGIN:VCALENDAR[\s\S]*END:VCALENDAR/);
});
