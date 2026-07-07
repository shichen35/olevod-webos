/*
 * Top-level tab model, derived entirely from the taxonomy. The tab bar (T08),
 * routing, and per-tab content areas all read TABS from here — so adding a
 * category in taxonomy.js grows this list with no edits here.
 */
import { CATEGORIES } from './taxonomy.js'

// kind: 'home' | 'category' | 'mine'
export const TABS = [
  { key: 'home', label: '首页', kind: 'home' },
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
