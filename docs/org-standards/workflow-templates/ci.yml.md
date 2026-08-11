# Example CI shapes

## Semantic-release deployable (Track A)

Job order sketch (see Armory/Codex `ci.yml` for full deploy SSH/PM2 steps):

```yaml
name: <App> CI/CD

env:
  NODE_VERSION: 26

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deployment-check:
    runs-on: blacksmith-2vcpu-ubuntu-2404
    # decide deploy=true/false …

  version:
    runs-on: blacksmith-8vcpu-ubuntu-2404
    needs: [deployment-check]
    # semantic-release via CI_PAT …

  validate:
    runs-on: blacksmith-8vcpu-ubuntu-2404
    needs: [deployment-check, version]
    steps:
      # checkout release target SHA
      - run: pnpm run validate

  build-and-deploy:
    runs-on: blacksmith-8vcpu-ubuntu-2404
    needs: [deployment-check, version, validate]
    # build + rsync + pm2 …

  discord-status:
    runs-on: blacksmith-2vcpu-ubuntu-2404
    needs: [deployment-check, version, validate, build-and-deploy]
    if: ${{ always() && github.ref == 'refs/heads/main' }}
    steps:
      - uses: iShark5060/actions-discord-status@v1
        with:
          webhook: ${{ secrets.DISCORD_WEBHOOK }}
          # … status/title/description …
```

## Direct deploy static site (Track C)

```yaml
jobs:
  validate:
    runs-on: blacksmith-8vcpu-ubuntu-2404
    steps:
      - uses: useblacksmith/checkout@v1
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with:
          node-version: '26'
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm run validate
      - run: pnpm run build

  deploy:
    runs-on: blacksmith-8vcpu-ubuntu-2404
    needs: [validate]
    # existing rsync/SSH deploy …

  discord-status:
    runs-on: blacksmith-2vcpu-ubuntu-2404
    needs: [validate, deploy]
    if: always()
```
