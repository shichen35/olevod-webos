/*
 * Filters — the last filter selection per category, so returning to a category
 * page restores the user's previous genre/area/year/sort choice.
 * Shape: { [categoryId]: { genre, area, year, sort } }
 */
import { createStore } from '../hooks/useStore.js'

export const filtersStore = createStore('olevod:filters', {})

export function getFilter(categoryId) {
  return filtersStore.get()[categoryId] || null
}

export function setFilter(categoryId, selection) {
  filtersStore.set((prev) => ({ ...prev, [categoryId]: selection }))
}
