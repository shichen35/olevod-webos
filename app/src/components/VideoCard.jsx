/*
 * Poster card: 2:3 thumbnail + title + a small meta row, with optional badges
 * (rating, UHD, "Watched through EPxx") and a bottom watch-progress bar.
 *
 * Wrapped in React.memo so a parent re-render doesn't re-render a whole grid of
 * cards. Focus state is the border + title-color swap only — no scale, no
 * shadow, no transition. The root reserves layout via content-visibility +
 * contain-intrinsic-size (cv-auto) so off-screen cards are cheap.
 */
import { memo } from 'react'
import Thumb from './Thumb.jsx'
import { useFocusable } from '../hooks/useFocus.js'

// Badge base: opaque pill pinned inside the poster.
const BADGE = 'absolute rounded-sm px-2 py-[5px] text-caption leading-none'

// `className` sets the sizing context: shelves pass "w-card shrink-0" (fixed
// row of 6); grids pass nothing and the grid track sizes the card.
function VideoCardImpl({ item, layer, group, row, col, onSelect, watchedEp, progress, timeLabel, marker, className = '' }) {
  const { props } = useFocusable({ layer, group, row, col, onSelect })

  const uhd = /4k|uhd|蓝光/i.test(item.remarks || '')
  const pct =
    progress && progress.duration > 0
      ? Math.min(100, Math.max(0, (progress.position / progress.duration) * 100))
      : 0

  return (
    <div className={`cv-auto [contain-intrinsic-size:var(--spacing-card)_490px] ${className}`} {...props}>
      {/* The focus ring wraps only the poster: the border slot is reserved
          (transparent) so focusing never shifts layout, and the radius is the
          image radius (12px) + the 3px ring so the outer edge stays rounded. */}
      <div className="relative aspect-2/3 w-full overflow-hidden rounded-[15px] border-3 border-transparent bg-elev focused:border-focus">
        <Thumb pic={item.pic} picThumb={item.picThumb} alt={item.name} />
        {item.score > 0 && <span className={`${BADGE} top-2 left-2 bg-elev font-semibold text-accent`}>{item.score}</span>}
        {/* A marker (history's 管理 mode) takes the UHD corner: what OK does
            right now matters more than the source's tier. */}
        {marker ? (
          <span className={`${BADGE} top-2 right-2 bg-uhd font-semibold text-inverse`}>{marker}</span>
        ) : (
          uhd && <span className={`${BADGE} top-2 right-2 bg-uhd font-semibold text-inverse`}>UHD</span>
        )}
        {watchedEp != null && <span className={`${BADGE} bottom-3.5 left-2 bg-elev-2 text-fg`}>看到第{watchedEp}集</span>}
        {pct > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-1.5 bg-elev-2">
            <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
      <div className="mt-2.5 truncate text-label text-fg-2 focused:text-fg">{item.name}</div>
      <div className="mt-1 flex gap-3 text-caption text-fg-3">
        {/* History cards lead with when the title was last watched. */}
        {timeLabel ? <span>{timeLabel}</span> : null}
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
    a.className === b.className &&
    a.layer === b.layer &&
    a.group === b.group &&
    a.row === b.row &&
    a.col === b.col &&
    a.watchedEp === b.watchedEp &&
    a.timeLabel === b.timeLabel &&
    a.marker === b.marker &&
    a.progress?.position === b.progress?.position &&
    a.progress?.duration === b.progress?.duration
  )
}

export default memo(VideoCardImpl, areEqual)
