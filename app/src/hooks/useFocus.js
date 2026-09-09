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
import { settingsStore, getSetting } from '../store/settings.js'

// id -> { layer, group, row, col, onSelect, onFocusChange }
const registry = new Map()

let currentFocusId = null

// Timestamp of the last focus-driven scroll. Rapid D-pad repeats (key auto-
// repeat, ~100-150ms apart) come in faster than a native smooth scroll can
// finish its fixed-duration animation, so each move restarts the animation from
// a position that never caught up — the cursor races off-screen and the scroll
// only settles once the user stops. Below RAPID_MS we drop to instant scroll so
// the scroller stays locked to the cursor; deliberate single moves (slower than
// this) keep the smooth animation.
let lastScrollTs = 0
const RAPID_MS = 220

// Horizontal breathing room kept between a focused chip and the edges of its
// scrolling strip — mirrors the inline scroll-margin in index.css (--spacing-safe).
const STRIP_SAFE = 84

// Reveal `el` within its nearest horizontally-scrollable ancestor by scrolling
// that ancestor directly. Deliberately NOT scrollIntoView: this targets only the
// horizontal strip, so a separate vertical scroll on a different ancestor (a top
// row's snap-to-top) can neither cancel it nor be cancelled by it. Returns
// silently when the element isn't inside a horizontal scroller (e.g. grid cards).
function scrollStripIntoView(el, behavior) {
  let strip = el.parentElement
  while (strip) {
    if (strip.scrollWidth > strip.clientWidth + 1) {
      const overflowX = getComputedStyle(strip).overflowX
      if (overflowX === 'auto' || overflowX === 'scroll') break
    }
    strip = strip.parentElement
  }
  if (!strip) return
  const er = el.getBoundingClientRect()
  const sr = strip.getBoundingClientRect()
  let delta = 0
  if (er.left < sr.left + STRIP_SAFE) delta = er.left - (sr.left + STRIP_SAFE)
  else if (er.right > sr.right - STRIP_SAFE) delta = er.right - (sr.right - STRIP_SAFE)
  if (delta !== 0) strip.scrollBy({ left: delta, behavior })
}

// The base layer is the root page (Home). Overlays push on top of it.
const DEFAULT_LAYER = 'home'
const layerStack = [DEFAULT_LAYER]

// Focus memory. Restored on layer pop / cross-group jumps / vertical row moves.
const lastFocusByLayer = new Map() // layer -> id
const lastFocusByGroup = new Map() // "{layer}/{group}" -> id
const rowMemory = new Map()        // "{layer}/{group}-{row}" -> col (read only for row-cursor groups)

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

// Groups where every row keeps its OWN cursor: entering a row vertically lands
// on that row's remembered column, or its first item if never visited —
// the current column is never carried across rows (Netflix-style shelves,
// where each row scrolls independently). Grids stay on the default carry-over
// behavior so vertical movement runs straight down a column.
const rowCursorGroups = new Set() // "{layer}/{group}"
export function setRowCursorGroup(layer, group, on = true) {
  const key = `${layer}/${group}`
  if (on) rowCursorGroups.add(key)
  else rowCursorGroups.delete(key)
}

// Groups whose vertical (up/down) moves are resolved by SCREEN GEOMETRY instead
// of column arithmetic: land on the card in the adjacent row whose horizontal
// center is closest to the current one. Home shelves scroll independently, so a
// remembered/carried column index doesn't line up with what the eye sees —
// picking by pixel position does. Horizontal moves stay arithmetic (col +/- 1),
// which for a single shelf already equals the visual order.
const geometryVerticalGroups = new Set() // "{layer}/{group}"
export function setGeometryVerticalGroup(layer, group, on = true) {
  const key = `${layer}/${group}`
  if (on) geometryVerticalGroups.add(key)
  else geometryVerticalGroups.delete(key)
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
      // Smooth scroll on every focus move — the app's sole scroll animation.
      // Not governed by the CSS transition/animation ban (that doesn't touch
      // scroll behavior); it's a deliberate motion exception (see index.css
      // header). Users can drop this to instant 'auto' via the 平滑滚动 setting.
      //
      // But during rapid D-pad repeats we force 'auto' regardless of the
      // setting: smooth's fixed-duration animation can't keep up with fast key
      // repeats, so it would lag the scroll behind the cursor (see lastScrollTs
      // above). Instant scroll keeps the scroller pinned to the cursor; the
      // remaining slow, deliberate moves still animate smoothly.
      const now = typeof performance !== 'undefined' ? performance.now() : 0
      const rapid = now - lastScrollTs < RAPID_MS
      lastScrollTs = now
      const behavior =
        getSetting(settingsStore.get(), 'smoothScroll') && !rapid ? 'smooth' : 'auto'
      if (rec && rec.row === 0 && rec.group !== 'tabbar') {
        // A top-row element sits in a horizontal strip (genre chips, a home
        // shelf). Drive its two scroll containers SEPARATELY: pull the page
        // scroller all the way up so the heading above row 0 shows (block:'nearest'
        // would leave it clipped), and reveal the element within its own strip.
        // We must NOT do this as scrollIntoView + scrollTo: issuing a scrollTo on
        // the vertical ancestor cancels scrollIntoView's in-flight smooth scroll
        // on the strip, so slow (smooth) horizontal moves along a top row weren't
        // scrolling at all. Targeting each container directly keeps them
        // independent — neither cancels the other, both animate.
        const scroller = el.closest('.tab-content, .overlay')
        if (scroller) scroller.scrollTo({ top: 0, behavior })
        scrollStripIntoView(el, behavior)
      } else {
        el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior })
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

