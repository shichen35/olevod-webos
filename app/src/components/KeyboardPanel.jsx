/*
 * On-screen alphanumeric keyboard for the search page — a fixed opaque sheet on
 * the right, on its own "keyboard" focus layer, same shape as the filter panel.
 *
 * Why a panel rather than Android TV's always-visible left column: the search
 * page keeps its box / suggestions / results stack, and the LG system keyboard
 * stays the fast path for Chinese. This is the D-pad fallback — and typing the
 * pinyin initials of a title (MN -> 魔女) is what the suggestion endpoint wants
 * anyway.
 *
 * Every key edits the page's query live, so suggestions refresh while typing.
 *
 * Focus grid (group "panel"): rows 0-5 are the 6x6 key grid, row 6 is
 * 退格 / 清空, row 7 is 系统键盘 / 搜索 — plain arithmetic, the grid is regular.
 */
import { useEffect } from 'react'
import { useFocusable, pushFocusLayer, popFocusLayer, focusTo, pushCustomKeyHandler } from '../hooks/useFocus.js'

const LAYER = 'keyboard'
const GROUP = 'panel'
const COLS = 6
const KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')
const ACTION_ROW0 = KEYS.length / COLS // 6

function isBackKey(e) {
  return e.keyCode === 461 || e.key === 'Escape' || e.key === 'Backspace' || e.key === 'GoBack'
}

function Key({ row, col, label, onSelect, wide = false }) {
  const { props } = useFocusable({ layer: LAYER, group: GROUP, row, col, onSelect })
  return (
    <div
      className={`focusable flex items-center justify-center rounded-[14px] bg-elev-2 text-fg ${wide ? 'py-3.5 text-label' : 'h-[72px] text-heading'}`}
      {...props}
    >
      {label}
    </div>
  )
}

export default function KeyboardPanel({ value, onChange, onSubmit, onSystemKeyboard, onClose }) {
  useEffect(() => {
    pushFocusLayer(LAYER)
    focusTo(`${LAYER}/${GROUP}-0-0`)
    const popKeys = pushCustomKeyHandler((e) => {
      if (isBackKey(e)) {
        onClose()
        return true
      }
      return false
    })
    return () => {
      popKeys()
      popFocusLayer() // focus returns to the 屏幕键盘 button
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="glass-strong fixed inset-y-0 right-0 w-[600px] overflow-y-auto border-l border-glass-edge px-10 py-12 scroll-py-focus-safe">
      <div className="mb-4 text-caption text-fg-3">屏幕键盘</div>
      {/* The query as typed so far; the search box is behind the panel. */}
      <div className="mb-8 min-h-[64px] rounded-[14px] bg-elev px-6 py-3 text-heading text-fg">
        {value || <span className="text-fg-3">输入片名或拼音首字母</span>}
      </div>

      <div className="mb-4 grid grid-cols-6 gap-2.5">
        {KEYS.map((key, i) => (
          <Key
            key={key}
            row={Math.floor(i / COLS)}
            col={i % COLS}
            label={key}
            onSelect={() => onChange(value + key)}
          />
        ))}
      </div>

      <div className="mb-2.5 grid grid-cols-2 gap-2.5">
        <Key row={ACTION_ROW0} col={0} label="退格" wide onSelect={() => onChange(value.slice(0, -1))} />
        <Key row={ACTION_ROW0} col={1} label="清空" wide onSelect={() => onChange('')} />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <Key row={ACTION_ROW0 + 1} col={0} label="系统键盘" wide onSelect={onSystemKeyboard} />
        <Key row={ACTION_ROW0 + 1} col={1} label="搜索" wide onSelect={() => onSubmit(value)} />
      </div>
      <div className="mt-6 text-caption text-fg-3">字母可输入拼音首字母，中文用系统键盘</div>
    </div>
  )
}
