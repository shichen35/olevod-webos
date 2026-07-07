/*
 * Environment detection + transport selection. This is the ONE place the app is
 * allowed to call fetch(), so the business layer never knows whether it is
 * talking to the network directly (browser/dev) or through the Luna service
 * (real device).
 *
 * Two channels (see doc/olevod-api.md §6):
 *   - API JSON  -> Luna service on the real device, direct fetch in the browser.
 *   - Media     -> local HTTP proxy on the real device, unchanged in the browser.
 *
 * This task (T05) implements the browser/direct path in full and fixes the shape
 * of the real-device functions; T22 fills in the Luna bus call and the proxy
 * port wiring. Until then the TV branches safely fall back to direct fetch.
 */

// window.PalmSystem is injected only inside the webOS webview.
export const isTV = typeof window !== 'undefined' && !!window.PalmSystem

// Populated by initTvEnv() on the real device (T22).
let serviceReady = false
let proxyPort = null

/**
 * Startup hook: on the real device, ping the Luna service and retrieve the
 * local proxy port. In the browser this is a no-op. Defined here so the app
 * can `await initTvEnv()` at boot regardless of environment.
 */
export async function initTvEnv() {
  if (!isTV) return
  // T22: com.olevod.app.service ping -> set serviceReady = true and proxyPort.
  // Left disabled for now so transportGet() falls back to direct fetch on-device
  // rather than hitting an unimplemented Luna call.
}

// Direct network fetch — the browser/dev path, and the safety-net fallback on
// the device. Returns the raw response text; the caller parses/validates.
async function directGet(url, opts = {}) {
  // Both the API gateway and the CDN return Access-Control-Allow-Origin:*, so
  // the browser reaches them directly with no dev proxy.
  const res = await fetch(url, {
    signal: opts.signal,
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

// Real-device Luna transport. Interface fixed now; implemented in T22.
// NOTE: a Luna bus call cannot be aborted, so callers race it against their own
// timeout and let a slow call finish in the background.
// eslint-disable-next-line no-unused-vars
async function lunaFetch(url) {
  throw new Error('luna transport not implemented (T22)')
}

/**
 * Fetch a URL as text via the appropriate channel.
 * @param {string} url fully-built, already-signed URL
 * @param {{signal?: AbortSignal}} opts
 */
export async function transportGet(url, opts = {}) {
  if (isTV && serviceReady) {
    try {
      return await lunaFetch(url)
    } catch {
      // Service became unavailable mid-flight: fall back to direct fetch once.
      return directGet(url, opts)
    }
  }
  return directGet(url, opts)
}

/**
 * Map a media (m3u8/.ts) URL to a loadable address.
 * Browser: returned unchanged. Real device: rewritten to the local proxy so the
 * proxy can inject the CDN Referer and pass through Range/CORS (T22).
 */
export function mediaUrl(rawUrl) {
  if (isTV && proxyPort) {
    // T22: return `http://127.0.0.1:${proxyPort}/media?u=${encodeURIComponent(rawUrl)}`
    return rawUrl
  }
  return rawUrl
}
