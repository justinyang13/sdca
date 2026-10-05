// Phase 3 seed helpers — PDF copy + metadata, deterministic (skip copy if dest exists)
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

export const PDF_DIR = path.join(root, 'research', 'assets', 'pdf');
export const PORTAL_DIR = path.join(PDF_DIR, 'registration-portal');
export const STORAGE_DIR = path.join(root, 'storage', 'documents');

export function copyPdf(srcRelPath, destSlug) {
  const src = path.join(PDF_DIR, srcRelPath);
  if (!existsSync(src)) throw new Error(`source PDF missing: ${src}`);
  mkdirSync(STORAGE_DIR, { recursive: true });
  const dest = path.join(STORAGE_DIR, destSlug);
  if (!existsSync(dest)) copyFileSync(src, dest);
  // file_path stored relative to repo root so the server (root/publicDir aware) can serve it
  return { file_path: `storage/documents/${destSlug}`, ...fileMeta(src) };
}

export function fileMeta(p) {
  const st = statSync(p);
  const head = readFileSync(p, { flag: 'r', start: 0, end: 32 }).toString('latin1');
  const mime = head.startsWith('%PDF') ? 'application/pdf' : 'application/octet-stream';
  return { bytes: st.size, mime };
}
