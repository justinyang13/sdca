// Phase 3 — documents table (85 crawled PDFs + 4 portal PDFs, deduped by sha256)
// Sources: research/data/assets.json (85 PDFs, sha256 included) +
//          research/wiki/pages/registration.md (4 portal PDFs) +
//          wiki page files for titles/categories.
// Duplicate downloads (identical sha256) collapse to one row.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { copyPdf, PORTAL_DIR } from './seed-helpers.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ASSETS_JSON = path.join(ROOT, 'research', 'data', 'assets.json');

// Clean ASCII slugs + bilingual titles + category, keyed by source filename.
// Titles come from the wiki (assets.md, handbook/scrip/registration page files).
const META = {
  // calendars & schedules
  '2026-27_School_Calendar.pdf':            { slug: '2026-27-school-calendar',            title_en: '2026-27 School Calendar',              title_zh: '2026-27學年行事曆',                     category: 'calendar',    year: '2026-27' },
  '2025-2026_School_Calendar-03152026.pdf': { slug: '2025-2026-school-calendar',          title_en: '2025-2026 School Calendar',          title_zh: '2025-2026學年行事曆',                   category: 'calendar',    year: '2025-26' },
  '2026_2027_Classroom-Map.pdf':            { slug: '2026-2027-classroom-map',            title_en: '2026-2027 Classroom Map',            title_zh: '2026-2027教室座位圖',                   category: 'calendar',    year: '2026-27' },
  '2018-2019-P07_Textbook_list_20180831.pdf':{ slug: '2018-2019-textbook-list',           title_en: '2018-2019 Textbook List',            title_zh: '2018-2019課本清單',                     category: 'calendar',    year: '2018-19' },
  'Class-Schedule.pdf':                     { slug: 'class-schedule',                     title_en: 'Class Schedule (Bell Schedule)',     title_zh: '上課時間表',                           category: 'calendar',    year: '' },
  'Student-Store-Schedule.pdf':             { slug: 'student-store-schedule',             title_en: 'Student Store Schedule',             title_zh: '學生商店時間表',                       category: 'calendar',    year: '' },
  // handbook & policy
  'SDCAParentHandbook.pdf':                 { slug: 'parent-handbook',                    title_en: 'Parent Handbook',                    title_zh: '家長須知',                             category: 'handbook',    year: '' },
  'student_handbook.pdf':                   { slug: 'student-handbook',                   title_en: 'Student Handbook',                   title_zh: '學生守則',                             category: 'handbook',    year: '' },
  'Credit_Student_Handbook.pdf':            { slug: 'credit-class-rules',                 title_en: 'Credit Class Attendance and Grading Guidelines', title_zh: '學分班規則',             category: 'handbook',    year: '' },
  'Policy-for-Guest-Students.pdf':          { slug: 'policy-guest-students',              title_en: 'Policy for Guest Students',            title_zh: '旁聽生收費及管理辦法',                 category: 'handbook',    year: '' },
  'Second-Semester-Late-Registration-Policy.pdf':
                                           { slug: 'policy-second-semester-late-registration',
                                             title_en: 'Policy for Second Semester Late Registration', title_zh: '特殊註冊收費辦法',  category: 'handbook',    year: '' },
  // forms
  'Expense-Reimbursement-Request-Form.pdf': { slug: 'expense-reimbursement-form',         title_en: 'Expense Reimbursement Form',           title_zh: '費用支出申報表',                     category: 'form',        year: '' },
  // class info
  'Pre-K-Intro-2016.pdf':                   { slug: 'pre-k-intro',                        title_en: 'Pre-K Program Introduction',           title_zh: '學前班簡介',                         category: 'class-info',  year: '2016' },
  'Beginner-Class.pdf':                     { slug: 'beginner-class',                     title_en: 'Beginner Class Information',           title_zh: '入門班課程簡介',                     category: 'class-info',  year: '2016' },
  '2016-Class-Info-Regular-Class-1.pdf':    { slug: 'regular-class-info',                 title_en: 'Regular Class Information',            title_zh: '普通班課程簡介',                     category: 'class-info',  year: '2016' },
  '2016-Class-Info-Bilingual-Class.pdf':    { slug: 'bilingual-class-info',               title_en: 'Bilingual Class Information',          title_zh: '雙語班課程簡介',                     category: 'class-info',  year: '2016' },
  'Credit-Class.pdf':                       { slug: 'credit-class-info',                  title_en: 'Credit Class Information',             title_zh: '學分班課程簡介',                     category: 'class-info',  year: '' },
  // scrip
  'Scrip-Program.pdf':                      { slug: 'scrip-program',                      title_en: 'Scrip Program',                      title_zh: '禮券計畫說明',                       category: 'scrip',       year: '' },
  'Scrip_20Schedule.pdf':                   { slug: 'scrip-schedule',                     title_en: 'Scrip Schedule',                     title_zh: '禮券日時間表',                       category: 'scrip',       year: '' },
  'Scrip_20Logos.pdf':                      { slug: 'scrip-sponsors',                     title_en: 'Scrip Sponsors',                     title_zh: '禮券贊助商家',                       category: 'scrip',       year: '' },
  'Transaction-History.pdf':                { slug: 'scrip-transaction-history',          title_en: 'Scrip Transactions',                 title_zh: '禮券交易紀錄',                       category: 'scrip',       year: '' },
  // registration (main-domain copies)
  'Registration_20Notice_20Chinese.pdf':    { slug: 'registration-notice-chinese',        title_en: 'Registration Notice (Chinese)',        title_zh: '註冊須知與網路註冊說明',             category: 'registration', year: '' },
  'Registration_20Notice_20English.pdf':    { slug: 'registration-notice-english',        title_en: 'Registration Notice (English)',        title_zh: '註冊須知與網路註冊說明',             category: 'registration', year: '' },
  // portal PDFs (research/assets/pdf/registration-portal/)
  'reg_notice.pdf':                         { slug: 'reg-notice',                         title_en: 'Registration Notice & Online Registration FAQ', title_zh: '註冊須知與網上註冊常見問答集', category: 'registration', year: '' },
  'reg_Registration_Notice_Chinese.pd.pdf': { slug: 'reg-notice-chinese',                 title_en: 'Registration Notice (Chinese)',        title_zh: '註冊須知（中文版）',                 category: 'registration', year: '' },
  'reg_Online_Registration_User_Guide.pdf': { slug: 'reg-online-registration-user-guide', title_en: 'Online Registration User Guide',       title_zh: '網上註冊說明',                       category: 'registration', year: '' },
  'reg_SDCA_School_Portal_User_Manual.pdf': { slug: 'reg-portal-user-manual',             title_en: 'SDCA School Portal User Manual (User Edition)', title_zh: '學校註冊系統使用手冊',   category: 'registration', year: '' },
  // contests / events
  '2026-HOC-Essay-English-Announcement.pdf':{ slug: '2026-hoc-essay-english',             title_en: '2026 HOC Essay (English) Announcement', title_zh: '2026 HOC英語作文比賽公告',   category: 'contest',     year: '2026' },
  '2026-Essay-Application.pdf':             { slug: '2026-essay-application',             title_en: '2026 Essay Application',               title_zh: '2026作文比賽申請表',                 category: 'contest',     year: '2026' },
  'SDCA-Yearbook-Cover-Art-Contest-Guidelines-2025-2026.pdf':
                                           { slug: 'yearbook-cover-art-contest-2025-26', title_en: 'Yearbook Cover Art Contest Guidelines 2025-2026', title_zh: '年刊封面比賽須知 2025-2026', category: 'contest', year: '2025-26' },
  // CJK-named PDFs — filenames URL-encoded in assets.json; titles from wiki (other-posts.md)
  '_E5_90_89_E4_BB_96_E6_B5_B7_E5_A0_B1.pdf':
                                           { slug: '2025-2026-poetry-recitation-rules', title_en: '2025-2026 Poetry Recitation Contest Rules & Poems', title_zh: '2025-2026 詩詞朗誦比賽規則及詩詞', category: 'contest', year: '2025-26' },
  '2025-2026-_E8_81_96_E5_9C_B0_E7_89_99_E5_93_A5_E4_B8_AD_E8_8F_AF_E5_AD_B8_E8_8B_9138_E9_80_B1_E5_B9_B4_E6_A0_A1_E6_85_B6_E6_9A_A8_E6_98_A5_E7_AF_80_E5_9C_92_E9_81_8A_E6_9C_83program_guide.pdf':
                                           { slug: '2025-2026-38th-anniversary-spring-fair-guide', title_en: '2025-2026 SDCA 38th Anniversary & Spring Carnival — Program Guide', title_zh: '2025-2026 聖地牙哥中華學苑38週年校慶暨春節園遊會 program guide', category: 'event', year: '2025-26' },
  '2025-2026-_E8_A9_A9_E8_A9_9E_E6_9C_97_E8_AA_A6_E6_AF_94_E8_B3_BD_E8_A6_8F_E5_89_87_E5_8F_8A_E8_A9_A9_E8_A9_9E.pdf':
                                           { slug: '2025-2026-poetry-recitation-rules', title_en: '2025-2026 Poetry Recitation Contest Rules & Poems', title_zh: '2025-2026 詩詞朗誦比賽規則及詩詞', category: 'contest', year: '2025-26' },
  '2025-2026-_E8_A9_A9_E8_A9_9E_E6_9C_97_E8_AA_A6_E6_AF_94_E8_B3_BD_E8_A6_8F_E5_89_87_E5_8F_8A_E8_A9_A9_E8_A9_9E-1.pdf':
                                           { slug: '2025-2026-poetry-recitation-rules', title_en: '2025-2026 Poetry Recitation Contest Rules & Poems', title_zh: '2025-2026 詩詞朗誦比賽規則及詩詞', category: 'contest', year: '2025-26' },
  '2025-26_SDCA__E4_BD_9C_E6_96_87_E6_AF_94_E8_B3_BD_E8_BE_A6_E6_B3_95.pdf':
                                           { slug: '2025-2026-essay-competition-rules', title_en: '2025-26 SDCA Essay Competition Rules', title_zh: '2025-26_SDCA_作文比賽辦法', category: 'contest', year: '2025-26' },
  '2026-_E4_B8_AD_E5_9C_8B_E9_A4_A8_E4_B8_AD_E6_96_87_E6_AF_94_E8_B3_BD_E9_80_9A_E7_9F_A5.pdf':
                                           { slug: '2026-chinese-center-contest-notice', title_en: '2026 Chinese Center Contest Notice', title_zh: '2026 中國館中文比賽通知', category: 'contest', year: '2026' },
  '98255_2021_E6_96_B0_E6_98_A5_E5_89_B5_E6_84_8F_E6_B4_BB_E5_8B_95_E7_B0_A1_E7_AB_A0.pdf':
                                           { slug: '2021-new-year-creative-activity-call', title_en: '2021 New Year Creative Activity Call for Entries', title_zh: '98255_2021_新春創意活動徵稿', category: 'event', year: '2021' },
};

