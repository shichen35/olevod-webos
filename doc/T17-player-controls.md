# T17 Player: Remote Key Handling and Progress Bar UI

> Milestone C | Depends on: T16 | Deliverable: `PlayerPage` control bar and key-handling logic

## Goal

Full remote-control playback controls: show/hide the control bar,
rewind/fast-forward (tap / accelerating long-press), a play/pause icon, and
timecode display.

## Requirements

1. **Control bar visuals (apple-style glass)**: a floating rounded panel at
   the bottom (`--glass-strong` fill + backdrop blur + `--glass-edge`
   border, 28px radius, inset by `--safe-x` and 48px above the bottom edge —
   no gradient scrim); progress track is an 8px rounded pill — played
   portion `--focus`, buffered portion `--text-3`, unplayed base
   `--glass-active`; below the track a `1fr | auto | 1fr` row shows the
   current time on the left, a **play/pause SVG icon dead-center** (play
   glyph while paused, pause glyph while playing), and **remaining time
   (-mm:ss)** on the right. The title and episode number live in a separate
   glass capsule chip in the top-left of the screen that shows/hides
   together with the bar. Show/hide is an instant `display` toggle, no fade
   in/out (the bar stays mounted so its DOM refs remain stable).
2. **Keys (bar hidden)**: Down brings up the control bar; Up shows the key
   hint (T20); Left/Right tap steps ∓15s, **long-press repeats
   continuously with acceleration** — native key repeat throttled to one
   step per 200ms, and the step multiplier grows by 1x for every held
   second, capped at 10x (so a held key ramps from 15s/step up to
   150s/step); OK toggles play/pause (pausing auto-shows the bar); Back
   exits the player.
3. **Keys (bar shown)**: Up hides the bar; Left/Right use the **same ∓15s
   step and the same long-press acceleration** — the step is identical
   whether the bar is shown or hidden; OK toggles play/pause; Back hides
   the bar; Down (and any other key) is consumed with no action. In both
   bar states, seek steps **accumulate into a pending target and only seek
   once the key has settled for ~500ms** (debounces input and avoids a
   burst of segment requests); while the bar is shown, the played track
   acts as a preview cursor that follows the pending target.
4. **Seek feedback**: while stepping, show a target-time badge (glass pill,
   centered above the bar area: « / » direction glyph + the pending target
   time), displayed statically with no animation; after the seek commits,
   the badge lingers ~800ms and then disappears.
5. **Auto-hide**: the bar auto-hides after 5s of no input while shown; it
   stays visible while paused (the hide timer re-checks and re-arms every
   5s until playback resumes).
6. Keys are captured wholesale at the `player` layer via
   `setCustomKeyHandler`; Back unwinds one level at a time: collapse the
   control bar -> exit player. While loading, nav/OK are swallowed so keys
   can't leak to the detail layer beneath (Back still exits); in the error
   state, normal focus navigation drives the Retry button.
7. **Progress bar updates must not go through high-frequency React
   setState**: the timecode, played width, and buffered width are updated
   directly on the DOM via refs on the `timeupdate`/`progress` events —
   verify with the Profiler that there are no multiple re-renders per
   second during playback.

## Explicitly out of scope

- Thumbnail seek preview (no thumbnail source available);
- Playback speed / quality / episode selection panels (quality is fully
  automatic and speed is fixed at 1x — see T20).

## Acceptance criteria

- [ ] Every key documented above walks through correctly against this
      spec (tap 15s / accelerating long-press / settle-then-seek in both
      bar states / OK / Up/Down / Back unwinding level by level);
- [ ] No burst of segment requests from incremental seek stepping
      (only one seek after the ~500ms settle), verified in Network;
- [ ] Profiler over 1 minute of playback: component re-render count stays
      in the single digits;
- [ ] Remaining time displays correctly, and the bar stays visible while
      paused.
