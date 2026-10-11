/*
 * Account page. Two hosts: the 账号 tab (`host="tab"` — content of the shell's
 * "home" focus layer in the tab's own group, like every other page), and a
 * full-screen overlay on its own "account" focus layer, pushed by the detail
 * page or the player when a VIP episode needs a session (`from`).
 *
 * Two columns side by side, the pair centered on the screen — everything fits
 * one 1080p screen with no scrolling, which a single stacked column could not.
 * The left column is the account: signed out, two real <input>s (system
 * keyboard, same pattern as SearchPage) or the remembered login already filled
 * in; signed in, an avatar, the nickname, the membership line (pub/user/info)
 * and 退出登录 / 清除已保存信息.
 * The right glass panel is the captcha: the image (160x80 source shown at 2x
 * on a light token, since the PNG is transparent with dark strokes), four
 * digit slots, an on-screen 3x4 keypad and 登录. Remote/keyboard digit keys
 * type straight into the slots. Filling the fourth digit moves focus to 登录;
 * it never submits on its own.
 *
 * Login success: on the tab the page stays and flips to the signed-in view;
 * opened from detail or from the player it closes (onDone), so the page
 * underneath reloads with the session — the player remounts and resumes.
 *
 * Focus grid: col 0 is the left column (rows 0-1); cols 1-3 are the panel —
 * row 0 换一张, rows 1-4 the keypad, row 5 登录. The engine only steps col±1
 * sideways and probes columns vertically, so two moves are resolved here: Left
 * from the keypad's first column lands on the nearest left-column item at or
 * above that row, and Down off the left column's last item stays put instead
 * of sliding into the keypad.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import {
  useFocusable,
  useFocusFrame,
  focusTo,
  getCurrentFocus,
} from '../hooks/useFocus.js'
import { useStoreValue } from '../hooks/useStore.js'
import { captcha as fetchCaptcha, login, userInfo } from '../api/olevod.js'
import { ApiError } from '../api/http.js'
import {
  sessionStore,
  credentialsStore,
  signIn,
  signOut,
  forgetCredentials,
  clearPersistError,
} from '../store/session.js'

const OVERLAY_LAYER = 'account'
const CODE_LENGTH = 4
const CAPTCHA_ROW = 0
const KEYPAD_ROW0 = 1
const LOGIN_ROW = 5
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '退格', '0', '清空']

// Where one instance's focusables live: { layer, group, id(row, col) }. Built
// per host by the page and handed to every cell as `ids`.
function makeIds(layer, group) {
  return { layer, group, id: (row, col) => `${layer}/${group}-${row}-${col}` }
}

// Same full-screen opaque container as DetailPage (the `overlay` marker lets
// the focus engine snap row-0 focus back to the top).
const OVERLAY_ROOT = 'overlay fixed inset-0 overflow-y-auto bg-bg px-safe pt-content-top pb-content-bottom'

const BTN = 'focusable rounded-lg bg-elev-2 px-8 py-3.5 text-label text-fg'
const WIDE_BTN = 'flex h-[72px] w-full items-center justify-center rounded-[14px] text-label'

function ActionButton({ ids, row, col, label, onSelect }) {
  const { props } = useFocusable({ layer: ids.layer, group: ids.group, row, col, onSelect })
  return (
    <span className={BTN} {...props}>
      {label}
    </span>
  )
}

function InputBox({ ids, row, inputRef, value, onChange, placeholder, type = 'text', onEnter }) {
  // OK on the box hands DOM focus to the input, which opens the system keyboard.
  const { props } = useFocusable({ layer: ids.layer, group: ids.group, row, col: 0, onSelect: () => inputRef.current?.focus() })
  return (
    <div className="focusable flex w-full items-center rounded-[14px] bg-elev-2 px-7 py-4" {...props}>
      <input
        ref={inputRef}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            onEnter()
          } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            // Browser dev path: leave the field for D-pad navigation (on TV the
            // system keyboard consumes arrows and Back closes it).
            e.preventDefault()
            e.currentTarget.blur()
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        className="w-full bg-transparent text-body text-fg outline-none placeholder:text-fg-3 focused:text-inverse"
      />
    </div>
  )
}

function KeyButton({ ids, row, col, label, onPress }) {
  const { props } = useFocusable({ layer: ids.layer, group: ids.group, row, col, onSelect: onPress })
  const isDigit = /^\d$/.test(label)
  return (
    <div
      className={`focusable flex h-[72px] items-center justify-center rounded-[14px] bg-elev-2 text-fg ${isDigit ? 'text-heading' : 'text-label'}`}
      {...props}
    >
      {label}
    </div>
  )
}

// Focusable only while it can act (or is acting): an unavailable 登录 is plain
// text the cursor skips.
function LoginButton({ ids, label, onSelect }) {
  const { props } = useFocusable({ layer: ids.layer, group: ids.group, row: LOGIN_ROW, col: 1, onSelect })
  return (
    <div className={`focusable ${WIDE_BTN} bg-accent text-inverse`} {...props}>
      {label}
    </div>
  )
}

// "row-col" of the current focus when it is on this page, else null.
function currentCell(ids) {
  const cur = getCurrentFocus() || ''
  if (!cur.startsWith(`${ids.layer}/${ids.group}-`)) return null
  const m = cur.match(/-(\d+)-(\d+)$/)
  return m ? { row: Number(m[1]), col: Number(m[2]) } : null
}

function keyDigit(e) {
  if (e.keyCode >= 48 && e.keyCode <= 57) return String(e.keyCode - 48)
  if (e.keyCode >= 96 && e.keyCode <= 105) return String(e.keyCode - 96) // numpad
  return null
}

export default function AccountPage({ host = 'overlay', group = 'content', from = 'settings', onDone, style }) {
  const isTab = host === 'tab'
  const ids = useMemo(() => (isTab ? makeIds('home', group) : makeIds(OVERLAY_LAYER, 'content')), [isTab, group])
  const focusId = ids.id
  const session = useStoreValue(sessionStore)
  const { remembered, persistError } = useStoreValue(credentialsStore)
  const signedIn = !!session

  const [editing, setEditing] = useState(() => !credentialsStore.get().remembered)
  const [username, setUsername] = useState(() => credentialsStore.get().remembered?.username || '')
  const [password, setPassword] = useState(() => credentialsStore.get().remembered?.password || '')
  const [code, setCode] = useState('')
  const [challenge, setChallenge] = useState({ status: 'loading', id: null, image: null })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(null) // 'logout' | 'forget' | null
  const [member, setMember] = useState(null) // 'vip' | 'normal' | null

  const mode = signedIn ? 'signedIn' : editing ? 'editing' : 'remembered'

  const aliveRef = useRef(true)
  const userRef = useRef(null)
  const passRef = useRef(null)
  const captchaGenRef = useRef(0)
  const jumpToLoginRef = useRef(false)

  const canSubmit =
    !signedIn &&
    !busy &&
    challenge.status === 'ok' &&
    code.length === CODE_LENGTH &&
    username.trim() !== '' &&
    password !== ''

  // A new challenge always starts with empty slots; a late response for a
  // superseded request is dropped.
  const loadCaptcha = useCallback(() => {
    const gen = ++captchaGenRef.current
    setChallenge({ status: 'loading', id: null, image: null })
    setCode('')
    fetchCaptcha()
      .then((c) => {
        if (gen === captchaGenRef.current) setChallenge({ status: 'ok', id: c.id, image: c.image })
      })
      .catch(() => {
        if (gen === captchaGenRef.current) setChallenge({ status: 'error', id: null, image: null })
      })
  }, [])

  const busyRef = useRef(busy)
  busyRef.current = busy
  const pressKey = useCallback((label) => {
    if (busyRef.current) return
    setCode((prev) => {
      if (label === '退格') return prev.slice(0, -1)
      if (label === '清空') return ''
      if (prev.length >= CODE_LENGTH) return prev
      const next = prev + label
      if (next.length === CODE_LENGTH) jumpToLoginRef.current = true
      return next
    })
  }, [])

  // Latest render state for the key handler, which is installed once.
  const modeRef = useRef(mode)
  modeRef.current = mode

  // The overlay owns its focus layer; the tab is part of the shell's, so its
  // frame has no layer and only carries the key handler. The handler is there
  // either way, but only acts while the cursor is on this page — the tab stays
  // mounted (and its frame with it) after the user has moved on to another tab.
  // Neither host sets onBack: the remote's Back reaches App's back chain, which
  // closes the overlay (or leaves the tab for the tab bar).
  useFocusFrame({
    layer: isTab ? undefined : OVERLAY_LAYER,
    onKey: (e) => {
      if (modeRef.current === 'signedIn') return false
      const cell = currentCell(ids)
      if (!cell) return false
      const digit = keyDigit(e)
      if (digit !== null) {
        e.preventDefault()
        pressKey(digit)
        return true
      }
      if (e.key === 'Backspace') {
        // Deletes a digit here; the remote's Back (461) still closes the page.
        e.preventDefault()
        pressKey('退格')
        return true
      }
      if (e.key === 'ArrowLeft' && cell.col === 1) {
        e.preventDefault()
        for (let r = Math.min(cell.row, 1); r >= 0; r--) {
          if (focusTo(focusId(r, 0))) break
        }
        return true
      }
      if (e.key === 'ArrowDown' && cell.col === 0) {
        e.preventDefault()
        focusTo(focusId(cell.row + 1, 0))
        return true
      }
      return false
    },
  })
  useEffect(() => {
    // Set on mount as well as cleared on unmount: StrictMode's dev-only
    // remount would otherwise leave it false and drop the sign-in result.
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      captchaGenRef.current++
      clearPersistError()
    }
  }, [])

  // Fresh challenge whenever the sign-in form is (re)shown.
  useEffect(() => {
    if (!signedIn) loadCaptcha()
  }, [signedIn, loadCaptcha])

  // Default focus per view: the first action when signed in, digit 1 when the
  // login is remembered, the username box otherwise. On the tab this only
  // re-places a cursor that is already on the page — the tab mounts while the
  // cursor is still on the tab bar, and must not pull it down.
  useEffect(() => {
    if (isTab && !currentCell(ids)) return
    focusTo(mode === 'remembered' ? focusId(KEYPAD_ROW0, 1) : focusId(0, 0))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  // Fourth digit typed: hand the cursor to 登录 (only if it can submit).
  useEffect(() => {
    if (!jumpToLoginRef.current) return
    jumpToLoginRef.current = false
    if (canSubmit) focusTo(focusId(LOGIN_ROW, 1))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  // Membership line for the signed-in view.
  const token = session?.token || null
  useEffect(() => {
    setMember(null)
    if (!token) return undefined
    let alive = true
    userInfo()
      .then((u) => {
        if (alive) setMember(u.groupId === 3 ? 'vip' : 'normal')
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [token])

  const submit = async () => {
    if (!canSubmit) return
    const credentials = { username: username.trim(), password }
    setBusy(true)
    setError(null)
    try {
      const result = await login({ ...credentials, captcha: code, captchaId: challenge.id })
      // Commit the session even if the page was closed mid-request: the user
      // did sign in, and the captcha is already spent.
      const saving = signIn(result, credentials)
      if (!aliveRef.current) return
      setCode('')
      if (from !== 'settings') {
        onDone?.()
        return
      }
      await saving
    } catch (e) {
      if (!aliveRef.current) return
      if (e instanceof ApiError) {
        setError(e.message && !/^code /.test(e.message) ? e.message : '登录失败，请重试')
      } else {
        setError('网络连接失败，请重试')
      }
      loadCaptcha()
      focusTo(focusId(KEYPAD_ROW0, 1))
    } finally {
      if (aliveRef.current) setBusy(false)
    }
  }

  const refreshCaptcha = () => {
    if (busy) return
    setError(null)
    loadCaptcha()
  }

  const confirmLogout = () => {
    const saved = credentialsStore.get().remembered
    setConfirm(null)
    setEditing(!saved)
    setUsername(saved?.username || '')
    setPassword(saved?.password || '')
    setError(null)
    signOut()
  }

  const confirmForget = () => {
    setConfirm(null)
    forgetCredentials()
    if (!signedIn && !credentialsStore.get().remembered) {
      setEditing(true)
      setUsername('')
      setPassword('')
    }
  }

  return (
    <div className={isTab ? undefined : OVERLAY_ROOT} style={style}>
      {/* 720 + 64 + 680: the pair is a fixed block centered in the content
          width, rather than two columns stretched to whatever is left. */}
      <div className="mx-auto flex w-[1464px] gap-16 pt-2">
        {/* Left: the account */}
        <div className="flex w-[720px] shrink-0 flex-col">
          {signedIn ? (
            <>
              <div className="glass mb-7 flex size-36 items-center justify-center rounded-full border border-glass-edge text-fg">
                <svg
                  viewBox="0 0 24 24"
                  width="80"
                  height="80"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
                </svg>
              </div>
              <div className="mb-2 text-title font-bold text-fg">{session.name}</div>
              <div className={`mb-10 min-h-[35px] text-body ${member === 'vip' ? 'text-accent' : 'text-fg-2'}`}>
                {member === 'vip' ? 'VIP 会员' : member === 'normal' ? '普通用户' : ''}
              </div>
              <div className="flex flex-col items-start gap-4">
                <ActionButton ids={ids} row={0} col={0} label="退出登录" onSelect={() => setConfirm('logout')} />
                {remembered && (
                  <ActionButton ids={ids} row={1} col={0} label="清除已保存信息" onSelect={() => setConfirm('forget')} />
                )}
              </div>
            </>
          ) : (
            <>
              <div className="mb-3 text-title font-bold text-fg">登录欧乐账号</div>
              <div className="mb-12 text-body text-fg-2">
                {editing ? '登录后即可播放账号有权限的会员内容' : '这次只需输入验证码'}
              </div>
              {editing ? (
                <div className="flex flex-col gap-5">
                  <InputBox
                    ids={ids}
                    row={0}
                    inputRef={userRef}
                    value={username}
                    onChange={(v) => !busy && setUsername(v)}
                    placeholder="邮箱 / 用户名"
                    onEnter={() => {
                      focusTo(focusId(1, 0))
                      passRef.current?.focus()
                    }}
                  />
                  <InputBox
                    ids={ids}
                    row={1}
                    inputRef={passRef}
                    type="password"
                    value={password}
                    onChange={(v) => !busy && setPassword(v)}
                    placeholder="密码"
                    onEnter={() => {
                      passRef.current?.blur()
                      focusTo(focusId(KEYPAD_ROW0, 1))
                    }}
                  />
                </div>
              ) : (
                <>
                  <div className="mb-2 text-heading text-fg">{username}</div>
                  <div className="mb-3 text-body text-fg-2">••••••••</div>
                  <div className="mb-10 text-caption text-accent">已自动填写账号与密码</div>
                  <div className="flex flex-col items-start gap-4">
                    <ActionButton
                      ids={ids}
                      row={0}
                      col={0}
                      label="更换账号"
                      onSelect={() => {
                        if (busy) return
                        setEditing(true)
                        setUsername('')
                        setPassword('')
                      }}
                    />
                    <ActionButton
                      ids={ids}
                      row={1}
                      col={0}
                      label="清除已保存信息"
                      onSelect={() => !busy && setConfirm('forget')}
                    />
                  </div>
                </>
              )}
            </>
          )}
          <div className="mt-12 text-caption text-fg-3">账号密码加密保存在这台电视，下次只需输入验证码。</div>
          {persistError && <div className="mt-3 text-caption text-uhd">{persistError}</div>}
        </div>

        {/* Right: captcha + keypad, or a note when signed in */}
        <div className="glass h-fit w-[680px] shrink-0 rounded-[20px] border border-glass-edge p-8">
          {signedIn ? (
            <div className="text-body leading-normal text-fg-2">已登录，可以播放账号有权限的会员内容。</div>
          ) : (
            <>
              <div className="mb-6 flex items-center gap-6">
                <div className="flex h-[160px] w-[320px] items-center justify-center overflow-hidden rounded-[14px] bg-captcha-bg">
                  {challenge.status === 'ok' ? (
                    <img src={challenge.image} alt="验证码" className="size-full object-contain" />
                  ) : (
                    <span className="text-caption text-inverse">
                      {challenge.status === 'loading' ? '正在加载…' : '验证码加载失败'}
                    </span>
                  )}
                </div>
                <ActionButton ids={ids} row={CAPTCHA_ROW} col={1} label="换一张" onSelect={refreshCaptcha} />
              </div>

              <div className="mb-6 flex gap-3.5">
                {Array.from({ length: CODE_LENGTH }, (_, i) => (
                  <div
                    key={i}
                    className={`flex h-[88px] flex-1 items-center justify-center rounded-[14px] border-[3px] bg-elev text-title text-fg ${i === code.length ? 'border-fg-3' : 'border-transparent'}`}
                  >
                    {code[i] || ''}
                  </div>
                ))}
              </div>

              <div className="mb-6 grid grid-cols-3 gap-3.5">
                {KEYS.map((label, i) => (
                  <KeyButton
                    ids={ids}
                    key={label}
                    row={KEYPAD_ROW0 + Math.floor(i / 3)}
                    col={1 + (i % 3)}
                    label={label}
                    onPress={() => pressKey(label)}
                  />
                ))}
              </div>

              {canSubmit || busy ? (
                <LoginButton ids={ids} label={busy ? '登录中…' : '登录'} onSelect={submit} />
              ) : (
                <div className={`${WIDE_BTN} border-[3px] border-transparent bg-elev-2 text-fg-3`}>登录</div>
              )}

              <div className={`mt-4 text-caption ${error ? 'text-uhd' : 'text-fg-3'}`}>
                {error || '输入图中 4 位数字，遥控器数字键也可直接输入'}
              </div>
            </>
          )}
        </div>
      </div>

      {confirm === 'logout' && (
        <ConfirmDialog
          title="退出登录？"
          description="退出后播放会员内容需要重新登录，记住的账号密码会保留。"
          confirmLabel="退出"
          onConfirm={confirmLogout}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'forget' && (
        <ConfirmDialog
          title="清除记住的账号密码？"
          description={signedIn ? '下次登录需要重新输入账号密码，当前登录不受影响。' : '下次登录需要重新输入账号密码。'}
          confirmLabel="清除"
          onConfirm={confirmForget}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
