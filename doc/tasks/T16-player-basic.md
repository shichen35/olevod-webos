# T16 Player: basic HLS playback and default quality selection

> Milestone C | Depends on: T13 | Deliverables: `src/player/PlayerPage.jsx` (skeleton), `src/styles/player.css`

## Goal

Get from selecting an episode on the detail page to actual playback: hls.js lazy-loaded, a native-HLS branch, and default
quality selection. This covers only "enter → play → back"; controls/resume/autoplay-next are layered on in T17–T20.

## Reference

- Media-layer findings: [doc/olevod-api.md](../olevod-api.md) §5 (plain-HTTP HLS, H.264+AAC, Range support)

## Implementation requirements

1. **Lazy loading**: `PlayerPage` mounts via `lazy()` + `<Suspense>`; hls.js is loaded via a dynamic
   `import()` — the startup bundle must not contain player code (verify this together with T01's manualChunks).
2. **Two branches**: when `video.canPlayType('application/vnd.apple.mpegurl')` succeeds, use native
   HLS (the on-device webOS path); otherwise use hls.js (the desktop-browser development path). Playback URLs always go through
   `streamUrl()` (on-device this automatically routes through the local proxy, wired up in T22).
3. **Quality selection**: on the hls.js path, parse the levels from master.m3u8 and **start playback at the highest level under
   1440p resolution** (the UHD tier is reserved for manual switching in T20); the native path defers to the system's own ABR.
4. **hls.js configuration**: use **flat, short retry delays** — `backoffFactor:1`, `baseDelay:150–200` — and
   no exponential backoff (exponential backoff turns an occasional failure into a 7.5s wait before playback starts — confirmed by testing in the skill).
5. **Player page structure**: a full-screen `<video>` (the `player` focus layer overlay, above `detail`); OK toggles
   play/pause; back exits the player and returns to the detail page. Loading/error states are centered static text, with a
   focusable "Retry" on error.
6. **The video element's background is solid opaque black**; the page has no control-bar UI at all yet (that's T17) — the priority here is just getting a black-screen start working.
7. Cleanup on unmount: `hls.destroy()` / `video.src=''`, to prevent memory leaks and lingering requests.

## Explicitly out of scope

- Progress bar/key bindings (T17), resume (T18), autoplay-next (T19), settings panel (T20);
- DASH / Shaka (this project's streams are standard HLS).

## Acceptance criteria

- [ ] Selecting any episode on the detail page and pressing OK: playback starts within ≤2s in the browser (hls.js path);
- [ ] Network confirms the media playlist that starts playback is below the 1440p tier;
- [ ] The no-network retry path: a failed load shows "Retry", and playback works once network is restored;
- [ ] After exiting via back, Network shows no lingering segment requests; repeating enter/exit 10 times shows no noticeable memory growth;
- [ ] The build output confirms hls.js and PlayerPage are each their own chunk, and neither loads on first paint.