// Weekly announcement PDFs follow a strict naming pattern — derive meta from the name.
function weeklyMeta(file) {
  const m = /^W(\d{2})_news_(Chn|Eng)(?:-\d+)?\.pdf$/.exec(file);
  if (m) {
    const week = Number(m[1]);
    const lang = m[2] === 'Chn' ? 'zh' : 'en';
    return {
      slug: `weekly-w${String(week).padStart(2, '0')}-${lang}`,
      title_en: lang === 'en' ? `Weekly Announcement — Week ${week} (English)` : '',
      title_zh: lang === 'zh' ? `家庭聯絡事項 第${week}週（中文版）` : '',
      category: 'weekly', year: '',
    };
  }
  const m2 = /^2018-19_week_07_announcement_(Chinese|English)\.pdf$/.exec(file);
  if (m2) {
    const lang = m2[1] === 'Chinese' ? 'zh' : 'en';
    return {
      slug: `weekly-2018-19-w07-${lang}`,
      title_en: lang === 'en' ? '2018-19 Weekly Announcement — Week 7 (English)' : '',
      title_zh: lang === 'zh' ? '2018-19學年 家庭聯絡事項 第7週（中文版）' : '',
      category: 'weekly', year: '2018-19',
    };
  }
  return null;
}

function slugify(s) {
  return s.toLowerCase().replace(/\.pdf$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function seedDocuments(db, log, skipped) {
  const assets = JSON.parse(readFileSync(ASSETS_JSON, 'utf8'));
  const pdfs = assets.filter(a => a.kind === 'pdf' && a.local_path);

  // Portal PDFs are not in assets.json (separate crawl) — append them explicitly.
  // Source: research/wiki/pages/registration.md § "Public PDF documents on the portal"
  for (const f of readdirSync(PORTAL_DIR).sort()) {
    if (META[f]) {
      pdfs.push({ local_path: `registration-portal/${f}`, sha256: `portal-${f}`, kind: 'pdf' });
    } else {
      log.push(`portal PDF not in META: ${f} (skipped)`);
    }
  }

  // Canonical names first (no trailing -1/-2/-3 suffix) so dedup keeps the good copy.
  const sorted = [...pdfs].sort((a, b) => {
    const fa = path.basename(a.local_path);
    const fb = path.basename(b.local_path);
    const aS = /-\d+\.pdf$/.test(fa);
    const bS = /-\d+\.pdf$/.test(fb);
    if (aS !== bS) return aS ? 1 : -1;
    return fa.localeCompare(fb);
  });

  const seen = new Set();
  const seenSlug = new Set();
  let count = 0, dups = 0;

  for (const a of sorted) {
    const file = path.basename(a.local_path);
    let meta = META[file] || weeklyMeta(file);
    if (!meta) {
      meta = {
        slug: slugify(file),
        title_en: file.replace(/\.pdf$/, '').replace(/[-_]/g, ' '),
        title_zh: '',
        category: 'misc',
        year: '',
      };
      skipped.push(`document: "${file}" has no explicit meta (seeded with generic title)`);
    }

    // sha256 dedup OR slug dedup (the 2 CJK poetry files are different bytes, same doc)
    if (a.sha256 && seen.has(a.sha256)) { dups++; continue; }
    if (seenSlug.has(meta.slug)) { dups++; continue; }
    if (a.sha256) seen.add(a.sha256);
    seenSlug.add(meta.slug);

    // srcRelPath is relative to PDF_DIR (e.g. 'reg_notice.pdf' or 'registration-portal/reg_notice.pdf')
    const srcRelPath = a.local_path.includes('registration-portal')
      ? `registration-portal/${file}`
      : file;
    const { file_path, bytes, mime } = copyPdf(srcRelPath, meta.slug + '.pdf');

    db.prepare(`
      INSERT INTO documents (slug, title_en, title_zh, category, file_path, mime, bytes, school_year, sort, published)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1)
      ON CONFLICT(slug) DO UPDATE SET
        title_en=excluded.title_en, title_zh=excluded.title_zh,
        category=excluded.category, file_path=excluded.file_path,
        mime=excluded.mime, bytes=excluded.bytes, school_year=excluded.school_year,
        updated_at=datetime('now')
    `).run(meta.slug, meta.title_en, meta.title_zh, meta.category, file_path, mime, bytes, meta.year);
    count++;
  }

  log.push(`documents: ${count} unique rows (${dups} duplicate copies collapsed)`);
  return count;
}
