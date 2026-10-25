// src/portal/volunteer-match.js — suggest a volunteer job for each family that has signed up but is not assigned yet.
// Rules (no model): a job the family did in an earlier year wins; otherwise their first choice, unless it is already above the
// average load and a later choice is lighter; preschool-only jobs go to preschool families; "TBD" families get the job with the
// fewest families. Staff confirm every suggestion before it is saved.

/** @returns {{suggestions:[{familyId, family, signupId, jobId, job, why}], load:[{jobId, job, assigned}]}} */
export function suggestVolunteerAssignments(db, yearId) {
  const jobs = db.prepare('SELECT * FROM volunteer_jobs WHERE active = 1 AND deleted_at IS NULL ORDER BY sort, id').all();
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const isTbd = (j) => /^tbd\b/i.test(j?.name_en ?? '');
  const load = new Map(jobs.map((j) => [j.id, 0]));
  const rows = db.prepare('SELECT id, family_id, job_id, priority, status, assigned_job_id FROM volunteer_signups WHERE school_year_id = ? AND deleted_at IS NULL ORDER BY family_id, priority').all(yearId);
  const byFamily = new Map();
  for (const r of rows) (byFamily.get(r.family_id) || byFamily.set(r.family_id, []).get(r.family_id)).push(r);
  for (const list of byFamily.values()) for (const r of list) if (r.status === 'assigned' && load.has(r.assigned_job_id)) load.set(r.assigned_job_id, load.get(r.assigned_job_id) + 1);

  const before = db.prepare(`SELECT DISTINCT COALESCE(assigned_job_id, job_id) AS job_id FROM volunteer_signups WHERE family_id = ? AND school_year_id <> ? AND status IN ('assigned','completed') AND deleted_at IS NULL`);
  const preschool = db.prepare("SELECT 1 FROM enrollments e JOIN class_types ct ON ct.id = e.class_type_id WHERE e.school_year_id = ? AND ct.code = 'preschool' AND e.deleted_at IS NULL AND e.student_person_id IN (SELECT person_id FROM family_members WHERE family_id = ? AND deleted_at IS NULL)");
  const famName = db.prepare(`SELECT p.english_last_name || ' ' || p.english_first_name || ' ' || p.chinese_name AS n FROM family_members fm JOIN persons p ON p.id = fm.person_id WHERE fm.family_id = ? AND fm.relationship = 'parent_one' AND fm.deleted_at IS NULL LIMIT 1`);

  const suggestions = [];
  for (const [familyId, list] of byFamily) {
    if (list.some((r) => r.status === 'assigned' || r.status === 'completed' || r.status === 'declined')) continue;
    const wanted = list.filter((r) => r.status === 'requested' && jobById.has(r.job_id));
    if (!wanted.length) continue;
    const pre = !!preschool.get(yearId, familyId);
    const done = new Set(before.all(familyId, yearId).map((r) => r.job_id));
    const allowed = (j) => !j.reserved_for_preschool || pre;
    const avg = [...load.values()].reduce((s, n) => s + n, 0) / Math.max(1, jobs.filter((j) => !isTbd(j)).length);
    let pick = null; let why = '';
    const concrete = wanted.filter((r) => !isTbd(jobById.get(r.job_id)) && allowed(jobById.get(r.job_id)));
    const repeat = concrete.find((r) => done.has(r.job_id));
    if (repeat) { pick = repeat; why = `did this job before (choice ${repeat.priority})`; }
    else if (concrete.length) {
      const first = concrete[0];
      const lighter = concrete.slice(1).find((r) => load.get(r.job_id) < load.get(first.job_id) - 1 && load.get(first.job_id) > avg);
      pick = lighter || first;
      why = lighter ? `choice ${pick.priority}; choice ${first.priority} already has ${load.get(first.job_id)} families` : `choice ${first.priority}`;
    }
    let jobId = pick?.job_id; let signup = pick;
    if (!pick) {          // only TBD (or reserved) jobs chosen: least-staffed allowed job
      const open = jobs.filter((j) => !isTbd(j) && allowed(j)).sort((a, b) => load.get(a.id) - load.get(b.id) || a.sort - b.sort)[0];
      if (!open) continue;
      jobId = open.id; signup = wanted[0]; why = 'chose TBD; this job has the fewest families';
    }
    load.set(jobId, load.get(jobId) + 1);
    suggestions.push({ familyId, family: famName.get(familyId)?.n ?? `#${familyId}`, signupId: signup.id, jobId, job: jobById.get(jobId), why });
  }
  return { suggestions, load: jobs.map((j) => ({ jobId: j.id, job: j, assigned: load.get(j.id) })) };
}

/** Record an assignment (staff confirmed). Returns false when the signup does not belong to the family/year or is no longer open. */
export function assignSignup(db, { signupId, jobId, by }) {
  const r = db.prepare("UPDATE volunteer_signups SET status = 'assigned', assigned_job_id = ?, updated_at = datetime('now'), updated_by = ? WHERE id = ? AND status = 'requested' AND deleted_at IS NULL AND EXISTS (SELECT 1 FROM volunteer_jobs WHERE id = ? AND active = 1 AND deleted_at IS NULL)")
    .run(jobId, by, signupId, jobId);
  return r.changes > 0;
}
