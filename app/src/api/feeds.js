/*
 * Shared feed loaders + cache keys. Both the pages and the startup prefetch go
 * through these so they hit the SAME pageCache keys — a prefetch and a page's
 * own fetch dedupe into one request (first caller wins, the rest read cache).
 */
import { categoryList, banners } from './olevod.js'
import { CATEGORIES, DEFAULT_SORT, DEFAULT_MEMBER } from '../config/taxonomy.js'
import * as pageCache from '../store/pageCache.js'

export const HOME_POPULAR_KEY = 'home:popular'
export const HOME_BANNERS_KEY = 'home:banners'

// The home page's featured row. Failure is not an error state: the page simply
// opens on its shelves instead.
export function loadHomeBanners() {
  return pageCache.loadOnce(HOME_BANNERS_KEY, banners)
}

// The home page's popular rows, one per category in tab order.
export const POPULAR = [
  { key: 'movie', title: '热门电影', category: 1 },
  { key: 'variety', title: '热门综艺', category: 3 },
  { key: 'series', title: '热门连续剧', category: 2 },
  { key: 'anime', title: '热门动漫', category: 4 },
]

// Concurrent within the row set (allSettled) but exposed as one cached unit.
export function loadHomePopular() {
  return pageCache.loadOnce(HOME_POPULAR_KEY, async () => {
    const results = await Promise.allSettled(
      POPULAR.map((p) => categoryList({ category: p.category, sort: 'hot', size: 12 })),
    )
    return POPULAR.map((p, i) => ({
      ...p,
      items: results[i].status === 'fulfilled' ? results[i].value.items : [],
    }))
  })
}

export function defaultFilter() {
  return { genre: '0', area: '0', year: '0', member: DEFAULT_MEMBER, sort: DEFAULT_SORT }
}

export function categoryFirstPageKey(category, f) {
  return `cat:${category}:${f.genre}:${f.area}:${f.year}:${f.member}:${f.sort}:p1`
}

export function loadCategoryFirstPage(category, f, size = 24) {
  return pageCache.loadOnce(categoryFirstPageKey(category, f), () =>
    categoryList({ category, ...f, page: 1, size }),
  )
}

/**
 * Sequential background prefetch. Signed requests starve each other when fired
 * concurrently, so warm the caches one at a time: home first (the default
 * landing tab), then each category's first screen. Every category is warmed at
 * its DEFAULT filter, which is also what its page opens with (filters are not
 * persisted across launches), so the prefetch and the page share one cache key.
 * Failures are swallowed — a tab that's actually opened runs its own
 * loading/retry path. Pass a `shouldStop()` predicate to abort early (e.g. on
 * unmount).
 */
export async function prefetchAll(shouldStop = () => false) {
  try {
    await loadHomePopular()
  } catch {
    /* silent */
  }
  if (shouldStop()) return
  try {
    await loadHomeBanners()
  } catch {
    /* silent */
  }
  for (const c of CATEGORIES) {
    if (shouldStop()) return
    try {
      await loadCategoryFirstPage(c.id, defaultFilter())
    } catch {
      /* silent */
    }
  }
}
