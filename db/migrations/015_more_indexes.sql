-- 015_more_indexes.sql — the last foreign keys without a leading index.
CREATE INDEX IF NOT EXISTS idx_vol_signups_job        ON volunteer_signups(job_id);
CREATE INDEX IF NOT EXISTS idx_class_assign_role      ON class_assignments(assignment_role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_year        ON user_roles(school_year_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_class       ON user_roles(school_class_id);
