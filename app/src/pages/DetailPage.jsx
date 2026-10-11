/*
 * Full-screen detail overlay (the "detail" focus layer).
 *
 * No blown-up-poster-with-scrim treatment (that violates the performance red
 * lines): a solid info column on the left and a plain poster <img> on the right,
 * with all text on opaque backgrounds.
 *
 * Focus rows in the content group:
 *   row 0     action buttons (focus lands on Play once data resolves; landing
 *             here also snaps the overlay's scroller to the very top — see
 *             OVERLAY_ROOT — so the poster and title block are never clipped)
 *   row 1     playlist controls — the order toggle, plus range chips on long
 *             lists (omitted entirely for a single-episode title, i.e. a movie)
 *   row 2+    the episode grid (row 1+ when there are no playlist controls)
 *
 * Episode order is a DISPLAY concern only. `olevod.js::detail` returns episodes
 * newest-first and that canonical list is never reordered ("next episode" goes
 * by index, see store/watchState.js) — this page reverses a copy for rendering
 * and remembers the choice per title (`store/episodeOrder.js`).
 *
 * The blurb stays clamped to three lines; 简介 opens the full text in a
 * scrollable dialog.
 *
 * VIP gate: a VIP episode the current session can't play comes back with an
 * empty url. Playing one never opens the player — signed out, a dialog offers
 * 去登录 (onRequireLogin); signed in, pub/user/info tells "needs VIP" apart from
 * "source unavailable". An account change reloads the detail so a fresh login
 * brings the urls in.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { userInfo } from '../api/olevod.js'
import { loadDetail } from '../api/feeds.js'
import Thumb from '../components/Thumb.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import SynopsisDialog from '../components/SynopsisDialog.jsx'
import { sessionStore } from '../store/session.js'
import { useFocusable, useFocusFrame, focusTo } from '../hooks/useFocus.js'
import { useStoreValue } from '../hooks/useStore.js'
import { favoritesStore, toggle as toggleFavorite } from '../store/favorites.js'
import { historyStore } from '../store/history.js'
import { primaryAction } from '../store/watchState.js'
import { episodeOrderStore, setAscending } from '../store/episodeOrder.js'

const LAYER = 'detail'
const EP_COLS = 6
const CONTROLS_ROW = 1
// Past this many episodes the grid is split into range chips — a 233-episode
// anime is a 39-row scroll otherwise.
const RANGE_MIN = 60
const RANGE_SIZE = 50

// The overlay's scroll container. The literal `overlay` class carries no styles
// — it is the marker useFocus.js looks for (alongside `tab-content`) to snap a
// focused row-0 element's scroller back to the very top. Without it, moving up
// to the action row only scrolls the minimum needed to reveal the buttons, which
// leaves the poster and the title block clipped above the viewport.
const OVERLAY_ROOT =
  'overlay fixed inset-0 overflow-y-auto bg-bg px-safe pt-content-top pb-content-bottom scroll-py-focus-safe'

// Primary (play) action: accent fill at rest; `focusable`'s .focused rules
// still win, so the white focus fill overrides it instantly.
const DETAIL_BTN = 'focusable rounded-lg px-8 py-3.5 text-label'

// Single-button notices for a signed-in session that still can't play a VIP
// episode.
const GATE_NOTICE = {
  novip: { title: '需要 VIP 权益', description: '此影片需要有效的 VIP 权益。' },
  unavailable: { title: '暂时无法播放', description: '此影片的播放源暂不可用，请稍后重试。' },
  unknown: { title: '暂时无法播放', description: '暂时无法确认会员状态，请稍后重试。' },
}

function ActionButton({ col, label, primary, onSelect }) {
  const { props } = useFocusable({ layer: LAYER, group: 'content', row: 0, col, onSelect })
  return (
    <span className={`${DETAIL_BTN} ${primary ? 'bg-accent text-inverse' : 'bg-elev-2 text-fg'}`} {...props}>
      {label}
    </span>
  )
}

// Playlist control chip (row 1). Same shape as the category page's chips, and
// the same vocabulary: accent text marks a SELECTED one (the range chips),
// while a plain chip is an action (the order toggle) — both distinct from the
// white focus fill.
function ControlChip({ col, label, selected = false, onSelect }) {
  const { props } = useFocusable({ layer: LAYER, group: 'content', row: CONTROLS_ROW, col, onSelect })
  return (
    <span
      className={`focusable shrink-0 rounded-full bg-elev-2 px-[22px] py-2 text-label ${selected ? 'text-accent' : 'text-fg'}`}
      {...props}
    >
      {label}
    </span>
  )
}

function EpCell({ row, col, title, subtitle, isResume, vip, onSelect }) {
  const { props } = useFocusable({ layer: LAYER, group: 'content', row, col, onSelect })
  return (
    <div
      className={`focusable relative rounded-md bg-elev-2 px-5 py-1.5 text-center text-label ${isResume ? 'text-fg' : 'text-fg-2'}`}
      {...props}
    >
      <div className="truncate leading-[1.25]">{title}</div>
      {/* Inherits the cell's current color (normal / focused / resume) and dims
          via opacity so every state keeps readable contrast. */}
      {subtitle && <div className="mt-0.5 text-caption leading-[1.25] opacity-65">{subtitle}</div>}
      {isResume && (
        <span className="absolute -top-2 -right-1.5 rounded-[10px] bg-accent px-2 py-0.5 text-caption text-inverse">继续</span>
      )}
      {vip && (
        <span className="absolute -top-2 -left-1.5 rounded-[10px] bg-uhd px-2 py-0.5 text-caption text-inverse">VIP</span>
      )}
    </div>
  )
}

