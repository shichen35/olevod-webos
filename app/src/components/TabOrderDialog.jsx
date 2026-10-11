/*
 * Tab bar dialog (settings): reorder the middle tabs, and hide or show any tab.
 *
 * Two sections — 显示中 and 已隐藏. Hiding moves a tab into 已隐藏 and out of the
 * tab bar; showing puts it back in the slot it had, because settings.tabOrder
 * keeps every middle tab (hidden ones included) and only the tab bar filters.
 * 首页 stays pinned first, so its arrows are inert. The pinned icon tabs (搜索
 * and 收藏 / 历史 / 设置 / 账号) are never listed: 设置 carries the entry back
 * here, and they keep their places at the two ends of the bar.
 *
 * Writes land immediately, so the tab bar behind the dialog updates live.
 * Back or 完成 closes; 重置为默认 drops both the saved order and the hidden set.
 *
 * Focus grid (own "tabsort" layer): 显示中 rows first (col 0 = 上移, col 1 =
 * 下移, col 2 = 隐藏), then 已隐藏 rows (col 0 = 显示), then 完成, then 重置.
 * Hiding or showing changes the row count, so the follow-up focus is queued in
 * a ref and applied after the re-render, once the new ids are registered.
 */
import { useEffect, useMemo, useRef } from 'react'
import { useFocusable, pushFocusLayer, popFocusLayer, focusTo, pushCustomKeyHandler, isBackKey } from '../hooks/useFocus.js'
import { useStoreValue } from '../hooks/useStore.js'
import { settingsStore, getSetting, setSetting } from '../store/settings.js'
import { TABS, orderedTabs, middleTabKeys, HOME_TAB_KEY } from '../config/nav.js'

const LAYER = 'tabsort'

function RowButton({ row, col, label, disabled, wide = false, onSelect }) {
  const { props } = useFocusable({ layer: LAYER, group: 'content', row, col, onSelect })
  return (
    <div
      className={`focusable rounded-xl bg-elev-2 py-3 text-center text-label text-fg-2 ${wide ? 'px-6' : 'w-21'} ${disabled ? 'opacity-35' : ''}`}
      {...props}
    >
      {label}
    </div>
  )
}

function DialogButton({ row, label, onSelect }) {
  const { props } = useFocusable({ layer: LAYER, group: 'content', row, col: 0, onSelect })
  return (
    <button className="focusable w-full rounded-[14px] bg-glass-active py-[18px] text-label text-fg" {...props}>
      {label}
    </button>
  )
}

