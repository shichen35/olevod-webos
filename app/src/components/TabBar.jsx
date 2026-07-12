/*
 * Top tab bar. Renders the shell's ordered tabs (nav.js orderedTabs, applied in
 * App.jsx) as focus group "tabbar" (row 0, col=index) in the "home" focus layer.
 *
 * Hover-switching: moving focus left/right across tabs switches the content area
 * below after a 150ms debounce (focus stays on the tab bar). Only Enter/click
 * commits — it switches immediately and bumps the tab's refresh nonce so the
 * page refetches (wired in T15). Down leaves the bar for the content area.
 */
import { useRef } from 'react'
import { useFocusable } from '../hooks/useFocus.js'

function TabItem({ tab, col, active, onHover, onSelect }) {
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
  // Focus (solid white fill, dark text via `focusable`) wins over the selected
  // glass pill: .focused's two-class specificity outranks the active utilities.
  return (
    <div
      className={`focusable rounded-full px-7 py-2 text-label ${active ? 'bg-glass-active text-fg' : 'text-fg-2'}`}
      {...props}
    >
      {tab.label}
    </div>
  )
}

export default function TabBar({ tabs, activeTab, onHoverTab, onCommitTab }) {
  const debounceRef = useRef(null)

  return (
    // The bar itself is fully transparent (z-1 keeps it above the tab-content
    // scrollers that extend beneath it); the glass lives on the capsule so
    // content scrolling past shows through around it. The shadow is a static
    // lift, painted once.
    <div className="absolute inset-x-0 top-0 z-1 flex h-21 items-center justify-center pt-5">
      <div className="glass flex items-center gap-2 rounded-full border border-glass-edge px-2.5 py-1.5 shadow-[0_8px_28px_rgba(0,0,0,0.35)]">
        {tabs.map((tab, i) => (
          <TabItem
            key={tab.key}
            tab={tab}
            col={i}
            active={tab.key === activeTab}
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