function RetryCell({ onRetry }) {
  const { props } = useFocusable({ layer: LAYER, group: 'content', row: 0, col: 0, onSelect: onRetry })
  return (
    <span className={`${DETAIL_BTN} bg-elev-2 text-fg`} {...props}>
      加载失败，重试
    </span>
  )
}

// Split a list into fixed-size chunks (the range chips' windows).
function chunkList(list, size) {
  const out = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

// A chunk's label spans its episode numbers, always written low-high so it
// reads the same in either sort direction ("184-233", not "233-184").
function rangeLabel(chunk) {
  const a = chunk[0].index
  const b = chunk[chunk.length - 1].index
  return a <= b ? `${a}-${b}` : `${b}-${a}`
}

export default function DetailPage({ id, onPlay, onRequireLogin, style }) {
  const [data, setData] = useState(null)
  const [status, setStatus] = useState('loading')
  // Episode number pinning the visible range. Set by picking a range chip and
  // deliberately kept across a sort flip, so flipping the order leaves the same
  // stretch of episodes on screen instead of jumping back to the start.
  // null = fall back to the resume episode, then to the head of the list.
  const [anchorEp, setAnchorEp] = useState(null)
  const favorites = useStoreValue(favoritesStore)
  const isFav = favorites.some((x) => x.id === id)
  // Subscribed (not a one-shot read): closing the player must immediately flip
  // the primary button to "continue watching episode N".
  const history = useStoreValue(historyStore)
  const ascending = !!useStoreValue(episodeOrderStore)[id]

  // Generation token: a reload (account change) supersedes a still-running load.
  const loadGenRef = useRef(0)
  const load = useCallback(() => {
    const gen = ++loadGenRef.current
    setStatus('loading')
    loadDetail(id)
      .then((d) => {
        if (gen !== loadGenRef.current) return
        setData(d)
        setStatus('ok')
      })
      .catch(() => {
        if (gen === loadGenRef.current) setStatus('error')
      })
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  // Login / logout / expiry changes which episode urls come back: reload. The
  // cache was already flushed when the session changed (api/feeds.js).
  const session = useStoreValue(sessionStore)
  const sessionToken = session?.token || null
  const loadedTokenRef = useRef(sessionToken)
  useEffect(() => {
    if (loadedTokenRef.current === sessionToken) return
    loadedTokenRef.current = sessionToken
    load()
  }, [sessionToken, id, load])

  const [synopsisOpen, setSynopsisOpen] = useState(false)
  // VIP gate dialog: null | 'login' | 'novip' | 'unavailable' | 'unknown'.
  const [gate, setGate] = useState(null)
  const checkingRef = useRef(false)

  // A different title starts over at its own default range.
  useEffect(() => setAnchorEp(null), [id])

  // Own the detail focus layer for this overlay's lifetime. No onBack: Back
  // reaches App's back chain, which pops this overlay off the stack.
  useFocusFrame({ layer: LAYER })

  // Once data lands, deterministically focus the play button.
  useEffect(() => {
    if (status === 'ok') focusTo(`${LAYER}/content-0-0`)
  }, [status])

  if (status === 'loading') {
    return (
      <div className={OVERLAY_ROOT} style={style}>
        <div className="absolute inset-0 flex items-center justify-center text-heading text-fg">加载中…</div>
      </div>
    )
  }
  if (status === 'error') {
    return (
      <div className={OVERLAY_ROOT} style={style}>
        <div className="absolute inset-0 flex items-center justify-center text-heading text-fg">
          <RetryCell onRetry={load} />
        </div>
      </div>
    )
  }

  const episodes = data.episodes || []
  const watch = history.find((x) => x.id === id)?.watch || null
  const { resumeIndex, playIndex: primaryEp, label: primaryLabel } = primaryAction(episodes, watch)

  const eyebrow = [data.genreName, data.year, data.region, data.remarks].filter(Boolean).join(' · ')
  const crew = [data.director && `导演：${data.director}`, data.cast && `主演：${data.cast}`]
    .filter(Boolean)
    .join('　')

  const favItem = {
    id: data.id,
    name: data.title,
    pic: data.pic,
    score: data.rating,
    remarks: data.remarks,
    year: data.year,
    area: data.region,
  }

  // Display list: a reversed COPY when ascending — `episodes` stays canonical.
  const ordered = ascending ? [...episodes].reverse() : episodes
  const showControls = episodes.length > 1
  const chunks = episodes.length > RANGE_MIN ? chunkList(ordered, RANGE_SIZE) : [ordered]
  // The visible chunk is the one holding the anchor (a picked range, else the
  // resume episode); with neither, the head of the list — which follows the
  // sort, so it is the newest episode descending and episode 1 ascending.
  const pinned = anchorEp ?? resumeIndex
  const pinnedChunk = pinned == null ? -1 : chunks.findIndex((c) => c.some((e) => e.index === pinned))
  const activeChunk = pinnedChunk >= 0 ? pinnedChunk : 0
  const shown = chunks[activeChunk] || []
  const epRow0 = showControls ? CONTROLS_ROW + 1 : CONTROLS_ROW

  // Every play action goes through the VIP gate: an episode with no url that is
  // marked VIP never reaches the player.
  const playEpisode = (index) => {
    const ep = episodes.find((e) => e.index === index)
    if (!ep || ep.url || !ep.vip) {
      onPlay(index)
      return
    }
    if (!sessionStore.get()) {
      setGate('login')
      return
    }
    if (checkingRef.current) return
    checkingRef.current = true
    userInfo()
      .then((u) => setGate(u.groupId === 3 ? 'unavailable' : 'novip'))
      // An expired session signs out inside the request; offer login again.
      .catch(() => setGate(sessionStore.get() ? 'unknown' : 'login'))
      .finally(() => {
        checkingRef.current = false
      })
  }
  const notice = GATE_NOTICE[gate]

  return (
    <div className={OVERLAY_ROOT} style={style}>
      <div className="flex min-h-full flex-col gap-10">
        <div className="flex gap-14">
          <div className="aspect-2/3 w-card shrink-0 overflow-hidden rounded-xl bg-elev">
            {/* Same sized asset as grid cards: usually already cached when
                arriving from a poster grid, so it paints immediately. */}
            <Thumb pic={data.pic} alt={data.title} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-3 text-label text-fg-3">{eyebrow}</div>
            <h1 className="mb-5 text-display font-bold text-fg">{data.title}</h1>
            <div className="mb-6 flex items-center gap-4">
              {data.rating > 0 && <span className="text-heading font-bold text-accent">{data.rating}</span>}
              <span className="text-label text-fg-2">全 {episodes.length} 集</span>
            </div>
            <p className="mb-5 line-clamp-3 text-body leading-normal text-fg-2">{data.synopsis}</p>
            <div className="mb-8 truncate text-caption text-fg-3">{crew}</div>
            <div className="flex gap-5">
              <ActionButton col={0} label={primaryLabel} primary onSelect={() => playEpisode(primaryEp)} />
              <ActionButton
                col={1}
                label={isFav ? '★ 已收藏' : '☆ 收藏'}
                onSelect={() => toggleFavorite(favItem)}
              />
              {/* The blurb above is clamped to three lines; this opens the rest. */}
              {data.synopsis && <ActionButton col={2} label="简介" onSelect={() => setSynopsisOpen(true)} />}
            </div>
          </div>
        </div>

        <div>
          {showControls && (
            <div className="mb-6 flex items-center gap-3 overflow-x-auto">
              <span className="shrink-0 pr-2 text-label text-fg-3">播放列表</span>
              {/* One toggle showing the order it is IN, not the one it would
                  switch to — the arrow carries the direction so it reads at a
                  glance from across the room. */}
              <ControlChip
                col={0}
                label={ascending ? '↑ 升序' : '↓ 降序'}
                onSelect={() => setAscending(id, !ascending)}
              />
              {chunks.length > 1 &&
                chunks.map((c, i) => (
                  <ControlChip
                    key={c[0].index}
                    col={1 + i}
                    label={rangeLabel(c)}
                    selected={i === activeChunk}
                    onSelect={() => setAnchorEp(c[0].index)}
                  />
                ))}
            </div>
          )}

          <div className="grid grid-cols-6 gap-3.5">
            {shown.map((ep, i) => {
              // Main line is the API's per-episode title; the ordinal drops to a
              // sub line. Dramas title episodes as the zero-padded ordinal
              // ("第06集"), which would just echo the sub line — omit it then.
              const ordinal = `第${ep.index}集`
              const title = ep.title || ordinal
              const titleIsOrdinal = new RegExp(`^第0*${ep.index}集$`).test(title)
              return (
                <EpCell
                  key={ep.index}
                  row={epRow0 + Math.floor(i / EP_COLS)}
                  col={i % EP_COLS}
                  title={title}
                  subtitle={titleIsOrdinal ? null : ordinal}
                  isResume={ep.index === resumeIndex}
                  vip={!!ep.vip}
                  onSelect={() => playEpisode(ep.index)}
                />
              )
            })}
          </div>
        </div>
      </div>

      {synopsisOpen && (
        <SynopsisDialog title={data.title} text={data.synopsis} onClose={() => setSynopsisOpen(false)} />
      )}

      {gate === 'login' && (
        <ConfirmDialog
          title="登录后观看"
          description="此影片为会员内容，登录欧乐账号后即可播放。"
          confirmLabel="去登录"
          confirmKind="default"
          onCancel={() => setGate(null)}
          onConfirm={() => {
            setGate(null)
            onRequireLogin?.()
          }}
        />
      )}
      {notice && (
        <ConfirmDialog
          title={notice.title}
          description={notice.description}
          confirmLabel="知道了"
          confirmKind="default"
          cancelLabel={null}
          onConfirm={() => setGate(null)}
        />
      )}
    </div>
  )
}
