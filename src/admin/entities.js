// src/admin/entities.js — what the admin site edits, declared once. src/admin/crud.js turns each entry into list / new / edit / save / delete routes.
//   key.by:   'slug' or a name column → saving updates the row with that value, or creates it;  'id' → the form carries the row id
//   fields:   column → a coercion from F (the posted text becomes the stored value)
//   softDelete: the table has deleted_at, so delete hides the row (it can be restored) instead of removing it
import { sanitizeRich } from '../sanitize.js';

const strip = (s) => String(s ?? '').replace(/<[^>]+>/g, '').trim();

/** Coercions from posted form text to stored values. */
export const F = {
  text: strip,
  html: (s) => (s ? sanitizeRich(s) : ''),
  bool: (v) => (v ? 1 : 0),
  int: (v) => parseInt(v, 10) || 0,
  num: (v) => (v ? Number(v) : 0),
  numOrNull: (v) => (v ? Number(v) : null),
  textOrNull: (v) => strip(v) || null,
  oneOf: (list, dflt) => (v) => (list.includes(v) ? v : dflt),
};
const { text, html, bool, int, num, numOrNull, textOrNull, oneOf } = F;

export const ENTITIES = [
  {
    table: 'announcements', base: '/admin/announcements', listView: 'announcements-list.ejs', editView: 'announcement-edit.ejs', orderBy: 'published_at DESC',
    key: { by: 'slug', fallback: () => `ann-${Date.now()}` }, softDelete: true,
    extra: (db) => ({ docs: db.prepare('SELECT * FROM documents ORDER BY title_en').all() }),
    fields: {
      title_en: text, title_zh: text, summary_en: text, summary_zh: text, body_en: html, body_zh: html,
      kind: oneOf(['weekly', 'news', 'press', 'notice'], 'weekly'), week_no: numOrNull, school_year: text, published_at: textOrNull,
      pinned: bool, document_id: numOrNull, external_url: text, published: bool,
    },
  },
  {
    table: 'events', base: '/admin/events', listView: 'events-list.ejs', editView: 'event-edit.ejs', orderBy: 'starts_at DESC',
    key: { by: 'slug', fallback: () => `event-${Date.now()}` }, softDelete: true,
    fields: {
      title_en: text, title_zh: text, description_en: html, description_zh: html, starts_at: text, ends_at: textOrNull, all_day: bool,
      location: text, category: text, image: text, published: bool,
    },
  },
  {
    table: 'slides', base: '/admin/slides', listView: 'slides-list.ejs', editView: 'slide-edit.ejs', orderBy: 'sort, id',
    key: { by: 'id' }, softDelete: true,
    fields: { image: text, caption_en: text, caption_zh: text, link_url: text, sort: int, published: bool },
  },
  {
    table: 'archive_photos', base: '/admin/archive-photos', listView: 'archive-photos-list.ejs', editView: 'archive-photo-edit.ejs', orderBy: 'taken_year DESC, sort, id',
    key: { by: 'id' }, create: false,   // photos are added by the archive build script; the admin only edits them
    fields: { group_en: text, group_zh: text, caption_en: text, caption_zh: text, taken_year: int, sort: int, published: bool },
  },
  {
    table: 'pages', base: '/admin/pages', listView: 'pages-list.ejs', editView: 'page-edit.ejs', orderBy: 'nav_order, slug',
    key: { by: 'slug', fallback: () => `page-${Date.now()}` },
    onUpdate: { body_source: 'admin' },   // an admin edit takes over from the imported text
    fields: { title_en: text, title_zh: text, body_en: html, body_zh: html, hero_image: text, nav_section: text, nav_order: num, published: bool },
  },
  {
    table: 'programs', base: '/admin/programs', listView: 'programs-list.ejs', editView: 'program-edit.ejs', orderBy: 'sort, name_en',
    key: { by: 'slug', fallback: () => `prog-${Date.now()}` },
    fields: {
      name_en: text, name_zh: text, grades_en: text, grades_zh: text, description_en: html, description_zh: html,
      schedule_en: html, schedule_zh: html, tuition_en: text, tuition_zh: text, sort: num, image: text,
    },
  },
  {
    table: 'people', base: '/admin/people', listView: 'people-list.ejs', editView: 'person-edit.ejs', orderBy: 'sort, name_en',
    key: { by: 'name_en', fallback: () => `Person-${Date.now()}` },
    fields: {
      name_en: text, name_zh: text, role_en: text, role_zh: text, group: oneOf(['board', 'staff', 'teacher', 'volunteer'], 'staff'),
      bio_en: html, bio_zh: html, photo: text, sort: num,
    },
  },
  {
    table: 'sponsors', base: '/admin/sponsors', listView: 'sponsors-list.ejs', editView: 'sponsor-edit.ejs', orderBy: 'sort, name',
    key: { by: 'name', fallback: () => `Sponsor-${Date.now()}` },
    fields: { name: text, logo: text, url: text, tier: text, sort: num },
  },
  {
    table: 'media_items', base: '/admin/media', listView: 'media-list.ejs', editView: 'media-edit.ejs', orderBy: 'taken_at DESC, id DESC',
    key: { by: 'title_en', fallback: () => `Media-${Date.now()}` },
    fields: { kind: oneOf(['photo', 'video', 'album'], 'photo'), title_en: text, title_zh: text, url: text, image: text, taken_at: textOrNull },
  },
];
