// tests/components.test.js — COMPONENT tests: the browser scripts (public/js/*.js) run against real markup in jsdom, and the EJS partials
// (header, footer, hero carousel, event rows, portal header) rendered with fixtures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ejs from 'ejs';
import { JSDOM } from 'jsdom';
import { pickLang, localized } from '../src/i18n/index.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = (f) => fs.readFileSync(path.join(ROOT, 'public', 'js', f), 'utf8');

/** A page with the given body markup; the listed scripts are run in it. Timers are captured so tests can fire them by hand. */
function page(html, scripts, { url = 'http://localhost/en/portal', fetchImpl, now } = {}) {
  const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`, { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.__intervals = []; w.__timeouts = [];
  w.setInterval = (fn, ms) => { w.__intervals.push({ fn, ms }); return w.__intervals.length; }; w.clearInterval = () => {};
  w.setTimeout = (fn, ms) => { w.__timeouts.push({ fn, ms }); return w.__timeouts.length; }; w.clearTimeout = () => {};
  if (!w.matchMedia) w.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, addListener() {} });
  w.fetch = fetchImpl || (async () => ({ status: 204 }));
  w.confirm = () => true;
  if (now) w.Date.now = now;
  for (const s of [].concat(scripts)) w.eval(src(s));
  if (w.document.readyState === 'loading') w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  return { dom, w, d: w.document };
}
const click = (w, el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
const key = (w, el, k) => el.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));

// ------------------------------------------------------------------ session-timeout.js
test('session timeout: warns two minutes before, counts down, "Stay signed in" pings and hides the banner, expiry sets the notice cookie', async () => {
  let t = 1_000_000; const pings = [];
  const { w, d } = page('<div data-session-timeout="30" data-ping="/en/portal/ping" data-lang="en" hidden></div>', 'session-timeout.js',
    { now: () => t, fetchImpl: async (u) => { pings.push(u); return { status: 204 }; } });
  const tick = w.__intervals[0].fn;
  t += 10 * 60000; tick(); assert.equal(d.querySelector('.idle-banner'), null, 'no banner while active');
  t += 18.5 * 60000; tick();                                                                 // 28.5 minutes idle
  const banner = d.querySelector('.idle-banner'); assert.ok(banner, 'banner at 28 minutes');
  assert.match(banner.textContent, /You will be signed out in 1:30/); assert.match(banner.textContent, /Stay signed in/);
  t += 30000; tick(); assert.match(d.querySelector('.idle-msg').textContent, /1:00/, 'it counts down');
  click(w, banner.querySelector('button')); await new Promise((r) => setImmediate(r));
  assert.deepEqual(pings, ['/en/portal/ping']); assert.equal(d.querySelector('.idle-banner'), null, 'staying signed in hides the banner');
  t += 31 * 60000; tick(); assert.match(d.cookie, /sdca_timedout=1/, 'the sign-in page will explain the sign-out');
});
test('session timeout: activity pings at most once a minute; a failed ping means "signed out"; Chinese text', async () => {
  let t = 5_000_000; const pings = []; let status = 204;
  const { w, d } = page('<div data-session-timeout="30" data-ping="/zh/portal/ping" data-lang="zh" hidden></div>', 'session-timeout.js', { now: () => t, fetchImpl: async (u) => { pings.push(u); return { status }; } });
  click(w, d.body); assert.equal(pings.length, 0, 'recent activity: no ping yet');
  t += 61000; click(w, d.body); click(w, d.body); await new Promise((r) => setImmediate(r)); assert.equal(pings.length, 1, 'one ping per minute');
  t += 29 * 60000; w.__intervals[0].fn(); assert.match(d.querySelector('.idle-banner').textContent, /保持登入/);
  status = 302; click(w, d.querySelector('.idle-banner button')); await new Promise((r) => setImmediate(r)); assert.match(d.cookie, /sdca_timedout=1/);
});
test('session timeout: pages without the marker do nothing', () => { const { w } = page('<p>public page</p>', 'session-timeout.js'); assert.equal(w.__intervals.length, 0); });

// ------------------------------------------------------------------ portal-app.js
const HEADER = `<header data-portal-header><button data-ph-open="drawer" aria-expanded="false" aria-controls="ph-drawer">☰</button><div class="ph-profile"><button data-ph-open="profile" aria-expanded="false">👤</button>
  <div class="ph-menu" data-ph-panel="profile" data-open="false"><a href="/x">Personal Info</a></div></div><div class="ph-overlay" data-ph-close data-open="false"></div>
  <aside id="ph-drawer" data-ph-panel="drawer" data-open="false"><button data-ph-close>×</button><a href="/en/portal">Dashboard</a></aside></header>`;
test('portal header: the hamburger opens the drawer, the overlay / X / Escape close it; the profile menu opens, closes on outside click and Escape; only one is open', () => {
  const { w, d } = page(HEADER + '<main><p id="outside">x</p></main>', 'portal-app.js');
  const [burger, avatar] = d.querySelectorAll('[data-ph-open]'); const drawer = d.getElementById('ph-drawer'); const menu = d.querySelector('.ph-menu'); const overlay = d.querySelector('.ph-overlay');
  click(w, burger); assert.equal(drawer.dataset.open, 'true'); assert.equal(overlay.dataset.open, 'true'); assert.equal(burger.getAttribute('aria-expanded'), 'true'); assert.equal(d.body.style.overflow, 'hidden');
  click(w, overlay); assert.equal(drawer.dataset.open, 'false'); assert.equal(overlay.dataset.open, 'false'); assert.equal(d.body.style.overflow, '');
  click(w, burger); click(w, drawer.querySelector('[data-ph-close]')); assert.equal(drawer.dataset.open, 'false');
  click(w, burger); key(w, d, 'Escape'); assert.equal(drawer.dataset.open, 'false', 'Escape closes');
  click(w, avatar); assert.equal(menu.dataset.open, 'true'); assert.equal(avatar.getAttribute('aria-expanded'), 'true');
  click(w, d.getElementById('outside')); assert.equal(menu.dataset.open, 'false', 'outside click closes the profile menu');
  click(w, avatar); click(w, burger); assert.equal(menu.dataset.open, 'false', 'opening the drawer closes the profile menu'); assert.equal(drawer.dataset.open, 'true');
  click(w, avatar); assert.equal(drawer.dataset.open, 'false', 'and the other way round'); assert.equal(menu.dataset.open, 'true');
});
const TABLE = `<div data-col-table="people"><table><thead><tr><th data-col="a">A</th><th data-col="b" class="col-off">B</th></tr></thead><tbody>
  <tr class="data-row"><td data-col="a"><button class="row-toggle" aria-expanded="false">▸</button>1</td><td data-col="b" class="col-off">2</td></tr><tr class="row-detail" hidden><td colspan="2">details</td></tr></tbody></table></div>
  <details data-col-picker="people" data-defaults="a"><summary>Columns</summary><label><input type="checkbox" value="a" checked disabled></label><label><input type="checkbox" value="b"></label><button type="button" data-col-reset>Reset</button></details>`;
test('lists: the ▸ arrow opens and closes the row details', () => {
  const { w, d } = page(TABLE, 'portal-app.js'); const btn = d.querySelector('.row-toggle'); const detail = d.querySelector('.row-detail');
  click(w, btn); assert.equal(detail.hidden, false); assert.equal(btn.getAttribute('aria-expanded'), 'true'); assert.equal(btn.textContent, '▾');
  click(w, btn); assert.equal(detail.hidden, true); assert.equal(btn.textContent, '▸');
});
test('lists: the Columns picker shows / hides columns, remembers the choice in this browser and resets to the defaults', () => {
  const { w, d } = page(TABLE, 'portal-app.js'); const boxB = d.querySelector('input[value=b]'); const cellB = () => d.querySelector('td[data-col=b]');
  assert.ok(cellB().classList.contains('col-off'), 'default: hidden');
  boxB.checked = true; boxB.dispatchEvent(new w.Event('change', { bubbles: true })); assert.ok(!cellB().classList.contains('col-off')); assert.deepEqual(JSON.parse(w.localStorage.getItem('sdca.cols.people')), ['a', 'b']);
  const again = page(TABLE, 'portal-app.js', {}); // a fresh page starts from defaults…
  assert.ok(again.d.querySelector('td[data-col=b]').classList.contains('col-off'));
  w.localStorage.setItem('sdca.cols.people', JSON.stringify(['a', 'b']));
  const saved = new JSDOM(`<body>${TABLE}</body>`, { url: 'http://localhost/', runScripts: 'outside-only' }); saved.window.localStorage.setItem('sdca.cols.people', JSON.stringify(['a', 'b']));
  saved.window.matchMedia = () => ({ matches: false }); saved.window.eval(src('portal-app.js'));
  assert.ok(!saved.window.document.querySelector('td[data-col=b]').classList.contains('col-off'), '…and a saved choice is applied on load');
  click(saved.window, saved.window.document.querySelector('[data-col-reset]')); assert.ok(saved.window.document.querySelector('td[data-col=b]').classList.contains('col-off'), 'reset');
  assert.equal(saved.window.localStorage.getItem('sdca.cols.people'), null);
});
test('lists: dropdown filters submit at once, the search box on Enter', () => {
  const { w, d } = page('<form data-instant-filters><input type="search" name="q"><select name="f_a"><option>1</option></select></form>', 'portal-app.js');
  let submits = 0; d.querySelector('form').submit = () => { submits += 1; };
  d.querySelector('select').dispatchEvent(new w.Event('change', { bubbles: true })); assert.equal(submits, 1);
  key(w, d.querySelector('input'), 'a'); assert.equal(submits, 1); key(w, d.querySelector('input'), 'Enter'); assert.equal(submits, 2);
});
test('forms: data-confirm blocks a submit that is declined; all-day disables the time boxes; the image library fills its text box', () => {
  const { w, d } = page(`<form data-confirm="Sure?"><button>go</button></form><input type="checkbox" name="all_day"><input type="time" data-time-for="starts_at" value="09:30">
    <input id="f_image"><select data-fill="f_image"><option value=""></option><option value="enroll-bg">enroll-bg</option></select>`, 'portal-app.js');
  let ev = new w.Event('submit', { bubbles: true, cancelable: true }); w.confirm = () => false; d.querySelector('form').dispatchEvent(ev); assert.equal(ev.defaultPrevented, true);
  ev = new w.Event('submit', { bubbles: true, cancelable: true }); w.confirm = () => true; d.querySelector('form').dispatchEvent(ev); assert.equal(ev.defaultPrevented, false);
  const cb = d.querySelector('[name=all_day]'); const time = d.querySelector('[data-time-for]'); cb.checked = true; cb.dispatchEvent(new w.Event('change')); assert.equal(time.disabled, true); assert.equal(time.value, '');
  cb.checked = false; cb.dispatchEvent(new w.Event('change')); assert.equal(time.disabled, false);
  const sel = d.querySelector('select'); sel.value = 'enroll-bg'; sel.dispatchEvent(new w.Event('change', { bubbles: true })); assert.equal(d.getElementById('f_image').value, 'enroll-bg');
});
test('forms: the person look-up box asks the server and fills the hidden id when a match is picked', async () => {
  const calls = [];
  const { w, d } = page('<div><input class="ref-input" data-url="/api/lookup/persons" data-target="h1"><input type="hidden" id="h1"></div>', 'portal-app.js',
    { fetchImpl: async (u) => { calls.push(u); return { json: async () => [{ id: 7, label: 'Pat Chen' }] }; } });
  const input = d.querySelector('.ref-input'); input.value = 'Pa'; input.dispatchEvent(new w.Event('input', { bubbles: true }));
  w.__timeouts.at(-1).fn(); await new Promise((r) => setImmediate(r)); await new Promise((r) => setImmediate(r));
  assert.deepEqual(calls, ['/api/lookup/persons?q=Pa']); const li = d.querySelector('.ref-list li'); assert.equal(li.textContent, 'Pat Chen');
  li.dispatchEvent(new w.MouseEvent('mousedown', { bubbles: true, cancelable: true })); assert.equal(d.getElementById('h1').value, '7'); assert.equal(input.value, 'Pat Chen');
  input.value = ''; input.dispatchEvent(new w.Event('input', { bubbles: true })); assert.equal(d.getElementById('h1').value, '', 'clearing the box clears the id');
});

// ------------------------------------------------------------------ hero-carousel.js, mini-calendar.js
const CAROUSEL = `<section data-carousel><div data-carousel-slides><article class="hero-carousel-slide"></article><article class="hero-carousel-slide"></article><article class="hero-carousel-slide"></article></div>
  <button data-carousel-prev></button><button data-carousel-next></button><button data-carousel-dot></button><button data-carousel-dot></button><button data-carousel-dot></button></section>`;
test('hero carousel: first slide shown, next / previous / dots / keys / swipe move it, it wraps, auto-advances every 6 s and pauses on hover', () => {
  const { w, d } = page(CAROUSEL, 'hero-carousel.js'); const root = d.querySelector('[data-carousel]'); const slides = [...d.querySelectorAll('.hero-carousel-slide')]; const dots = [...d.querySelectorAll('[data-carousel-dot]')];
  const cur = () => slides.findIndex((s) => s.classList.contains('is-current'));
  assert.equal(cur(), 0); assert.equal(dots[0].getAttribute('aria-selected'), 'true'); assert.equal(w.__intervals.at(-1).ms, 6000, 'auto-advance every 6 seconds');
  click(w, d.querySelector('[data-carousel-next]')); assert.equal(cur(), 1); click(w, d.querySelector('[data-carousel-prev]')); click(w, d.querySelector('[data-carousel-prev]')); assert.equal(cur(), 2, 'wraps backwards');
  click(w, dots[1]); assert.equal(cur(), 1); assert.equal(dots[1].classList.contains('is-active'), true); assert.equal(dots[0].getAttribute('aria-selected'), 'false');
  key(w, root, 'ArrowRight'); assert.equal(cur(), 2); key(w, root, 'Home'); assert.equal(cur(), 0); key(w, root, 'End'); assert.equal(cur(), 2); key(w, root, 'ArrowLeft'); assert.equal(cur(), 1);
  w.__intervals.at(-1).fn(); assert.equal(cur(), 2, 'the timer advances'); w.__intervals.at(-1).fn(); assert.equal(cur(), 0, 'and wraps');
  const before = w.__intervals.length; root.dispatchEvent(new w.MouseEvent('mouseenter')); root.dispatchEvent(new w.MouseEvent('mouseleave')); assert.equal(w.__intervals.length, before + 1, 'resumes after the pointer leaves');
  root.dispatchEvent(new w.MouseEvent('pointerdown', { clientX: 200 })); root.dispatchEvent(new w.MouseEvent('pointerup', { clientX: 100 })); assert.equal(cur(), 1, 'swipe left = next');
});
test('hero carousel: respects reduced motion (no timer) and a single slide is left alone', () => {
  const rm = new JSDOM(`<body>${CAROUSEL}</body>`, { url: 'http://localhost/', runScripts: 'outside-only' }); const ints = []; rm.window.setInterval = (fn, ms) => ints.push(ms);
  rm.window.matchMedia = () => ({ matches: true, addEventListener() {} }); rm.window.eval(src('hero-carousel.js')); assert.equal(ints.length, 0);
  const one = page('<section data-carousel><div data-carousel-slides><article class="hero-carousel-slide"></article></div></section>', 'hero-carousel.js'); assert.equal(one.w.__intervals.length, 0);
});
test('mini calendar: shows the month of the events, marks event days, shows a tooltip, moves between months, speaks Chinese', () => {
  const ev = JSON.stringify([{ date: '2026-10-25', title: 'Mid-term Exam' }, { date: '2026-10-25', title: 'Room Parents' }, { date: '2026-11-14', title: 'Culture Lesson' }]).replace(/"/g, '&quot;');
  const { w, d } = page(`<aside data-mini-cal data-lang="en" data-events="${ev}"></aside>`, 'mini-calendar.js', { now: undefined });
  const root = d.querySelector('[data-mini-cal]'); assert.match(root.querySelector('.mc-title').textContent, /October 2026|November 2026/);
  root.querySelector('.mc-nav[aria-label="Next month"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true })); const title = root.querySelector('.mc-title').textContent; assert.match(title, /2026/);
  for (let i = 0; i < 3; i++) { if (/October/.test(root.querySelector('.mc-title').textContent)) break; root.querySelector('.mc-nav[aria-label="Previous month"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true })); }
  assert.match(root.querySelector('.mc-title').textContent, /October 2026/); const marked = root.querySelector('.mc-has'); assert.equal(marked.textContent, '25'); assert.match(marked.getAttribute('aria-label'), /Mid-term Exam; Room Parents/);
  marked.dispatchEvent(new w.MouseEvent('mouseenter')); assert.equal(root.querySelector('.mc-pop').hidden, false); assert.match(root.querySelector('.mc-pop').textContent, /October 25, 2026/); assert.equal(root.querySelectorAll('.mc-pop-ev').length, 2);
  marked.dispatchEvent(new w.MouseEvent('mouseleave')); assert.equal(root.querySelector('.mc-pop').hidden, true);
  const days = root.querySelectorAll('.mc-day:not(.mc-empty)').length; assert.equal(days, 31);
  const zh = page('<aside data-mini-cal data-lang="zh" data-events="[]"></aside>', 'mini-calendar.js'); assert.match(zh.d.querySelector('.mc-title').textContent, /年/); assert.equal(zh.d.querySelector('.mc-dow').textContent, '日');
  const bad = page('<aside data-mini-cal data-events="not json"></aside>', 'mini-calendar.js'); assert.ok(bad.d.querySelector('.mc-grid'), 'bad data does not break the calendar');
});

// ------------------------------------------------------------------ the other small scripts load without errors
test('nav, tabs, lightbox, slider, forms and portal scripts run on a page without their markup (no exceptions)', () => {
  for (const f of ['nav.js', 'tabs.js', 'lightbox.js', 'slider.js', 'forms.js', 'portal.js']) assert.doesNotThrow(() => page('<main><p>nothing here</p></main>', f), f);
});

// ------------------------------------------------------------------ EJS partials
const render = (file, locals = {}) => ejs.render(fs.readFileSync(path.join(ROOT, 'views', file), 'utf8'), { pickLang, localized, ...locals }, { filename: path.join(ROOT, 'views', file) });
test('partial: hero carousel renders every layout from slide records (title, description, image, link) in both languages and escapes input', () => {
  const slides = [
    { layout: 'intro', image: '/img/slides/a.jpg', caption_en: 'Welcome', caption_zh: '歡迎', html_en: '<p>EN text</p>', html_zh: '<p>中文</p>', link_url: '/about', link_label_en: 'About SDCA', image_left: '/img/l.gif', image_right: '/img/r.gif' },
    { layout: 'photo', image: '/img/slides/b.jpg', caption_en: 'Open <b>House</b>', caption_zh: '開放日', html_en: '<p>Come</p>', html_zh: '<p>歡迎</p>', link_url: '/enroll', link_label_en: 'Visit', link_label_zh: '參觀' },
    { layout: 'feature', image: 'nonexistent-key', caption_en: 'Enroll now', caption_zh: '立即報名', html_en: '<p>Tagline</p>', link_url: '/programs/classes', link_label_en: 'Explore', link2_url: '/portal/signin', link2_label_en: 'Enroll Now' },
  ];
  const mk = (lang) => render('partials/hero-carousel.ejs', { lang, L: { slides, schoolName: 'SDCA' }, imageManifest: () => ({}) });
  const en = mk('en'); const zh = mk('zh');
  assert.equal((en.match(/<article class="hero-carousel-slide[ "]/g) || []).length, 3); assert.match(en, /is-intro/); assert.match(en, /<p>EN text<\/p>/); assert.match(en, /About SDCA/);
  assert.match(en, /src="\/img\/slides\/b\.jpg"/); assert.match(en, /Open &lt;b&gt;House&lt;\/b&gt;/, 'title is escaped'); assert.doesNotMatch(en, /<b>House/);
  assert.match(en, /href="\/en\/enroll"[^>]*>Visit/); assert.match(en, /href="\/en\/portal\/signin"[^>]*>Enroll Now/); assert.match(en, /hero-carousel-hero-fallback|hero-carousel-fallback/, 'unknown image falls back to a plain block');
  assert.match(zh, /開放日/); assert.match(zh, /href="\/zh\/enroll"[^>]*>參觀/); assert.match(zh, /了解更多|立即報名/); assert.equal((zh.match(/hero-carousel-dot/g) || []).length >= 3, true);
  assert.match(render('partials/hero-carousel.ejs', { lang: 'en', L: { slides: [], schoolName: 'S' }, imageManifest: () => ({}) }), /data-carousel/, 'no slides: still renders');
});
test('partial: footer shows the portal buttons, and "Portal Sign Out" only for a signed-in visitor', () => {
  const t = (k) => k; const base = { lang: 'en', t, langPath: '/enroll', renderPart: () => '', asset: (p) => p };
  const anon = render('partials/footer.ejs', { ...base, portalIn: false }); const inn = render('partials/footer.ejs', { ...base, portalIn: true });
  assert.match(anon, /class="footer-portal" href="\/en\/portal\/signin"/); assert.doesNotMatch(anon, /Portal Sign Out/);
  assert.match(inn, /Portal Sign Out/); assert.match(inn, /href="\/en\/portal\/signin\?logout=1&next=%2Fen%2Fenroll"/);
  assert.match(render('partials/footer.ejs', { ...base, lang: 'zh', portalIn: true }), /登出入口網站/);
});
test('partial: portal header shows the profile menu, drawer groups with the current page open, and escapes names', () => {
  const nav = { profileMenu: [{ en: 'Personal Info', zh: '個人資料', href: '/en/portal/profile' }], drawer: [{ link: { en: 'Dashboard', zh: '首頁', href: '/en/portal' } },
    { group: { title: { en: 'Finance', zh: '財務' }, items: [{ en: 'Transactions', zh: '交易', href: '/en/portal/manage/transactions' }, { en: 'Payment', zh: '付款', href: '/en/portal/finance/payment' }] } },
    { group: { title: { en: 'School', zh: '學校' }, items: [{ en: 'Rooms', zh: '教室', href: '/en/portal/manage/rooms' }, { en: 'Textbooks', zh: '課本', href: '/en/portal/manage/textbooks' }] } }] };
  const lang = 'en'; const b = (en, zh) => (lang === 'zh' ? zh : en);
  const html = render('portal-app/portal-header.ejs', { lang, b, one: b, nav, current: '/en/portal/finance/payment', url: (p = '') => `/en/portal${p}`, asset: (p) => p, csrfField: () => '<input type="hidden" name="_csrf" value="t">',
    altLangUrl: '/zh/portal/finance/payment', altLangLabel: '中文', U: { person: { english_first_name: 'A<b>', english_last_name: 'Li', chinese_name: '李' }, access: { roles: [{ name_en: 'Parent', name_zh: '家長' }] } } });
  assert.match(html, /data-portal-header/); assert.match(html, /A&lt;b&gt; Li 李/); assert.doesNotMatch(html, /A<b>/); assert.match(html, /aria-current="page"[^>]*>Payment/); assert.match(html, /<details class="portal-group ph-group" open>\s*<summary>Finance<\/summary>/);
  assert.match(html, /<details class="portal-group ph-group">\s*<summary>School<\/summary>/); assert.match(html, /action="\/en\/portal\/signout"/); assert.match(html, /href="\/zh\/portal\/finance\/payment"[^>]*>中文/); assert.match(html, />Dashboard</);
});
test('partial: event row, pagination-free lists and the portal footer render with fixtures', () => {
  const t = (k) => k;
  const row = render('partials/event-row.ejs', { lang: 'en', t, L: { evDate: new Date(2026, 9, 25), evTitle: 'Mid-term <Exam>', evHref: '/en/events/x', evLocation: 'LJCDS', evTime: 'All day' } });
  assert.match(row, /Mid-term &lt;Exam&gt;/); assert.match(row, /href="\/en\/events\/x"/); assert.match(row, /LJCDS/); assert.match(row, /25/);
  const foot = render('portal-app/portal-footer.ejs', { lang: 'en', b: (e) => e, url: (p) => `/en/portal${p}` });
  assert.match(foot, /Contact Us/); assert.match(foot, /Privacy Policy/); assert.match(foot, /School website/); assert.match(foot, new RegExp(String(new Date().getFullYear())));
});
