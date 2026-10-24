// src/queries/schoolYears.js — school years and the withdrawal-fee schedule.
export const allSchoolYears = (db) => db.prepare('SELECT * FROM school_years WHERE deleted_at IS NULL ORDER BY label DESC').all();

export const withdrawalRules = (db, yearId) => db.prepare('SELECT * FROM withdrawal_fee_rules WHERE school_year_id = ? AND deleted_at IS NULL ORDER BY sort, id').all(yearId);
