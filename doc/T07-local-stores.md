# T07 Local Persistence and Page Cache

> Milestone A | Prerequisite: T01 | Output: `src/store/{favorites,history,settings,filters,pageCache}.js`, `src/hooks/useStore.js`

## Goal

A local persistence layer: localStorage read/write plus change subscriptions,
consumed on the React side via `useSyncExternalStore`. Once running on the real
device, this is the single point where storage swaps to Luna file I/O
(`/media/internal/...`), with the external API unchanged.

## Requirements

1. **Common skeleton**: each store keeps an in-memory snapshot plus
   `subscribe(listener)`; a write updates the snapshot, writes to localStorage,
   and notifies subscribers. On read failure (corrupt JSON, quota exceeded),
   fall back to the default value. Provide `useStoreValue(store, selector)`,
   built on **`useSyncExternalStore`** (the React 19 idiomatic approach). Note
   that `getSnapshot` must return a stable reference (the snapshot object is
   only replaced on write) to avoid infinite re-renders.
2. **favorites**: `list()` / `has(id)` / `toggle(item)`, with the most recently
   favorited item first.
3. **history**: recently-watched list (capped at 40, most recent first) plus
   resume progress `{ lastEpisodeIndex, position, duration }`. API:
   `recordHistory(item)`, `recordProgress(id, epIndex, position, duration)`,
   `getWatchState(id)`, `clear()`. Shared by the home page's "Continue
   Watching" progress bar, the detail page's "Continue Watching Episode N", and
   the player's resume feature.
4. **settings**: this version only stores `playerHintShown` (whether the
   player's first-use hint has been shown). **Do not add appearance toggles like
   `reduceMotion` / `disableGlass`** — the app has no animation or frosted glass
   anywhere, so such toggles would be meaningless. Backed by `DEFAULTS`, with
   `getSetting` / `setSetting`.
5. **filters**: the most recent filter selection per category,
   `{ [categoryId]: {genre,area,year,sort} }`, restored on startup.
6. **pageCache**: an **in-memory** (non-persisted), session-scoped page-data
   cache; `loadOnce(key, loader)` dedupes concurrent fetches, `get(key)` reads a
   cache hit synchronously, and `invalidate(prefix)` supports refresh.

## Explicitly out of scope

- The Luna file I/O implementation (to be done later on-device if needed; this
  task only guarantees the API surface);
- Any UI.

## Acceptance criteria

- [ ] Console testing confirms read/write/subscribe/default-fallback behavior
      for all five stores; after a page refresh, favorites/history/settings/filters
      persist while pageCache is cleared;
- [ ] two components subscribed to the same store: a write in one updates the
      other immediately with no extra re-renders (confirming `getSnapshot`
      reference stability);
- [ ] when a mocked `localStorage` write throws, the app doesn't crash and the
      in-memory state keeps working.
