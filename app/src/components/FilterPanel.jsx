/*
 * Region / Year / Sort filter panel, opened by the category page's "Filter"
 * button. A fixed opaque panel on the right on its own "filter" focus layer —
 * no slide-in animation, no scrim over the content behind it (focus is on the
 * panel, so the grid underneath can't receive input anyway).
 *
 * Selecting any option applies immediately (the grid refreshes via the parent's
 * filter override). "Reset" restores this category's defaults; "Done" and the
 * back key both close the panel and return focus to the "Filter" button.
 *
 * Focus movement here is SPATIAL, not arithmetic. The chips flow in a
 * `flex-wrap` container, so how many land on a visual row depends on their pixel
 * widths ("全部" vs "2024" etc.), not a fixed column count — the rest of the app
 * navigates real CSS grids where logical col == visual col, but this panel
 * cannot. Rather than guess a column count (which drifts out of sync with the
 * wrapping and sends the cursor to the wrong chip), we read the chips' live DOM
 * rectangles on each key press and move to the nearest chip in the pressed
 * direction. The shared focus engine still owns painting, selection, scrolling
 * and the layer stack; only the directional step is overridden, via the custom
 * key handler this layer already installs.
 */
import { useEffect, useRef } from 'react'
import {
  useFocusable,
  pushFocusLayer,
  popFocusLayer,
  focusTo,
  setFocus,
  getCurrentFocus,
  setCustomKeyHandler,
} from '../hooks/useFocus.js'
import { getCategory, SORTS } from '../config/taxonomy.js'

const LAYER = 'filter'
const GROUP = 'panel'

// Chips whose top edges are within this many px count as the same wrapped row.
// Comfortably above sub-pixel rounding, well below one chip height + gap.
const ROW_TOL = 8

// Section index doubles as the focusable's `row` so ids stay unique; the value
// is irrelevant to navigation (that's geometric) — only ordering the ids is.
const AREA_ROW = 0
const YEAR_ROW = 1
const SORT_ROW = 2
const ACTION_ROW = 3

function isBackKey(e) {
  return e.keyCode === 461 || e.key === 'Escape' || e.key === 'Backspace' || e.key === 'GoBack'
}

// The chips of the wrapped row immediately above/below `cr` (`vdir` 'up'/'down'),
// or [] if `cr` is already on the edge row. "Nearest row" = the closest top edge
// in that direction, then everything sharing that top within ROW_TOL.
function adjacentRowEls(els, rects, cr, vdir) {
  const cand = els.filter((el) => {
    const t = rects.get(el).top
    return vdir === 'down' ? t > cr.top + ROW_TOL : t < cr.top - ROW_TOL
  })
  if (!cand.length) return []
  const rowTop = cand.reduce(
    (best, el) => {
      const t = rects.get(el).top
      if (vdir === 'down') return t < best ? t : best
      return t > best ? t : best
    },
    vdir === 'down' ? Infinity : -Infinity,
  )
  return cand.filter((el) => Math.abs(rects.get(el).top - rowTop) <= ROW_TOL)
}

