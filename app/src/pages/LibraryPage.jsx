/*
 * Library ("我的") tab: three segments — Favorites / History / Settings — with
 * the same focus-hover auto-switch as the tab bar. Favorites and History are
 * 6-column card grids fed live from the stores; Settings is a grouped list
 * (clear history via ConfirmDialog) with the app version as a plain label below.
 */
import { useCallback, useRef, useState } from 'react'
import VideoCard from '../components/VideoCard.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { useFocusable } from '../hooks/useFocus.js'
import { useStoreValue } from '../hooks/useStore.js'
import { favoritesStore } from '../store/favorites.js'
import { historyStore, clear as clearHistory } from '../store/history.js'

const COLS = 6
const CONTENT_ROW0 = 1 // segment control is row 0; content starts at row 1

const SEGMENTS = [
  { key: 'fav', label: '收藏' },
  { key: 'history', label: '历史' },
  { key: 'settings', label: '设置' },
]

function SegChip({ group, col, label, active, onHover, onSelect }) {
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
  return (
    <div className={`seg${active ? ' seg-active' : ''}`} {...props}>
      {label}
    </div>
  )
}

function CardGrid({ items, group, onOpenDetail, withEp }) {
  if (!items.length) return <div className="library-empty">这里还没有内容</div>
  return (
    <div className="grid">
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

function SettingsRow({ group, row, label, kind, onSelect }) {
  const { props } = useFocusable({ layer: 'home', group, row, col: 0, onSelect })
  return (
    <div className={`settings-row focusable-row${kind ? ` settings-row-${kind}` : ''}`} {...props}>
      {label}
    </div>
  )
}

export default function LibraryPage({ group = 'content', onOpenDetail }) {
  const [seg, setSeg] = useState('fav')
  const [confirmClear, setConfirmClear] = useState(false)
  const debounceRef = useRef(null)

  const favorites = useStoreValue(favoritesStore)
  const history = useStoreValue(historyStore)

  const hoverSeg = useCallback((key) => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setSeg(key), 150)
  }, [])
  const commitSeg = useCallback((key) => {
    clearTimeout(debounceRef.current)
    setSeg(key)
  }, [])

  return (
    <div className="library">
      <div className="segments">
        {SEGMENTS.map((s, i) => (
          <SegChip
            key={s.key}
            group={group}
            col={i}
            label={s.label}
            active={seg === s.key}
            onHover={() => hoverSeg(s.key)}
            onSelect={() => commitSeg(s.key)}
          />
        ))}
      </div>

      {seg === 'fav' && <CardGrid items={favorites} group={group} onOpenDetail={onOpenDetail} />}
      {seg === 'history' && <CardGrid items={history} group={group} onOpenDetail={onOpenDetail} withEp />}
      {seg === 'settings' && (
        <>
          <div className="settings-list">
            <SettingsRow group={group} row={1} label="清除观看历史" kind="danger" onSelect={() => setConfirmClear(true)} />
          </div>
          <div className="settings-version">版本 {__APP_VERSION__}</div>
        </>
      )}

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
