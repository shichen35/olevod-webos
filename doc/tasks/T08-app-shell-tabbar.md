# T08 App Shell, Tab Bar, and Back-Navigation Chain

> Milestone B | Prerequisite: T02 T03 | Output: `src/App.jsx`, `src/components/TabBar.jsx`, `src/styles/app.css`

## Goal

Build the "top tab bar + full-width content area" app shell and view stack:
shell (persistent) -> detail overlay -> player overlay, along with a
layer-by-layer back-navigation chain. Pages stay mounted and are hidden with
`display:none`.

## Requirements

1. **View stack**: `shell` (tab bar + each tab's content area) stays mounted;
   when detail/player opens, the shell is set to `display:none`, and
   DetailPage / PlayerPage mount as overlays (use placeholder components for
   now, to be replaced in T13/T16). Switching back does not remount and state
   is preserved.
2. **TabBar**: renders `nav.js`'s TABS as the top row (focus group `tabbar`, row
   0, col = index). Selected state = `--text` colored text, others `--text-2`;
   focus state = white background with black text (per T02's convention).
   Background is **opaque `--bg`** (no gradient scrim; the content area starts
   right below the tab bar with no overlap).
3. **Focus-hover auto tab-switching**: moving focus left/right within the
   tabbar switches the content below it (via `onFocusChange` + a 150ms
   debounce), while focus stays on the tab bar; only Down/Enter moves focus
   into the content area. Enter/click additionally bumps `refreshNonce` to
   force that page to refetch (hover-switching only serves from cache; wired up
   in T15).
4. **Per-tab content areas**: each tab has its own persistent container, hidden
   with `display:none` when inactive; the container is the sole scrollable
   element (`overflow-y:auto`), with scrolling driven by focus's
   `scrollIntoView`.
5. **Back-navigation chain** (listens for `tv-back`): player -> detail ->
   content area (focus returns to tabbar) -> when focus is already on tabbar,
   call `window.webOS?.platformBack?.()` for a native exit, falling back to
   `window.close()`, with **no confirmation prompt**. Overlays' own
   `setCustomKeyHandler` takes priority when intercepting back (already
   supported by the engine from T03).
6. Startup: `main.jsx` awaits `initTvEnv()` before the first frame (resolves
   immediately in the browser); default landing is the Home tab, with focus on
   the Home item in the tabbar.

## Explicitly out of scope

- Real page content (T10-T14); startup prefetching (T15).

## Acceptance criteria

- [ ] moving focus left/right on the tabbar switches the content area below it
      (debounce works, quickly passing through does not flash a load);
- [ ] Down enters the content placeholder area, and Up from the content area's
      top row returns to the tabbar's remembered cell;
- [ ] opening the placeholder detail -> placeholder player, then backing out
      layer by layer, restores focus correctly at each layer;
- [ ] the Profiler shows no re-renders while the shell is hidden; switching tabs
      has no transition animation of any kind.
