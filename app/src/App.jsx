/*
 * App shell + view stack.
 *
 * The shell (tab bar + one content area per tab) stays mounted for the whole
 * session; opening detail or player pushes an opaque overlay and hides whatever
 * is beneath it with display:none (never unmount — state and scroll survive).
 *
 * Focus layers mirror the view stack: shell = "home", detail = "detail",
 * player = "player". Each overlay pushes its focus layer on mount and pops it on
 * unmount, so the back chain and focus memory stay in lockstep with the stack.
 *
 * Content pages (Home/Category/Detail/Player) arrive in T10-T16; this task uses
 * focusable placeholders so navigation and the back chain can be exercised now.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import {
  initFocusEngine,
  focusTo,
  pushFocusLayer,
  popFocusLayer,
  getCurrentFocus,
  useFocusable,
} from './hooks/useFocus.js'
import { TABS } from './config/nav.js'
import TabBar from './components/TabBar.jsx'

// --- Placeholder content (replaced by real pages in T10-T14) ---------------
function ContentPlaceholder({ tab, onOpenDetail }) {
  const open = useFocusable({ layer: 'home', group: 'content', row: 0, col: 0, onSelect: () => onOpenDetail(1) })
  const other = useFocusable({ layer: 'home', group: 'content', row: 0, col: 1 })
  return (
    <div>
      <div className="placeholder-heading">{tab.label}</div>
      <div className="placeholder-row">
        <span className="focusable-chip" {...open.props}>打开详情占位</span>
        <span className="focusable-chip" {...other.props}>占位项</span>
      </div>
    </div>
  )
}

// --- Placeholder overlays (replaced by DetailPage/PlayerPage in T13/T16) ----
function OverlayPlaceholder({ layer, title, actionLabel, onAction, style }) {
  const act = useFocusable({ layer, group: 'content', row: 0, col: 0, onSelect: onAction })
  useEffect(() => {
    // Push this focus layer, then focus into it once its focusables have
    // registered (child register effects run before this parent effect).
    pushFocusLayer(layer)
    focusTo(`${layer}/content-0-0`)
    return () => popFocusLayer()
  }, [layer])
  return (
    <div className="overlay" style={style}>
      <div className="placeholder-heading">{title}</div>
      <div className="placeholder-row">
        <span className="focusable-chip" {...act.props}>{actionLabel}</span>
      </div>
    </div>
  )
}

export default function App() {
  const [activeTab, setActiveTab] = useState('home')
  const [stack, setStack] = useState([{ type: 'shell' }])
  // Per-tab refresh nonce — bumped on tab Enter/click; consumed by pages in T15.
  const [, setRefreshNonce] = useState({})

  const activeTabRef = useRef(activeTab)
  activeTabRef.current = activeTab
  const stackRef = useRef(stack)
  stackRef.current = stack

  const top = stack[stack.length - 1]
  const hasDetail = stack.some((f) => f.type === 'detail')
  const vis = (type) => ({ display: top.type === type ? 'block' : 'none' })

  const openDetail = useCallback((id) => setStack((s) => [...s, { type: 'detail', id }]), [])
  const openPlayer = useCallback((payload) => setStack((s) => [...s, { type: 'player', ...payload }]), [])

  useEffect(() => {
    initFocusEngine()
    focusTo('home/tabbar-0-0') // land on Home in the tab bar
  }, [])

  // Back-navigation chain: player -> detail -> content(->tabbar) -> exit.
  useEffect(() => {
    const onBack = () => {
      const prev = stackRef.current
      if (prev.length > 1) {
        // Pop the top overlay; its unmount cleanup pops the matching focus layer.
        setStack(prev.slice(0, -1))
        return
      }
      // At the shell: if focus is in the content area, return it to the tab bar;
      // if it is already on the tab bar, exit the app (no confirmation prompt).
      const cur = getCurrentFocus() || ''
      if (cur.startsWith('home/content-')) {
        const idx = Math.max(0, TABS.findIndex((t) => t.key === activeTabRef.current))
        focusTo(`home/tabbar-0-${idx}`)
        return
      }
      if (window.webOS?.platformBack) window.webOS.platformBack()
      else window.close?.()
    }
    window.addEventListener('tv-back', onBack)
    return () => window.removeEventListener('tv-back', onBack)
  }, [])

  return (
    <>
      <div className="shell" style={vis('shell')}>
        <TabBar
          activeTab={activeTab}
          onHoverTab={setActiveTab}
          onCommitTab={(key) => {
            setActiveTab(key)
            setRefreshNonce((n) => ({ ...n, [key]: (n[key] || 0) + 1 }))
          }}
        />
        {TABS.map((tab) => (
          <div key={tab.key} className="tab-content" style={{ display: tab.key === activeTab ? 'block' : 'none' }}>
            {tab.key === activeTab && <ContentPlaceholder tab={tab} onOpenDetail={openDetail} />}
          </div>
        ))}
      </div>

      {hasDetail && (
        <OverlayPlaceholder
          layer="detail"
          title="详情占位"
          actionLabel="播放占位"
          onAction={() => openPlayer({ id: top.id })}
          style={vis('detail')}
        />
      )}

      {top.type === 'player' && (
        <OverlayPlaceholder layer="player" title="播放器占位" actionLabel="播放器内占位按钮" onAction={() => {}} />
      )}
    </>
  )
}
