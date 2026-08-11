/*
 * Watch history — a capped, most-recent-first list of watched titles, each
 * carrying resume progress { lastEpisodeIndex, position, duration, finished }.
 *
 * `watch` is the resume point: position 0 means "start this episode from the
 * beginning" (the previous one was finished); null means never played far
 * enough to be worth resuming. `finished: true` marks that lastEpisodeIndex
 * was watched to its end with no next episode at the time — kept (instead of
 * cleared) so a title that later airs a new episode can resume there instead
 * of losing all trace of how far it got.
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
export function recordProgress(id, lastEpisodeIndex, position, duration, finished = false) {
  historyStore.set((prev) => {
    const existing = prev.find((x) => x.id === id)
    const rest = prev.filter((x) => x.id !== id)
    const base = existing || { id }
    return [{ ...base, watch: { lastEpisodeIndex, position, duration, finished } }, ...rest].slice(0, CAP)
  })
}

export function getWatchState(id) {
  return historyStore.get().find((x) => x.id === id)?.watch || null
}

export function clear() {
  historyStore.set([])
}
