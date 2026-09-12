/*
 * App shell + view stack.
 *
 * The shell (tab bar + one content area per tab) stays mounted for the whole
 * session; opening detail or player pushes an opaque overlay and hides whatever
 * is beneath it with display:none (never unmount — state and scroll survive).
 *
 * Focus layers mirror the view stack: shell = "home", detail = "detail",
 * account overlay = "account", player = "player". Each overlay pushes its focus
 * layer on mount and pops it on unmount, so the back chain and focus memory
 * stay in lockstep with the stack. The account page is also a shell tab; the
 * overlay is the sign-in gate reached from detail and the player.
 *
 * The player is the one lazy() page: its chunk (and hls.js) must stay out of
 * the startup bundle, and it genuinely unmounts on back so playback stops.
 */
import { useEffect, useMemo, useRef, useState, useCallback, lazy, Suspense } from 'react'
import {
  initFocusEngine,
  focusTo,
  getCurrentFocus,
  setActiveContentGroup,
} from './hooks/useFocus.js'

// Each tab's content lives in its own focus group so all tabs can stay mounted
// without their focus ids colliding.
const contentGroup = (tabKey) => `content:${tabKey}`
import { orderedTabs, HOME_TAB_KEY } from './config/nav.js'
import TabBar from './components/TabBar.jsx'
import HomePage from './pages/HomePage.jsx'
import CategoryPage from './pages/CategoryPage.jsx'
import FilterPanel from './components/FilterPanel.jsx'
import DetailPage from './pages/DetailPage.jsx'
import FavoritesPage from './pages/FavoritesPage.jsx'
import HistoryPage from './pages/HistoryPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import SearchPage from './pages/SearchPage.jsx'
import AccountPage from './pages/AccountPage.jsx'
import { getFilter, setFilter } from './store/filters.js'
import { settingsStore, getSetting } from './store/settings.js'
import { sessionStore } from './store/session.js'
import * as pageCache from './store/pageCache.js'
import { useStoreValue } from './hooks/useStore.js'
import { prefetchAll } from './api/feeds.js'
import { exitApp } from './api/luna.js'
import { DEFAULT_SORT, DEFAULT_MEMBER, DEFAULT_LETTER } from './config/taxonomy.js'

const DEFAULT_FILTER = {
  genre: '0',
  area: '0',
  year: '0',
  member: DEFAULT_MEMBER,
  letter: DEFAULT_LETTER,
  sort: DEFAULT_SORT,
}

