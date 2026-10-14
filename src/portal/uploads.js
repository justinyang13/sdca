// src/portal/uploads.js — image uploads for management forms (fields of type "image"): saved under public/img/slides/ and
// the field is set to the public path. Only signed-in users who may create / update the entity get this far (route order).
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { config } from '../config.js';
import { nowUtc } from '../datetime.js';

export const slideDir = path.join(config.publicDir, 'img', 'slides');
export const docDir = path.join(config.storageDir, 'documents');
fs.mkdirSync(slideDir, { recursive: true });
fs.mkdirSync(docDir, { recursive: true });

const OK_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const safe = (name) => path.basename(String(name || 'image')).replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '').slice(-80) || 'image';
/** true when the first bytes are a JPEG, PNG, GIF or WebP header */
export function looksLikeImage(buf) {
  if (!buf || buf.length < 12) return false;
  return (buf[0] === 0xff && buf[1] === 0xd8) || buf.slice(1, 4).toString() === 'PNG' || buf.slice(0, 3).toString() === 'GIF' || (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP');
}

const upload = multer({
  storage: multer.diskStorage({ destination: (req, file, cb) => cb(null, file.fieldname === 'file_pdf' ? docDir : slideDir), filename: (req, file, cb) => cb(null, `${Date.now()}-${safe(file.originalname)}`) }),
  limits: { fileSize: 25 * 1024 * 1024, files: 4 },
  fileFilter: (req, file, cb) => cb(null, file.fieldname === 'file_pdf' ? path.extname(file.originalname).toLowerCase() === '.pdf' : OK_EXT.has(path.extname(file.originalname).toLowerCase())),
}).any();

/** Express middleware factory: parses multipart forms.
 *  • each uploaded image `file_<field>` becomes req.body[<field>] = '/img/slides/…'
 *  • an uploaded PDF `file_pdf` is stored in storage/documents, registered in `documents`, and req.body.document_id points at it */
export function makeUploads(db) {
  return function uploads(req, res, next) {
    if (!/multipart\/form-data/i.test(req.headers['content-type'] || '')) return next();
    upload(req, res, (err) => {
      if (err) { req.uploadError = err.message; return next(); }
      for (const f of req.files || []) {
        const full = path.join(f.fieldname === 'file_pdf' ? docDir : slideDir, f.filename);
        let head = Buffer.alloc(16);
        try { const fd = fs.openSync(full, 'r'); fs.readSync(fd, head, 0, 16, 0); fs.closeSync(fd); } catch { head = Buffer.alloc(0); }
        if (f.fieldname === 'file_pdf') {
          if (head.slice(0, 4).toString() !== '%PDF') { fs.rmSync(full, { force: true }); req.uploadError = 'That file is not a PDF.'; continue; }
          const title = String(req.body.title_en || req.body.title_zh || path.basename(f.originalname, '.pdf')).trim();
          const slug = `doc-${Date.now().toString(36)}-${safe(path.basename(f.originalname, '.pdf')).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`;
          const r = db.prepare('INSERT INTO documents (slug, title_en, title_zh, category, file_path, mime, bytes, school_year, published, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,1,?,?)')
            .run(slug, title, String(req.body.title_zh || '').trim(), req.body.kind === 'weekly' ? 'weekly' : '', `storage/documents/${f.filename}`, 'application/pdf', f.size, String(req.body.school_year || ''), nowUtc(), nowUtc());
          req.body.document_id = String(r.lastInsertRowid);
          continue;
        }
        if (!looksLikeImage(head)) { fs.rmSync(full, { force: true }); req.uploadError = 'That file is not a JPG, PNG, GIF or WebP image.'; continue; }
        req.body[f.fieldname.replace(/^file_/, '')] = `/img/slides/${f.filename}`;
      }
      next();
    });
  };
}
