# T12 Filter panel (region / year / sort)

> Milestone B | Depends on: T11 | Deliverables: `src/components/FilterPanel.jsx`, `src/styles/filter.css`

## Goal

The panel invoked by the category page's "筛选" button, fixed to the right edge: three chip groups for region / year / sort +
reset / done, on its own focus layer, applying selections immediately.

## Implementation requirements

1. **Visuals**: a fixed-width panel on the right (600px @1080p), a frosted-glass sheet
   (`--glass-strong` fill + backdrop blur + a `--glass-edge` hairline left border — a sanctioned chrome
   surface per T02's glass exception); scrolls internally when tall;
   no slide-in animation (it's in place as soon as it opens), no scrim over the content underneath (it shows through as-is; since
   focus isn't on it, there's no risk of accidental input).
2. **Focus layer**: opening calls `pushFocusLayer('filter')` and lands focus on `filter/panel-0-0`; closing (on unmount) calls `popFocusLayer()`, which automatically
   restores focus to the "筛选" button. Inside the panel, everything lives in the `panel` group. The chips flow in a
   `flex-wrap` container, so how many sit on a visual row depends on their pixel widths rather than a fixed column count;
   directional movement is therefore **spatial**, not arithmetic — the layer's `setCustomKeyHandler` reads the chips' live
   layout on each key press and moves to the nearest chip in the pressed direction (up/down step to the adjacent row and
   keep the closest horizontal center; left/right walk the wrapped row and, at a row edge, wrap onward — Right past the
   last chip lands on the next row's first, Left past the first lands on the previous row's last). The bottom "重置 / 完成"
   buttons are just the last row the same navigation reaches.
3. **Behavior**: selecting a chip applies immediately — the change flows through the app shell's per-category
   filter override into CategoryPage, which refreshes using T11's token mechanism; "重置" restores
   that category's default filters (all dimensions, including the genre chip, back to "All" + default sort); "完成" and the back key (intercepted via `setCustomKeyHandler`) both close the panel.
4. Option data comes from that category's `areas` / `years` in `taxonomy.js` plus the shared `SORTS`; the currently selected option is highlighted
   (an `--accent` indicator dot + `--accent` text, distinct from the focus state's white fill, which still wins while focused).
5. Filter changes are written to `store/filters` in sync (the shell's apply handler records the session selection and pushes the override in one step — confirm the linkage here). That store is in-memory only, so it just keeps the panel opening on what the page currently shows; nothing survives a restart.

## Explicitly out of scope

- First-letter filtering (supported by the API but not part of the product);
- Multi-select (each dimension is single-select).

## Acceptance criteria

- [ ] Focus enters/exits the panel without loss: opening lands focus on the panel's first cell, closing returns focus to the "筛选" button;
- [ ] While the panel is open, directional keys don't affect the grid underneath; the back key closes the panel rather than leaving the page;
- [ ] Selecting a region/year/sort option refreshes the list immediately and the summary text (next to the "筛选" button in FilterBar) updates in sync;
- [ ] "重置" restores the list and summary to defaults; restarting the app comes back up on the default filter, not the last selection.
