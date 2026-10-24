// src/queries/classes.js — classes, their assignments and class announcements.
export const classById = (db, id) => db.prepare('SELECT * FROM school_classes WHERE id = ? AND deleted_at IS NULL').get(Number(id));

export const classIdsForYear = (db, yearId) => db.prepare('SELECT id FROM school_classes WHERE school_year_id = ? AND deleted_at IS NULL').all(yearId).map((r) => r.id);

export const classAssignmentById = (db, id) => db.prepare('SELECT * FROM class_assignments WHERE id = ? AND deleted_at IS NULL').get(Number(id));

export const classAnnouncementById = (db, id) => db.prepare('SELECT * FROM class_announcements WHERE id = ? AND deleted_at IS NULL').get(Number(id));
