/*
 * Search page: a search bar driven by the system keyboard + a suggestion strip
 * + a 6-column result grid with infinite scroll.
 *
 * The input is a REAL <input>: OK on the search box gives it DOM focus, which
 * is what pops the LG webOS system keyboard (there is no imperative "show
 * keyboard" API). While it has DOM focus the focus engine steps aside
 * (useFocus.js input guard) — the VKB owns the arrows, Enter commits the
 * search via the input's own onKeyDown, Back just closes the keyboard.
 *
 * Focus rows in the content group: row 0 = the (centered) search box, row 1 =
 * suggestion chips (hot keywords until the user types, autocomplete after,
 * debounced), results follow. When the chip row is empty (both fetches failed)
 * the grid moves up a row so vertical navigation never crosses a gap —
 * navigate() only probes the adjacent row.
 *
 * Same stale-response discipline as CategoryPage: a monotonically increasing
 * token per fetch family (suggest / results), late responses are dropped.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import VideoCard from '../components/VideoCard.jsx'
import { searchList, searchSuggest, searchHotKeywords } from '../api/olevod.js'
import { useFocusable, focusTo } from '../hooks/useFocus.js'

const COLS = 6
const PAGE_SIZE = 24
const SUGGEST_DEBOUNCE_MS = 300
const HOT_LIMIT = 10

function Chip({ group, row, col, label, onSelect }) {
  const { props } = useFocusable({ layer: 'home', group, row, col, onSelect })
  return (
    <span className="focusable shrink-0 rounded-full bg-elev-2 px-[22px] py-2 text-label text-fg" {...props}>
      {label}
    </span>
  )
}

export default function SearchPage({ group = 'content', onOpenDetail }) {
  const [keyword, setKeyword] = useState('')
  const [hotWords, setHotWords] = useState([])
  const [suggests, setSuggests] = useState([])
  const [submitted, setSubmitted] = useState('')
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState('idle') // idle | loading | ok | error

  const inputRef = useRef(null)
  // Set while a commit (Enter) is the reason the input is about to blur, so the
  // blur handler can tell "search submitted" apart from "keyboard dismissed".
  const committingRef = useRef(false)
  // Cursor restore for chip picks: picking a chip re-runs the suggest fetch and
  // rebuilds the strip, which would unmount the focused chip and strand the
  // cursor. pickWord arms { col, kw } here; once the refreshed suggestions land
  // (suggestForRef tells whose keyword the current list answers) the cursor is
  // put back on the same column, clamped to the new strip.
  const restoreRef = useRef(null)
  const suggestForRef = useRef('')
  const suggestGenRef = useRef(0)
  const genRef = useRef(0)
  const pageRef = useRef(1)
  const loadingMoreRef = useRef(false)
  const rootRef = useRef(null)
  const sentinelRef = useRef(null)

  // Trending terms fill the strip before the user has typed anything.
  useEffect(() => {
    let alive = true
    searchHotKeywords(HOT_LIMIT)
      .then((words) => {
        if (alive) setHotWords(words)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  // Autocomplete: debounce keystrokes, drop out-of-order responses. An empty
  // box falls back to the hot keywords instead of firing a request.
  useEffect(() => {
    const kw = keyword.trim()
    const token = ++suggestGenRef.current
    if (!kw) {
      setSuggests([])
      return undefined
    }
    const timer = setTimeout(() => {
      searchSuggest(kw)
        .then((words) => {
          if (token !== suggestGenRef.current) return
          suggestForRef.current = kw
          setSuggests(words)
        })
        .catch(() => {})
    }, SUGGEST_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [keyword])

  const runSearch = useCallback((kw) => {
    const q = (kw || '').trim()
    if (!q) return
    // Close the system keyboard. Flag the blur as a commit so handleBlur keeps
    // the cursor on the box instead of dropping it to the suggestion strip —
    // but only when the input actually holds DOM focus (a chip/button-driven
    // search never fires blur, and a stale flag would swallow the next one).
    if (document.activeElement === inputRef.current) committingRef.current = true
    inputRef.current?.blur()
    const token = ++genRef.current
    pageRef.current = 1
    setSubmitted(q)
    setStatus('loading')
    setItems([])
    searchList({ keyword: q, page: 1, size: PAGE_SIZE })
      .then((res) => {
        if (token !== genRef.current) return // superseded by a newer search
        setItems(res.items)
        setTotal(res.total)
        setStatus('ok')
      })
      .catch(() => {
        if (token === genRef.current) setStatus('error')
      })
  }, [])

  const loadMore = useCallback(() => {
    if (loadingMoreRef.current || !submitted) return
    setItems((cur) => {
      if (cur.length === 0 || cur.length >= total) return cur
      loadingMoreRef.current = true
      const token = genRef.current
      const next = pageRef.current + 1
      searchList({ keyword: submitted, page: next, size: PAGE_SIZE })
        .then((res) => {
          loadingMoreRef.current = false
          if (token !== genRef.current) return // a newer search took over
          pageRef.current = next
          setItems((prev) => [...prev, ...res.items])
        })
        .catch(() => {
          loadingMoreRef.current = false
        })
      return cur
    })
  }, [submitted, total])

  // Infinite scroll against the tab's scroll container (same as CategoryPage).
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

  const chips = keyword.trim() ? suggests : hotWords
  // Rows must stay contiguous for the focus grid: with no chips the results
  // slide up to row 1.
  const resultRow = chips.length > 0 ? 2 : 1

  const pickWord = useCallback(
    (word, col) => {
      // Freeze the strip through the pick: on the hot-words branch, changing
      // the keyword would instantly swap in the still-empty suggest list and
      // unmount the chip under the cursor. Seeding suggests with the current
      // strip keeps every chip (and the cursor) in place until the refreshed
      // suggestions arrive; the armed restore then re-seats the cursor.
      restoreRef.current = { col, kw: word.trim() }
      setSuggests(chips)
      setKeyword(word)
      runSearch(word)
    },
    [chips, runSearch],
  )

  // Re-seat the cursor once the pick's refreshed suggestions are in (the
  // seeding update above doesn't match armed.kw and leaves the restore armed):
  // same column clamped to the new strip, or the box if the strip vanished.
  useEffect(() => {
    const armed = restoreRef.current
    if (!armed || suggestForRef.current !== armed.kw) return
    restoreRef.current = null
    if (suggests.length > 0) {
      focusTo(`home/${group}-1-${Math.min(armed.col, suggests.length - 1)}`)
    } else {
      focusTo(`home/${group}-0-0`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggests])

  // OK on the box hands DOM focus to the input, which opens the VKB.
  const box = useFocusable({
    layer: 'home',
    group,
    row: 0,
    col: 0,
    onSelect: () => inputRef.current?.focus(),
  })

  const fullyLoaded = status === 'ok' && items.length > 0 && items.length >= total

  return (
    <div className="pt-4" ref={rootRef}>
      <div className="mb-6 flex items-center gap-4">
        <div
          className="focusable flex w-[720px] items-center rounded-full bg-elev-2 px-7 py-2"
          {...box.props}
        >
          <input
            ref={inputRef}
            value={keyword}
            onChange={(e) => {
              restoreRef.current = null // manual typing cancels a pending chip-pick restore
              setKeyword(e.target.value)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                runSearch(keyword)
              } else if (e.key === 'ArrowDown') {
                // Down leaves the field for the suggestion strip (browser dev
                // path; on TV the VKB consumes arrows and dismissing it fires
                // the same blur below).
                e.preventDefault()
                e.currentTarget.blur()
              }
            }}
            onBlur={() => {
              // Keyboard dismissed mid-typing: hand the cursor to the first
              // suggestion so Down-out-of-the-VKB lands on the autocomplete
              // options. A commit (Enter) keeps it on the box; with no chips
              // registered yet focusTo is a no-op and the box stays focused.
              const wasCommit = committingRef.current
              committingRef.current = false
              if (!wasCommit && keyword.trim()) focusTo(`home/${group}-1-0`)
            }}
            placeholder="输入片名、演员或导演"
            className="w-full bg-transparent text-label text-fg outline-none placeholder:text-fg-3 focused:text-inverse"
          />
        </div>
      </div>

      {chips.length > 0 && (
        <div className="mb-6 flex flex-col gap-3">
          {!keyword.trim() && <div className="text-caption text-fg-3">热门搜索</div>}
          <div className="flex gap-3 overflow-x-auto scrollbar-none">
            {chips.map((word, i) => (
              <Chip key={word} group={group} row={1} col={i} label={word} onSelect={() => pickWord(word, i)} />
            ))}
          </div>
        </div>
      )}

      {submitted && status === 'ok' && (
        <div className="mb-6 text-body text-fg-2">
          「{submitted}」的搜索结果{total > 0 ? ` · 共 ${total} 部` : ''}
        </div>
      )}

      {status === 'error' ? (
        <RetryRow group={group} row={resultRow} onRetry={() => runSearch(submitted)} />
      ) : status === 'ok' && items.length === 0 ? (
        <div className="py-8 text-body text-fg-2">没有找到相关内容，换个关键词试试</div>
      ) : (
        <div className="grid grid-cols-6 gap-x-gutter gap-y-6">
          {items.map((item, i) => (
            <VideoCard
              key={`${item.id}-${i}`}
              item={item}
              layer="home"
              group={group}
              row={resultRow + Math.floor(i / COLS)}
              col={i % COLS}
              onSelect={() => onOpenDetail(item.id)}
            />
          ))}
        </div>
      )}

      <div ref={sentinelRef} className="h-px w-full" />
      {status === 'loading' && <div className="py-8 text-body text-fg-2">搜索中…</div>}
      {fullyLoaded && <div className="py-8 text-body text-fg-2">已加载全部 {total} 部</div>}
    </div>
  )
}

function RetryRow({ group, row, onRetry }) {
  const { props } = useFocusable({ layer: 'home', group, row, col: 0, onSelect: onRetry })
  return (
    <div className="py-8 text-body text-fg-2">
      <span className="focusable rounded-full bg-elev-2 text-fg" {...props}>
        搜索失败，重试
      </span>
    </div>
  )
}
