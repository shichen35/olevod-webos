/*
 * Top-level tab model, derived from the taxonomy. The tab bar (T08), routing,
 * and per-tab content areas all read TABS from here — so adding a category in
 * taxonomy.js grows this list with no edits here.
 *
 * Pinned tabs keep their place and can't be hidden: the personal tabs at the
 * end (收藏 / 历史 / 设置) — 设置 holds the entry that brings hidden tabs back.
 * 首页 stays first whenever it is shown; everything else in between is the
 * user-orderable middle.
 */
import { CATEGORIES } from './taxonomy.js'

// kind: 'home' | 'search' | 'category' | 'favorites' | 'history' | 'settings'
export const TABS = [
  { key: 'home', label: '首页', kind: 'home' },
  { key: 'search', label: '搜索', kind: 'search' },
  ...CATEGORIES.map((c) => ({
    key: `cat-${c.id}`,
    label: c.name,
    kind: 'category',
    categoryId: c.id,
  })),
  { key: 'favorites', label: '收藏', kind: 'favorites', pinned: true },
  { key: 'history', label: '历史', kind: 'history', pinned: true },
  { key: 'settings', label: '设置', kind: 'settings', pinned: true },
]

export const HOME_TAB_KEY = 'home'

export function tabByKey(key) {
  return TABS.find((t) => t.key === key) || null
}

// The tabs the user can reorder and hide, in natural order.
export const MIDDLE_TABS = TABS.filter((t) => !t.pinned && t.key !== HOME_TAB_KEY)

/*
 * TABS rearranged by the user's saved order (settings.tabOrder — an array of
 * middle-tab keys) and filtered by the hidden set (settings.hiddenTabs). Pinned
 * tabs and 首页 keep their slots; the middle tabs follow the saved order, and
 * categories added after the order was saved keep their natural position at
 * the end of the middle section. Keys the order names but TABS no longer has
 * are ignored.
 */
export function orderedTabs(order, hidden = []) {
  const visible = (t) => t.pinned || !hidden.includes(t.key)
  const middle = MIDDLE_TABS.filter(visible)
  let sorted = middle
  if (order && order.length) {
    const byKey = new Map(middle.map((t) => [t.key, t]))
    sorted = []
    for (const key of order) {
      const t = byKey.get(key)
      if (t) {
        sorted.push(t)
        byKey.delete(key)
      }
    }
    for (const t of middle) {
      if (byKey.has(t.key)) sorted.push(t)
    }
  }
  const result = []
  let middleEmitted = false
  for (const t of TABS) {
    if (t.pinned || t.key === HOME_TAB_KEY) {
      if (visible(t)) result.push(t)
    } else if (!middleEmitted) {
      result.push(...sorted)
      middleEmitted = true
    }
  }
  return result
}

// Every middle tab's key in the effective order, hidden ones included — the
// complete list settings.tabOrder should hold so a re-shown tab keeps its slot.
export function middleTabKeys(order) {
  return orderedTabs(order, []).filter((t) => !t.pinned && t.key !== HOME_TAB_KEY).map((t) => t.key)
}
