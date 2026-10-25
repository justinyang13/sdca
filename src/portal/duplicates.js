// src/portal/duplicates.js — data-quality check: people and families that look like the same real person / household.
// Pure SQL + string rules (no model): the same e-mail or phone, the same name and birth date, or a name one typo apart.

const digits = (v) => String(v ?? '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
const norm = (v) => String(v ?? '').toLowerCase().replace(/[^a-z0-9㐀-鿿]/g, '');

/** Levenshtein distance, stopping early once it exceeds `max`. */
export function editDistance(a, b, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** Union-find clusters from lists of "these ids belong together (reason)". */
function cluster(groups) {
  const parent = new Map(); const reasonsOf = new Map();   // reasons are kept per id and merged per cluster at the end (roots change while merging)
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  for (const { ids, reason } of groups) {
    ids.forEach((i) => { if (!parent.has(i)) parent.set(i, i); });
    for (let k = 1; k < ids.length; k++) parent.set(find(ids[k]), find(ids[0]));
    ids.forEach((i) => (reasonsOf.get(i) || reasonsOf.set(i, new Set()).get(i)).add(reason));
  }
  const byRoot = new Map();
  for (const i of parent.keys()) { const r = find(i); (byRoot.get(r) || byRoot.set(r, []).get(r)).push(i); }
  return [...byRoot.entries()].filter(([, ids]) => ids.length > 1).map(([, ids]) => ({ ids: ids.sort((a, b) => a - b), reasons: [...new Set(ids.flatMap((i) => [...(reasonsOf.get(i) || [])]))] }));
}

const bucket = (rows, keyFn, reason) => {
  const m = new Map();
  for (const r of rows) { const k = keyFn(r); if (k) (m.get(k) || m.set(k, []).get(k)).push(r.id); }
  return [...m.values()].filter((ids) => ids.length > 1).map((ids) => ({ ids, reason }));
};

export function duplicatePersons(db) {
  const rows = db.prepare('SELECT id, english_last_name AS last, english_first_name AS first, chinese_name AS zh, birth_date AS dob, email, mobile FROM persons WHERE deleted_at IS NULL').all();
  const byId = new Map(rows.map((r) => [r.id, r]));
  const groups = [
    ...bucket(rows, (r) => (norm(r.first + r.last) && r.dob ? `${norm(r.first + r.last)}|${r.dob}` : ''), 'same name and birth date'),
    ...bucket(rows, (r) => (r.zh && r.dob ? `${norm(r.zh)}|${r.dob}` : ''), 'same Chinese name and birth date'),
    ...bucket(rows, (r) => (r.email ? r.email.trim().toLowerCase() : ''), 'same e-mail'),
    ...bucket(rows, (r) => (digits(r.mobile).length >= 10 ? digits(r.mobile) : ''), 'same mobile'),
  ];
  // names one typo apart with the same birth date
  const byDob = new Map();
  for (const r of rows) if (r.dob) (byDob.get(r.dob) || byDob.set(r.dob, []).get(r.dob)).push(r);
  for (const list of byDob.values()) {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = norm(list[i].first + list[i].last), b = norm(list[j].first + list[j].last);
      if (a && b && a !== b && a.length > 4 && editDistance(a, b, 1) <= 1) groups.push({ ids: [list[i].id, list[j].id], reason: 'similar name, same birth date' });
    }
  }
  return cluster(groups).map((c) => ({ ...c, items: c.ids.map((id) => byId.get(id)) }));
}

export function duplicateFamilies(db) {
  const rows = db.prepare(`SELECT f.id, f.email, f.home_phone, f.cell_phone,
    (SELECT p.english_last_name || ' ' || p.english_first_name || ' ' || p.chinese_name FROM family_members fm JOIN persons p ON p.id = fm.person_id WHERE fm.family_id = f.id AND fm.relationship = 'parent_one' AND fm.deleted_at IS NULL LIMIT 1) AS name
    FROM families f WHERE f.deleted_at IS NULL`).all();
  const byId = new Map(rows.map((r) => [r.id, r]));
  const groups = [
    ...bucket(rows, (r) => (r.email ? r.email.trim().toLowerCase() : ''), 'same e-mail'),
    ...bucket(rows, (r) => (digits(r.home_phone).length >= 10 ? digits(r.home_phone) : ''), 'same home phone'),
    ...bucket(rows, (r) => (digits(r.cell_phone).length >= 10 ? digits(r.cell_phone) : ''), 'same cell phone'),
  ];
  return cluster(groups).map((c) => ({ ...c, items: c.ids.map((id) => byId.get(id)) }));
}

/** Other data problems worth a look: students with no family, families with no parent. */
export function orphanChecks(db) {
  return {
    childrenWithoutFamily: db.prepare(`SELECT p.id, p.english_last_name AS last, p.english_first_name AS first, p.chinese_name AS zh FROM persons p JOIN enrollments e ON e.student_person_id = p.id AND e.deleted_at IS NULL
      WHERE p.deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM family_members fm WHERE fm.person_id = p.id AND fm.deleted_at IS NULL) GROUP BY p.id`).all(),
    familiesWithoutParent: db.prepare(`SELECT f.id, f.email FROM families f WHERE f.deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM family_members fm WHERE fm.family_id = f.id AND fm.relationship IN ('parent_one','parent_two','guardian') AND fm.deleted_at IS NULL)`).all(),
  };
}
