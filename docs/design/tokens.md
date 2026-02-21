---
summary: "Design tokens and where to change the look of OpenClaw (CLI, TUI, Control UI)"
read_when:
  - Changing colors, typography, or theme across OpenClaw
  - Adding or tuning a visual theme (e.g. Retro)
title: "Design tokens and theming"
---

# Design tokens and theming

This page is the **single reference** for where to change how OpenClaw looks: CLI, TUI, and Control UI (browser). Use it to keep accents and semantics consistent or to introduce a new theme.

## Token locations (quick map)

| Surface                             | Where                     | What to edit                                                      |
| ----------------------------------- | ------------------------- | ----------------------------------------------------------------- |
| **CLI** (terminal output)           | `src/terminal/palette.ts` | `LOBSTER_PALETTE` hex values                                      |
| **CLI** (wizard/onboarding prompts) | `src/terminal/theme.ts`   | Uses `LOBSTER_PALETTE`; add new chalk helpers if needed           |
| **TUI** (interactive terminal UI)   | `src/tui/theme/theme.ts`  | Inline `palette` object + `theme` / `markdownTheme` / list themes |
| **Control UI** (browser)            | `ui/src/styles/base.css`  | `:root` and `:root[data-theme="..."]` CSS variables               |
| **Docs** (CLI palette reference)    | `docs/cli/index.md`       | "Color palette" section; keep in sync with `LOBSTER_PALETTE`      |

Changing the **accent** color everywhere means:

1. **CLI**: `src/terminal/palette.ts` → `accent`, `accentBright`, `accentDim`, `info`.
2. **TUI**: `src/tui/theme/theme.ts` → `palette.accent`, `palette.accentSoft`, and any accent-driven keys.
3. **Control UI**: `ui/src/styles/base.css` → `--accent`, `--accent-hover`, `--accent-muted`, `--accent-subtle`, `--accent-foreground`, `--accent-glow`, `--primary`, `--ring`, `--focus`, `--focus-glow`, and light-theme equivalents.

## Control UI themes

The Control UI supports multiple themes via `data-theme` on `<html>`:

- **dark** (default): Warm dark with red accent.
- **light**: Clean light with red accent.
- **retro**: Terminal-inspired (phosphor green on void black, sharp corners, monospace). Toggle in Settings → theme selector.

All theme variables live in `ui/src/styles/base.css`. To add a new theme:

1. Add the theme mode in `ui/src/ui/theme.ts` (`ThemeMode` and `ResolvedTheme`).
2. Add storage/validation in `ui/src/ui/storage.ts`.
3. Add a `:root[data-theme="your-theme"]` block in `base.css` with the same variable names as dark/light.
4. Add the theme to the Settings theme toggle in `ui/src/ui/app-render.helpers.ts` and ensure `applyResolvedTheme` sets `dataset.theme` to your resolved value.

## Retro theme (inspiration)

The **Retro** theme is inspired by terminal/mainframe aesthetics (e.g. [LOOM](https://github.com/mhsenkow/loom)):

- **Background**: Near black (`#050505`).
- **Accent**: Phosphor green (`#33ff00`).
- **No border radius**: Sharp, rectangular panels.
- **Monospace** for body where it fits; JetBrains Mono for code.
- Optional **scanline** effect is available via a CSS class for extra flair.

Designers can copy the Retro block in `base.css` and tweak hex values to create variants (e.g. amber, blue phosphor).

## Typography

- **Control UI**: `ui/src/styles/base.css` → `--font-body`, `--font-display`, `--mono`. Defaults: Space Grotesk (UI), JetBrains Mono (code).
- **TUI**: Font is controlled by the terminal; theme only sets ANSI colors.
- **CLI**: Same as TUI; no font configuration in repo.

## Semantic colors (shared intent)

Keep these roles consistent across surfaces when you change tokens:

| Role                | CLI       | TUI                                 | Control UI (var)                    |
| ------------------- | --------- | ----------------------------------- | ----------------------------------- |
| Success             | `success` | `palette.success`                   | `--ok`, `--ok-muted`, `--ok-subtle` |
| Error / destructive | `error`   | `palette.error`                     | `--destructive`, `--danger`         |
| Warning             | `warn`    | (use `error` or custom)             | `--warn`                            |
| Muted / secondary   | `muted`   | `palette.dim`, `palette.systemText` | `--muted`, `--muted-strong`         |
