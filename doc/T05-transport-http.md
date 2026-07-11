# T05 Data Transport Abstraction and Unified Fetching

> Milestone A | Prerequisite: T04 | Output: `src/api/luna.js`, `src/api/http.js`

## Goal

Build the data-access skeleton so that business logic never touches
fetch/Luna directly: `luna.js` handles environment detection and transport
selection, and `http.js` provides the single fetch entry point `apiGet(path)`
(sign -> transport -> validate business code -> attempt decryption). `luna.js`
implements both the **direct browser fetch** transport and the client side of
the real-device Luna transport; the Node service itself is T21, and the
on-device wiring is validated in T22.

## Reference

- Implementation: `app/src/api/luna.js` (environment + transport),
  `app/src/api/http.js` (unified fetching)

## Requirements

### luna.js — environment and transport

1. Environment detection is **handshake-based, not presence-based**:
   `isTV = window.PalmSystem exists` only makes the app TRY a service ping —
   the simulator has PalmSystem but no Node service, so the ping times out
   there and everything stays on direct fetch. Luna bus calls go through the
   raw `PalmServiceBridge` binding every webOS webview injects (no webOSTV.js
   library in the bundle); a bus call cannot be truly aborted, so its timeout
   rejects and lets any late response fall on the floor. The public interface:
   - `initTvEnv(): Promise<void>` — startup hook, awaited before the first
     frame (`main.jsx`); on the real device it pings the
     `com.olevod.app.service` Luna service (2s timeout) and, on an
     `ok`+`proxyPort` reply, records device mode and the actual proxy port (it
     may have incremented past its default on conflict). Never throws — a dead
     service just means direct mode;
   - `transportGet(url, {signal}): Promise<text>` — fetches a fully-built,
     already-signed URL as text via Luna (10s timeout) on the device or direct
     fetch elsewhere;
   - `mediaUrl(rawUrl): string` — returned unchanged in the browser; on the
     real device rewritten to the local proxy,
     `http://127.0.0.1:{proxyPort}/proxy/{host}{path}{query}`;
   - `exitApp()` — webOS back-chain terminal (`webOS.platformBack`, falling
     back to `window.close`), kept here so environment probing never leaks
     outside this module.
2. Direct transport: `fetch` with an `Accept: application/json` header, passing
   through the caller's `AbortSignal` for a real cancelable timeout; a non-2xx
   status throws `HTTP {status}`, otherwise the raw response text is returned.
   Both the OleVod API and its CDN return `Access-Control-Allow-Origin:*`, so the
   browser can reach them directly with no dev proxy needed.

### http.js — unified fetching

3. `apiGet(path)` flow: prepend `https://api.olelive.com` and append the
   `?_vv=` signature (T04) -> `transportGet` -> `JSON.parse` -> validate
   `code===0` (throw `ApiError(msg, code)` if nonzero — an exported Error
   subclass so callers can tell a business rejection from a transport failure)
   -> if `data` is a non-empty string, try `aesDecryptToJson`, and use the
   decrypted result on success -> return `data`.
4. **Timeout + retry**: each attempt has a hard `TIMEOUT_MS=3000` cutoff, retrying
   up to `RETRY_LIMIT=3` times total; each attempt **re-signs** the request (a
   fresh `_vv`). Only retry network/timeout/parse errors — a nonzero business
   code (`ApiError`) is a valid response and is rethrown immediately. (The
   OleVod API occasionally hangs for tens of seconds; a short cutoff plus
   retries turns that into a fast self-healing round trip.)
5. On the direct-fetch path, use `AbortController` to genuinely cancel an
   in-flight request; the Luna path cannot be interrupted, so a timeout there
   just rejects and lets the call finish in the background (documented in a
   comment).
6. If the Luna path fails, fall back to direct fetch once within the same
   attempt (a safety net for the service becoming unavailable mid-flight).

## Explicitly out of scope

- The Luna service and local media proxy themselves (T21) and on-device
  validation of this transport (T22);
- Wrapping business endpoints (T06).

## Acceptance criteria

- [ ] In the browser, `apiGet('/v1/pub/vod/list/type')` returns the unwrapped
      `data` object;
- [ ] With the network off or pointed at a broken domain, it throws after 3
      attempts, taking at most roughly 10s total (3s x 3 plus overhead), never
      hanging indefinitely;
- [ ] A list endpoint that returns AES ciphertext gets transparently decrypted
      (the returned body is already an object, with no awareness needed at the
      business layer);
- [ ] `grep -R "fetch(" src/` has no hits outside of `luna.js` (verifies the
      transport chokepoint).
