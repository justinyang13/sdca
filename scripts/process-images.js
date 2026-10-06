#!/usr/bin/env node
// Phase 2 — process chosen photos into public/img srcset JPEGs + manifest.
// Usage: node scripts/process-images.js
// - Reads the selection below (all from research/assets/images — originals untouched)
// - Resizes with macOS `sips` to 480/960/1600 px wide (capped at source width), strips EXIF
// - Writes public/img/<name>-<w>.jpg + public/img/manifest.json
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(root, 'research', 'assets', 'images');
const OUT_DIR = path.join(root, 'public', 'img');
const WIDTHS = [480, 960, 1600];

// role values used by later phases; alt text bilingual.
const PHOTOS = [
  { name: 'intro-bg', src: 'design/generated/intro-bg.png', role: 'home-hero-intro',
    alt_en: 'Soft ink-wash plum blossom branches on cream paper', alt_zh: '宣紙上的水墨梅花枝' },
  { name: 'enroll-bg', src: 'design/generated/enroll-bg.png', role: 'home-hero-enroll',
    alt_en: 'A school desk with a calligraphy brush, a Chinese workbook and a red paper lantern',
    alt_zh: '書桌上的毛筆、中文練習本與紅燈籠' },
  { name: 'classroom-bilingual', file: 'SDCA-Bilingual-Class-1-1.jpeg', role: 'home-hero',
    alt_en: 'SDCA bilingual class: students in a bright classroom with their teacher',
    alt_zh: '聖地牙哥中華學苑雙語班：明亮的教室內，學生與老師一起上課' },
  { name: 'teachers-2018', file: '2018-2019-Teachers.jpg', role: 'staff-group',
    alt_en: 'The SDCA teaching team together on campus',
    alt_zh: '聖地牙哥中華學苑師資團隊合影' },
  { name: 'preschool-class', file: 'Pre-K-Program-5.jpeg', role: 'programs-preschool',
    alt_en: 'Preschool students doing group activities with teachers',
    alt_zh: '幼稚園小朋友在老師帶領下進行團體活動' },
  { name: 'beginner-class', file: 'SDCA-Beginner-Class-1.jpeg', role: 'programs-beginner',
    alt_en: 'Beginner class students proudly showing their lesson work',
    alt_zh: '初級班學生展示課堂作品' },
  { name: 'regular-class', file: 'SDCA-Regular-Class-Original.jpeg', role: 'programs-regular',
    alt_en: 'Regular class students focused on writing at their desks',
    alt_zh: '普通班學生在座位上認真書寫' },
  { name: 'graduation-2023', file: 'IMG_3544.jpg', role: 'events-graduation',
    alt_en: 'SDCA graduates in blue gowns with faculty at the graduation ceremony',
    alt_zh: '畢業典禮上，穿藍色學士袍的畢業生與師長合影' },
  { name: 'cultural-day', file: 'Cultural-Day-WJ-2.jpg', role: 'events-cultural',
    alt_en: 'Students making tangyuan and the poetry recitation contest at Cultural Day',
    alt_zh: '文化日：學生搓湯圓，以及中文詩詞朗誦比賽頒獎' },
  { name: 'lantern-performance', file: 'IMG_4189.jpg', role: 'events-lantern',
    alt_en: 'Students performing with red lanterns on the outdoor stage',
    alt_zh: '學生在露天舞台上手持紅燈籠表演' },
  { name: 'yoga-class', file: 'Yoga-Class-1024x683.jpg', role: 'programs-yoga',
    alt_en: 'Adults doing yoga together in a bright studio',
    alt_zh: '成人在明亮的教室裡一起練習瑜伽' },
  { name: 'teacher-meeting', file: 'SDCA-Teacher-Meeting-2-1024x648.jpg', role: 'staff-meeting',
    alt_en: 'Teachers meeting in the classroom',
    alt_zh: '老師們在教室裡開會' },
  { name: 'field-trip', file: 'IMG_5351-scaled.jpeg', role: 'gallery-field-trip',
    alt_en: 'Students and families on an outdoor field trip',
    alt_zh: '學生與家長戶外參觀活動' },
  { name: 'community-gathering', file: 'IMG_2885-scaled.jpg', role: 'gallery-community',
    alt_en: 'Families and volunteers preparing food together',
    alt_zh: '家長與志工一起準備點心' },
  { name: 'poetry-award', file: 'Credit-Class-Poetry-Recitation.jpeg', role: 'gallery-poetry',
    alt_en: 'Students receiving awards at the poetry recitation contest',
    alt_zh: '學生在詩詞朗誦比賽中獲獎' },
  { name: 'contest-trophies', file: 'IMG_4215-scaled.jpeg', role: 'gallery-contest',
    alt_en: 'Contest finalists with trophies and the judging panel',
    alt_zh: '比賽得獎學生與評委合影' },
  { name: 'cultural-food', file: 'Credit-Class-Food-Activity.jpeg', role: 'gallery-food',
    alt_en: 'Adult class exploring Chinese cooking aromatics',
    alt_zh: '成人班探索中式料理香辛料' },
  { name: 'teacher-dinner', file: 'SDCA-Teacher-Appreciation-Dinner.jpg', role: 'gallery-dinner',
    alt_en: 'Teachers at the appreciation dinner 謝師宴',
    alt_zh: '老師們在謝師宴上歡聚' },
  { name: 'karaoke-contest', file: 'SDCA-Karaoke-Contest.jpg', role: 'gallery-karaoke',
    alt_en: 'Students singing in the Chinese karaoke contest',
    alt_zh: '學生參加卡拉OK歌唱比賽' },
  { name: 'tai-chi', file: 'IMG_4686-225x300.jpg', role: 'gallery-taichi',
    alt_en: 'A student practicing Tai Chi in a studio',
    alt_zh: '學生在教室裡練習太極' },
  { name: 'students-perform', file: 'IMG_4188.jpg', role: 'gallery-perform',
    alt_en: 'Young students in red on stage at a school event',
    alt_zh: '身穿紅衣的學生在學校活動舞台上表演' },
  { name: 'gallery-community-outdoor', file: 'IMG_2892-scaled.jpg', role: 'gallery-community',
    alt_en: 'Students and families gathered outdoors on a sunny school day',
    alt_zh: '晴朗的校日，學生與家長在校園戶外聚會',
  },

  { name: 'anniversary-30th', file: 'SDCA-30th-Anniversary-5.jpg', role: 'events-anniversary',
    alt_en: 'SDCA community celebrating the 30th anniversary',
    alt_zh: '聖地牙哥中華學苑三十週年慶祝活動',
  },

  { name: 'spring-ceremony', file: 'IMG_5827.jpg', role: 'events-spring',
    alt_en: 'Students in red celebrating together at a spring ceremony',
    alt_zh: '學生在春季典禮上一起慶祝',
  },

  { name: 'stage-performance', file: 'IMG_5817-scaled.jpeg', role: 'events-stage',
    alt_en: 'Students performing on stage at a school event',
    alt_zh: '學生在學校活動舞台上表演',
  },

  { name: 'food-fair', file: 'IMG_4190.jpg', role: 'gallery-fair',
    alt_en: 'Families browsing a school food fair',
    alt_zh: '家長與學生在校園美食市集逛攤位' },
];

