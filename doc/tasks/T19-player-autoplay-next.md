# T19 Player: Autoplay Next Episode and Up Next

> Milestone C | Depends on: T17, T18 | Deliverable: `PlayerPage` autoplay
> logic + Up Next card

## Goal

Keep binge-watching frictionless: auto-play the next episode at the end,
and surface an "Up Next" card before the end that can be confirmed with OK
to switch immediately.

## Requirements

1. **Determining the next episode**: the player holds the full `episodes`
   array (passed in from the detail page); the array is **newest-first**, so
   "next episode" = the entry **before** the current index (index - 1). If
   there's no next episode, go back to the detail page after `ended`.
2. **Up Next card**: when ≤30s remain and a next episode exists, show an
   "Up Next: Episode N" card in the bottom-right (opaque `--bg-elev`
   background + border, appears instantly with no animation); while shown,
   **OK immediately switches to the next episode** (replacing play/pause);
   Up or Back first dismisses the card and restores normal key handling.
3. **Autoplay on `ended`**: switching episodes does not exit the player —
   first flush the current episode's progress (T18), then swap the URL and
   reload (reusing T16's quality-selection logic), and update history to
   the new episode.
4. During the episode switch, show a static "Loading next episode N..."
   message; no flash of a black screen or error state.
5. Verify the autoplay chain all the way to the end: on the last episode,
   `ended` returns to the detail page with focus landing on the play
   button.

## Explicitly out of scope

- "Skip intro/outro" (the API has `seek_start`/`seek_end` fields but they
  are always 0, so this is not implemented);
- Cross-title recommendations for autoplay.

## Acceptance criteria

- [ ] Tested with a title that has a short runway to the end (or by seeking
      to 40s before the end): the Up Next card appears at the 30s
      threshold, and OK switches to the next episode immediately without
      exiting the player;
- [ ] With no input, `ended` auto-advances to the next episode, and
      history/progress records update accordingly;
- [ ] Finishing the last episode returns to the detail page with correct
      focus;
- [ ] While the Up Next card is shown, Back first dismisses it; pressing
      Back again then follows the normal exit chain.
