/*
 * Region / Year / Sort filter panel, opened by the category page's "Filter"
 * button. A fixed opaque panel on the right on its own "filter" focus layer —
 * no slide-in animation, no scrim over the content behind it (focus is on the
 * panel, so the grid underneath can't receive input anyway).
 *
 * Selecting any option applies immediately (the grid refreshes via the parent's
 * filter override). "Reset" restores this category's defaults; "Done" and the
 * back key both close the panel and return focus to the "Filter" button.
 */
import { useEffect } from 'react'
import {
  useFocusable,
  pushFocusLayer,
  popFocusLayer,
  focusTo,
  setCustomKeyHandler,
} from '../hooks/useFocus.js'
import { getCategory, SORTS } from '../config/taxonomy.js'

const LAYER = 'filter'
const GROUP = 'panel'
const COLS = 4

function isBackKey(e) {
  return e.keyCode === 461 || e.key === 'Escape' || e.key === 'Backspace' || e.key === 'GoBack'
}

function OptChip({ row, col, label, selected, onSelect }) {
  const { props } = useFocusable({ layer: LAYER, group: GROUP, row, col, onSelect })
  return (
    <span className={`panel-chip focusable-chip${selected ? ' panel-chip-selected' : ''}`} {...props}>
      {label}
    </span>
  )
}

function Group({ title, options, value, startRow, onPick }) {
  return (
    <div className="panel-group">
      <div className="panel-group-title">{title}</div>
      <div className="panel-chips">
        {options.map((o, i) => (
          <OptChip
            key={o.value}
            row={startRow + Math.floor(i / COLS)}
            col={i % COLS}
            label={o.label}
            selected={value === o.value}
            onSelect={() => onPick(o.value)}
          />
        ))}
      </div>
    </div>
  )
}

export default function FilterPanel({ category, filter, onChange, onReset, onClose }) {
  const cfg = getCategory(category)
  const areaRows = Math.ceil(cfg.areas.length / COLS)
  const yearStart = areaRows
  const yearRows = Math.ceil(cfg.years.length / COLS)
  const sortStart = yearStart + yearRows
  const actionRow = sortStart + 1

  useEffect(() => {
    pushFocusLayer(LAYER)
    focusTo(`${LAYER}/${GROUP}-0-0`)
    // Intercept the back key so it closes the panel instead of leaving the page.
    setCustomKeyHandler((e) => {
      if (isBackKey(e)) {
        onClose()
        return true
      }
      return false
    })
    return () => {
      setCustomKeyHandler(null)
      popFocusLayer() // restores focus to the "Filter" button in the home layer
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reset = useFocusable({ layer: LAYER, group: GROUP, row: actionRow, col: 0, onSelect: onReset })
  const done = useFocusable({ layer: LAYER, group: GROUP, row: actionRow, col: 1, onSelect: onClose })

  return (
    <div className="filter-panel">
      <Group title="地区" options={cfg.areas} value={filter.area} startRow={0} onPick={(v) => onChange({ ...filter, area: v })} />
      <Group title="年份" options={cfg.years} value={filter.year} startRow={yearStart} onPick={(v) => onChange({ ...filter, year: v })} />
      <Group title="排序" options={SORTS} value={filter.sort} startRow={sortStart} onPick={(v) => onChange({ ...filter, sort: v })} />
      <div className="panel-actions">
        <span className="panel-chip focusable-chip" {...reset.props}>
          重置
        </span>
        <span className="panel-chip focusable-chip" {...done.props}>
          完成
        </span>
      </div>
    </div>
  )
}
