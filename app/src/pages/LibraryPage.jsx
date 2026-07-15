/*
 * Library ("我的") tab: three segments — Favorites / History / Settings — with
 * the same focus-hover auto-switch as the tab bar. Favorites and History are
 * 6-column card grids fed live from the stores; Settings is a grouped list
 * (clear history via ConfirmDialog) with the app version as a plain label below.
 */
import { useCallback, useRef, useState } from 'react'
import VideoCard from '../components/VideoCard.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import TabOrderDialog from '../components/TabOrderDialog.jsx'
import { useFocusable } from '../hooks/useFocus.js'
import { useSlidingCursor } from '../hooks/useSlidingCursor.js'
import { useStoreValue } from '../hooks/useStore.js'
import { favoritesStore } from '../store/favorites.js'
import { historyStore, clear as clearHistory } from '../store/history.js'
import { settingsStore, getSetting, toggleSetting } from '../store/settings.js'

const COLS = 6
const CONTENT_ROW0 = 1 // segment control is row 0; content starts at row 1

const SEGMENTS = [
  { key: 'fav', label: '收藏' },
  { key: 'history', label: '历史' },
  { key: 'settings', label: '设置' },
]

function SegChip({ group, col, label, active, showSelection, onHover, onSelect }) {
  const { props } = useFocusable({
    layer: 'home',
    group,
    row: 0,
    col,
    onSelect,
    onFocusChange: (f) => {
      if (f) onHover()
    },
  })
  // Same look as the tab bar pills: the sliding white cursor is the focus fill,
  // so the focused chip clears its own background and darkens its label; the
  // glass selection mark shows only when the cursor is off the bar.
  return (
    <div
      className={`relative z-1 rounded-full px-7 py-2 text-label focused:bg-transparent focused:text-inverse ${active && showSelection ? 'bg-glass-active text-fg' : 'text-fg-2'}`}
      {...props}
    >
      {label}
    </div>
  )
}

function CardGrid({ items, group, onOpenDetail, withEp }) {
  if (!items.length) return <div className="py-20 text-center text-body text-fg-3">这里还没有内容</div>
  return (
    <div className="grid grid-cols-6 gap-x-gutter gap-y-6">
      {items.map((item, i) => (
        <VideoCard
          key={`${item.id}-${i}`}
          item={item}
          layer="home"
          group={group}
          row={CONTENT_ROW0 + Math.floor(i / COLS)}
          col={i % COLS}
          onSelect={() => onOpenDetail(item.id)}
          watchedEp={withEp ? item.watch?.lastEpisodeIndex : undefined}
          progress={withEp ? item.watch : undefined}
        />
      ))}
    </div>
  )
}

// tvOS-style list row: transparent at rest, solid white fill + dark text when
// focused (from `focusable`).
const SETTINGS_ROW = 'focusable rounded-[14px] px-6 py-5 text-body text-fg'

function SettingsRow({ group, row, label, onSelect }) {
  const { props } = useFocusable({ layer: 'home', group, row, col: 0, onSelect })
  return (
    <div className={SETTINGS_ROW} {...props}>
      {label}
    </div>
  )
}

function SettingsToggle({ group, row, label, on, onToggle }) {
  const { props } = useFocusable({ layer: 'home', group, row, col: 0, onSelect: onToggle })
  return (
    <div className={`${SETTINGS_ROW} flex items-center justify-between`} {...props}>
      <span>{label}</span>
      {/* Apple-style switch: opaque track (accent when on), knob slides via
          margin. The focused: shades keep it readable on the white focused row. */}
      <span
        className={`flex h-11 w-19 items-center rounded-full p-1 ${on ? 'bg-accent' : 'bg-elev-2 focused:bg-[#c9c9ce]'}`}
      >
        <span className={`size-9 rounded-full bg-fg focused:bg-white ${on ? 'ml-auto' : ''}`} />
      </span>
    </div>
  )
}

export default function LibraryPage({ group = 'content', onOpenDetail }) {
  const [seg, setSeg] = useState('fav')
  const [confirmClear, setConfirmClear] = useState(false)
  const [tabOrderOpen, setTabOrderOpen] = useState(false)
  const debounceRef = useRef(null)
  const capsuleRef = useRef(null)

  const activeIndex = SEGMENTS.findIndex((s) => s.key === seg)
  // Same sliding white cursor as the top tab bar (shared hook).
  const { pillProps, cursorOnBar } = useSlidingCursor({ containerRef: capsuleRef, group, activeIndex })

  const favorites = useStoreValue(favoritesStore)
  const history = useStoreValue(historyStore)
  const settings = useStoreValue(settingsStore)

  const hoverSeg = useCallback((key) => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setSeg(key), 150)
  }, [])
  const commitSeg = useCallback((key) => {
    clearTimeout(debounceRef.current)
    setSeg(key)
  }, [])

  return (
    <div className="pt-4">
      {/* Segment control (row 0): glass capsule, same material as the tab bar.
          `relative` makes it the sliding pill's offsetParent. */}
      <div
        ref={capsuleRef}
        className="glass relative mb-7 inline-flex items-center gap-2 rounded-full border border-glass-edge px-2.5 py-1.5"
      >
        {/* The single sliding white focus pill, behind the chips (z-0). */}
        <div {...pillProps} />
        {SEGMENTS.map((s, i) => (
          <SegChip
            key={s.key}
            group={group}
            col={i}
            label={s.label}
            active={seg === s.key}
            showSelection={!cursorOnBar}
            onHover={() => hoverSeg(s.key)}
            onSelect={() => commitSeg(s.key)}
          />
        ))}
      </div>

      {seg === 'fav' && <CardGrid items={favorites} group={group} onOpenDetail={onOpenDetail} />}
      {seg === 'history' && <CardGrid items={history} group={group} onOpenDetail={onOpenDetail} withEp />}
      {seg === 'settings' && (
        <>
          {/* iOS-style inset grouped list + version caption below. */}
          <div className="glass max-w-[900px] rounded-[20px] border border-glass-edge p-1.5">
            <SettingsToggle
              group={group}
              row={1}
              label="首页显示收藏"
              on={getSetting(settings, 'homeShowFavorites')}
              onToggle={() => toggleSetting('homeShowFavorites')}
            />
            <SettingsToggle
              group={group}
              row={2}
              label="首页显示最近观看"
              on={getSetting(settings, 'homeShowRecent')}
              onToggle={() => toggleSetting('homeShowRecent')}
            />
            <SettingsToggle
              group={group}
              row={3}
              label="平滑滚动"
              on={getSetting(settings, 'smoothScroll')}
              onToggle={() => toggleSetting('smoothScroll')}
            />
            <SettingsRow group={group} row={4} label="调整标签栏顺序" onSelect={() => setTabOrderOpen(true)} />
            <SettingsRow group={group} row={5} label="清除观看历史" onSelect={() => setConfirmClear(true)} />
          </div>
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 text-center text-caption text-fg-3">版本 {__APP_VERSION__}</div>
        </>
      )}

      {tabOrderOpen && <TabOrderDialog onClose={() => setTabOrderOpen(false)} />}

      {confirmClear && (
        <ConfirmDialog
          title="清除观看历史"
          description="将删除全部观看记录与继续观看进度，此操作无法撤销。"
          confirmLabel="清除"
          cancelLabel="取消"
          onConfirm={() => {
            clearHistory()
            setConfirmClear(false)
          }}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </div>
  )
}
