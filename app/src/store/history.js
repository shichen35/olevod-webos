/*
 * Watch history — a capped, most-recent-first list of watched titles, each
 * carrying resume progress { lastEpisodeIndex, position, duration }.
 *
 * `watch` is the resume point: position 0 means "start this episode from the
 * beginning" (the previous one was finished); null means there is nothing to
 * resume (all episodes finished, or never played far enough).
 *
 * Consumed by: the home "Continue Watching" shelf (progress bar), the detail
 * page's "Continue Watching Episode N", and the player's resume feature.
 */
import { createStore } from '../hooks/useStore.js'

const CAP = 40

export const historyStore = createStore('olevod:history', [])

export function list() {
  return historyStore.get()
}

// Record (or bump to front) that a title was opened. Preserves any existing
// resume progress for that title.
export function recordHistory(item) {
  historyStore.set((prev) => {
    const existing = prev.find((x) => x.id === item.id)
    const rest = prev.filter((x) => x.id !== item.id)
    const entry = { ...item, watch: existing?.watch || null }
    return [entry, ...rest].slice(0, CAP)
  })
}

// Update resume progress for a title and bump it to the front. If the title
// isn't in history yet, it is added (so progress from a fresh play is kept).
export function recordProgress(id, lastEpisodeIndex, position, duration) {
  historyStore.set((prev) => {
    const existing = prev.find((x) => x.id === id)
    const rest = prev.filter((x) => x.id !== id)
    const base = existing || { id }
    return [{ ...base, watch: { lastEpisodeIndex, position, duration } }, ...rest].slice(0, CAP)
  })
}

// Drop a title's resume point (last episode finished) but keep it in history.
export function clearProgress(id) {
  historyStore.set((prev) => {
    const existing = prev.find((x) => x.id === id)
    if (!existing || !existing.watch) return prev
    return prev.map((x) => (x.id === id ? { ...x, watch: null } : x))
  })
}

export function getWatchState(id) {
  return historyStore.get().find((x) => x.id === id)?.watch || null
}

export function clear() {
  historyStore.set([])
}
