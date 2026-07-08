/*
 * Home — the default landing screen. Horizontal shelves in this order:
 *   Continue Watching -> My Favorites -> Popular Movies / Variety / TV Series.
 *
 * Only the three popular rows hit the network (concurrently, via allSettled, so
 * one category failing just empties that row). Continue Watching and Favorites
 * come from the local stores and update live. Empty rows are not rendered, and
 * focus rows are numbered in actual render order so up/down stays continuous.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import Shelf from '../components/Shelf.jsx'
import { categoryList } from '../api/olevod.js'
import { useStoreValue } from '../hooks/useStore.js'
import { historyStore } from '../store/history.js'
import { favoritesStore } from '../store/favorites.js'
import { useFocusable } from '../hooks/useFocus.js'
import * as pageCache from '../store/pageCache.js'

const CACHE_KEY = 'home:popular'
const POPULAR = [
  { key: 'movie', title: '热门电影', category: 1 },
  { key: 'variety', title: '热门综艺', category: 3 },
  { key: 'series', title: '热门连续剧', category: 2 },
]

function RetryButton({ group, onRetry }) {
  const { props } = useFocusable({ layer: 'home', group, row: 0, col: 0, onSelect: onRetry })
  return (
    <span className="focusable-chip" {...props}>
      重试
    </span>
  )
}

export default function HomePage({ group = 'content', onOpenDetail, refreshNonce }) {
  const history = useStoreValue(historyStore)
  const favorites = useStoreValue(favoritesStore)
  const [popular, setPopular] = useState(null) // null while loading; array once resolved

  const load = useCallback(() => {
    setPopular(null)
    pageCache
      .loadOnce(CACHE_KEY, async () => {
        const results = await Promise.allSettled(
          POPULAR.map((p) => categoryList({ category: p.category, sort: 'hot', size: 12 })),
        )
        return POPULAR.map((p, i) => ({
          ...p,
          items: results[i].status === 'fulfilled' ? results[i].value.items : [],
        }))
      })
      .then(setPopular)
      .catch(() => setPopular(POPULAR.map((p) => ({ ...p, items: [] }))))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // refreshNonce bump (tab Enter, T15): drop the cache and refetch. Skip the
  // initial value so mount doesn't double-load.
  const firstNonce = useRef(refreshNonce)
  useEffect(() => {
    if (refreshNonce === firstNonce.current) return
    firstNonce.current = refreshNonce
    pageCache.invalidate('home:')
    load()
  }, [refreshNonce, load])

  const retry = useCallback(() => {
    pageCache.invalidate('home:')
    load()
  }, [load])

  // Build the shelf list in render order; row = index (kept continuous).
  const continueItems = history.filter((h) => h.watch && h.watch.position > 0).slice(0, 12)
  const favItems = favorites.slice(0, 12)

  const rows = []
  if (continueItems.length) rows.push({ key: 'continue', title: '继续观看', items: continueItems, isContinue: true })
  if (favItems.length) rows.push({ key: 'fav', title: '我的收藏', items: favItems })
  for (const p of popular || []) if (p.items.length) rows.push(p)

  if (popular === null && rows.length === 0) {
    return <div className="home-status">加载中…</div>
  }
  if (popular !== null && rows.length === 0) {
    return (
      <div className="home-error">
        <div>内容加载失败</div>
        <RetryButton group={group} onRetry={retry} />
      </div>
    )
  }

  return (
    <div className="home">
      {rows.map((r, i) => (
        <Shelf
          key={r.key}
          title={r.title}
          items={r.items}
          layer="home"
          group={group}
          row={i}
          onSelectItem={(it) => onOpenDetail(it.id)}
          cardExtras={
            r.isContinue
              ? (it) => {
                  const h = history.find((x) => x.id === it.id)
                  return { watchedEp: h?.watch?.lastEpisodeIndex, progress: h?.watch }
                }
              : undefined
          }
        />
      ))}
    </div>
  )
}
