/*
 * The single fetch entry point for the whole app. Business code calls
 * apiGet(path) / apiPost(path, body) and gets back the already-unwrapped,
 * already-decrypted `data`.
 *
 * Pipeline per request: sign (?_vv=, GET only) + session params -> transport ->
 * parse -> validate code===0 -> transparently AES-decrypt the `data` field if it
 * is ciphertext.
 *
 * Timeout + retry: the OleVod API occasionally hangs for tens of seconds, so
 * each GET attempt has a hard 3s cutoff and we retry up to 3 times, RE-SIGNING
 * each attempt (a stale _vv must never be reused). Only network/timeout/parse
 * errors are retried — a nonzero business code is a valid response and is
 * returned as an error immediately. POSTs are never retried: each one has a
 * side effect (a captcha request burns the previous image, a login consumes the
 * captcha), so a blind retry would turn a slow success into a confusing failure.
 *
 * Session: when signed in, every request (GET and POST) carries the three-part
 * token as `_he` / `_pl` / `_si` query params. The token is read through a
 * provider (store/session.js wires it) so this module holds no account state.
 */
import { vvNow, aesDecryptToJson } from './sign.js'
import { transportGet, transportPost } from './luna.js'

const API_BASE = 'https://api.olelive.com'
const TIMEOUT_MS = 3000
const RETRY_LIMIT = 3
// Login goes through captcha verification server-side and is noticeably slower
// than a list fetch; with no retry behind it, give it more room.
const POST_TIMEOUT_MS = 8000

// 12 = not signed in, 13/14/16 = session expired. Only meaningful when the
// request actually carried a token.
const AUTH_EXPIRED_CODES = new Set([12, 13, 14, 16])

// A nonzero `code` in the response body. Thrown so callers can tell a valid
// "business rejection" apart from a transport failure — and so we never retry it.
export class ApiError extends Error {
  constructor(message, code) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

let tokenProvider = () => null
let authExpiredHandler = null

/** Where the current session token comes from (null when signed out). */
export function setSessionTokenProvider(fn) {
  tokenProvider = fn || (() => null)
}

/** Called when a token-bearing request comes back with an auth-expired code. */
export function setAuthExpiredHandler(fn) {
  authExpiredHandler = fn
}

// Build the full URL: freshly-computed _vv (GET) plus the session params.
function buildUrl(path, { vv, token }) {
  const params = []
  if (vv) params.push(`_vv=${vvNow()}`)
  const parts = token ? token.split('.') : []
  if (parts.length === 3) {
    params.push(
      `_he=${encodeURIComponent(parts[0])}`,
      `_pl=${encodeURIComponent(parts[1])}`,
      `_si=${encodeURIComponent(parts[2])}`,
    )
  }
  if (!params.length) return `${API_BASE}${path}`
  const sep = path.includes('?') ? '&' : '?'
  return `${API_BASE}${path}${sep}${params.join('&')}`
}

// Race a transport call against a hard cutoff. On the Luna path the underlying
// call can't be cancelled, so it simply finishes in the background while we
// reject here and move on.
function withTimeout(run, ms) {
  const controller = new AbortController()
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort() // genuinely cancels the direct-fetch path
      reject(new Error('timeout'))
    }, ms)
  })
  return Promise.race([run(controller.signal), timeout]).finally(() => clearTimeout(timer))
}

// Parse + validate + decrypt one response body. `token` is the token the
// request was sent with, used to decide whether a rejection means our session
// died — and only if that token is still the current one, so a late response
// from before a re-login can't sign the new account out.
async function unwrap(text, token) {
  const json = JSON.parse(text)
  if (json.code !== 0) {
    if (token && AUTH_EXPIRED_CODES.has(json.code) && tokenProvider() === token) {
      authExpiredHandler?.()
    }
    // Valid response, business-level rejection — do not retry.
    throw new ApiError(json.msg || `code ${json.code}`, json.code)
  }

  let data = json.data
  // Some list endpoints return an AES-CBC ciphertext string in `data`.
  // Try to decrypt; aesDecryptToJson returns null when it isn't ciphertext,
  // in which case we keep the original value.
  if (typeof data === 'string' && data.length > 0) {
    const decrypted = await aesDecryptToJson(data)
    if (decrypted !== null) data = decrypted
  }
  return data
}

/**
 * Fetch an API path and return the unwrapped business `data`.
 * @param {string} path e.g. '/v1/pub/vod/list/type'
 */
export async function apiGet(path) {
  let lastErr
  for (let attempt = 0; attempt < RETRY_LIMIT; attempt++) {
    const token = tokenProvider()
    const url = buildUrl(path, { vv: true, token }) // re-sign every attempt with a fresh timestamp
    try {
      const text = await withTimeout((signal) => transportGet(url, { signal }), TIMEOUT_MS)
      return await unwrap(text, token)
    } catch (e) {
      if (e instanceof ApiError) throw e // don't retry a valid business rejection
      lastErr = e // network / timeout / parse -> retry with a new signature
    }
  }
  throw lastErr || new Error('request failed')
}

/**
 * POST a JSON body to an API path and return the unwrapped business `data`.
 * No `_vv`, no retry (see header).
 * @param {string} path e.g. '/pub/captcha'
 * @param {object} body
 */
export async function apiPost(path, body = {}) {
  const token = tokenProvider()
  const url = buildUrl(path, { vv: false, token })
  const text = await withTimeout((signal) => transportPost(url, JSON.stringify(body), { signal }), POST_TIMEOUT_MS)
  return unwrap(text, token)
}
