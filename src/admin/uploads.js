// src/admin/uploads.js — multer file upload with strict extension + content-type checks.
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { config } from '../config.js';

const ALLOWED_EXT = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.docx', '.xlsx']);
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);
const MAX_BYTES = 25 * 1024 * 1024;

function extOf(name) {
  const i = String(name || '').lastIndexOf('.');
  return i < 0 ? '' : String(name).slice(i).toLowerCase();
}

export const uploadDir = path.join(config.storageDir, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

export const uploader = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
      const ts = Date.now();
      const rand = Math.random().toString(36).slice(2, 8);
      cb(null, `${ts}-${rand}${extOf(file.originalname)}`);
    },
  }),
  limits: { fileSize: MAX_BYTES, files: 5 },
  fileFilter: (req, file, cb) => {
    const ext = extOf(file.originalname);
    if (!ALLOWED_EXT.has(ext)) return cb(new Error('File type not allowed'));
    if (file.mimetype && !ALLOWED_MIME.has(file.mimetype)) {
      // allow if content sniff says pdf for a .pdf, or a known image for image ext
      const mimeForExt = {
        '.pdf': 'application/pdf',
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
      if (mimeForExt[ext] && file.mimetype !== mimeForExt[ext]) {
        return cb(new Error('Content type mismatch'));
      }
    }
    return cb(null, true);
  },
});

const startsWith = (b, bytes) => bytes.every((x, i) => b[i] === x);
const MAGIC = {
  '.pdf': (b) => startsWith(b, [0x25, 0x50, 0x44, 0x46]),
  '.png': (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  '.jpg': (b) => startsWith(b, [0xff, 0xd8, 0xff]),
  '.jpeg': (b) => startsWith(b, [0xff, 0xd8, 0xff]),
  '.docx': (b) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]),
  '.xlsx': (b) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]),
};

/** After multer saved the file: its first bytes must match its extension, otherwise delete it (req.file is cleared, req.uploadRejected set). */
export function verifyUploadContent(req, res, next) {
  const f = req.file;
  if (!f) return next();
  let head = Buffer.alloc(0);
  try { const fd = fs.openSync(f.path, 'r'); head = Buffer.alloc(16); fs.readSync(fd, head, 0, 16, 0); fs.closeSync(fd); } catch { /* unreadable: reject below */ }
  const ok = MAGIC[extOf(f.originalname)];
  if (!ok || !ok(head)) { fs.rmSync(f.path, { force: true }); req.file = undefined; req.uploadRejected = true; }
  next();
}
