// tests/assets.test.js — smoke test: every local src/href/srcset on rendered
// /en/* and /zh/* pages must resolve to a file that actually serves 200.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { newDb } from '../src/db/open.js';
import { applyMigrations, MIGRATIONS_DIR } from '../src/db/migrate.js';
import { createApp } from '../src/app.js';

let server, base, dir, db;

const PAGES = [
  '/',
  '/about', '/about/board', '/about/staff', '/about/principal',
  '/programs', '/programs/classes', '/programs/tcml', '/programs/recreational', '/programs/ta',
  '/enroll', '/contact', '/support', '/support/sponsors',
];

function extractAssets(html) {
  const out = new Set();
  const attr = (re) => {
    for (const m of html.matchAll(re)) {
      const v = m[1].trim();
      if (!v || v.startsWith('http') || v.startsWith('https') || v.startsWith('mailto:')
        || v.startsWith('tel:') || v.startsWith('data:') || v.startsWith('javascript:')
        || v === '#') continue;
      // Strip query string / hash for file checks
      const clean = v.split('#')[0].split('?')[0];
      if (clean) out.add(clean.startsWith('/') ? clean : '/' + clean);
    }
  };
  attr(/src="([^"]+)"/g);
  attr(/href="([^"]+)"/g);
  // srcset: each entry is "url descriptor, url descriptor, ..."
  for (const m of html.matchAll(/srcset="([^"]+)"/g)) {
    for (const part of m[1].split(',')) {
      const url = part.trim().split(/\s+/)[0];
      if (!url || url.startsWith('http') || url.startsWith('data:')) continue;
      const clean = url.split('#')[0].split('?')[0];
      if (clean) out.add(clean.startsWith('/') ? clean : '/' + clean);
    }
  }
  return [...out];
}

