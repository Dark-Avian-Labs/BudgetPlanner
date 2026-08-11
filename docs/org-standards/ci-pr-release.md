# CI, PR, and release

## Runner tiers

| Workload                                                     | Runner                                                                    |
| ------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Validate, build, deploy, semantic-release, Rust compile/test | `blacksmith-8vcpu-ubuntu-2404` (Windows: `blacksmith-8vcpu-windows-2025`) |
| Notifications, cheap gates (`deployment-check`)              | `blacksmith-2vcpu-ubuntu-2404`                                            |

Do not use `ubuntu-latest` or `blacksmith-4vcpu-*` for new/updated jobs.

## Required actions

| Concern                       | Pin                                     |
| ----------------------------- | --------------------------------------- |
| Checkout (Blacksmith jobs)    | `useblacksmith/checkout@v1`             |
| pnpm                          | `pnpm/action-setup@v6`                  |
| Node                          | `actions/setup-node@v7` (`cache: pnpm`) |
| Discord status                | `iShark5060/actions-discord-status@v1`  |
| GitHub Release (manual track) | `iShark5060/actions-gh-release@v1`      |

Optional local composite: `.github/actions/pnpm-install-fresh` (drop lockfile then `pnpm install`) — used by Armory/Codex/TC-Bot style CI.

## Workflow files

| File          | Trigger                                | Role                                                                           |
| ------------- | -------------------------------------- | ------------------------------------------------------------------------------ |
| `pr.yml`      | `pull_request`                         | Install → `pnpm run validate` → `pnpm run build` (+ coverage when tests exist) |
| `ci.yml`      | `push` to `main` / `workflow_dispatch` | Per release track below                                                        |
| `release.yml` | `workflow_dispatch`                    | Manual artifact releases (Poltergeist only)                                    |

PR/CI validate jobs must call **`pnpm run validate`** (or Rust `scripts/validate`), not re-list format/lint/typecheck/test as separate steps.

## Release tracks

### A — semantic-release (in `ci.yml`)

Used by: Armory, Codex, TC-Bot, AerieDrive, InfoGraphic.

- `.releaserc.json` + `version` job that runs `pnpm exec semantic-release`
- Typical job order: `deployment-check` → `version` → `validate` → `build-and-deploy` → `discord-status`
- No separate `release.yml`

### B — manual GitHub Release (`release.yml`)

Used by: Poltergeist.

- `workflow_dispatch` inputs: `version`, `prerelease`, `draft`
- Jobs: `prepare` → `build` (Windows zips) → `release` → `discord-status`
- Pattern references: NiTTY / 7-Zip release workflows
- CI on `main` must **not** auto-publish nightly GitHub Releases

### C — direct deploy only

Used by: Homepage/clouds, shark5060.net.

- Keep push-to-prod deploy in `ci.yml`
- No semantic-release, no manual `release.yml`

### Starter

AppBase: PR checks only; no release/deploy workflows.

## Templates

See [workflow-templates/](workflow-templates/).
