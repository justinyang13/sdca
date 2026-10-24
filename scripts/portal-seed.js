#!/usr/bin/env node
// scripts/portal-seed.js — portal reference data + (optionally) a demo school with INVENTED families.
//   node scripts/portal-seed.js            lookups, roles, permissions, waivers, volunteer jobs, fees  (safe to re-run)
//   node scripts/portal-seed.js --demo     ALSO wipe portal data and load ~40 demo families, classes, payments, grades
// Demo logins are written to data/PORTAL-DEMO-LOGINS.txt (git-ignored). No real person appears anywhere in the demo data.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openDb } from '../src/db/open.js';
import { applyMigrations } from '../src/db/migrate.js';
import { seedRolesAndPermissions, BOARD_POSITIONS } from '../src/portal/perm.js';
import { seedBoardPositions, syncBoardRoles } from '../src/portal/board.js';
import { createUser, createPerson, createFamily, addFamilyMember } from '../src/portal/creators.js';
import { computeRegistration } from '../src/portal/fees.js';
import { gradeLabel } from '../src/portal/grades.js';
import { audit } from '../src/portal/crud.js';
import { config } from '../src/config.js';
import { isLiveTarget, DEMO_TABLES } from '../src/db/guard.js';

/** Password of every demo account (demo data only; override with DEMO_PASSWORD). */
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo@sdca!';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEMO = process.argv.includes('--demo');
if (DEMO && isLiveTarget()) {
  console.error('Refusing to load demo data into the live database (data/sdca.db). Use: npm run demo:seed  (DATASET=demo -> data/demo.db)');
  process.exit(1);
}
const db = openDb();
applyMigrations(db);
const q = (sql, ...a) => db.prepare(sql).run(...a);
const one = (sql, ...a) => db.prepare(sql).get(...a);
const all = (sql, ...a) => db.prepare(sql).all(...a);

