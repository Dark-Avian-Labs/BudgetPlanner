---
type: Integration
title: Clerk Authentication Styling (Optional)
description: The optional client/clerk add-on that glass-themes Clerk sign-in/up and profile UIs; not wired by default.
tags: [integration, clerk, auth, styling, optional]
timestamp: 2026-07-21T00:00:00Z
---

# Overview

AppBase ships **no authentication by default**. The `client/clerk/` folder is an optional add-on that
makes [Clerk](https://clerk.com/docs/references/react/overview) sign-in/up and profile surfaces match
the [DAL design system](../architecture/design-system.md). It is **not wired**: there is no
`@clerk/react` dependency in `package.json`, no Clerk CSS imported in `client/main.tsx`, and no Clerk
middleware in the server. Apps opt in explicitly.

# What the add-on provides

Files under `client/clerk/`:

| File                 | Purpose                                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| `clerk-auth.css`     | Glass-themed overrides for Clerk sign-in/up and profile modals (Prism/Shadow/Clear aware).                |
| `clerkAppearance.ts` | `buildClerkAppearance()` / `buildClerkProfileAppearance()` — map Clerk's `appearance` API to DAL classes. |
| `ClerkAuthShell.tsx` | Auth page wrapper: `glass-surface` card + `clerk-auth-shell` + title/subtitle.                            |
| `index.ts`           | Barrel exports.                                                                                           |

Because the overrides read the same CSS variables and `html.dark` / `html.ui-*` classes as the rest
of the app, Clerk UIs follow the active theme with no separate Clerk theme config — this is why the
add-on depends on the [design system](../architecture/design-system.md) tokens.

# Enabling it

1. `pnpm add @clerk/react` and set `VITE_CLERK_PUBLISHABLE_KEY` / server `CLERK_SECRET_KEY`.
2. Import Clerk styles **after** the design system CSS in `main.tsx`:
   `import './styles/input.css';` then `import '@/clerk/clerk-auth.css';`.
3. Wrap sign-in/up routes in `ClerkAuthShell` and pass `appearance={buildClerkAppearance(mode)}` from
   `useTheme()`.
4. For the profile modal, pass `appearance: buildClerkProfileAppearance(mode)` to
   `clerk.openUserProfile()`.

The full patterns (sign-in page, profile modal) are in root `AGENTS.md` → "Optional: Clerk
authentication styling".

# Where to start

- `client/clerk/index.ts` and the files above
- `AGENTS.md` → "Optional: Clerk authentication styling"

# What to watch out for

- **Import order matters:** Clerk CSS must load after `input.css`, or design-system tokens won't be
  available to override.
- **Styling only.** This add-on does not implement auth logic, routing guards, or the server side —
  those belong to the app that adopts Clerk (or the org's centralized auth).
- **Placeholder Clerk keys break authenticated routes** in Clerk apps; use real keys outside pure
  styling work (see [configuration](../operations/configuration.md) for the env pattern).