// Nearest existing column in a target row, then walk outward within a bounded
// window. Row-cursor groups (home shelves) land on the row's remembered column
// (first item if never visited); every other group keeps the incoming column
// so vertical movement runs straight down.
function nearestColInRow(layer, group, row, preferCol) {
  const rowCursor = rowCursorGroups.has(`${layer}/${group}`)
  const remembered = rowCursor ? rowMemory.get(`${layer}/${group}-${row}`) : null
  const startCol = remembered != null ? remembered : rowCursor ? 0 : preferCol

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

// Geometry-vertical column pick: among the cells that exist in `row`, the one
// whose on-screen horizontal center is closest to `centerX`. Columns are
// contiguous from 0 (cards render col = index), so a bounded probe covers the
// row without a registry scan. Returns null if the row has no mounted cells.
function geometryColInRow(layer, group, row, centerX) {
  let bestId = null
  let bestDx = Infinity
  for (let c = 0; c <= PROBE_LIMIT; c++) {
    const id = buildId(layer, group, row, c)
    if (!registry.has(id)) continue
    const el = document.querySelector(`[data-focus-id="${id}"]`)
    if (!el) continue
    const r = el.getBoundingClientRect()
    const dx = Math.abs(r.left + r.width / 2 - centerX)
    if (dx < bestDx) {
      bestDx = dx
      bestId = id
    }
  }
  return bestId
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
    // Geometry-vertical groups (home shelves) land on the adjacent row's card
    // nearest the current horizontal center; everyone else honors column memory.
    let within = null
    if (tr >= 0) {
      if (geometryVerticalGroups.has(`${layer}/${group}`)) {
        const el = document.querySelector(`[data-focus-id="${currentFocusId}"]`)
        const cr = el?.getBoundingClientRect()
        within = cr
          ? geometryColInRow(layer, group, tr, cr.left + cr.width / 2)
          : nearestColInRow(layer, group, tr, col)
      } else {
        within = nearestColInRow(layer, group, tr, col)
      }
    }
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
// Stack of layer key handlers; only the topmost one sees keys. A stack (not a
// single slot) so a dialog opened over a page that has its own handler (the
// account page's digit keys) hands the keys back when it closes.
const customKeyHandlers = []

// Overlays (filter panel, player, dialogs, etc.) intercept keys in place;
// return true to consume the event before the default navigation runs.
// Returns the matching pop function — call it on unmount.
export function pushCustomKeyHandler(fn) {
  customKeyHandlers.push(fn)
  return () => {
    const i = customKeyHandlers.lastIndexOf(fn)
    if (i >= 0) customKeyHandlers.splice(i, 1)
  }
}

const BACK_KEYCODE = 461 // webOS remote Back — NOT Backspace

export function initFocusEngine() {
  if (keyHandlerAttached) return
  keyHandlerAttached = true

  window.addEventListener('keydown', (e) => {
    // While a text field has real DOM focus (system keyboard open / browser
    // caret), every key belongs to the field: arrows move the caret (on TV the
    // VKB consumes them before we ever see them), Backspace deletes, Enter is
    // the field's own commit (handled by the field's onKeyDown). Only Back /
    // Escape is intercepted here — it closes the keyboard and returns to D-pad
    // navigation instead of triggering the app back-chain. Backspace must NOT
    // be treated as Back in this state.
    const t = e.target
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) {
      if (e.keyCode === BACK_KEYCODE || e.key === 'GoBack' || e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        t.blur()
      }
      return
    }

    const customKeyHandler = customKeyHandlers[customKeyHandlers.length - 1]
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
  // imperatively-added `.focused` — or move a keyed DOM node that still carries
  // it. Re-assert the invariant (only the current focus id's element has
  // `.focused`) after every commit.
  useLayoutEffect(() => {
    if (!elRef.current) return
    if (currentFocusId === id) {
      elRef.current.classList.add('focused')
    } else {
      elRef.current.classList.remove('focused')
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