export default function TabOrderDialog({ onClose }) {
  const settings = useStoreValue(settingsStore)
  const order = getSetting(settings, 'tabOrder')
  const hidden = getSetting(settings, 'hiddenTabs') || []

  // Rows: everything except the pinned tabs, shown first and hidden after.
  const shown = useMemo(() => orderedTabs(order, hidden).filter((t) => !t.pinned), [order, hidden])
  const hiddenTabs = useMemo(() => TABS.filter((t) => !t.pinned && hidden.includes(t.key)), [hidden])
  // The saved order covers every middle tab, hidden ones included, so a tab
  // that comes back lands where it was.
  const fullOrder = useMemo(() => middleTabKeys(order), [order])

  const doneRow = shown.length + hiddenTabs.length
  const resetRow = doneRow + 1

  // Focus to apply once the changed row set has rendered.
  const pendingFocusRef = useRef(null)
  useEffect(() => {
    if (!pendingFocusRef.current) return
    focusTo(pendingFocusRef.current)
    pendingFocusRef.current = null
  })

  useEffect(() => {
    pushFocusLayer(LAYER)
    // Land on the first row that can actually move; with nothing movable
    // (everything hidden, or only 首页 left) land on 完成 instead of an inert
    // arrow or, worse, a 隐藏 button one OK press away.
    const firstMovable = shown.findIndex((t, i) => t.key !== HOME_TAB_KEY && i < shown.length - 1)
    focusTo(firstMovable >= 0 ? `${LAYER}/content-${firstMovable}-1` : `${LAYER}/content-${doneRow}-0`)
    const popKeys = pushCustomKeyHandler((e) => {
      if (isBackKey(e)) {
        onClose()
        return true
      }
      return false
    })
    return () => {
      popKeys()
      popFocusLayer()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const queueFocus = (row, col) => {
    pendingFocusRef.current = `${LAYER}/content-${row}-${col}`
  }

  const move = (rowIndex, dir) => {
    const tab = shown[rowIndex]
    const neighbor = shown[rowIndex + dir]
    // 首页 is pinned first and never swaps; neither does a row at either end.
    if (!tab || !neighbor || tab.key === HOME_TAB_KEY || neighbor.key === HOME_TAB_KEY) return
    const keys = [...fullOrder]
    const i = keys.indexOf(tab.key)
    const j = keys.indexOf(neighbor.key)
    if (i < 0 || j < 0) return
    ;[keys[i], keys[j]] = [keys[j], keys[i]]
    setSetting('tabOrder', keys)
    queueFocus(rowIndex + dir, dir < 0 ? 0 : 1)
  }

  const hide = (rowIndex) => {
    const tab = shown[rowIndex]
    if (!tab) return
    const nextHidden = [...hidden, tab.key]
    // Keep the order list complete so the tab remembers its slot.
    setSetting('tabOrder', fullOrder)
    setSetting('hiddenTabs', nextHidden)
    const nextShown = orderedTabs(fullOrder, nextHidden).filter((t) => !t.pinned)
    const nextHiddenTabs = TABS.filter((t) => !t.pinned && nextHidden.includes(t.key))
    queueFocus(nextShown.length + nextHiddenTabs.findIndex((t) => t.key === tab.key), 0)
  }

  const show = (tabKey) => {
    const nextHidden = hidden.filter((k) => k !== tabKey)
    setSetting('hiddenTabs', nextHidden)
    const nextShown = orderedTabs(order, nextHidden).filter((t) => !t.pinned)
    queueFocus(Math.max(0, nextShown.findIndex((t) => t.key === tabKey)), 0)
  }

  const reset = () => {
    setSetting('tabOrder', null)
    setSetting('hiddenTabs', [])
    queueFocus(TABS.filter((t) => !t.pinned).length, 0) // every listed tab is shown again -> 完成
  }

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center">
      <div className="glass-strong flex max-h-[900px] w-[720px] flex-col rounded-3xl border border-glass-edge px-10 pt-11 pb-8">
        <div className="mb-4 shrink-0 text-title text-fg">标签栏</div>
        <div className="mb-6 shrink-0 text-body leading-normal text-fg-2">
          首页固定在最前，可上下调整其余标签，也可以隐藏任意标签。两侧的搜索、收藏、历史、设置、账号图标始终显示。
        </div>

        <div className="mb-6 flex flex-col gap-2.5 overflow-y-auto scroll-py-focus-safe">
          <div className="text-caption text-fg-3">显示中</div>
          {/* Keyed by position, not tab.key: focus ids are positional, and a
              keyed DOM move would carry the imperative .focused class along
              with the node while its id changes underneath it. */}
          {shown.map((tab, i) => {
            const pinned = tab.key === HOME_TAB_KEY
            // 首页 never moves, and neither does a tab that only has 首页 above it.
            const canUp = !pinned && i > 0 && shown[i - 1].key !== HOME_TAB_KEY
            const canDown = !pinned && i < shown.length - 1
            return (
              <div className="flex items-center gap-3 rounded-[14px] bg-glass-active py-2.5 pr-2.5 pl-6" key={i}>
                <span className="flex-1 truncate text-body text-fg">{tab.label}</span>
                <RowButton row={i} col={0} label="▲" disabled={!canUp} onSelect={() => move(i, -1)} />
                <RowButton row={i} col={1} label="▼" disabled={!canDown} onSelect={() => move(i, 1)} />
                <RowButton row={i} col={2} label="隐藏" wide onSelect={() => hide(i)} />
              </div>
            )
          })}

          {hiddenTabs.length > 0 && <div className="mt-4 text-caption text-fg-3">已隐藏</div>}
          {hiddenTabs.map((tab, j) => (
            <div className="flex items-center gap-3 rounded-[14px] bg-elev py-2.5 pr-2.5 pl-6" key={`hidden-${j}`}>
              <span className="flex-1 truncate text-body text-fg-2">{tab.label}</span>
              <RowButton row={shown.length + j} col={0} label="显示" wide onSelect={() => show(tab.key)} />
            </div>
          ))}
        </div>

        <div className="flex shrink-0 flex-col gap-3.5">
          <DialogButton row={doneRow} label="完成" onSelect={onClose} />
          <DialogButton row={resetRow} label="重置为默认" onSelect={reset} />
        </div>
      </div>
    </div>
  )
}
