# T08 App Shell, Tab Bar, and Back-Navigation Chain

> Milestone B | Prerequisite: T02 T03 | Output: `src/App.jsx`, `src/components/TabBar.jsx`, `src/styles/app.css`

## Goal

Build the "top tab bar + full-width content area" app shell and view stack:
shell (persistent) -> detail overlay -> player overlay, along with a
layer-by-layer back-navigation chain. Pages stay mounted and are hidden with
`display:none`.

## Requirements

1. **View stack**: a `stack` state array (`shell` at the bottom) drives the
   layers. The shell (tab bar + each tab's content area) stays mounted for the
   whole session; when detail/player opens, whatever is beneath the top frame
   is hidden with `display:none` (DetailPage stays mounted underneath the
   player, so backing out restores it with state intact). PlayerPage (T16) is
   the one `lazy()` page — its chunk (and hls.js) stays out of the startup
   bundle, and it genuinely unmounts on back so playback stops. A second OK
   while the player frame is already on top is ignored (the lazy chunk takes a
   beat to mount).
2. **TabBar**: renders `nav.js`'s TABS as the top row (focus group `tabbar`, row
   0, col = index, in the shell's `home` focus layer). The bar itself is fully
   transparent; the tabs sit in a centered frosted-glass capsule
   (`.tabbar-glass`: `--glass-bg` fill + backdrop blur + `--glass-edge`
   hairline rim, the sanctioned glass exception from T02). Selected tab =
   `--text` colored text on a `--glass-active` pill, others `--text-2`;
   focus state = solid `--focus` white fill with `--focus-text` dark text
   (focus wins over selected). Content scrolls **underneath** the translucent
   bar; the global 120px `scroll-margin` keeps focused elements clear of it.
3. **Focus-hover auto tab-switching**: moving focus left/right within the
   tabbar switches the content below it (via `onFocusChange` + a 150ms
   debounce), while focus stays on the tab bar; only Down/Enter moves focus
   into the content area. Enter/click additionally bumps that tab's entry in
   the per-tab `refreshNonce` map to force the page to refetch
   (hover-switching only serves from cache; wired up in T15).
4. **Per-tab content areas**: each tab has its own persistent container
   (`.tab-content`), hidden with `display:none` when inactive; a tab mounts on
   first activation and then stays mounted (state/scroll survive). The
   container is the sole scrollable element (`overflow-y:auto`, top padding
   `--content-top` so the resting position sits below the bar), with scrolling
   driven by focus's `scrollIntoView`. Each tab's content registers into its
   own focus group `content:{tabKey}` so focus ids never collide across
   mounted tabs; the shell calls `setActiveContentGroup` so the tabbar's Down
   bridge always targets the active tab's group.
5. **Back-navigation chain** (listens for `tv-back`): player -> detail ->
   content area (focus returns to the tabbar cell of the active tab) -> when
   focus is already on the tabbar, call `exitApp()` (`src/api/luna.js`), which
   uses `window.webOS?.platformBack?.()` for a native exit and falls back to
   `window.close()`, with **no confirmation prompt**. Overlays' own
   `setCustomKeyHandler` takes priority when intercepting back (already
   supported by the engine from T03).
6. Startup: `main.jsx` awaits `initTvEnv()` before the first frame (resolves
   immediately in the browser); default landing is the Home tab, with focus on
   `home/tabbar-0-0` (the Home item in the tabbar).

## Explicitly out of scope

- Real page content (T10-T14); startup prefetching (T15) — the shell only
  hosts the `prefetchAll` kickoff and the per-tab `refreshNonce` plumbing;
- Filter panel internals (T12) — the shell only owns its open/close state and
  the per-category filter overrides it pushes into CategoryPage.

## Acceptance criteria

- [ ] moving focus left/right on the tabbar switches the content area below it
      (debounce works, quickly passing through does not flash a load);
- [ ] Down enters the active tab's content area, and Up from the content area's
      top row returns to the tabbar's remembered cell;
- [ ] opening detail -> player, then backing out
      layer by layer, restores focus correctly at each layer;
- [ ] the Profiler shows no re-renders while the shell is hidden; switching tabs
      has no transition animation of any kind.
