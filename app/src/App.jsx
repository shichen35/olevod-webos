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
  setActiveContentGroup,
  useFocusable,
} from './hooks/useFocus.js'

// Each tab's content lives in its own focus group so all tabs can stay mounted
// without their focus ids colliding.
const contentGroup = (tabKey) => `content:${tabKey}`
import { TABS } from './config/nav.js'
import TabBar from './components/TabBar.jsx'
import HomePage from './pages/HomePage.jsx'
import CategoryPage from './pages/CategoryPage.jsx'
import FilterPanel from './components/FilterPanel.jsx'
import DetailPage from './pages/DetailPage.jsx'
import LibraryPage from './pages/LibraryPage.jsx'
import { getFilter, setFilter } from './store/filters.js'
import { prefetchAll } from './api/feeds.js'
import { DEFAULT_SORT } from './config/taxonomy.js'

const DEFAULT_FILTER = { genre: '0', area: '0', year: '0', sort: DEFAULT_SORT }

// --- Placeholder overlay (player is replaced by PlayerPage in T16) ----------
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
  // Per-tab refresh nonce — bumped on tab Enter/click; consumed by pages (T15).
  const [refreshNonce, setRefreshNonce] = useState({})
  // Tabs mount on first activation and then stay mounted (state/scroll survive),
  // so switching back is instant and no tab fetches until it's first visited.
  const [activated, setActivated] = useState(() => new Set(['home']))
  // Filter panel (T12): which category's panel is open, and the applied filter
  // override that pushes changes down into that CategoryPage.
  const [filterPanel, setFilterPanel] = useState({ open: false, category: null })
  const [filterOverrides, setFilterOverrides] = useState({})

  const activeTabRef = useRef(activeTab)
  activeTabRef.current = activeTab
  const stackRef = useRef(stack)
  stackRef.current = stack

  const top = stack[stack.length - 1]
  const hasDetail = stack.some((f) => f.type === 'detail')
  const vis = (type) => ({ display: top.type === type ? 'block' : 'none' })

  const openDetail = useCallback((id) => setStack((s) => [...s, { type: 'detail', id }]), [])
  const openPlayer = useCallback((payload) => setStack((s) => [...s, { type: 'player', ...payload }]), [])

  const openFilterFor = useCallback((category) => setFilterPanel({ open: true, category }), [])
  const closeFilter = useCallback(() => setFilterPanel({ open: false, category: null }), [])
  const applyFilterFor = useCallback((category, f) => {
    setFilter(category, f)
    setFilterOverrides((prev) => ({ ...prev, [category]: f }))
  }, [])

  useEffect(() => {
    initFocusEngine()
    setActiveContentGroup(contentGroup('home'))
    focusTo('home/tabbar-0-0') // land on Home in the tab bar
  }, [])

  // Background prefetch: warm every tab's cache sequentially so switching tabs
  // is spinner-free. Shares pageCache keys with the pages (no duplicate fetch).
  useEffect(() => {
    let stopped = false
    prefetchAll(() => stopped)
    return () => {
      stopped = true
    }
  }, [])

  // Remember every tab that has been shown so it stays mounted afterwards, and
  // point the tab bar's down-bridge at the active tab's content group.
  useEffect(() => {
    setActiveContentGroup(contentGroup(activeTab))
    setActivated((prev) => {
      if (prev.has(activeTab)) return prev
      const next = new Set(prev)
      next.add(activeTab)
      return next
    })
  }, [activeTab])

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
      if (cur.startsWith('home/content:')) {
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
            {activated.has(tab.key) &&
              (tab.kind === 'home' ? (
                <HomePage group={contentGroup(tab.key)} onOpenDetail={openDetail} refreshNonce={refreshNonce[tab.key]} />
              ) : tab.kind === 'category' ? (
                <CategoryPage
                  category={tab.categoryId}
                  group={contentGroup(tab.key)}
                  onOpenDetail={openDetail}
                  onOpenFilter={() => openFilterFor(tab.categoryId)}
                  filterOverride={filterOverrides[tab.categoryId]}
                  refreshNonce={refreshNonce[tab.key]}
                />
              ) : (
                <LibraryPage group={contentGroup(tab.key)} onOpenDetail={openDetail} />
              ))}
          </div>
        ))}
      </div>

      {filterPanel.open && (
        <FilterPanel
          category={filterPanel.category}
          filter={filterOverrides[filterPanel.category] || getFilter(filterPanel.category) || DEFAULT_FILTER}
          onChange={(f) => applyFilterFor(filterPanel.category, f)}
          onReset={() => applyFilterFor(filterPanel.category, { ...DEFAULT_FILTER })}
          onClose={closeFilter}
        />
      )}

      {hasDetail && (
        <DetailPage
          id={stack.find((f) => f.type === 'detail').id}
          onPlay={(episodeIndex) => openPlayer({ id: stack.find((f) => f.type === 'detail').id, episodeIndex })}
          style={vis('detail')}
        />
      )}

      {top.type === 'player' && (
        <OverlayPlaceholder layer="player" title="播放器占位" actionLabel="播放器内占位按钮" onAction={() => {}} />
      )}
    </>
  )
}
