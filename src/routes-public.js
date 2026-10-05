// src/routes-public.js — Phase 4 public page routes.
// All content (titles, bodies, people, programs, events, announcements, sponsors)
// is read from the SQLite DB at request time. i18n provides UI chrome only.
// Settings (phone, address, portal URLs) come from the `settings` table.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import ejs from 'ejs';
import { config } from './config.js';
import { imgUrl } from './helpers.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[0-9+()\s.-]{7,20}$/;

function jsonLdSchool(db, lang) {
  const get = (k) => {
    const r = db.prepare('SELECT value_en, value_zh FROM settings WHERE key = ?').get(k);
    if (!r) return '';
    if (lang === 'zh') return r.value_zh || r.value_en || '';
    return r.value_en || r.value_zh || '';
  };
  return {
    '@context': 'https://schema.org',
    '@type': 'School',
    name: get('school_name_en') || 'San Diego Chinese Academy',
    alternateName: 'SDCA',
    foundingDate: get('founded_year') || '1988',
    telephone: get('phone_digits') || '(858) 205-7322',
    email: get('email_office') || 'Office.SDCA@gmail.com',
    address: {
      '@type': 'PostalAddress',
      postalCode: '92191-0093',
      addressLocality: 'San Diego',
      addressRegion: 'CA',
      addressCountry: 'US',
    },
    url: get('website') || 'https://sandiegochineseschool.com',
  };
}

function jsonLdWebPage(lang, title, desc) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description: desc,
    inLanguage: lang === 'zh' ? 'zh-Hant' : 'en',
  };
}

function setting(db, key, lang) {
  const r = db.prepare('SELECT value_en, value_zh FROM settings WHERE key = ?').get(key);
  if (!r) return '';
  if (lang === 'zh') return r.value_zh || r.value_en || '';
  return r.value_en || r.value_zh || '';
}

function pageBySlug(db, slug) {
  return db.prepare('SELECT * FROM pages WHERE slug = ?').get(slug) || null;
}

function contactSettings(db, lang) {
  return {
    phone: setting(db, 'phone', lang),
    phone_digits: setting(db, 'phone_digits', lang),
    email_office: setting(db, 'email_office', lang),
    email_pta: setting(db, 'email_pta', lang),
    sms_number: setting(db, 'sms_number', lang),
    sms_keyword: setting(db, 'sms_keyword', lang),
    mailing_address: setting(db, 'mailing_address', lang),
    campus_name: setting(db, 'campus_name', lang),
    website: setting(db, 'website', lang),
  };
}

function pick(page, field, lang) {
  const en = page[`${field}_en`] || '';
  const zh = page[`${field}_zh`] || '';
  if (lang === 'zh') return { text: zh || en, note: zh ? null : (en ? 'meta.lang_note_zh' : null) };
  return { text: en || zh, note: en ? null : (zh ? 'meta.lang_note_en' : null) };
}

/**
 * Register Phase 4 routes.
 * Bridge must expose: makeRenderPart, renderShell, pageView, t, db, SUPPORTED
 */
