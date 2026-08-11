---
type: Architecture Overview
title: Project Structure
description: Directory layout, the server/client split, path aliases, and the TypeScript/Vite build topology for AppBase.
tags: [architecture, structure, vite, typescript]
timestamp: 2026-07-21T00:00:00Z
---

# Overview

AppBase is a single-package app (not a monorepo) with a clear server/client split under one root.
The server is a small Express app; the client is a Vite-built React SPA served as static files in
production. This page maps the tree and the build wiring; runtime behavior lives in
[server runtime](server-runtime.md) and the UI layer in [design system](design-system.md).

# Directory map

```
server/                 Express API + static host
├── index.ts            App entry: middleware chain, routes, listen, shutdown
├── config.ts           Env-derived config + PROJECT_ROOT/DATA_DIR resolution
├── routes/api.ts       /api router (/health, /csrf)
├── db/connection.ts    Lazy better-sqlite3 session DB (WAL)
├── db/sessionSchema.ts CREATE TABLE sessions + index
└── types/              express-session type augmentation

client/                 React SPA
├── main.tsx            Root render: BrowserRouter + ThemeProvider
├── App.tsx             Renders AppRoutes
├── app/                Routing only: config.ts, paths.ts, routes.tsx
├── features/           Page UI (home, legal)
├── components/Layout/  Shell: Layout, backgrounds, SearchBar
├── components/ui/       Shared primitives (Button, Modal, Menu, …)
├── context/            ThemeContext (theme + UI style)
├── lib/asciiBackground/ Canvas ASCII wave helpers
├── styles/input.css    ALL design tokens + component classes (Tailwind v4)
└── clerk/              Optional Clerk styling (not wired by default)

scripts/                dev.mjs (dual dev), runtime-preflight.mjs
docs/org-standards/     DAL engineering conventions
assets/, public/        Fonts/art assets and theme-init.js
run-quality-checks.mjs  pnpm run validate entrypoint
```

# Server/client boundary

There is one process in production: the Express server serves `dist/client` as static assets and
falls back to `index.html` for client-side routing (`server/index.ts:156`). The client talks to the
server only through `/api` (`client/utils/api.ts`, `server/routes/api.ts`). In development the two
run as separate processes with a Vite proxy — see
[development & build](workflows/development-and-build.md).

# Path aliases and TypeScript projects

- Vite aliases `@` → `client/` (`vite.config.ts:20`); imports like `@/context/ThemeContext` resolve
  there.
- Two TypeScript projects compile independently: `tsconfig.server.json` (server, emits to `dist/`)
  and `tsconfig.json` (client, `--noEmit`). `pnpm run typecheck` runs both (`package.json:8`).
- `PROJECT_ROOT` is computed relative to the compiled file location so paths work both from source
  (`server/`) and from `dist/` (`server/config.ts:7`).

# Build topology

`pnpm run build` = typecheck → `tsc -p tsconfig.server.json` (server → `dist/server`) → `vite build`
(client → `dist/client`, per `vite.config.ts:24`). The two outputs live side by side under `dist/`
and are wired together at runtime by [server runtime](server-runtime.md). Depends on the scripts and
proxy documented in [development & build](workflows/development-and-build.md).

# Where to start

- Server entry: `server/index.ts`
- Client entry: `client/main.tsx` → `client/app/routes.tsx`
- Build config: `vite.config.ts`, `tsconfig.server.json`

# What to watch out for

- **`PROJECT_ROOT` depends on the `dist` folder name.** `config.ts` checks whether its parent
  directory is `dist` to decide the root; renaming the output dir would break asset resolution
  (`server/config.ts:7`).
- **`@` alias is Vite-only.** Server code uses relative `.js` imports (ESM), not the `@` alias.
