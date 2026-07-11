# T21 Luna Background Service: Fetch + Local HLS Proxy

> Milestone D | Depends on: none (can be built in parallel with B/C) |
> Deliverable: `service/com.olevod.app.service/`

## Goal

A webOS background JS service (Node 16, CommonJS) with a single process
handling two jobs: a Luna `fetch` method (API JSON retrieval) and a
`127.0.0.1` local HTTP proxy (HLS/image media streaming). This is the other
half of the data channel needed once the app is packaged onto the device.

## References

- Skill: `reference/service-and-proxy.md` (full scaffold)
- Proxy allowlist and media-layer conclusions: header comment of
  `service/com.olevod.app.service/service.js` (the API gateway validates
  only the `_vv` signature; the CDN wants a Referer and rejects Origin)

## Requirements

1. **Service scaffold**: register `com.olevod.app.service` via
   `webos-service`; use `activityManager.create('keepAlive')` to prevent the
   background process from being reclaimed; use
   `process.on('uncaughtException')` to log and stay alive; **everything is
   CommonJS** (`require`). When `webos-service` is absent (a dev machine),
   catch the failed `require` and run in proxy-only mode so `node
   service.js` still works standalone for local acceptance.
2. **Luna methods**:
   - `ping`: returns `{ ok, proxyPort }` (used by the frontend for a
     startup handshake and to learn the actual proxy port);
   - `fetch`: `{ url }` (the URL arrives fully built and `_vv`-signed from
     the frontend) -> makes an https request -> returns
     `{ status, body }` where `body` is the **decompressed JSON text**.
     Only `api.olelive.com` is allowed (host allowlist). **Keep request headers minimal**: the API gateway only
     validates `_vv` and doesn't check Referer/Origin — a plain UA is
     sufficient, no need to spoof Client Hints / Fetch Metadata or other
     browser-style headers.
3. **Local proxy**: an HTTP server listening on `127.0.0.1`, defaulting to
   port 7654 and incrementing if taken, with the actual port reported via
   `ping`. Route `/proxy/{host}/{path}`:
   - **host allowlist**: `*.olemovienews.com` (suffix match, since the CDN
     uses multiple region-based domains), `static.olelive.com` — never act
     as an open proxy;
   - inject `Referer: https://www.olevod.com/` on CDN requests; **do not
     send `Origin`** (the CDN is sensitive to Origin and returns 403 if
     present);
   - **force `Accept-Encoding: identity`**: the byte path pipes data
     through as-is, and gzip would corrupt `Content-Range`/`Content-Length`
     and break the player's Range requests;
   - pass through `Range` and 206 responses; add
     `Access-Control-Allow-Origin: *` to responses;
   - use a keep-alive `https.Agent` (TLS session reuse — handshakes are
     expensive on the TV's CPU);
   - upstream timeout (~10s) and destroy the upstream socket on client
     disconnect, so a single stuck segment can't hang playback.
4. Write logs to `/tmp/olevod-service.log` (append-only; a failing log
   write must never take the service down) — the service's `console.log`
   output does not go to `journald` (a conclusion from the skill), so
   debugging needs an explicit exit path.

## Explicitly out of scope

- Signature computation (stays in the frontend, shared by both channels);
- Caching, rate limiting, transcoding.

## Acceptance criteria

- [ ] Running `node service.js` directly on a Mac (local simulation) works:
      `curl 127.0.0.1:7654/proxy/...` fetches m3u8 and .ts files correctly,
      and `Range: bytes=0-1000` returns 206 with the correct length;
- [ ] Hosts outside the allowlist return 403;
- [ ] `curl --compressed` confirms segment responses have no
      `Content-Encoding`;
- [ ] On-device acceptance (depends on deployment via T23, tested
      afterward): Luna `ping`/`fetch` work, and the proxy port increments
      correctly on conflict.
