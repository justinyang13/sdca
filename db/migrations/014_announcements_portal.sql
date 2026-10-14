-- 014_announcements_portal.sql — the public News & Announcements become manageable in the portal (Staff Tools):
-- portal conventions (who created / changed it, soft delete). Public pages hide deleted rows.
ALTER TABLE announcements ADD COLUMN created_by INTEGER REFERENCES users(id);
ALTER TABLE announcements ADD COLUMN updated_by INTEGER REFERENCES users(id);
ALTER TABLE announcements ADD COLUMN deleted_at TEXT;
ALTER TABLE documents ADD COLUMN created_by INTEGER REFERENCES users(id);
ALTER TABLE documents ADD COLUMN updated_by INTEGER REFERENCES users(id);
ALTER TABLE documents ADD COLUMN deleted_at TEXT;
