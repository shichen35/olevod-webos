/*
 * Pure-algorithm gateway dependencies:
 *   1. `_vv` request signature — every GET must carry ?_vv=<sig> or the gateway
 *      returns 401. Derived from the current Unix timestamp (seconds).
 *   2. AES-CBC decryption of the `data` field some list endpoints return.
 *
 * No network, no environment checks — just math. See doc/olevod-api.md §4.2 for
 * the reference (Python) implementation this is verified against.
 *
 * CLOCK CONSTRAINT: the signature is a function of the device clock. If the TV's
 * clock is wrong, every request 401s — check the time first when debugging auth.
 */

// ---------------------------------------------------------------------------
// MD5 — pure JS. Chromium 108's WebCrypto has no MD5, so we bundle one.
// Operates on a UTF-8 byte view of the input and returns a lowercase hex digest.
// ---------------------------------------------------------------------------
function md5(input) {
  const msg = utf8Bytes(input)

  function rl(x, c) {
    return (x << c) | (x >>> (32 - c))
  }
  function add(a, b) {
    return (a + b) & 0xffffffff
  }
  function cmn(q, a, b, x, s, t) {
    return add(rl(add(add(a, q), add(x, t)), s), b)
  }
  const FF = (a, b, c, d, x, s, t) => cmn((b & c) | (~b & d), a, b, x, s, t)
  const GG = (a, b, c, d, x, s, t) => cmn((b & d) | (c & ~d), a, b, x, s, t)
  const HH = (a, b, c, d, x, s, t) => cmn(b ^ c ^ d, a, b, x, s, t)
  const II = (a, b, c, d, x, s, t) => cmn(c ^ (b | ~d), a, b, x, s, t)

  // Pad the message: append 0x80, zero-pad to 56 mod 64, then 64-bit length.
  const bitLen = msg.length * 8
  const withPad = [...msg, 0x80]
  while (withPad.length % 64 !== 56) withPad.push(0)
  // append length as 64-bit little-endian
  for (let i = 0; i < 8; i++) {
    withPad.push((bitLen / Math.pow(2, 8 * i)) & 0xff)
  }

  let a = 0x67452301
  let b = 0xefcdab89
  let c = 0x98badcfe
  let d = 0x10325476

  for (let off = 0; off < withPad.length; off += 64) {
    const x = new Array(16)
    for (let i = 0; i < 16; i++) {
      const j = off + i * 4
      x[i] = withPad[j] | (withPad[j + 1] << 8) | (withPad[j + 2] << 16) | (withPad[j + 3] << 24)
    }
    const aa = a
    const bb = b
    const cc = c
    const dd = d

    a = FF(a, b, c, d, x[0], 7, 0xd76aa478)
    d = FF(d, a, b, c, x[1], 12, 0xe8c7b756)
    c = FF(c, d, a, b, x[2], 17, 0x242070db)
    b = FF(b, c, d, a, x[3], 22, 0xc1bdceee)
    a = FF(a, b, c, d, x[4], 7, 0xf57c0faf)
    d = FF(d, a, b, c, x[5], 12, 0x4787c62a)
    c = FF(c, d, a, b, x[6], 17, 0xa8304613)
    b = FF(b, c, d, a, x[7], 22, 0xfd469501)
    a = FF(a, b, c, d, x[8], 7, 0x698098d8)
    d = FF(d, a, b, c, x[9], 12, 0x8b44f7af)
    c = FF(c, d, a, b, x[10], 17, 0xffff5bb1)
    b = FF(b, c, d, a, x[11], 22, 0x895cd7be)
    a = FF(a, b, c, d, x[12], 7, 0x6b901122)
    d = FF(d, a, b, c, x[13], 12, 0xfd987193)
    c = FF(c, d, a, b, x[14], 17, 0xa679438e)
    b = FF(b, c, d, a, x[15], 22, 0x49b40821)

    a = GG(a, b, c, d, x[1], 5, 0xf61e2562)
    d = GG(d, a, b, c, x[6], 9, 0xc040b340)
    c = GG(c, d, a, b, x[11], 14, 0x265e5a51)
    b = GG(b, c, d, a, x[0], 20, 0xe9b6c7aa)
    a = GG(a, b, c, d, x[5], 5, 0xd62f105d)
    d = GG(d, a, b, c, x[10], 9, 0x02441453)
    c = GG(c, d, a, b, x[15], 14, 0xd8a1e681)
    b = GG(b, c, d, a, x[4], 20, 0xe7d3fbc8)
    a = GG(a, b, c, d, x[9], 5, 0x21e1cde6)
    d = GG(d, a, b, c, x[14], 9, 0xc33707d6)
    c = GG(c, d, a, b, x[3], 14, 0xf4d50d87)
    b = GG(b, c, d, a, x[8], 20, 0x455a14ed)
    a = GG(a, b, c, d, x[13], 5, 0xa9e3e905)
    d = GG(d, a, b, c, x[2], 9, 0xfcefa3f8)
    c = GG(c, d, a, b, x[7], 14, 0x676f02d9)
    b = GG(b, c, d, a, x[12], 20, 0x8d2a4c8a)

    a = HH(a, b, c, d, x[5], 4, 0xfffa3942)
    d = HH(d, a, b, c, x[8], 11, 0x8771f681)
    c = HH(c, d, a, b, x[11], 16, 0x6d9d6122)
    b = HH(b, c, d, a, x[14], 23, 0xfde5380c)
    a = HH(a, b, c, d, x[1], 4, 0xa4beea44)
    d = HH(d, a, b, c, x[4], 11, 0x4bdecfa9)
    c = HH(c, d, a, b, x[7], 16, 0xf6bb4b60)
    b = HH(b, c, d, a, x[10], 23, 0xbebfbc70)
    a = HH(a, b, c, d, x[13], 4, 0x289b7ec6)
    d = HH(d, a, b, c, x[0], 11, 0xeaa127fa)
    c = HH(c, d, a, b, x[3], 16, 0xd4ef3085)
    b = HH(b, c, d, a, x[6], 23, 0x04881d05)
    a = HH(a, b, c, d, x[9], 4, 0xd9d4d039)
    d = HH(d, a, b, c, x[12], 11, 0xe6db99e5)
    c = HH(c, d, a, b, x[15], 16, 0x1fa27cf8)
    b = HH(b, c, d, a, x[2], 23, 0xc4ac5665)

    a = II(a, b, c, d, x[0], 6, 0xf4292244)
    d = II(d, a, b, c, x[7], 10, 0x432aff97)
    c = II(c, d, a, b, x[14], 15, 0xab9423a7)
    b = II(b, c, d, a, x[5], 21, 0xfc93a039)
    a = II(a, b, c, d, x[12], 6, 0x655b59c3)
    d = II(d, a, b, c, x[3], 10, 0x8f0ccc92)
    c = II(c, d, a, b, x[10], 15, 0xffeff47d)
    b = II(b, c, d, a, x[1], 21, 0x85845dd1)
    a = II(a, b, c, d, x[8], 6, 0x6fa87e4f)
    d = II(d, a, b, c, x[15], 10, 0xfe2ce6e0)
    c = II(c, d, a, b, x[6], 15, 0xa3014314)
    b = II(b, c, d, a, x[13], 21, 0x4e0811a1)
    a = II(a, b, c, d, x[4], 6, 0xf7537e82)
    d = II(d, a, b, c, x[11], 10, 0xbd3af235)
    c = II(c, d, a, b, x[2], 15, 0x2ad7d2bb)
    b = II(b, c, d, a, x[9], 21, 0xeb86d391)

    a = add(a, aa)
    b = add(b, bb)
    c = add(c, cc)
    d = add(d, dd)
  }

  return hex32(a) + hex32(b) + hex32(c) + hex32(d)
}

