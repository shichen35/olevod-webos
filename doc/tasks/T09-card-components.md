# T09 Content card system (Thumb / VideoCard / Shelf)

> Milestone B | Depends on: T02 T06 | Deliverables: `src/components/{Thumb,VideoCard,Shelf}.jsx`, `src/styles/card.css`

## Goal

The three content-display primitives reused across the whole app: an image component (size suffix + fallback), a poster card (focus state / badges / progress bar), and a horizontal shelf row. This task gets the list-performance rules right once, and every page benefits directly.

## Reference

- Performance rules: skill `.claude/skills/webos-tv-app-skill` §3

## Implementation requirements

1. **Thumb**: `imageUrl(pic, size)` requests a thumbnail size (cards use `384x560`);
   `onError` falls back to the original image URL, and if that also fails, shows a solid-color placeholder block (`--bg-elev` + first letter).
   `loading="lazy"`; fixed width/height to prevent layout jitter.
2. **VideoCard** (`React.memo`): 2:3 poster + title (label type scale) + a meta row
   (caption type scale, `--text-3`); optional badges: rating (`--accent`), "UHD" (`--uhd`),
   "Watched through EPxx"; an optional bottom watch-progress bar (opaque `--accent` solid bar, 6px tall).
   Focus state = the border + title color change defined in T02, **no scale, no shadow, no transition**.
   The card's root element gets `content-visibility:auto; contain:content;` and a set `contain-intrinsic-size`.
3. **Shelf**: a row heading (heading type scale, left-aligned to `--safe-x`) + a single horizontal row of cards
   (`overflow-x:auto`, scrollbar hidden, a bleed at the right edge hints there's more to scroll). Child cards register with
   `useFocusable` into the `{layer,group,row}` specified by the caller, with `col` as the in-row index;
   horizontal scrolling within a row relies on the focus engine's `scrollIntoView inline:'nearest'`.
4. The card's `onSelect` callback is injected from outside (opening detail, etc. is decided by the page); the component itself does not fetch data or contain business logic.
5. Wherever a `ref` needs to be forwarded, pass it directly as a prop (React 19) — no `forwardRef`.

## Explicitly out of scope

- Billboard hero section (not part of this version);
- Skeleton loading animation (loading state uses a static placeholder block).

## Acceptance criteria

- [ ] A demo page renders 3 rows x 12 cards backed by real API data, with smooth focus navigation and no re-renders
      (verified with Profiler that memo works: a parent `setState` does not trigger card re-renders);
- [ ] Image request URLs carry the `_384x560` suffix; the fallback chain works on broken images with no broken-image icon;
- [ ] Cards at the right edge of a row are clipped by the viewport (bleed effect); focusing the rightmost card auto-scrolls horizontally without hugging the edge;
- [ ] Badges/progress bar show or hide correctly based on props.
