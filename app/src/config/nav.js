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

export function tabByKey(key) {
  return TABS.find((t) => t.key === key) || null
}

/*
 * TABS rearranged by the user's saved order (settings.tabOrder — an array of
 * middle-tab keys). Home stays first and 我的 stays last; middle tabs follow
 * the saved order, and categories added after the order was saved keep their
 * natural position at the end of the middle section.
 */
export function orderedTabs(order) {
  if (!order || !order.length) return TABS
  const middle = TABS.slice(1, -1)
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
  return [TABS[0], ...sorted, TABS[TABS.length - 1]]
}
