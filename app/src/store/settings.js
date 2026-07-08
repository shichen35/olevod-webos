/*
 * Settings — deliberately minimal. This version only remembers whether the
 * player's first-use hint has been shown.
 *
 * No appearance toggles (reduceMotion / disableGlass): the app has no animation
 * or translucency anywhere by design, so such switches would be meaningless.
 */
import { createStore } from '../hooks/useStore.js'

const DEFAULTS = {
  playerHintShown: false,
}

export const settingsStore = createStore('olevod:settings', { ...DEFAULTS })

export function getSetting(key) {
  const v = settingsStore.get()[key]
  return v === undefined ? DEFAULTS[key] : v
}

export function setSetting(key, value) {
  settingsStore.set((prev) => ({ ...prev, [key]: value }))
}
