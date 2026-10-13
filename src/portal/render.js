// src/portal/render.js — renders portal pages inside the site layout (header/footer + portal sidebar).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ejs from 'ejs';
import { config } from '../config.js';
import { ENTITIES, GROUPS } from './entities.js';
import { can } from './perm.js';
import { money } from './fees.js';

const dir = path.join(config.viewsDir, 'portal-app');
export const esc = (x) => String(x ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** One form row: <div class="frow"><label>…</label><input …><span class="ferr">…</span></div> */
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

export function ensureCsrf(req, res) {
  let tok = req.cookies?.sdca_csrf;
  if (!tok) { tok = crypto.randomBytes(32).toString('hex'); res.cookie('sdca_csrf', tok, { httpOnly: true, sameSite: 'Lax', path: '/' }); req.cookies = { ...(req.cookies || {}), sdca_csrf: tok }; }
  return tok;
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
  const pid = portal?.person?.id;
  const fid = portal?.familyIds?.[0];
  const profile = [{ en: 'Profile Overview', zh: '個人資料總覽', href: P('/profile') }];
  if (pid) profile.push({ en: 'Personal Information', zh: '個人資料', href: P(`/people/${pid}`) }, { en: 'Edit Personal Information', zh: '編輯個人資料', href: P(`/people/${pid}/edit`) });
  if (fid) profile.push({ en: 'Family & Address', zh: '家庭與住址', href: P(`/families/${fid}/edit`) });
  const billing = can(a, 'transactions.own') ? [
    { en: 'Billing Overview', zh: '帳務總覽', href: P('/billing') },
    { en: 'Transaction History', zh: '付款紀錄', href: P('/transactions') },
  ] : [];
  const menu = [
    { key: 'profile', en: 'Profile', zh: '個人資料', items: profile },
    { key: 'account', en: 'Account', zh: '帳號', items: [
      { en: 'Account Overview', zh: '帳號總覽', href: P('/account') },
      { en: 'Change User Name', zh: '更改用戶名稱', href: P('/change-username') },
      { en: 'Change Password', zh: '更改密碼', href: P('/change-password') },
    ] },
    ...(billing.length ? [{ key: 'billing', en: 'Billing', zh: '帳務', items: billing }] : []),
    { key: 'resources', en: 'Resources', zh: '資源', items: [
      { en: 'Resources Overview', zh: '資源總覽', href: P('/resources') },
      ...RESOURCES.map((r) => ({ en: r.en, zh: r.zh, href: r.href(lang), blank: r.blank })),
    ] },
  ];
  const home = { en: 'Home', zh: '首頁', href: P('') };
  const staff = [];
  if (a) {
    const special = [];
    if (can(a, 'placement.assign')) special.push({ en: 'Class Placement', zh: '分班', href: P('/placement') });
    if (can(a, 'fees.configure')) special.push({ en: 'Fees for a School Year', zh: '學年費用設定', href: P('/fees') });
    if (can(a, 'finance.record_payment')) special.push({ en: 'Enter Payment', zh: '輸入付款', href: P('/finance/payment') });
    if (can(a, 'reports.class_roster')) special.push({ en: 'Class Roster', zh: '班級人數清單', href: P('/class-roster') });
    if (can(a, 'student_list.list') || can(a, 'volunteer_list.list') || can(a, 'transactions.list')) special.push({ en: 'Reports & Exports', zh: '報表與匯出', href: P('/reports') });
    if (can(a, 'class.view_own')) special.push({ en: 'My Classes', zh: '我的班級', href: P('/my-classes') });
    if (can(a, 'roles.manage')) special.push({ en: 'Roles & Permissions', zh: '角色與權限', href: P('/manage/roles') });
    if (special.length) staff.push({ title: { en: 'Staff Tools', zh: '員工工具' }, items: special });
    for (const g of GROUPS) {
      const items = Object.entries(ENTITIES)
        .filter(([key, e]) => e.group === g.key && can(a, `${e.perm}.list`) && !(e.adminOnly && !can(a, 'roles.manage')) && key !== 'roles')
        .map(([key, e]) => ({ en: e.label.en, zh: e.label.zh, href: P(`/manage/${key}`) }));
      if (items.length) staff.push({ title: g.label, items });
    }
  }
  return { home, menu, staff };
}

export function makeRenderer({ makeRenderPart, renderShell, t, db }) {
  /**
   * page(req, res, view, locals, { status, title, shell })
   * shell: 'app' (sidebar, default when signed in) | 'bare' (public auth pages: centered card)
   */
  return function page(req, res, view, locals = {}, opts = {}) {
    const lang = req.params.lang || req.lang || 'en';
    const tFn = (k) => t(lang, k);
    const csrf = ensureCsrf(req, res);
    const flash = req.session?.portalFlash || null;
    if (req.session?.portalFlash) delete req.session.portalFlash;
    const b = (en, zh) => (lang === 'zh' ? zh || en : en);
    const one = (en, zh) => (lang === 'zh' ? zh || en : en);
    // Stored labels look like "三年級(3rd Grade)"; show only the selected language.
    const gl = (label) => { const m = /^(.*?)\s*\((.*)\)\s*$/.exec(label || ''); return m ? (lang === 'zh' ? m[1] : m[2]) : (label || ''); };
    const url = (p = '') => `/${lang}/portal${p}`;
    const base = {
      lang, t: tFn, b, one, gl, url, csrf, flash, money, esc, field: fieldRow, title: opts.title || '',
      csrfField: () => `<input type="hidden" name="_csrf" value="${csrf}">`,
      U: req.portal || null, can: (c) => can(req.portal?.access, c),
      ENTITIES, fmtDate: (d) => (d ? String(d).slice(0, 10) : ''), fmtDateTime: (d) => (d ? String(d).slice(0, 16) : ''),
      ...locals,
    };
    const v = tpl(view);
    const inner = ejs.render(v.src, base, { filename: v.file });
    const nav = req.portal ? buildNav(req.portal, lang) : null;
    const shellName = opts.shell || (req.portal ? 'app' : 'bare');
    const sh = tpl(`shell-${shellName}.ejs`);
    const body = ejs.render(sh.src, { ...base, inner, nav, title: opts.title || locals.title || '', current: req.path }, { filename: sh.file });
    const title = `${opts.title || locals.title || 'Portal'} — SDCA`;
    res.status(opts.status || 200).render('layouts/main.ejs', {
      lang, t: tFn, renderPart: makeRenderPart(lang), title, description: 'SDCA school portal',
      canonical: `/${lang}${req.path.replace(/^\/[a-z]{2}/, '')}`.replace(/\/$/, '') || `/${lang}/portal`,
      enUrl: `/en${req.langPath || '/portal'}`, zhUrl: `/zh${req.langPath || '/portal'}`, jsonLd: null, body,
      ...renderShell(lang, { langPath: req.langPath || '/portal' }),
    });
  };
}
