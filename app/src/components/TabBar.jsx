/*
 * Top tab bar. Renders the shell's ordered tabs (nav.js orderedTabs, applied in
 * App.jsx) as focus group "tabbar" (row 0, col=index) in the "home" focus layer.
 *
 * Hover-switching: moving focus left/right across tabs switches the content area
 * below after a 150ms debounce (focus stays on the tab bar). Only Enter/click
 * commits — it switches immediately and bumps the tab's refresh nonce so the
 * page refetches (wired in T15). Down leaves the bar for the content area.
 *
 * Focus-fill motion (the app's one sanctioned animation — see styles/index.css
 * header): instead of each tab toggling its own instant white `.focused` fill,
 * a SINGLE white pill is the D-pad cursor and slides between tabs (100ms). At
 * rest it looks exactly like the old solid fill; it's only visible while focus
 * is on the bar. Driven off the focus engine (read-only — its zero-rerender
 * path is untouched) via the Web Animations API, which runs independently of
 * the CSS `transition/animation: none` ban.
 *
 * Cursor vs. selection: the sliding white pill (cursor) tracks focus; the
 * active tab's glass mark (selection) tracks `activeTab`, which lags by the
 * 150ms hover debounce. Showing both while navigating looks like the selection
 * trailing the cursor, so the glass mark is HIDDEN whenever focus is on the bar
 * (`cursorOnBar`) — on the bar you see only the sliding cursor; once focus
 * leaves, the cursor hides and the glass mark appears on the active tab.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { onFocusChange, getCurrentFocus, useFocusable } from '../hooks/useFocus.js'

const TAB_PREFIX = 'home/tabbar-0-'

function TabItem({ tab, col, active, showSelection, onHover, onSelect }) {
  const { props } = useFocusable({
    layer: 'home',
    group: 'tabbar',
    row: 0,
    col,
    onSelect,
    onFocusChange: (focused) => {
      if (focused) onHover()
    },
  })
  // The sliding white pill IS the focus fill, so the focused tab clears its own
  // background to let the pill show through and flips its label to dark text —
  // the same white-fill/dark-text look the old instant `.focused` state had.
  // The active tab's glass selection mark shows only when focus is off the bar
  // (showSelection), so it never trails the moving cursor.
  return (
    <div
      className={`relative z-1 rounded-full px-7 py-2 text-label focused:bg-transparent focused:text-inverse ${active && showSelection ? 'bg-glass-active text-fg' : 'text-fg-2'}`}
      {...props}
    >
      {tab.label}
    </div>
  )
}

export default function TabBar({ tabs, activeTab, onHoverTab, onCommitTab }) {
  const debounceRef = useRef(null)
  const capsuleRef = useRef(null)
  const indicatorRef = useRef(null)
  // Where the pill currently sits, so a move can slide from there. Null while
  // hidden (focus off the bar) — the next show places instantly, no fly-in.
  const prevGeom = useRef(null)

  const activeIndex = tabs.findIndex((t) => t.key === activeTab)
  // Live mirror so the focus-change listener (bound once) reads the current
  // active index without a stale closure.
  const activeIndexRef = useRef(activeIndex)
  activeIndexRef.current = activeIndex

  // Is the D-pad cursor currently on the tab bar? Drives whether the active
  // tab's glass selection mark shows (see header). Only flips on enter/leave,
  // so moving within the bar is a same-value setState React bails on.
  const [cursorOnBar, setCursorOnBar] = useState(() => {
    const f = getCurrentFocus()
    return f == null || f.startsWith(TAB_PREFIX)
  })

  // The tab the pill should cover: the focused tab while focus is on the bar.
  // Focus elsewhere → -1 (hide the pill). Before the engine initializes focus
  // (null) we show it on the active tab so the bar isn't briefly bare on mount.
  const targetIndex = useCallback(() => {
    const f = getCurrentFocus()
    if (f == null) return activeIndexRef.current
    if (f.startsWith(TAB_PREFIX)) {
      const n = parseInt(f.slice(TAB_PREFIX.length), 10)
      if (Number.isInteger(n)) return n
    }
    return -1
  }, [])

  // Move the pill onto tab `idx` (or hide it if idx < 0). Absolute + offset math
  // means only this one node moves; tabs never reflow. `animate` slides from the
  // previous spot; a hidden pill re-shows instantly.
  const placePill = useCallback((idx, animate) => {
    const pill = indicatorRef.current
    const capsule = capsuleRef.current
    if (!pill || !capsule) return

    const el = idx >= 0 ? capsule.querySelector(`[data-focus-id="${TAB_PREFIX}${idx}"]`) : null
    if (!el) {
      pill.style.opacity = '0'
      prevGeom.current = null
      return
    }

    const left = el.offsetLeft
    const width = el.offsetWidth
    pill.style.transform = `translateX(${left}px)`
    pill.style.width = `${width}px`
    pill.style.top = `${el.offsetTop}px`
    pill.style.height = `${el.offsetHeight}px`
    pill.style.opacity = '1'

    const from = prevGeom.current
    prevGeom.current = { left, width }
    if (!animate || !from || (from.left === left && from.width === width)) return

    // The slide: transform + width only, on this one node, 100ms linear-ish so
    // the cursor stays snappy. Cancel any in-flight run so fast left/right
    // presses chain into one motion instead of stacking.
    pill.getAnimations().forEach((a) => a.cancel())
    pill.animate(
      [
        { transform: `translateX(${from.left}px)`, width: `${from.width}px` },
        { transform: `translateX(${left}px)`, width: `${width}px` },
      ],
      { duration: 100, easing: 'ease' },
    )
  }, [])

  // Slide the pill on every focus move (so it tracks the D-pad cursor across the
  // bar, and hides when focus leaves), and flip cursorOnBar so the selection
  // mark shows only off the bar — bound once; placePill/targetIndex read live
  // state through refs.
  useEffect(
    () =>
      onFocusChange(() => {
        const f = getCurrentFocus()
        setCursorOnBar(f != null && f.startsWith(TAB_PREFIX))
        placePill(targetIndex(), true)
      }),
    [placePill, targetIndex],
  )

  // Reposition when the active tab changes (or tabs reorder). First run places
  // instantly; later runs slide. When focus is on the bar this resolves to the
  // focused tab, so it no-ops against the focus-driven placement above.
  useLayoutEffect(() => {
    placePill(targetIndex(), prevGeom.current != null)
  }, [activeIndex, tabs, placePill, targetIndex])

  return (
    // The bar itself is fully transparent (z-1 keeps it above the tab-content
    // scrollers that extend beneath it); the glass lives on the capsule so
    // content scrolling past shows through around it. The shadow is a static
    // lift, painted once.
    <div className="absolute inset-x-0 top-0 z-1 flex h-21 items-center justify-center pt-5">
      <div
        ref={capsuleRef}
        className="glass relative flex items-center gap-2 rounded-full border border-glass-edge px-2.5 py-1.5 shadow-[0_8px_28px_rgba(0,0,0,0.35)]"
      >
        {/* The single sliding white focus pill. Sits behind the tabs (z-0);
            position/size/visibility are set imperatively in placePill. */}
        <div
          ref={indicatorRef}
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 z-0 rounded-full bg-focus opacity-0"
        />
        {tabs.map((tab, i) => (
          <TabItem
            key={tab.key}
            tab={tab}
            col={i}
            active={tab.key === activeTab}
            showSelection={!cursorOnBar}
            onHover={() => {
              clearTimeout(debounceRef.current)
              // Debounce so quickly passing through tabs doesn't flash a load.
              debounceRef.current = setTimeout(() => onHoverTab(tab.key), 150)
            }}
            onSelect={() => {
              clearTimeout(debounceRef.current)
              onCommitTab(tab.key)
            }}
          />
        ))}
      </div>
    </div>
  )
}
