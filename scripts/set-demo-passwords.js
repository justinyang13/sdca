// scripts/set-demo-passwords.js — set every demo.* portal account to one password (default Demo@sdca!, or DEMO_PASSWORD / argv[2]),
// clear lockouts, and rewrite the logins file. Demo data only.
import fs from 'node:fs';
import path from 'node:path';
import { openDb } from '../src/db/open.js';
import { hashPassword } from '../src/admin/auth.js';
import { config } from '../src/config.js';

const password = process.argv[2] || process.env.DEMO_PASSWORD || 'Demo@sdca!';
const db = openDb();
const users = db.prepare("SELECT id, username FROM users WHERE username LIKE 'demo.%' AND deleted_at IS NULL").all();
const upd = db.prepare('UPDATE users SET password_hash = ?, failed_attempts = 0, locked_until = NULL WHERE id = ?');
for (const u of users) upd.run(hashPassword(password), u.id);
const file = path.join(config.dataDir, 'PORTAL-DEMO-LOGINS.txt');
fs.writeFileSync(file, `SDCA portal — DEMO LOGINS (every demo account uses the same password)\nPassword: ${password}\n\n${users.map((u) => u.username).join('\n')}\n`);
console.log(`${users.length} demo accounts now use the shared demo password; list in ${file}`);
