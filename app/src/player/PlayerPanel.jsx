/*
 * Bottom player panel (T20): Episodes | Speed | Quality tabs on its own
 * "player-panel" focus layer. Opaque sheet, opens/closes instantly.
 *
 * Focus grid: row 0 = the tab chips (Left/Right switches tabs — a tab
 * activates on focus, like the app tab bar); rows 1+ = the active tab's
 * content. Only one tab's content is mounted at a time, so content focus ids
 * never collide across tabs.
 *
 * Keys: arrows/OK run through the normal focus engine (PlayerPage's key
 * handler passes them through while the panel is open); Back is intercepted
 * by PlayerPage and closes the panel back to the control bar.
 */
import { useEffect, useState } from 'react'
import { useFocusable, pushFocusLayer, popFocusLayer, focusTo } from '../hooks/useFocus.js'

const LAYER = 'player-panel'
const GROUP = 'panel'
const EP_COLS = 8
const SPEEDS = [0.75, 1, 1.25, 1.5, 2]

function Chip({ row, col, label, selected, onSelect, onFocus }) {
  const { props } = useFocusable({
    layer: LAYER,
    group: GROUP,
    row,
    col,
    onSelect,
    onFocusChange: onFocus,
  })
  return (
    <span
      className={`panel-chip focusable-chip${selected ? ' panel-chip-selected' : ''}`}
      {...props}
    >
      {label}
    </span>
  )
}

function qualityLabel(l) {
  if (!l.height) return `${Math.round((l.bitrate || 0) / 1000)} kbps`
  return l.height >= 1440 ? `${l.height}p 超清` : `${l.height}p`
}

export default function PlayerPanel({
  episodes,
  curEp,
  speed,
  qualityLevels,
  curLevel,
  onSwitchEpisode,
  onSetSpeed,
  onSetQuality,
  onClose, // reserved: Back is routed through PlayerPage's key handler
}) {
  const [tab, setTab] = useState('eps')

  // The native-HLS path exposes no level info — the quality tab simply
  // does not exist there (capability-based, matches real-device behavior).
  const tabs = [
    { key: 'eps', label: '选集' },
    { key: 'speed', label: '倍速' },
    ...(qualityLevels.length ? [{ key: 'quality', label: '画质' }] : []),
  ]

  useEffect(() => {
    pushFocusLayer(LAYER)
    focusTo(`${LAYER}/${GROUP}-0-0`)
    return () => popFocusLayer()
  }, [])

  return (
    <div className="player-panel">
      <div className="player-panel-tabs">
        {tabs.map((t, i) => (
          <Chip
            key={t.key}
            row={0}
            col={i}
            label={t.label}
            selected={tab === t.key}
            onFocus={(focused) => focused && setTab(t.key)}
            onSelect={() => setTab(t.key)}
          />
        ))}
      </div>

      {tab === 'eps' && (
        <div className="player-panel-grid">
          {episodes.map((ep, i) => (
            <Chip
              key={ep.index}
              row={1 + Math.floor(i / EP_COLS)}
              col={i % EP_COLS}
              label={`第${ep.index}集`}
              selected={ep.index === curEp}
              onSelect={() => onSwitchEpisode(ep.index)}
            />
          ))}
        </div>
      )}

      {tab === 'speed' && (
        <div className="player-panel-row">
          {SPEEDS.map((s, i) => (
            <Chip
              key={s}
              row={1}
              col={i}
              label={`${s}x`}
              selected={speed === s}
              onSelect={() => onSetSpeed(s)}
            />
          ))}
        </div>
      )}

      {tab === 'quality' && (
        <div className="player-panel-row">
          <Chip row={1} col={0} label="自动" selected={curLevel === -1} onSelect={() => onSetQuality(-1)} />
          {qualityLevels.map((l, i) => (
            <Chip
              key={l.i}
              row={1}
              col={i + 1}
              label={qualityLabel(l)}
              selected={curLevel === l.i}
              onSelect={() => onSetQuality(l.i)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
