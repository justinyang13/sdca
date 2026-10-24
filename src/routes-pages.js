// src/routes-pages.js — the main public pages: home, about, programs, enroll, contact, support, sponsors.
// All content (titles, bodies, people, programs, events, announcements, sponsors)
// is read from the SQLite DB at request time. i18n provides UI chrome only.
// Settings (phone, address, portal URLs) come from the `settings` table.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import ejs from 'ejs';
import { config } from './config.js';
import { createLimiter } from './middleware/index.js';
import { imgUrl, setting, pageBySlug } from './helpers.js';
import { portedCtx, usePorted } from './ported.js';
import { t, pickLang } from './i18n/index.js';
import { renderPage, renderMarkdown, makeRenderPart } from './web/render.js';
import { officeContact } from './school.js';
import { heroSlides, peopleInGroup } from './queries/content.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[0-9+()\s.-]{7,20}$/;

function jsonLdSchool(db, lang) {
  const get = (k) => setting(db, k, lang);
  return {
    '@context': 'https://schema.org',
    '@type': 'School',
    name: get('school_name_en') || 'San Diego Chinese Academy',
    alternateName: 'SDCA',
    foundingDate: get('founded_year') || '1988',
    telephone: officeContact(db).phone,
    email: officeContact(db).email,
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
    inLanguage: pickLang(lang, 'en', 'zh-Hant'),
  };
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

/** Register the main public pages (home, about, programs, enroll, contact, support, sponsors). */
export function registerPageRoutes(app, { db }) {
  function makePage(opts) {
    const routePath = opts.path.replace('/:lang', '');
    return function handler(req, res) {
      const lang = req.params.lang;
      const tFn = (k) => t(lang, k);
      const ctx = { lang, t: tFn, renderPart: makeRenderPart(lang), db, imgUrl, ...(opts.ctx ? opts.ctx(req, lang) : {}) };
      renderPage(res, {
        lang, view: opts.viewFile, ctx,
        title: opts.title(lang, ctx), description: opts.desc(lang, ctx),
        path: routePath, jsonLd: opts.jsonLd ? opts.jsonLd(lang, ctx) : null, db,
      });
    };
  }

  // ---------- Home ----------
  app.get('/:lang', makePage({
    path: '/:lang',
    viewFile: 'home.ejs',
    ctx: (req, lang) => ({
      tagline: pickLang(lang, 'Non-profit language school teaching Mandarin and Chinese culture since 1988', '非營利語言學校，自 1988 年起教授華語和中華文化'),
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
      slides: heroSlides(db)
        .map((r) => ({ ...r, html_en: renderMarkdown(r.description_en), html_zh: renderMarkdown(r.description_zh) })),
      announcements: db.prepare(
        'SELECT a.*, d.title_en AS doc_title_en, d.title_zh AS doc_title_zh, d.file_path AS doc_path '
        + 'FROM announcements a LEFT JOIN documents d ON d.id = a.document_id '
        + 'WHERE a.published = 1 AND a.deleted_at IS NULL ORDER BY a.published_at DESC LIMIT 5'
      ).all(),
      events: db.prepare(
        'SELECT * FROM events WHERE deleted_at IS NULL AND published = 1 ORDER BY starts_at DESC LIMIT 5'
      ).all(),
      // home page: "Upcoming Event" list + mini calendar come from the same events the portal manages
      calEvents: db.prepare('SELECT title_en, title_zh, starts_at, ends_at FROM events WHERE deleted_at IS NULL AND published = 1 ORDER BY starts_at, id').all(),
      programs: db.prepare('SELECT * FROM programs ORDER BY sort, name_en LIMIT 8').all(),
      sponsors: db.prepare('SELECT * FROM sponsors ORDER BY sort, name').all(),
      portalUrl: setting(db, 'registration_portal', lang),
      ...portedCtx(db, 'home', lang),
      _settings: {
        school_name_en: setting(db, 'school_name_en', lang),
        school_name_zh: setting(db, 'school_name_zh', lang),
        founded_year: setting(db, 'founded_year', lang),
        org_type: setting(db, 'org_type', lang),
        accreditation: setting(db, 'accreditation', lang),
      },
    }),
    title: (lang) => pickLang(lang, 'SDCA — San Diego Chinese Academy', 'SDCA — 聖地牙哥中華學苑'),
    desc: (lang) => pickLang(lang, 'Non-profit language school teaching Mandarin and Chinese culture since 1988', '非營利語言學校，自 1988 年起教授華語和中華文化'),
    jsonLd: (lang) => jsonLdSchool(db, lang),
  }));

  // ---------- About (4 routes) ----------
  const aboutRoutes = [
    { slug: 'about', path: '/about', view: 'about.ejs',
      t: lang => pickLang(lang, 'About SDCA', '關於 SDCA'),
      d: lang => pickLang(lang, 'Learn about our mission, history and values.', '了解聖地牙哥中華學苑的使命、歷史與價值觀。') },
    { slug: 'about-board', path: '/about/board', view: 'about-board.ejs',
      t: lang => pickLang(lang, 'SDCA Board of Directors', 'SDCA 董事會'),
      d: lang => pickLang(lang, 'Meet the nine board members who govern SDCA.', '認識領導聖地牙哥中華學苑的九位董事。') },
    { slug: 'about-staff', path: '/about/staff', view: 'about-staff.ejs',
      t: lang => pickLang(lang, 'SDCA Staff', 'SDCA 師資'),
      d: lang => pickLang(lang, 'Our principal, instructors and program leads.', '認識我們的校長與師資團隊。') },
    { slug: 'about-principal', path: '/about/principal', view: 'about-principal.ejs',
      t: lang => pickLang(lang, "SDCA Principal's Message", 'SDCA 校長的話'),
      d: lang => pickLang(lang, 'A welcome from our principal.', '歡迎來到聖地牙哥中華學苑。') },
  ];
  for (const r of aboutRoutes) {
    app.get(`/:lang${r.path}`, makePage({
      path: `/:lang${r.path}`,
      viewFile: usePorted(db, r.slug, r.view),
      ctx: (req, lang) => {
        const page = pageBySlug(db, r.slug);
        const board = peopleInGroup(db, 'board');
        const staff = peopleInGroup(db, 'staff');
        const principal = db.prepare('SELECT * FROM people WHERE name_en LIKE ? ORDER BY sort LIMIT 1').get('%Principal%');
        return {
          _pg: page || { title_en: r.t('en'), title_zh: r.t('zh'), body_en: '', body_zh: '' },
          ...portedCtx(db, r.slug, lang),
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
      t: lang => pickLang(lang, 'SDCA Programs', 'SDCA 課程'),
      d: lang => pickLang(lang, 'Pre-K through Grade 12 plus adult and recreational programs.', '從學前班到 12 年級，加上成人與休閒課程。') },
    { slug: 'programs-classes', path: '/programs/classes', view: 'programs-classes.ejs',
      t: lang => pickLang(lang, 'SDCA Classes & Placement', 'SDCA 課程與分班'),
      d: lang => pickLang(lang, 'Class descriptions and how placement works.', '課程說明與分班方式。') },
    { slug: 'programs-tcml', path: '/programs/tcml', view: 'programs-tcml.ejs',
      t: lang => pickLang(lang, 'Adult Chinese — TCML', '成人華語文班（TCML）'),
      d: lang => pickLang(lang, 'Community-based adult Chinese classes for 18+.', '適合 18 歲以上的社區中文班。') },
    { slug: 'programs-recreational', path: '/programs/recreational', view: 'programs-recreational.ejs',
      t: lang => pickLang(lang, 'SDCA Recreational & Culture', 'SDCA 休閒文化課程'),
      d: lang => pickLang(lang, 'Dance, yoga, baseball and cultural activities.', '舞蹈、瑜伽、棒球與文化活動。') },
    { slug: 'programs-ta', path: '/programs/ta', view: 'programs-ta.ejs',
      t: lang => pickLang(lang, 'SDCA TA Program', 'SDCA 教學助理計畫'),
      d: lang => pickLang(lang, 'Become a TA at SDCA and earn a stipend.', '成為 SDCA 教學助理並獲得津貼。') },
  ];
  for (const r of programRoutes) {
    app.get(`/:lang${r.path}`, makePage({
      path: `/:lang${r.path}`,
      viewFile: usePorted(db, r.slug, r.view),
      ctx: (req, lang) => {
        const page = pageBySlug(db, r.slug);
        const programs = db.prepare('SELECT * FROM programs ORDER BY sort, name_en').all();
        return {
          _pg: page || { title_en: r.t('en'), title_zh: r.t('zh'), body_en: '', body_zh: '' },
          ...portedCtx(db, r.slug, lang),
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

  // ---------- Registration portal (static copies of the old register.sandiegochineseschool.com pages) ----------
  const PORTAL_PAGES = {
    'signin': { en: 'Portal Sign In', zh: '登入 Portal' },
    'register': { en: 'New Family Sign Up', zh: '新家庭註冊' },
    'forgot-username': { en: 'Search for Username', zh: '查詢用戶名稱' },
    'forgot-password': { en: 'Request Password Reset', zh: '重建密碼' },
    'privacy': { en: 'Privacy Policy', zh: '隱私權須知' },
  };
  app.get('/:lang/portal', (req, res) => res.redirect(301, `/${req.params.lang}/portal/signin`));
  app.get('/:lang/portal/:page', (req, res, next) => {
    const meta = PORTAL_PAGES[req.params.page];
    if (!meta) return next();
    const file = path.join(config.viewsDir, 'portal', `${req.params.page}.html`);
    if (!fs.existsSync(file)) return next();
    const L = req.params.lang;
    const portalHtml = fs.readFileSync(file, 'utf8').replace(/\{\{L\}\}/g, L);
    return makePage({
      path: `/:lang/portal/${req.params.page}`,
      viewFile: 'portal.ejs',
      ctx: () => ({ portalHtml, portalTitle: meta[L] || meta.en, portalName: req.params.page }),
      title: () => `${meta[L] || meta.en} — SDCA`,
      desc: () => (L === 'zh' ? '聖地牙哥中華學苑網上註冊。' : 'SDCA online registration portal (static preview).'),
    })(req, res);
  });

  // ---------- Enroll ----------
  app.get('/:lang/enroll', makePage({
    path: '/:lang/enroll',
    viewFile: usePorted(db, 'enroll', 'enroll.ejs'),
    ctx: (req, lang) => {
      const page = pageBySlug(db, 'enroll');
      return {
        _pg: page || { title_en: 'Enrollment', title_zh: '報名註冊', body_en: '', body_zh: '' },
        ...portedCtx(db, 'enroll', lang),
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
    title: (lang) => pickLang(lang, 'SDCA Enrollment', 'SDCA 報名註冊'),
    desc: (lang) => pickLang(lang, 'How to register for the 2026-27 academic year.', '2026-27 學年度註冊說明。'),
    jsonLd: (lang) => jsonLdWebPage(lang, pickLang(lang, 'SDCA Enrollment', 'SDCA 報名註冊'), 'Enroll'),
  }));

  // ---------- Contact (GET) ----------
  app.get('/:lang/contact', makePage({
    path: '/:lang/contact',
    viewFile: 'contact.ejs',
    ctx: (req, lang) => ({
      _errors: {},
      _submitted: false, success: false,
      _form: {},
      ...portedCtx(db, 'contact', lang),
      _settings: contactSettings(db, lang),
    }),
    title: (lang) => pickLang(lang, 'Contact SDCA', 'SDCA 聯絡我們'),
    desc: (lang) => pickLang(lang, 'Send us a question about enrollment, programs or events.', '詢問報名、課程或活動相關問題。'),
    jsonLd: (lang) => jsonLdSchool(db, lang),
  }));

  // ---------- Contact (POST) ----------
  app.post('/:lang/contact', createLimiter({ max: Number(process.env.CONTACT_RATE_LIMIT || 5), windowMs: 60 * 60 * 1000 }), (req, res) => {
    const lang = req.params.lang;
    const tFn = (k) => t(lang, k);
    const renderPart = makeRenderPart(lang);
    const b = req.body || {};
    const errors = {};

    const honeypotTriggered = Boolean(b.website);
    const name = String(b.name || '').trim().slice(0, 120);
    const email = String(b.email || '').trim().slice(0, 254);
    const phone = String(b.phone || '').trim().slice(0, 40);
    const topic = String(b.topic || '').trim().slice(0, 80);
    const message = String(b.message || '').trim().slice(0, 5000);

    if (!honeypotTriggered) {
      if (name.length < 2) errors.name = tFn('form.required');
      if (!EMAIL_RE.test(email)) errors.email = tFn('form.invalid_email');
      if (phone && !PHONE_RE.test(phone)) errors.phone = tFn('form.required');
      if (!topic) errors.topic = tFn('form.required');
      if (message.length < 10) errors.message = tFn('form.required');
    }

    const send = (view, ctx, status) => renderPage(res, {
      lang, view, ctx: { t: tFn, renderPart, ...ctx }, status, path: '/contact', db,
      title: pickLang(lang, 'Contact SDCA', 'SDCA 聯絡我們'),
    });

    if (!honeypotTriggered && Object.keys(errors).length) {
      return send('contact.ejs', { _errors: errors, _submitted: true, success: false, _form: { name, email, phone, topic, message }, _settings: contactSettings(db, lang) }, 400);
    }

    if (!honeypotTriggered) {
      const ipHash = crypto.createHash('sha256').update(req.ip || '').digest('hex');
      db.prepare(
        'INSERT INTO contact_messages (name, email, phone, topic, message, lang, ip_hash, status) '
        + 'VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(name, email, phone, topic, message, lang, ipHash, 'new');
    }

    return send('contact-success.ejs', { _spam: honeypotTriggered }, 200);
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
    title: (lang) => pickLang(lang, 'Support SDCA', 'SDCA 支持中華學苑'),
    desc: (lang) => pickLang(lang, 'Make a tax-deductible donation by check or PayPal.', '透過支票或 PayPal 進行可報稅捐款。'),
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
        ...portedCtx(db, 'support-sponsors', lang),
        _sponsors: sponsors,
        _settings: { email_vp: setting(db, 'email_vp', lang) },
      };
    },
    title: (lang) => pickLang(lang, 'SDCA Sponsors', 'SDCA 贊助商'),
    desc: (lang) => pickLang(lang, 'Thank you to our generous sponsors.', '感謝我們的贊助商。'),
    jsonLd: (lang) => jsonLdWebPage(lang, pickLang(lang, 'SDCA Sponsors', 'SDCA 贊助商'), 'Sponsors'),
  }));
}
