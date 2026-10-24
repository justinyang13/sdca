// src/queries/registrations.js
export const registrationById = (db, id) => db.prepare('SELECT * FROM registrations WHERE id = ? AND deleted_at IS NULL').get(Number(id));
