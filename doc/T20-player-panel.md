# T20 Player Panel (Episodes / Speed / Quality) and First-Run Hint

> Milestone C | Depends on: T17 | Deliverable: `PlayerPage` bottom panel +
> one-time usage hint

## Goal

A bottom panel that expands with Down when the control bar is already
shown: three horizontal tabs for episodes / playback speed / quality, plus
a one-time key-handling hint on first entering the player.

## Requirements

1. **Panel structure**: an opaque `--bg-elev` panel at the bottom, row 0 is
   the tab row (`Episodes | Speed | Quality`), row 1 onward is the content
   of the current tab; a dedicated `player-panel` focus layer (push/pop),
   Back collapses the panel back to the control bar. Opens/closes instantly
   with no animation.
2. **Episodes tab**: an 8-column numeric grid (reusing the rendering
   convention from the detail page's episode selector), current episode
   highlighted; OK switches episodes without exiting the player (goes
   through T19's episode-switch path).
3. **Speed tab**: 0.75 / 1.0 / 1.25 / 1.5 / 2.0 — sets `video.playbackRate`,
   shared between the native and hls.js branches; current setting
   highlighted; the chosen speed persists across episode switches/reloads.
4. **Quality tab**: on the hls.js path, list the master playlist's levels
   (including a >=1440 "Ultra HD" tier if present, manually selectable);
   selecting a level sets `hls.currentLevel` (disabling ABR fallback); **the
   native HLS path can't retrieve level info, so this tab is hidden
   entirely** (shown/hidden based on capability — this is the actual
   behavior on the real device).
5. **First-run hint**: on first entering the player, show a one-time
   key-handling hint (a static card that disappears after 3s or on any key
   press), recorded via `settings.playerHintShown` so it doesn't appear
   again.
6. Left/Right switching between tabs, and navigation within a tab's
   content, must not interfere with each other (the panel uses an
   independent grid addressing scheme internally).

## Explicitly out of scope

- Subtitles, audio track selection (the stream has no additional tracks);
- Aspect ratio adjustment.

## Acceptance criteria

- [ ] With the bar shown, Down opens the panel, Back collapses the panel
      back to the control bar, Back again collapses the bar, Back again
      exits the player — all four levels work correctly;
- [ ] All three tabs work as expected: episode switching doesn't exit the
      player, speed changes apply immediately and persist across episode
      switches, and quality changes switch the segment tier visible in
      Network;
- [ ] With native HLS simulated (temporarily forcing that branch), the
      quality tab does not appear and tab navigation still works correctly;
- [ ] After clearing localStorage, the first-run hint appears once on
      entering the player and does not appear again after that.
