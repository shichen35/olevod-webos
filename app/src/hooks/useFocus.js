/*
 * Zero-rerender D-pad focus engine.
 *
 * Focus movement touches the DOM directly (toggle a `.focused` class +
 * scrollIntoView) and NEVER calls setState — a grid of cards must not re-render
 * on every arrow press or it feels laggy on weak TV silicon.
 *
 * Addressing: data-focus-id = "{layer}/{group}-{row}-{col}"
 *   - layer : which focus layer this element belongs to (home/detail/player/...)
 *   - group : a navigable cluster within a layer (e.g. "tabbar", "content")
 *   - row/col : integer grid coordinates; navigation is arithmetic on these.
 *
 * Everything is module-level singleton state: there is exactly one focus model
 * for the whole app, and React components only register/unregister into it.
 */
import { useEffect, useLayoutEffect, useRef, useCallback } from 'react'

// id -> { layer, group, row, col, onSelect, onFocusChange }
const registry = new Map()

let currentFocusId = null

// The base layer is the root page (Home). Overlays push on top of it.
const DEFAULT_LAYER = 'home'
const layerStack = [DEFAULT_LAYER]

// Focus memory. Restored on layer pop / cross-group jumps / vertical row moves.
const lastFocusByLayer = new Map() // layer -> id
const lastFocusByGroup = new Map() // "{layer}/{group}" -> id
const rowMemory = new Map()        // "{layer}/{group}-{row}" -> col (last column visited in that row)

// Listeners notified on every focus change (id => void); for effects that must
// track focus without owning a focusable (e.g. header state).
const focusChangeListeners = new Set()

// Which content group the tab bar bridges to. Each tab uses a distinct content
// group (e.g. "content:home") so that keeping every tab mounted never collides
// on focus ids; the shell updates this to the active tab's group.
let activeContentGroup = 'content'
export function setActiveContentGroup(group) {
  activeContentGroup = group
}

// ---------------------------------------------------------------------------
// id helpers
// ---------------------------------------------------------------------------
function buildId(layer, group, row, col) {
  return `${layer}/${group}-${row}-${col}`
}

function activeLayer() {
  return layerStack[layerStack.length - 1]
}

// ---------------------------------------------------------------------------
// applyFocus — the ONLY place focus visually changes. Pure DOM, no React.
// ---------------------------------------------------------------------------
function applyFocus(newId) {
  const prevId = currentFocusId
  if (prevId === newId) return

  if (prevId) {
    const prevEl = document.querySelector(`[data-focus-id="${prevId}"]`)
    if (prevEl) prevEl.classList.remove('focused')
    registry.get(prevId)?.onFocusChange?.(false)
  }

  currentFocusId = newId

  if (newId) {
    const rec = registry.get(newId)
    if (rec) {
      // Update focus memory so pops / cross-group jumps / row moves land back here.
      lastFocusByLayer.set(rec.layer, newId)
      lastFocusByGroup.set(`${rec.layer}/${rec.group}`, newId)
      rowMemory.set(`${rec.layer}/${rec.group}-${rec.row}`, rec.col)
    }
    const el = document.querySelector(`[data-focus-id="${newId}"]`)
    if (el) {
      el.classList.add('focused')
      // Always instant — no smooth scrolling anywhere in the app.
      el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' })
      // Topmost row of a scrolling page: snap the scroller all the way up so
      // the heading above the first row (which 'nearest' leaves clipped) shows.
      if (rec && rec.row === 0 && rec.group !== 'tabbar') {
        const scroller = el.closest('.tab-content, .overlay')
        if (scroller) scroller.scrollTop = 0
      }
    }
    // If el is null the element is not mounted yet; useLayoutEffect self-heals
    // the class once it commits (see useFocusable below).
    rec?.onFocusChange?.(true)
  }

  focusChangeListeners.forEach((fn) => fn(newId))
}

// ---------------------------------------------------------------------------
// public focus setters
// ---------------------------------------------------------------------------
export function setFocus(id) {
  if (!id || !registry.has(id) || id === currentFocusId) return false
  applyFocus(id)
  return true
}

