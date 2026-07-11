# T04 `_vv` Request Signing and AES Payload Decryption

> Milestone A | Prerequisite: T01 | Output: `src/api/sign.js`

## Goal

Implement the two pure-algorithm dependencies of the OleVod gateway: the `_vv`
timestamp signature (its absence causes a 401) and AES-CBC decryption of the
`data` field returned by certain list endpoints. This is a pure-function module
with no dependency on any runtime-environment check.

## Reference

- Implementation: `app/src/api/sign.js` (the algorithm description below is
  authoritative; the code is the reference)

## Requirements

1. **`vv(ts)` / `vvNow()`**: input a Unix timestamp in seconds, output the
   signature string. Algorithm: take the ASCII binary of each digit character in
   the timestamp and "transpose" it bitwise into four short hex segments (each
   left-padded with zeros to 3 characters; longer values are kept as-is), then
   interleave them with slices of `md5(timestamp)`
   (`[0:3] [6:11] [14:19] [22:27] [30:]`).
2. **Bundled MD5**: Chromium 108's WebCrypto has no MD5, so include a small pure-JS
   MD5 implementation (a single function is enough, no external dependency).
   Export `md5` too, for tests and debugging.
3. **`aesDecryptToJson(cipherB64)`**: AES-128-CBC / PKCS7; key = characters
   `[8:24]` (16 bytes) of `md5("YYYY-MM-DD")` for today's local date, IV = key.
   Implement with WebCrypto's `subtle.decrypt`; base64-decode -> decrypt ->
   `JSON.parse`; return `null` on any failure (callers use this to detect
   "not actually ciphertext").
4. Document a constraint in a comment: the signature depends on the device
   clock — if the TV's clock is off, requests get 401s, so check the time first
   when troubleshooting.

## Explicitly out of scope

- Network requests and environment detection (that's T05);
- Caching the signature (recompute on every request; a retry must use a fresh
  `_vv`).

## Acceptance criteria

- [ ] For a batch of timestamps (including ones with zeros and varying
      lengths), `vv(ts)` is deterministic and its output decomposes back into
      exactly the documented construction — the `md5(timestamp)` slices
      `[0:3] [6:11] [14:19] [22:27] [30:]` interleaved with the four
      bit-transposed pieces — recompute a few samples by hand to confirm;
- [ ] Verified in the browser console: `fetch('https://api.olelive.com/v1/pub/vod/list/type?_vv='+vvNow())`
      returns 200 with `code===0`; omitting `_vv` returns 401;
- [ ] Decrypting a real AES ciphertext sample yields valid JSON; decrypting a
      plain string returns `null` without throwing.
