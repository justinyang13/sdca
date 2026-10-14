// src/portal/rereg.js — re-registration: pre-fill next year's registration from what the family did last year.
// Suggests, per child: the same class type (preschool → regular), the next grade, volunteer choices; copies the regular-school
// information to the new year. Nothing is submitted automatically — the parent reviews every field in the normal wizard.
import { gradeLabel, gradeFromBirth, startYear } from './grades.js';

/** Years families can register for right now (staff switch "registration open" on in the Fees page). */
export function openYears(db) {
  return db.prepare('SELECT * FROM school_years WHERE registration_open = 1 AND deleted_at IS NULL ORDER BY label').all();
}

/** The child's most recent enrollment in a year before `year` (withdrawn ones do not count as "continuing"). */
export function lastEnrollment(db, studentId, year) {
  return db.prepare(`SELECT e.*, y.label AS year_label, ct.code AS ct_code, ct.name_en AS ct_en, ct.name_zh AS ct_zh, sc.code AS class_code, sc.name_en AS class_en, sc.name_zh AS class_zh
    FROM enrollments e JOIN school_years y ON y.id = e.school_year_id LEFT JOIN class_types ct ON ct.id = e.class_type_id LEFT JOIN school_classes sc ON sc.id = e.school_class_id
    WHERE e.student_person_id = ? AND y.label < ? AND e.deleted_at IS NULL AND e.status IN ('registered','placed') ORDER BY y.label DESC LIMIT 1`).get(Number(studentId), year.label) || null;
}

/** Grade number from a stored label such as "三年級(3rd Grade)": 1–12, 0 = kindergarten, null = unknown / preschool. */
export function gradeNumber(label) {
  const m = String(label || '').match(/(\d+)(?:st|nd|rd|th) Grade/);
  if (m) return Number(m[1]);
  if (/Kinder/i.test(label || '')) return 0;
  return null;
}

/** What to pre-fill for one child: { hadPrevious, graduated, classTypeId, grade, label, prev } */
export function suggestFor(db, child, year) {
  const prev = lastEnrollment(db, child.id, year);
  if (!prev) return { hadPrevious: false };
  const prevGrade = gradeNumber(prev.grade_label);
  const grade = prevGrade !== null ? prevGrade + 1 : gradeFromBirth(child.birth_date, startYear(year.label));
  const graduated = grade !== null && grade > 12;
  let classTypeId = prev.class_type_id;
  if (prev.ct_code === 'preschool') classTypeId = db.prepare("SELECT id FROM class_types WHERE code = 'regular' AND deleted_at IS NULL").get()?.id || classTypeId;
  return { hadPrevious: true, graduated, classTypeId, grade, label: grade === null || graduated ? '' : gradeLabel(grade), prev };
}

/** Volunteer choices (job ids by priority) the family made in its latest earlier year. */
export function previousVolunteerJobs(db, familyId, year) {
  const rows = db.prepare(`SELECT s.job_id, s.priority, y.label FROM volunteer_signups s JOIN school_years y ON y.id = s.school_year_id
    WHERE s.family_id = ? AND y.label < ? AND s.deleted_at IS NULL AND s.job_id IS NOT NULL ORDER BY y.label DESC, s.priority`).all(familyId, year.label);
  if (!rows.length) return [];
  const active = new Set(db.prepare('SELECT id FROM volunteer_jobs WHERE active = 1 AND deleted_at IS NULL').all().map((j) => j.id));
  return rows.filter((r) => r.label === rows[0].label && active.has(r.job_id)).slice(0, 3).map((r) => r.job_id);
}

/** Copy last year's regular-school information to the new year (grade +1) when the child has none yet. Returns how many were copied. */
export function copySchoolInfo(db, studentIds, year, userId = null) {
  let n = 0;
  for (const id of studentIds) {
    if (db.prepare('SELECT 1 FROM student_school_info WHERE student_person_id = ? AND school_year_id = ? AND deleted_at IS NULL').get(id, year.id)) continue;
    const old = db.prepare(`SELECT i.* FROM student_school_info i JOIN school_years y ON y.id = i.school_year_id
      WHERE i.student_person_id = ? AND y.label < ? AND i.deleted_at IS NULL ORDER BY y.label DESC LIMIT 1`).get(id, year.label);
    if (!old) continue;
    db.prepare(`INSERT INTO student_school_info (student_person_id, school_year_id, school_name, grade, mailing_address, city, state, zipcode, counselor_name, counselor_phone, counselor_extension,
      school_district_id, other_school_district, notes, created_by, updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, year.id, old.school_name, Math.min(12, (old.grade ?? 0) + 1), old.mailing_address, old.city, old.state, old.zipcode, old.counselor_name, old.counselor_phone, old.counselor_extension,
        old.school_district_id, old.other_school_district, old.notes, userId, userId);
    n += 1;
  }
  return n;
}

/** Registration choices for the family home: one entry per open year. */
export function registrationOptions(db, familyId) {
  return openYears(db).map((year) => {
    const earlier = db.prepare(`SELECT 1 FROM enrollments e JOIN school_years y ON y.id = e.school_year_id JOIN family_members fm ON fm.person_id = e.student_person_id
      WHERE fm.family_id = ? AND fm.relationship = 'child' AND y.label < ? AND e.status IN ('registered','placed') AND e.deleted_at IS NULL LIMIT 1`).get(familyId, year.label);
    const reg = db.prepare("SELECT id, status FROM registrations WHERE family_id = ? AND school_year_id = ? AND status IN ('draft','submitted','paid') AND deleted_at IS NULL ORDER BY id DESC").get(familyId, year.id);
    // every child already has a submitted / paid registration this year → nothing left to offer for that year
    const todo = db.prepare(`SELECT COUNT(*) AS n FROM family_members fm WHERE fm.family_id = ? AND fm.relationship = 'child' AND fm.deleted_at IS NULL
      AND fm.person_id NOT IN (SELECT ri.student_person_id FROM registration_items ri JOIN registrations r ON r.id = ri.registration_id
        WHERE r.family_id = ? AND r.school_year_id = ? AND r.status IN ('submitted','paid') AND r.deleted_at IS NULL AND ri.deleted_at IS NULL)`).get(familyId, familyId, year.id).n;
    return { year, reregister: !!earlier, registration: reg || null, todo };
  }).filter((o) => o.todo > 0);
}