// focusTo is the deterministic entry point pages use once their data lands.
export function focusTo(id) {
  return setFocus(id)
}

export function getCurrentFocus() {
  return currentFocusId
}

export function onFocusChange(fn) {
  focusChangeListeners.add(fn)
  return () => focusChangeListeners.delete(fn)
}

// ---------------------------------------------------------------------------
// group / layer lookups (used at boundaries; bounded probing, not hot-path)
// ---------------------------------------------------------------------------
const PROBE_LIMIT = 32

// First registered cell in a group, preferring low row/col. Falls back to a
// registry scan only if the bounded probe misses.
function firstInGroup(layer, group, preferRow = 0, preferCol = 0) {
  const remembered = lastFocusByGroup.get(`${layer}/${group}`)
  if (remembered && registry.has(remembered)) return remembered

  const exact = buildId(layer, group, preferRow, preferCol)
  if (registry.has(exact)) return exact

  for (let r = 0; r <= PROBE_LIMIT; r++) {
    for (let c = 0; c <= PROBE_LIMIT; c++) {
      const id = buildId(layer, group, r, c)
      if (registry.has(id)) return id
    }
  }
  for (const [id, rec] of registry) {
    if (rec.layer === layer && rec.group === group) return id
  }
  return null
}

function firstInLayer(layer) {
  for (const [id, rec] of registry) {
    if (rec.layer === layer) return id
  }
  return null
}