// 32-bit int -> 8 lowercase hex chars, little-endian byte order (MD5 output order).
function hex32(n) {
  let s = ''
  for (let i = 0; i < 4; i++) {
    s += ((n >>> (i * 8)) & 0xff).toString(16).padStart(2, '0')
  }
  return s
}

function utf8Bytes(str) {
  return Array.from(new TextEncoder().encode(str))
}

// ---------------------------------------------------------------------------
// _vv signature
// ---------------------------------------------------------------------------
/**
 * Compute the `_vv` signature for a Unix timestamp (seconds).
 * Bit-transposes each timestamp digit into four short hex chunks, then
 * interleaves them with slices of md5(timestamp). See doc/olevod-api.md §4.2.
 */
export function vv(ts) {
  const t = String(ts)
  const cols = ['', '', '', '']
  for (const ch of t) {
    // ASCII code -> binary string (no leading '0b'); digits are all 6 bits.
    const b = ch.charCodeAt(0).toString(2)
    cols[0] += b.slice(2, 3)
    cols[1] += b.slice(3, 4)
    cols[2] += b.slice(4, 5)
    cols[3] += b.slice(5)
  }
  const pieces = cols.map((s) => {
    const hx = s ? parseInt(s, 2).toString(16) : ''
    return hx.padStart(3, '0') // len<=2 -> left-pad to 3; len>=3 -> unchanged
  })
  const n = md5(t)
  return (
    n.slice(0, 3) + pieces[0] +
    n.slice(6, 11) + pieces[1] +
    n.slice(14, 19) + pieces[2] +
    n.slice(22, 27) + pieces[3] +
    n.slice(30)
  )
}

/** `_vv` for the current time. Recompute per request — never cache it. */
export function vvNow() {
  return vv(Math.floor(Date.now() / 1000))
}

// ---------------------------------------------------------------------------
// AES-CBC payload decryption
// ---------------------------------------------------------------------------
// Local date as "YYYY-MM-DD" (the key/IV are derived from today's date).
function todayStr() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function base64ToBytes(b64) {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/**
 * Decrypt an AES-128-CBC / PKCS7 base64 payload to a JSON object.
 * key = md5("YYYY-MM-DD")[8:24] (16 ASCII chars), IV = key.
 * Returns null on ANY failure — callers use null to mean "not actually
 * ciphertext" (some endpoints return plain JSON in the same field).
 */
export async function aesDecryptToJson(cipherB64) {
  try {
    if (!cipherB64 || typeof cipherB64 !== 'string') return null
    const keyStr = md5(todayStr()).slice(8, 24) // 16 chars = 16 bytes (ASCII)
    const keyBytes = new TextEncoder().encode(keyStr)
    const cipherBytes = base64ToBytes(cipherB64)

    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-CBC' }, false, ['decrypt'])
    const plainBuf = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: keyBytes }, key, cipherBytes)
    const text = new TextDecoder().decode(plainBuf)
    return JSON.parse(text)
  } catch {
    return null
  }
}

// Exposed for tests / debugging.
export { md5 }
