// src/portal/r-auth.js — public portal pages: sign in, sign out, new family, invitation, forgot username/password, change password.
import { hashPassword } from '../admin/auth.js';
import { loginLimiter } from '../middleware/index.js';
import { csrfMiddleware } from '../middleware/csrf.js';
import { audit } from './crud.js';
import {
  attemptLogin, queueEmail, createPasswordReset, findReset, findInvitation, phoneMatchesFamily, phoneMatchesPerson, setPassword, markUsed, passwordPolicyError,
} from './auth.js';
import { verifyPassword } from '../admin/auth.js';

const s = (v) => String(v ?? '').trim();
export const DEMO_EMAIL = process.env.PORTAL_EMAIL_MODE !== 'smtp';

export function registerAuthRoutes(app, { db, page, requireLogin, isStaticBuild }) {
  const R = '/:lang/portal';
  const lang = (req) => req.params.lang;
  const go = (req, res, p, flash) => { if (flash) req.session.portalFlash = flash; res.redirect(`/${lang(req)}/portal${p}`); };
  const skipStatic = (req, res, next) => (isStaticBuild(req) ? next('route') : next());

  // ----- sign in -----
  app.get(`${R}/signin`, skipStatic, (req, res) => {
    if (req.portal) return go(req, res, '');
    let error = null;
    if (req.cookies?.sdca_timedout) { res.clearCookie('sdca_timedout', { path: '/' }); error = req.params.lang === 'zh' ? '因閒置過久，已自動登出，請重新登入。' : 'You were signed out because of inactivity. Please sign in again.'; }
    page(req, res, 'signin.ejs', { error, username: '' }, { title: 'Sign In', shell: 'bare' });
  });
  app.post(`${R}/signin`, skipStatic, loginLimiter, csrfMiddleware, (req, res) => {
    const r = attemptLogin(db, s(req.body.username), String(req.body.password || ''), req.ip);
    if (!r.ok) {
      const msg = { locked: 'Account temporarily locked. Try again in 15 minutes. 帳戶暫時鎖定，請十五分鐘後再試。', pending: 'Account not activated yet. 帳戶尚未啟用。', disabled: 'Account disabled. 帳戶已停用。' }[r.error]
        || 'Invalid username or password. 用戶名稱或密碼錯誤。';
      return page(req, res, 'signin.ejs', { error: msg, username: s(req.body.username) }, { title: 'Sign In', shell: 'bare', status: 401 });
    }
    const wanted = req.session.portalNext;
    req.session.regenerate((err) => {
      if (err) return res.status(500).send('session error');
      req.session.portalUserId = r.user.id;
      if (r.user.must_change_password) req.session.portalFlash = { type: 'warn', msg: 'Please change your password. 請更改密碼。' };
      req.session.save(() => res.redirect(r.user.must_change_password ? `/${lang(req)}/portal/change-password` : (wanted && /^\/(en|zh)\/portal(\/|$|\?)/.test(wanted) ? wanted : `/${lang(req)}/portal`)));
    });
  });
  app.post(`${R}/signout`, csrfMiddleware, (req, res) => {
    const l = lang(req);
    req.session.regenerate(() => res.redirect(`/${l}/portal/signin`));
  });

  // ----- forgot username -----
  app.get(`${R}/forgot-username`, skipStatic, (req, res) => page(req, res, 'forgot-username.ejs', { found: null, email: '' }, { title: 'Search for Username', shell: 'bare' }));
  app.post(`${R}/forgot-username`, skipStatic, loginLimiter, csrfMiddleware, (req, res) => {
    const email = s(req.body.email).toLowerCase();
    const users = email ? db.prepare(`SELECT DISTINCT u.username FROM users u JOIN persons p ON p.id = u.person_id
      LEFT JOIN family_members fm ON fm.person_id = p.id AND fm.deleted_at IS NULL LEFT JOIN families f ON f.id = fm.family_id
      WHERE u.deleted_at IS NULL AND (lower(p.email) = ? OR lower(f.email) = ?) ORDER BY u.username`).all(email, email) : [];
    if (users.length) queueEmail(db, { to: email, template: 'forgot_username', subject: 'San Diego Chinese Academy - Your username 您的用戶名稱', body: `Your username(s): ${users.map((u) => u.username).join(', ')}` });
    page(req, res, 'forgot-username.ejs', { found: users.map((u) => u.username), email }, { title: 'Search for Username', shell: 'bare' });
  });

  // ----- forgot password / reset -----
  app.get(`${R}/forgot-password`, skipStatic, (req, res) => page(req, res, 'forgot-password.ejs', { sent: false, link: null }, { title: 'Request Password Reset', shell: 'bare' }));
  app.post(`${R}/forgot-password`, skipStatic, loginLimiter, csrfMiddleware, (req, res) => {
    const u = db.prepare('SELECT * FROM users WHERE username = ? AND deleted_at IS NULL').get(s(req.body.username));
    let link = null;
    if (u && u.status !== 'disabled') {
      const raw = createPasswordReset(db, u);
      link = `/${lang(req)}/portal/reset-password/${raw}`;
      const fam = db.prepare("SELECT f.email FROM families f JOIN family_members fm ON fm.family_id = f.id WHERE fm.person_id = ? AND fm.deleted_at IS NULL LIMIT 1").get(u.person_id);
      const to = db.prepare('SELECT email FROM persons WHERE id = ?').get(u.person_id)?.email || fam?.email || '';
      queueEmail(db, { to, template: 'password_reset', subject: 'San Diego Chinese Academy - Password Reset 重建密碼',
        body: `Click this link within 6 hours 請於六小時內按此連結: ${link}`, relatedType: 'users', relatedId: u.id });
    }
    page(req, res, 'forgot-password.ejs', { sent: true, link: DEMO_EMAIL ? link : null }, { title: 'Request Password Reset', shell: 'bare' });
  });
  app.get(`${R}/reset-password/:token`, skipStatic, (req, res) => {
    const r = findReset(db, req.params.token);
    page(req, res, 'reset-password.ejs', { valid: !!r, error: null, token: req.params.token }, { title: 'Reset Password', shell: 'bare', status: r ? 200 : 410 });
  });
  app.post(`${R}/reset-password/:token`, skipStatic, loginLimiter, csrfMiddleware, (req, res) => {
    const r = findReset(db, req.params.token);
    const fail = (error) => page(req, res, 'reset-password.ejs', { valid: !!r, error, token: req.params.token }, { title: 'Reset Password', shell: 'bare', status: 400 });
    if (!r) return fail('This link has expired. Request a new one. 連結已失效，請重新申請。');
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(r.user_id);
    const fams = db.prepare('SELECT family_id FROM family_members WHERE person_id = ? AND deleted_at IS NULL').all(u.person_id);
    const phoneOk = fams.some((f) => phoneMatchesFamily(db, f.family_id, req.body.phone)) || phoneMatchesPerson(db, u.person_id, req.body.phone);
    if (!phoneOk) return fail('The phone number does not match our records. 電話號碼與紀錄不符。');
    const pw = String(req.body.password || '');
    if (pw !== String(req.body.password2 || '')) return fail('Passwords do not match. 兩次密碼不同。');
    const pe = passwordPolicyError(pw); if (pe) return fail(pe);
    setPassword(db, u.id, pw); markUsed(db, 'password_resets', r.id);
    go(req, res, '/signin', { type: 'ok', msg: 'Password saved. Please sign in. 密碼已儲存，請登入。' });
  });

  // ----- invitation (existing family creates its first login) -----
  app.get(`${R}/invite/:token`, skipStatic, (req, res) => {
    const inv = findInvitation(db, req.params.token);
    page(req, res, 'invite.ejs', { valid: !!inv, error: null, token: req.params.token, username: '' }, { title: 'Create User With Invitation', shell: 'bare', status: inv ? 200 : 410 });
  });
  app.post(`${R}/invite/:token`, skipStatic, loginLimiter, csrfMiddleware, (req, res) => {
    const inv = findInvitation(db, req.params.token);
    const fail = (error) => page(req, res, 'invite.ejs', { valid: !!inv, error, token: req.params.token, username: s(req.body.username) }, { title: 'Create User With Invitation', shell: 'bare', status: 400 });
    if (!inv) return fail('This invitation has expired. Reply to the email for a new one. 邀請已失效。');
    if (!phoneMatchesFamily(db, inv.family_id, req.body.phone)) return fail('The phone number does not match our records. 電話號碼與紀錄不符。');
    const username = s(req.body.username); const pw = String(req.body.password || '');
    if (username.length < 4) return fail('User name needs at least 4 characters. 用戶名稱至少四個字。');
    if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) return fail('That user name is taken. 用戶名稱已被使用。');
    if (pw !== String(req.body.password2 || '')) return fail('Passwords do not match. 兩次密碼不同。');
    const pe = passwordPolicyError(pw); if (pe) return fail(pe);
    const parent = db.prepare("SELECT person_id FROM family_members WHERE family_id = ? AND relationship = 'parent_one' AND deleted_at IS NULL").get(inv.family_id);
    if (!parent) return fail('No parent on file. 找不到家長資料。');
    const uid = createUser(db, { personId: parent.person_id, username, password: pw, roleCodes: ['parent'], type: 'parent', lang: lang(req) });
    markUsed(db, 'invitations', inv.id);
    audit(db, 'users', uid, 'invitation_accepted', null, null, uid, req.ip);
    go(req, res, '/signin', { type: 'ok', msg: 'Account created. Please sign in. 帳戶已建立，請登入。' });
  });

  // ----- new family (public) -----
  app.get(`${R}/register`, skipStatic, (req, res) => page(req, res, 'new-family.ejs', { v: { state: 'CA', list_in_directory: 'Y', gender: 'M', native_language: 'Mandarin', gender2: 'F', native_language2: 'Mandarin' }, errors: {} }, { title: 'New Family Sign Up', shell: 'bare' }));
  app.post(`${R}/register`, skipStatic, loginLimiter, csrfMiddleware, (req, res) => {
    const b = req.body; const v = {}; for (const k of Object.keys(b)) v[k] = s(b[k]);
    const errors = {};
    for (const k of ['street', 'city', 'zipcode', 'home_phone', 'email', 'emergency_contact', 'emergency_home_phone', 'emergency_cell_phone', 'p1_last', 'p1_first', 'username']) if (!v[k]) errors[k] = 'required';
    if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email)) errors.email = 'invalid email';
    if (v.username && v.username.length < 4) errors.username = 'at least 4 characters';
    if (v.username && db.prepare('SELECT 1 FROM users WHERE username = ?').get(v.username)) errors.username = 'taken';
    const pw = String(b.password || '');
    if (passwordPolicyError(pw)) errors.password = passwordPolicyError(pw);
    if (pw !== String(b.password2 || '')) errors.password2 = 'does not match';
    if (Object.keys(errors).length) return page(req, res, 'new-family.ejs', { v, errors }, { title: 'New Family Sign Up', shell: 'bare', status: 400 });
    const uid = createNewFamily(db, v, pw, lang(req));
    req.session.regenerate(() => {
      req.session.portalUserId = uid;
      req.session.portalFlash = { type: 'ok', msg: 'Welcome! Your family account is ready. Add your children below, then register. 歡迎！請加入子女資料後註冊。' };
      req.session.save(() => res.redirect(`/${lang(req)}/portal`));
    });
  });

  // ----- change user name (signed in; needs the current password) -----
  app.get(`${R}/change-username`, requireLogin, (req, res) => page(req, res, 'change-username.ejs', { error: null, v: '' }, { title: 'Change User Name' }));
  app.post(`${R}/change-username`, requireLogin, csrfMiddleware, (req, res) => {
    const u = req.portal.user; const nu = s(req.body.username);
    const fail = (error) => page(req, res, 'change-username.ejs', { error, v: nu }, { title: 'Change User Name', status: 400 });
    if (!verifyPassword(String(req.body.current || ''), u.password_hash)) return fail('Current password is wrong. 目前密碼錯誤。');
    if (nu.length < 4 || nu.length > 40 || !/^[A-Za-z0-9._@-]+$/.test(nu)) return fail('User name must be 4-40 characters: letters, numbers, . _ @ - only. 用戶名稱須為4至40個字元，僅限英數字及 . _ @ -');
    if (nu.toLowerCase() === u.username.toLowerCase() && nu === u.username) return fail('That is already your user name. 這已是您的用戶名稱。');
    if (db.prepare('SELECT 1 FROM users WHERE username = ? AND id <> ?').get(nu, u.id)) return fail('That user name is taken. 用戶名稱已被使用。');
    db.prepare("UPDATE users SET username = ?, updated_at = datetime('now'), updated_by = ? WHERE id = ?").run(nu, u.id, u.id);
    audit(db, 'users', u.id, 'username_changed', { username: u.username }, { username: nu }, u.id, req.ip);
    go(req, res, '/account', { type: 'ok', msg: 'User name changed. 用戶名稱已更改。' });
  });

  // ----- change password (signed in) -----
  app.get(`${R}/change-password`, requireLogin, (req, res) => page(req, res, 'change-password.ejs', { error: null }, { title: 'Change Password' }));
  app.post(`${R}/change-password`, requireLogin, csrfMiddleware, (req, res) => {
    const u = req.portal.user;
    const fail = (error) => page(req, res, 'change-password.ejs', { error }, { title: 'Change Password', status: 400 });
    if (!verifyPassword(String(req.body.current || ''), u.password_hash)) return fail('Current password is wrong. 目前密碼錯誤。');
    const pw = String(req.body.password || '');
    if (pw !== String(req.body.password2 || '')) return fail('Passwords do not match. 兩次密碼不同。');
    const pe = passwordPolicyError(pw); if (pe) return fail(pe);
    setPassword(db, u.id, pw);
    go(req, res, '', { type: 'ok', msg: 'Password changed. 密碼已更改。' });
  });
}

