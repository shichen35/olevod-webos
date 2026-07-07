# T02 Design Tokens and Global Style Baseline

> Milestone A | Prerequisite: T01 | Output: `src/styles/tokens.css`, `src/styles/base.css`, `src/styles/index.css`

## Goal

Establish the global design system: an opaque solid-color palette, a 10-foot-readable
type scale, and safe-area and focus-state conventions. This is where the "no frosted
glass / no translucency / no animation" constraint is enforced; every page style
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
2. **Palette (all opaque hex, no rgba/opacity layering)**:
   - `--bg: #0e0e11` (global background), `--bg-elev: #1c1c21` (panels/dialogs),
     `--bg-elev-2: #2a2a31` (unfocused button/chip background);
   - three fixed grayscale text tiers: `--text: #f5f5f7`, `--text-2: #9d9da3`,
     `--text-3: #6b6b72` (no white-with-opacity layering);
   - `--accent: #23c8b6` used only for progress bars/ratings/selection indicators;
     `--uhd: #ffcf6b` for the "UHD" badge;
   - `--focus: #f5f5f7` (focus border/fill).
3. **Type scale** (actual 1080p values, minimum 22px): display 60 / title 45 /
   heading 32 / body 26 / label 24 / caption 22, mapped to `--fs-*` tokens. Font
   family: the system-ui stack.
4. **Focus-state conventions** (defined once globally, reused as classes by every
   component):
   - Cards: `.focused` = a 3px opaque `--focus` border (use `outline` or a
     pre-reserved border slot to avoid layout shift), title switches to `--text`;
     **no scale, no box-shadow, no transition**;
   - Buttons/chips: `.focused` = `--focus` background + `#111` text (white
     background, black text, switched instantly);
   - List rows: `.focused` = `--bg-elev-2` background.
5. **base.css**:
   - reset + a unified `scroll-margin` for `[data-focus-id]` (so a focused item
     never sits flush against the screen/container edge);
   - a guard rule enforcing the global ban: `*,*::before,*::after { transition:none
     !important; animation:none !important; }` (prevents accidental reintroduction
     later);
   - `img` defaults to `display:block`; card container classes get
     `content-visibility:auto; contain:content`.
6. **Safe area**: `--safe-x: 84px`, tab bar height 84, content start offset 108,
   bottom padding 60.
7. `index.css` uses `@import` to pull in tokens/base plus each page's css;
   `main.jsx` imports only `index.css`.

## Explicitly out of scope

- Gradient scrims, `backdrop-filter`, translucent overlays — pages that need to
  darken a background should use opaque sectioned layouts within their own task;
- Any `transition` / `animation` / `@keyframes` / `box-shadow` / `transform: scale`.

## Acceptance criteria

- [ ] A temporary demo page shows all three focus-state types switching, with no
      visible transition or scaling — border/color changes take effect instantly;
- [ ] `grep -E 'rgba|opacity|transition|animation|backdrop|box-shadow'` across the
      full CSS set has no hits (`opacity` is only allowed at 0, and only outside of
      the image placeholder loading state);
- [ ] every type-scale tier is >=22px at the 1080p viewport.
