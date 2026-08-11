# README template

Use this shape for every DAL app `README.md`. Domain-only sections go after the standard block and before License.

````markdown
# <ProductName>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/Dark-Avian-Labs/<repo>/actions/workflows/ci.yml/badge.svg)](https://github.com/Dark-Avian-Labs/<repo>/actions/workflows/ci.yml)
[![PR](https://github.com/Dark-Avian-Labs/<repo>/actions/workflows/pr.yml/badge.svg)](https://github.com/Dark-Avian-Labs/<repo>/actions/workflows/pr.yml)
![Node](https://img.shields.io/badge/Node-%3E%3D26-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6.x-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.x-06B6D4?logo=tailwindcss&logoColor=white)
[![Cursor](https://img.shields.io/badge/Cursor-IDE-141414?logo=cursor&logoColor=white)](https://cursor.com)

<1–3 sentence product blurb.>

## Features

## Requirements

- Node.js 26+
- pnpm 11+

## Quick start

1. `pnpm install`
2. `cp .env.example .env`
3. `pnpm dev` (or `pnpm run build` && `pnpm start`)

## Examples

```bash
curl -sS http://127.0.0.1:<port>/api/health
```
````

## Environment

| Variable | Description |
| -------- | ----------- |
| …        | …           |

## Scripts

| Script              | Description                                                    |
| ------------------- | -------------------------------------------------------------- |
| `pnpm run validate` | Preflight + format, lint, typecheck, and tests (when present). |
| …                   | …                                                              |

## Development

Agent-oriented docs: [openwiki/quickstart.md](openwiki/quickstart.md).
Org engineering standards: AppBase `docs/org-standards/`.

## License

MIT

```

## Conventions

- H1 = product name only.
- Badges under H1: License + CI/PR (when workflows exist) + runtime/stack + Cursor.
- Prefer “Quick start” over “Setup”.
- Put `validate` first in the Scripts table.
- Rust apps: swap Node badge for Rust edition; Scripts document `scripts/validate` / cargo instead of pnpm.
- Omit Features / Examples / Development when they would be empty stubs.
```
