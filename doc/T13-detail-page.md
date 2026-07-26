# T13 Detail page

> Milestone B | Depends on: T08 T09 T07 | Deliverables: `src/pages/DetailPage.jsx`, `src/styles/detail.css`

## Goal

A full-screen detail overlay (the `detail` focus layer): content info + play/favorite buttons + an episode grid.
Focus defaults to the primary play button (the shortest path to pressing OK and starting playback).

## Implementation requirements

1. **Layout (no translucency)**: skip a "poster blown up to fill the background + gradient overlay" treatment (it violates the
   performance red lines); instead use **solid-color sections**: a poster on the left at the same fixed footprint as a grid card
   (`--card-w` wide, 2:3 aspect ratio, rendered through `Thumb` — the identical sized asset is usually already cached when
   arriving from a poster grid, and 404s are handled by Thumb's fallback mechanism), with the info column filling the remaining
   width to its right. Text always sits on a solid background, never overlaid on the image.
2. **Info hierarchy**: eyebrow (category · year · region · remarks) → large title (display type scale) →
   a badge row (accent-colored rating, shown only when > 0, plus a "全 N 集" episode count) → a 3-line-truncated synopsis
   (the detail response's **`content`** field, exposed as `synopsis` by `src/api/olevod.js`) →
   a single truncated line for director / cast.
3. **Action row (row 0)**: the primary button's label is context-aware — if a history record still points to an episode present
   in this fetch and `position > 30s`, it reads "▶ Continue Watching Episode N"; otherwise "▶ Play Episode 1"
   (episodes are in reverse order, so episode 1 = `episodes[length-1]`); the secondary button "☆ Favorite / ★ Favorited"
   toggles immediately (favorites store). **After data resolves, `focusTo` deterministically lands focus on the play button**.
4. **Playlist controls (row 1)**: a chip row labelled "播放列表" holding a single order toggle that shows the order the list is
   IN, with an arrow carrying the direction ("↓ 降序" / "↑ 升序") — a plain action chip, not a selection, so the accent-text
   selected state stays reserved for the range chips. For lists longer than 60 episodes those follow: one chip per 50-episode
   window, labelled with its episode span ("184-233"). Order is a **display** concern only — `olevod.js::detail` keeps returning episodes
   newest-first because the player derives "next episode" from that order, so this page reverses a copy. The choice persists per
   title in `store/episodeOrder.js`, which stores only the exceptions (descending is the default). Picking a range pins it; the
   pin survives a sort flip, so flipping the order keeps the same stretch of episodes on screen. With no pin, the visible range
   is the one holding the resume episode, else the head of the list. The whole row is omitted for a single-episode title.
5. **Episode grid (row 2 onward, or row 1 with no controls)**: a 6-column grid of numbered cells (a multi-row grid is more
   efficient than a single horizontal row for shows with hundreds of episodes); only the selected range renders, and its rows are
   numbered from the top of the grid so vertical navigation never crosses a gap; the episode currently in progress carries a
   "Continue" badge; OK jumps straight into the player (carrying the episode index).
6. **Overlay mechanics**: the overlay calls `pushFocusLayer('detail')` on mount (popped on unmount); the shell beneath stays
   mounted and is hidden via `display:none` by the App view stack. Data is cached via `pageCache.loadOnce(detail:${id})`.
   Loading/error states show large centered text, with a focusable "Retry" on failure. The scroll container carries the
   style-free `overlay` marker class that `useFocus.js` looks for: without it, moving up to the action row only scrolls the
   minimum needed to reveal the buttons, leaving the poster and title block clipped above the viewport — row 0 must snap the
   scroller to the very top.
7. Back key: closes the detail view, pops the layer, and restores the shell's display and focus.

## Explicitly out of scope

- A related-recommendations row (not part of this version);
- Cast headshots / stills (no image source available).

## Acceptance criteria

- [ ] Entering via OK from a home/category card, once loading completes focus is on the play button;
- [ ] Content with watch history shows "Continue Watching Episode N", and the matching cell in the episode grid carries a "Continue" badge;
- [ ] Toggling favorite applies instantly, and after returning to the home page the "My Favorites" row reflects it;
- [ ] Navigation through an episode grid with hundreds of entries stays smooth (moving down one row = advancing 6 episodes);
- [ ] The order toggle flips the grid, survives leaving and reopening the title, and does not change which episode the player
      queues up next; on a 200+ episode show the range chips keep the grid to one screenful and the pinned range survives a flip;
- [ ] Pressing back closes the detail view and restores shell focus to the card that was focused before entering.