// Move focus to the nearest chip in `dir`, reading live layout from `root`.
// up/down jump to the adjacent wrapped row and land on the chip whose center is
// closest horizontally — what the eye expects when rows hold different counts.
// left/right walk the current wrapped row and, at a row edge, wrap onward: Right
// past the last chip lands on the next row's first chip, Left past the first
// lands on the previous row's last chip (if such a row exists).
function moveByGeometry(dir, root) {
  if (!root) return
  const els = Array.from(root.querySelectorAll('[data-focus-id]'))
  if (!els.length) return

  const curId = getCurrentFocus()
  const cur = els.find((el) => el.getAttribute('data-focus-id') === curId) || els[0]
  const cr = cur.getBoundingClientRect()
  const curCenterX = cr.left + cr.width / 2

  // Cache rects once; this runs per key press over ~20-40 chips.
  const rects = new Map(els.map((el) => [el, el.getBoundingClientRect()]))
  let target = null

  if (dir === 'left' || dir === 'right') {
    // Same wrapped row, nearest neighbor toward the press.
    for (const el of els) {
      if (el === cur) continue
      const r = rects.get(el)
      if (Math.abs(r.top - cr.top) > ROW_TOL) continue // different wrapped row
      const ahead = dir === 'left' ? r.left < cr.left : r.left > cr.left
      if (!ahead) continue
      if (!target || Math.abs(r.left - cr.left) < Math.abs(rects.get(target).left - cr.left)) {
        target = el
      }
    }
    // At a row edge: wrap to the adjacent row's opposite end.
    if (!target) {
      const rowEls = adjacentRowEls(els, rects, cr, dir === 'right' ? 'down' : 'up')
      for (const el of rowEls) {
        const r = rects.get(el)
        if (!target) {
          target = el
          continue
        }
        const tr = rects.get(target)
        // Right -> leftmost chip of the next row; Left -> rightmost of the prev row.
        target = dir === 'right' ? (r.left < tr.left ? el : target) : (r.left > tr.left ? el : target)
      }
    }
  } else {
    for (const el of adjacentRowEls(els, rects, cr, dir)) {
      const r = rects.get(el)
      const dx = Math.abs(r.left + r.width / 2 - curCenterX)
      const bestDx = target
        ? Math.abs(rects.get(target).left + rects.get(target).width / 2 - curCenterX)
        : Infinity
      if (dx < bestDx) target = el
    }
  }

  if (target) setFocus(target.getAttribute('data-focus-id'))
}

// Selected is distinct from focus (white fill): an accent dot + accent text on
// the elevated fill. Focus still overrides the text to dark instantly; the dot
// keeps its explicit accent color either way.
const PANEL_CHIP = 'focusable rounded-full bg-elev-2 px-[18px] py-2 text-label'
const PANEL_CHIP_SELECTED = "text-accent before:mr-2 before:text-[16px] before:text-accent before:content-['●']"

function OptChip({ row, col, label, selected, onSelect }) {
  const { props } = useFocusable({ layer: LAYER, group: GROUP, row, col, onSelect })
  return (
    <span className={`${PANEL_CHIP} ${selected ? PANEL_CHIP_SELECTED : 'text-fg'}`} {...props}>
      {label}
    </span>
  )
}

function Group({ title, options, value, row, onPick }) {
  return (
    <div className="mb-8">
      <div className="mb-4 text-heading text-fg">{title}</div>
      <div className="flex flex-wrap gap-3">
        {options.map((o, i) => (
          <OptChip
            key={o.value}
            row={row}
            col={i}
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
  const rootRef = useRef(null)

  useEffect(() => {
    pushFocusLayer(LAYER)
    focusTo(`${LAYER}/${GROUP}-${AREA_ROW}-0`)
    // Intercept keys for this layer: back closes the panel; arrows navigate the
    // wrapped chips spatially; Enter falls through to the engine's onSelect.
    setCustomKeyHandler((e) => {
      if (isBackKey(e)) {
        onClose()
        return true
      }
      const dir = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[e.key]
      if (dir) {
        e.preventDefault()
        moveByGeometry(dir, rootRef.current)
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

  const reset = useFocusable({ layer: LAYER, group: GROUP, row: ACTION_ROW, col: 0, onSelect: onReset })
  const done = useFocusable({ layer: LAYER, group: GROUP, row: ACTION_ROW, col: 1, onSelect: onClose })

  return (
    <div
      ref={rootRef}
      className="glass-strong fixed inset-y-0 right-0 w-[600px] overflow-y-auto border-l border-glass-edge px-10 py-12"
    >
      <Group title="地区" options={cfg.areas} value={filter.area} row={AREA_ROW} onPick={(v) => onChange({ ...filter, area: v })} />
      <Group title="年份" options={cfg.years} value={filter.year} row={YEAR_ROW} onPick={(v) => onChange({ ...filter, year: v })} />
      <Group title="排序" options={SORTS} value={filter.sort} row={SORT_ROW} onPick={(v) => onChange({ ...filter, sort: v })} />
      <div className="mt-2 flex gap-4">
        <span className={`${PANEL_CHIP} text-fg`} {...reset.props}>
          重置
        </span>
        <span className={`${PANEL_CHIP} text-fg`} {...done.props}>
          完成
        </span>
      </div>
    </div>
  )
}