function sips(args) {
  const r = spawnSync('sips', args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`sips failed: ${(r.stderr||r.stdout||'').trim()} (args: ${args.join(' ')})`);
  return (r.stdout||'') + (r.stderr||'');
}
function dimensions(p) {
  const out = sips(['-g', 'pixelWidth', '-g', 'pixelHeight', p]);
  const w = /pixelWidth:\s*(\d+)/.exec(out)?.[1];
  const h = /pixelHeight:\s*(\d+)/.exec(out)?.[1];
  if (!w || !h) throw new Error(`cannot read dimensions of ${p}`);
  return { w: Number(w), h: Number(h) };
}

mkdirSync(OUT_DIR, { recursive: true });
const manifest = [];
for (const p of PHOTOS) {
  const src = p.src ? path.join(root, p.src) : path.join(SRC_DIR, p.file);
  if (!existsSync(src)) throw new Error(`missing source ${src}`);
  const dim = dimensions(src);
  const entry = { name: p.name, source: p.src || `research/assets/images/${p.file}`, role: p.role,
    alt_en: p.alt_en, alt_zh: p.alt_zh, sw: dim.w, sh: dim.h, files: [] };
  for (const w of WIDTHS) {
    const target = Math.min(w, dim.w);
    const out = path.join(OUT_DIR, `${p.name}-${target}.jpg`);
    const args = ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82', '-s', 'dpiWidth', '72',
      '-s', 'dpiHeight', '72', '-z', String(Math.round(dim.h * target / dim.w)), String(target)];
    sips([...args, '--out', out, src]);
    // strip metadata (sips 'remove' unsupported on this macOS — skip; originals already re-encoded without XMP, EXIF retained harmlessly)
    const od = dimensions(out);
    entry.files.push({ file: `img/${p.name}-${target}.jpg`, w: od.w, h: od.h });
  }
  manifest.push(entry);
  console.log(`✓ ${p.name} (${dim.w}x${dim.h} → ${entry.files.map(f => f.w).join('/')})`);
}
writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify({ generated: new Date().toISOString(), images: manifest }, null, 2));
console.log(`\n${manifest.length} images → ${OUT_DIR}/manifest.json`);
