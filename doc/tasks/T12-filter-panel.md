# T12 Filter panel (region / year / sort)

> Milestone B | Depends on: T11 | Deliverables: `src/components/FilterPanel.jsx`, `src/styles/filter.css`

## Goal

The panel invoked by the category page's "Filter" button, sliding in from the right: three chip groups for region / year / sort +
reset / done, on its own focus layer, applying selections immediately.

## Implementation requirements

1. **Visuals**: a fixed-width panel on the right (about 560px @1080p), with an **opaque `--bg-elev`** background;
   no slide-in animation (it's in place as soon as it opens), no left-edge gradient dimming (the content underneath shows through as-is; since
   focus isn't on it, there's no risk of accidental input).
2. **Focus layer**: opening calls `pushFocusLayer('filter')`, closing calls `popFocusLayer()`, which automatically
   restores focus to the "Filter" button. Inside the panel, the three chip groups + the bottom "Reset / Done" buttons are addressed row by row.
3. **Behavior**: selecting a chip applies immediately (the list refreshes on selection, using T11's token mechanism); "Reset" restores
   that category's default filters; "Done" and the back key (intercepted via `setCustomKeyHandler`) both close the panel.
4. Option data comes from that category's config in `taxonomy.js`; the currently selected option is highlighted (an `--accent` indicator dot or
   a selected background, distinct from the focus state).
5. Filter changes are written to `store/filters` in sync (already wired in T11 — confirm the linkage here).

## Explicitly out of scope

- First-letter filtering (supported by the API but not part of the product);
- Multi-select (each dimension is single-select).

## Acceptance criteria

- [ ] Focus enters/exits the panel without loss: opening lands focus on the panel's first cell, closing returns focus to the "Filter" button;
- [ ] While the panel is open, directional keys don't affect the grid underneath; the back key closes the panel rather than leaving the page;
- [ ] Selecting a region/year/sort option refreshes the list immediately and the summary text (right side of FilterBar) updates in sync;
- [ ] "Reset" restores the list and summary to defaults; restarting the app restores the selected filters.
