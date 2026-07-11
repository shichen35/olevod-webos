# T16 Player: basic HLS playback and default quality selection

> Milestone C | Depends on: T13 | Deliverables: `src/player/PlayerPage.jsx` (skeleton), `src/styles/player.css`

## Goal

Get from selecting an episode on the detail page to actual playback: hls.js lazy-loaded, a native-HLS branch, and default
quality selection. This covers only "enter → play → back"; controls/resume/autoplay-next/key hint are layered on in T17–T20.

## Reference

- Streams are plain-HTTP HLS (H.264+AAC) with Range support; the media wiring lives in `app/src/player/PlayerPage.jsx`.

## Implementation requirements

1. **Lazy loading**: `PlayerPage` mounts via `lazy()` + `<Suspense>`; hls.js is loaded via a dynamic
   `import()` — the startup bundle must not contain player code (verify this together with T01's manualChunks).
2. **Two branches**: when `video.canPlayType('application/vnd.apple.mpegurl')` succeeds, use native
   HLS (the on-device webOS path); otherwise use hls.js (the desktop-browser development path). Playback URLs always go through
   `streamUrl()` (on-device this automatically routes through the local proxy, wired up in T22).
3. **Quality selection**: on the hls.js path, set `autoStartLoad:false`, wait for `MANIFEST_PARSED`, pick the level from the
   parsed master playlist, then call `startLoad()`. **Start playback at the highest level under 1440p resolution** (ties broken
   by bitrate) and pin `autoLevelCapping` to that same level so ABR never climbs into the UHD tier — quality stays fully
   automatic, there is no manual switching. If the master has no level under 1440p, leave hls.js's own ABR choice alone. The
   native path defers to the system's own ABR.
4. **hls.js configuration**: use **flat, short retry delays** — a shared load policy for manifest/playlist/frag
   (`maxTimeToFirstByteMs:8000`, `maxLoadTimeMs:20000`) whose timeout and error retries are both
   `maxNumRetry:4, retryDelayMs:200, maxRetryDelayMs:200` — no exponential backoff (exponential backoff turns an occasional
   failure into a multi-second black screen before playback even starts).
5. **Player page structure**: a full-screen `<video>` (the `player` focus layer overlay, above `detail`); OK toggles
   play/pause; back exits the player and returns to the detail page. Detail data (title + episode urls) comes from the shared
   page cache (`pageCache.loadOnce`) — the detail page beneath already cached it, so entering the player never refetches.
   Loading/error states are centered static text on black, with a focusable "Retry" on error that tears down and rebuilds the
   playback pipeline.
6. **The video element's background is solid opaque black**; the control-bar UI is layered on in T17 — the priority here is just getting a black-screen start working.
7. Cleanup on unmount: `hls.destroy()`, then drop the native source too (`video.removeAttribute('src')` + `video.load()`), to prevent memory leaks and lingering segment requests.

## Explicitly out of scope

- Progress bar/key bindings (T17), resume (T18), autoplay-next (T19), key hint (T20);
- DASH / Shaka (this project's streams are standard HLS).

## Acceptance criteria

- [ ] Selecting any episode on the detail page and pressing OK: playback starts within ≤2s in the browser (hls.js path);
- [ ] Network confirms the media playlist that starts playback is below the 1440p tier;
- [ ] The no-network retry path: a failed load shows "Retry", and playback works once network is restored;
- [ ] After exiting via back, Network shows no lingering segment requests; repeating enter/exit 10 times shows no noticeable memory growth;
- [ ] The build output confirms hls.js and PlayerPage are each their own chunk, and neither loads on first paint.
