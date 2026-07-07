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
   a module-level `Map` registry of `id -> { onSelect, onFocusChange }`. The
   `useFocusable({layer,group,row,col,onSelect})` hook registers on mount and
   unregisters on unmount, returning `{ ref or props }` to spread onto the DOM
   element. Callbacks are stored in a `useRef` and invoked through a stable
   wrapper — **a changed callback never triggers re-registration**, which avoids
   stale closures and effect-dependency loops.
2. **O(1) grid navigation**: arrow keys do arithmetic on `{row,col}` plus a
   registry `.has()` probe, never iterating the whole registry. On a missing
   column, fall back to the nearest column (bounded number of probes).
3. **Focus layer stack**: `pushFocusLayer(layer)` / `popFocusLayer()`. Navigation
   only moves within the top layer of the stack; on pop, the previous focus in
   that layer is restored (focus memory) — if the original cell was unmounted,
   fall back to that group's first cell. Predefined layers:
   `home / detail / player / filter / player-panel / confirm`.
4. **Cross-group fallback `crossGroupTarget`**: triggered only when navigation
   hits a group boundary — from the top row of `content`, pressing Up enters
   `tabbar`; from `tabbar`, pressing Down returns to `content`. The target
   restores that group's `lastFocusByGroup` memory cell, falling back to the
   first cell if there is no record. This only applies within the same layer.
5. **Row-local column memory `rowMemory`**: when moving up/down between
   horizontal shelf rows, return to the column where focus last rested in the
   target row.
6. **Key handling**: a single global `keydown` listener — arrow keys navigate,
   Enter triggers `onSelect`, and the back key (webOS `keyCode 461`, also
   compatible with `GoBack`/`Backspace`/`Escape`) dispatches a custom `tv-back`
   event. Expose `setCustomKeyHandler(fn)` so overlays (filter panel, player,
   etc.) can intercept keys in place.
7. **applyFocus**: remove the old class -> add the new class ->
   `scrollIntoView({block:'nearest', inline:'nearest', behavior:'auto'})`.
   **behavior is always `auto`** (no smooth scrolling).
8. **Self-healing after re-render**: when React controls `className`, it can wipe
   out the imperatively-added `.focused` class; inside `useFocusable`, use
   `useLayoutEffect` to reapply it to the current focus element after every
   commit.
9. **Mouse compatibility**: focusable elements sync focus on `mouseenter` and
   trigger `onSelect` on `click` (for webOS remote pointer mode).
10. Export `focusTo(id)` (for deterministically setting focus once a page's data
    has landed) and `getCurrentFocus()`.

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
