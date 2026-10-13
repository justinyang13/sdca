-- 009_events_portal.sql — the website's events table becomes the single source of truth for the portal Events pages too
-- (portal convention: who created/changed a row, soft delete).
ALTER TABLE events ADD COLUMN created_by INTEGER REFERENCES users(id);
ALTER TABLE events ADD COLUMN updated_by INTEGER REFERENCES users(id);
ALTER TABLE events ADD COLUMN deleted_at TEXT;
