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

  return (
    <section className="shelf">
      <h2 className="shelf-title">{title}</h2>
      <div className="shelf-row">
        {items.map((item, i) => (
          <VideoCard
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
