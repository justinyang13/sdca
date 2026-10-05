// Phase 3 — people table (board + staff + volunteers)
// Sources: research/wiki/pages/board-of-directors.md, staff.md,
//          school-facts.md, volunteer-opportunity.md, adult-recreational-programs
// people table has no natural unique key → delete-then-insert (idempotent).

const PEOPLE = [
  // ── Board of Directors (9) ─────────────────────────────────────────────────
  { name_en: 'ANA WANG',        name_zh: '王慧琪', role_en: 'President',              role_zh: '理事長',       group: 'board', bio_en: '', bio_zh: '', photo: 'img/board/ana-wang.jpg',  sort: 1 },
  { name_en: 'CHUN-YU CHUANG',  name_zh: '莊淳宇', role_en: 'Vice President',         role_zh: '副理事長',     group: 'board', bio_en: '', bio_zh: '', photo: '',                    sort: 2 },
  { name_en: 'GILLIAN LIN',     name_zh: '林子倫', role_en: 'Secretary',              role_zh: '執行祕書',     group: 'board', bio_en: '', bio_zh: '', photo: '',                    sort: 3 },
  { name_en: 'CHRISTINE GIBBS', name_zh: '賴靜頴', role_en: 'Treasurer',              role_zh: '財務理事',     group: 'board', bio_en: '', bio_zh: '', photo: 'img/board/christine-gibbs.jpg', sort: 4 },
  { name_en: 'LING CHAN',       name_zh: '陳菱',   role_en: 'Editorial Director',     role_zh: '編輯組理事',   group: 'board', bio_en: '', bio_zh: '', photo: 'img/board/ling-chan.jpg',   sort: 5 },
  { name_en: 'KATHY KANG',      name_zh: '康欣汝', role_en: 'PTA Director',           role_zh: '家長會理事',   group: 'board', bio_en: '', bio_zh: '', photo: 'img/board/kathy-kang.jpg',  sort: 6 },
  { name_en: 'HUNG WANG',       name_zh: '王元弘', role_en: 'Scrip Director',         role_zh: '禮券組理事',   group: 'board', bio_en: '', bio_zh: '', photo: 'img/board/hung-wang.jpg',   sort: 7 },
  { name_en: 'RAY SHAN',        name_zh: '單子睿', role_en: 'Activity Director',      role_zh: '活動組理事',   group: 'board', bio_en: '', bio_zh: '', photo: 'img/board/ray-shan.jpg',    sort: 8 },
  { name_en: 'JAMES YU',        name_zh: '游弘鈞', role_en: 'Operation Director',     role_zh: '業務組理事',   group: 'board', bio_en: '', bio_zh: '', photo: 'img/board/james-yu.jpg',    sort: 9 },
  // ── Principal ──────────────────────────────────────────────────────────────
  { name_en: 'Sun Li-Min',      name_zh: '孫麗敏', role_en: 'Principal',              role_zh: '校長',         group: 'staff', bio_en: 'Signed the 30th anniversary letter (2018).', bio_zh: '簽名於2018年三十週年校長的話。', photo: '', sort: 1 },
  // ── Named instructors / contacts ───────────────────────────────────────────
  { name_en: 'Celine Chen',     name_zh: '',       role_en: 'Yoga Instructor',        role_zh: '瑜伽教練',     group: 'staff', bio_en: 'Teaches the adult yoga class.', bio_zh: '教授成人瑜伽課。', photo: '', sort: 2 },
  { name_en: 'Jerry Han',       name_zh: '',       role_en: 'Baseball Team Contact',  role_zh: '棒球隊聯絡人', group: 'staff', bio_en: 'Contact for the SDCA Baseball Team (est. 2013).', bio_zh: '中華學苑棒球隊聯絡人（2013年成立）。', photo: '', sort: 3 },
  { name_en: 'Lai Chen',        name_zh: '',       role_en: 'Food/Allergy Contact',   role_zh: '食品過敏聯絡人', group: 'volunteer', bio_en: 'Food/allergy contact for Cultural Day.', bio_zh: '文化節食品/過敏聯絡人。', photo: '', sort: 1 },
];

export function seedPeople(db, log, skipped) {
  // Idempotent: clear all seeded rows, then re-insert (people has no unique key)
  db.prepare('DELETE FROM people').run();
  const ins = db.prepare(`
    INSERT INTO people (name_en, name_zh, role_en, role_zh, "group", bio_en, bio_zh, photo, sort)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const p of PEOPLE) {
    ins.run(p.name_en, p.name_zh, p.role_en, p.role_zh, p.group, p.bio_en, p.bio_zh, p.photo, p.sort);
  }
  const board = PEOPLE.filter(p => p.group === 'board').length;
  const staff = PEOPLE.filter(p => p.group === 'staff').length;
  const vol = PEOPLE.filter(p => p.group === 'volunteer').length;
  log.push(`people: ${PEOPLE.length} rows (${board} board + ${staff} staff + ${vol} volunteer)`);
  return PEOPLE.length;
}
