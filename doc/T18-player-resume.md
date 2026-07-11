# T18 Player: Resume Playback and Watch-Progress Persistence

> Milestone C | Depends on: T16, T07 | Deliverable: `PlayerPage` progress
> read/write logic

## Goal

Pick up right where you left off: write history on start, persist progress
periodically, and resume from the recorded position on re-entry. Wire up the
data chain shared by the home page's "Continue Watching", the detail page's
"Continue Watching Episode N", and the player itself.

## Requirements

1. **Writes**: call `recordHistory(item)` on the first `playing` event of
   an episode load (adds/bumps the title in "Recently Watched"); after
   that, call `recordProgress(id, epIndex, position, duration)` every 5s
   while actually playing (the flush timer skips ticks while paused), on
   episode change, and on unmount. **Within 15s of the end counts as
   finished — reset progress to zero** (next play starts from the
   beginning and this no longer counts as a "resume"). Both live in the
   history store (localStorage key `olevod:history`, capped at 40 titles,
   most-recent-first); each entry carries
   `watch: { lastEpisodeIndex, position, duration }`.
2. **Reading on resume**: on entering the player, read `getWatchState(id)` —
   only resume if it's the same episode and `position > 30s`:
   - hls.js path: with `autoStartLoad:false`, start loading at the recorded
     position via `hls.startLoad(resumePos)` after `MANIFEST_PARSED` (don't
     load from 0 and then seek — that wastes bandwidth on double
     buffering);
   - native path: seek inside `loadedmetadata`;
   - **correct once more** on the `playing` event if playback landed more
     than 3s before the recorded position (hls.js can sometimes snap the
     first frame back to 0).
3. **Resume toast**: show a "已从 mm:ss 继续播放" toast once on start — a
   glass pill in the top-right (the title chip owns the top-left),
   displayed statically, removed after 3s, no fade in/out animation.
4. When switching episodes (same title, different episode), flush the
   outgoing episode's progress to storage before switching.
5. Verify the three-way link works together: exiting the player updates the
   home page's "Continue Watching" row card progress bar and "Watched up to
   EPxx" label immediately (via store subscription), and the detail page's
   primary button changes to "Continue Watching Episode N".

## Explicitly out of scope

- Cloud sync; multi-device support.

## Acceptance criteria

- [ ] Watch for 2 minutes, exit, re-enter: resumes from the recorded
      position and the toast appears exactly once;
- [ ] Exit within 15s of the end: next playback starts from the beginning,
      and the home page no longer shows resume progress for that episode;
- [ ] Refreshing the page (simulating a restart) preserves the record;
- [ ] Home page, detail page, and player all show the same record
      consistently.
