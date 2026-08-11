import path from 'path';
import { fileURLToPath } from 'url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  // Prefer process.env (injected by `dotenvx run`) over raw .env file values,
  // which may be ciphertext when encryption is enabled.
  const fileEnv = loadEnv(mode, process.cwd(), '');
  const envValue = (key: string, fallback = '') =>
    process.env[key]?.trim() || fileEnv[key]?.trim() || fallback;

  const devApiTarget = envValue('VITE_DEV_API_TARGET', 'http://127.0.0.1:3002');
  const base = envValue('VITE_BASE_PATH', '/');
  const devPort = Number.parseInt(envValue('VITE_DEV_PORT', '5173'), 10);

  return {
    base,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'client'),
      },
    },
    build: {
      outDir: 'dist/client',
      emptyOutDir: true,
    },
    server: {
      port: Number.isFinite(devPort) && devPort > 0 ? devPort : 5173,
      proxy: {
        '/api': {
          target: devApiTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
