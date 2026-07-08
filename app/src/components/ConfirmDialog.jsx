/*
 * App-wide confirm dialog. A centered opaque card on its own "confirm" focus
 * layer — no translucent backdrop (the focus layer already blocks input to
 * whatever is behind it). Buttons are full-width and stacked, addressed by row;
 * focus defaults to Cancel, and the back key acts as Cancel.
 */
import { useEffect } from 'react'
import { useFocusable, pushFocusLayer, popFocusLayer, focusTo, setCustomKeyHandler } from '../hooks/useFocus.js'

const LAYER = 'confirm'

function isBackKey(e) {
  return e.keyCode === 461 || e.key === 'Escape' || e.key === 'Backspace' || e.key === 'GoBack'
}

function DialogButton({ row, label, kind, onSelect }) {
  const { props } = useFocusable({ layer: LAYER, group: 'content', row, col: 0, onSelect })
  return (
    <button className={`dlg-btn${kind ? ` dlg-btn-${kind}` : ''}`} {...props}>
      {label}
    </button>
  )
}

export default function ConfirmDialog({
  title,
  description,
  confirmLabel = '确定',
  cancelLabel = '取消',
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    pushFocusLayer(LAYER)
    focusTo(`${LAYER}/content-0-0`) // default focus = Cancel (row 0)
    setCustomKeyHandler((e) => {
      if (isBackKey(e)) {
        onCancel()
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

  return (
    <div className="dialog-wrap">
      <div className="dialog">
        <div className="dialog-title">{title}</div>
        {description && <div className="dialog-desc">{description}</div>}
        <div className="dialog-actions">
          <DialogButton row={0} label={cancelLabel} onSelect={onCancel} />
          <DialogButton row={1} label={confirmLabel} kind="danger" onSelect={onConfirm} />
        </div>
      </div>
    </div>
  )
}
