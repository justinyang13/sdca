// src/chat/sources.js — knowledge sources. Each source: { name, audiences, load(db) -> docs[] }.
// A doc is { source, title, text, url }. Add a source here to give the bot new knowledge.
import fs from 'node:fs';
import { blocksToText } from './text.js';
import { officeContact } from '../school.js';

const faqPath = new URL('./faq.json', import.meta.url);

const NESTED = /^(about|programs|parents|support)-/;
const pageUrl = (slug) => (slug === 'home' ? '/en/' : `/en/${NESTED.test(slug) ? slug.replace('-', '/') : slug}`);

const pages = {
  name: 'pages',
  audiences: ['public'],
  load(db) {
    const rows = db.prepare('SELECT slug, title_en, title_zh, body_en, body_zh, blocks FROM pages WHERE published = 1').all();
    const docs = [];
    for (const r of rows) {
      let blockText = '';
      try { blockText = blocksToText(JSON.parse(r.blocks || '[]')).join('\n'); } catch { /* bad JSON: fall back to body */ }
      const text = [blockText, r.body_en, r.body_zh].filter(Boolean).join('\n');
      if (!text.trim()) continue;
      docs.push({ source: 'pages', title: r.title_en || r.title_zh || r.slug, titleZh: r.title_zh, text, url: pageUrl(r.slug), slug: r.slug });
    }
    return docs;
  },
};

const events = {
  name: 'events',
  audiences: ['public'],
  load(db) {
    const rows = db.prepare(`SELECT slug, title_en, title_zh, description_en, description_zh, starts_at, location
      FROM events WHERE published = 1 AND deleted_at IS NULL AND starts_at >= date('now','-1 day') ORDER BY starts_at`).all();
    return rows.map((r) => ({
      source: 'events',
      title: r.title_en || r.title_zh,
      text: [`Event: ${r.title_en} ${r.title_zh}`, `Date: ${r.starts_at}`, r.location && `Location: ${r.location}`, r.description_en, r.description_zh].filter(Boolean).join('\n'),
      url: '/en/events',
    }));
  },
};

const announcements = {
  name: 'announcements',
  audiences: ['public'],
  load(db) {
    const cols = db.prepare('PRAGMA table_info(announcements)').all().map((c) => c.name);
    const t = (c) => (cols.includes(c) ? c : "''");
    const rows = db.prepare(`SELECT ${t('slug')} slug, ${t('title_en')} te, ${t('title_zh')} tz, ${t('body_en')} be, ${t('body_zh')} bz FROM announcements`).all();
    return rows.filter((r) => (r.be || r.bz)).map((r) => ({
      source: 'announcements', title: r.te || r.tz, text: [r.te, r.tz, r.be, r.bz].filter(Boolean).join('\n'), url: r.slug ? `/en/news/${r.slug}` : '/en/news',
    }));
  },
};

const faq = {
  name: 'faq',
  audiences: ['public'],
  load(db) {
    // {{office_email}} / {{office_phone}} in the FAQ text come from the admin settings, so there is one place to change them
    const c = officeContact(db);
    const fill = (s) => s.replaceAll('{{office_email}}', c.email).replaceAll('{{office_phone}}', c.phone);
    const items = JSON.parse(fs.readFileSync(faqPath, 'utf8'));
    return items.map((f) => ({ source: 'faq', title: f.q_en, text: fill(`Q: ${f.q_en}\n${f.q_zh}\nA: ${f.a_en}\n${f.a_zh}`), url: f.url || '', boost: 2 }));
  },
};


// ---- structured database sources (clean, curated rows beat scraped page text) ----
const money = (c) => `$${(c / 100).toFixed(2).replace(/\.00$/, '')}`;

const board = {
  name: 'board',
  audiences: ['public'],
  load(db) {
    const rows = db.prepare('SELECT * FROM v_public_board ORDER BY sort').all();
    if (!rows.length) return [];
    const who = (r) => `${r.english_first_name} ${r.english_last_name} ${r.chinese_name}`.replace(/\s+/g, ' ').trim();
    const docs = rows.map((r) => ({ source: 'board', title: `${r.position_en} of the SDCA Board`, url: '/en/about/board', boost: 2,
      text: `The ${r.position_en} (${r.position_zh}, board position 理事) of SDCA is ${who(r)}.` }));
    docs.push({ source: 'board', title: 'SDCA Board of Directors (current members)', url: '/en/about/board', boost: 2,
      text: `Board of Directors members, board list:\n${rows.map((r) => `${r.position_en} (${r.position_zh}): ${who(r)}`).join('\n')}` });
    return docs;
  },
};

