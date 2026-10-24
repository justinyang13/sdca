// src/queries/families.js — families, their parents and school-info records.
export const familyWithAddress = (db, id) => db.prepare('SELECT f.*, a.street, a.city, a.state, a.zipcode FROM families f LEFT JOIN addresses a ON a.id = f.address_id WHERE f.id = ?').get(id);

/** "Last First 中文" of the family's first parent, or "Family #id". */
export const familyName = (db, familyId) => db.prepare(
  "SELECT p.english_last_name || ' ' || p.english_first_name || ' ' || p.chinese_name AS n FROM family_members fm JOIN persons p ON p.id = fm.person_id WHERE fm.family_id = ? AND fm.relationship = 'parent_one' AND fm.deleted_at IS NULL"
).get(familyId)?.n || `Family #${familyId}`;

/** The email on the family a person belongs to (undefined when none). */
export const familyEmailOfPerson = (db, personId) => db.prepare('SELECT f.email FROM families f JOIN family_members fm ON fm.family_id = f.id WHERE fm.person_id = ? AND fm.deleted_at IS NULL LIMIT 1').get(personId)?.email;

export const hasSchoolInfo = (db, studentPersonId, yearId) => !!db.prepare('SELECT 1 FROM student_school_info WHERE student_person_id = ? AND school_year_id = ? AND deleted_at IS NULL').get(studentPersonId, yearId);
