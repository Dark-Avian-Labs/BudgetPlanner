---
type: Architecture Overview
title: DAL Design System
description: The two-axis theme model, glass-surface component contracts, design tokens, UI primitives, theme boot/persistence, and layered shell backgrounds.
tags: [design-system, theming, tailwind, ui, glass]
timestamp: 2026-08-23T04:51:00Z
---

# Overview

BudgetPlanner uses the **DAL design system** (same tokens and classes as AppBase, Armory, and Codex).
A frosted-glass UI on two independent axes, one token stylesheet (`client/styles/input.css`), and
primitives mirrored by hand. Auth styling is in [Clerk integration](../integrations/clerk.md).
AppBase `AGENTS.md` still has the full token/class contract if you need to port a new control.

# Two-axis theme model

| Axis       | Values                                   | HTML classes                                              | Default |
| ---------- | ---------------------------------------- | --------------------------------------------------------- | ------- |
| Color mode | `light` / `dark`                         | `html.dark` (absent = light)                              | `dark`  |
| UI style   | `prism` / `shadow` / `clear` / `acrylic` | `html.ui-prism` / `ui-shadow` / `ui-clear` / `ui-acrylic` | `prism` |

The two axes combine freely (e.g. light + clear). **Prism** is the baseline glass look, **Shadow**
adds heavier blur/shadow, **Clear** removes backdrop blur and shrinks radii, **Acrylic** is the
Windows 11 flyout material (variant D: blur + saturate, tint, exclusion, noise). Types and helpers are
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
`html:not(.dark)`; Shadow, Clear, and Acrylic override via `html.ui-shadow` / `html.ui-clear` /
`html.ui-acrylic` blocks. Acrylic tiles `client/styles/acrylic-noise.svg` and maps exclusion/noise
onto surface `::before` / `::after`. See
AppBase `AGENTS.md` → "CSS architecture" for the full token list (`--color-*`, `--radius-ui*`,
`--shadow-panel`, ASCII/hex tokens, etc.).

# Component contracts and primitives

Use the shared class names and primitives rather than inventing one-offs:

- Surfaces: `glass-surface`, `glass-modal-surface`, `glass-shell`.
- Buttons: `btn btn-accent` / `btn-danger` / `btn-cancel` / `btn-secondary`.
- Stale client banner: `StaleClientUpdateBanner` + gold `stale-update-cta` / `stale-update-cta__label` ("Refresh now!"). Same markup as Armory and Codex.
- Layout: `max-w-[2000px]` on header, main, footer (`client/components/Layout/Layout.tsx`).
- Primitives in `client/components/ui/`: `Button`, `Input`, `GlassCard`, `Modal`, `Menu`,
  `SelectDropdown`, `UiStyleSelector`, `MaterialSymbol`.

AppBase `AGENTS.md` → "Component contracts" / "UI primitives" is the authoritative table.

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
- Full contract: AppBase `AGENTS.md`

# What to watch out for

- **No shared UI package.** Token, glass, or component-class changes must be mirrored into Codex
  (`packages/core/src/input.css`) and Armory (`client/styles/input.css`) by hand — AppBase
  `AGENTS.md` keeps the checklist.
- **Keep exactly one `ui-*` class on `<html>`** plus optional `dark`; `ThemeProvider` enforces this
  by removing the others before adding the active one.
- **Acrylic blur dies** if a parent has `opacity < 1`, `filter`, `mask`, `clip-path`, or its own
  `backdrop-filter`. Do not add `brightness()` to the Acrylic filter.
- **Don't rename the `dal.*` cookie/localStorage keys** — cross-app theme sync depends on them.
