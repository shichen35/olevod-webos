# T11 Category page: subtype filter + grid + infinite scroll

> Milestone B | Depends on: T08 T09 | Deliverables: `src/pages/CategoryPage.jsx`, `src/components/FilterBar.jsx`, `src/styles/category.css`

## Goal

A category page shared by Movies/Variety/TV Series: a single row of subtype chips + a 6-column poster grid + infinite scroll.
One component is instantiated three times, configured by `taxonomy`.

## Reference

- Endpoint spec: [doc/olevod-api.md](../olevod-api.md) §4.3 (server-side filtering and pagination)

## Implementation requirements

1. **FilterBar**: a single row of subtype chips (`All` + taxonomy genres, horizontally scrollable) +
   a "Filter" button at the row's end (opens the panel in T12) + a non-focusable current-filter summary on the right
   (e.g. "USA · 2025 · Most Popular", `--text-3`). Selecting a chip applies immediately (server-side filtering).
2. **Focus addressing**: FilterBar occupies row 0 of the `content` group (`FILTER_ROWS=1`); cards start at
   row 1 — directional navigation flows from the filter row down into the cards with no cross-group special casing.
3. **Grid**: `COLS=6`, `PAGE_SIZE=24`, 2:3 poster cards (T09's VideoCard).
4. **Infinite scroll**: watches the content area's scroll position; once less than one screen remains to the bottom, prefetches
   the next page and appends it (`total` is sent by the server; once fully loaded, shows a static "Loaded all N titles" status row, not focusable).
   No pagination buttons.
5. **In-flight request invalidation**: a monotonically increasing `genRef` token — changing the filter bumps the token; when an
   awaited request returns and finds itself superseded, it's discarded, preventing a stale filter's results from overwriting a newer filter's.
6. **Caching and restore**: each category's first-page slice is keyed by filter dimensions into `pageCache`; the most recent filter is stored in
   `store/filters` and restored on next launch. On load failure, show a focusable "Retry".
7. All three category instances stay mounted (toggled via `display:none`); row/column numbers are reused independently within each
   container without conflict (the focus engine only navigates within the visible layer).

## Explicitly out of scope

- Region/year/sort panel (T12);
- DOM "head trimming" for very long browsing sessions (flagged as an on-device observation item, T25).

## Acceptance criteria

- [ ] Each of the three category pages renders its own 6-column grid, and switching a chip refreshes the subtype list from the server accordingly;
- [ ] Continuously scrolling down auto-loads until the last page, showing "Loaded all N titles", with no pagination buttons and no animation throughout;
- [ ] Rapidly switching chips in succession never shows a stale result overwriting a newer one (verify with the token mechanism: artificially add a random delay to requests to test);
- [ ] Restarting the app restores the last-used filter; leaving and returning to the category page renders instantly.
