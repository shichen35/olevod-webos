# T20 Player: No Bottom Panel (Auto Quality, Fixed Speed) and Key Hint

> Milestone C | Depends on: T17 | Deliverable: `PlayerPage` key-hint card +
> fixed playback policy (no bottom panel)

## Goal

Keep the player chrome minimal: there is deliberately **no bottom panel** —
quality is fully automatic and playback speed is fixed — and instead of a
settings UI, a key-hint card teaches the remote bindings whenever a title is
opened fresh, and can be recalled with Up at any time.

## Requirements

1. **No panel**: the player has no episodes / speed / quality panel and no
   `player-panel` focus layer. Quality is fully automatic — the hls.js path
   starts at, and caps ABR below, the UHD tier (T16); the native path uses
   the system's own ABR. Playback speed is always 1x (`playbackRate` is
   never touched). Episode switching happens from the detail page's episode
   grid, the Up Next card, or autoplay (T19) — never from inside a panel.
2. **Key hint card**: a static glass card (`--glass-strong` fill + backdrop
   blur + `--glass-edge` border) centered near the top of the screen, with
   a "遥控键位" title and two lines covering the bindings: OK play/pause ·
   Left/Right seek (long-press accelerates) · Down shows the control bar ·
   Up recalls this hint · Back exits.
3. **Trigger**: shown automatically on entering the player whenever the
   title has **no saved watch position** (`getWatchState(id)` missing or
   `position` not > 0). It is not persisted behind a one-time flag — a
   title keeps showing the hint until some progress has been recorded for
   it. It disappears after 3s, or on any key press; the dismissing key
   still performs its normal action.
4. **Recall**: with the control bar hidden, Up shows the hint again at any
   time (with the bar shown, Up hides the bar instead — T17).
5. **Down with the bar shown is consumed with no action** — it does not
   open anything (there is no panel), and it must not leak to the layer
   beneath.

## Explicitly out of scope

- A bottom panel with episodes / speed / quality tabs (quality is
  ABR-managed, speed is fixed at 1x, episodes live on the detail page);
- Manual quality selection of the >=1440 "Ultra HD" tier;
- Subtitles, audio track selection (the stream has no additional tracks);
- Aspect ratio adjustment.

## Acceptance criteria

- [ ] Entering a title with no saved watch progress shows the hint; it
      disappears after 3s or on any key press, and that key still performs
      its normal action;
- [ ] After watching long enough for a progress flush (a few seconds) and
      re-entering the same title, the hint no longer auto-appears;
- [ ] With the bar hidden, Up recalls the hint at any time; with the bar
      shown, Up hides the bar instead;
- [ ] With the bar shown, Down does nothing and no key leaks to the detail
      layer beneath; no speed or quality UI exists anywhere in the player.
