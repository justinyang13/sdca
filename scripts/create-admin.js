// scripts/create-admin.js — first-run admin creation.
// Reads ADMIN_USER / ADMIN_PASSWORD env, or prompts via readline.
// Idempotent: refuses to overwrite an existing username.
import crypto from 'node:crypto';
import readline from 'node:readline/promises';
import { openDb } from '../src/db/open.js';
import { migrate } from '../src/db/migrate.js';
import { hashPassword } from '../src/admin/auth.js';

function read(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return rl.question(prompt).then(v => { rl.close(); return v; });
}

async function main() {
  let user = process.env.ADMIN_USER;
  let pass = process.env.ADMIN_PASSWORD;
  if (!user) user = await read('Username: ');
  if (!pass) {
    pass = await read('Password: ');
    const pass2 = await read('Confirm: ');
    if (pass !== pass2) { console.error('Passwords do not match'); process.exit(1); }
  }
  if (!user || !pass) { console.error('Username and password are required'); process.exit(1); }
  const db = openDb();
  migrate(db);
  const existing = db.prepare('SELECT id FROM admin_users WHERE username = ?').get(user);
  if (existing) { console.error(`Username "${user}" already exists`); process.exit(1); }
  db.prepare('INSERT INTO admin_users (username, password_hash, role) VALUES (?, ?, ?)')
    .run(user, hashPassword(pass), 'admin');
  const audit = db.prepare('INSERT INTO audit_log (user, action, entity, entity_id) VALUES (?, ?, ?, ?)');
  audit.run(user, 'create_admin', 'admin_users', String(user));
  console.log(`Created admin user "${user}" (role: admin).`);
  db.close();
}

main().catch(err => { console.error(err); process.exit(1); });