// ---------------------------------------------------------------- lookups
function seedLookups() {
  seedRolesAndPermissions(db);
  seedBoardPositions(db, BOARD_POSITIONS);
  if (!one('SELECT id FROM schools LIMIT 1')) {
    q(`INSERT INTO schools (name_en, name_zh, tax_id, mailing_street, mailing_city, mailing_state, mailing_zip, phone, email, website) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      'San Diego Chinese Academy', '聖地牙哥中華學苑', '33-0290580', 'P.O. Box 910093', 'San Diego', 'CA', '92191-0093', '(858) 205-7322', 'Office.SDCA@gmail.com', 'https://sandiegochineseschool.com');
  }
  const school = one('SELECT id FROM schools LIMIT 1').id;
  const years = [
    ['2025-2026', '2025-07-01', '2026-06-30', 0, 0, '2025-05-17', '2025-09-14', '2026-05-17', '2026-02-01'],
    ['2026-2027', '2026-07-01', '2027-06-30', 1, 1, '2026-05-17', '2026-09-13', '2027-05-16', '2027-01-31'],
    ['2027-2028', '2027-07-01', '2028-06-30', 0, 0, '2027-05-17', '2027-09-12', '2028-05-14', '2028-01-30'],
  ];
  for (const y of years) {
    if (!one('SELECT id FROM school_years WHERE label = ?', y[0]))
      q('INSERT INTO school_years (school_id, label, start_date, end_date, is_current, registration_open, early_reg_deadline, first_day, last_day, second_semester_start) VALUES (?,?,?,?,?,?,?,?,?,?)', school, y[0], y[1], y[2], y[3], y[4], y[5], y[6], y[7], y[8]);
  }
  const ins = (sql, rows) => rows.forEach((r) => q(sql, ...r));
  ins('INSERT OR IGNORE INTO class_types (code, name_en, name_zh, is_credit, weeks, meets_start, meets_end, books_included, min_age, sort) VALUES (?,?,?,?,?,?,?,?,?,?)', [
    ['preschool', 'Preschool', '學前班', 0, 30, '13:30', '16:00', 1, 4, 1],
    ['regular', 'Regular (New Phonetic)', '普通(注音)班', 0, 30, '13:30', '16:30', 1, null, 2],
    ['bilingual', 'Bilingual (Pin-Yin)', '雙語(拼音)班', 0, 30, '13:30', '16:30', 1, null, 3],
    ['credit', 'High School Credit', '學分班', 1, 32, '13:30', '17:45', 0, null, 4],
    ['adult', 'Adult / Recreational', '成人班', 0, 12, '13:30', '16:30', 0, 18, 5],
  ]);
  const ct = (c) => one('SELECT id FROM class_types WHERE code = ?', c).id;
  const lv = [];
  ['K:幼稚園:Kindergarten', '1:一年級:1st Grade', '2:二年級:2nd Grade', '3:三年級:3rd Grade', '4:四年級:4th Grade', '5:五年級:5th Grade', '6:六年級:6th Grade'].forEach((s, i) => { const [c, zh, en] = s.split(':'); lv.push([ct('regular'), `R${c}`, `Regular ${en}`, `普通${zh}`, `${zh}(${en})`, i + 1]); });
  ['1:一:1', '2:二:2', '3:三:3', '4:四:4'].forEach(([c, zh, n], i) => lv.push([ct('bilingual'), `B${c}`, `Bilingual ${n}`, `雙語${zh}年級`, `${zh}年級`, i + 1]));
  lv.push([ct('preschool'), 'P', 'Preschool', '學前班', '學前 (Preschool)', 1]);
  [['1', '一', '6th–7th grade'], ['2', '二', '8th–9th grade'], ['3', '三', '10th–12th grade']].forEach(([c, zh, g], i) => lv.push([ct('credit'), `C${c}`, `Credit ${c}`, `學分${zh}`, g, i + 1]));
  ins('INSERT OR IGNORE INTO class_levels (class_type_id, code, name_en, name_zh, grade_label, sort) VALUES (?,?,?,?,?,?)', lv);
  ins('INSERT OR IGNORE INTO assignment_roles (code, name_en, name_zh) VALUES (?,?,?)', [
    ['primary_instructor', 'Primary Instructor', '主要老師'], ['assistant_instructor', 'Assistant Instructor', '助理老師'], ['teaching_assistant', 'Teaching Assistant (TA)', '教學助理'],
    ['substitute', 'Substitute', '代課老師'], ['room_parent', 'Room Parent', '班媽/班爸']]);
  ins('INSERT OR IGNORE INTO student_types (code, name_en, name_zh) VALUES (?,?,?)', [['new', 'New student', '新生'], ['returning', 'Returning student', '舊生'], ['credit', 'Credit student', '學分班學生'], ['adult', 'Adult student', '成人學生']]);
  ins('INSERT OR IGNORE INTO transaction_types (code, name_en, name_zh, direction, is_registration) VALUES (?,?,?,?,?)', [
    ['registration', 'Registration', '註冊', 'in', 1], ['scrip_purchase', 'Scrip Purchase', '禮券購買', 'in', 0], ['scrip_redeem', 'Scrip Redeem', '禮券兌換', 'out', 0],
    ['scrip_refund', 'Scrip Refund', '禮券退款', 'out', 0], ['service_refund', 'Service Refund', '代勞費退還', 'out', 0], ['withdrawal', 'Withdrawal Refund', '退學退費', 'out', 0], ['adjustment', 'Adjustment', '調整', 'in', 0]]);
  ins('INSERT OR IGNORE INTO payment_methods (code, name_en, name_zh, needs_check_number, active) VALUES (?,?,?,?,?)', [['check', 'Check', '支票', 1, 1], ['cash', 'Cash', '現金', 0, 1], ['scrip', 'Scrip', '禮券', 0, 1]]);
  ins('INSERT OR IGNORE INTO school_districts (name) VALUES (?)', [['Poway Unified'], ['San Diego Unified'], ['Del Mar Union'], ['Solana Beach'], ['Encinitas Union'], ['San Dieguito Union High'], ['Carlsbad Unified'], ['Private / Other']]);
  for (const r of [['IN-N-OUT burger', 'IN-N-OUT burger', 1000], ['Target', 'Target gift card', 2500], ['Ralphs', 'Ralphs gift card', 2500], ['Trader Joe\'s', 'Trader Joe\'s gift card', 2500], ['99 Ranch', '99 Ranch Market', 2500], ['Starbucks', 'Starbucks card', 1000]])
    if (!one('SELECT id FROM scrip_products WHERE name = ?', r[1])) q('INSERT INTO scrip_products (vendor, name, denomination_cents) VALUES (?,?,?)', ...r);
  // 15 volunteer jobs exactly as on the old portal
  const jobs = [
    ['Student Store Committee chairperson', '學生商店組', 0], ['Registration Assistance', '協助註冊', 0], ['Room Parent', '班媽/班爸', 0], ['Ground supervision', '校園巡邏組', 0],
    ['Photographers for Credit Class Field Trips', '學分班校外教學攝影組', 0], ['Office Duty', '辦公室值勤', 0],
    ['School Event Assistance (Coupon Day, Culture Day and Chinese New Year Festival Set-Up)', '學生商店日,文化節及新年團遊會協助', 0], ['School Contest Assistance', '校內比賽服務組', 0],
    ['Photographers for School Events', '學校活動攝影組', 0], ['Scrip Sales', '禮卷銷售組', 0], ['Student Snack Store', '下課點心販賣', 0], ['Yearbook Editors', '年刊編輯', 0],
    ["Teacher's Snack Duty (Reserved)", '老師點心輪值 (保留)', 1], ['SDCA Weekly Mail Pick Up (Reserved)', '幫學校拿郵件服務 (保留)', 1], ['TBD', '未決定', 0]];
  jobs.forEach(([en, zh, res], i) => { if (!one('SELECT id FROM volunteer_jobs WHERE name_en = ?', en)) q('INSERT INTO volunteer_jobs (name_en, name_zh, reserved_for_preschool, sort, active) VALUES (?,?,?,?,1)', en, zh, res, i + 1); });
  // waivers (text of the old consent page)
  const W = [
    ['consent_release', 'Consent, Release, Indemnification and Assumption of Risk', '同意、免責與風險承擔', null, [
      'I(we), the parent(s) of the child/children listed in my registration, request that our child/children be permitted to participate in all activities of the San Diego Chinese Academy (“SDCA”) (“Activities”).',
      'We fully understand that participation in Activities presents an inherent risk of injury, serious bodily harm, or death to our child/children and to the undersigned. We have investigated the Activities to our full satisfaction and expressly assume all risks, including but not limited to injury, harm, or death.',
      'We represent that our child/children have no physical or mental conditions which would or should prevent them from participating in Activities, or that would increase the risk of possible injury, harm or death by participating in Activities.',
      'We agree that should the physical or mental condition of our child/children change resulting in an increased risk of injury, harm or death, we will immediately withdraw our child/children from school.',
      'We agree that should anyone, including our child/children (including any representative or guardian) make a claim against SDCA (including any shareholder, subsidiary or affiliate, or any person acting in his/her capacity as an officer, director, employee, agent, contractor, or representative of SDCA) that the undersigned agree to fully indemnify, defend and hold SDCA (including its affiliates, officers, directors, shareholders, agents, employees and representatives) (“Released Parties”) completely harmless from any and all costs, expenses, attorney’s fees, suits, liabilities, damages or claim for damages, including but not limited to those arising out of any injury or death to any person or persons or damage to any property of any kind whatsoever and to whomsoever belonging, including SDCA, in any way relating to the Activities or the performance or exercise of any of the duties, obligations, powers or authorities herein or hereafter granted to SDCA and any Released Parties as defined herein.',
      'In consideration of the benefits we will receive from our child/children participating in Activities, we hereby agree that we (including any assignees, heirs, next of kin, guardians, and legal or personal representatives) will not make a claim against, sue, or attach the property of any subsidiary or affiliate, or any person acting in his/her capacity as an officer, director, employee, agent, contractor, or representative of SDCA for injury, death, damage, or loss caused in whole or in part by the negligence or other acts or omissions of the Released Parties as a result of my child’s/children’s participation in Activities. We hereby release and discharge the Released Parties from all actions, claims, or demands that we, our assignees, heirs, next of kin, guardians, and legal or personal representatives may have for injury, death, damage, or loss resulting in any way from our child’s/children’s participation in Activities, whether it results from the negligence, gross negligence, or reckless conduct of SDCA and/or any other Released Parties, or from any other cause.',
      'We understand and agree that if a claim, suit, or attachment is brought or sought against us as a result in any way of my child’s/children’s participation in Activities, that we shall not be entitled to any defense or indemnification by SDCA or any Released Parties in connection with such claim, suit, or attachment.'], 1],
    ['media_release', 'Media Release', '媒體授權', null, ['By enrolling my child(ren) in San Diego Chinese Academy ("SDCA"), I hereby consent that the photographs and/or motion picture or videotape for which my family posed, and/or audio recordings made of my family’s voices may be used by voluntary and/or school contracted photographers/video photographers, its assignees or successors, and SDCA without compensation, in whatever way they desire, including television and electronic media. Furthermore, I authorize SDCA to publish in any format and us for any purposes the name, affiliation, and photographs, video footage, and audio recording taken of students for advertising and promotions.'], 2],
    ['under5', 'Mandatory Additional Waiver for Enrolling Child(ren) Under 5 Years of Age as of First Day of School', '未滿五歲兒童額外同意書', 5, ['I understand that San Diego Chinese Academy ("SDCA"), a non-profit organization which provides an environment for the instruction of Chinese language and culture, is not a child care service and will not provide insurance for my child(ren) who are under 5 years of age. I will stay with my child(ren) during the duration of the class and will indemnify and hold SDCA, its officers, directors, administration, employees, and personnel, harmless from and against any injury, accident, illness or death occurring during the school activities.'], 3],
  ];
  for (const [code, en, zh, age, paras, sort] of W) if (!one('SELECT id FROM waiver_documents WHERE code = ? AND version = 1', code))
    q('INSERT INTO waiver_documents (code, version, title_en, title_zh, body_en, effective_from, applies_under_age, sort) VALUES (?,?,?,?,?,?,?,?)', code, 1, en, zh, paras.join('\n\n'), '2026-01-01', age, sort);
  seedFees();
}

function seedFees() {
  if (isLiveTarget()) return;   // placeholder fees never go into the live DB; staff enter the real ones
  const types = Object.fromEntries(all('SELECT id, code FROM class_types').map((c) => [c.code, c.id]));
  for (const y of all('SELECT * FROM school_years WHERE label IN (?,?,?)', '2025-2026', '2026-2027', '2027-2028')) {
    if (one('SELECT id FROM fee_schedules WHERE school_year_id = ? AND deleted_at IS NULL', y.id)) continue;
    const bump = y.label === '2025-2026' ? 0 : 1;           // last year was a little cheaper
    const tuition = (base) => base + (bump ? 0 : -5000);
    const rows = [
      ['registration_fee', 'Registration Fee', '報名費', 5000, 'student', null, null, null, null, 1],
      ['early_reg_discount', 'Early Registration Discount', '預註冊優惠', 5000, 'student', null, null, null, y.early_reg_deadline, 2],
      ['tuition', 'Tuition – Preschool', '學費 – 學前班', tuition(93000), 'student', types.preschool, null, null, null, 3],
      ['tuition', 'Tuition – Regular', '學費 – 普通班', tuition(93000), 'student', types.regular, null, null, null, 4],
      ['tuition', 'Tuition – Bilingual', '學費 – 雙語班', tuition(93000), 'student', types.bilingual, null, null, null, 5],
      ['tuition', 'Tuition – Credit (books not included)', '學費 – 學分班 (不含課本)', tuition(119500), 'student', types.credit, null, null, null, 6],
      ['misc_fee', 'Miscellaneous Fees', '學雜費', 10000, 'student', null, null, null, null, 7],
      ['sibling_discount', 'Sibling Discount (from the 3rd child)', '手足折扣 (第三位子女起)', 10000, 'student', null, null, 3, null, 8],
      ['faculty_discount', 'Faculty / Board Discount (reimbursed 2nd semester)', '教職員/董事折扣 (第二學期退還)', 0, 'student', null, 10, null, null, 9],
      ['service_fee', 'Service Fee (refundable after volunteer duty)', '代勞費 (完成義工後退還)', 10000, 'family', null, null, null, null, 10],
      ['scrip_deposit', 'Scrip Deposit', '禮券訂金', 0, 'family', null, null, null, null, 11],
    ];
    for (const r of rows) q('INSERT INTO fee_schedules (school_year_id, code, name_en, name_zh, amount_cents, applies_to, class_type_id, percent, from_nth_child, deadline, active, sort, is_demo) VALUES (?,?,?,?,?,?,?,?,?,?,1,?,1)',
      y.id, r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9]);
    // withdrawal fee schedule, expressed in the year's own dates
    const d = (base, n) => { const t = new Date(base + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
    const f = y.first_day;
    const w = [['Before the start of school (full refund)', '開學前 (全額退費)', null, d(f, -1), 0, 0], ['Until the end of the first week', '第一週內', f, d(f, 6), 10000, 0], ['Second week of school', '第二週', d(f, 7), d(f, 13), 11000, 0],
      ['Third week of school', '第三週', d(f, 14), d(f, 20), 12000, 0], ['Fourth week of school', '第四週', d(f, 21), d(f, 27), 13000, 0], ['Fifth week of school', '第五週', d(f, 28), d(f, 34), 14000, 0], ['Sixth week and beyond', '第六週起', d(f, 35), null, 0, 1]];
    w.forEach((r, i) => q('INSERT INTO withdrawal_fee_rules (school_year_id, label_en, label_zh, from_date, to_date, fee_cents, no_refund, sort) VALUES (?,?,?,?,?,?,?,?)', y.id, r[0], r[1], r[2], r[3], r[4], r[5], i + 1));
  }
}

// ---------------------------------------------------------------- demo data
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const R = rng(20261012);
const pick = (a) => a[Math.floor(R() * a.length)];
const between = (lo, hi) => lo + Math.floor(R() * (hi - lo + 1));
const pw = () => crypto.randomBytes(9).toString('base64url');

const SUR = [['Chen', '陳'], ['Lin', '林'], ['Wang', '王'], ['Zhang', '張'], ['Li', '李'], ['Huang', '黃'], ['Wu', '吳'], ['Liu', '劉'], ['Yang', '楊'], ['Zhou', '周'], ['Xu', '徐'], ['Sun', '孫'], ['Ma', '馬'], ['Zhu', '朱'], ['Hu', '胡'], ['Guo', '郭'], ['He', '何'], ['Gao', '高'], ['Luo', '羅'], ['Tang', '唐'], ['Fan', '范'], ['Shen', '沈'], ['Cai', '蔡'], ['Deng', '鄧'], ['Pan', '潘'], ['Yuan', '袁'], ['Jiang', '蔣'], ['Qian', '錢'], ['Dai', '戴'], ['Song', '宋']];
const GIVEN = [['Wei', '偉'], ['Ming', '明'], ['Jun', '俊'], ['Hao', '浩'], ['Kai', '凱'], ['Yu', '宇'], ['Tian', '天'], ['Lei', '磊'], ['Jie', '傑'], ['Bo', '博'], ['Xin', '欣'], ['Yan', '妍'], ['Ting', '婷'], ['Mei', '美'], ['Ling', '玲'], ['Jia', '佳'], ['Hui', '惠'], ['Fang', '芳'], ['Qing', '晴'], ['Rui', '瑞'], ['Zhi', '智'], ['Cheng', '誠'], ['Ning', '寧'], ['Shu', '書'], ['An', '安']];
const EN_KIDS_M = ['Ethan', 'Lucas', 'Noah', 'Owen', 'Ryan', 'Leo', 'Evan', 'Aiden', 'Jason', 'Kevin', 'Andrew', 'Daniel', 'Nathan', 'Felix', 'Julian', 'Max'];
const EN_KIDS_F = ['Emily', 'Sophia', 'Chloe', 'Grace', 'Olivia', 'Mia', 'Ava', 'Lily', 'Hannah', 'Claire', 'Zoe', 'Ella', 'Nora', 'Ivy', 'Maya', 'Alice'];
const EN_ADULT_M = ['David', 'Michael', 'James', 'Peter', 'Eric', 'Brian', 'Alan', 'Henry', 'Victor', 'Steven'];
const EN_ADULT_F = ['Jennifer', 'Linda', 'Karen', 'Amy', 'Grace', 'Helen', 'Susan', 'Vivian', 'Joyce', 'Sandy'];
const STREETS = ['Via Alta', 'Camino Del Sol', 'Mesa Verde Ct', 'Torrey View Dr', 'Calle Cristobal', 'Genesee Park Ln', 'Sorrento Ridge Rd', 'Del Mar Heights Rd', 'Carmel Mountain Rd', 'Rancho Penasquitos Blvd'];
const CITIES = [['San Diego', '92121'], ['San Diego', '92127'], ['San Diego', '92129'], ['San Diego', '92130'], ['La Jolla', '92037'], ['Carlsbad', '92009'], ['Poway', '92064'], ['Del Mar', '92014']];
const zhName = (sur, n = 2) => sur[1] + Array.from({ length: n }, () => pick(GIVEN)[1]).join('');
const phone = () => `(858) 555-01${String(between(0, 99)).padStart(2, '0')}`;
const dt = (y, m, d, hh = 10, mm = 0) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;

const WIPE = ['class_announcements', 'board_members', 'portal_audit', 'email_outbox', 'waiver_acceptances', 'volunteer_signups', 'withdrawals', 'transaction_lines', 'transactions', 'credit_grades', 'student_school_info', 'registration_items', 'enrollments',
  'registrations', 'class_assignments', 'school_classes', 'parent_students', 'family_members', 'invitations', 'password_resets', 'user_roles', 'users', 'families', 'persons', 'addresses'];

function wipe() {   // outside a transaction so PRAGMA foreign_keys takes effect
  db.exec('PRAGMA foreign_keys = OFF');
  for (const t of WIPE) db.exec(`DELETE FROM ${t}`);
  db.exec('PRAGMA foreign_keys = ON');
}

function demo() {
  const logins = [];
  const year = one("SELECT * FROM school_years WHERE label = '2026-2027'");
  const prev = one("SELECT * FROM school_years WHERE label = '2025-2026'");
  const types = Object.fromEntries(all('SELECT id, code FROM class_types').map((c) => [c.code, c.id]));
  const level = (code) => one('SELECT id FROM class_levels WHERE code = ?', code)?.id || null;
  const role = (code) => one('SELECT id FROM roles WHERE code = ?', code).id;
  const addUser = (personId, username, roles, type, lang = 'en') => { const p = pw(); const pwd = DEMO_PASSWORD; createUser(db, { personId, username, password: pwd, roleCodes: roles, type, lang }); logins.push([username, roles.join('+'), pwd]); return pwd; };
  const mkPerson = (o) => createPerson(db, o);

  // ---- staff
  const staff = {};
  const staffDefs = [['admin', 'Admin', 'Demo', '管理員', ['admin'], 'staff'], ['principal', 'Principal', 'Demo', '校長', ['principal'], 'staff'], ['secretary', 'Secretary', 'Demo', '秘書', ['secretary'], 'staff'],
    ['accountant', 'Accountant', 'Demo', '會計', ['accountant'], 'staff'], ['pta', 'Volunteer', 'Coordinator', '義工組', ['pta_coordinator'], 'staff']];
  for (const [u, last, first, zh, roles, type] of staffDefs) {
    const pid = mkPerson({ english_last_name: last, english_first_name: first, chinese_name: zh, gender: 'F', email: `${u}@example.com`, mobile: phone(), birth_date: '1975-03-15' });
    staff[u] = pid; addUser(pid, `demo.${u}`, roles, type);
  }
  // ---- board members: one demo account per board position (titles as on the public Board of Directors page)
  const BOARD_DEMO = [['president', 'President', 'Demo', '理事長', 'board_president'], ['vicepresident', 'VicePresident', 'Demo', '副理事長', 'board_vice_president'], ['boardsecretary', 'BoardSecretary', 'Demo', '執行祕書', 'board_secretary'],
    ['treasurer', 'Treasurer', 'Demo', '財務理事', 'board_treasurer'], ['editorial', 'Editorial', 'Demo', '編輯組理事', 'board_editorial'], ['ptadirector', 'PTADirector', 'Demo', '家長會理事', 'board_pta'],
    ['scrip', 'Scrip', 'Demo', '禮券組理事', 'board_scrip'], ['activity', 'Activity', 'Demo', '活動組理事', 'board_activity'], ['operation', 'Operation', 'Demo', '業務組理事', 'board_operation']];
  for (const [u, last, first, zh, roleCode] of BOARD_DEMO) {
    const pid = mkPerson({ english_last_name: last, english_first_name: first, chinese_name: zh, gender: 'F', email: `${u}@example.com`, mobile: phone(), birth_date: '1972-06-20' });
    addUser(pid, `demo.${u}`, [roleCode], 'board');
    const pos = one('SELECT id FROM board_positions WHERE role_code = ?', roleCode);
    q('INSERT INTO board_members (person_id, board_position_id, school_year_id, start_date) VALUES (?,?,?,?)', pid, pos.id, year.id, year.start_date || null);
  }
  syncBoardRoles(db);
  // keep the website admin's login working in the portal too (same password hash)
  const site = one("SELECT * FROM admin_users WHERE username = 'admin'");
  if (site) { const pid = mkPerson({ english_last_name: 'Admin', english_first_name: 'Site', chinese_name: '網站管理員', email: 'admin@example.com', birth_date: '1980-01-01' });
    const ut = one("SELECT id FROM user_types WHERE code = 'staff'").id;
    const r = q('INSERT INTO users (person_id, username, password_hash, user_type_id, status) VALUES (?,?,?,?,?)', pid, 'admin', site.password_hash, ut, 'active');
    q('INSERT INTO user_roles (user_id, role_id) VALUES (?,?)', Number(r.lastInsertRowid), role('admin')); logins.push(['admin', 'admin', '(same password as the website /admin login)']); }
  const teachers = [];
  const TEACHER_NAMES = [['Chu', '朱', 'Mei-Ling', '美玲'], ['Tsai', '蔡', 'Wen-Hsin', '文欣'], ['Hsieh', '謝', 'Chia-Hui', '嘉惠'], ['Kuo', '郭', 'Yi-Jun', '怡君'], ['Yeh', '葉', 'Po-Wen', '柏文'],
    ['Ho', '何', 'Shu-Fen', '淑芬'], ['Tseng', '曾', 'Li-Hua', '麗華'], ['Chiang', '江', 'Ming-Der', '明德'], ['Lai', '賴', 'Hsiao-Yun', '曉雲'], ['Fu', '傅', 'Jen-Chieh', '仁傑'], ['Su', '蘇', 'Pei-Ying', '佩穎'], ['Wen', '溫', 'Chun-Mei', '春梅']];
  TEACHER_NAMES.forEach(([ls, lz, fs, fz], i) => {
    const pid = mkPerson({ english_last_name: ls, english_first_name: fs, chinese_name: lz + fz, gender: i % 3 === 2 ? 'M' : 'F', email: `teacher${i + 1}@example.com`, mobile: phone(), birth_date: `19${between(70, 88)}-0${between(1, 9)}-1${between(0, 9)}`, is_faculty: 1 });
    teachers.push(pid); if (i < 6) addUser(pid, `demo.teacher${i + 1}`, ['teacher'], 'staff');
  });

  // ---- rooms, textbooks, classes
  const rooms = []; for (let n = 201; n <= 216; n++) { q('INSERT OR IGNORE INTO rooms (code, building, capacity) VALUES (?,?,?)', `MS${n}`, 'Middle School', 24); rooms.push(one('SELECT id FROM rooms WHERE code = ?', `MS${n}`).id); }
  const books = [['美洲華語第一冊', 'Chinese Reader Book 1'], ['美洲華語第二冊', 'Chinese Reader Book 2'], ['美洲華語第三冊', 'Chinese Reader Book 3'], ['美洲華語第四冊', 'Chinese Reader Book 4'], ['美洲華語第五冊', 'Chinese Reader Book 5'], ['美洲華語第六冊', 'Chinese Reader Book 6'], ['美洲華語第七冊', 'Chinese Reader Book 7'], ['美洲華語第八冊', 'Chinese Reader Book 8']];
  const bookIds = books.map(([zh, en], i) => { q('INSERT INTO textbooks (title_en, title_zh, level, publisher, price_cents) VALUES (?,?,?,?,?)', en, zh, `Level ${i + 1}`, 'Demo Press', 2500); return Number(db.prepare('SELECT last_insert_rowid() AS id').get().id); });
  const classDefs = [ // code, zh, en, type, level, book
    ['PA', '學前甲', 'Preschool A', 'preschool', 'P', null], ['PB', '學前乙', 'Preschool B', 'preschool', 'P', null],
    ['CSLKA', '幼稚園甲', 'Regular K-A', 'regular', 'RK', 0], ['CSL1A', '一甲', 'Regular 1A', 'regular', 'R1', 1], ['CSL2A', '二甲', 'Regular 2A', 'regular', 'R2', 2], ['CSL3A', '三甲', 'Regular 3A', 'regular', 'R3', 3],
    ['CSL4A', '四甲', 'Regular 4A', 'regular', 'R4', 3], ['CSL5A', '五甲', 'Regular 5A', 'regular', 'R5', 4], ['CSL6A', '六甲', 'Regular 6A', 'regular', 'R6', 5],
    ['BIL1A', '雙語一甲', 'Bilingual 1A', 'bilingual', 'B1', 1], ['BIL2A', '雙語二甲', 'Bilingual 2A', 'bilingual', 'B2', 2], ['BIL3A', '雙語三甲', 'Bilingual 3A', 'bilingual', 'B3', 3],
    ['CRD1A', '學分一甲', 'Credit 1A', 'credit', 'C1', 6], ['CRD2A', '學分二甲', 'Credit 2A', 'credit', 'C2', 7], ['CRD3A', '學分三甲', 'Credit 3A', 'credit', 'C3', 7],
  ];
  const classes = {};
  classDefs.forEach(([code, zh, en, type, lvl, book], i) => {
    const lv = level(lvl) || level(lvl.replace(/^R(\d)$/, 'R$1'));
    const r = q('INSERT INTO school_classes (school_year_id, class_type_id, class_level_id, code, name_zh, name_en, room_id, textbook_id, capacity, status) VALUES (?,?,?,?,?,?,?,?,?,?)',
      year.id, types[type], lv, code, zh, en, rooms[i % rooms.length], book === null ? null : bookIds[book], 22, 'open');
    classes[code] = Number(r.lastInsertRowid);
    q('INSERT INTO class_assignments (school_class_id, person_id, assignment_role_id, school_year_id, start_date, end_date) VALUES (?,?,?,?,?,?)', classes[code], teachers[i % teachers.length], one("SELECT id FROM assignment_roles WHERE code='primary_instructor'").id, year.id, year.first_day, year.last_day);
    if (i % 3 === 0) q('INSERT INTO class_assignments (school_class_id, person_id, assignment_role_id, school_year_id, start_date, end_date) VALUES (?,?,?,?,?,?)', classes[code], teachers[(i + 5) % teachers.length], one("SELECT id FROM assignment_roles WHERE code='teaching_assistant'").id, year.id, year.first_day, year.last_day);
  });

  // ---- families
  const jobIds = all('SELECT id, reserved_for_preschool FROM volunteer_jobs ORDER BY sort');
  const famInfo = [];
  const FAMILIES = 40;
  let parentOnly = 0;   // parent-only logins are numbered in sequence: demo.parent01, 02, …
  for (let n = 1; n <= FAMILIES; n++) {
    const sur = pick(SUR); const city = pick(CITIES);
    const fam = createFamily(db, { street: `${between(1000, 19999)} ${pick(STREETS)}`, city: city[0], state: 'CA', zipcode: city[1], home_phone: phone(), cell_phone: phone(), email: `demo.family${String(n).padStart(2, '0')}@example.com`,
      list_in_directory: R() < 0.8 ? 'Y' : 'N', emergency_contact: `${pick(EN_ADULT_F)} ${pick(SUR)[0]}`, emergency_home_phone: phone(), emergency_cell_phone: phone() });
    q('UPDATE families SET notes = ? WHERE id = ?', 'DEMO', fam);
    const dadFirst = pick(GIVEN); const momFirst = pick(GIVEN);
    const p1 = mkPerson({ english_last_name: sur[0], english_first_name: n % 2 ? pick(EN_ADULT_F) : pick(EN_ADULT_M), chinese_name: zhName(sur), gender: n % 2 ? 'F' : 'M', birth_date: `19${between(70, 85)}-0${between(1, 9)}-${between(10, 28)}`, native_language: R() < 0.8 ? 'Mandarin' : 'English', email: `demo.family${String(n).padStart(2, '0')}@example.com` });
    addFamilyMember(db, fam, p1, 'parent_one');
    let p2 = null;
    if (R() < 0.7) { p2 = mkPerson({ english_last_name: sur[0], english_first_name: n % 2 ? pick(EN_ADULT_M) : pick(EN_ADULT_F), chinese_name: zhName(sur), gender: n % 2 ? 'M' : 'F', birth_date: `19${between(70, 85)}-0${between(1, 9)}-${between(10, 28)}`, native_language: 'Mandarin' }); addFamilyMember(db, fam, p2, 'parent_two'); }
    const roles = ['parent'];
    if ([5, 12, 20].includes(n)) roles.push('teacher');
    if ([8, 15, 22, 29].includes(n)) roles.push('room_parent');
    if (n === 2) roles.push('secretary');
    if (n === 3) roles.push('volunteer');
    // parents who also hold another role get a descriptive login: demo.parentsecretary, demo.parentteacher1, demo.parentroomparent2 …
    const extra = roles.filter((r) => r !== 'parent');
    const uname = extra.length ? `demo.parent${extra.join('')}${extra[0] === 'teacher' ? [5, 12, 20].indexOf(n) + 1 : extra[0] === 'room_parent' ? [8, 15, 22, 29].indexOf(n) + 1 : ''}`.replace('room_parent', 'roomparent') : `demo.parent${String(++parentOnly).padStart(2, '0')}`;
    addUser(p1, uname, roles, 'parent', n % 4 === 0 ? 'zh' : 'en');
    if ([5, 12, 20].includes(n)) { q('UPDATE persons SET is_faculty = 1 WHERE id = ?', p1); const cc = ['CSL2A', 'BIL1A', 'CSLKA'][[5, 12, 20].indexOf(n)]; q('INSERT INTO class_assignments (school_class_id, person_id, assignment_role_id, school_year_id, start_date, end_date) VALUES (?,?,?,?,?,?)', classes[cc], p1, one("SELECT id FROM assignment_roles WHERE code='teaching_assistant'").id, year.id, year.first_day, year.last_day); }
    famInfo.push({ n, fam, sur, p1, p2, kids: [], roles });
  }

  // ---- children
  const kidCount = () => { const r = R(); return r < 0.45 ? 1 : r < 0.87 ? 2 : 3; };
  const studentUsers = [];
  for (const f of famInfo) {
    const c = kidCount(); const used = new Set();
    for (let k = 0; k < c; k++) {
      const roll = R();
      const type = roll < 0.12 ? 'preschool' : roll < 0.55 ? 'regular' : roll < 0.8 ? 'bilingual' : 'credit';
      const grade = type === 'preschool' ? -1 : type === 'regular' ? between(0, 6) : type === 'bilingual' ? between(1, 4) : between(6, 12);
      if (used.has(grade)) { k -= 1; if (used.size > 5) break; continue; } used.add(grade);
      const gender = R() < 0.5 ? 'F' : 'M';
      const birthYear = type === 'preschool' ? 2022 : 2021 - grade; const birth = `${birthYear}-${String(between(1, 8)).padStart(2, '0')}-${String(between(1, 28)).padStart(2, '0')}`;
      const pid = mkPerson({ english_last_name: f.sur[0], english_first_name: gender === 'F' ? pick(EN_KIDS_F) : pick(EN_KIDS_M), chinese_name: zhName(f.sur, R() < 0.5 ? 2 : 1), gender, birth_date: birth, native_language: R() < 0.55 ? 'English' : 'Mandarin',
        allergy: R() < 0.12 ? pick(['Peanuts', 'Tree Nuts', 'Dairy', 'Shellfish']) : '', special_medical_needs: R() < 0.05 ? 'Asthma inhaler' : '', regular_school: pick(['Torrey Pines Elementary', 'Design 39 Campus', 'Del Mar Heights', 'Sunset Hills', 'Black Mountain Middle']), regular_grade: Math.max(0, grade < 0 ? 0 : grade),
        speak_chinese_home: R() < 0.6 ? 'Y' : 'N', took_chinese_lessons: R() < 0.4 ? 'Y' : 'N' });
      addFamilyMember(db, f.fam, pid, 'child', null, 10 + k);
      f.kids.push({ pid, type, grade, birth, gender, sur: f.sur });
      if (type === 'credit') { studentUsers.push({ pid, f }); }
    }
  }

  // ---- registrations 2025-2026 (history) and 2026-2027
  const classFor = (k) => {
    if (k.type === 'preschool') return R() < 0.5 ? 'PA' : 'PB';
    if (k.type === 'regular') return ['CSLKA', 'CSL1A', 'CSL2A', 'CSL3A', 'CSL4A', 'CSL5A', 'CSL6A'][Math.min(6, k.grade)];
    if (k.type === 'bilingual') return `BIL${Math.min(3, k.grade)}A`;
    return k.grade <= 7 ? 'CRD1A' : k.grade <= 9 ? 'CRD2A' : 'CRD3A';
  };
  const typeOfId = types;
  const checkNo = () => String(between(1000, 9999));
  function register(f, y, kids, { status, paidOn, classPlaced, early, gradeShift = 0 }) {
    const items = kids.map((k) => ({ studentId: k.pid, classTypeId: typeOfId[k.type], gradeLabel: k.type === 'preschool' ? '學前 (Preschool)' : gradeLabel(Math.max(0, k.grade + gradeShift)), birthDate: k.birth }));
    const scrip = R() < 0.35 ? between(2, 8) * 10000 : 0;
    const calc = computeRegistration(db, { yearId: y.id, familyId: f.fam, items, scripPurchaseCents: scrip, today: early ? '2026-04-20' : paidOn || '2026-09-01' });
    const r = q('INSERT INTO registrations (family_id, school_year_id, registered_by_user_id, status, scrip_purchase_cents, scrip_deposit_cents, service_fee_cents, subtotal_cents, grand_total_cents, waiver_accepted_at, submitted_at, paid_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      f.fam, y.id, null, status, scrip, calc.scripDeposit, calc.serviceFee, calc.grand - calc.serviceFee - calc.scripDeposit - scrip, calc.grand, dt(2026, 4, 20), paidOn ? `${paidOn.slice(0, 10)} 09:00:00` : dt(2026, 9, 2), status === 'paid' ? `${paidOn.slice(0, 10)} 10:00:00` : null);
    const rid = Number(r.lastInsertRowid);
    for (const it of calc.items) q('INSERT INTO registration_items (registration_id, student_person_id, class_type_id, grade_label, birth_date_snapshot, registration_fee_cents, early_reg_discount_cents, tuition_cents, misc_fee_cents, sibling_discount_cents) VALUES (?,?,?,?,?,?,?,?,?,?)',
      rid, it.studentId, it.classTypeId, it.gradeLabel, it.birthDate, it.registrationFee, it.earlyRegDiscount, it.tuition, it.misc, it.siblingDiscount);
    return { rid, calc };
  }
  const ttReg = one("SELECT id FROM transaction_types WHERE code='registration'").id;
  const pmCheck = one("SELECT id FROM payment_methods WHERE code='check'").id; const pmCash = one("SELECT id FROM payment_methods WHERE code='cash'").id; const pmScrip = one("SELECT id FROM payment_methods WHERE code='scrip'").id;
  const waivers = all('SELECT id, applies_under_age FROM waiver_documents');
  const stype = (c) => one('SELECT id FROM student_types WHERE code = ?', c).id;

  famInfo.forEach((f, idx) => {
    if (!f.kids.length) return;
    const returning = idx < 24;
    if (returning) {   // last year
      const { rid, calc } = register(f, prev, f.kids.filter((k) => k.grade > 0 || k.type === 'preschool'), { status: 'paid', paidOn: dt(2025, 5, between(1, 20)), early: false, gradeShift: -1 });
      const kidsPrev = f.kids.filter((k) => k.grade > 0 || k.type === 'preschool');
      if (kidsPrev.length) {
        const tx = q('INSERT INTO transactions (family_id, registration_id, school_year_id, transaction_type_id, transaction_date, payment_method_id, check_number, amount_cents, recorded_by_user_id) VALUES (?,?,?,?,?,?,?,?,?)', f.fam, rid, prev.id, ttReg, dt(2025, 5, between(1, 20)), pmCheck, checkNo(), calc.grand, null);
        for (const k of kidsPrev) q("INSERT OR IGNORE INTO enrollments (student_person_id, school_year_id, class_type_id, grade_label, status, registration_id, student_type_id) VALUES (?,?,?,?,'placed',?,?)", k.pid, prev.id, typeOfId[k.type], gradeLabel(Math.max(0, k.grade - 1)), rid, stype('returning'));
        void tx;
      }
    }
    const state = idx < 30 ? 'paid' : idx < 35 ? 'submitted' : 'none';
    if (state === 'none') return;
    const early = idx < 20;
    const paidDate = early ? dt(2026, 4, between(21, 30)).slice(0, 10) : dt(2026, between(5, 9), between(1, 12)).slice(0, 10);
    const { rid, calc } = register(f, year, f.kids, { status: state, paidOn: state === 'paid' ? paidDate + ' 12:00:00' : null, early });
    for (const k of f.kids) {
      const cls = classFor(k);
      const placed = state === 'paid';
      q('INSERT OR IGNORE INTO enrollments (student_person_id, school_year_id, school_class_id, class_type_id, grade_label, student_type_id, status, placed_at, registration_id) VALUES (?,?,?,?,?,?,?,?,?)',
        k.pid, year.id, placed ? classes[cls] : null, typeOfId[k.type], k.type === 'preschool' ? '學前 (Preschool)' : gradeLabel(Math.max(0, k.grade)), stype(returning ? (k.type === 'credit' ? 'credit' : 'returning') : 'new'),
        placed ? 'placed' : 'pending', placed ? dt(2026, 9, between(1, 9), between(9, 20), between(0, 59)) : null, rid);
    }
    for (const w of waivers) q('INSERT INTO waiver_acceptances (person_id, family_id, registration_id, waiver_document_id, accepted_at, ip) VALUES (?,?,?,?,?,?)', f.p1, f.fam, rid, w.id, dt(2026, 4, 20), '127.0.0.1');
    if (state === 'paid') {
      const cash = R() < 0.12;
      q('INSERT INTO transactions (family_id, registration_id, school_year_id, transaction_type_id, transaction_date, payment_method_id, check_number, amount_cents, recorded_by_user_id, note) VALUES (?,?,?,?,?,?,?,?,?,?)', f.fam, rid, year.id, ttReg, paidDate, cash ? pmCash : pmCheck, cash ? '' : checkNo(), calc.grand, null, early ? 'Early registration' : '');
    }
    // volunteer sign-ups
    const parentPid = f.p1; const signupAt = dt(2026, 4, between(20, 30), between(8, 22), between(0, 59));
    if (R() < 0.12) q("INSERT INTO volunteer_signups (family_id, person_id, school_year_id, job_id, priority, signed_up_at, status) VALUES (?,?,?,NULL,1,?,'declined')", f.fam, parentPid, year.id, signupAt);
    else {
      const preschool = f.kids.some((k) => k.type === 'preschool');
      const ok = jobIds.filter((j) => preschool || !j.reserved_for_preschool); const used = new Set();
      for (let p = 1; p <= between(1, 3); p++) { let j = pick(ok); if (used.has(j.id)) continue; used.add(j.id);
        q('INSERT INTO volunteer_signups (family_id, person_id, school_year_id, job_id, priority, signed_up_at, status, assigned_job_id, hours_completed) VALUES (?,?,?,?,?,?,?,?,?)', f.fam, parentPid, year.id, j.id, p, signupAt, p === 1 && R() < 0.55 ? 'assigned' : 'requested', p === 1 && R() < 0.55 ? j.id : null, 0); }
    }
    // scrip purchase transaction for some paid families
    if (state === 'paid' && R() < 0.3) {
      const prod = pick(all('SELECT * FROM scrip_products')); const qty = between(1, 4);
      const t = q("INSERT INTO transactions (family_id, school_year_id, transaction_type_id, transaction_date, payment_method_id, check_number, amount_cents, note) VALUES (?,?,(SELECT id FROM transaction_types WHERE code='scrip_purchase'),?,?,?,?,?)", f.fam, year.id, dt(2026, 10, between(4, 11)).slice(0, 10), pmCheck, checkNo(), prod.denomination_cents * qty, 'Scrip day');
      q('INSERT INTO transaction_lines (transaction_id, description, scrip_product_id, quantity, unit_cents, amount_cents) VALUES (?,?,?,?,?,?)', Number(t.lastInsertRowid), `${prod.name} (${(prod.denomination_cents / 100).toFixed(2)})`, prod.id, qty, prod.denomination_cents, prod.denomination_cents * qty);
    }
    // service-fee refund for volunteers who finished last year
    if (returning && R() < 0.4) q("INSERT INTO transactions (family_id, school_year_id, transaction_type_id, transaction_date, payment_method_id, amount_cents, note) VALUES (?,?,(SELECT id FROM transaction_types WHERE code='service_refund'),?,?,?,?)", f.fam, prev.id, '2025-08-24', pmScrip, 10000, 'IN-N-OUT burger ($10) x10');
    f.registered = state;
  });

  // ---- room parents, middle/high school info, grades, student logins
  const rp = one("SELECT id FROM assignment_roles WHERE code='room_parent'").id;
  famInfo.filter((f) => f.roles.includes('room_parent')).forEach((f, i) => {
    const cc = ['CSL1A', 'CSL5A', 'CRD2A', 'BIL2A'][i];
    q('INSERT INTO class_assignments (school_class_id, person_id, assignment_role_id, school_year_id, start_date, end_date) VALUES (?,?,?,?,?,?)', classes[cc], f.p1, rp, year.id, year.first_day, year.last_day);
  });
  const district = (name) => one('SELECT id FROM school_districts WHERE name = ?', name).id;
  studentUsers.forEach(({ pid, f }, i) => {
    const k = f.kids.find((x) => x.pid === pid);
    if (f.registered) q('INSERT INTO student_school_info (student_person_id, school_year_id, school_name, grade, mailing_address, city, state, zipcode, counselor_name, counselor_phone, counselor_extension, school_district_id, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      pid, year.id, pick(['Design 39 Campus', 'Mesa Verde Middle', 'Poway High', 'Westview High', 'Del Norte High']), k.grade, `${between(100, 9999)} ${pick(STREETS)}`, 'San Diego', 'CA', '92127', `${pick(EN_ADULT_F)} ${pick(SUR)[0]}`, phone(), String(between(100, 999)), district('Poway Unified'), '');
    if (i < 6) {
      q('UPDATE persons SET email = ? WHERE id = ?', `student${i + 1}@example.com`, pid);
      addUser(pid, `demo.student${String(i + 1).padStart(2, '0')}`, ['student'], 'student');
    }
    const en = one('SELECT id FROM enrollments WHERE student_person_id = ? AND school_year_id = ? AND status = ?', pid, year.id, 'placed');
    if (en) for (const term of ['S1']) q('INSERT INTO credit_grades (enrollment_id, term, course_name, letter_grade, percent, credits, teacher_comment, published) VALUES (?,?,?,?,?,?,?,?)',
      en.id, term, 'Chinese Language (Credit)', pick(['A', 'A-', 'B+', 'A', 'B']), between(84, 99), 0.5, pick(['Excellent participation.', 'Good progress in writing.', 'Strong speaking skills.', '']), i % 4 === 0 ? 0 : 1);
  });

  // ---- a few outbox emails + audit samples
  q("INSERT INTO email_outbox (to_email, template, subject, body, status) VALUES (?,?,?,?,?)", 'demo.family01@example.com', 'payment_received', 'San Diego Chinese Academy - Payment received 已收到付款', 'We received your payment. Thank you! 謝謝！', 'logged');
  q("INSERT INTO email_outbox (to_email, template, subject, body, status) VALUES (?,?,?,?,?)", 'demo.family33@example.com', 'registration_received', 'San Diego Chinese Academy - Registration received 已收到註冊', 'Please submit the printed form with your check. 請附上列印的註冊表與支票。', 'logged');
  audit(db, 'schools', 1, 'demo_seed', null, { families: FAMILIES }, null);

  const out = ['SDCA portal — DEMO LOGINS (invented people; every demo account uses the same password)', `Generated ${new Date().toISOString()}`, `Sign in at /en/portal/signin`, '',
    'username'.padEnd(22) + 'role(s)'.padEnd(24) + 'password', ...logins.map(([u, r, p]) => u.padEnd(22) + r.padEnd(24) + p)];
  fs.mkdirSync(path.dirname(process.env.PORTAL_LOGINS_FILE || path.join(ROOT, 'data', 'x')), { recursive: true });
  const loginFile = process.env.PORTAL_LOGINS_FILE || path.join(ROOT, 'data', 'PORTAL-DEMO-LOGINS.txt');
  fs.writeFileSync(loginFile, out.join('\n') + '\n');
  const count = (t) => one(`SELECT COUNT(*) n FROM ${t}`).n;
  for (const t of DEMO_TABLES) q(`UPDATE ${t} SET is_demo = 1`);   // everything in these tables came from this demo load
  console.log(`demo loaded: ${count('families')} families, ${count('persons')} people, ${count('enrollments')} enrollments, ${count('transactions')} transactions, ${count('users')} users`);
  console.log('logins → data/PORTAL-DEMO-LOGINS.txt');
}

if (DEMO) wipe();
db.exec('BEGIN');
try {
  seedLookups();
  if (DEMO) demo();
  if (config.dataset === 'demo') q("UPDATE settings SET value_en = 'demo' WHERE key = 'dataset'");
  db.exec('COMMIT');
} catch (e) { db.exec('ROLLBACK'); throw e; }
console.log(`portal reference data ready (${one('SELECT COUNT(*) n FROM permissions').n} permissions, ${one('SELECT COUNT(*) n FROM roles').n} roles)`);