before(async () => {
  process.env.NODE_ENV = 'development';
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdca-assets-'));
  const file = path.join(dir, 'test.db');
  db = newDb(file);
  applyMigrations(db, MIGRATIONS_DIR);

  // Minimal seed — enough to exercise the same code paths as production.
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('school_name_en','San Diego Chinese Academy','聖地牙哥中華學苑')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('school_name_zh','聖地牙哥中華學苑','聖地牙哥中華學苑')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('founded_year','1988','1988')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('phone','(858) 205-7322','(858) 205-7322')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('phone_digits','8582057322','8582057322')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('email_office','Office.SDCA@gmail.com','Office.SDCA@gmail.com')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('email_pta','sdca.board.vice.president@gmail.com','sdca.board.vice.president@gmail.com')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('mailing_address','P.O. Box 910093, San Diego, CA 92191-0093','P.O. Box 910093, San Diego, CA 92191-0093')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('registration_portal','https://register.sandiegochineseschool.com','https://register.sandiegochineseschool.com')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('campus_name','La Jolla Country Day School','La Jolla Country Day School')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('class_days','Sunday afternoons','週日下午')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('bell_times','1:30 PM & 4:30 PM','1:30 PM & 4:30 PM')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('tcml_age','18+','18歲以上')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('amazon_smile','http://smile.amazon.com/ch/33-0290580','http://smile.amazon.com/ch/33-0290580')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('scrip_refund_1','$700+','$700+')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('scrip_refund_2','$600+','$600+')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('scrip_refund_3','$500+','$500+')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('ta_form','https://forms.gle/HmuYPR5RXbAYGsHh9','https://forms.gle/HmuYPR5RXbAYGsHh9')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('tcml_form','https://forms.gle/HmuYPR5RXbAYGsHh9','https://forms.gle/HmuYPR5RXbAYGsHh9')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('website','https://sandiegochineseschool.com','https://sandiegochineseschool.com')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('org_type','California non-profit','加州非營利機構')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('accreditation','CA Dept. of Education','加州教育局')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('campus_since','2012','2012')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('original_campus','San Diego State University','聖地牙哥州立大學')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('tcml_established','1995','1995')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('sms_number','8582057322','8582057322')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('sms_keyword','SDCA','SDCA')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('registration_new','https://register.sandiegochineseschool.com/new','https://register.sandiegochineseschool.com/new')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('registration_returning','https://register.sandiegochineseschool.com/returning','https://register.sandiegochineseschool.com/returning')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('mail_registration','Office.SDCA@gmail.com','Office.SDCA@gmail.com')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('first_day_2026_27','Sep 1, 2026','2026年9月1日')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('dance_fee_dropin','$15','$15')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('dance_fee_punch5','$60','$60')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('dance_fee_punch10','$110','$110')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('scrip_fee','N/A','N/A')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('scrip_refund','See support page','詳見支持頁')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('scrip_contact','Office.SDCA@gmail.com','Office.SDCA@gmail.com')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('scrip_hours','Mon-Fri 9-5','週一至五 9-5')").run();
  db.prepare("INSERT INTO settings (key, value_en, value_zh) VALUES ('email_vp','sdca.board.vice.president@gmail.com','sdca.board.vice.president@gmail.com')").run();

  const pageSlugs = ['about','about-board','about-staff','about-principal','programs','programs-classes','programs-tcml','programs-recreational','programs-ta','enroll','support','support-sponsors'];
  const ins = db.prepare("INSERT INTO pages (slug, title_en, title_zh, body_en, body_zh, published) VALUES (?,?,?,?,?,1)");
  for (const s2 of pageSlugs) ins.run(s2, 'T','T','B','B');

  // Programs with images that DO exist on disk (root-absolute after imgUrl()).
  const prog = [
    ['pre-k','Pre-K','學前班','Pre-K','學前班','d','d','','','','',1,'img/preschool-class-1600.jpg'],
    ['beginner','Beginner','初級','Beg','初級','d','d','','','','',2,'img/beginner-class-1600.jpg'],
    ['regular','Regular','普通','Reg','普通','d','d','','','','',3,'img/regular-class-1600.jpg'],
    ['yoga','Yoga','瑜伽','Adult','成人','d','d','','','','',4,'img/yoga-class-960.jpg'],
  ];
  const insP = db.prepare("INSERT INTO programs (slug,name_en,name_zh,grades_en,grades_zh,description_en,description_zh,schedule_en,schedule_zh,tuition_en,tuition_zh,sort,image) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)");
  for (const r of prog) insP.run(...r);

  const app = createApp({ db });
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('every local asset on /en and /zh pages returns 200', async (t) => {
  const publicRoot = path.resolve('public');
  const failures = [];
  const seen = new Set();

  for (const lang of ['en', 'zh']) {
    for (const route of PAGES) {
      const res = await fetch(`${base}/${lang}${route}`);
      assert.equal(res.status, 200, `GET /${lang}${route} should be 200`);
      const html = await res.text();
      for (const url of extractAssets(html)) {
        // Skip internal anchors / non-file routes
        if (url === '/' || url === '#' || !/^(\/(img|css|js|brand|favicon)\/)/.test(url)) continue;
        if (seen.has(url)) continue;
        seen.add(url);
        const key = `${lang}${route} → ${url}`;
        const filePath = path.join(publicRoot, url);
        if (!fs.existsSync(filePath)) {
          failures.push({ key, reason: 'missing file' });
          continue;
        }
        const served = await fetch(`${base}${url}`);
        if (served.status !== 200) failures.push({ key, reason: `served ${served.status}` });
      }
    }
  }

  if (failures.length) {
    const lines = failures.slice(0, 40).map(f => `  ${f.key}  [${f.reason}]`).join('\n');
    throw new Error(`${failures.length} broken assets:\n${lines}`);
  }
});

test('no relative asset paths in rendered HTML', async () => {
  // The defect that was in production: <img src="img/..."> (relative) which
  // 404s when the page URL is /zh/ or /en/about.
  for (const lang of ['en', 'zh']) {
    const html = await (await fetch(`${base}/${lang}/`)).text();
    const bad = html.match(/(src|href)="(?!\/|https?:|mailto:|tel:|#|data:)[^/"]*\/[^"]*\.(png|jpg|jpeg|svg|webp|gif|css|js|ico)(\?[^"]*)?"/gi) || [];
    assert.equal(bad.length, 0, `relative asset paths found on /${lang}/: ${bad.slice(0,5).join(' | ')}`);
  }
});
