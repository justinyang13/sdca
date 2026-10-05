// Phase 3 — sponsors table
// Source: research/wiki/pages/sponsors.md § 2 (/sponsors-2/ logo wall)
// 7 business sponsors identified by logo filename.
// sponsors table has no unique key → delete-then-insert (idempotent).

const SPONSORS = [
  { name: '99 Ranch Market',                  logo: 'img/sponsors/99-ranch.jpg',   url: '',                tier: 'business',   sort: 1 },
  { name: 'Mandarin House',                   logo: 'img/sponsors/mandarin-house.jpg', url: '',           tier: 'business',   sort: 2 },
  { name: 'Law Offices of Peter Darwin Chu',  logo: 'img/sponsors/peter-darwin-chu.png', url: '',         tier: 'business',   sort: 3 },
  { name: 'C2 Education',                     logo: 'img/sponsors/c2-education.png', url: '',             tier: 'business',   sort: 4 },
  { name: 'Dr. Liu',                          logo: 'img/sponsors/dr-liu.png',     url: '',               tier: 'individual', sort: 5 },
  { name: 'Golden Vision',                    logo: 'img/sponsors/golden-vision.png', url: '',            tier: 'business',   sort: 6 },
  { name: 'East West Bank',                   logo: 'img/sponsors/east-west-bank.png', url: '',           tier: 'business',   sort: 7 },
];

export function seedSponsors(db, log, skipped) {
  db.prepare('DELETE FROM sponsors').run();
  const ins = db.prepare(`
    INSERT INTO sponsors (name, logo, url, tier, sort)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const s of SPONSORS) {
    ins.run(s.name, s.logo, s.url, s.tier, s.sort);
  }
  log.push(`sponsors: ${SPONSORS.length} rows`);
  return SPONSORS.length;
}
