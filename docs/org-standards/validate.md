# Validate contract

Every app exposes one named quality gate that CI and agents run before merge.

## TypeScript / JavaScript (`pnpm run validate`)

Implement via `run-quality-checks.mjs` (or equivalent) that runs, in order:

1. **Runtime preflight** — Node major ≥26, pnpm major from `packageManager`, native module smoke (e.g. `better-sqlite3`) when used
2. **`pnpm run check-format`** — oxfmt
3. **`pnpm run lint`** — oxlint
4. **`pnpm run typecheck`**
5. **`pnpm run test`** — omit this step when the repo has no test suite yet

CI then runs **`pnpm run build`** as a separate step after validate.

### No-tests variant

shark5060.net / InfoGraphic / Homepage initially: steps 1–4 only (or 2–4 if preflight is not applicable). Do not invent empty Vitest suites just to satisfy the name.

### Tooling

Prefer **oxlint** + **oxfmt** over ESLint/Prettier for new and migrated JS/TS apps.

## Rust (`scripts/validate`)

Poltergeist (and similar):

```bash
cargo fmt --all -- --check
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo test --workspace --locked
```

Expose as `scripts/validate` (bash) and/or `scripts/validate.ps1` so agents have one command. PR workflows call that script.
