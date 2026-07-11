# T22 Wiring the Frontend to the On-Device Dual Channel

> Milestone D | Depends on: T21, T05, T16 | Deliverable:
> `app/src/api/luna.js` device-branch implementation

## Goal

Fill in the device branch left as a placeholder in T05: on webOS, API JSON
goes through the Luna service and media URLs are rewritten to point at the
local proxy; browser/simulator behavior is unchanged. The business layer
(everything above http.js) requires zero changes — this is the point that
proves the transport abstraction actually holds up.

## References

- Dual-channel architecture: header comments of `app/src/api/luna.js` and
  `service/com.olevod.app.service/service.js`

## Requirements

1. **Environment detection**: if `window.PalmSystem` exists, attempt a Luna
   bus `ping` to `com.olevod.app.service` via the raw `PalmServiceBridge`
   binding every webOS webview injects (no webOSTV.js library needed in the
   bundle); success = device mode, and record the
   returned `proxyPort`; failure (simulator has no Node service) = direct
   mode. `initTvEnv()` is awaited before the first frame in `main.jsx` — so
   media URLs point at the right port from the very first frame. Give the
   ping a short timeout (~2s) so startup doesn't hang.
2. **`transportGet` Luna branch**: call the service's `fetch` method to get
   JSON text; on failure, fall back to a direct request once (the scaffold
   for this is already in place from T05).
3. **`mediaUrl` device branch**: `https://{host}/{path}` ->
   `http://127.0.0.1:{proxyPort}/proxy/{host}/{path}?{query}`; the browser
   returns the URL unchanged.
4. Wrap Luna calls in a Promise with a timeout-based reject (~2s for
   `ping`, ~10s for `fetch`; Luna calls can't be truly aborted — comment
   this to note it matches T05's semantics).
5. Explicitly verify the simulator path: when `PalmSystem` exists but
   `ping` fails, everything falls back to direct mode with full
   functionality.

## Explicitly out of scope

- Service-side changes (T21 already fixed the interface);
- Migrating localStorage to Luna file storage (an observation item —
  skipped if localStorage works fine on the real device).

## Acceptance criteria

- [ ] Browser `npm run dev`: behavior is identical to before this task
      (regression check);
- [ ] On device (tested jointly after T23 deployment): CDP
      `Runtime.evaluate` confirms API data comes back through Luna, the
      `<video>` element's src points at `127.0.0.1:{port}`, and playback
      works;
- [ ] Manually killing the service process: the API still falls back to
      direct requests and returns data (media being unavailable is
      expected in that case);
- [ ] `grep -R "PalmSystem\|PalmServiceBridge\|window.webOS" app/src/` only
      matches `api/luna.js` — environment probing and platform API access
      are fully contained there (other files touch webOS only in comments
      and the Back keyCode 461 constant).
