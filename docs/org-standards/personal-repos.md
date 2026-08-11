# Personal repositories (GH-hosted runners)

Same engineering conventions as the rest of [org standards](README.md) (README shape, validate gate, OKF OpenWiki, AGENTS OpenWiki section, release tracks), with these **overrides** for personal / non-Blacksmith repos:

## Runner and action pins

| Concern       | Personal repos                     | DAL apps (Blacksmith)          |
| ------------- | ---------------------------------- | ------------------------------ |
| Heavy jobs    | `ubuntu-latest` / `windows-latest` | `blacksmith-8vcpu-*`           |
| Notifications | `ubuntu-latest`                    | `blacksmith-2vcpu-ubuntu-2404` |
| Checkout      | `actions/checkout@v7`              | `useblacksmith/checkout@v1`    |
| Node setup    | `actions/setup-node@v7`            | `actions/setup-node@v7`        |

Do **not** pin Blacksmith runners or `useblacksmith/checkout` in personal repos.

## Defaults that still apply

- TypeScript/JavaScript tooling: Node **26+** and pnpm **11.x** when the project is a Node app (GitHub Actions packages may keep `engines.node >=24` to match `runs.using: node24`).
- One named validate entrypoint (`pnpm run validate`, or `scripts/validate` / `scripts/validate.ps1` for native).
- OKF OpenWiki under `openwiki/` with root `index.md` (`okf_version: "0.1"`) and `quickstart.md`.
- README shape from [readme-template.md](readme-template.md) (adapt badges/stack).
- Workflow files: `pr.yml` + `ci.yml` when useful; Track B `release.yml` for manual Windows artifact releases (NiTTY / 7-Zip pattern).

## Release tracks (personal)

| Track          | When                                         | Notes                                    |
| -------------- | -------------------------------------------- | ---------------------------------------- |
| A              | Rare for personal apps                       | semantic-release in `ci.yml` if desired  |
| B              | Native Windows tools (NiTTY, 7-Zip, similar) | Manual `workflow_dispatch` + gh-release  |
| C              | Deploy-only sites                            | Push deploy in `ci.yml`, no version tags |
| Action publish | JS/TS GitHub Actions                         | `release` event → build-and-tag          |