import { createUser, createPerson, createFamily, addFamilyMember } from './creators.js';
export { createUser, createPerson, createFamily, addFamilyMember };

function createNewFamily(db, v, pw, lang) {
  db.exec('BEGIN');
  try {
    const famId = createFamily(db, v);
    const p1 = createPerson(db, { english_last_name: v.p1_last, english_first_name: v.p1_first, chinese_name: v.p1_chinese, gender: v.gender || 'M', native_language: v.native_language || 'Mandarin', email: v.email });
    addFamilyMember(db, famId, p1, 'parent_one');
    if (v.p2_last && v.p2_first) {
      const p2 = createPerson(db, { english_last_name: v.p2_last, english_first_name: v.p2_first, chinese_name: v.p2_chinese, gender: v.gender2 || 'F', native_language: v.native_language2 || 'Mandarin' });
      addFamilyMember(db, famId, p2, 'parent_two');
    }
    const uid = createUser(db, { personId: p1, username: v.username, password: pw, roleCodes: ['parent'], type: 'parent', lang });
    db.prepare('UPDATE persons SET created_by = ?, updated_by = ? WHERE id = ?').run(uid, uid, p1);
    audit(db, 'families', famId, 'new_family_signup', null, { username: v.username }, uid);
    db.exec('COMMIT');
    return uid;
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}
