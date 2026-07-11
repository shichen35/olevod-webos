# T19 Player: Autoplay Next Episode and Up Next

> Milestone C | Depends on: T17, T18 | Deliverable: `PlayerPage` autoplay
> logic + Up Next card

## Goal

Keep binge-watching frictionless: auto-play the next episode at the end,
and surface an "Up Next" card before the end that can be confirmed with OK
to switch immediately.

## Requirements

1. **Determining the next episode**: the player holds the full `episodes`
   array (from the normalized detail, read through the shared page cache
   that the detail page beneath already populated); the array is
   **newest-first**, so "next episode" = the entry **before** the current
   index (index - 1). If there's no next episode, `ended` dispatches a
   `tv-back` and the player exits to the detail page.
2. **Up Next card**: when ≤30s remain and a next episode exists, show an
   "即将播放 / 第N集 / 按 OK 立即播放" card in the bottom-right (glass:
   `--glass-strong` fill + backdrop blur + `--glass-edge` border, appears
   instantly with no animation); while shown, **OK immediately switches to
   the next episode** (replacing play/pause); Up or Back dismisses the
   card, and it does not reappear for the current episode (a per-episode
   dismissed flag, reset on episode switch); other keys keep their normal
   meaning while the card is up.
3. **Autoplay on `ended`**: switching episodes does not exit the player —
   first flush the current episode's progress (T18's finished-tail rule
   zeroes it), then reload the new episode's URL through the same
   quality-selection path (T16); history/progress then record against the
   new episode from its first `playing` event.
4. During the episode switch, show a static "正在加载 第N集…" message; no
   flash of an error state.
5. Verify the autoplay chain all the way to the end: on the last episode,
   `ended` returns to the detail page with focus restored where it was in
   the detail layer.

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
- [ ] While the Up Next card is shown, Back first dismisses it (and the
      card stays away for the rest of the episode); pressing Back again
      then follows the normal exit chain.
