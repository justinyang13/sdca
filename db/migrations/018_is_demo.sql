-- 018: mark placeholder (demo/test) rows, and expose only real rows through v_public_* views.
-- Demo and live data live in separate DB files (data/demo.db vs data/sdca.db); is_demo is defence in depth:
-- a live DB containing any is_demo = 1 row refuses to start (src/db/guard.js).
ALTER TABLE persons        ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users          ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0;
ALTER TABLE families       ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0;
ALTER TABLE school_classes ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0;
ALTER TABLE rooms          ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0;
ALTER TABLE board_members  ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0;
ALTER TABLE fee_schedules  ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0;
ALTER TABLE textbooks      ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0;

INSERT OR IGNORE INTO settings (key, value_en) VALUES ('dataset', 'live');

CREATE VIEW v_public_board AS
SELECT bp.code AS position_code, bp.name_en AS position_en, bp.name_zh AS position_zh, bp.sort,
       p.english_first_name, p.english_last_name, p.chinese_name
FROM board_members bm
JOIN board_positions bp ON bp.id = bm.board_position_id
JOIN persons p ON p.id = bm.person_id
JOIN school_years sy ON sy.id = bm.school_year_id
WHERE bm.deleted_at IS NULL AND bm.is_demo = 0 AND p.is_demo = 0 AND sy.is_current = 1
  AND (bm.end_date IS NULL OR bm.end_date >= date('now'));

CREATE VIEW v_public_classes AS
SELECT sc.code, sc.name_en, sc.name_zh, ct.name_en AS type_en, ct.name_zh AS type_zh, r.code AS room, r.building
FROM school_classes sc
JOIN class_types ct ON ct.id = sc.class_type_id
JOIN school_years sy ON sy.id = sc.school_year_id
LEFT JOIN rooms r ON r.id = sc.room_id AND r.is_demo = 0
WHERE sc.deleted_at IS NULL AND sc.is_demo = 0 AND sy.is_current = 1;

CREATE VIEW v_public_fees AS
SELECT f.name_en, f.name_zh, f.amount_cents, f.percent, f.applies_to, f.deadline, sy.label AS school_year, f.sort
FROM fee_schedules f
JOIN school_years sy ON sy.id = f.school_year_id
WHERE f.deleted_at IS NULL AND f.active = 1 AND f.is_demo = 0 AND sy.is_current = 1;

CREATE VIEW v_public_class_times AS
SELECT name_en, name_zh, meets_start, meets_end, weeks, min_age, is_credit, sort
FROM class_types WHERE deleted_at IS NULL;

CREATE VIEW v_public_school_year AS
SELECT label, first_day, last_day, second_semester_start, early_reg_deadline
FROM school_years WHERE is_current = 1;
