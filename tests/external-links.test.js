// tests/external-links.test.js — Phase 9 (R1 item 4), EXTERNAL LINK RULE.
// Every external http(s) URL in the DB and in seed scripts must appear in
// the research corpus. No invented URLs.
import { test } from 'node:test';
import { openDb } from '../src/db/open.js';
import { externalLinkAudit } from '../scripts/external-link-audit.js';

test('external-link audit: no invented URLs', () => {
  const db = openDb();
  const r = externalLinkAudit(db);
  const invented = [...r.db.invented.map(x => x.url), ...r.seed.invented];
  if (invented.length) {
    throw new Error(`INVENTED external URLs (${invented.length}):\n  - ${invented.join('\n  - ')}`);
  }
});
