/*
 * Poster card: 2:3 thumbnail + title + a small meta row, with optional badges
 * (rating, UHD, "Watched through EPxx") and a bottom watch-progress bar.
 *
 * Wrapped in React.memo so a parent re-render doesn't re-render a whole grid of
 * cards. Focus state is the T02 border + title-color swap only — no scale, no
 * shadow, no transition. The root reserves layout via content-visibility +
 * contain-intrinsic-size (set in card.css) so off-screen cards are cheap.
 */
import { memo } from 'react'
import Thumb from './Thumb.jsx'
import { useFocusable } from '../hooks/useFocus.js'

function VideoCardImpl({ item, layer, group, row, col, onSelect, watchedEp, progress }) {
  const { props } = useFocusable({ layer, group, row, col, onSelect })

  const uhd = /4k|uhd|蓝光/i.test(item.remarks || '')
  const pct =
    progress && progress.duration > 0
      ? Math.min(100, Math.max(0, (progress.position / progress.duration) * 100))
      : 0

  return (
    <div className="card focusable-card" {...props}>
      <div className="card-poster">
        <Thumb pic={item.pic} alt={item.name} />
        {item.score > 0 && <span className="badge badge-score">{item.score}</span>}
        {uhd && <span className="badge badge-uhd">UHD</span>}
        {watchedEp != null && <span className="badge badge-ep">看到第{watchedEp}集</span>}
        {pct > 0 && (
          <div className="card-progress">
            <div style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
      <div className="card-title">{item.name}</div>
      <div className="card-meta">
        {item.year ? <span>{item.year}</span> : null}
        {item.remarks ? <span>{item.remarks}</span> : null}
      </div>
    </div>
  )
}

// Compare by value, ignoring function props: the focus engine reads onSelect
// from a ref, so a new onSelect closure from the parent must NOT re-render the
// card. Without this, a parent setState re-renders an entire grid of cards.
function areEqual(a, b) {
  return (
    a.item === b.item &&
    a.layer === b.layer &&
    a.group === b.group &&
    a.row === b.row &&
    a.col === b.col &&
    a.watchedEp === b.watchedEp &&
    a.progress?.position === b.progress?.position &&
    a.progress?.duration === b.progress?.duration
  )
}

export default memo(VideoCardImpl, areEqual)
