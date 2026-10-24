// src/portal/r-events.js — staff event calendar (month grid). Events live in the website's `events` table,
// so everything created here shows on the public events page, calendar and home page.
import { can } from './perm.js';
import { EVENT_CATEGORIES } from './entities.js';
import { portalHelpers } from './util.js';
import { pickLang } from '../i18n/index.js';

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function registerEventRoutes(app, { db, page, requireLogin }) {
  const { forbidden } = portalHelpers(page);
  const R = '/:lang/portal';

  app.get(`${R}/events-calendar`, requireLogin, (req, res) => {
    if (!can(req.portal.access, 'events.list')) return forbidden(req, res);
    const m = /^(\d{4})-(\d{2})$/.exec(String(req.query.month || ''));
    const now = new Date();
    const first = m ? new Date(Number(m[1]), Number(m[2]) - 1, 1) : new Date(now.getFullYear(), now.getMonth(), 1);
    const gridStart = new Date(first); gridStart.setDate(1 - first.getDay());                  // Sunday on/before the 1st
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    const gridEnd = new Date(last); gridEnd.setDate(last.getDate() + (6 - last.getDay()));      // Saturday on/after the last day
    const rows = db.prepare(`SELECT id, title_en, title_zh, starts_at, ends_at, all_day, category, location, published FROM events
      WHERE deleted_at IS NULL AND date(starts_at) <= ? AND date(COALESCE(ends_at, starts_at)) >= ? ORDER BY starts_at, id`).all(ymd(gridEnd), ymd(gridStart));
    const weeks = [];
    for (let d = new Date(gridStart); d <= gridEnd; ) {
      const week = [];
      for (let i = 0; i < 7; i++, d.setDate(d.getDate() + 1)) {
        const key = ymd(d);
        week.push({ key, day: d.getDate(), inMonth: d.getMonth() === first.getMonth(), today: key === ymd(now),
          events: rows.filter((e) => String(e.starts_at).slice(0, 10) <= key && String(e.ends_at || e.starts_at).slice(0, 10) >= key) });
      }
      weeks.push(week);
    }
    const mk = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    page(req, res, 'events-calendar.ejs', {
      weeks, monthLabel: first.toLocaleDateString(pickLang(req.params.lang, 'en-US', 'zh-TW'), { month: 'long', year: 'numeric' }),
      prev: mk(new Date(first.getFullYear(), first.getMonth() - 1, 1)), next: mk(new Date(first.getFullYear(), first.getMonth() + 1, 1)),
      thisMonth: mk(now), categories: EVENT_CATEGORIES, canCreate: can(req.portal.access, 'events.create'), canEdit: can(req.portal.access, 'events.update') || can(req.portal.access, 'events.view'),
    }, { title: 'Event Calendar' });
  });
}
