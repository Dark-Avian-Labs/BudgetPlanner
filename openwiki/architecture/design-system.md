---
type: Architecture Overview
title: DAL Design System
description: The two-axis theme model, glass-surface component contracts, design tokens, UI primitives, theme boot/persistence, and layered shell backgrounds.
tags: [design-system, theming, tailwind, ui, glass]
timestamp: 2026-07-21T00:00:00Z
---

# Overview

AppBase ships the **DAL design system**: a frosted-glass UI driven by two independent axes, a single
token stylesheet, and a small set of primitives that sibling apps mirror manually. The canonical,
exhaustive contract (token names, class names, porting checklist) lives in the root **`AGENTS.md`**;
this page is the map into it and the code that implements it. Optional auth styling extends this
system in [Clerk integration](../integrations/clerk.md).

# Two-axis theme model

| Axis       | Values                       | HTML classes                               | Default |
| ---------- | ---------------------------- | ------------------------------------------ | ------- |
| Color mode | `light` / `dark`             | `html.dark` (absent = light)               | `dark`  |
| UI style   | `prism` / `shadow` / `clear` | `html.ui-prism` / `ui-shadow` / `ui-clear` | `prism` |

The two axes combine freely (e.g. light + clear). **Prism** is the baseline glass look, **Shadow**
adds heavier blur/shadow, **Clear** removes backdrop blur and shrinks radii. Types and helpers are
defined in `client/context/ThemeContext.tsx` (`ThemeMode`, `UiStyle`, `UI_STYLES`,
`UI_STYLE_LABELS`).

# Boot order (avoid FOUC)

1. `index.html` ships `class="dark ui-prism"` as an SSR fallback.
2. `public/theme-init.js` runs synchronously in `<head>` before React, applying classes from
   cookie/localStorage.
3. `ThemeProvider` re-applies on change and persists — it deliberately **skips the first write**
   (via `hasMountedRef`) so it does not clobber the pre-hydration classes
   (`client/context/ThemeContext.tsx:122`).

# Persistence and the theme API

`useTheme()` exposes `{ mode, setMode, toggleMode, uiStyle, setUiStyle, cycleUiStyle }`
(`client/context/ThemeContext.tsx:184`). Persistence keys:

| Setting    | Cookie           | localStorage                            |
| ---------- | ---------------- | --------------------------------------- |
| Color mode | `dal.theme.mode` | `dal.theme.mode` + `appbase.theme.mode` |
| UI style   | `dal.ui.style`   | `dal.ui.style`                          |

The shared `dal.*` keys let choices sync across DAL subdomains when
`VITE_SHARED_THEME_COOKIE_DOMAIN` is set (see [configuration](../operations/configuration.md)); the
`appbase.theme.mode` key is the app-local fallback. Cookies are written `SameSite=Lax`, and `Secure`
only over HTTPS (`client/context/ThemeContext.tsx:100`).

# Tokens and CSS architecture

All design tokens and component classes live in **`client/styles/input.css`** (Tailwind v4 with
`@theme`, `@layer components`, and style-specific overrides). Light mode overrides tokens via
`html:not(.dark)`; Shadow and Clear override via `html.ui-shadow` / `html.ui-clear` blocks. See
`AGENTS.md` → "CSS architecture" for the full token list (`--color-*`, `--radius-ui*`,
`--shadow-panel`, ASCII/hex tokens, etc.).

# Component contracts and primitives

Use the shared class names and primitives rather than inventing one-offs:

- Surfaces: `glass-surface`, `glass-modal-surface`, `glass-shell`.
- Buttons: `btn btn-accent` / `btn-danger` / `btn-cancel` / `btn-secondary`.
- Layout: `max-w-[2000px]` on header, main, footer (`client/components/Layout/Layout.tsx`).
- Primitives in `client/components/ui/`: `Button`, `Input`, `GlassCard`, `Modal`, `Menu`,
  `SelectDropdown`, `UiStyleSelector`, `MaterialSymbol`.

`AGENTS.md` → "Component contracts" / "UI primitives" is the authoritative table.

# Shell backgrounds

`Layout` renders two fixed background layers behind content: `HexSideBackground` (edge hex clusters)
and `AsciiWaveBackground` (a canvas diagonal scan wave over ASCII art), then the header/main/footer
(`client/components/Layout/Layout.tsx:39`). The wave logic lives in `client/lib/asciiBackground/` and
reads art from `assets/background*.txt`. The canvas internals are deferred to Backlog; treat the
files as a unit when porting.

# Where to start

- Theme state: `client/context/ThemeContext.tsx`
- Shell + backgrounds: `client/components/Layout/`
- Primitives: `client/components/ui/`
- Tokens/classes: `client/styles/input.css`
- Full contract: root `AGENTS.md`

# What to watch out for

- **No shared UI package.** Token, glass, or component-class changes must be mirrored into Codex
  (`packages/core/src/input.css`) and Armory (`client/styles/input.css`) by hand — `AGENTS.md`
  keeps the checklist.
- **Keep exactly one `ui-*` class on `<html>`** plus optional `dark`; `ThemeProvider` enforces this
  by removing the others before adding the active one.
- **Don't rename the `dal.*` cookie/localStorage keys** — cross-app theme sync depends on them.
