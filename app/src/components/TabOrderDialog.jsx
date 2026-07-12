/*
 * Tab-order dialog (settings). Lists the reorderable middle tabs — 首页 and
 * 我的 are pinned to the ends and not shown — each row with 上移/下移 buttons.
 * Moves write settings.tabOrder immediately, so the tab bar behind the dialog
 * reorders live. Own "tabsort" focus layer; Back or 完成 closes.
 *
 * Focus grid: row i = list item (col 0 = up, col 1 = down), last row = 完成.
 * After a move, focus follows the item to its new row (ids are positional and
 * the row count never changes, so the target id is always registered).
 */
import { useEffect, useMemo } from 'react'
import { useFocusable, pushFocusLayer, popFocusLayer, focusTo, setCustomKeyHandler } from '../hooks/useFocus.js'
import { useStoreValue } from '../hooks/useStore.js'
import { settingsStore, getSetting, setSetting } from '../store/settings.js'
import { orderedTabs } from '../config/nav.js'

const LAYER = 'tabsort'

function isBackKey(e) {
  return e.keyCode === 461 || e.key === 'Escape' || e.key === 'Backspace' || e.key === 'GoBack'
}

function SortButton({ row, col, glyph, disabled, onSelect }) {
  const { props } = useFocusable({ layer: LAYER, group: 'content', row, col, onSelect })
  return (
    <div
      className={`focusable w-21 rounded-xl bg-elev-2 py-3 text-center text-label text-fg-2 ${disabled ? 'opacity-35' : ''}`}
      {...props}
    >
      {glyph}
    </div>
  )
}

function DoneButton({ row, onSelect }) {
  const { props } = useFocusable({ layer: LAYER, group: 'content', row, col: 0, onSelect })
  return (
    <button className="focusable w-full rounded-[14px] bg-glass-active py-[18px] text-label text-fg" {...props}>
      完成
    </button>
  )
}

export default function TabOrderDialog({ onClose }) {
  const settings = useStoreValue(settingsStore)
  const tabs = useMemo(() => orderedTabs(getSetting(settings, 'tabOrder')), [settings])
  const items = useMemo(() => tabs.slice(1, -1), [tabs])

  useEffect(() => {
    pushFocusLayer(LAYER)
    focusTo(`${LAYER}/content-0-1`) // first row's 下移 (its 上移 is a no-op)
    setCustomKeyHandler((e) => {
      if (isBackKey(e)) {
        onClose()
        return true
      }
      return false
    })
    return () => {
      setCustomKeyHandler(null)
      popFocusLayer()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const move = (i, dir) => {
    const j = i + dir
    if (j < 0 || j >= items.length) return
    const keys = items.map((t) => t.key)
    ;[keys[i], keys[j]] = [keys[j], keys[i]]
    setSetting('tabOrder', keys)
    focusTo(`${LAYER}/content-${j}-${dir < 0 ? 0 : 1}`) // follow the moved item
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center">
      <div className="glass-strong w-[640px] rounded-3xl border border-glass-edge px-10 pt-11 pb-8">
        <div className="mb-4 text-title text-fg">调整标签栏顺序</div>
        <div className="mb-8 text-body leading-normal text-fg-2">首页与「我的」固定在两端，其余标签可上下移动。</div>
        <div className="mb-6 flex flex-col gap-2.5">
          {/* Keyed by position, not tab.key: focus ids are positional, and a
              keyed DOM move would carry the imperative .focused class along
              with the node while its id changes underneath it. */}
          {items.map((tab, i) => (
            <div className="flex items-center gap-3 rounded-[14px] bg-glass-active py-2.5 pr-2.5 pl-6" key={i}>
              <span className="flex-1 text-body text-fg">{tab.label}</span>
              <SortButton row={i} col={0} glyph="▲" disabled={i === 0} onSelect={() => move(i, -1)} />
              <SortButton row={i} col={1} glyph="▼" disabled={i === items.length - 1} onSelect={() => move(i, 1)} />
            </div>
          ))}
        </div>
        <DoneButton row={items.length} onSelect={onClose} />
      </div>
    </div>
  )
}
