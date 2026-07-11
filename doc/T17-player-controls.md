# T17 Player: Remote Key Handling and Progress Bar UI

> Milestone C | Depends on: T16 | Deliverable: `PlayerPage` control bar and key-handling logic

## Goal

Full remote-control playback controls: show/hide progress bar, rewind/fast-forward
(tap / long-press / drag), and timecode display.

## Requirements

1. **Control bar visuals (no translucency variant)**: an opaque **solid `--bg-elev`
   bar** at the bottom (no gradient scrim); progress track 6px tall — played
   portion white, buffered portion `--bg-elev-2`, unplayed portion `--text-3`
   (all opaque colors); timecode shows current time on the left and
   **remaining time (-mm:ss)** on the right; title and episode number in the
   top-left of the bar. Show/hide is an instant `display` toggle, no fade
   in/out.
2. **Keys (bar hidden)**: Down brings up the control bar; Left/Right tap
   steps ∓15s, **long-press repeats continuously** (press held >100ms counts
   as long-press, steps at a fixed cadence while held); OK toggles
   play/pause (pausing auto-shows the bar).
3. **Keys (bar shown)**: Up hides the bar; Down opens the player panel (T20,
   leave a hook for now); Left/Right drag ∓60s — first move a preview
   cursor, **only seek once the key has settled for ~500ms** (debounces
   input and avoids a burst of segment requests); OK toggles play/pause.
4. **Seek feedback**: while dragging, show a target-time badge on the
   progress bar (« / » direction glyph + mm:ss), displayed statically with
   no animation.
5. **Auto-hide**: the bar auto-hides after 5s of no input while shown (stays
   visible while paused).
6. Keys are captured wholesale at the `player` layer via
   `setCustomKeyHandler`; Back unwinds layer by layer: panel -> collapse
   control bar -> exit player.
7. **Progress bar updates must not go through high-frequency React
   setState**: update the timecode/track width directly on the DOM via ref
   on the `timeupdate` event, or use a controlled update throttled to
   500ms — verify with the Profiler that there are no multiple re-renders
   per second during playback.

## Explicitly out of scope

- Thumbnail seek preview (no thumbnail source available);
- Playback speed / quality / episode selection (T20).

## Acceptance criteria

- [ ] Every key documented above walks through correctly against this
      spec (tap 15s / long-press repeat / drag 60s + settle-then-seek /
      OK / Up/Down / Back unwinding layer by layer);
- [ ] No burst of segment requests from incremental seeking while dragging
      (only one request after settling), verified in Network;
- [ ] Profiler over 1 minute of playback: component re-render count stays
      in the single digits;
- [ ] Remaining time displays correctly, and the bar stays visible while
      paused.
