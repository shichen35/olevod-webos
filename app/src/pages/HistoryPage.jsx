/*
 * 历史 tab: a 管理 chip on row 0, then a 6-column card grid from row 1, fed
 * live from the history store.
 *
 * 管理 mode turns the cards into 删除 targets (see CardGrid); OK removes that
 * entry and the cursor lands on whichever card slides into the slot. Leaving
 * the tab always leaves 管理 mode: coming back to a grid where OK deletes, with
 * no memory of having armed it, is a trap.
 */
import { useCallback, useEffect, useState } from 'react'
import CardGrid, { GRID_COLS } from '../components/CardGrid.jsx'
import { useFocusable, focusTo } from '../hooks/useFocus.js'
import { useStoreValue } from '../hooks/useStore.js'
import { historyStore, remove as removeHistory } from '../store/history.js'

const ACTION_ROW = 0
const GRID_ROW0 = 1

function ActionChip({ group, row, col, label, onSelect }) {
  const { props } = useFocusable({ layer: 'home', group, row, col, onSelect })
  return (
    <span className="focusable shrink-0 rounded-full bg-elev-2 px-[22px] py-2 text-label text-fg" {...props}>
      {label}
    </span>
  )
}

export default function HistoryPage({ group = 'content', active = true, onOpenDetail }) {
  const history = useStoreValue(historyStore)
  const [manage, setManage] = useState(false)

  useEffect(() => {
    if (!active) setManage(false)
  }, [active])

  // Delete the entry at `index` and keep the cursor in the grid. Ids are
  // positional, so the slot that just opened up is the same id — it belongs to
  // the next card now. The last card's slot disappears, so fall back one.
  const deleteAt = useCallback(
    (index) => {
      const item = history[index]
      if (!item) return
      removeHistory(item.id)
      const left = history.length - 1
      if (left === 0) {
        setManage(false)
        focusTo(`home/${group}-${ACTION_ROW}-0`)
        return
      }
      const target = Math.min(index, left - 1)
      focusTo(`home/${group}-${GRID_ROW0 + Math.floor(target / GRID_COLS)}-${target % GRID_COLS}`)
    },
    [history, group],
  )

  return (
    <>
      <div className="mb-6 flex items-center gap-5">
        <ActionChip
          group={group}
          row={ACTION_ROW}
          col={0}
          label={manage ? '完成' : '管理'}
          onSelect={() => setManage((on) => !on)}
        />
        <span className="text-caption text-fg-3">
          {manage ? '按 OK 删除该条记录，删完按「完成」退出' : '进入管理可逐条删除记录'}
        </span>
      </div>
      <CardGrid
        items={history}
        group={group}
        onOpenDetail={onOpenDetail}
        withEp
        rowStart={GRID_ROW0}
        manage={manage}
        onDelete={deleteAt}
      />
    </>
  )
}
