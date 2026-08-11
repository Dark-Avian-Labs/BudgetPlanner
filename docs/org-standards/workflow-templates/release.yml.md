# Manual release (Track B — Poltergeist / NiTTY pattern)

```yaml
name: <App> Release

permissions:
  contents: read

on:
  workflow_dispatch:
    inputs:
      version:
        description: Release version (e.g. 1.0). Leave empty to use LATEST.VER.
        required: false
        type: string
      prerelease:
        description: Mark the GitHub release as a pre-release
        required: false
        type: boolean
        default: false
      draft:
        description: Create the GitHub release as a draft
        required: false
        type: boolean
        default: false

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: false

jobs:
  prepare:
    runs-on: blacksmith-8vcpu-ubuntu-2404
    outputs:
      version: ${{ steps.resolve.outputs.version }}
      tag: ${{ steps.resolve.outputs.tag }}
    steps:
      - uses: useblacksmith/checkout@v1
      - id: resolve
        # resolve version from inputs.version or LATEST.VER → tag vX.Y

  build:
    runs-on: blacksmith-8vcpu-windows-2025
    needs: [prepare]
    steps:
      - uses: useblacksmith/checkout@v1
      # build + zip artifacts
      - uses: actions/upload-artifact@v7

  release:
    runs-on: blacksmith-8vcpu-ubuntu-2404
    needs: [prepare, build]
    permissions:
      contents: write
    steps:
      - uses: useblacksmith/checkout@v1
      - uses: actions/download-artifact@v8
      - uses: iShark5060/actions-gh-release@v1
        with:
          tag_name: ${{ needs.prepare.outputs.tag }}
          name: <App> ${{ needs.prepare.outputs.version }}
          draft: ${{ inputs.draft }}
          prerelease: ${{ inputs.prerelease }}
          generate_release_notes: true
          files: dist/*
          fail_on_unmatched_files: true

  discord-status:
    runs-on: blacksmith-2vcpu-ubuntu-2404
    needs: [prepare, build, release]
    if: always()
    steps:
      - uses: iShark5060/actions-discord-status@v1
        with:
          webhook: ${{ secrets.DISCORD_WEBHOOK }}
```
