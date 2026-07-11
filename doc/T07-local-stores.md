# T07 Local Persistence and Page Cache

> Milestone A | Prerequisite: T01 | Output: `src/store/{favorites,history,settings,filters,pageCache}.js`, `src/hooks/useStore.js`

## Goal

A local persistence layer: localStorage read/write plus change subscriptions,
consumed on the React side via `useSyncExternalStore`. Once running on the real
device, this is the single point where storage swaps to Luna file I/O
(`/media/internal/...`), with the external API unchanged.

## Requirements

1. **Common skeleton**: `createStore(key, defaultValue)` (in `useStore.js`)
   returns `{ get, set, subscribe }`; each store keeps an in-memory snapshot
   plus a listener set. A write REPLACES the snapshot reference (never mutates
   in place), persists to localStorage, and notifies subscribers; `set` accepts
   a value or an updater function and skips the write when the reference is
   unchanged. On read failure (corrupt JSON, storage unavailable), fall back to
   the default value; on write failure (quota exceeded, storage disabled), keep
   working from memory for the session. localStorage keys are namespaced
   `olevod:*` (`olevod:favorites` / `olevod:history` / `olevod:settings` /
   `olevod:filters`). Provide `useStoreValue(store, selector)`, built on
   **`useSyncExternalStore`** (the React 19 idiomatic approach). Note that
   `getSnapshot` must return a stable reference (the snapshot object is only
   replaced on write) to avoid infinite re-renders — so a selector must pick,
   not compute (derive with `useMemo` in the component instead).
2. **favorites**: `list()` / `has(id)` / `toggle(item)`, with the most recently
   favorited item first (`toggle` adds to the front if absent, removes if
   present, and returns the new state).
3. **history**: recently-watched list (capped at 40, most recent first), each
   entry carrying resume progress
   `watch: { lastEpisodeIndex, position, duration }`. API: `list()`,
   `recordHistory(item)` (bump to front, preserving any existing progress),
   `recordProgress(id, lastEpisodeIndex, position, duration)` (update progress
   and bump to front, adding the title if it isn't in history yet),
   `getWatchState(id)`, `clear()`. Shared by the home page's "Continue
   Watching" progress bar, the detail page's "Continue Watching Episode N", and
   the player's resume feature.
4. **settings**: this version only stores the home-page shelf toggles
   `homeShowFavorites` ("我的收藏" row) and `homeShowRecent` ("继续观看" row),
   both defaulting to `true`. **Do not add appearance toggles like
   `reduceMotion` / `disableGlass`** — the app has no animation or frosted glass
   anywhere, so such toggles would be meaningless. Backed by `DEFAULTS`, with
   `getSetting(snapshot, key)` (falls back to the default when a persisted
   snapshot predates a key) and `toggleSetting(key)`.
5. **filters**: the most recent filter selection per category,
   `{ [categoryId]: {genre,area,year,sort} }`, restored on startup;
   `getFilter(categoryId)` / `setFilter(categoryId, selection)`.
6. **pageCache**: an **in-memory** (non-persisted), session-scoped page-data
   cache — a plain module, not a `createStore` instance; `loadOnce(key, loader)`
   dedupes concurrent fetches for the same key on a shared in-flight promise
   (failures are not cached, so a retry is possible), `get(key)` / `has(key)`
   read a cache hit synchronously, `invalidate(prefix)` drops matching cached
   and in-flight entries to support refresh, and `clear()` empties everything.

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