export function registerPublicRoutes(app, bridge) {
  const { makeRenderPart, renderShell, pageView, renderMarkdown, t, db, SUPPORTED } = bridge;

  function makePage(opts) {
    const routePath = opts.path.replace('/:lang', '');
    return function handler(req, res) {
      const lang = req.params.lang;
      if (!SUPPORTED.includes(lang)) return res.status(404).send('Not found');
      const tFn = (k) => t(lang, k);
      const renderPart = makeRenderPart(lang);
      const ctx = { lang, t: tFn, renderPart, db, imgUrl, ...(opts.ctx ? opts.ctx(req, lang) : {}) };
      const body = pageView(opts.viewFile, ctx);
      const title = opts.title(lang, ctx);
      const desc = opts.desc(lang, ctx);
      res.render('layouts/main.ejs', {
        lang, t: tFn, renderPart,
        title, description: desc,
        canonical: `/${lang}${routePath}`,
        enUrl: `/en${routePath}`, zhUrl: `/zh${routePath}`,
        jsonLd: opts.jsonLd ? opts.jsonLd(lang, ctx) : null,
        body,
        ...renderShell(lang, { langPath: routePath }),
      });
    };
  }

  // ---------- Home ----------
  app.get('/:lang', makePage({
    path: '/:lang',
    viewFile: 'home.ejs',
    ctx: (req, lang) => ({
      tagline: lang === 'zh'
        ? '非營利語言學校，自 1988 年起教授華語和中華文化'
        : 'Non-profit language school teaching Mandarin and Chinese culture since 1988',
      heroImg: 'anniversary-30th',
      heroAltEn: 'SDCA community celebrating the 30th anniversary together',
      heroAltZh: '聖地牙哥中華學苑社群共同慶祝 30 週年',
      tiles: [
        { icon: 'book-open',
          titleEn: 'Real Classroom Learning', titleZh: '真實課堂學習',
          descEn: 'Small classes, experienced teachers, and a curriculum that grows with your child.',
          descZh: '小班教學、資深師資、與孩子一起成長的課程。' },
        { icon: 'lantern',
          titleEn: 'Mandarin & Culture', titleZh: '華語與文化',
          descEn: 'Lectures, songs, calligraphy, festival activities and interactive lessons.',
          descZh: '透過講座、歌唱、書法與節日活動培養真正的語言能力。' },
        { icon: 'people',
          titleEn: 'Community That Cares', titleZh: '充滿關懷的社群',
          descEn: 'A close-knit family of students, parents and teachers working together.',
          descZh: '學生、家長與老師緊密合作的社群。' },
        { icon: 'shield-heart',
          titleEn: 'Non-Profit Since 1988', titleZh: '自 1988 年起的非營利機構',
          descEn: 'A California non-profit funded by families, sponsors and Scrip sales.',
          descZh: '由家長、贊助商與禮券收入支持的加州非營利機構。' },
      ],
      announcements: db.prepare(
        'SELECT a.*, d.title_en AS doc_title_en, d.title_zh AS doc_title_zh, d.file_path AS doc_path '
        + 'FROM announcements a LEFT JOIN documents d ON d.id = a.document_id '
        + 'WHERE a.published = 1 ORDER BY a.published_at DESC LIMIT 5'
      ).all(),
      events: db.prepare(
        'SELECT * FROM events WHERE published = 1 ORDER BY starts_at DESC LIMIT 5'
      ).all(),
      programs: db.prepare('SELECT * FROM programs ORDER BY sort, name_en LIMIT 8').all(),
      sponsors: db.prepare('SELECT * FROM sponsors ORDER BY sort, name').all(),
      portalUrl: setting(db, 'registration_portal', lang),
      _settings: {
        school_name_en: setting(db, 'school_name_en', lang),
        school_name_zh: setting(db, 'school_name_zh', lang),
        founded_year: setting(db, 'founded_year', lang),
        org_type: setting(db, 'org_type', lang),
        accreditation: setting(db, 'accreditation', lang),
      },
    }),
    title: (lang) => lang === 'zh' ? 'SDCA — 聖地牙哥中華學苑' : 'SDCA — San Diego Chinese Academy',
    desc: (lang) => lang === 'zh'
      ? '非營利語言學校，自 1988 年起教授華語和中華文化'
      : 'Non-profit language school teaching Mandarin and Chinese culture since 1988',
    jsonLd: (lang) => jsonLdSchool(db, lang),
  }));

  // ---------- About (4 routes) ----------
  const aboutRoutes = [
    { slug: 'about', path: '/about', view: 'about.ejs',
      t: lang => lang === 'zh' ? '關於 SDCA' : 'About SDCA',
      d: lang => lang === 'zh' ? '了解聖地牙哥中華學苑的使命、歷史與價值觀。'
                              : 'Learn about our mission, history and values.' },
    { slug: 'about-board', path: '/about/board', view: 'about-board.ejs',
      t: lang => lang === 'zh' ? 'SDCA 董事會' : 'SDCA Board of Directors',
      d: lang => lang === 'zh' ? '認識領導聖地牙哥中華學苑的九位董事。'
                              : 'Meet the nine board members who govern SDCA.' },
    { slug: 'about-staff', path: '/about/staff', view: 'about-staff.ejs',
      t: lang => lang === 'zh' ? 'SDCA 師資' : 'SDCA Staff',
      d: lang => lang === 'zh' ? '認識我們的校長與師資團隊。'
                              : 'Our principal, instructors and program leads.' },
    { slug: 'about-principal', path: '/about/principal', view: 'about-principal.ejs',
      t: lang => lang === 'zh' ? 'SDCA 校長的話' : "SDCA Principal's Message",
      d: lang => lang === 'zh' ? '歡迎來到聖地牙哥中華學苑。'
                              : 'A welcome from our principal.' },
  ];
  for (const r of aboutRoutes) {
    app.get(`/:lang${r.path}`, makePage({
      path: `/:lang${r.path}`,
      viewFile: r.view,
      ctx: (req, lang) => {
        const page = pageBySlug(db, r.slug);
        const board = db.prepare('SELECT * FROM people WHERE "group" = ? ORDER BY sort, name_en').all('board');
        const staff = db.prepare('SELECT * FROM people WHERE "group" = ? ORDER BY sort, name_en').all('staff');
        const principal = db.prepare('SELECT * FROM people WHERE name_en LIKE ? ORDER BY sort LIMIT 1').get('%Principal%');
        return {
          _pg: page || { title_en: r.t('en'), title_zh: r.t('zh'), body_en: '', body_zh: '' },
          _board: board, _staff: staff, principal,
          heroImg: page?.hero_image ? page.hero_image.replace(/^img\//, '').replace(/-\d+\.jpg$/, '').replace(/\.jpg$/, '') : 'classroom-bilingual',
          _settings: {
            founded_year: setting(db, 'founded_year', lang),
            campus_name: setting(db, 'campus_name', lang),
            campus_since: setting(db, 'campus_since', lang),
            accreditation: setting(db, 'accreditation', lang),
            org_type: setting(db, 'org_type', lang),
            original_campus: setting(db, 'original_campus', lang),
          },
        };
      },
      title: (lang) => r.t(lang),
      desc: (lang) => r.d(lang),
      jsonLd: (lang) => jsonLdSchool(db, lang),
    }));
  }

  // ---------- Programs (5 routes) ----------
  const programRoutes = [
    { slug: 'programs', path: '/programs', view: 'programs.ejs',
      t: lang => lang === 'zh' ? 'SDCA 課程' : 'SDCA Programs',
      d: lang => lang === 'zh' ? '從學前班到 12 年級，加上成人與休閒課程。'
                              : 'Pre-K through Grade 12 plus adult and recreational programs.' },
    { slug: 'programs-classes', path: '/programs/classes', view: 'programs-classes.ejs',
      t: lang => lang === 'zh' ? 'SDCA 課程與分班' : 'SDCA Classes & Placement',
      d: lang => lang === 'zh' ? '課程說明與分班方式。'
                              : 'Class descriptions and how placement works.' },
    { slug: 'programs-tcml', path: '/programs/tcml', view: 'programs-tcml.ejs',
      t: lang => lang === 'zh' ? '成人華語文班（TCML）' : 'Adult Chinese — TCML',
      d: lang => lang === 'zh' ? '適合 18 歲以上的社區中文班。'
                              : 'Community-based adult Chinese classes for 18+.' },
    { slug: 'programs-recreational', path: '/programs/recreational', view: 'programs-recreational.ejs',
      t: lang => lang === 'zh' ? 'SDCA 休閒文化課程' : 'SDCA Recreational & Culture',
      d: lang => lang === 'zh' ? '舞蹈、瑜伽、棒球與文化活動。'
                              : 'Dance, yoga, baseball and cultural activities.' },
    { slug: 'programs-ta', path: '/programs/ta', view: 'programs-ta.ejs',
      t: lang => lang === 'zh' ? 'SDCA 教學助理計畫' : 'SDCA TA Program',
      d: lang => lang === 'zh' ? '成為 SDCA 教學助理並獲得津貼。'
                              : 'Become a TA at SDCA and earn a stipend.' },
  ];
  for (const r of programRoutes) {
    app.get(`/:lang${r.path}`, makePage({
      path: `/:lang${r.path}`,
      viewFile: r.view,
      ctx: (req, lang) => {
        const page = pageBySlug(db, r.slug);
        const programs = db.prepare('SELECT * FROM programs ORDER BY sort, name_en').all();
        return {
          _pg: page || { title_en: r.t('en'), title_zh: r.t('zh'), body_en: '', body_zh: '' },
          _programs: programs,
          heroImg: page?.hero_image ? page.hero_image.replace(/^img\//, '').replace(/-\d+\.jpg$/, '').replace(/\.jpg$/, '') : 'classroom-bilingual',
          _settings: {
            class_days: setting(db, 'class_days', lang),
            bell_times: setting(db, 'bell_times', lang),
            tcml_age: setting(db, 'tcml_age', lang),
            tcml_established: setting(db, 'tcml_established', lang),
            tcml_form: setting(db, 'tcml_form', lang),
            ta_form: setting(db, 'ta_form', lang),
            dance_fee_dropin: setting(db, 'dance_fee_dropin', lang),
            dance_fee_punch5: setting(db, 'dance_fee_punch5', lang),
            dance_fee_punch10: setting(db, 'dance_fee_punch10', lang),
          },
        };
      },
      title: (lang) => r.t(lang),
      desc: (lang) => r.d(lang),
      jsonLd: (lang) => jsonLdWebPage(lang, r.t(lang), r.d(lang)),
    }));
  }

  // ---------- Enroll ----------
  app.get('/:lang/enroll', makePage({
    path: '/:lang/enroll',
    viewFile: 'enroll.ejs',
    ctx: (req, lang) => {
      const page = pageBySlug(db, 'enroll');
      return {
        _pg: page || { title_en: 'Enrollment', title_zh: '報名註冊', body_en: '', body_zh: '' },
        heroImg: 'classroom-bilingual',
        _settings: {
          registration_portal: setting(db, 'registration_portal', lang),
          registration_new: setting(db, 'registration_new', lang),
          registration_returning: setting(db, 'registration_returning', lang),
          mail_registration: setting(db, 'mail_registration', lang),
          first_day_2026_27: setting(db, 'first_day_2026_27', lang),
          email_office: setting(db, 'email_office', lang),
          phone: setting(db, 'phone', lang),
        },
      };
    },
    title: (lang) => lang === 'zh' ? 'SDCA 報名註冊' : 'SDCA Enrollment',
    desc: (lang) => lang === 'zh' ? '2026-27 學年度註冊說明。'
                                  : 'How to register for the 2026-27 academic year.',
    jsonLd: (lang) => jsonLdWebPage(lang, lang === 'zh' ? 'SDCA 報名註冊' : 'SDCA Enrollment', 'Enroll'),
  }));

  // ---------- Contact (GET) ----------
  app.get('/:lang/contact', makePage({
    path: '/:lang/contact',
    viewFile: 'contact.ejs',
    ctx: (req, lang) => ({
      _errors: {},
      _submitted: false, success: false,
      _form: {},
      _settings: contactSettings(db, lang),
    }),
    title: (lang) => lang === 'zh' ? 'SDCA 聯絡我們' : 'Contact SDCA',
    desc: (lang) => lang === 'zh' ? '詢問報名、課程或活動相關問題。'
                                  : 'Send us a question about enrollment, programs or events.',
    jsonLd: (lang) => jsonLdSchool(db, lang),
  }));

  // ---------- Contact (POST) ----------
  app.post('/:lang/contact', (req, res) => {
    const lang = req.params.lang;
    if (!SUPPORTED.includes(lang)) return res.status(404).send('Not found');
    const tFn = (k) => t(lang, k);
    const renderPart = makeRenderPart(lang);
    const b = req.body || {};
    const errors = {};

    const honeypotTriggered = Boolean(b.website);
    const name = String(b.name || '').trim();
    const email = String(b.email || '').trim();
    const phone = String(b.phone || '').trim();
    const topic = String(b.topic || '').trim();
    const message = String(b.message || '').trim();

    if (!honeypotTriggered) {
      if (name.length < 2) errors.name = tFn('form.required');
      if (!EMAIL_RE.test(email)) errors.email = tFn('form.invalid_email');
      if (phone && !PHONE_RE.test(phone)) errors.phone = tFn('form.required');
      if (!topic) errors.topic = tFn('form.required');
      if (message.length < 10) errors.message = tFn('form.required');
    }

    const baseOpts = {
      lang, t: tFn, renderPart,
      title: lang === 'zh' ? 'SDCA 聯絡我們' : 'Contact SDCA',
      description: '',
      canonical: `/${lang}/contact`, enUrl: '/en/contact', zhUrl: '/zh/contact',
      ...renderShell(lang, { langPath: '/contact' }),
    };

    if (!honeypotTriggered && Object.keys(errors).length) {
      const body = pageView('contact.ejs', {
        lang, t: tFn, renderPart, _errors: errors, _submitted: true, success: false,
        _form: { name, email, phone, topic, message },
        _settings: contactSettings(db, lang),
        _errors: errors,
      });
      return res.status(400).render('layouts/main.ejs', { ...baseOpts, body });
    }

    if (!honeypotTriggered) {
      const ipHash = crypto.createHash('sha256').update(req.ip || '').digest('hex');
      db.prepare(
        'INSERT INTO contact_messages (name, email, phone, topic, message, lang, ip_hash, status) '
        + 'VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(name, email, phone, topic, message, lang, ipHash, 'new');
    }

    const body = pageView('contact-success.ejs', { lang, t: tFn, renderPart, _spam: honeypotTriggered });
    return res.status(200).render('layouts/main.ejs', { ...baseOpts, body });
  });

  // ---------- Support (2 routes) ----------
  app.get('/:lang/support', makePage({
    path: '/:lang/support',
    viewFile: 'support.ejs',
    ctx: (req, lang) => {
      const page = pageBySlug(db, 'support');
      return {
        _pg: page || { title_en: 'Support SDCA', title_zh: '支持中華學苑', body_en: '', body_zh: '' },
        heroImg: 'classroom-bilingual',
        _settings: {
          mailing_address: setting(db, 'mailing_address', lang),
          school_name_en: setting(db, 'school_name_en', lang),
          email_office: setting(db, 'email_office', lang),
          phone: setting(db, 'phone', lang),
          amazon_smile: setting(db, 'amazon_smile', lang),
          scrip_refund_1: setting(db, 'scrip_refund_1', lang),
          scrip_refund_2: setting(db, 'scrip_refund_2', lang),
          scrip_refund_3: setting(db, 'scrip_refund_3', lang),
        },
      };
    },
    title: (lang) => lang === 'zh' ? 'SDCA 支持中華學苑' : 'Support SDCA',
    desc: (lang) => lang === 'zh' ? '透過支票或 PayPal 進行可報稅捐款。'
                                  : 'Make a tax-deductible donation by check or PayPal.',
    jsonLd: (lang) => jsonLdSchool(db, lang),
  }));

  app.get('/:lang/support/sponsors', makePage({
    path: '/:lang/support/sponsors',
    viewFile: 'support-sponsors.ejs',
    ctx: (req, lang) => {
      const page = pageBySlug(db, 'support-sponsors');
      const sponsors = db.prepare('SELECT * FROM sponsors ORDER BY sort, name').all();
      return {
        _pg: page || { title_en: 'Our Sponsors', title_zh: '贊助商', body_en: '', body_zh: '' },
        _sponsors: sponsors,
        _settings: { email_vp: setting(db, 'email_vp', lang) },
      };
    },
    title: (lang) => lang === 'zh' ? 'SDCA 贊助商' : 'SDCA Sponsors',
    desc: (lang) => lang === 'zh' ? '感謝我們的贊助商。'
                                  : 'Thank you to our generous sponsors.',
    jsonLd: (lang) => jsonLdWebPage(lang, lang === 'zh' ? 'SDCA 贊助商' : 'SDCA Sponsors', 'Sponsors'),
  }));
}
