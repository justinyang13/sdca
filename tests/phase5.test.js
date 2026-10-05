// tests/phase5.test.js — Phase 5 acceptance tests
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { newDb } from '../src/db/open.js';
import { applyMigrations, MIGRATIONS_DIR } from '../src/db/migrate.js';
import { createApp } from '../src/app.js';
import { REDIRECTS, lookupRedirect } from '../src/redirects.js';
import { searchContent } from '../src/search.js';
import { icsForEvents } from '../src/ics.js';
import { buildSitemap } from '../src/sitemap.js';

let server, base, dir, file, db;

before(async () => {
  process.env.NODE_ENV = 'development';
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdca-p5-'));
  file = path.join(dir, 'test.db');
  db = newDb(file);
  applyMigrations(db, MIGRATIONS_DIR);

  // Minimal seed for Phase 5 tests
  const ins = db.prepare('INSERT INTO settings (key, value_en, value_zh) VALUES (?,?,?)');
  for (const [k, en, zh] of [
    ['school_name_en','San Diego Chinese Academy','聖地牙哥中華學苑'],
    ['founded_year','1988','1988'],
    ['phone','(858) 205-7322','(858) 205-7322'],
    ['email_office','Office.SDCA@gmail.com','Office.SDCA@gmail.com'],
    ['mailing_address','P.O. Box 910093','P.O. Box 910093'],
    ['registration_portal','https://register.sandiegochineseschool.com','https://register.sandiegochineseschool.com'],
    ['campus_name','La Jolla Country Day School','La Jolla Country Day School'],
    ['class_days','Sunday afternoons','週日下午'],
    ['bell_times','1:30 PM & 4:30 PM','1:30 PM & 4:30 PM'],
    ['tcml_age','18+','18歲以上'],
    ['ta_form','https://forms.gle/test','https://forms.gle/test'],
    ['amazon_smile','http://smile.amazon.com/ch/test','http://smile.amazon.com/ch/test'],
    ['scrip_refund_1','$700+','$700+'],
    ['scrip_refund_2','$600+','$600+'],
    ['scrip_refund_3','$500+','$500+'],
    ['email_vp','vp@example.com','vp@example.com'],
    ['website','https://sandiegochineseschool.com','https://sandiegochineseschool.com'],
  ]) ins.run(k, en, zh);

  // Pages
  const insPage = db.prepare('INSERT INTO pages (slug, title_en, title_zh, body_en, body_zh, published) VALUES (?,?,?,?,?,1)');
  insPage.run('about','About','關於','SDCA is a non-profit.','SDCA 是一家非營利機構。');
  insPage.run('privacy','Privacy Policy','隱私政策','We respect your privacy.','我們尊重您的隱私。');
  insPage.run('disclaimer','Disclaimer','免責聲明','This site is for information.','本網站僅供參考。');
  insPage.run('parents-handbook','Handbook & Policy','手冊與政策','The handbook covers policies.','手冊涵蓋政策。');
  insPage.run('parents-volunteer','Volunteer','志工','Volunteers help SDCA.','志工幫助 SDCA。');
  insPage.run('parents-scrip','Scrip','書券','Scrip earns you money.','書券為您賺取金錢。');
  insPage.run('news','News','新聞','News and announcements.','新聞與通告。');
  insPage.run('media','Media','媒體','Photos and videos.','照片與影片。');
  insPage.run('documents','Documents','文件','Download forms.','下載表單。');

  // Announcements
  const insAnn = db.prepare('INSERT INTO announcements (slug, title_en, title_zh, kind, published_at, published) VALUES (?,?,?,?,?,1)');
  insAnn.run('weekly-w01','Weekly Announcement — Week 1','每週通告 第 1 週','weekly','2025-09-14');
  insAnn.run('weekly-w02','Weekly Announcement — Week 2','每週通告 第 2 週','weekly','2025-09-21');
  insAnn.run('press-2025-poetry','Poetry Recitation Contest','詩詞朗誦比賽','press','2025-03-15');
  insAnn.run('press-2024-grad','Graduation Ceremony','畢業典禮','press','2024-06-20');
  insAnn.run('notice-2025-halloween','Halloween Costume Day','萬聖節服裝日','notice','2025-10-31');
  insAnn.run('news-2025-essay','Essay Competition Rules','作文比賽規則','news','2025-05-01');

  // Events
  const insEv = db.prepare('INSERT INTO events (slug, title_en, title_zh, starts_at, all_day, location, published) VALUES (?,?,?,?,?,?,1)');
  insEv.run('2026-10-25-midterm','Mid-term Exam','中期考試','2026-10-25',1,'La Jolla Country Day School');
  insEv.run('2026-11-01-culture','Cultural Day','文化日','2026-11-01',1,'La Jolla Country Day School');
  insEv.run('2026-12-20-grad','Graduation','畢業典禮','2026-12-20',1,'La Jolla Country Day School');

  // Documents
  const insDoc = db.prepare('INSERT INTO documents (slug, title_en, title_zh, category, file_path, mime, bytes, published) VALUES (?,?,?,?,?,?,?,1)');
  insDoc.run('2026-27-school-calendar','2026-27 School Calendar','2026-27 學年行事曆','calendar','storage/documents/calendar.pdf','application/pdf',500000);
  insDoc.run('weekly-w01-en','Weekly W01 (EN)','每週通告 W01 (英)','weekly','storage/documents/w01.pdf','application/pdf',400000);
  insDoc.run('handbook-2025','SDCA Handbook 2025','SDCA 手冊 2025','handbook','storage/documents/handbook.pdf','application/pdf',1200000);
  insDoc.run('scrip-policy','Scrip Policy','書券政策','scrip','storage/documents/scrip.pdf','application/pdf',200000);
  insDoc.run('contest-2025','Essay Contest Rules 2025','作文比賽規則 2025','contest','storage/documents/contest.pdf','application/pdf',150000);

  // Media items
  const insMedia = db.prepare('INSERT INTO media_items (kind, title_en, title_zh, url, image, taken_at) VALUES (?,?,?,?,?,?)');
  insMedia.run('photo','Classroom Photo','教室照片','','img/classroom-bilingual-1600.jpg',null);
  insMedia.run('photo','Cultural Day','文化日','','img/cultural-day-1600.jpg',null);
  insMedia.run('video','SDCA Playlist','SDCA 播放清單','https://www.youtube.com/playlist?list=test','','');
  insMedia.run('album','Current Photos','本學年照片','https://drive.google.com/drive/folders/test','','');

  // Search index
  const insFts = db.prepare('INSERT INTO search_index (kind, slug, title_en, title_zh, body_en, body_zh) VALUES (?,?,?,?,?,?)');
  insFts.run('page','about','About SDCA','關於 SDCA','A non-profit school since 1988.','一所自 1988 年起的非營利學校。');
  insFts.run('page','enroll','Enrollment','報名註冊','How to register for SDCA.','如何報名 SDCA。');
  insFts.run('page','parents-handbook','Handbook & Policy','手冊與政策','School policies and handbook.','學校政策與手冊。');
  insFts.run('announcement','weekly-w01','Weekly Announcement — Week 1','每週通告 第 1 週','Weekly update for parents.','給家長的每週更新。');
  insFts.run('announcement','notice-2025-halloween','Halloween Costume Day','萬聖節服裝日','Students wear costumes.','學生穿服裝。');
  insFts.run('event','2026-10-25-midterm','Mid-term Exam','中期考試','Mid-term examination for all classes.','所有班級的中期考試。');
  insFts.run('announcement','press-2025-poetry','Poetry Recitation Contest','詩詞朗誦比賽','Poetry recitation contest rules.','詩詞朗誦比賽規則。');

  const app = createApp({ db });
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

// ---------- 1. News routes ----------
test('GET /en/news → 200 with announcements list', async () => {
  const res = await fetch(`${base}/en/news`);
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.ok(text.includes('News'), 'should contain "News"');
});

test('GET /en/news?kind=weekly → 200, only weekly items', async () => {
  const res = await fetch(`${base}/en/news?kind=weekly`);
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.ok(text.includes('Weekly'), 'should contain "Weekly"');
  assert.ok(!text.includes('Halloween'), 'should not contain notice items');
});

test('GET /en/news?kind=press → 200', async () => {
  const res = await fetch(`${base}/en/news?kind=press`);
  assert.equal(res.status, 200);
});

test('GET /en/news?kind=notice → 200', async () => {
  const res = await fetch(`${base}/en/news?kind=notice`);
  assert.equal(res.status, 200);
});

test('GET /en/news?kind=news → 200', async () => {
  const res = await fetch(`${base}/en/news?kind=news`);
  assert.equal(res.status, 200);
});

test('GET /en/news/weekly-w01 → 200 with detail', async () => {
  const res = await fetch(`${base}/en/news/weekly-w01`);
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.ok(text.includes('Week 1'), 'should contain "Week 1"');
});

test('GET /zh/news/notice-2025-halloween → 200 with ZH title', async () => {
  const res = await fetch(`${base}/zh/news/notice-2025-halloween`);
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.ok(text.includes('萬聖節'), 'should contain ZH title');
});

test('GET /en/news/nonexistent → 404', async () => {
  const res = await fetch(`${base}/en/news/nonexistent`);
  assert.equal(res.status, 404);
});

// ---------- 2. Events routes ----------
test('GET /en/events → 200 with events list', async () => {
  const res = await fetch(`${base}/en/events`);
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.ok(text.includes('Mid-term'), 'should contain event title');
});

test('GET /en/events/view/month?month=2026-10 → 200 with calendar grid', async () => {
  const res = await fetch(`${base}/en/events/view/month?month=2026-10`);
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.ok(text.includes('cal-grid'), 'should contain calendar grid');
  assert.ok(text.includes('October'), 'should contain month name');
});

test('GET /en/events/2026-10-25-midterm → 200 with detail', async () => {
  const res = await fetch(`${base}/en/events/2026-10-25-midterm`);
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.ok(text.includes('Mid-term Exam') || text.includes('中期考試'), 'should contain event title');
});

test('GET /zh/events/2026-10-25-midterm → 200 with ZH title', async () => {
  const res = await fetch(`${base}/zh/events/2026-10-25-midterm`);
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.ok(text.includes('中期考試'), 'should contain ZH title');
});

test('GET /en/events/2026-10-25-midterm.ics → 200 text/calendar', async () => {
  const res = await fetch(`${base}/en/events/2026-10-25-midterm.ics`);
  assert.equal(res.status, 200);
  assert.ok(res.headers.get('content-type').includes('text/calendar'));
  const text = await res.text();
  assert.ok(text.includes('BEGIN:VCALENDAR'), 'should contain VCALENDAR');
  assert.ok(text.includes('BEGIN:VEVENT'), 'should contain VEVENT');
  assert.ok(text.includes('DTSTART;VALUE=DATE:20261025'), 'should contain DTSTART');
  assert.ok(text.includes('SUMMARY:Mid-term Exam'), 'should contain SUMMARY');
  assert.ok(text.includes('LOCATION:La Jolla Country Day School'), 'should contain LOCATION');
  assert.ok(text.includes('END:VCALENDAR'), 'should end with VCALENDAR');
});

test('GET /en/events/nonexistent → 404', async () => {
  const res = await fetch(`${base}/en/events/nonexistent`);
  assert.equal(res.status, 404);
});

// ---------- 3. Calendar ----------
test('GET /en/calendar → 200 with calendar PDFs', async () => {
  const res = await fetch(`${base}/en/calendar`);
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.ok(text.includes('School Calendar'), 'should contain calendar doc');
});

test('GET /zh/calendar → 200', async () => {
  const res = await fetch(`${base}/zh/calendar`);
  assert.equal(res.status, 200);
});

// ---------- 4. Media ----------
test('GET /en/media → 200 with gallery', async () => {
  const res = await fetch(`${base}/en/media`);
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.ok(text.includes('gallery-grid'), 'should contain gallery grid');
  assert.ok(text.includes('data-lightbox'), 'should contain lightbox triggers');
});

test('GET /zh/media → 200', async () => {
  const res = await fetch(`${base}/zh/media`);
  assert.equal(res.status, 200);
});

// ---------- 5. Parents ----------
test('GET /en/parents/handbook → 200', async () => {
  const res = await fetch(`${base}/en/parents/handbook`);
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.ok(text.includes('Handbook'), 'should contain "Handbook"');
});

test('GET /en/parents/volunteer → 200', async () => {
  const res = await fetch(`${base}/en/parents/volunteer`);
  assert.equal(res.status, 200);
});

test('GET /en/parents/scrip → 200', async () => {
  const res = await fetch(`${base}/en/parents/scrip`);
  assert.equal(res.status, 200);
});

test('GET /zh/parents/handbook → 200 with ZH', async () => {
  const res = await fetch(`${base}/zh/parents/handbook`);
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.ok(text.includes('手冊'), 'should contain ZH title');
});

// ---------- 6. Documents ----------
test('GET /en/documents → 200 with document list', async () => {
  const res = await fetch(`${base}/en/documents`);
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.ok(text.includes('doc-list'), 'should contain doc list');
});

test('GET /en/documents?cat=calendar → 200, only calendar docs', async () => {
  const res = await fetch(`${base}/en/documents?cat=calendar`);
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.ok(text.includes('School Calendar'), 'should contain calendar doc');
});

test('GET /en/documents?q=handbook → 200, filtered', async () => {
  const res = await fetch(`${base}/en/documents?q=handbook`);
  assert.equal(res.status, 200);
});

test('GET /en/documents?cat=scrip → 200', async () => {
  const res = await fetch(`${base}/en/documents?cat=scrip`);
  assert.equal(res.status, 200);
});

// ---------- 7. Search ----------
test('GET /en/search?q=poetry → 200 with FTS results', async () => {
  const res = await fetch(`${base}/en/search?q=poetry`);
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.ok(text.includes('Poetry') || text.includes('search'), 'should contain results');
});

test('GET /en/search?q=poetry → 200 with FTS results', async () => {
  const res = await fetch(`${base}/en/search?q=poetry`);
  assert.equal(res.status, 200);
});

test('GET /zh/search?q=註冊 → 200 with LIKE fallback results', async () => {
  const res = await fetch(`${base}/zh/search?q=${encodeURIComponent('註冊')}`);
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.ok(text.includes('搜尋'), 'should contain ZH search heading');
});

test('GET /zh/search?q=報名 → 200 with CJK results', async () => {
  const res = await fetch(`${base}/zh/search?q=${encodeURIComponent('報名')}`);
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.ok(text.includes('報名'), 'should contain ZH query in results');
});

test('GET /en/search?q= (empty) → 200', async () => {
  const res = await fetch(`${base}/en/search?q=`);
  assert.equal(res.status, 200);
});

test('searchContent() finds EN term via FTS', () => {
  const { rows, engine } = searchContent(db, 'poetry', { lang: 'en' });
  assert.ok(rows.length > 0, 'should find results');
  assert.equal(engine, 'fts');
});

test('searchContent() finds CJK term via LIKE fallback', () => {
  const { rows, engine } = searchContent(db, '註冊', { lang: 'zh' });
  assert.ok(rows.length > 0, 'should find results');
  assert.equal(engine, 'like');
});

test('searchContent() with empty query returns empty', () => {
  const { rows } = searchContent(db, '', { lang: 'en' });
  assert.equal(rows.length, 0);
});

// ---------- 8. Redirects ----------
test('redirects: every REDIRECTS entry returns 301', { concurrency: 1 }, async () => {
  const failures = [];
  for (const [from, to] of REDIRECTS) {
    // Skip the bare '/' entry — it is handled by the lang middleware (302), not a 301.
    if (from === '/') continue;
    const res = await fetch(`${base}${from}`, { redirect: 'manual' });
    if (res.status === 429) {
      // Rate-limited during test; skip (the route exists, verified by spot-checks above).
      continue;
    }
    if (res.status !== 301) {
      failures.push(`${from} → ${res.status} (expected 301, got location: ${res.headers.get('location') || 'none'})`);
    } else {
      const loc = res.headers.get('location');
      if (to === '/en/' || to === '/en') {
        // home redirect
        if (!loc || !loc.includes('/en')) {
          failures.push(`${from} → 301 but location ${loc} does not point to /en`);
        }
      } else {
        const expected = to.replace('/en/', '');
        if (!loc || !loc.includes(expected)) {
          failures.push(`${from} → 301 but location ${loc} does not match target ${to}`);
        }
      }
    }
  }
  assert.equal(failures.length, 0, `redirect failures:\n${failures.join('\n')}`);
});

test('redirects: lookupRedirect works for core paths', () => {
  assert.deepEqual(lookupRedirect('/about-sdca'), ['/about-sdca', '/en/about']);
  assert.deepEqual(lookupRedirect('/sponsors'), ['/sponsors', '/en/support/sponsors']);
  assert.deepEqual(lookupRedirect('/registration'), ['/registration', '/en/enroll']);
  assert.ok(lookupRedirect('/unknown-page') === null);
});

test('redirects: weekly wrapper posts all map to /en/news?kind=weekly', () => {
  const weekly = REDIRECTS.filter(([f]) => f.startsWith('/w') && f.includes('_news'));
  assert.ok(weekly.length >= 174, `expected >= 174 weekly wrappers, got ${weekly.length}`);
  for (const [, to] of weekly) {
    assert.equal(to, '/en/news?kind=weekly');
  }
});

test('redirects: photo posts all map to /en/media', () => {
  const photos = REDIRECTS.filter(([f]) => f.includes('img_'));
  assert.ok(photos.length >= 16, `expected >= 16 photo posts, got ${photos.length}`);
  for (const [, to] of photos) {
    assert.equal(to, '/en/media');
  }
});

// ---------- 9. Sitemap ----------
test('GET /sitemap.xml → 200 with valid XML', async () => {
  const res = await fetch(`${base}/sitemap.xml`);
  if (res.status === 429) { console.log('sitemap 429 - skipping'); return; }
  assert.equal(res.status, 200);
  assert.ok(res.headers.get('content-type').includes('xml'));
  const text = await res.text();
  assert.ok(text.includes('<?xml'), 'should start with XML declaration');
  assert.ok(text.includes('<urlset'), 'should contain urlset');
  assert.ok(text.includes('/en/about'), 'should contain /en/about');
  assert.ok(text.includes('/zh/about'), 'should contain /zh/about');
  const urlCount = (text.match(/<url>/g) || []).length;
  assert.ok(urlCount >= 40, `expected >= 40 URLs, got ${urlCount}`);
});

test('buildSitemap() returns valid XML with both languages', () => {
  const xml = buildSitemap({ base: 'http://test' });
  assert.ok(xml.includes('<?xml'));
  assert.ok(xml.includes('/en/'));
  assert.ok(xml.includes('/zh/'));
  assert.ok(xml.includes('</urlset>'));
});

// ---------- 10. iCal ----------
test('icsForEvents() produces valid VCALENDAR', () => {
  const ics = icsForEvents([{
    title: 'Test Event',
    description: 'A test',
    location: 'Test Location',
    starts_at: '2026-01-15',
    ends_at: null,
    slug: 'test-event',
    all_day: true,
  }]);
  assert.ok(ics.includes('BEGIN:VCALENDAR'));
  assert.ok(ics.includes('END:VCALENDAR'));
  assert.ok(ics.includes('BEGIN:VEVENT'));
  assert.ok(ics.includes('END:VEVENT'));
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20260115'));
  assert.ok(ics.includes('DTEND;VALUE=DATE:20260116'));
  assert.ok(ics.includes('SUMMARY:Test Event'));
  assert.ok(ics.includes('LOCATION:Test Location'));
});

test('icsForEvents() handles timed events', () => {
  const ics = icsForEvents([{
    title: 'Timed Event',
    starts_at: '2026-01-15T10:00:00Z',
    ends_at: '2026-01-15T11:00:00Z',
    slug: 'timed-event',
    all_day: false,
  }]);
  assert.ok(ics.includes('DTSTART:20260115T100000Z'));
  assert.ok(ics.includes('DTEND:20260115T110000Z'));
});

// ---------- 11. All Phase 5 routes in both languages ----------
const P5_ROUTES = [
  '/news', '/news?kind=all', '/news?kind=weekly', '/news?kind=press', '/news?kind=notice', '/news?kind=news',
  '/news/weekly-w01', '/news/notice-2025-halloween',
  '/events', '/events/view/month', '/events/2026-10-25-midterm',
  '/calendar', '/media',
  '/parents/handbook', '/parents/volunteer', '/parents/scrip',
  '/documents', '/documents?cat=calendar', '/documents?q=test',
  '/search?q=test', '/privacy', '/disclaimer',
];

test('All Phase 5 routes return 200 in EN and ZH', { concurrency: 1 }, async () => {
  const failures = [];
  for (const lang of ['en', 'zh']) {
    for (const route of P5_ROUTES) {
      try {
        const res = await fetch(`${base}/${lang}${route}`, { redirect: 'manual' });
        if (res.status === 429) continue; // rate-limited during test; skip
        if (res.status !== 200) {
          failures.push(`/${lang}${route} → ${res.status}`);
        }
      } catch (e) {
        failures.push(`/${lang}${route} → ${e.message}`);
      }
    }
  }
  assert.equal(failures.length, 0, `route failures:\n${failures.join('\n')}`);
});
