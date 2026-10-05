// Phase 3 — media_items table
// Sources:
//   - research/wiki/pages/misc.md § 1 (YouTube playlist + 2 Drive albums)
//   - public/img/manifest.json (24 selected photos → photo media items)
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const MANIFEST = path.join(ROOT, 'public', 'img', 'manifest.json');

export function seedMedia(db, log, skipped) {
  // media_items has no unique key → delete-then-insert (idempotent)
  db.prepare('DELETE FROM media_items').run();
  const ins = db.prepare(`
    INSERT INTO media_items (kind, title_en, title_zh, url, image, taken_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  let count = 0;

  // 1. YouTube playlist (video)
  ins.run('video',
    'SDCA Cultural Activity Playlist',
    'SDCA 文化活動影片播放清單',
    'https://www.youtube.com/playlist?list=PL-etO5dM7pdvvPot-VAjFbX9Memc-K4fx',
    '', null);
  count++;

  // 2. Drive albums (album)
  ins.run('album',
    'Current School Year Photos',
    '本學年照片',
    'https://drive.google.com/drive/folders/1DKK1JGqLH7gXjaOiE-Wz4FqwUWovYT3b?usp=sharing',
    '', null);
  count++;

  ins.run('album',
    'Past Photos',
    '往年照片',
    'https://drive.google.com/drive/folders/0B_rx3YzKUte_enVmU2pPUGNRQkE?usp=sharing',
    '', null);
  count++;

  // 3. Gallery photos from manifest
  try {
    const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
    for (const img of manifest.images) {
      const heroFile = img.files[img.files.length - 1]?.file || '';
      ins.run('photo',
        img.alt_en || img.name,
        img.alt_zh || '',
        '',  // no external URL — served from local public/img
        heroFile,
        null);
      count++;
    }
    log.push(`media gallery photos: ${manifest.images.length} rows (from manifest)`);
  } catch (e) {
    skipped.push(`media manifest not found: ${e.message}`);
  }

  log.push(`media_items: ${count} rows total`);
  return count;
}
