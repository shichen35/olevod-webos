# T10 Home page shelves

> Milestone B | Depends on: T08 T09 T07 | Deliverables: `src/pages/HomePage.jsx`, `src/styles/home.css`

## Goal

The app's default landing screen: horizontal shelves for "Continue Watching / My Favorites / Popular Movies · Variety · TV Series",
with dynamic row layout and empty rows skipped.

## Implementation requirements

1. **Row list and order**: Continue Watching (first 12 from history, cards carry a "Watched through EPxx" badge + progress bar) →
   My Favorites (first 12 from favorites) → Popular Movies / Popular Variety / Popular TV Series
   (each section via `categoryList({sort:'hot', size:12})`). Empty rows are not rendered at all,
   and **row numbers (focus row) are assigned consecutively in actual render order**, so up/down navigation stays continuous by ±1.
2. **Data fetching**: only the three popular-content rows hit the network — via `Promise.allSettled` concurrently; a single category's failure only leaves that one row empty.
   Continue Watching / Favorites come from the store (subscribed via `useSyncExternalStore`, so returning to home after playback reflects instantly).
3. **Caching**: popular-content data is cached keyed via `pageCache.loadOnce` — switching tabs and back renders instantly with no
   spinner; `refreshNonce` (tab Enter, wired in T15) invalidates the cache and forces a refetch.
4. **All-failed state**: when all three network rows fail, show centered error text + a focusable "Retry" button.
5. Card `onSelect` → opens the detail overlay (before T13 exists, use console/placeholder).
6. Loading state: static "Loading..." text (no spinner animation).

## Explicitly out of scope

- Billboard hero section and auto-carousel (not part of this version);
- A mixed "Newly Added" row.

## Acceptance criteria

- [ ] On a cold start into the home page: the three popular rows render images; when there's no history/favorites the corresponding
      rows disappear and up/down navigation remains continuous;
- [ ] After watching part of a show (history data can be hand-seeded first), "Continue Watching" appears at the top,
      with the correct badge and progress bar;
- [ ] Starting with no network shows a "Retry" button; restoring network and pressing OK reloads successfully;
- [ ] Leaving and returning to the home page renders instantly (no loading flicker).