// Lazy: the player chunk (and hls.js inside it) loads on first playback, never
// at startup.
const PlayerPage = lazy(() => import('./player/PlayerPage.jsx'))

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

  // Tab bar order and visibility follow the user's saved preference (settings
  // 里可调整).
  const settings = useStoreValue(settingsStore)
  const tabs = useMemo(
    () => orderedTabs(getSetting(settings, 'tabOrder'), getSetting(settings, 'hiddenTabs')),
    [settings],
  )

  const activeTabRef = useRef(activeTab)
  activeTabRef.current = activeTab
  const stackRef = useRef(stack)
  stackRef.current = stack
  const tabsRef = useRef(tabs)
  tabsRef.current = tabs

  // Hiding the active tab leaves the shell pointing at a tab that no longer
  // exists; fall back to the first one still shown.
  useEffect(() => {
    if (!tabs.some((t) => t.key === activeTab)) setActiveTab(tabs[0].key)
  }, [tabs, activeTab])

  const top = stack[stack.length - 1]
  const hasDetail = stack.some((f) => f.type === 'detail')
  const accountFrame = stack.find((f) => f.type === 'account')
  const vis = (type) => ({ display: top.type === type ? 'block' : 'none' })

  const openDetail = useCallback((id) => setStack((s) => [...s, { type: 'detail', id }]), [])
  // Account overlay, from detail or the player: closes after login so the page
  // underneath reloads under the new session.
  const openAccount = useCallback(
    (from) => setStack((s) => (s[s.length - 1].type === 'account' ? s : [...s, { type: 'account', from }])),
    [],
  )
  const closeAccount = useCallback(
    () => setStack((s) => (s[s.length - 1].type === 'account' ? s.slice(0, -1) : s)),
    [],
  )
  // Ignore a second OK while the player frame is already on top (the lazy chunk
  // takes a beat to mount, during which the detail button can still fire).
  const openPlayer = useCallback(
    (payload) =>
      setStack((s) => (s[s.length - 1].type === 'player' ? s : [...s, { type: 'player', ...payload }])),
    [],
  )

  const openFilterFor = useCallback((category) => setFilterPanel({ open: true, category }), [])
  const closeFilter = useCallback(() => setFilterPanel({ open: false, category: null }), [])
  const applyFilterFor = useCallback((category, f) => {
    setFilter(category, f)
    setFilterOverrides((prev) => ({ ...prev, [category]: f }))
  }, [])

  useEffect(() => {
    initFocusEngine()
    setActiveContentGroup(contentGroup('home'))
    // Land on 首页 in the tab bar (搜索's icon button sits before it).
    const homeIndex = Math.max(0, tabsRef.current.findIndex((t) => t.key === HOME_TAB_KEY))
    focusTo(`home/tabbar-0-${homeIndex}`)
  }, [])

  // Background prefetch: warm every tab's cache sequentially so switching tabs
  // is spinner-free. Shares pageCache keys with the pages (no duplicate fetch).
  // An account change (login / logout / expiry) flushes every cached response
  // and warms again under the new session.
  const session = useStoreValue(sessionStore)
  const sessionToken = session?.token || null
  const prefetchTokenRef = useRef(sessionToken)
  useEffect(() => {
    if (prefetchTokenRef.current !== sessionToken) {
      prefetchTokenRef.current = sessionToken
      pageCache.clear()
    }
    let stopped = false
    prefetchAll(() => stopped)
    return () => {
      stopped = true
    }
  }, [sessionToken])

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
      // if it is already on the tab bar, hand Back to the system (exit prompt).
      const cur = getCurrentFocus() || ''
      if (cur.startsWith('home/content:')) {
        const idx = Math.max(0, tabsRef.current.findIndex((t) => t.key === activeTabRef.current))
        focusTo(`home/tabbar-0-${idx}`)
        return
      }
      exitApp()
    }
    window.addEventListener('tv-back', onBack)
    return () => window.removeEventListener('tv-back', onBack)
  }, [])

  return (
    <>
      <div className="relative h-[1080px] w-[1920px] bg-bg" style={vis('shell')}>
        <TabBar
          tabs={tabs}
          activeTab={activeTab}
          onHoverTab={setActiveTab}
          onCommitTab={(key) => {
            setActiveTab(key)
            setRefreshNonce((n) => ({ ...n, [key]: (n[key] || 0) + 1 }))
          }}
        />
        {/* Per-tab content areas (the sole scroll containers). Each starts at
            the very top so content passes under the translucent tab bar; the top
            padding keeps the resting position below it, and scroll-py-focus-safe
            (120px, > the bar's 84px) keeps every focus scroll from parking a card
            under the bar — it must be scroll-padding here rather than
            scroll-margin on the card, see the [data-focus-id] rule in index.css.
            The literal `tab-content` class is a marker for CategoryPage's
            closest(). */}
        {tabs.map((tab) => (
          <div
            key={tab.key}
            className="tab-content absolute inset-0 overflow-y-auto px-safe pt-content-top pb-content-bottom scroll-py-focus-safe"
            style={{ display: tab.key === activeTab ? 'block' : 'none' }}
          >
            {activated.has(tab.key) &&
              (tab.kind === 'home' ? (
                <HomePage group={contentGroup(tab.key)} onOpenDetail={openDetail} refreshNonce={refreshNonce[tab.key]} />
              ) : tab.kind === 'search' ? (
                <SearchPage group={contentGroup(tab.key)} onOpenDetail={openDetail} />
              ) : tab.kind === 'category' ? (
                <CategoryPage
                  category={tab.categoryId}
                  group={contentGroup(tab.key)}
                  onOpenDetail={openDetail}
                  onOpenFilter={() => openFilterFor(tab.categoryId)}
                  filterOverride={filterOverrides[tab.categoryId]}
                  refreshNonce={refreshNonce[tab.key]}
                />
              ) : tab.kind === 'favorites' ? (
                <FavoritesPage group={contentGroup(tab.key)} onOpenDetail={openDetail} />
              ) : tab.kind === 'history' ? (
                <HistoryPage group={contentGroup(tab.key)} active={tab.key === activeTab} onOpenDetail={openDetail} />
              ) : tab.kind === 'settings' ? (
                <SettingsPage group={contentGroup(tab.key)} />
              ) : (
                <AccountPage host="tab" group={contentGroup(tab.key)} />
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
          onRequireLogin={() => openAccount('detail')}
          style={vis('detail')}
        />
      )}

      {accountFrame && <AccountPage from={accountFrame.from} onDone={closeAccount} style={vis('account')} />}

      {top.type === 'player' && (
        <Suspense
          fallback={
            <div className="fixed inset-0 bg-black">
              <div className="absolute inset-0 flex items-center justify-center bg-black text-heading text-fg">加载中…</div>
            </div>
          }
        >
          <PlayerPage
            id={top.id}
            episodeIndex={top.episodeIndex}
            onRequireLogin={() => openAccount('player')}
          />
        </Suspense>
      )}
    </>
  )
}
