# T05 Data Transport Abstraction and Unified Fetching

> Milestone A | Prerequisite: T04 | Output: `src/api/luna.js`, `src/api/http.js`

## Goal

Build the data-access skeleton so that business logic never touches
fetch/Luna directly: `luna.js` handles environment detection and transport
selection, and `http.js` provides the single fetch entry point `apiGet(path)`
(sign -> transport -> validate business code -> attempt decryption). This task
implements the **direct browser fetch** transport; the real-device Luna branch
gets its interface defined here and its implementation filled in by T22.

## Reference

- API and transport architecture: [doc/olevod-api.md](../olevod-api.md) §3, §6

## Requirements

### luna.js — environment and transport

1. Environment detection: `isTV = window.PalmSystem exists`; further split into
   "real device" (Luna bus available and the service responds to ping) versus
   "simulator/browser" (direct fetch). In this task, the real-device branches of
   `lunaFetch()` / `mediaUrl()` / `initTvEnv()` should have their signatures
   defined now, either throwing "not implemented" or falling back to direct
   fetch — **the interface shape is fixed now**, and T22 only fills in the
   implementation:
   - `initTvEnv(): Promise<void>` — pings the service at startup and retrieves
     the proxy port;
   - `transportGet(url): Promise<jsonText>` — chooses direct fetch or Luna based
     on environment;
   - `mediaUrl(rawUrl): string` — returned unchanged in the browser; rewritten to
     a local proxy address on the real device.
2. Direct transport: `fetch` + `AbortController` for a real cancelable timeout.
   Both the OleVod API and its CDN return `Access-Control-Allow-Origin:*`, so the
   browser can reach them directly with no dev proxy needed.

### http.js — unified fetching

3. `apiGet(path)` flow: append the `?_vv=` signature (T04) -> `transportGet` ->
   `JSON.parse` -> validate `code===0` (throw `Error(msg)` if nonzero) -> if
   `data` is a non-empty string, try `aesDecryptToJson`, and use the decrypted
   result on success -> return `data`.
4. **Timeout + retry**: each attempt has a hard `TIMEOUT_MS=3000` cutoff, retrying
   up to `RETRY_LIMIT=3` times; each retry **re-signs** the request (a fresh
   `_vv`). Only retry network/timeout errors — a nonzero business code is a
   valid response and is not retried. (The OleVod API occasionally hangs for
   tens of seconds; a short cutoff plus retries turns that into a fast
   self-healing round trip.)
5. On the direct-fetch path, use `AbortController` to genuinely cancel an
   in-flight request; the Luna path cannot be interrupted, so a timeout there
   just rejects and lets the call finish in the background (documented in a
   comment).
6. If the Luna path fails, fall back to direct fetch once (a safety net for the
   service becoming unavailable mid-flight) — write this logic now; it becomes
   active once T22 lands.

## Explicitly out of scope

- The Luna bus call and local proxy implementation (T21/T22);
- Wrapping business endpoints (T06).

## Acceptance criteria

- [ ] In the browser, `apiGet('/v1/pub/vod/list/type')` returns the unwrapped
      `data` object;
- [ ] With the network off or pointed at a broken domain, it throws after 3
      retries, taking at most roughly 10s total (3s x 3 plus overhead), never
      hanging indefinitely;
- [ ] A list endpoint that returns AES ciphertext gets transparently decrypted
      (the returned body is already an object, with no awareness needed at the
      business layer);
- [ ] `grep -R "fetch(" src/` has no hits outside of `luna.js` (verifies the
      transport chokepoint).
