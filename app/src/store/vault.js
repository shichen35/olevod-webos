/*
 * Credential vault — encrypted-at-rest slots for the remembered login and the
 * session token.
 *
 * Key: an AES-GCM 256 CryptoKey generated with extractable:false and stored as
 * a structured-clone object in IndexedDB, so no script can export its raw bytes.
 * Ciphertext: `base64(iv).base64(ciphertext)` in localStorage, one key per slot,
 * with a fresh 12-byte IV on every write.
 *
 * What this protects and what it doesn't (a browser can't reach a hardware key
 * store on webOS) is recorded in docs/adr/0001-credential-vault-webcrypto.md:
 * a dumped localStorage or a logged store snapshot shows only ciphertext;
 * code running inside this origin, or a full filesystem copy, can still decrypt.
 *
 * Deliberately not createStore(): that persists plain JSON.
 */

const DB_NAME = 'olevod-vault'
const DB_STORE = 'keys'
const KEY_ID = 'v1'

const SLOT_KEYS = {
  credentials: 'olevod:vault:credentials', // { username, password }
  session: 'olevod:vault:session', // { token, name, userId }
}

function idbRequest(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function openDb() {
  const req = indexedDB.open(DB_NAME, 1)
  req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE)
  return idbRequest(req)
}

async function loadKey() {
  const db = await openDb()
  try {
    const existing = await idbRequest(db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(KEY_ID))
    if (existing) return existing
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
    await idbRequest(db.transaction(DB_STORE, 'readwrite').objectStore(DB_STORE).put(key, KEY_ID))
    return key
  } finally {
    db.close()
  }
}

// One shared key load per session; a failure is not cached so a later write
// can try again.
let keyPromise = null
function getKey() {
  if (!keyPromise) {
    keyPromise = loadKey().catch((e) => {
      keyPromise = null
      throw e
    })
  }
  return keyPromise
}

function toBase64(bytes) {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

function fromBase64(b64) {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function seal(key, value) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plain = new TextEncoder().encode(JSON.stringify(value))
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain)
  return `${toBase64(iv)}.${toBase64(new Uint8Array(cipher))}`
}

async function unseal(key, text) {
  const [iv, cipher] = text.split('.')
  if (!iv || !cipher) throw new Error('malformed vault entry')
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(iv) }, key, fromBase64(cipher))
  return JSON.parse(new TextDecoder().decode(plain))
}

/**
 * Decrypt a slot. Returns null when it's empty or unreadable. An entry the
 * current key can't open (key lost, data corrupt) is dropped for good; if the
 * key itself can't be loaded right now, the entry is left alone.
 * @param {'credentials'|'session'} name
 */
export async function readSlot(name) {
  let raw
  try {
    raw = localStorage.getItem(SLOT_KEYS[name])
  } catch {
    return null
  }
  if (raw == null) return null

  let key
  try {
    key = await getKey()
  } catch {
    return null
  }
  try {
    return await unseal(key, raw)
  } catch {
    clearSlot(name)
    return null
  }
}

/**
 * Encrypt and persist a slot. Throws when IndexedDB, WebCrypto or localStorage
 * refuses — the caller decides what that means for the user.
 * @param {'credentials'|'session'} name
 */
export async function writeSlot(name, value) {
  const key = await getKey()
  localStorage.setItem(SLOT_KEYS[name], await seal(key, value))
}

/**
 * Remove a slot. Throws if storage refuses.
 * @param {'credentials'|'session'} name
 */
export function clearSlot(name) {
  localStorage.removeItem(SLOT_KEYS[name])
}
