/*
 * The single fetch entry point for the whole app. Business code calls
 * apiGet(path) and gets back the already-unwrapped, already-decrypted `data`.
 *
 * Pipeline per request: sign (?_vv=) -> transport -> parse -> validate code===0
 * -> transparently AES-decrypt the `data` field if it is ciphertext.
 *
 * Timeout + retry: the OleVod API occasionally hangs for tens of seconds, so
 * each attempt has a hard 3s cutoff and we retry up to 3 times, RE-SIGNING each
 * attempt (a stale _vv must never be reused). Only network/timeout/parse errors
 * are retried — a nonzero business code is a valid response and is returned as
 * an error immediately.
 */
import { vvNow, aesDecryptToJson } from './sign.js'
import { transportGet } from './luna.js'

const API_BASE = 'https://api.olelive.com'
const TIMEOUT_MS = 3000
const RETRY_LIMIT = 3

// A nonzero `code` in the response body. Thrown so callers can tell a valid
// "business rejection" apart from a transport failure — and so we never retry it.
export class ApiError extends Error {
  constructor(message, code) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

// Append the freshly-computed _vv signature to a path.
function sign(path) {
  const sep = path.includes('?') ? '&' : '?'
  return `${API_BASE}${path}${sep}_vv=${vvNow()}`
}

/**
 * Fetch an API path and return the unwrapped business `data`.
 * @param {string} path e.g. '/v1/pub/vod/list/type'
 */
export async function apiGet(path) {
  let lastErr
  for (let attempt = 0; attempt < RETRY_LIMIT; attempt++) {
    const url = sign(path) // re-sign every attempt with a fresh timestamp
    const controller = new AbortController()
    let timer
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort() // genuinely cancels the direct-fetch path
        reject(new Error('timeout'))
      }, TIMEOUT_MS)
    })

    try {
      // Race the transport against the timeout. On the Luna path the underlying
      // call can't be cancelled, so it simply finishes in the background while
      // we reject here and move on.
      const text = await Promise.race([transportGet(url, { signal: controller.signal }), timeout])
      clearTimeout(timer)

      const json = JSON.parse(text)
      if (json.code !== 0) {
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
    } catch (e) {
      clearTimeout(timer)
      if (e instanceof ApiError) throw e // don't retry a valid business rejection
      lastErr = e // network / timeout / parse -> retry with a new signature
    }
  }
  throw lastErr || new Error('request failed')
}