// Nearest existing column in a target row: try the remembered column for that
// row, then the incoming column, then walk outward within a bounded window.
function nearestColInRow(layer, group, row, preferCol) {
  const remembered = rowMemory.get(`${layer}/${group}-${row}`)
  const startCol = remembered != null ? remembered : preferCol

  if (registry.has(buildId(layer, group, row, startCol))) {
    return buildId(layer, group, row, startCol)
  }
  for (let d = 1; d <= PROBE_LIMIT; d++) {
    const lo = startCol - d
    if (lo >= 0 && registry.has(buildId(layer, group, row, lo))) {
      return buildId(layer, group, row, lo)
    }
    const hi = startCol + d
    if (registry.has(buildId(layer, group, row, hi))) {
      return buildId(layer, group, row, hi)
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// navigation — O(1) arithmetic + a Map.has() probe, never a registry scan
// ---------------------------------------------------------------------------
function navigate(dir) {
  const layer = activeLayer()
  const from = currentFocusId && registry.get(currentFocusId)
  if (!from || from.layer !== layer) {
    // Focus is stale (its element was removed) or not in the active layer —
    // land on the active layer's remembered/first cell instead of dead-ending.
    const remembered = lastFocusByLayer.get(layer)
    const target = remembered && registry.has(remembered) ? remembered : firstInLayer(layer)
    if (target) setFocus(target)
    return
  }

  const { group, row, col } = from

  if (dir === 'up' || dir === 'down') {
    const tr = dir === 'up' ? row - 1 : row + 1
    // Move to the target row honoring that row's column memory.
    const within = tr >= 0 ? nearestColInRow(layer, group, tr, col) : null
    if (within) {
      setFocus(within)
      return
    }
    // Cross-group: active-content top-row Up -> tabbar; tabbar Down -> content.
    if (dir === 'up' && group === activeContentGroup) {
      const t = firstInGroup(layer, 'tabbar')
      if (t) setFocus(t)
    } else if (dir === 'down' && group === 'tabbar') {
      const t = firstInGroup(layer, activeContentGroup)
      if (t) setFocus(t)
    }
    return
  }

  // Horizontal: within-group only (col +/- 1). No cross-group by default.
  const tc = dir === 'left' ? col - 1 : col + 1
  if (tc < 0) return
  const target = buildId(layer, group, row, tc)
  if (registry.has(target)) setFocus(target)
}

// ---------------------------------------------------------------------------
// focus layer stack
// ---------------------------------------------------------------------------
export function pushFocusLayer(layer) {
  if (currentFocusId) lastFocusByLayer.set(activeLayer(), currentFocusId)
  layerStack.push(layer)
  // Try to place focus in the new layer now; a freshly-mounted overlay may not
  // have registered its focusables yet, in which case the caller focusTo()s
  // after mount (typically in a useLayoutEffect).
  const remembered = lastFocusByLayer.get(layer)
  const target = (remembered && registry.has(remembered)) ? remembered : firstInLayer(layer)
  if (target) setFocus(target)
}

export function popFocusLayer() {
  if (layerStack.length <= 1) return
  layerStack.pop()
  const layer = activeLayer()
  // Restore where focus was in the layer we returned to; if that cell was
  // unmounted, fall back to the first focusable in the layer.
  const remembered = lastFocusByLayer.get(layer)
  const target = (remembered && registry.has(remembered)) ? remembered : firstInLayer(layer)
  if (target) applyFocus(target) // applyFocus (not setFocus) so a same-id restore still repaints
}

export function getActiveLayer() {
  return activeLayer()
}

// ---------------------------------------------------------------------------
// keyboard
// ---------------------------------------------------------------------------
let keyHandlerAttached = false
let customKeyHandler = null

// Overlays (filter panel, player, etc.) intercept keys in place; return true to
// consume the event before the default navigation runs.
export function setCustomKeyHandler(fn) {
  customKeyHandler = fn
}

const BACK_KEYCODE = 461 // webOS remote Back — NOT Backspace

export function initFocusEngine() {
  if (keyHandlerAttached) return
  keyHandlerAttached = true

  window.addEventListener('keydown', (e) => {
    if (customKeyHandler && customKeyHandler(e)) return

    // Back: webOS keyCode 461, plus browser-dev equivalents.
    if (
      e.keyCode === BACK_KEYCODE ||
      e.key === 'GoBack' ||
      e.key === 'Backspace' ||
      e.key === 'Escape'
    ) {
      e.preventDefault()
      e.stopPropagation()
      window.dispatchEvent(new CustomEvent('tv-back'))
      return
    }

    const dir = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
    }[e.key]

    if (dir) {
      e.preventDefault()
      navigate(dir)
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      if (currentFocusId) registry.get(currentFocusId)?.onSelect?.()
    }
  })
}

// ---------------------------------------------------------------------------
// the hook every focusable element uses
// ---------------------------------------------------------------------------
export function useFocusable({ layer = DEFAULT_LAYER, group = 'content', row = 0, col = 0, onSelect, onFocusChange }) {
  const id = buildId(layer, group, row, col)

  // Keep callbacks in refs so a changed callback NEVER re-registers the element
  // (a callback in the effect deps would loop forever as parents re-render).
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const onFocusChangeRef = useRef(onFocusChange)
  onFocusChangeRef.current = onFocusChange

  const elRef = useRef(null)

  useEffect(() => {
    registry.set(id, {
      layer,
      group,
      row,
      col,
      onSelect: () => onSelectRef.current?.(),
      onFocusChange: (f) => onFocusChangeRef.current?.(f),
    })
    return () => {
      registry.delete(id)
      // Intentionally DO NOT null currentFocusId here. A focused element can
      // transiently unmount/remount (React re-render, StrictMode) and would
      // otherwise leave focus dangling; keeping the id means the re-register +
      // self-heal restore it. A genuinely removed cell is handled by navigate's
      // stale-focus fallback and by popFocusLayer's memory restore.
    }
  }, [id, layer, group, row, col]) // deliberately NOT the callbacks

  // Self-healing: when React re-commits it can overwrite className and wipe the
  // imperatively-added `.focused`. Reapply it to the current focus element after
  // every commit.
  useLayoutEffect(() => {
    if (currentFocusId === id && elRef.current) {
      elRef.current.classList.add('focused')
    }
  })

  const handleClick = useCallback(
    (e) => {
      e.preventDefault()
      setFocus(id)
      onSelectRef.current?.()
    },
    [id],
  )
  // Pointer mode (webOS magic remote): highlight on hover, do not commit.
  const handleMouseEnter = useCallback(() => setFocus(id), [id])

  return {
    id,
    isFocused: currentFocusId === id, // snapshot at render time only, not reactive
    props: {
      ref: elRef,
      'data-focus-id': id,
      onClick: handleClick,
      onMouseEnter: handleMouseEnter,
    },
  }
}
