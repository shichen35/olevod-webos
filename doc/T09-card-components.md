# T09 Content card system (Thumb / VideoCard / Shelf)

> Milestone B | Depends on: T02 T06 | Deliverables: `src/components/{Thumb,VideoCard,Shelf}.jsx`, `src/styles/card.css`

## Goal

The three content-display primitives reused across the whole app: an image component (size suffix + fallback), a poster card (focus state / badges / progress bar), and a horizontal shelf row. This task gets the list-performance rules right once, and every page benefits directly.

## Reference

- Performance rules: skill `.claude/skills/webos-tv-app-skill` §3

## Implementation requirements

1. **Thumb**: a three-stage fallback chain — `imageUrl(pic, size)` requests a
   sized thumbnail (cards use the default `384x560`); `onError` steps to the original
   image URL, and if that also fails (or `pic` is empty), a solid-color placeholder block
   (`--bg-elev` + the title's first letter). `loading="lazy"`; the image fills its
   fixed-aspect poster container (`object-fit:cover`) so nothing jitters while loading.
2. **VideoCard** (`React.memo`): 2:3 poster + title (label type scale) + a meta row of
   year + remarks (caption type scale, `--text-3`); optional badges: rating (`--accent`
   text, shown when `item.score > 0`), "UHD" (`--uhd` fill, derived from `item.remarks`
   matching 4K/UHD/蓝光), "看到第N集" (from the `watchedEp` prop); an optional bottom
   watch-progress bar (opaque `--accent` fill on a `--bg-elev-2` track, 6px tall, driven
   by the `progress` prop). Focus state = the T02 convention: the focus ring wraps
   **only the poster** (`.focusable-card .card-poster` border), plus the title color
   change — **no scale, no shadow, no transition**. The card's root gets
   `content-visibility:auto; contain:content;` and a set `contain-intrinsic-size`
   (in card.css). The memo comparator compares by value and **ignores function props**:
   the focus engine reads `onSelect` from a ref, so a new closure from the parent must
   not re-render the card.
3. **Shelf**: a row heading (heading type scale) + a single horizontal row of cards
   (`overflow-x:auto`, scrollbar hidden; exactly 6 cards fill the content width, so the
   row rests symmetric and overflowing cards clip at the row's edge). Renders nothing
   when `items` is empty. Child cards register with `useFocusable` into the
   `{layer,group,row}` specified by the caller, with `col` as the in-row index;
   horizontal scrolling within a row relies on the focus engine's
   `scrollIntoView inline:'nearest'`.
4. The card's `onSelect` callback is injected from outside (Shelf's `onSelectItem`;
   opening detail, etc. is decided by the page), and a `cardExtras(item)` hook lets a
   page inject per-card props (e.g. Continue Watching passing `watchedEp` + `progress`);
   the components themselves do not fetch data or contain business logic.
5. Wherever a `ref` needs to be forwarded, pass it directly as a prop (React 19) — no
   `forwardRef` (`useFocusable` returns its `ref` inside a spreadable `props` object).

## Explicitly out of scope

- Billboard hero section (not part of this version);
- Skeleton loading animation (loading state uses a static placeholder block).

## Acceptance criteria

- [ ] A page renders 3 rows x 12 cards backed by real API data, with smooth focus navigation and no re-renders
      (verified with Profiler that memo works: a parent `setState` does not trigger card re-renders);
- [ ] Image request URLs carry the appended `_384x560` size suffix; the fallback chain works on broken images with no broken-image icon;
- [ ] Cards past the sixth are clipped at the row's right edge; focusing the rightmost card auto-scrolls horizontally without hugging the edge;
- [ ] The focus ring wraps only the poster, never the title/meta below it, and focusing never shifts layout;
- [ ] Badges/progress bar show or hide correctly based on props.
