/*
 * Full-screen detail overlay (the "detail" focus layer).
 *
 * No blown-up-poster-with-scrim treatment (that violates the performance red
 * lines): a solid info column on the left and a plain poster <img> on the right,
 * with all text on opaque backgrounds. Action row is focus row 0 (focus lands on
 * the play button once data resolves); the episode grid is row 1 onward.
 */
import { useCallback, useEffect, useState } from 'react'
import { detail as fetchDetail } from '../api/olevod.js'
import Thumb from '../components/Thumb.jsx'
import { useFocusable, pushFocusLayer, popFocusLayer, focusTo } from '../hooks/useFocus.js'
import { useStoreValue } from '../hooks/useStore.js'
import { favoritesStore, toggle as toggleFavorite } from '../store/favorites.js'
import { historyStore } from '../store/history.js'
import * as pageCache from '../store/pageCache.js'

const LAYER = 'detail'
const EP_COLS = 8

function ActionButton({ col, label, onSelect }) {
  const { props } = useFocusable({ layer: LAYER, group: 'content', row: 0, col, onSelect })
  return (
    <span className="detail-btn focusable-chip" {...props}>
      {label}
    </span>
  )
}

function EpCell({ index, col, label, isResume, onSelect }) {
  const row = 1 + Math.floor(index / EP_COLS)
  const { props } = useFocusable({ layer: LAYER, group: 'content', row, col, onSelect })
  return (
    <div className={`ep-cell${isResume ? ' ep-cell-resume' : ''}`} {...props}>
      {label}
      {isResume && <span className="ep-badge">继续</span>}
    </div>
  )
}

function RetryCell({ onRetry }) {
  const { props } = useFocusable({ layer: LAYER, group: 'content', row: 0, col: 0, onSelect: onRetry })
  return (
    <span className="detail-btn focusable-chip" {...props}>
      加载失败，重试
    </span>
  )
}

export default function DetailPage({ id, onPlay, style }) {
  const [data, setData] = useState(null)
  const [status, setStatus] = useState('loading')
  const favorites = useStoreValue(favoritesStore)
  const isFav = favorites.some((x) => x.id === id)
  // Subscribed (not a one-shot read): closing the player must immediately flip
  // the primary button to "continue watching episode N" (T18).
  const history = useStoreValue(historyStore)

  const load = useCallback(() => {
    setStatus('loading')
    pageCache
      .loadOnce(`detail:${id}`, () => fetchDetail(id))
      .then((d) => {
        setData(d)
        setStatus('ok')
      })
      .catch(() => setStatus('error'))
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  // Own the detail focus layer for this overlay's lifetime.
  useEffect(() => {
    pushFocusLayer(LAYER)
    return () => popFocusLayer()
  }, [])

  // Once data lands, deterministically focus the play button.
  useEffect(() => {
    if (status === 'ok') focusTo(`${LAYER}/content-0-0`)
  }, [status])

  if (status === 'loading') {
    return (
      <div className="overlay detail-status" style={style}>
        加载中…
      </div>
    )
  }
  if (status === 'error') {
    return (
      <div className="overlay detail-status" style={style}>
        <RetryCell onRetry={load} />
      </div>
    )
  }

  const episodes = data.episodes || []
  // Episodes are newest-first, so episode 1 is the last entry.
  const firstEp = episodes[episodes.length - 1]
  const watch = history.find((x) => x.id === id)?.watch || null
  const canResume =
    watch && watch.position > 30 && episodes.some((e) => e.index === watch.lastEpisodeIndex)
  const resumeIndex = canResume ? watch.lastEpisodeIndex : null

  const primaryLabel = canResume ? `▶ 继续观看 第${resumeIndex}集` : '▶ 播放 第1集'
  const primaryEp = canResume ? resumeIndex : firstEp?.index ?? 1

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

  return (
    <div className="overlay" style={style}>
      <div className="detail">
        <div className="detail-top">
          <div className="detail-info">
            <div className="detail-eyebrow">{eyebrow}</div>
            <h1 className="detail-title">{data.title}</h1>
            <div className="detail-badges">
              {data.rating > 0 && <span className="badge-rating">{data.rating}</span>}
              <span className="detail-count">全 {episodes.length} 集</span>
            </div>
            <p className="detail-synopsis">{data.synopsis}</p>
            <div className="detail-crew">{crew}</div>
            <div className="detail-actions">
              <ActionButton col={0} label={primaryLabel} onSelect={() => onPlay(primaryEp)} />
              <ActionButton
                col={1}
                label={isFav ? '★ 已收藏' : '☆ 收藏'}
                onSelect={() => toggleFavorite(favItem)}
              />
            </div>
          </div>
          <div className="detail-poster">
            <Thumb pic={data.pic} alt={data.title} size="600x900" />
          </div>
        </div>

        <div className="ep-grid">
          {episodes.map((ep, i) => (
            <EpCell
              key={ep.index}
              index={i}
              col={i % EP_COLS}
              label={`第${ep.index}集`}
              isResume={ep.index === resumeIndex}
              onSelect={() => onPlay(ep.index)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
