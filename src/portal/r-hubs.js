// src/portal/r-hubs.js — landing pages for the Profile, Account, Billing and Resources menus.
import { can } from './perm.js';
import { RESOURCES } from './render.js';
import { paidSql } from './money.js';
import { fmtDateTime } from '../datetime.js';
import { familyView } from './r-home.js';
import { portalHelpers } from './util.js';

export function registerHubRoutes(app, { db, page, requireLogin }) {
  const { lang: L, P, forbidden } = portalHelpers(page);
  const R = '/:lang/portal';

  // keep-alive for the "stay signed in" button / activity pings (the session cookie is renewed on every response)
  app.get(`${R}/ping`, requireLogin, (req, res) => res.status(204).set('Cache-Control', 'no-store').end());

  // "Manage Enrollment": registration buttons, registrations and where each child is placed — per family
  app.get(`${R}/enrollment`, requireLogin, (req, res) => {
    const fams = req.portal.familyIds.map((id) => familyView(db, id)).filter(Boolean);
    if (!fams.length) return forbidden(req, res);
    page(req, res, 'enrollment.ejs', { fams, canRegister: can(req.portal.access, 'registration.own') }, { title: 'Manage Enrollment' });
  });

  app.get(`${R}/profile`, requireLogin, (req, res) => {
    const { person, familyIds } = req.portal;
    const fid = familyIds[0];
    const fam = fid ? db.prepare('SELECT f.*, a.street, a.city, a.state, a.zipcode FROM families f LEFT JOIN addresses a ON a.id = f.address_id WHERE f.id = ?').get(fid) : null;
    const cards = [{ en: 'Personal Information', zh: '個人資料', desc_en: 'Your names, birthday and contact details.', desc_zh: '您的姓名、生日與聯絡方式。', href: P(req, `/people/${person.id}`) },
      { en: 'Edit Personal Information', zh: '編輯個人資料', desc_en: 'Update your own details.', desc_zh: '更新您的個人資料。', href: P(req, `/people/${person.id}/edit`) }];
    if (fid) cards.push({ en: 'Family & Address', zh: '家庭與住址', desc_en: 'Address, phones, email and emergency contact.', desc_zh: '住址、電話、電子郵件與緊急聯絡人。', href: P(req, `/families/${fid}/edit`) });
    page(req, res, 'hub.ejs', { hubTitle: { en: 'Profile', zh: '個人資料' }, rows: [
      [{ en: 'Chinese Name', zh: '中文姓名' }, person.chinese_name || '—'],
      [{ en: 'English Name', zh: '英文姓名' }, `${person.english_first_name} ${person.english_last_name}`],
      [{ en: 'Birthday', zh: '生日' }, person.birth_date || '—'],
      [{ en: 'Cell Phone', zh: '手機號碼' }, person.mobile || fam?.cell_phone || '—'],
      [{ en: 'Email', zh: '電子郵件' }, person.email || fam?.email || '—'],
      ...(fam ? [[{ en: 'Address', zh: '住址' }, [fam.street, fam.city, fam.state, fam.zipcode].filter(Boolean).join(', ') || '—']] : []),
    ], cards }, { title: 'Profile' });
  });

  app.get(`${R}/account`, requireLogin, (req, res) => {
    const { user, access, person } = req.portal;
    const email = person.email || db.prepare('SELECT f.email FROM families f JOIN family_members fm ON fm.family_id = f.id WHERE fm.person_id = ? AND fm.deleted_at IS NULL LIMIT 1').get(person.id)?.email || '—';
    page(req, res, 'hub.ejs', { hubTitle: { en: 'Account', zh: '帳號' }, rows: [
      [{ en: 'User Name', zh: '用戶名稱' }, user.username],
      [{ en: 'Account Status', zh: '帳號狀態' }, user.status],
      [{ en: 'Roles', zh: '角色' }, access.roles.map((r) => (L(req) === 'zh' ? r.name_zh || r.name_en : r.name_en)).join(', ')],
      [{ en: 'Account Email', zh: '帳號電子郵件' }, email],
      [{ en: 'Last Sign-in', zh: '上次登入' }, fmtDateTime(user.last_login_at) || '—'],
      [{ en: 'Password', zh: '密碼' }, '••••••••'],
    ], cards: [{ en: 'Change User Name', zh: '更改用戶名稱', desc_en: 'Pick a different sign-in name.', desc_zh: '選擇新的登入名稱。', href: P(req, '/change-username') }, { en: 'Change Password', zh: '更改密碼', desc_en: 'Choose a new password (8 or more characters).', desc_zh: '設定新密碼（至少八個字元）。', href: P(req, '/change-password') }] }, { title: 'Account' });
  });

  app.get(`${R}/billing`, requireLogin, (req, res) => {
    const fams = req.portal.familyIds;
    if (!can(req.portal.access, 'transactions.own') || !fams.length) return forbidden(req, res);
    const ph = fams.map(() => '?').join(',');
    const regs = db.prepare(`SELECT r.id, r.status, r.grand_total_cents, y.label AS year,
        ${paidSql('r')} AS paid_cents
      FROM registrations r JOIN school_years y ON y.id = r.school_year_id
      WHERE r.family_id IN (${ph}) AND r.deleted_at IS NULL AND r.status <> 'draft' ORDER BY y.label DESC, r.id DESC`).all(...fams);
    const recent = db.prepare(`SELECT t.id, t.transaction_date, t.amount_cents, t.voided_at, tt.name_en AS type_en, tt.name_zh AS type_zh FROM transactions t JOIN transaction_types tt ON tt.id = t.transaction_type_id
      WHERE t.family_id IN (${ph}) AND t.deleted_at IS NULL ORDER BY t.transaction_date DESC, t.id DESC LIMIT 5`).all(...fams);
    page(req, res, 'billing.ejs', { regs, recent, cards: [{ en: 'Transaction History', zh: '付款紀錄', desc_en: 'Every payment, receipt and refund for your family.', desc_zh: '您家庭的所有付款、收據與退款。', href: P(req, '/transactions') }] }, { title: 'Billing' });
  });

  app.get(`${R}/resources`, requireLogin, (req, res) => {
    const lang = L(req);
    page(req, res, 'hub.ejs', { hubTitle: { en: 'Resources', zh: '資源' }, rows: [], cards: RESOURCES.map((r) => ({ en: r.en, zh: r.zh, desc_en: r.desc_en, desc_zh: r.desc_zh, href: r.href(lang), blank: r.blank })) }, { title: 'Resources' });
  });
}
