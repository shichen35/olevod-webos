# T13 Detail page

> Milestone B | Depends on: T08 T09 T07 | Deliverables: `src/pages/DetailPage.jsx`, `src/styles/detail.css`

## Goal

A full-screen detail overlay (the `detail` focus layer): content info + play/favorite buttons + an episode grid.
Focus defaults to the primary play button (the shortest path to pressing OK and starting playback).

## Implementation requirements

1. **Layout (no translucency)**: skip a "poster blown up to fill the background + gradient overlay" treatment (it violates the
   performance red lines); instead use **solid-color sections**: an info column on the left at roughly 55% width (`--bg` background), and a poster
   `<img>` on the right (`object-fit:cover`, `imageUrl` at a large size suffix, 404s handled by Thumb's fallback mechanism).
   Text always sits on a solid background, never overlaid on the image.
2. **Info hierarchy**: eyebrow (category · year · region · remarks) → large title (display type scale) →
   a badge row (rating pill / UHD / "N episodes total") → a 3-line-truncated synopsis (the **`info.content`** field) →
   a single truncated line for director / cast.
3. **Action row (row 0)**: the primary button's label is context-aware — if a history record still points to an episode present
   in this fetch and `position > 30s`, it reads "▶ Continue Watching Episode N"; otherwise "▶ Play Episode 1"
   (episodes are in reverse order, so episode 1 = `episodes[length-1]`); the secondary button "☆ Favorite / ★ Favorited"
   toggles immediately (favorites store). **After data resolves, `focusTo` deterministically lands focus on the play button**.
4. **Episode grid (row 1 onward)**: an 8-column grid of numbered cells (a multi-row grid is more efficient than a single horizontal
   row for shows with hundreds of episodes); the episode currently in progress carries a "Continue" badge; OK jumps straight into the player
   (carrying the episode index).
5. **Overlay mechanics**: opening calls `pushFocusLayer('detail')` + hides the shell via `display:none`; data is cached via
   `pageCache.loadOnce(detail:id)`. Loading/error states show large centered text, with a focusable "Retry" on failure.
6. Back key: closes the detail view, pops the layer, and restores the shell's display and focus.

## Explicitly out of scope

- A related-recommendations row (not part of this version);
- Cast headshots / stills (no image source available).

## Acceptance criteria

- [ ] Entering via OK from a home/category card, once loading completes focus is on the play button;
- [ ] Content with watch history shows "Continue Watching Episode N", and the matching cell in the episode grid carries a "Continue" badge;
- [ ] Toggling favorite applies instantly, and after returning to the home page the "My Favorites" row reflects it;
- [ ] Navigation through an episode grid with hundreds of entries stays smooth (moving down one row = advancing 8 episodes);
- [ ] Pressing back closes the detail view and restores shell focus to the card that was focused before entering.
