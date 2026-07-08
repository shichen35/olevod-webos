/*
 * Category page (one instance per Movies/Variety/TV Series tab, configured by
 * taxonomy): a filter row + a 6-column poster grid + infinite scroll.
 *
 * Focus: FilterBar is row 0 of the content group; cards start at row 1, so
 * moving down from a chip flows straight into the grid.
 *
 * A monotonically increasing genRef token invalidates in-flight requests: any
 * result that returns after the filter changed is discarded, so a slow stale
 * filter can never overwrite a newer one.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import VideoCard from '../components/VideoCard.jsx'
import FilterBar from '../components/FilterBar.jsx'
import { categoryList } from '../api/olevod.js'
import { defaultFilter, loadCategoryFirstPage } from '../api/feeds.js'
import { getFilter, setFilter } from '../store/filters.js'
import { useFocusable } from '../hooks/useFocus.js'
import * as pageCache from '../store/pageCache.js'

const COLS = 6
const PAGE_SIZE = 24
const FILTER_ROWS = 1

export default function CategoryPage({ category, group = 'content', onOpenDetail, onOpenFilter, refreshNonce, filterOverride }) {
  const [filter, setFilterState] = useState(() => getFilter(category) || defaultFilter())
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState('loading') // loading | ok | error

  const genRef = useRef(0)
  const pageRef = useRef(1)
  const loadingMoreRef = useRef(false)
  const rootRef = useRef(null)
  const sentinelRef = useRef(null)

  // Load the first page for a filter (cached so tab-return / restart is instant).
  // `clear` blanks to a loading state; a refresh passes clear=false so the old
  // grid stays until new data lands (no blank flash).
  const load = useCallback(
    (f, clear = true) => {
      const token = ++genRef.current
      pageRef.current = 1
      if (clear) {
        setStatus('loading')
        setItems([])
      }
      loadCategoryFirstPage(category, f, PAGE_SIZE)
        .then((res) => {
          if (token !== genRef.current) return // superseded by a newer filter
          setItems(res.items)
          setTotal(res.total)
          setStatus('ok')
        })
        .catch(() => {
          if (token === genRef.current && clear) setStatus('error')
        })
    },
    [category],
  )

  const loadMore = useCallback(() => {
    if (loadingMoreRef.current) return
    setItems((cur) => {
      if (cur.length === 0 || cur.length >= total) return cur
      loadingMoreRef.current = true
      const token = genRef.current
      const next = pageRef.current + 1
      categoryList({ category, ...filter, page: next, size: PAGE_SIZE })
        .then((res) => {
          loadingMoreRef.current = false
          if (token !== genRef.current) return // filter changed mid-flight
          pageRef.current = next
          setItems((prev) => [...prev, ...res.items])
        })
        .catch(() => {
          loadingMoreRef.current = false
        })
      return cur
    })
  }, [category, filter, total])

  // Initial load + restore persisted filter.
  useEffect(() => {
    load(filter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A filter change pushed in from the panel (T12) via filterOverride.
  useEffect(() => {
    if (!filterOverride) return
    setFilterState(filterOverride)
    setFilter(category, filterOverride)
    load(filterOverride)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterOverride])

  // refreshNonce bump (tab Enter, T15): drop this category's cache and refetch.
  const firstNonce = useRef(refreshNonce)
  useEffect(() => {
    if (refreshNonce === firstNonce.current) return
    firstNonce.current = refreshNonce
    pageCache.invalidate(`cat:${category}:`)
    load(filter, false) // refresh without blanking the current grid
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshNonce])

  // Infinite scroll: observe a sentinel near the grid bottom against the tab's
  // scroll container, with a one-screen lookahead margin.
  useEffect(() => {
    const scroller = rootRef.current?.closest('.tab-content')
    const sentinel = sentinelRef.current
    if (!scroller || !sentinel) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore()
      },
      { root: scroller, rootMargin: '0px 0px 900px 0px' },
    )
    io.observe(sentinel)
    return () => io.disconnect()
  }, [loadMore])

  const selectGenre = useCallback(
    (genre) => {
      const f = { ...filter, genre }
      setFilterState(f)
      setFilter(category, f)
      load(f)
    },
    [filter, category, load],
  )

  const fullyLoaded = status === 'ok' && items.length > 0 && items.length >= total

  return (
    <div className="category" ref={rootRef}>
      <FilterBar category={category} group={group} filter={filter} onSelectGenre={selectGenre} onOpenFilter={onOpenFilter} />

      {status === 'error' && items.length === 0 ? (
        <RetryRow group={group} onRetry={() => load(filter)} />
      ) : (
        <div className="grid">
          {items.map((item, i) => (
            <VideoCard
              key={`${item.id}-${i}`}
              item={item}
              layer="home"
              group={group}
              row={FILTER_ROWS + Math.floor(i / COLS)}
              col={i % COLS}
              onSelect={() => onOpenDetail(item.id)}
            />
          ))}
        </div>
      )}

      <div ref={sentinelRef} className="grid-sentinel" />
      {status === 'loading' && <div className="grid-status">加载中…</div>}
      {fullyLoaded && <div className="grid-status">已加载全部 {total} 部</div>}
    </div>
  )
}

function RetryRow({ group, onRetry }) {
  const { props } = useFocusable({ layer: 'home', group, row: FILTER_ROWS, col: 0, onSelect: onRetry })
  return (
    <div className="grid-status">
      <span className="focusable-chip" {...props}>
        加载失败，重试
      </span>
    </div>
  )
}
