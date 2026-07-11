# T25 On-Device Validation and Performance Baseline

> Milestone D | Depends on: T23, T24 | Deliverable: `doc/device-baseline.md`
> (validation record + performance baseline)

## Goal

Run a systematic walkthrough of every feature on a real LG C4 (webOS 24)
device, record performance baseline data, and produce a regression
checklist for future iterations. This is the project's final acceptance
pass.

## Validation checklist

### Functional walkthrough (`tools/drive.mjs` self-driven + manual remote, both tracks)

- [ ] App launches to the home page with focus on the "首页" (Home) tab;
      switching tabs after warm-up shows no loading state;
- [ ] Full key-handling walkthrough: tabbar<->content cross-group
      navigation, shelf horizontal scrolling, category infinite scroll,
      filter panel, detail page, and every player key (spot-check against
      each task's own acceptance criteria), and the Back chain unwinding
      layer by layer all the way to `platformBack` exiting the app;
- [ ] Confirm on the real device that **Back is keyCode 461** (the browser
      can only test the Escape fallback);
- [ ] Playback: startup time, seek, playback speed, quality, resume,
      autoplay next, Up Next — verify playback using `<video>.currentTime`
      advancing (screenshots can't capture the video plane);
- [ ] Remote pointer (mouse mode) hover/click works;
- [ ] Offline/weak network: API retry and the "Retry" button work, and
      playback recovers from interruption;
- [ ] Service stability: after 30+ minutes of continuous use plus a
      standby/wake cycle, the service is still alive (keepAlive is
      working).

### Performance baseline (recorded into device-baseline.md via `tools/debug.mjs`)

- [ ] Once the home page is ready: DOM node count / focusable element count
      / JSHeapUsedSize (expected order of magnitude: <=300 nodes, ~20
      focusables, ~2MB heap; investigate if significantly higher);
- [ ] After 20 consecutive focus moves: LayoutCount/RecalcStyleCount deltas
      and perceived smoothness (no visible lag);
- [ ] Node count growth after paging through 5 pages of a category (assess
      whether DOM trimming of earlier pages is needed; record as an
      observation item);
- [ ] Startup-to-playback time (entering the player until
      `currentTime > 0`), seek response time, and no heap leak over a
      10-minute long play session;
- [ ] Image loading: no noticeable decode stutter while scrolling (if
      present, check whether the sized-suffix URLs are being used
      correctly).

### Issue handling

For each issue found, follow the "get data first, then fix code" principle
and log an entry: symptom -> CDP/log evidence -> fix -> re-verification,
recorded in device-baseline.md. This task is only complete once all
usability-impacting issues are resolved.

## Acceptance criteria

- [ ] `doc/device-baseline.md` is committed: full functional checklist
      completed, baseline data table included, and a list of remaining
      observation items;
- [ ] All P0/P1 issues are closed out (each with evidence and a
      re-verification record).
