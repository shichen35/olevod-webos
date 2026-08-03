/*
 * Filters — the current filter selection per category, held for the session
 * only: it is what the filter panel opens with after the genre chips (or an
 * earlier apply) changed the selection.
 *
 * Deliberately NOT persisted. A saved filter is invisible from the tab bar, so
 * launching the app into a category that silently sits on last week's
 * 地区/年代 choice reads as an empty or broken list. Every launch starts from
 * the category's default filter instead; within a session the tabs stay mounted
 * and keep their own selection anyway.
 *
 * Shape: { [categoryId]: { genre, area, year, sort } }
 */
let selections = {}

export function getFilter(categoryId) {
  return selections[categoryId] || null
}

export function setFilter(categoryId, selection) {
  selections = { ...selections, [categoryId]: selection }
}
