-- 008_portal_lists.sql — read-only list views behind the Student List and Volunteer List pages.
-- (One row per student enrollment / per volunteer sign-up; soft-deleted rows carry deleted_at so the generic list code hides them.)

DROP VIEW IF EXISTS v_student_list;
CREATE VIEW v_student_list AS
SELECT e.id AS id, e.deleted_at AS deleted_at, e.student_person_id AS person_id, e.school_year_id, e.class_type_id, e.school_class_id,
       e.status, e.grade_label, e.placed_at,
       p.english_last_name, p.english_first_name, p.chinese_name, p.gender, p.birth_date, p.native_language, p.speak_chinese_home, p.allergy, p.special_medical_needs,
       (SELECT pp.english_first_name || ' ' || pp.english_last_name || ' ' || pp.chinese_name FROM family_members f2 JOIN persons pp ON pp.id = f2.person_id
         WHERE f2.family_id = fm.family_id AND f2.relationship = 'parent_one' AND f2.deleted_at IS NULL LIMIT 1) AS parent_one,
       (SELECT pp.english_first_name || ' ' || pp.english_last_name || ' ' || pp.chinese_name FROM family_members f2 JOIN persons pp ON pp.id = f2.person_id
         WHERE f2.family_id = fm.family_id AND f2.relationship = 'parent_two' AND f2.deleted_at IS NULL LIMIT 1) AS parent_two,
       f.email AS family_email, f.home_phone AS family_home_phone, f.cell_phone AS family_cell_phone
FROM enrollments e
JOIN persons p ON p.id = e.student_person_id
LEFT JOIN family_members fm ON fm.person_id = p.id AND fm.relationship = 'child' AND fm.deleted_at IS NULL
LEFT JOIN families f ON f.id = fm.family_id;

DROP VIEW IF EXISTS v_volunteer_list;
CREATE VIEW v_volunteer_list AS
SELECT s.id AS id, s.deleted_at AS deleted_at, s.school_year_id, s.job_id, s.assigned_job_id, s.priority, s.status, s.signed_up_at, s.hours_completed,
       s.person_id, s.family_id,
       p.english_last_name, p.english_first_name, p.chinese_name,
       f.email AS family_email, f.home_phone AS family_home_phone, f.cell_phone AS family_cell_phone
FROM volunteer_signups s
JOIN persons p ON p.id = s.person_id
JOIN families f ON f.id = s.family_id;

-- the old one-off CSV download permissions are replaced by the list pages' own export permission
DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE code IN ('reports.students_csv', 'reports.volunteers_csv'));
DELETE FROM permissions WHERE code IN ('reports.students_csv', 'reports.volunteers_csv');
