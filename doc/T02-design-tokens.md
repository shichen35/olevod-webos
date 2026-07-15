# T02 Design Tokens and Global Style Baseline

> Milestone A | Prerequisite: T01 | Output: `src/styles/tokens.css`, `src/styles/base.css`, `src/styles/index.css`

## Goal

Establish the global design system: an opaque solid-color palette, a 10-foot-readable
type scale, and safe-area and focus-state conventions. This is where the "no animation /
no motion" constraint is enforced, and where translucency is confined to one sanctioned
frosted-glass material (`--glass-*`, reserved for chrome surfaces); every page style
downstream consumes only the tokens defined here.

## Reference

- The design language benchmarks Apple TV (tvOS HIG) for information architecture
  and type scale (10-foot readability); focus-state and material rules are defined
  in this task per this project's performance guardrails.

## Requirements

1. **Sizing baseline**: annotate everything directly in actual 1920x1080 px values,
   with `html,body` fixed at 1920x1080 and `overflow:hidden`. Do not use a logical
   stage + root `scale()` approach (scaling the root node incurs ongoing compositing
   overhead).
2. **Palette (opaque hex, no rgba/opacity layering — except the `--glass-*` material)**:
   - `--bg: #0e0e11` (global background), `--bg-elev: #1c1c21` (panels/dialogs),
     `--bg-elev-2: #2a2a31` (unfocused button/chip background, focused row);
   - three fixed grayscale text tiers: `--text: #f5f5f7`, `--text-2: #9d9da3`,
     `--text-3: #6b6b72` (no white-with-opacity layering);
   - `--accent: #23c8b6` used only for progress bars/ratings/selection indicators;
     `--uhd: #ffcf6b` for the "UHD" badge;
   - `--focus: #f5f5f7` (focus border/fill), `--focus-text: #111111` (text on a
     focused filled button/chip);
   - **the one sanctioned alpha exception** — the frosted-glass material
     (translucent fill + backdrop blur, Apple Liquid Glass style): `--glass-bg:
     rgba(28,28,34,.55)` (capsule/group fill), `--glass-strong: rgba(24,24,30,.7)`
     (denser fill: sheets and dialogs), `--glass-edge: rgba(255,255,255,.14)`
     (hairline highlight rim), `--glass-active: rgba(255,255,255,.12)` (selected
     pill/button fill, unfocused). Reserved for chrome surfaces only (tab-bar and
     segment capsules, the settings group, the filter sheet, player panels,
     dialogs) — these are small or static regions, and since the app only scrolls
     in instant steps the GPU pays one repaint per keypress, not per frame.
     Content surfaces (cards, grids, text) stay fully opaque; nothing outside
     `--glass-*` may use alpha or blur.
3. **Type scale** (actual 1080p values, minimum 22px): display 60 / title 45 /
   heading 32 / body 26 / label 24 / caption 22, mapped to `--fs-*` tokens. Font
   family: the system-ui stack.
4. **Focus-state conventions** (defined once globally in base.css, reused as
   classes by every component):
   - Cards (`.focusable-card`): `.focused` = a `--focus-border` (3px) opaque
     `--focus` border on the `.card-poster` only — the ring wraps the poster, not
     the title/meta below it. The slot is pre-reserved as a transparent border so
     focusing never shifts layout (the card has paint containment, so the ring
     must live inside the card bounds rather than as an outline). The focused
     card's title switches to `--text` (rule lives in card.css, T09); **no scale,
     no box-shadow, no transition**;
   - Buttons/chips (`.focusable-chip`): pill-shaped (`border-radius: 999px`),
     unfocused = opaque `--bg-elev-2` fill; `.focused` = `--focus` background +
     `--focus-text` text (white background, black text, switched instantly);
   - List rows (`.focusable-row`): `.focused` = `--bg-elev-2` background,
     text switches to `--text`.
5. **base.css**:
   - reset + a unified `scroll-margin: 120px var(--safe-x)` for `[data-focus-id]`
     (so a focused item never sits flush against the screen/container edge);
   - a guard rule enforcing the global ban: `*,*::before,*::after { transition:none
     !important; animation:none !important; }` (prevents accidental reintroduction
     later). One sanctioned exception lives outside CSS in `TabBar.jsx`: the tab
     bar's white focus fill (its D-pad cursor) slides between tabs via the Web
     Animations API, which the CSS `transition/animation` ban does not govern —
     a single compositor-cheap `transform`/`width` node, no tab repaint, focus
     engine untouched, and identical to the old solid fill at rest;
   - `img` defaults to `display:block`; a `.cv-auto` utility class
     (`content-visibility:auto; contain:content`) that card components (T09)
     apply to skip layout/paint work for off-screen cards.
6. **Layout / safe area**: `--safe-x: 84px`, `--tabbar-h: 84px`,
   `--content-top: 92px` (bar + 8px), `--content-bottom: 60px`; grid tokens
   `--grid-gap: 20px` and `--card-w` (derived so 6 cards + 5 gaps exactly fill
   `1920 - 2*safe-x`, matching `COLS` in CategoryPage/LibraryPage);
   `--focus-border: 3px`.
7. `index.css` uses `@import` to pull in tokens/base first, then each page's css
   (app/card/home/category/filter/detail/library/player) as those tasks land;
   `main.jsx` imports only `index.css`.

## Explicitly out of scope

- Gradient scrims and ad-hoc translucent overlays — alpha and `backdrop-filter`
  exist only through the `--glass-*` material on chrome surfaces; content that
  needs to darken a background uses opaque sectioned layouts within its own task;
- Any `transition` / `animation` / `@keyframes` / `transform: scale`;
  `box-shadow` on focus states or content surfaces (focus is border-only — the
  sole shadow in the app is the static lift under the tab-bar glass capsule,
  painted once).

## Acceptance criteria

- [ ] A temporary demo page shows all three focus-state types switching, with no
      visible transition or scaling — border/color changes take effect instantly;
- [ ] `grep -E 'transition|animation|@keyframes|opacity'` across the full CSS set
      has no functional hits outside the base.css ban guard (comments aside);
      `rgba(` and `backdrop-filter` appear only in the `--glass-*` token
      definitions and the glass chrome rules that consume them — never on cards,
      grids, or text;
- [ ] every type-scale tier is >=22px at the 1080p viewport.
