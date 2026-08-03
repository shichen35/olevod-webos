# T11 Category page: subtype filter + grid + infinite scroll

> Milestone B | Depends on: T08 T09 | Deliverables: `src/pages/CategoryPage.jsx`, `src/components/FilterBar.jsx`, `src/styles/category.css`

## Goal

A category page shared by Movies/Variety/TV Series: a subtype-chip filter header + a 6-column poster grid + infinite scroll.
One component is instantiated three times, configured by `taxonomy`.

## Reference

- Endpoint: `categoryList()` in `app/src/api/olevod.js` (server-side filtering and pagination; the server returns `items` + `total`)

## Implementation requirements

1. **FilterBar**: two lines — a horizontally scrollable strip of subtype chips (`全部` + taxonomy genres,
   scrollbar hidden; selected chip = `--accent` text, distinct from focus), then a "筛选" button on its own
   line (opens the panel in T12) with a non-focusable current-filter summary next to it
   (e.g. "美国 · 2025 · 最热", `--text-3`; "All" segments are omitted). Selecting a chip applies immediately (server-side filtering).
2. **Focus addressing**: FilterBar occupies rows 0-1 of the page's content group (`FILTER_ROWS=2`:
   genre chips on row 0, the filter button line on row 1); cards start at
   row 2 — directional navigation flows from the filter rows down into the cards with no cross-group special casing.
3. **Grid**: `COLS=6`, `PAGE_SIZE=24`, 2:3 poster cards (T09's VideoCard) on a
   `repeat(6, minmax(0,1fr))` CSS grid spanning the full content width.
4. **Infinite scroll**: an `IntersectionObserver` watches a 1px sentinel below the grid against the tab's
   scroll container, with a 900px bottom `rootMargin` (about one screen of lookahead); when it intersects, the next page is fetched and appended
   (`total` is sent by the server; once fully loaded, shows a static "已加载全部 N 部" status row, not focusable).
   No pagination buttons.
5. **In-flight request invalidation**: a monotonically increasing `genRef` token — changing the filter bumps the token; when an
   awaited request (first page or load-more) returns and finds itself superseded, it's discarded, preventing a stale filter's results from overwriting a newer filter's.
6. **Caching**: each category's first-page slice is keyed by filter dimensions into `pageCache`
   (`cat:{id}:{genre}:{area}:{year}:{sort}:p1`, via `api/feeds.js`'s `loadCategoryFirstPage`). The page always opens at the
   category's default filter — the selection is held in `store/filters` for the session only, never persisted, so a launch can
   never land on a stale 地区/年代 choice the tab bar gives no hint of. On load failure, show a focusable "加载失败，重试" chip.
   A `refreshNonce` bump (tab Enter, T15) invalidates the `cat:{id}:` prefix and refetches without blanking the current grid.
7. All three category instances stay mounted once first activated (toggled via `display:none`); each instance registers
   into its own per-tab focus group (`content:{tabKey}`, passed down as the `group` prop), so row/column numbers are reused
   independently without conflict, and the tab bar's Down bridge targets the active tab's group.

## Explicitly out of scope

- Region/year/sort panel (T12);
- DOM "head trimming" for very long browsing sessions (flagged as an on-device observation item, T25).

## Acceptance criteria

- [ ] Each of the three category pages renders its own 6-column grid, and switching a chip refreshes the subtype list from the server accordingly;
- [ ] Continuously scrolling down auto-loads until the last page, showing "已加载全部 N 部", with no pagination buttons and no animation throughout;
- [ ] Rapidly switching chips in succession never shows a stale result overwriting a newer one (verify with the token mechanism: artificially add a random delay to requests to test);
- [ ] Restarting the app restores the last-used filter; leaving and returning to the category page renders instantly.
