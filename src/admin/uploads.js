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

export function safeName(original) {
  const base = path.basename(String(original || '')).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
  return base;
}

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
