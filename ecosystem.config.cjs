/**
 * PM2 app definition (no secrets).
 * Server LAN overrides: HOST/PORT/SECURE_COOKIES via `env` below.
 * Decryption: `.env.keys` on the server (chmod 600) or DOTENV_PRIVATE_KEY.
 */
module.exports = {
  apps: [
    {
      name: 'BudgetPlanner',
      cwd: '/var/www/budgetplanner',
      script: 'pnpm',
      args: 'start',
      interpreter: 'none',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'development',
        HOST: '0.0.0.0',
        PORT: '3040',
        SECURE_COOKIES: '0',
        TRUST_PROXY: '0',
      },
    },
  ],
};
