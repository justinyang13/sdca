// tests/pages4.test.js — Phase 4 acceptance tests
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { newDb } from '../src/db/open.js';
import { applyMigrations, MIGRATIONS_DIR } from '../src/db/migrate.js';
import { createApp } from '../src/app.js';

let server, base, dir, file, db;

const ROUTES = [
  '/', '/about', '/about/board', '/about/staff', '/about/principal',
  '/programs', '/programs/classes', '/programs/tcml', '/programs/recreational', '/programs/ta',
  '/enroll', '/contact', '/support', '/support/sponsors',
];

before(async () => {
  process.env.NODE_ENV = 'development';
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdca-p4-'));
  file = path.join(dir, 'test.db');
  db = newDb(file);
  applyMigrations(db, MIGRATIONS_DIR);

  // Seed minimal data so pages have content
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('school_name_en','San Diego Chinese Academy','聖地牙哥中華學苑')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('founded_year','1988','1988')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('phone','(858) 205-7322','(858) 205-7322')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('email_office','Office.SDCA@gmail.com','Office.SDCA@gmail.com')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('mailing_address','P.O. Box 910093, San Diego, CA 92191-0093','P.O. Box 910093, San Diego, CA 92191-0093')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('registration_portal','https://register.sandiegochineseschool.com','https://register.sandiegochineseschool.com')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('campus_name','La Jolla Country Day School','La Jolla Country Day School')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('class_days','Sunday afternoons','週日下午')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('bell_times','1:30 PM & 4:30 PM','1:30 PM & 4:30 PM')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('tcml_age','18+','18歲以上')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('ta_form','https://forms.gle/HmuYPR5RXbAYGsHh9','https://forms.gle/HmuYPR5RXbAYGsHh9')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('amazon_smile','http://smile.amazon.com/ch/33-0290580','http://smile.amazon.com/ch/33-0290580')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('scrip_refund_1','$700+','$700+')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('scrip_refund_2','$600+','$600+')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('scrip_refund_3','$500+','$500+')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('email_vp','sdca.board.vice.president@gmail.com','sdca.board.vice.president@gmail.com')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('website','https://sandiegochineseschool.com','https://sandiegochineseschool.com')").run();

  db.prepare("INSERT INTO pages (slug, title_en, title_zh, body_en, body_zh, published) VALUES ('about','About SDCA','關於SDCA','SDCA is a non-profit founded in 1988.','聖地牙哥中華學苑是一家非營利機構。',1)").run();
  db.prepare("INSERT INTO pages (slug, title_en, title_zh, body_en, body_zh, published) VALUES ('about-board','Board','董事會','The Board governs SDCA.','董事會治理SDCA。',1)").run();
  db.prepare("INSERT INTO pages (slug, title_en, title_zh, body_en, body_zh, published) VALUES ('about-staff','Staff','師資','Our staff team.','我們的師資團隊。',1)").run();
  db.prepare("INSERT INTO pages (slug, title_en, title_zh, body_en, body_zh, published) VALUES ('about-principal','Principal','校長','Welcome.','歡迎。',1)").run();
  db.prepare("INSERT INTO pages (slug, title_en, title_zh, body_en, body_zh, published) VALUES ('programs','Programs','課程','All programs.','全部課程。',1)").run();
  db.prepare("INSERT INTO pages (slug, title_en, title_zh, body_en, body_zh, published) VALUES ('programs-classes','Classes','分班','Class descriptions.','課程說明。',1)").run();
  db.prepare("INSERT INTO pages (slug, title_en, title_zh, body_en, body_zh, published) VALUES ('programs-tcml','TCML','成人班','Adult Chinese.','成人中文。',1)").run();
  db.prepare("INSERT INTO pages (slug, title_en, title_zh, body_en, body_zh, published) VALUES ('programs-recreational','Recreational','休閒','Dance, yoga, baseball.','舞蹈、瑜伽、棒球。',1)").run();
  db.prepare("INSERT INTO pages (slug, title_en, title_zh, body_en, body_zh, published) VALUES ('programs-ta','TA Program','教學助理','Become a TA.','成為教學助理。',1)").run();
  db.prepare("INSERT INTO pages (slug, title_en, title_zh, body_en, body_zh, published) VALUES ('enroll','Enrollment','報名註冊','How to register.','如何報名。',1)").run();
  db.prepare("INSERT INTO pages (slug, title_en, title_zh, body_en, body_zh, published) VALUES ('support','Support','支持','Donate to SDCA.','捐款支持SDCA。',1)").run();
  db.prepare("INSERT INTO pages (slug, title_en, title_zh, body_en, body_zh, published) VALUES ('support-sponsors','Sponsors','贊助商','Our sponsors.','我們的贊助商。',1)").run();

  db.prepare("INSERT INTO people (name_en, name_zh, role_en, role_zh, \"group\", sort) VALUES ('Test Board Member','測試董事','President','董事長','board',1)").run();
  db.prepare("INSERT INTO people (name_en, name_zh, role_en, role_zh, \"group\", sort) VALUES ('Test Staff','測試師資','Principal','校長','staff',1)").run();

  db.prepare("INSERT INTO programs (slug, name_en, name_zh, grades_en, grades_zh, description_en, description_zh, sort) VALUES ('pre-k','Pre-K','學前班','Pre-K','學前班','For young learners.','適合小朋友。',1)").run();
  db.prepare("INSERT INTO programs (slug, name_en, name_zh, grades_en, grades_zh, description_en, description_zh, sort) VALUES ('regular','Regular','普通班','Grades 1-6','1-6年級','Standard curriculum.','標準課程。',2)").run();

  db.prepare("INSERT INTO sponsors (name, logo, tier, sort) VALUES ('Test Sponsor','img/sponsors/test.png','business',1)").run();

  db.prepare("INSERT INTO announcements (slug, title_en, title_zh, kind, published_at, published) VALUES ('test-ann','Test Announcement','測試公告','weekly','2026-01-15',1)").run();
  db.prepare("INSERT INTO events (slug, title_en, title_zh, starts_at, all_day, location, published) VALUES ('test-ev','Test Event','測試活動','2026-12-01',1,'Test Location',1)").run();

  const app = createApp({ db });
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

for (const lang of ['en', 'zh']) {
  for (const route of ROUTES) {
    test(`GET /${lang}${route} → 200`, async () => {
      const res = await fetch(`${base}/${lang}${route}`);
      assert.equal(res.status, 200, `GET /${lang}${route} should be 200, got ${res.status}`);
      const text = await res.text();
      assert.ok(text.includes('<html'), `should contain <html`);
      assert.ok(text.includes('lang='), `should contain lang=`);
    });
  }
}

test('GET /en/ → 200 with English content', async () => {
  const res = await fetch(`${base}/en/`);
  const text = await res.text();
  assert.ok(text.includes('San Diego Chinese Academy'), 'should have EN school name');
});

test('GET /zh/ → 200 with Chinese content', async () => {
  const res = await fetch(`${base}/zh/`);
  const text = await res.text();
  assert.ok(text.includes('聖地牙哥中華學苑'), 'should have ZH school name');
});

test('Contact POST stores a row in contact_messages', async () => {
  const before = db.prepare('SELECT COUNT(*) AS c FROM contact_messages').get().c;
  const res = await fetch(`${base}/en/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      name: 'Test User',
      email: 'test@example.com',
      phone: '(858) 555-0123',
      topic: 'enrollment',
      message: 'This is a test message for phase 4 acceptance testing.',
      website: '',
    }).toString(),
  });
  assert.equal(res.status, 200, `valid POST should be 200, got ${res.status}`);
  const after = db.prepare('SELECT COUNT(*) AS c FROM contact_messages').get().c;
  assert.equal(after, before + 1, `should have stored 1 new row`);
  const row = db.prepare('SELECT name, email, topic, lang, status FROM contact_messages ORDER BY id DESC LIMIT 1').get();
  assert.equal(row.name, 'Test User');
  assert.equal(row.email, 'test@example.com');
  assert.equal(row.topic, 'enrollment');
  assert.equal(row.lang, 'en');
  assert.equal(row.status, 'new');
});

test('Contact POST with invalid email returns 400', async () => {
  const res = await fetch(`${base}/en/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      name: 'Bad Email',
      email: 'not-an-email',
      topic: 'other',
      message: 'This message is long enough to pass validation.',
      website: '',
    }).toString(),
  });
  assert.equal(res.status, 400, `invalid email should be 400, got ${res.status}`);
});

