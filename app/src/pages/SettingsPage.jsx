/*
 * 设置 tab: a grouped list (rows 0-5, col 0 of the tab's content group) with
 * the app version as a plain label below. Its first row is the OleVod
 * account: nickname or 未登录, opening the account page (App.jsx view stack).
 * Clearing history goes through ConfirmDialog; the tab bar's order and
 * visibility through TabOrderDialog.
 */
import { useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import TabOrderDialog from '../components/TabOrderDialog.jsx'
import { useFocusable } from '../hooks/useFocus.js'
import { useStoreValue } from '../hooks/useStore.js'
import { clear as clearHistory } from '../store/history.js'
import { settingsStore, getSetting, toggleSetting } from '../store/settings.js'
import { sessionStore } from '../store/session.js'

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

// Row with a trailing value (secondary text, dark on the focused white fill).
function SettingsValueRow({ group, row, label, value, onSelect }) {
  const { props } = useFocusable({ layer: 'home', group, row, col: 0, onSelect })
  return (
    <div className={`${SETTINGS_ROW} flex items-center justify-between`} {...props}>
      <span>{label}</span>
      <span className="text-fg-2 focused:text-inverse">{value}</span>
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

export default function SettingsPage({ group = 'content', onOpenAccount }) {
  const [confirmClear, setConfirmClear] = useState(false)
  const [tabOrderOpen, setTabOrderOpen] = useState(false)
  const settings = useStoreValue(settingsStore)
  const session = useStoreValue(sessionStore)

  return (
    <>
      {/* iOS-style inset grouped list + version caption below. */}
      <div className="glass max-w-[900px] rounded-[20px] border border-glass-edge p-1.5">
        <SettingsValueRow
          group={group}
          row={0}
          label="欧乐账号"
          value={session ? session.name : '未登录'}
          onSelect={() => onOpenAccount?.()}
        />
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
        <SettingsRow group={group} row={4} label="标签栏顺序与显示" onSelect={() => setTabOrderOpen(true)} />
        <SettingsRow group={group} row={5} label="清除观看历史" onSelect={() => setConfirmClear(true)} />
      </div>
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 text-center text-caption text-fg-3">版本 {__APP_VERSION__}</div>

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
    </>
  )
}
