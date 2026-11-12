import type { User } from '@/lib/types'

// Usuario local persistido en localStorage['av_user'], leído con useSyncExternalStore
// (evita setState dentro de useEffect y los desajustes de hidratación).

const USER_KEY = 'av_user'
const listeners = new Set<() => void>()

let cachedRaw: string | null | undefined
let cachedUser: User | null = null

export function readUser(): User | null {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(USER_KEY)
  } catch {
    // localStorage no disponible
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw
    try {
      cachedUser = raw ? (JSON.parse(raw) as User) : null
    } catch {
      cachedUser = null
    }
  }
  return cachedUser
}

export function writeUser(user: User | null): void {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
    else localStorage.removeItem(USER_KEY)
  } catch {
    // ignore
  }
  listeners.forEach((cb) => cb())
}

export function subscribeUser(cb: () => void): () => void {
  listeners.add(cb)
  const onStorage = (e: StorageEvent) => {
    if (e.key === USER_KEY) cb()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(cb)
    window.removeEventListener('storage', onStorage)
  }
}

export const serverUser = (): User | null => null
