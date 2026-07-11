/*
 * Full-screen HLS player (the "player" focus layer, above "detail").
 *
 * T16 scope: enter -> play -> back only. No control bar or progress UI (T17),
 * no resume (T18), no autoplay-next (T19). The page is a solid-black
 * full-screen <video>; loading/error states are centered static text on
 * opaque black (no scrim, no spinner animation).
 *
 * hls.js arrives via dynamic import() so it never enters the startup bundle
 * (PlayerPage itself is lazy() — see App.jsx). On the real device the webOS
 * webview plays HLS natively (canPlayType), so the TV path never downloads
 * the hls.js chunk at all.
 */
import { useEffect, useRef, useState } from 'react'
import { detail as fetchDetail, streamUrl } from '../api/olevod.js'
import * as pageCache from '../store/pageCache.js'
import {
  useFocusable,
  pushFocusLayer,
  popFocusLayer,
  focusTo,
  setCustomKeyHandler,
} from '../hooks/useFocus.js'

const LAYER = 'player'

// Highest quality below the 1440p tier — the UHD tier is reserved for manual
// switching (T20). Returns -1 when the master has no such level; then hls.js
// keeps its own ABR choice.
function pickStartLevel(levels) {
  let best = -1
  for (let i = 0; i < levels.length; i++) {
    const h = levels[i].height || 0
    if (h >= 1440) continue
    if (
      best === -1 ||
      h > (levels[best].height || 0) ||
      (h === (levels[best].height || 0) && levels[i].bitrate > levels[best].bitrate)
    ) {
      best = i
    }
  }
  return best
}

// Flat short retries — exponential backoff turns one transient failure into a
// multi-second black screen before playback even starts.
const FLAT_RETRY = { maxNumRetry: 4, retryDelayMs: 200, maxRetryDelayMs: 200 }
const LOAD_POLICY = {
  default: {
    maxTimeToFirstByteMs: 8000,
    maxLoadTimeMs: 20000,
    timeoutRetry: FLAT_RETRY,
    errorRetry: FLAT_RETRY,
  },
}

function RetryButton({ onRetry }) {
  const { props } = useFocusable({ layer: LAYER, group: 'content', row: 0, col: 0, onSelect: onRetry })
  return (
    <span className="detail-btn focusable-chip" {...props}>
      加载失败，重试
    </span>
  )
}

export default function PlayerPage({ id, episodeIndex }) {
  const videoRef = useRef(null)
  const [status, setStatus] = useState('loading') // loading | ok | error
  const [attempt, setAttempt] = useState(0) // bump to tear down and retry
  const statusRef = useRef(status)
  statusRef.current = status

  // Own the player focus layer for this overlay's lifetime, and intercept keys
  // in place: OK toggles play/pause; arrows are swallowed until T17 gives them
  // meaning. The error state falls through to normal navigation so the Retry
  // focusable receives OK.
  useEffect(() => {
    pushFocusLayer(LAYER)
    setCustomKeyHandler((e) => {
      if (statusRef.current === 'error') return false
      if (e.key === 'Enter') {
        const v = videoRef.current
        if (v && statusRef.current === 'ok') {
          if (v.paused) v.play().catch(() => {})
          else v.pause()
        }
        return true
      }
      if ((e.key || '').startsWith('Arrow')) return true
      return false
    })
    return () => {
      setCustomKeyHandler(null)
      popFocusLayer()
    }
  }, [])

  // The error state has this layer's only focusable; land on it deterministically.
  useEffect(() => {
    if (status === 'error') focusTo(`${LAYER}/content-0-0`)
  }, [status])

  useEffect(() => {
    const video = videoRef.current
    let hls = null
    let cancelled = false
    setStatus('loading')

    const onPlaying = () => setStatus('ok')
    const onVideoError = () => setStatus('error')
    video.addEventListener('playing', onPlaying)
    video.addEventListener('error', onVideoError)

    ;(async () => {
      try {
        // Detail is already cached by the page beneath us — this never refetches.
        const d = await pageCache.loadOnce(`detail:${id}`, () => fetchDetail(id))
        const ep =
          d.episodes.find((e) => e.index === episodeIndex) || d.episodes[d.episodes.length - 1]
        if (!ep?.url) throw new Error('no playable url')
        if (cancelled) return
        const src = streamUrl(ep.url)

        if (video.canPlayType('application/vnd.apple.mpegurl')) {
          // Native HLS — the on-device webOS path; ABR is the system's own.
          video.src = src
          video.play().catch(() => {})
          return
        }

        // Desktop-browser dev path: hls.js, loaded on demand.
        const { default: Hls } = await import('hls.js')
        if (cancelled) return
        if (!Hls.isSupported()) throw new Error('hls.js unsupported')
        hls = new Hls({
          autoStartLoad: false, // wait for MANIFEST_PARSED to pick the start level
          manifestLoadPolicy: LOAD_POLICY,
          playlistLoadPolicy: LOAD_POLICY,
          fragLoadPolicy: LOAD_POLICY,
        })
        hls.on(Hls.Events.MANIFEST_PARSED, (_evt, data) => {
          const lvl = pickStartLevel(data.levels || [])
          if (lvl >= 0) {
            hls.startLevel = lvl
            hls.autoLevelCapping = lvl // ABR stays below UHD; manual switch is T20
          }
          hls.startLoad()
          video.play().catch(() => {})
        })
        hls.on(Hls.Events.ERROR, (_evt, data) => {
          if (data.fatal) setStatus('error')
        })
        hls.attachMedia(video)
        hls.loadSource(src)
      } catch {
        if (!cancelled) setStatus('error')
      }
    })()

    return () => {
      cancelled = true
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('error', onVideoError)
      if (hls) hls.destroy()
      // Drop the native source too so no segment request outlives the page.
      video.removeAttribute('src')
      video.load()
    }
  }, [id, episodeIndex, attempt])

  return (
    <div className="player">
      <video ref={videoRef} className="player-video" />
      {status === 'loading' && <div className="player-status">加载中…</div>}
      {status === 'error' && (
        <div className="player-status">
          <RetryButton onRetry={() => setAttempt((n) => n + 1)} />
        </div>
      )}
    </div>
  )
}
