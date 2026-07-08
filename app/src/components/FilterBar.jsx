/*
 * Category page header row (focus row 0 of the content group): a horizontally
 * scrollable strip of subtype chips (All + taxonomy genres) followed by a
 * "Filter" button that opens the region/year/sort panel (T12), plus a
 * non-focusable summary of the current filter on the right.
 *
 * Selecting a chip applies immediately (server-side filtering in CategoryPage).
 */
import { useFocusable } from '../hooks/useFocus.js'
import { getCategory, SORTS } from '../config/taxonomy.js'

function Chip({ col, label, selected, onSelect }) {
  const { props } = useFocusable({ layer: 'home', group: 'content', row: 0, col, onSelect })
  return (
    <span className={`chip focusable-chip${selected ? ' chip-selected' : ''}`} {...props}>
      {label}
    </span>
  )
}

function summaryText(cfg, filter) {
  const parts = []
  if (filter.area && filter.area !== '0') parts.push(filter.area)
  if (filter.year && filter.year !== '0') parts.push(filter.year)
  const sort = SORTS.find((s) => s.value === filter.sort)
  if (sort) parts.push(sort.label)
  return parts.join(' · ')
}

export default function FilterBar({ category, filter, onSelectGenre, onOpenFilter }) {
  const cfg = getCategory(category)
  const genres = cfg.genres

  return (
    <div className="filter-bar">
      <div className="filter-chips">
        {genres.map((g, i) => (
          <Chip
            key={g.value}
            col={i}
            label={g.label}
            selected={filter.genre === g.value}
            onSelect={() => onSelectGenre(g.value)}
          />
        ))}
        <Chip col={genres.length} label="筛选" onSelect={onOpenFilter} />
      </div>
      <div className="filter-summary">{summaryText(cfg, filter)}</div>
    </div>
  )
}
