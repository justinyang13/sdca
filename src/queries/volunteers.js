// src/queries/volunteers.js — volunteer jobs and a family's ranked sign-ups.
export const activeJobs = (db) => db.prepare('SELECT * FROM volunteer_jobs WHERE active = 1 AND deleted_at IS NULL ORDER BY sort, id').all();

export const familySignups = (db, familyId, yearId) => db.prepare('SELECT * FROM volunteer_signups WHERE family_id = ? AND school_year_id = ? AND deleted_at IS NULL ORDER BY priority').all(familyId, yearId);

/** Sign a family up for jobs in rank order: jobIds[0] is priority 1 (empty entries are skipped but keep their rank). */
export function addSignups(db, { familyId, personId, yearId, jobIds, by }) {
  const ins = db.prepare('INSERT INTO volunteer_signups (family_id, person_id, school_year_id, job_id, priority, created_by, updated_by) VALUES (?,?,?,?,?,?,?)');
  jobIds.forEach((jobId, i) => { if (jobId) ins.run(familyId, personId, yearId, jobId, i + 1, by, by); });
}

export const waiverDocuments = (db) => db.prepare('SELECT * FROM waiver_documents WHERE deleted_at IS NULL ORDER BY sort, id').all();
