# Design System: FAMILY Sovereign Financial UI

## 1. Design Direction: Sovereign Treasury
- **Aesthetic:** Swiss private bank meets modern quantitative terminal. Deep charcoal & obsidian base, crisp white and slate typography, emerald precision accents, and gold reserve highlights.
- **Surface Elevation:**
  - Base Background: `#0B0F17` (Deep Obsidian)
  - Surface Card (Level 1): `#111827` (Charcoal Slate, solid with 1px border `#1E293B`)
  - Elevated Popovers & Modals (Level 2): `#162032` (Solid Elevated Slate)
  - Highlight Accent: `#10B981` (Emerald Treasury) / `#059669` (Dark Emerald)
  - Warning / Liability Accent: `#F43F5E` (Rose) / `#E11D48`
  - Warning / Alert Accent: `#D97706` (Amber Gold)

## 2. Typography & Numbers
- **Primary Interface Font:** Arabic Noto Sans / Cairo / Inter for headers and labels.
- **Financial Monospace / Tabular Font:** JetBrains Mono / SF Mono / Consolas with `font-feature-settings: 'tnum'` (`tabular-nums`) enabled globally for all ledger numbers, balances, percentages, and timestamps.
- **Typographic Scale:**
  - Hero Balance: `36px` / Line height `1.1` / Bold
  - Card Metric: `24px` / Line height `1.2` / Semi-bold
  - Section Title: `16px` / Line height `1.3` / Medium
  - Body Text: `14px` / Line height `1.5` / Regular
  - Caption & Meta: `12px` / Line height `1.4` / Medium

## 3. Touch Targets & Spacing Rhythm
- **Minimum Tap Target:** `44px × 44px` minimum, `48px` preferred for mobile thumb actions.
- **Button Standards:**
  - Primary Action: `min-h-[44px]` (Desktop) / `min-h-[48px]` (Mobile), padding `px-4 py-2.5`.
  - Icon Buttons: `size-11` (44px) or `size-12` (48px) with centered icon.
  - Spacing Unit: 4px base (`4px`, `8px`, `12px`, `16px`, `24px`, `32px`).

## 4. Impeccable Anti-Patterns Strictly Prohibited
- ❌ No `gray-on-color`: Text on colored buttons/pills must be `#FFFFFF` or a distinct dark tint of the same color, never washed-out slate.
- ❌ No `ai-color-palette`: Avoid purple-to-indigo or cyan-on-dark glow gradients.
- ❌ No `codex-grid-background`: No decorative 2-axis CSS hairline grids across regular app backgrounds.
- ❌ No `nested cards`: Avoid cards inside cards inside cards; use flat section dividers instead.
- ❌ No `bounce-easing`: All transitions use standard cubic-bezier (`ease-out` or `cubic-bezier(0.16, 1, 0.3, 1)`).