const schedule = {
  name: 'schedule',
  audiences: ['public'],
  load(db) {
    const docs = [];
    const y = db.prepare('SELECT * FROM v_public_school_year').get();
    if (y) docs.push({ source: 'schedule', title: `School year ${y.label} key dates`, url: '/en/documents', boost: 2,
      text: `School year ${y.label} key dates and schedule: first day of school ${y.first_day}; last day ${y.last_day}; second semester starts ${y.second_semester_start}; early registration deadline ${y.early_reg_deadline}. Classes meet on Sundays. See the school calendar for every date.` });
    const types = db.prepare('SELECT * FROM v_public_class_times ORDER BY sort').all();
    if (types.length) docs.push({ source: 'schedule', title: 'Class times by program (Sunday class schedule)', url: '/en/programs/classes', boost: 2,
      text: 'Class schedule / class times / hours. Classes meet on Sunday afternoons:\n' + types.map((t) => `${t.name_en} (${t.name_zh}): ${t.meets_start} to ${t.meets_end}, ${t.weeks} weeks${t.min_age ? `, minimum age ${t.min_age}` : ''}${t.is_credit ? ', high school credit' : ''}`).join('\n') });
    const classes = db.prepare('SELECT * FROM v_public_classes ORDER BY code').all();
    if (classes.length) docs.push({ source: 'schedule', title: 'Classes and rooms', url: '/en/programs/classes', boost: 2,
      text: 'Classes and classrooms:\n' + classes.map((c) => `${c.name_en} ${c.name_zh} (${c.type_en})${c.room ? `: room ${c.room}${c.building ? `, ${c.building}` : ''}` : ''}`).join('\n') });
    return docs;
  },
};

const programs = {
  name: 'programs',
  audiences: ['public'],
  load(db) {
    return db.prepare('SELECT * FROM programs').all().map((r) => ({ source: 'programs', title: r.name_en, url: '/en/programs/classes',
      text: [`Program: ${r.name_en} ${r.name_zh}`, `Grades: ${r.grades_en} ${r.grades_zh}`, r.description_en, r.description_zh].filter(Boolean).join('\n') }));
  },
};

const volunteer = {
  name: 'volunteer',
  audiences: ['public'],
  load(db) {
    const jobs = db.prepare('SELECT name_en, name_zh FROM volunteer_jobs WHERE active = 1 AND deleted_at IS NULL ORDER BY sort').all();
    const docs = [];
    if (jobs.length) docs.push({ source: 'volunteer', title: 'Volunteer jobs', url: '/en/parents/volunteer', text: 'Parent volunteer jobs:\n' + jobs.map((j) => `${j.name_en} ${j.name_zh}`).join('\n') });
    return docs;
  },
};

// Fees: only real (non-demo) rows are visible through v_public_fees, so this stays empty until staff enter the real ones.
const fees = {
  name: 'fees',
  audiences: ['public'],
  load(db) {
    const rows = db.prepare('SELECT * FROM v_public_fees ORDER BY sort').all();
    if (!rows.length) return [];
    return [{ source: 'fees', title: `Tuition and fees ${rows[0].school_year}`, url: '/en/enroll', boost: 2,
      text: `Tuition and fees ${rows[0].school_year}:\n` + rows.map((r) => `${r.name_en} ${r.name_zh}: ${r.percent ? `${r.percent}%` : money(r.amount_cents)} (per ${r.applies_to})${r.deadline ? `, deadline ${r.deadline}` : ''}`).join('\n') }];
  },
};

// Text of published PDFs, extracted offline by scripts/extract-pdfs.py -> data/chat/pdf-text.json
const CURRENT_YEAR_START = 2026;   // school year 2026-27; bump each July
const pdfs = {
  name: 'pdfs',
  audiences: ['public'],
  load() {
    const f = new URL('../../data/chat/pdf-text.json', import.meta.url);
    if (!fs.existsSync(f)) return [];
    // skip PDFs about earlier school years (old notices and calendars contradict the current ones); undated ones stay
    const current = (d) => d.school_year_start == null || d.school_year_start >= CURRENT_YEAR_START;
    return JSON.parse(fs.readFileSync(f, 'utf8')).filter(current).map((d) => ({
      source: 'pdfs', title: [d.title_en, d.title_zh, d.year].filter(Boolean).join(' '), url: `/en/documents/${d.slug}`, text: d.text,
    }));
  },
};

export const SOURCES = [faq, board, schedule, programs, volunteer, fees, pdfs, pages, events, announcements];
