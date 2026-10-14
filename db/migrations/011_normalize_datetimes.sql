-- 011_normalize_datetimes.sql — one stored format per kind of value (see src/datetime.js):
--   moments → 'YYYY-MM-DD HH:MM:SS' UTC     calendar days → 'YYYY-MM-DD'
-- Old rows written by earlier code used ISO 'YYYY-MM-DDTHH:MM:SS.sssZ' or a time on a day field.
UPDATE admin_users SET last_login = substr(replace(last_login, 'T', ' '), 1, 19) WHERE last_login LIKE '____-__-__T%';
UPDATE settings    SET updated_at = substr(replace(updated_at, 'T', ' '), 1, 19) WHERE updated_at LIKE '____-__-__T%';
UPDATE slides      SET created_at = substr(replace(created_at, 'T', ' '), 1, 19) WHERE created_at LIKE '____-__-__T%';
UPDATE slides      SET updated_at = substr(replace(updated_at, 'T', ' '), 1, 19) WHERE updated_at LIKE '____-__-__T%';
UPDATE transactions SET transaction_date = substr(transaction_date, 1, 10) WHERE length(transaction_date) > 10;
UPDATE password_resets SET expires_at = substr(replace(expires_at, 'T', ' '), 1, 19) WHERE expires_at LIKE '____-__-__T%';
UPDATE invitations SET expires_at = substr(replace(expires_at, 'T', ' '), 1, 19) WHERE expires_at LIKE '____-__-__T%';
