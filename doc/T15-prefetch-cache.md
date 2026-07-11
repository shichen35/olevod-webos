# T15 Startup prefetch and tab refresh

> Milestone B | Depends on: T10 T11 | Deliverables: shared feed loaders + `prefetchAll` in `src/api/feeds.js`, prefetch kickoff and `refreshNonce` wiring in `App.jsx`, nonce consumption on each page

## Goal

"Zero loading" when switching tabs: after startup, prefetch each tab's data into `pageCache` in the background; pressing Enter
on a tab forces a refresh. This task consolidates the caching strategy that's otherwise scattered across pages into one
independently verified feature.

## Implementation requirements

1. **Sequential prefetch**: once App mounts, `prefetchAll` first loads the home page's three popular-content rows (fetched
   together via `Promise.allSettled` but cached as one unit under the `home:popular` key), then each category's first-screen
   slice one at a time (`loadCategoryFirstPage`: page 1 for that category's current filter-dimension key,
   `cat:{id}:{genre}:{area}:{year}:{sort}:p1`). The category prefetches run **sequentially** — concurrent signed requests would
   starve each other (confirmed by testing) — and a `shouldStop()` predicate is checked between categories so App unmount
   aborts the loop.
2. Prefetching goes through `pageCache.loadOnce` using the same loaders and keys as the pages (both call into
   `src/api/feeds.js`), which naturally de-dupes against a page's own data fetching (first request wins, later ones just hit the cache).
3. **Refresh semantics**: pressing Enter or clicking a tab in the tab bar bumps that tab's `refreshNonce` → the page calls
   `invalidate` on the matching cache prefix (`home:` / `cat:{id}:`) and refetches **without blanking** — the old content stays
   on screen until the new data lands; switching tabs via focus-hover only reads the cache and does not refresh.
4. Prefetch failures are silent (when the page is actually opened, it goes through its own loading/retry path) — the user is never bothered.
5. Prefetch tasks can be interrupted: if the user has already entered a given category, that category's own data fetch shares the
   same `loadOnce` as the prefetch.

## Explicitly out of scope

- Timed soft refresh (e.g. expiring after 10 minutes — flagged as an on-device observation item);
- Persisting the page cache.

## Acceptance criteria

- [ ] On a cold start, staying on the home page for ~5s, then switching through the Movies/Variety/TV Series tabs in sequence:
      all render instantly with no spinner;
- [ ] The Network panel confirms category prefetch requests fire one at a time (only the home rows go out together) and don't
      duplicate the page's own data requests;
- [ ] Pressing Enter on a category tab: that page refetches (a new request appears in Network), and the old content stays in
      place until the new data lands (no blank flash);
- [ ] Switching tabs via hover produces no new requests.
