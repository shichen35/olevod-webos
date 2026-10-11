/*
 * Category page (one instance per Movies/Variety/TV Series tab, configured by
 * taxonomy): a filter row + a 6-column poster grid + infinite scroll.
 *
 * Focus: FilterBar occupies rows 0-1 of the content group (genre chips, then
 * the filter button line); cards start at row 2, so moving down from the
 * filter button flows straight into the grid.
 *
 * A monotonically increasing genRef token invalidates in-flight requests: any
 * result that returns after the filter changed is discarded, so a slow stale
 * filter can never overwrite a newer one. pageRef always describes the grid on
 * screen: it resets only when a first page lands, and no next page is fetched
 * while a first page is still in flight.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import VideoCard from '../components/VideoCard.jsx'
import FilterBar from '../components/FilterBar.jsx'
import { IconLabel } from '../components/Icon.jsx'
import { loadCategoryPage, invalidateCategory } from '../api/feeds.js'
import { useFilter, patchFilter } from '../store/filters.js'
import { useFocusable } from '../hooks/useFocus.js'

const COLS = 6
const FILTER_ROWS = 2 // genre chips (row 0) + sort chips and filter button line (row 1)

export default function CategoryPage({ category, group = 'content', onOpenDetail, onOpenFilter, refreshNonce }) {
  // The filters store owns the selection; the chips here and the shell's filter
  // panel both patch it, and the page reloads whenever it changes.
  const filter = useFilter(category)
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState('loading') // loading | ok | error

  const genRef = useRef(0)
  const pageRef = useRef(1)
  const pendingRef = useRef(false) // a first-page load is in flight
  const loadingMoreRef = useRef(false)
  const rootRef = useRef(null)
  const sentinelRef = useRef(null)

  // Load the first page for a filter (cached so tab-return / restart is instant).
  // `clear` blanks to a loading state; a refresh passes clear=false so the old
  // grid stays until new data lands (no blank flash).
  const load = useCallback(
    (f, clear = true) => {
      const token = ++genRef.current
      pendingRef.current = true
      if (clear) {
        setStatus('loading')
        setItems([])
      }
      loadCategoryPage(category, f)
        .then((res) => {
          if (token !== genRef.current) return // superseded by a newer filter
          pendingRef.current = false
          pageRef.current = 1
          setItems(res.items)
          setTotal(res.total)
          setStatus('ok')
        })
        .catch(() => {
          if (token !== genRef.current) return
          // A failed refresh leaves the old grid (and its page count) in place.
          pendingRef.current = false
          if (clear) setStatus('error')
        })
    },
    [category],
  )

  const loadMore = useCallback(() => {
    if (loadingMoreRef.current || pendingRef.current) return
    setItems((cur) => {
      if (cur.length === 0 || cur.length >= total) return cur
      loadingMoreRef.current = true
      const token = genRef.current
      const next = pageRef.current + 1
      loadCategoryPage(category, filter, next)
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

  // Initial load, at the filter the store holds for this category.
  useEffect(() => {
    load(filter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A filter change from the chips or the panel.
  const firstFilter = useRef(filter)
  useEffect(() => {
    if (filter === firstFilter.current) return
    firstFilter.current = filter
    load(filter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  // refreshNonce bump (tab Enter): drop this category's cache and refetch.
  const firstNonce = useRef(refreshNonce)
  useEffect(() => {
    if (refreshNonce === firstNonce.current) return
    firstNonce.current = refreshNonce
    invalidateCategory(category)
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

  // Genre and sort chips on the filter bar apply immediately.
  const selectGenre = useCallback((genre) => patchFilter(category, { genre }), [category])
  const selectSort = useCallback((sort) => patchFilter(category, { sort }), [category])

  const fullyLoaded = status === 'ok' && items.length > 0 && items.length >= total

  return (
    <div className="pt-4" ref={rootRef}>
      <FilterBar category={category} group={group} filter={filter} onSelectGenre={selectGenre} onSelectSort={selectSort} onOpenFilter={onOpenFilter} />

      {status === 'error' && items.length === 0 ? (
        <RetryRow group={group} onRetry={() => load(filter)} />
      ) : (
        // grid-cols-6 = repeat(6, minmax(0,1fr)): the 0 minimum stops poster
        // images inflating their track, keeping the columns equal. Track count
        // must match COLS. Cards stretch to their track (a hair wider than
        // --spacing-card; visually equal), so no width class is passed.
        <div className="grid grid-cols-6 gap-x-gutter gap-y-6">
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

      <div ref={sentinelRef} className="h-px w-full" />
      {status === 'loading' && <div className="py-8 text-body text-fg-2">加载中…</div>}
      {fullyLoaded && <div className="py-8 text-body text-fg-2">已加载全部 {total} 部</div>}
    </div>
  )
}

function RetryRow({ group, onRetry }) {
  const { props } = useFocusable({ layer: 'home', group, row: FILTER_ROWS, col: 0, onSelect: onRetry })
  return (
    <div className="py-8 text-body text-fg-2">
      <span className="focusable rounded-full bg-elev-2 text-fg" {...props}>
        <IconLabel icon="refresh" size={32}>
          加载失败，重试
        </IconLabel>
      </span>
    </div>
  )
}
