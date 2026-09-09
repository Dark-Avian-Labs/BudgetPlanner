import { createApp } from './app.js';
import {
  APP_DB_PATH,
  APP_NAME,
  HOST,
  NODE_ENV,
  PORT,
  SESSION_DB_PATH,
  SHUTDOWN_TIMEOUT_MS,
  ensureDataDirs,
} from './config.js';
import { closeAppDb, closeSessionDb } from './db/connection.js';

ensureDataDirs();

const { app, sessionStore } = createApp();
console.log(`[${APP_NAME}] Session store ready (${SESSION_DB_PATH})`);
console.log(`[${APP_NAME}] App database ready (${APP_DB_PATH})`);

const server = app.listen(PORT, HOST, () => {
  console.log(`[${APP_NAME}] Server running on http://${HOST}:${PORT} (${NODE_ENV})`);
});

function shutdown(baseExitCode = 0): void {
  let done = false;
  function closeAndExit(exitCode: number): void {
    if (done) return;
    done = true;
    sessionStore.dispose();
    try {
      closeSessionDb();
    } catch (err) {
      console.error('[Shutdown] Failed to close session DB:', err);
      exitCode = 1;
    }
    try {
      closeAppDb();
    } catch (err) {
      console.error('[Shutdown] Failed to close app DB:', err);
      exitCode = 1;
    }
    process.exit(exitCode);
  }
  const timeout = setTimeout(() => closeAndExit(1), SHUTDOWN_TIMEOUT_MS);
  server.close((err) => {
    clearTimeout(timeout);
    if (err) {
      console.error('[Shutdown] HTTP server close failed:', err);
      closeAndExit(1);
      return;
    }
    closeAndExit(baseExitCode);
  });
  server.closeIdleConnections();
  setTimeout(
    () => {
      server.closeAllConnections();
    },
    Math.max(0, SHUTDOWN_TIMEOUT_MS - 500),
  );
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

process.on('unhandledRejection', (reason) => {
  console.error(
    '[Crash] Unhandled promise rejection; shutting down',
    reason instanceof Error ? (reason.stack ?? reason.message) : String(reason),
  );
  shutdown(1);
});

process.on('uncaughtException', (err) => {
  console.error('[Crash] Uncaught exception; shutting down', err.stack ?? err.message);
  shutdown(1);
});

export default app;
