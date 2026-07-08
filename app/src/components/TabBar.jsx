/*
 * Top tab bar. Renders nav.js's TABS as focus group "tabbar" (row 0, col=index)
 * in the shell's "home" focus layer.
 *
 * Hover-switching: moving focus left/right across tabs switches the content area
 * below after a 150ms debounce (focus stays on the tab bar). Only Enter/click
 * commits — it switches immediately and bumps the tab's refresh nonce so the
 * page refetches (wired in T15). Down leaves the bar for the content area.
 */
import { useRef } from 'react'
import { useFocusable } from '../hooks/useFocus.js'
import { TABS } from '../config/nav.js'

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
  return (
    <div className={`tab${active ? ' tab-active' : ''}`} {...props}>
      {tab.label}
    </div>
  )
}

export default function TabBar({ activeTab, onHoverTab, onCommitTab }) {
  const debounceRef = useRef(null)

  return (
    <div className="tabbar">
      {TABS.map((tab, i) => (
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
  )
}
