-- 020: per-account lockout for the admin site (5 wrong passwords -> locked 15 minutes), same rule as the portal
ALTER TABLE admin_users ADD COLUMN failed_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE admin_users ADD COLUMN locked_until TEXT;
