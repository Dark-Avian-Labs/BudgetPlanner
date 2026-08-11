# OpenWiki (OKF)

Agent-oriented documentation lives under `openwiki/` using Google OKF v0.1.

## Requirements

- Root `openwiki/index.md` with `okf_version: "0.1"`
- Required entrypoint: `openwiki/quickstart.md`
- Every concept `.md` (except reserved `index.md` / `log.md`) starts with YAML front matter; `type` is required
- Relationships = Markdown links between concept pages
- Root `AGENTS.md` / `CLAUDE.md` include the standard OpenWiki section pointing at `openwiki/quickstart.md`

## Layout

```
openwiki/
├── index.md
├── quickstart.md
├── architecture/
├── workflows/
├── domain/
├── operations/
├── integrations/
└── testing/
```

Skip empty sections. Prefer few substantive pages over many stubs.

## Agent workflow

Use the Cursor **OpenWiki** skill:

- `openwiki init` — full generate/rewrite
- `openwiki update` — surgical refresh after code changes

Never document secrets or real `.env` values.
