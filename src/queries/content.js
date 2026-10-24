// src/queries/content.js — public site content: events, hero slides, board and staff.
export const publishedEvent = (db, slug) => db.prepare('SELECT * FROM events WHERE slug = ? AND deleted_at IS NULL AND published = 1').get(slug);

export const heroSlides = (db) => db.prepare('SELECT * FROM slides WHERE published = 1 AND deleted_at IS NULL ORDER BY sort, id').all();

export const peopleInGroup = (db, group) => db.prepare('SELECT * FROM people WHERE "group" = ? ORDER BY sort, name_en').all(group);
