# Design

Docs and references for designing and theming OpenClaw.

- **[Design tokens and theming](tokens.md)** — Where to change colors, fonts, and themes for CLI, TUI, and Control UI. Use this as the single map when changing the look of the product.

Control UI source lives in `ui/` (Vite + Lit). Main entry for styles: `ui/src/styles.css` → `base.css`, `layout.css`, `components.css`, `config.css`, and chat-specific CSS under `ui/src/styles/chat/`.
