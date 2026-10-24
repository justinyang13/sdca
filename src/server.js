// src/server.js — start the HTTP server
import { config } from './config.js';
import { createApp } from './app.js';
import { migrate } from './db/migrate.js';
import { openDb } from './db/open.js';
import { assertDatasetMatches } from './db/guard.js';

// ensure schema is current (idempotent)
migrate();
assertDatasetMatches(openDb());

const app = createApp();
const server = app.listen(config.port, config.host, () => {
  // eslint-disable-next-line no-console
  console.log(`[sdca] listening on http://${config.host}:${config.port} (${config.env}, ${config.dataset} data)`);
});

function shutdown(sig) {
  // eslint-disable-next-line no-console
  console.log(`[sdca] ${sig} — shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
