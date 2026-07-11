# T03 Zero-Rerender D-pad Focus Engine

> Milestone A | Prerequisite: T01 | Output: `src/hooks/useFocus.js`

## Goal

Build the remote-control focus system from scratch: focus movement only toggles a
DOM class and calls `scrollIntoView`, with zero React re-renders. This is the most
critical piece of infrastructure in the whole app — once its interface is settled,
every later task depends on it.

## Reference

- Skill: `.claude/skills/webos-tv-app-skill` §2 and `reference/focus-system.md`

## Requirements

1. **Addressing and registration**: `data-focus-id="{layer}/{group}-{row}-{col}"`;
   a module-level `Map` registry of `id -> { layer, group, row, col, onSelect,
   onFocusChange }`. The `useFocusable({layer,group,row,col,onSelect,onFocusChange})`
   hook (defaults: `layer:'home'`, `group:'content'`, `row:0`, `col:0`) registers
   on mount and unregisters on unmount, returning `{ id, isFocused, props }` —
   `props` (`ref`, `data-focus-id`, `onClick`, `onMouseEnter`) is spread onto the
   DOM element, and `isFocused` is a render-time snapshot only (not reactive).
   Callbacks are stored in a `useRef` and invoked through a stable wrapper —
   **a changed callback never triggers re-registration**, which avoids stale
   closures and effect-dependency loops. Unmount deliberately does **not** clear
   the current focus id: a focused element can transiently unmount/remount
   (re-render, StrictMode) and the re-register + self-heal restore it; a
   genuinely removed cell is handled by the stale-focus fallback below.
2. **O(1) grid navigation**: arrow keys do arithmetic on `{row,col}` plus a
   registry `.has()` probe, never iterating the whole registry. On a missing
   column, fall back to the nearest column (bounded probing, `PROBE_LIMIT` 32).
   Horizontal movement is within-group only. If the current focus record is gone
   or not in the active layer (stale focus), land on the active layer's
   remembered cell, else its first cell, instead of dead-ending.
3. **Focus layer stack**: `pushFocusLayer(layer)` / `popFocusLayer()`. Navigation
   only moves within the top layer of the stack. Push saves the outgoing layer's
   focus and tries to place focus on the new layer's remembered/first cell (a
   freshly-mounted overlay may not have registered yet, in which case the caller
   `focusTo()`s after mount); on pop, the previous focus in the restored layer
   comes back (focus memory) — if the original cell was unmounted, fall back to
   the first cell in that layer. Layers in use: `home` (base) / `detail` /
   `player` / `filter` / `confirm`.
4. **Cross-group fallback (tabbar <-> content)**: triggered only when vertical
   navigation hits a group boundary — from the top row of the active content
   group, pressing Up enters `tabbar`; from `tabbar`, pressing Down returns to
   the active content group. Each tab's content lives in its own group
   (`content:{tabKey}`, so all tabs can stay mounted without id collisions), and
   the shell calls `setActiveContentGroup(group)` to point the bridge at the
   active tab. The target restores that group's `lastFocusByGroup` memory cell,
   falling back to the first cell if there is no record. This only applies
   within the same layer.
5. **Row-local column memory `rowMemory`**: when moving up/down between rows,
   land on the column where focus last rested in the target row. Additionally,
   `setRowCursorGroup(layer, group, on)` marks Netflix-style shelf groups where
   each row keeps its own cursor: entering a never-visited row lands on column 0
   instead of carrying the current column over (grids keep the default
   carry-over so vertical movement runs straight down a column). HomePage
   enables this for its shelf rows.
6. **Key handling**: `initFocusEngine()` attaches a single global `keydown`
   listener (idempotent) — arrow keys navigate, Enter triggers `onSelect`, and
   the back key (webOS `keyCode 461`, also compatible with
   `GoBack`/`Backspace`/`Escape`) dispatches a custom `tv-back` event. Expose
   `setCustomKeyHandler(fn)` so overlays (filter panel, player, etc.) can
   intercept keys in place — the handler runs first and consumes the event by
   returning `true`.
7. **applyFocus**: remove the old class -> add the new class ->
   `scrollIntoView({block:'nearest', inline:'nearest', behavior:'auto'})`.
   **behavior is always `auto`** (no smooth scrolling). When the new focus is in
   row 0 of a non-tabbar group, additionally snap the enclosing
   `.tab-content`/`.overlay` scroller to the top, so the heading above the first
   row (which `nearest` leaves clipped) shows.
8. **Self-healing after re-render**: when React controls `className`, it can wipe
   out the imperatively-added `.focused` class; inside `useFocusable`, use
   `useLayoutEffect` to reapply it to the current focus element after every
   commit.
9. **Mouse compatibility** (for webOS magic-remote pointer mode): focusable
   elements sync focus on `mouseenter` (highlight only, no commit) and set focus
   plus trigger `onSelect` on `click`.
10. Export `focusTo(id)` (for deterministically setting focus once a page's data
    has landed), `setFocus(id)`, `getCurrentFocus()`, `getActiveLayer()`, and an
    `onFocusChange(fn)` subscription for effects that must track focus without
    owning a focusable (e.g. header state).

## Explicitly out of scope

- Any logic coupled to a specific page's special cases (the only generic
  cross-group rule is the tabbar<->content one).

## Acceptance criteria

- [ ] A temporary demo with two groups (simulating tabbar + content) plus one
      overlay layer: arrow-key navigation, Enter selection, cross-group
      movement, and push/pop focus memory all work correctly;
- [ ] React DevTools Profiler confirms **zero component re-renders** during
      focus movement;
- [ ] while an overlay is open, the underlying grid does not respond to arrow
      keys; after pop, focus returns to the cell that was focused before the
      overlay opened;
- [ ] in the browser, Escape triggers `tv-back` (standing in for keyCode 461).
