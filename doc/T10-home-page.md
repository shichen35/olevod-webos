# T10 Home page shelves

> Milestone B | Depends on: T08 T09 T07 | Deliverables: `src/pages/HomePage.jsx`, `src/styles/home.css`

## Goal

The app's default landing screen: horizontal shelves for "Continue Watching / My Favorites / Popular Movies · Variety · TV Series",
with dynamic row layout and empty rows skipped.

## Implementation requirements

1. **Row list and order**: Continue Watching (first 12 history entries with actual watch
   progress, cards carry a "看到第N集" badge + progress bar via Shelf's `cardExtras`) →
   My Favorites (first 12 from favorites) → Popular Movies / Popular Variety / Popular TV Series
   (each section via `categoryList({sort:'hot', size:12})`, assembled in `api/feeds.js`'s
   `loadHomePopular`). Empty rows are not rendered at all,
   and **row numbers (focus row) are assigned consecutively in actual render order**, so up/down navigation stays continuous by ±1.
2. **Settings toggles**: the two local shelves can each be switched off in Settings —
   `homeShowRecent` (Continue Watching) and `homeShowFavorites` (My Favorites) in
   `store/settings.js`, read through `getSetting()` (so older persisted snapshots fall
   back to the defaults, both on). A disabled shelf is simply absent and row numbering
   stays continuous.
3. **Data fetching**: only the three popular-content rows hit the network — via `Promise.allSettled` concurrently; a single category's failure only leaves that one row empty.
   Continue Watching / Favorites / settings come from the stores (subscribed via `useStoreValue` on `useSyncExternalStore`, so returning to home after playback reflects instantly).
4. **Caching**: the three popular rows are cached as one unit under the `home:popular`
   key via `pageCache.loadOnce` — switching tabs and back renders instantly with no
   spinner; `refreshNonce` (tab Enter, wired in T15) invalidates the `home:` cache prefix and refetches
   **without blanking** (the old rows stay on screen until the new data lands).
5. **All-failed state**: when no row has content after the network rows resolve, show centered error text + a focusable "Retry" button (Retry invalidates the cache and reloads from a blank loading state).
6. Card `onSelect` → `onOpenDetail(item.id)` opens the detail overlay (T13).
7. Shelf rows are registered as row-cursor groups (`setRowCursorGroup`): entering a
   shelf vertically lands on that row's remembered column (first card if never
   visited) instead of carrying the column across rows.
8. Loading state: static "加载中…" text (no spinner animation).

## Explicitly out of scope

- Billboard hero section and auto-carousel (not part of this version);
- A mixed "Newly Added" row.

## Acceptance criteria

- [ ] On a cold start into the home page: the three popular rows render images; when there's no history/favorites — or the
      corresponding shelf is switched off in Settings — those rows disappear and up/down navigation remains continuous;
- [ ] After watching part of a show (history data can be hand-seeded first), "Continue Watching" appears at the top,
      with the correct badge and progress bar;
- [ ] Starting with no network shows a "Retry" button; restoring network and pressing OK reloads successfully;
- [ ] Leaving and returning to the home page renders instantly (no loading flicker).
