/*
 * A titled horizontal row of VideoCards. The caller decides the focus
 * coordinates ({layer, group, row}); each card takes col = its index in the
 * row. Horizontal scrolling is driven entirely by the focus engine's
 * scrollIntoView({inline:'nearest'}) — no scroll handlers here.
 *
 * `cardExtras(item)` lets a page inject per-card props (e.g. the Continue
 * Watching shelf passing watchedEp + progress).
 */
import VideoCard from './VideoCard.jsx'

export default function Shelf({ title, items, layer, group, row, onSelectItem, cardExtras }) {
  if (!items || items.length === 0) return null

  // Exactly 6 fixed-width cards fill the content width, so the row's resting
  // state is symmetric; the scrollbar is hidden (focus drives scrolling).
  // bg-bg + will-change-scroll: composited scrolling, same as .tab-content (App.jsx).
  return (
    <section className="mb-11">
      <h2 className="mb-[18px] text-heading font-semibold text-fg">{title}</h2>
      <div className="flex gap-gutter overflow-x-auto overflow-y-hidden bg-bg will-change-scroll">
        {items.map((item, i) => (
          <VideoCard
            className="w-card shrink-0"
            key={item.id}
            item={item}
            layer={layer}
            group={group}
            row={row}
            col={i}
            onSelect={() => onSelectItem?.(item)}
            {...(cardExtras ? cardExtras(item) : null)}
          />
        ))}
      </div>
    </section>
  )
}
