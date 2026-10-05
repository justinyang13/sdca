// src/db/run-migrate.js — CLI: `node src/db/run-migrate.js`
import { migrate } from './migrate.js';
import { closeDb } from './open.js';

const applied = migrate();
console.log(applied.length ? `applied: ${applied.join(', ')}` : 'database already up to date');
closeDb();
