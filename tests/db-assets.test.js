// tests/db-assets.test.js — Phase 9 (R1 item 2).
// Every image/document path referenced by ANY DB row must exist on disk.
import { test } from 'node:test';
import { openDb } from '../src/db/open.js';
import { checkDbAssets } from '../scripts/check-db-assets.js';

test('DB asset existence: every referenced asset exists on disk', () => {
  const db = openDb();
  const missing = checkDbAssets(db);
  if (missing.length) {
    throw new Error(`${missing.length} referenced asset(s) missing on disk:\n  - ${missing.join('\n  - ')}`);
  }
});
