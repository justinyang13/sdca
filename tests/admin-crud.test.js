// tests/admin-crud.test.js — the declarative admin entities (src/admin/entities.js + crud.js): save, update, delete, rights.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { bootAdminApp } from './support/adminApp.js';

let app, s;
before(async () => {
  app = await bootAdminApp({ admins: [['boss', 'boss-password-1', 'admin']] });
  s = await app.session('boss', 'boss-password-1');
  assert.equal(s.status, 302);
});
after(() => app.close());
const row = (sql, ...a) => app.db.prepare(sql).get(...a);

test('every entity lists and opens its new-item form', async () => {
  for (const base of ['announcements', 'events', 'slides', 'pages', 'programs', 'people', 'sponsors', 'media', 'documents']) {
    assert.equal((await app.get(s, `/admin/${base}`)).status, 200, `${base} list`);
    assert.equal((await app.get(s, `/admin/${base}/new`)).status, 200, `${base} new`);
  }
  assert.equal((await app.get(s, '/admin/archive-photos')).status, 200);
  assert.equal((await app.get(s, '/admin/archive-photos/new')).status, 404, 'archive photos have no create form');
});

test('create, then save again with the same key updates the same row (announcement)', async () => {
  const r = await app.post(s, '/admin/announcements', { slug: 'crud-a', title_en: 'First', kind: 'nonsense', body_en: '<p>hi</p><script>x()</script>', published: 'on', week_no: '7' });
  assert.equal(r.status, 302);
  let a = row("SELECT * FROM announcements WHERE slug = 'crud-a'");
  assert.equal(a.kind, 'weekly', 'unknown kind falls back to the default');
  assert.equal(a.week_no, 7); assert.equal(a.published, 1); assert.equal(a.pinned, 0);
  assert.ok(!a.body_en.includes('script'), 'rich text is sanitized');
  await app.post(s, '/admin/announcements', { slug: 'crud-a', title_en: 'Second', kind: 'news' });
  assert.equal(row("SELECT COUNT(*) n FROM announcements WHERE slug = 'crud-a'").n, 1);
  a = row("SELECT * FROM announcements WHERE slug = 'crud-a'");
  assert.equal(a.title_en, 'Second'); assert.equal(a.kind, 'news'); assert.equal(a.published, 0, 'an unchecked box saves as 0');
  assert.ok(row("SELECT 1 FROM audit_log WHERE action = 'create' AND entity = 'announcements'") && row("SELECT 1 FROM audit_log WHERE action = 'update' AND entity = 'announcements'"));
});

test('delete hides soft-delete entities (restorable) and removes the others', async () => {
  await app.post(s, '/admin/events', { slug: 'crud-e', title_en: 'Event', starts_at: '2030-01-01', published: 'on' });
  const ev = row("SELECT id FROM events WHERE slug = 'crud-e'");
  assert.ok((await (await app.get(s, '/admin/events')).text()).includes('Event'), 'listed before the delete');
  await app.post(s, `/admin/events/${ev.id}/delete`);
  const after = row('SELECT deleted_at FROM events WHERE id = ?', ev.id);
  assert.ok(after && after.deleted_at, 'the event row is kept with deleted_at set');
  assert.ok(!(await (await app.get(s, '/admin/events')).text()).includes('crud-e'), 'it is gone from the admin list');
  assert.equal((await fetch(`${app.base}/en/events/crud-e`)).status, 404, 'and from the public site');

  await app.post(s, '/admin/sponsors', { name: 'Acme', tier: 'gold', sort: '3' });
  const sp = row("SELECT * FROM sponsors WHERE name = 'Acme'");
  assert.equal(sp.sort, 3);
  await app.post(s, `/admin/sponsors/${sp.id}/delete`);
  assert.equal(row('SELECT COUNT(*) n FROM sponsors WHERE id = ?', sp.id).n, 0, 'sponsors have no deleted_at, so they are removed');
});

test('keyed by name or by id: people (group list), slides (id in the form), pages (admin edit marks the body source)', async () => {
  await app.post(s, '/admin/people', { name_en: 'Jane Doe', group: 'hacker', sort: '2' });
  assert.equal(row("SELECT \"group\" g FROM people WHERE name_en = 'Jane Doe'").g, 'staff', 'unknown group falls back');
  await app.post(s, '/admin/people', { name_en: 'Jane Doe', group: 'teacher' });
  assert.equal(row("SELECT COUNT(*) n, MAX(\"group\") g FROM people WHERE name_en = 'Jane Doe'").g, 'teacher');

  await app.post(s, '/admin/slides', { image: '/img/a.jpg', caption_en: 'one', published: 'on', sort: '5' });
  const sl = row("SELECT * FROM slides WHERE caption_en = 'one'");
  assert.equal(sl.sort, 5);
  await app.post(s, '/admin/slides', { id: String(sl.id), image: '/img/b.jpg', caption_en: 'one!', sort: 'x' });
  const sl2 = row('SELECT * FROM slides WHERE id = ?', sl.id);
  assert.equal(sl2.image, '/img/b.jpg'); assert.equal(sl2.sort, 0, 'a non-number sorts as 0');
  assert.equal(row("SELECT COUNT(*) n FROM slides WHERE caption_en LIKE 'one%'").n, 1);

  await app.post(s, '/admin/pages', { slug: 'crud-p', title_en: 'P', body_en: '<b>x</b>' });
  assert.equal(row("SELECT body_source b FROM pages WHERE slug = 'crud-p'").b, 'import', 'a new page keeps the default source');
  await app.post(s, '/admin/pages', { slug: 'crud-p', title_en: 'P2' });
  assert.equal(row("SELECT body_source b FROM pages WHERE slug = 'crud-p'").b, 'admin', 'editing marks the body as admin-written');
});

test('forms need a valid CSRF token and a signed-in admin', async () => {
  const noToken = await fetch(`${app.base}/admin/sponsors`, { method: 'POST', redirect: 'manual', headers: { cookie: s.cookie(), 'content-type': 'application/x-www-form-urlencoded' }, body: 'name=NoToken' });
  assert.equal(noToken.status, 403);
  assert.equal(row("SELECT COUNT(*) n FROM sponsors WHERE name = 'NoToken'").n, 0);
  const anon = await fetch(`${app.base}/admin/sponsors`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'name=Anon' });
  assert.equal(anon.status, 401);
});
