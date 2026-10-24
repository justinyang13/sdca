// src/portal/creators.js — helpers that create users, people, families (used by routes and the demo seed).
import { hashPassword } from '../admin/auth.js';
import { grantRole } from '../queries/users.js';

export function createUser(db, { personId, username, password, roleCodes = ['parent'], type = 'parent', lang = 'en', actorId = null }) {
  const ut = db.prepare('SELECT id FROM user_types WHERE code = ?').get(type)?.id || null;
  const r = db.prepare('INSERT INTO users (person_id, username, password_hash, user_type_id, status, preferred_language, created_by, updated_by) VALUES (?,?,?,?,?,?,?,?)')
    .run(personId, username, hashPassword(password), ut, 'active', lang, actorId, actorId);
  const uid = Number(r.lastInsertRowid);
  for (const code of roleCodes) {
    const rid = db.prepare('SELECT id FROM roles WHERE code = ?').get(code)?.id;
    if (rid) grantRole(db, uid, rid, actorId);
  }
  return uid;
}

export function createPerson(db, p, userId = null) {
  const r = db.prepare(`INSERT INTO persons (english_last_name, english_first_name, chinese_name, title, gender, birth_date, native_language, email, mobile, regular_school, regular_grade,
    allergy, special_medical_needs, speak_chinese_home, took_chinese_lessons, prior_chinese_school, prior_chinese_years, prior_chinese_hours_week, notes, is_faculty, created_by, updated_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    p.english_last_name, p.english_first_name, p.chinese_name || '', p.title || '', p.gender || 'M', p.birth_date || null, p.native_language || 'Mandarin', p.email || '', p.mobile || '',
    p.regular_school || '', p.regular_grade ?? null, p.allergy || '', p.special_medical_needs || '', p.speak_chinese_home || 'N', p.took_chinese_lessons || 'N',
    p.prior_chinese_school || '', p.prior_chinese_years ?? null, p.prior_chinese_hours_week ?? null, p.notes || '', p.is_faculty ? 1 : 0, userId, userId);
  return Number(r.lastInsertRowid);
}

export function createFamily(db, v, userId = null) {
  const a = db.prepare('INSERT INTO addresses (street, city, state, zipcode, created_by, updated_by) VALUES (?,?,?,?,?,?)').run(v.street, v.city, v.state || 'CA', v.zipcode, userId, userId);
  const f = db.prepare(`INSERT INTO families (address_id, home_phone, cell_phone, email, list_in_directory, emergency_contact, emergency_home_phone, emergency_cell_phone, created_by, updated_by)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(Number(a.lastInsertRowid), v.home_phone, v.cell_phone || '', v.email, v.list_in_directory === 'N' ? 'N' : 'Y', v.emergency_contact, v.emergency_home_phone, v.emergency_cell_phone, userId, userId);
  return Number(f.lastInsertRowid);
}

export function addFamilyMember(db, familyId, personId, relationship, userId = null, sort = 0) {
  db.prepare('INSERT OR IGNORE INTO family_members (family_id, person_id, relationship, is_primary_contact, sort, created_by, updated_by) VALUES (?,?,?,?,?,?,?)')
    .run(familyId, personId, relationship, relationship === 'parent_one' ? 1 : 0, sort, userId, userId);
  if (relationship === 'child') {
    for (const p of db.prepare("SELECT person_id FROM family_members WHERE family_id = ? AND relationship IN ('parent_one','parent_two','guardian') AND deleted_at IS NULL").all(familyId))
      db.prepare('INSERT OR IGNORE INTO parent_students (parent_person_id, student_person_id, created_by, updated_by) VALUES (?,?,?,?)').run(p.person_id, personId, userId, userId);
  } else {
    for (const c of db.prepare("SELECT person_id FROM family_members WHERE family_id = ? AND relationship = 'child' AND deleted_at IS NULL").all(familyId))
      db.prepare('INSERT OR IGNORE INTO parent_students (parent_person_id, student_person_id, created_by, updated_by) VALUES (?,?,?,?)').run(personId, c.person_id, userId, userId);
  }
}