test('Contact POST with honeypot does NOT store a row', async () => {
  const before = db.prepare('SELECT COUNT(*) AS c FROM contact_messages').get().c;
  const res = await fetch(`${base}/en/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      name: 'Spam Bot',
      email: 'bot@spam.com',
      topic: 'spam',
      message: 'Buy viagra now cheap pharmacy',
      website: 'http://spam.example.com',
    }).toString(),
  });
  assert.equal(res.status, 200, `honeypot should return 200 (pretend success)`);
  const after = db.prepare('SELECT COUNT(*) AS c FROM contact_messages').get().c;
  assert.equal(after, before, `honeypot should NOT store a row`);
});

test('JSON-LD present on home page', async () => {
  const res = await fetch(`${base}/en/`);
  const text = await res.text();
  assert.ok(text.includes('application/ld+json'), 'should have JSON-LD script');
  assert.ok(text.includes('schema.org'), 'JSON-LD should reference schema.org');
});

test('hreflang alternates present on all pages', async () => {
  const res = await fetch(`${base}/en/about`);
  const text = await res.text();
  assert.ok(text.includes('hreflang="en"'), 'should have EN hreflang');
  assert.ok(text.includes('hreflang="zh-Hant"'), 'should have ZH hreflang');
});

test('Canonical URL present', async () => {
  const res = await fetch(`${base}/en/programs`);
  const text = await res.text();
  assert.ok(text.includes('rel="canonical"'), 'should have canonical link');
});

test('Chinese text is real UTF-8 (not \\u escapes)', async () => {
  const res = await fetch(`${base}/zh/about`);
  const text = await res.text();
  assert.ok(text.includes('聖地牙哥中華學苑'), 'should contain UTF-8 Chinese');
  assert.ok(!text.includes('\\u'), 'should not contain \\u escape sequences');
});
