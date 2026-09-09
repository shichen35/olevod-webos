/*
 * Account session + remembered login.
 *
 * Both live in memory-only stores (same get/set/subscribe shape as createStore,
 * so useStoreValue works) and are persisted through the encrypted vault instead
 * of plain localStorage. initSession() decrypts them before the first frame, so
 * every request can read the token synchronously afterwards.
 *
 * Remembering is automatic and happens only after a successful login. Signing
 * out drops the session but keeps the remembered login; forgetting the login
 * leaves the current session alone.
 *
 * Side effects of an account change (cache flush, prefetch) are handled by the
 * shell subscribing to sessionStore (App.jsx), not here.
 */
import { createMemoryStore } from '../hooks/useStore.js'
import { readSlot, writeSlot, clearSlot } from './vault.js'
import { setSessionTokenProvider, setAuthExpiredHandler } from '../api/http.js'

// { token, name, userId } | null
export const sessionStore = createMemoryStore(null)

// remembered: { username, password } | null
// persistError: user-facing message when the vault couldn't save or clear
export const credentialsStore = createMemoryStore({ remembered: null, persistError: null })

/** Startup: wire the transport to this store and decrypt persisted state. Never throws. */
export async function initSession() {
  setSessionTokenProvider(() => sessionStore.get()?.token || null)
  setAuthExpiredHandler(() => signOut())
  try {
    const [session, remembered] = await Promise.all([readSlot('session'), readSlot('credentials')])
    if (session?.token) {
      sessionStore.set({ token: session.token, name: session.name || '已登录', userId: session.userId || '' })
    }
    if (remembered?.username && remembered?.password) {
      credentialsStore.set({ remembered: { username: remembered.username, password: remembered.password }, persistError: null })
    }
  } catch {
    // Unreadable vault: start signed out with nothing remembered.
  }
}

/**
 * A login succeeded: switch to the new session, then persist it and remember
 * the credentials. Never throws — a vault failure only costs persistence.
 * @param {{token: string, name: string, userId: string}} session
 * @param {{username: string, password: string}} credentials
 */
export async function signIn(session, credentials) {
  const next = { token: session.token, name: session.name, userId: session.userId }
  sessionStore.set(next)
  try {
    await writeSlot('session', next)
  } catch {
    // This session still works; the next launch just starts signed out.
  }
  try {
    await writeSlot('credentials', credentials)
    credentialsStore.set({ remembered: { ...credentials }, persistError: null })
  } catch {
    credentialsStore.set((prev) => ({ ...prev, persistError: '本次可继续登录，但账号未能记住' }))
  }
}

/** Drop the session (explicit logout or expiry). The remembered login stays. */
export function signOut() {
  if (sessionStore.get() === null) return
  sessionStore.set(null)
  try {
    clearSlot('session')
  } catch {
    /* the stale ciphertext is harmless: its token is already dead */
  }
}

/** Forget the remembered username/password. The current session stays. */
export function forgetCredentials() {
  try {
    clearSlot('credentials')
    credentialsStore.set({ remembered: null, persistError: null })
  } catch {
    credentialsStore.set((prev) => ({ ...prev, persistError: '无法清除记住的账号密码，请重试' }))
  }
}

/** Clear a shown persistence message (e.g. when the account page closes). */
export function clearPersistError() {
  credentialsStore.set((prev) => (prev.persistError ? { ...prev, persistError: null } : prev))
}
