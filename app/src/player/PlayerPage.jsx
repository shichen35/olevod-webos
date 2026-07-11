/*
 * Full-screen HLS player (the "player" focus layer, above "detail").
 *
 * Key machine (all keys intercepted at the player layer via
 * setCustomKeyHandler; Back unwinds one level at a time):
 *   bar hidden: Down = show bar · Up = show the key hint · Left/Right = seek
 *               step (long-press repeats, step grows each held second)
 *               OK = play/pause (pausing shows the bar) · Back = exit
 *   bar shown:  Up = hide bar · Left/Right = same seek step · OK = play/pause
 *               Back = hide bar
 *   Seeks accumulate into a pending target and only commit after the key has
 *   settled for ~500ms — no burst of segment requests while stepping.
 *
 * The title chip (top-left) shows/hides together with the control bar.
 * Quality is fully automatic (ABR capped below the UHD tier); playback speed
 * is always 1x — there is no bottom panel.
 *
 * Performance: progress/timecode updates go straight to the DOM via refs on
 * `timeupdate` — playback must not re-render the component every second.
 *
 * hls.js arrives via dynamic import() so it never enters the startup bundle
 * (PlayerPage itself is lazy() — see App.jsx). On the real device the webOS
 * webview plays HLS natively (canPlayType), so the TV path never downloads
 * the hls.js chunk at all.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { detail as fetchDetail, streamUrl } from '../api/olevod.js'
import * as pageCache from '../store/pageCache.js'
import { recordHistory, recordProgress, clearProgress, getWatchState } from '../store/history.js'
import {
  useFocusable,
  pushFocusLayer,
  popFocusLayer,
  focusTo,
  setCustomKeyHandler,
} from '../hooks/useFocus.js'

const LAYER = 'player'

const STEP_S = 15 // seek step per tap, bar shown or hidden (long-press ramps it)
const SEEK_SETTLE_MS = 500 // commit the pending seek once input settles
const SEEK_REPEAT_MS = 200 // long-press step cadence (native key repeat, throttled)
const SEEK_ACCEL_MAX = 10 // long-press: step multiplier grows 1x/held-second up to this
const BADGE_LINGER_MS = 800 // keep the target badge up briefly after committing
const BAR_HIDE_MS = 5000

const PROGRESS_FLUSH_MS = 5000 // persist watch progress cadence
const RESUME_MIN_S = 30 // only resume when more than this was watched
const FINISHED_TAIL_S = 15 // this close to the end counts as finished
const TOAST_MS = 3000

const UP_NEXT_S = 30 // remaining time that surfaces the Up Next card

function fmtTime(s) {
  if (!Number.isFinite(s) || s < 0) s = 0
  s = Math.floor(s)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(sec).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

function isBackKey(e) {
  return e.keyCode === 461 || e.key === 'Escape' || e.key === 'Backspace' || e.key === 'GoBack'
}

// Highest quality below the 1440p tier — UHD is too heavy to auto-select.
// Returns -1 when the master has no such level; then hls.js keeps its own
// ABR choice.
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
  const [data, setData] = useState(null) // normalized detail (title + episodes)
  const [curEp, setCurEp] = useState(episodeIndex)
  const [status, setStatus] = useState('loading') // loading | ok | error
  const [attempt, setAttempt] = useState(0) // bump to tear down and retry
  const [barVisible, setBarVisible] = useState(false)
  const [toast, setToast] = useState(null) // resume notice; static, 3s
  const toastTimerRef = useRef(null)
  const [upNext, setUpNext] = useState(false) // Up Next card visible
  const [switching, setSwitching] = useState(false) // episode-change reload
  const [hint, setHint] = useState(false) // settings-gated key hint
  const [paused, setPaused] = useState(false) // drives the bar's play/pause icon

  const statusRef = useRef(status)
  statusRef.current = status
  const barRef = useRef(barVisible)
  barRef.current = barVisible
  const upNextRef = useRef(upNext)
  upNextRef.current = upNext
  const upNextDismissedRef = useRef(false) // per-episode: Back/Up dismissed it
  const hintRef = useRef(hint)
  hintRef.current = hint

  // "Next" in a newest-first list is the entry BEFORE the current one.
  const epList = data?.episodes || []
  const curIdx = epList.findIndex((e) => e.index === curEp)
  const nextEpIndex = curIdx > 0 ? epList[curIdx - 1].index : null
  const nextEpRef = useRef(null)
  nextEpRef.current = nextEpIndex

  // High-frequency playback feedback goes straight to these DOM nodes.
  const playedRef = useRef(null)
  const bufferedRef = useRef(null)
  const curTimeRef = useRef(null)
  const remainRef = useRef(null)
  const badgeRef = useRef(null)

  const pendingSeekRef = useRef(null) // accumulated target while stepping
  const seekTimerRef = useRef(null) // settle timer
  const badgeTimerRef = useRef(null)
  const lastStepAtRef = useRef(0)
  const holdStartAtRef = useRef(0) // when the current long-press began
  const hideTimerRef = useRef(null)

  // ---------------------------------------------------------------------
  // control bar visibility + auto-hide
  // ---------------------------------------------------------------------
  const armHideTimer = useCallback(() => {
    clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(function tick() {
      const v = videoRef.current
      if (v && v.paused) {
        // Stays visible while paused; check again later.
        hideTimerRef.current = setTimeout(tick, BAR_HIDE_MS)
        return
      }
      setBarVisible(false)
    }, BAR_HIDE_MS)
  }, [])

  const showBar = useCallback(() => {
    setBarVisible(true)
    armHideTimer()
  }, [armHideTimer])

  const hideBar = useCallback(() => {
    clearTimeout(hideTimerRef.current)
    setBarVisible(false)
  }, [])

  useEffect(
    () => () => {
      clearTimeout(hideTimerRef.current)
      clearTimeout(toastTimerRef.current)
    },
    [],
  )

  // ---------------------------------------------------------------------
  // seeking — accumulate, preview, commit on settle
  // ---------------------------------------------------------------------
  const showBadge = useCallback((dir, target) => {
    const el = badgeRef.current
    if (!el) return
    el.textContent = `${dir < 0 ? '«' : '»'} ${fmtTime(target)}`
    el.style.display = 'block'
    clearTimeout(badgeTimerRef.current)
  }, [])

  const stepSeek = useCallback(
    (deltaS, isRepeat) => {
      const v = videoRef.current
      const dur = v?.duration
      if (!v || !Number.isFinite(dur) || dur <= 0) return
      const now = Date.now()
      if (!isRepeat) holdStartAtRef.current = now // a fresh press resets the ramp
      if (isRepeat && now - lastStepAtRef.current < SEEK_REPEAT_MS) return
      lastStepAtRef.current = now

      // Long-press acceleration: the step grows by 1x for every held second.
      const heldS = isRepeat ? Math.floor((now - holdStartAtRef.current) / 1000) : 0
      const mult = Math.min(1 + heldS, SEEK_ACCEL_MAX)

      const base = pendingSeekRef.current ?? v.currentTime
      const target = Math.min(Math.max(base + deltaS * mult, 0), Math.max(dur - 2, 0))
      pendingSeekRef.current = target
      showBadge(deltaS, target)
      // Preview cursor: while the bar is up, the played track follows the target.
      if (barRef.current && playedRef.current) {
        playedRef.current.style.width = `${(target / dur) * 100}%`
      }

      clearTimeout(seekTimerRef.current)
      seekTimerRef.current = setTimeout(() => {
        const t = pendingSeekRef.current
        pendingSeekRef.current = null
        const vid = videoRef.current
        if (t != null && vid) vid.currentTime = t
        badgeTimerRef.current = setTimeout(() => {
          if (badgeRef.current) badgeRef.current.style.display = 'none'
        }, BADGE_LINGER_MS)
      }, SEEK_SETTLE_MS)
    },
    [showBadge],
  )

  useEffect(
    () => () => {
      clearTimeout(seekTimerRef.current)
      clearTimeout(badgeTimerRef.current)
    },
    [],
  )

  // Key hint: every video opened with no saved watch progress shows it, and
  // Up with the bar hidden recalls it any time; any key or 3s ends it.
  const hintTimerRef = useRef(null)
  const showHint = useCallback(() => {
    setHint(true)
    clearTimeout(hintTimerRef.current)
    hintTimerRef.current = setTimeout(() => setHint(false), TOAST_MS)
  }, [])
  useEffect(() => {
    const w = getWatchState(id)
    if (!w || !(w.position > 0)) showHint()
    return () => clearTimeout(hintTimerRef.current)
  }, [id, showHint])

  // Switch episodes WITHOUT exiting the player: the playback effect's cleanup
  // flushes the outgoing episode's progress, then the new run reloads the URL
  // through the same quality-selection path.
  const switchEpisode = useCallback((n) => {
    if (n == null) return
    upNextDismissedRef.current = false
    setUpNext(false)
    setSwitching(true)
    setBarVisible(false)
    setCurEp(n)
  }, [])
  const switchEpisodeRef = useRef(switchEpisode)
  switchEpisodeRef.current = switchEpisode

  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      v.play().catch(() => {})
      armHideTimer()
    } else {
      v.pause()
      showBar() // pausing brings the bar up
    }
  }, [armHideTimer, showBar])

  // ---------------------------------------------------------------------
  // key machine — owns every key in the player layer
  // ---------------------------------------------------------------------
  useEffect(() => {
    pushFocusLayer(LAYER)
    setCustomKeyHandler((e) => {
      // Error state: normal navigation drives the Retry focusable; Back exits.
      if (statusRef.current === 'error') return false
      if (statusRef.current !== 'ok') {
        // Loading: swallow nav/OK so keys can't leak to the detail layer
        // beneath; Back falls through and exits the player.
        return !isBackKey(e) && (e.key === 'Enter' || (e.key || '').startsWith('Arrow'))
      }

      // Any key dismisses the key hint, then keeps its normal meaning.
      if (hintRef.current) setHint(false)

      // Up Next card takes OK (switch now) and Up/Back (dismiss) first; other
      // keys keep their normal meaning while the card is up.
      if (upNextRef.current) {
        if (e.key === 'Enter') {
          switchEpisodeRef.current(nextEpRef.current)
          return true
        }
        if (isBackKey(e) || e.key === 'ArrowUp') {
          upNextDismissedRef.current = true
          setUpNext(false)
          return true
        }
      }

      if (isBackKey(e)) {
        if (barRef.current) {
          hideBar()
          return true
        }
        return false // default tv-back pops the player overlay
      }

      if (barRef.current) {
        armHideTimer() // any input while shown postpones auto-hide
        switch (e.key) {
          case 'ArrowUp':
            hideBar()
            return true
          case 'ArrowLeft':
            stepSeek(-STEP_S, e.repeat)
            return true
          case 'ArrowRight':
            stepSeek(STEP_S, e.repeat)
            return true
          case 'Enter':
            togglePlay()
            return true
          default:
            return true
        }
      }

      switch (e.key) {
        case 'ArrowDown':
          showBar()
          return true
        case 'ArrowLeft':
          stepSeek(-STEP_S, e.repeat)
          return true
        case 'ArrowRight':
          stepSeek(STEP_S, e.repeat)
          return true
        case 'Enter':
          togglePlay()
          return true
        case 'ArrowUp':
          showHint() // bar hidden: Up recalls the key hint
          return true
        default:
          return false
      }
    })
    return () => {
      setCustomKeyHandler(null)
      popFocusLayer()
    }
  }, [armHideTimer, hideBar, showBar, stepSeek, togglePlay, showHint])

  // The error state has this layer's only focusable; land on it deterministically.
  useEffect(() => {
    if (status === 'error') focusTo(`${LAYER}/content-0-0`)
  }, [status])

  // ---------------------------------------------------------------------
  // data: detail (title + episode urls) from the shared page cache
  // ---------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false
    // Detail is already cached by the page beneath us — this never refetches.
    pageCache
      .loadOnce(`detail:${id}`, () => fetchDetail(id))
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [id, attempt])

  // ---------------------------------------------------------------------
  // playback: wire the <video> to the current episode's stream
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (!data) return
    const video = videoRef.current
    let hls = null
    let cancelled = false
    let started = false // first 'playing' of THIS episode load
    let resumeCorrected = false
    setStatus('loading')

    // Resume decision (T18): same episode, meaningfully into it.
    const watch = getWatchState(id)
    const resumePos =
      watch && watch.lastEpisodeIndex === curEp && watch.position > RESUME_MIN_S
        ? watch.position
        : 0

    // Persist progress. Positions come from timeupdate ticks (lastKnown), never
    // a live read at flush time: on the TV's native pipeline currentTime can
    // already read 0 during suspend/teardown, which must not clobber real
    // progress. Near the end counts as finished -> the resume point moves to
    // the next episode (from its start), or is cleared after the last one.
    const lastKnown = { pos: NaN, dur: NaN }
    const flushProgress = () => {
      const { pos, dur } = lastKnown
      if (!started || !Number.isFinite(pos) || !Number.isFinite(dur) || dur <= 0) return
      if (dur - pos <= FINISHED_TAIL_S) {
        const next = nextEpRef.current
        if (next != null) recordProgress(id, next, 0, dur)
        else clearProgress(id)
      } else {
        recordProgress(id, curEp, pos, dur)
      }
    }
    const flushTimer = setInterval(() => {
      if (started && !video.paused) flushProgress()
    }, PROGRESS_FLUSH_MS)

    const onPlaying = () => {
      setStatus('ok')
      setSwitching(false)
      setPaused(false)
      // hls.js can snap the first frame back to 0 — correct once.
      if (resumePos > 0 && !resumeCorrected) {
        resumeCorrected = true
        if (video.currentTime < resumePos - 3) video.currentTime = resumePos
      }
      if (!started) {
        started = true
        recordHistory({
          id: data.id,
          name: data.title,
          pic: data.pic,
          score: data.rating,
          remarks: data.remarks,
          year: data.year,
          area: data.region,
        })
        if (resumePos > 0) {
          setToast(`已从 ${fmtTime(resumePos)} 继续播放`)
          clearTimeout(toastTimerRef.current)
          toastTimerRef.current = setTimeout(() => setToast(null), TOAST_MS)
        }
      }
    }
    const onLoadedMeta = () => {
      // Native-HLS resume: seek as soon as the duration is known.
      if (resumePos > 0 && video.currentTime < resumePos - 3) video.currentTime = resumePos
    }
    const onVideoError = () => setStatus('error')
    const onPlay = () => setPaused(false)
    const onPause = () => {
      setPaused(true)
      // Any pause surfaces the bar (remote OK, or a future system event).
      if (statusRef.current === 'ok' && !video.ended) showBar()
    }
    const onTime = () => {
      const dur = video.duration
      if (!Number.isFinite(dur) || dur <= 0) return
      // Feed the flush position. A snap to exactly 0 from well into playback is
      // a pipeline reset, not a user seek — never let it become the flush value.
      if (!(video.currentTime === 0 && lastKnown.pos > 1)) {
        lastKnown.pos = video.currentTime
        lastKnown.dur = dur
      }
      // While a seek is pending, the played track is a preview cursor — leave it.
      if (pendingSeekRef.current == null && playedRef.current) {
        playedRef.current.style.width = `${(video.currentTime / dur) * 100}%`
      }
      if (curTimeRef.current) curTimeRef.current.textContent = fmtTime(video.currentTime)
      if (remainRef.current) remainRef.current.textContent = `-${fmtTime(dur - video.currentTime)}`
      // Up Next: surface once per episode when the tail comes into view.
      if (
        started &&
        !upNextRef.current &&
        !upNextDismissedRef.current &&
        nextEpRef.current != null &&
        dur - video.currentTime <= UP_NEXT_S
      ) {
        setUpNext(true)
      }
    }
    const onEnded = () => {
      // The finished-tail rule zeroes this episode's progress on flush.
      flushProgress()
      if (nextEpRef.current != null) {
        switchEpisodeRef.current(nextEpRef.current)
      } else {
        // Last episode: leave the player; focus restores in the detail layer.
        window.dispatchEvent(new CustomEvent('tv-back'))
      }
    }
    const onProgress = () => {
      const dur = video.duration
      if (!Number.isFinite(dur) || dur <= 0 || !bufferedRef.current) return
      const b = video.buffered
      let end = 0
      for (let i = 0; i < b.length; i++) {
        if (b.start(i) <= video.currentTime + 0.5 && b.end(i) > end) end = b.end(i)
      }
      bufferedRef.current.style.width = `${(end / dur) * 100}%`
    }
    video.addEventListener('playing', onPlaying)
    video.addEventListener('loadedmetadata', onLoadedMeta)
    video.addEventListener('error', onVideoError)
    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('timeupdate', onTime)
    video.addEventListener('progress', onProgress)
    video.addEventListener('ended', onEnded)

    ;(async () => {
      try {
        const ep =
          data.episodes.find((e) => e.index === curEp) || data.episodes[data.episodes.length - 1]
        if (!ep?.url) throw new Error('no playable url')
        const src = streamUrl(ep.url)

        if (video.canPlayType('application/vnd.apple.mpegurl')) {
          // Native HLS — the on-device webOS path; ABR is the system's own.
          video.src = src
          video.play().catch(() => {})
          return
        }

        // Desktop-browser dev path: hls.js, loaded on demand. The light build
        // is enough — no subtitles/alt-audio/DRM here — and stays under the
        // bundler's 500 kB chunk warning.
        const { default: Hls } = await import('hls.js/light')
        if (cancelled) return
        if (!Hls.isSupported()) throw new Error('hls.js unsupported')
        hls = new Hls({
          autoStartLoad: false, // wait for MANIFEST_PARSED to pick the start level
          manifestLoadPolicy: LOAD_POLICY,
          playlistLoadPolicy: LOAD_POLICY,
          fragLoadPolicy: LOAD_POLICY,
        })
        hls.on(Hls.Events.MANIFEST_PARSED, (_evt, parsed) => {
          const lvl = pickStartLevel(parsed.levels || [])
          if (lvl >= 0) {
            hls.startLevel = lvl
            hls.autoLevelCapping = lvl // ABR stays below the UHD tier
          }
          // Resume at load time — starting at 0 and seeking would double-buffer.
          hls.startLoad(resumePos > 0 ? resumePos : -1)
          video.play().catch(() => {})
        })
        hls.on(Hls.Events.ERROR, (_evt, info) => {
          if (info.fatal) setStatus('error')
        })
        hls.attachMedia(video)
        hls.loadSource(src)
      } catch {
        if (!cancelled) setStatus('error')
      }
    })()

    return () => {
      cancelled = true
      // Flush the outgoing episode's progress before teardown — covers exit,
      // retry, and episode switches alike.
      clearInterval(flushTimer)
      flushProgress()
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('loadedmetadata', onLoadedMeta)
      video.removeEventListener('error', onVideoError)
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('timeupdate', onTime)
      video.removeEventListener('progress', onProgress)
      video.removeEventListener('ended', onEnded)
      if (hls) hls.destroy()
      // Drop the native source too so no segment request outlives the page.
      video.removeAttribute('src')
      video.load()
    }
  }, [data, curEp, attempt, showBar])

  const episodes = data?.episodes || []
  const epLabel = episodes.length > 1 ? `第${curEp}集` : ''

  return (
    <div className="player">
      <video ref={videoRef} className="player-video" />

      {/* Title chip — top-left, shows/hides together with the control bar. */}
      {barVisible && (
        <div className="player-title">
          <span className="player-title-name">{data?.title || ''}</span>
          {epLabel && <span className="player-title-ep">{epLabel}</span>}
        </div>
      )}

      {/* Control bar — always mounted so the DOM refs stay stable; visibility
          is an instant display toggle. */}
      <div className="player-bar" style={{ display: barVisible ? 'block' : 'none' }}>
        <div className="player-track">
          <div ref={bufferedRef} className="player-track-buffered" />
          <div ref={playedRef} className="player-track-played" />
        </div>
        {/* Times row: current | play-pause icon centered | remaining */}
        <div className="player-bar-row">
          <span ref={curTimeRef} className="player-time">00:00</span>
          <span className="player-bar-btn">
            {paused ? (
              <svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor" aria-label="播放">
                <path d="M8 5.5v13a1 1 0 0 0 1.54.84l10.2-6.5a1 1 0 0 0 0-1.68L9.54 4.66A1 1 0 0 0 8 5.5z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor" aria-label="暂停">
                <path d="M7 5h3.4v14H7zM13.6 5H17v14h-3.4z" />
              </svg>
            )}
          </span>
          <span ref={remainRef} className="player-time player-time-remain">-00:00</span>
        </div>
      </div>

      {/* Seek target badge (« / » + mm:ss), shared by both seek modes. */}
      <div ref={badgeRef} className="player-seek-badge" style={{ display: 'none' }} />

      {toast && <div className="player-toast">{toast}</div>}

      {/* Up Next (T19): glass card, bottom-right; OK switches immediately. */}
      {upNext && nextEpIndex != null && (
        <div className="player-upnext">
          <div className="player-upnext-label">即将播放</div>
          <div className="player-upnext-ep">第{nextEpIndex}集</div>
          <div className="player-upnext-hint">按 OK 立即播放</div>
        </div>
      )}

      {hint && (
        <div className="player-hint">
          <div className="player-hint-title">遥控键位</div>
          <div>OK 播放 / 暂停 · 左右键快退快进（长按加速）</div>
          <div>下键调出控制条 · 上键查看本提示 · 返回键退出</div>
        </div>
      )}

      {status === 'loading' && (
        <div className="player-status">
          {switching ? `正在加载 第${curEp}集…` : '加载中…'}
        </div>
      )}

      {status === 'error' && (
        <div className="player-status">
          <RetryButton onRetry={() => setAttempt((n) => n + 1)} />
        </div>
      )}
    </div>
  )
}
