import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const apiTarget = process.env.VITE_DEV_API_TARGET?.trim() || 'http://127.0.0.1:3002';
const vitePort = process.env.VITE_DEV_PORT?.trim() || '5173';

const devEnv = {
  ...process.env,
  NODE_ENV: 'development',
  SECURE_COOKIES: '0',
};

const children = [];
let shuttingDown = false;
const SHUTDOWN_DEADLINE_MS = 5_000;

function tryKill(child, signal) {
  if (child.exitCode !== null || child.signalCode) return;
  try {
    child.kill(signal);
  } catch {
    // ignore
  }
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  const alive = children.filter((child) => child.exitCode === null && !child.signalCode);
  for (const child of alive) {
    tryKill(child, 'SIGTERM');
  }

  if (alive.length === 0) {
    process.exit(code);
    return;
  }

  let remaining = alive.length;
  const forceTimer = setTimeout(() => {
    for (const child of alive) {
      tryKill(child, 'SIGKILL');
    }
  }, SHUTDOWN_DEADLINE_MS);

  for (const child of alive) {
    child.once('exit', () => {
      remaining -= 1;
      if (remaining === 0) {
        clearTimeout(forceTimer);
        process.exit(code);
      }
    });
  }
}

function start(label, args) {
  const child = spawn(process.execPath, args, {
    stdio: 'inherit',
    cwd: projectRoot,
    env: devEnv,
  });

  child.on('exit', (code) => {
    if (shuttingDown) return;
    console.error(`\n[dev] ${label} exited with code ${code ?? 1}`);
    shutdown(code ?? 1);
  });

  children.push(child);
  return child;
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

const tsxCli = path.join(projectRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const viteCli = path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');

console.log(`[dev] API server target: ${apiTarget}`);
console.log(`[dev] Vite client: http://127.0.0.1:${vitePort}`);
console.log('[dev] Press Ctrl+C to stop both processes.\n');

start('server', [tsxCli, 'watch', 'server/index.ts']);
start('client', [viteCli, '--port', vitePort]);
