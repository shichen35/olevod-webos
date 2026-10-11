/*
 * Full synopsis over the detail page: a centered opaque card on its own
 * "synopsis" focus layer (no scrim — the layer already blocks what's behind).
 *
 * The body is longer than the card, so Up/Down scroll it instead of moving the
 * cursor; the only focusable is 关闭, which OK and Back both reach. Synopses
 * arrive with real newlines, so the text keeps them (whitespace-pre-line).
 */
import { useEffect, useRef } from 'react'
import { useFocusable, pushFocusLayer, popFocusLayer, focusTo, pushCustomKeyHandler, isBackKey } from '../hooks/useFocus.js'

const LAYER = 'synopsis'
const SCROLL_STEP = 160

function CloseButton({ onSelect }) {
  const { props } = useFocusable({ layer: LAYER, group: 'content', row: 0, col: 0, onSelect })
  return (
    <button className="focusable w-full rounded-[14px] bg-glass-active py-[18px] text-label text-fg" {...props}>
      关闭
    </button>
  )
}

export default function SynopsisDialog({ title, text, onClose }) {
  const bodyRef = useRef(null)

  useEffect(() => {
    pushFocusLayer(LAYER)
    focusTo(`${LAYER}/content-0-0`)
    const popKeys = pushCustomKeyHandler((e) => {
      if (isBackKey(e)) {
        onClose()
        return true
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        bodyRef.current?.scrollBy({ top: e.key === 'ArrowDown' ? SCROLL_STEP : -SCROLL_STEP })
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

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center">
      <div className="glass-strong flex max-h-[820px] w-[1200px] flex-col rounded-3xl border border-glass-edge px-12 pt-11 pb-8">
        <div className="mb-6 shrink-0 text-title text-fg">{title}</div>
        <div
          ref={bodyRef}
          className="mb-8 overflow-y-auto whitespace-pre-line text-body leading-relaxed text-fg-2"
        >
          {text}
        </div>
        <div className="shrink-0">
          <CloseButton onSelect={onClose} />
        </div>
      </div>
    </div>
  )
}
