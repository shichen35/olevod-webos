/*
 * Settings — persisted user preferences. Older persisted snapshots may predate
 * a key, so reads go through getSetting() to fall back to the default.
 */
import { createStore } from '../hooks/useStore.js'

const DEFAULTS = {
  homeShowFavorites: true, // "我的收藏" shelf on Home
  homeShowRecent: true, // "继续观看" shelf on Home
}

export const settingsStore = createStore('olevod:settings', DEFAULTS)

export function getSetting(snapshot, key) {
  return snapshot[key] ?? DEFAULTS[key]
}

export function toggleSetting(key) {
  settingsStore.set((prev) => ({ ...prev, [key]: !getSetting(prev, key) }))
}
