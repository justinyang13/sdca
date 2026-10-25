// src/portal/render.js — renders portal pages inside the site layout (header/footer + portal sidebar).
import fs from 'node:fs';
import path from 'node:path';
import ejs from 'ejs';
import { config } from '../config.js';
import { asset } from '../asset-version.js';
import { imageManifest } from '../helpers.js';
import { fmtDate, fmtDateTime, fmtLocalDateTime, utcToLocalParts, fmtLong, fmtTime } from '../datetime.js';
import { ENTITIES, GROUPS } from './entities.js';
import { can, canAll } from './perm.js';
import { ensureCsrf } from '../middleware/csrf.js';
import { money } from './fees.js';
import { t, pickLang, localized } from '../i18n/index.js';
import { makeRenderPart, renderShell } from '../web/render.js';

const dir = path.join(config.viewsDir, 'portal-app');
export const esc = (x) => String(x ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** One form row: <div class="frow"><label>…</label><input …><span class="ferr">…</span></div> */
/** a stored image value (library name or /path) → URL for a preview */
export function imgSrc(v) {
  if (!v) return '';
  const e = imageManifest()[v];
  if (e?.files?.length) { const f = e.files[Math.min(1, e.files.length - 1)].file; return f.startsWith('/') ? f : '/' + f; }
  return /^\//.test(v) ? v : '';
}

export function fieldRow(o) {
  const { label, name, type = 'text', value = '', error = '', required = false, options = null, attrs = '', help = '', size = '' } = o;
  const id = `f_${name}`;
  let input;
  if (options) {
    input = `<select id="${id}" name="${name}" ${attrs}>${options.map((x) => `<option value="${esc(x.v)}"${String(x.v) === String(value) ? ' selected' : ''}>${esc(x.label)}</option>`).join('')}</select>`;
  } else if (type === 'textarea') {
    input = `<textarea id="${id}" name="${name}" rows="3" ${attrs}>${esc(value)}</textarea>`;
  } else {
    input = `<input id="${id}" name="${name}" type="${type}" value="${esc(value)}" ${size ? `size="${size}"` : ''} ${attrs}${type === 'password' ? ' autocomplete="new-password"' : ''}>`;
  }
  return `<div class="frow${error ? ' has-error' : ''}"><label for="${id}">${required ? '<span class="req" aria-hidden="true">*</span> ' : ''}${label}</label><div class="fctl">${input}${help ? `<small class="fhelp">${help}</small>` : ''}${error ? `<span class="ferr">${esc(error)}</span>` : ''}</div></div>`;
}
const cache = new Map();
function tpl(name) {
  const file = path.join(dir, name);
  if (!config.isProduction || !cache.has(file)) cache.set(file, fs.readFileSync(file, 'utf8'));
  return { src: cache.get(file), file };
}

/** Documents and pages shown under the Resources menu (and its landing page). */
export const RESOURCES = [
  { en: 'Registration Notice', zh: '註冊須知', desc_en: 'Fees, dates and rules for the new school year.', desc_zh: '新學年的費用、日期與規定。', href: () => '/pdf/registration-notice-english', blank: true },
  { en: 'Online Registration User Guide', zh: '網上註冊說明', desc_en: 'Step-by-step guide to registering your children online.', desc_zh: '網上註冊的逐步說明。', href: () => '/pdf/online-registration-user-guide', blank: true },
  { en: 'Portal User Manual', zh: '入口網站使用手冊', desc_en: 'How to use the school portal.', desc_zh: '如何使用學校入口網站。', href: () => '/pdf/portal-user-manual', blank: true },
  { en: 'Privacy Policy', zh: '隱私權須知', desc_en: 'How we handle your family information.', desc_zh: '我們如何處理您的家庭資料。', href: (l) => `/${l}/portal/privacy` },
  { en: 'Waiver', zh: '網站使用同意書', desc_en: 'Release and consent forms for school activities.', desc_zh: '學校活動的同意書。', href: (l) => `/${l}/portal/waiver` },
  { en: 'Contact Us', zh: '聯絡我們', desc_en: 'Questions? Reach the school office.', desc_zh: '有問題？請聯絡學校辦公室。', href: (l) => `/${l}/contact` },
];

/** Sidebar structure for the signed-in user. */
export function buildNav(portal, lang) {
  const P = (p) => `/${lang}/portal${p}`;
  const a = portal?.access;
  const fid = portal?.familyIds?.[0];
  // ---- profile menu (avatar, top right): everything about "me" and my family's money / enrollment
  const profileMenu = [
    { en: 'Personal Info', zh: '個人資料', href: P('/profile') },
    { en: 'Password & Security', zh: '密碼與安全', href: P('/account') },
    ...(can(a, 'transactions.own') && fid ? [{ en: 'Billing & Payments', zh: '帳務與付款', href: P('/billing') }] : []),
    ...(fid && (can(a, 'registration.own') || can(a, 'family.own')) ? [{ en: 'Manage Enrollment', zh: '管理註冊', href: P('/enrollment') }] : []),
  ];
  // ---- left (hamburger) menu: the work areas
  const home = { en: 'Dashboard', zh: '首頁', href: P('') };
  const groups = [];
  if (a) {
    // Staff Tools = the website content tools
    const special = [];
    if (can(a, 'events.list')) special.push({ en: 'Events', zh: '活動', href: P('/manage/events') });
    if (can(a, 'announcements.list')) special.push({ en: 'Public Announcements', zh: '公開通告', href: P('/manage/announcements') });
    if (can(a, 'class_announcements.list') || can(a, 'class_announcements.post_own') || can(a, 'class_announcements.view_own')) special.push({ en: 'Class Announcements', zh: '班級通告', href: P('/class-announcements') });
    if (can(a, 'slides.list')) special.push({ en: 'Hero Slides', zh: '首頁橫幅', href: P('/manage/slides') });
    if (can(a, 'student_list.list') || can(a, 'volunteer_list.list') || can(a, 'transactions.list')) special.push({ en: 'Reports', zh: '報表', href: P('/reports') });
    if (special.length) groups.push({ title: { en: 'Staff Tools', zh: '員工工具' }, items: special });
    // Office Tools = the AI-assisted helpers (suggestions that staff confirm)
    const office = [];
    if (can(a, 'portal.staff')) office.push({ en: 'Chat Inbox', zh: '聊天信箱', href: P('/chat-inbox') }, { en: 'Data Quality', zh: '資料檢查', href: P('/data-quality') });
    if (canAll(a, 'volunteer_signups.update')) office.push({ en: 'Volunteer Matching', zh: '義工配對', href: P('/volunteer-match') });
    if (office.length) groups.push({ title: { en: 'Office Tools', zh: '辦公室工具' }, items: office });
    for (const g of GROUPS) {
      if (g.adminOnly && !can(a, 'roles.manage')) continue;      // the Admin menu is for the admin role only
      const items = Object.entries(ENTITIES)
        .filter(([key, e]) => e.group === g.key && can(a, `${e.perm}.list`) && !(e.adminOnly && !can(a, 'roles.manage')) && key !== 'roles' && key !== 'events' && key !== 'slides' && key !== 'announcements' && key !== 'documents' && key !== 'class_announcements' && key !== 'fee_schedules' && key !== 'withdrawal_fee_rules' && key !== 'family_members' && key !== 'parent_students' && key !== 'class_assignments' && key !== 'school_classes' && key !== 'student_school_info')
        .map(([key, e]) => ({ en: e.label.en, zh: e.label.zh, href: P(`/manage/${key}`) }));
      if (g.key === 'academics') {
        // Classes (the class page) · Enrollment (class placement lives in its rows) · Textbooks, then the rest
        const take = (href) => { const i = items.findIndex((x) => x.href === P(href)); return i < 0 ? null : items.splice(i, 1)[0]; };
        const ordered = [can(a, 'reports.class_roster') ? { en: 'Classes', zh: '班級', href: P('/class-roster') } : null, take('/manage/enrollments')].filter(Boolean);
        items.splice(0, items.length, ...ordered, ...items);
      }
      if (g.key === 'finance') {
        // Transactions · Registrations · Payment · Withdrawals, then whatever else this role may open (fee tables, scrip products)
        const by = (href) => items.findIndex((i) => i.href === P(href));
        const take = (href) => { const i = by(href); return i < 0 ? null : items.splice(i, 1)[0]; };
        const ordered = [take('/manage/transactions'), take('/manage/registrations'),
          can(a, 'finance.record_payment') ? { en: 'Payment', zh: '付款', href: P('/finance/payment') } : null, take('/manage/withdrawals')].filter(Boolean);
        const extra = [can(a, 'fees.configure') ? { en: 'Fees for a School Year', zh: '學年費用設定', href: P('/fees') } : null, can(a, 'finance.reports') ? { en: 'Finance Reports', zh: '財務報表', href: P('/finance/reports') } : null].filter(Boolean);
        items.splice(0, items.length, ...ordered, ...extra, ...items);
      }
      if (g.key === 'people') {   // Board Members right after Families
        const bi = items.findIndex((x) => x.href === P('/manage/board_members')), fi = items.findIndex((x) => x.href === P('/manage/families'));
        if (bi >= 0 && fi >= 0) { const [bm] = items.splice(bi, 1); items.splice(items.findIndex((x) => x.href === P('/manage/families')) + 1, 0, bm); }
      }
      if (g.key === 'admin' && can(a, 'roles.manage')) items.push({ en: 'Roles & Permissions', zh: '角色與權限', href: P('/manage/roles') });
      if (items.length) groups.push({ title: g.label, items });
    }
  }
  groups.push({ title: { en: 'Resources', zh: '資源' }, items: [
    { en: 'All Resources', zh: '資源總覽', href: P('/resources') },
    ...RESOURCES.map((r) => ({ en: r.en, zh: r.zh, href: r.href(lang), blank: r.blank })),
  ] });
  // a group with a single entry is just a link (no chevron)
  const drawer = [{ link: home }, ...groups.map((g) => (g.items.length === 1 ? { link: g.items[0] } : { group: g }))];
  return { home, profileMenu, drawer };
}

export function makeRenderer({ db }) {
  /**
   * page(req, res, view, locals, { status, title, shell })
   * shell: 'app' (sidebar, default when signed in) | 'bare' (public auth pages: centered card)
   */
  return function page(req, res, view, locals = {}, opts = {}) {
    const lang = req.params.lang || req.lang || 'en';
    const tFn = (k) => t(lang, k);
    const csrf = ensureCsrf(req, res);
    let flash = req.session?.portalFlash || null;
    if (!flash && req.cookies?.sdca_loggedout) { flash = { type: 'ok', msg: pickLang(lang, 'You have been signed out of the portal.', '您已登出入口網站。') }; res.clearCookie('sdca_loggedout', { path: '/' }); }
    if (req.session?.portalFlash) delete req.session.portalFlash;
    const b = (en, zh) => (lang === 'zh' ? zh || en : en);
    const one = b;
    // Stored labels look like "三年級(3rd Grade)"; show only the selected language.
    const gl = (label) => { const m = /^(.*?)\s*\((.*)\)\s*$/.exec(label || ''); return m ? (lang === 'zh' ? m[1] : m[2]) : (label || ''); };
    const url = (p = '') => `/${lang}/portal${p}`;
    const base = {
      lang, t: tFn, b, one, gl, url, pickLang, localized, idleMinutes: config.sessionIdleMinutes, asset, csrf, flash, money, esc, field: fieldRow, title: opts.title || '',
      csrfField: () => `<input type="hidden" name="_csrf" value="${csrf}">`,
      U: req.portal || null, can: (c) => can(req.portal?.access, c),
      ENTITIES, imgSrc, imageLibrary: () => Object.keys(imageManifest()).sort(), fmtDate, fmtDateTime, fmtLocalDateTime, utcToLocalParts, fmtLong: (v) => fmtLong(v, lang), fmtTime: (v) => fmtTime(v, lang),
      ...locals,
    };
    const v = tpl(view);
    const inner = ejs.render(v.src, base, { filename: v.file });
    const nav = req.portal ? buildNav(req.portal, lang) : null;
    const shellName = opts.shell || (req.portal ? 'app' : 'bare');
    const sh = tpl(`shell-${shellName}.ejs`);
    const body = ejs.render(sh.src, { ...base, inner, nav, title: opts.title || locals.title || '', current: req.path }, { filename: sh.file });
    // signed-in portal pages get their own header (hamburger menu + profile menu) and a slim footer — never the public site menu
    let portalChrome = {};
    if (shellName === 'app') {
      const alt = pickLang(lang, 'zh', 'en');
      const ctx = { ...base, nav, current: req.path, altLangUrl: `/${alt}${req.langPath || '/portal'}${req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : ''}`, altLangLabel: alt === 'zh' ? '中文' : 'EN' };
      const hd = tpl('portal-header.ejs'); const ft = tpl('portal-footer.ejs');
      portalChrome = { header: ejs.render(hd.src, ctx, { filename: hd.file }), footer: ejs.render(ft.src, ctx, { filename: ft.file }) };
    }
    const title = `${opts.title || locals.title || 'Portal'} — SDCA`;
    res.status(opts.status || 200).render('layouts/main.ejs', {
      lang, t: tFn, renderPart: makeRenderPart(lang), title, description: 'SDCA school portal',
      canonical: `/${lang}${req.path.replace(/^\/[a-z]{2}/, '')}`.replace(/\/$/, '') || `/${lang}/portal`,
      enUrl: `/en${req.langPath || '/portal'}`, zhUrl: `/zh${req.langPath || '/portal'}`, jsonLd: null, body,
      ...renderShell(lang, { langPath: req.langPath || '/portal' }),
      ...portalChrome,
    });
  };
}
