/*
 * In-memory, session-scoped page-data cache. NOT persisted — cleared on reload.
 *
 * Lets pages render instantly when revisited (switch tab and back with no
 * spinner) while `loadOnce` dedupes concurrent fetches for the same key, and
 * `invalidate(prefix)` lets a refresh (refreshNonce, T15) force a refetch.
 */
const cache = new Map() // key -> resolved data
const inflight = new Map() // key -> Promise (dedupe concurrent loads)

// Synchronous cache read; undefined on a miss.
export function get(key) {
  return cache.has(key) ? cache.get(key) : undefined
}

export function has(key) {
  return cache.has(key)
}

/**
 * Return cached data if present; otherwise run `loader()` once, caching the
 * result. Concurrent calls for the same key share a single in-flight promise.
 */
export function loadOnce(key, loader) {
  if (cache.has(key)) return Promise.resolve(cache.get(key))
  if (inflight.has(key)) return inflight.get(key)

  const p = Promise.resolve()
    .then(loader)
    .then((data) => {
      cache.set(key, data)
      inflight.delete(key)
      return data
    })
    .catch((err) => {
      inflight.delete(key) // don't cache failures — allow a retry
      throw err
    })

  inflight.set(key, p)
  return p
}

// Drop every entry whose key starts with `prefix` (both cached and in-flight).
export function invalidate(prefix = '') {
  for (const k of [...cache.keys()]) if (k.startsWith(prefix)) cache.delete(k)
  for (const k of [...inflight.keys()]) if (k.startsWith(prefix)) inflight.delete(k)
}

export function clear() {
  cache.clear()
  inflight.clear()
}
