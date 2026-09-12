/*
 * Top tab bar. Renders the shell's ordered tabs (nav.js orderedTabs, applied in
 * App.jsx) as focus group "tabbar" (row 0, col=index) in the "home" focus layer.
 *
 * Hover-switching: moving focus left/right across tabs switches the content area
 * below after a 150ms debounce (focus stays on the tab bar). Only Enter/click
 * commits — it switches immediately and bumps the tab's refresh nonce so the
 * page refetches (wired in T15). Down leaves the bar for the content area.
 *
 * The white focus fill slides between tabs via useSlidingCursor; see that hook
 * for the animation and the cursor-vs-selection rules. The tab bar just
 * supplies its capsule, tabs, and active tab.
 */
import { useRef } from 'react'
import { useFocusable } from '../hooks/useFocus.js'
import { useSlidingCursor } from '../hooks/useSlidingCursor.js'

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

  const activeIndex = tabs.findIndex((t) => t.key === activeTab)
  const { pillProps, cursorOnBar } = useSlidingCursor({
    containerRef: capsuleRef,
    group: 'tabbar',
    activeIndex,
    revision: tabs, // re-measure when the tab list reorders
  })

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
        {/* The single sliding white focus pill, behind the tabs (z-0). */}
        <div {...pillProps} />
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
