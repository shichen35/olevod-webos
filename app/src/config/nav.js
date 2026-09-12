/*
 * Top-level tab model, derived entirely from the taxonomy. The tab bar (T08),
 * routing, and per-tab content areas all read TABS from here — so adding a
 * category in taxonomy.js grows this list with no edits here.
 */
import { CATEGORIES } from './taxonomy.js'

// kind: 'home' | 'search' | 'category' | 'mine'
export const TABS = [
  { key: 'home', label: '首页', kind: 'home' },
  { key: 'search', label: '搜索', kind: 'search' },
  ...CATEGORIES.map((c) => ({
    key: `cat-${c.id}`,
    label: c.name,
    kind: 'category',
    categoryId: c.id,
  })),
  { key: 'mine', label: '我的', kind: 'mine' },
]

// 我的 is never hidden: it holds the settings entry that brings hidden tabs
// back. 首页 keeps its place at the front whenever it is shown.
export const PINNED_TAB_KEY = 'mine'
export const HOME_TAB_KEY = 'home'

export function tabByKey(key) {
  return TABS.find((t) => t.key === key) || null
}

/*
 * TABS rearranged by the user's saved order (settings.tabOrder — an array of
 * middle-tab keys) and filtered by the hidden set (settings.hiddenTabs). Home
 * stays first and 我的 stays last; middle tabs follow the saved order, and
 * categories added after the order was saved keep their natural position at the
 * end of the middle section.
 */
export function orderedTabs(order, hidden = []) {
  const visible = (t) => t.key === PINNED_TAB_KEY || !hidden.includes(t.key)
  if (!order || !order.length) return TABS.filter(visible)
  const middle = TABS.slice(1, -1).filter(visible)
  const byKey = new Map(middle.map((t) => [t.key, t]))
  const sorted = []
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
  const head = visible(TABS[0]) ? [TABS[0]] : []
  return [...head, ...sorted, TABS[TABS.length - 1]]
}
