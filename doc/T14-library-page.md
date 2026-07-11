# T14 Library page (favorites / history / settings) and confirm dialog

> Milestone B | Depends on: T08 T09 T07 | Deliverables: `src/pages/LibraryPage.jsx`, `src/components/ConfirmDialog.jsx`, `src/styles/library.css`

## Goal

The "我的" (Library) tab: three segments for favorites / history / settings, plus a confirm-dialog component reused across the whole app.

## Implementation requirements

1. **Segment control (row 0)**: chips for "收藏" (Favorites) ｜ "历史" (History) ｜ "设置" (Settings), supporting the same focus-hover
   auto-switch as the tab bar (150ms debounce); the selected state is visually distinct from the focus state.
2. **Favorites / History segments**: each is a 6-column VideoCard grid (row 1 onward), with history cards carrying a
   "看到第N集" badge plus a bottom watch-progress bar; data is subscribed from the store for instant updates; empty state shows
   centered, non-focusable text.
3. **Settings segment**: a single-column grouped list (T02's third focus-state category, rows 1-3 of the content group):
   - "首页显示收藏" and "首页显示最近观看" → Apple-style switches (settings store) that show/hide the home page's
     "My Favorites" and "Continue Watching" shelves;
   - "清除观看历史" → a danger row confirmed via ConfirmDialog.
   The app version renders as a plain non-focusable caption pinned near the bottom of the screen (the build-time
   `__APP_VERSION__` constant) — no separate "About" row.
4. **ConfirmDialog**: a centered frosted-glass rounded card (`--glass-strong` + backdrop blur) with a title + description +
   **full-width stacked buttons** (addressed by row for focus: Cancel = row 0, Confirm = row 1 with a danger tint), defaulting
   focus to "Cancel"; its own `confirm` focus layer, with the back key acting as Cancel (a custom key handler registered for the
   dialog's lifetime). **No backdrop scrim**; the focus-layer mechanism already guarantees the content behind the dialog doesn't
   respond to input.
5. Focus handling after clearing history: the scenario where the previously focused cell disappears is covered by `popFocusLayer`'s
   existing "remembered cell was unmounted, fall back to the layer's first focusable" mechanism (already implemented in T03 — verify it here).

## Explicitly out of scope

- Batch management or sorting of favorites/history;
- Login-related settings.

## Acceptance criteria

- [ ] Switching between the three segments is instant and data is correct; history/favorites changes (favoriting/playing from the
      detail page) are reflected immediately on return;
- [ ] Clearing history: the dialog defaults focus to Cancel, the back key cancels, confirming clears history and the home page's
      "Continue Watching" row disappears, with focus never left dangling;
- [ ] While the dialog is open, the content underneath does not respond to directional keys or OK at all.
