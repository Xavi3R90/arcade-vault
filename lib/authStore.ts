import type { Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@/lib/types'

// Estado de autenticación (SPEC 12): sesión de Supabase + perfil de `profiles`,
// leído con useSyncExternalStore y alimentado por supabase.auth.onAuthStateChange.

export type AuthState =
  | { status: 'loading' }
  | { status: 'guest' }
  | { status: 'needs-username'; id: string; email: string | null }
  | { status: 'authed'; user: User }

const LOADING: AuthState = { status: 'loading' }
const GUEST: AuthState = { status: 'guest' }

let state: AuthState = LOADING
let started = false
let loadSeq = 0
const listeners = new Set<() => void>()

function setState(next: AuthState): void {
  state = next
  listeners.forEach((cb) => cb())
}

function hasPasswordIdentity(session: Session): boolean {
  const u = session.user
  if (u.identities?.some((i) => i.provider === 'email')) return true
  const providers = u.app_metadata?.providers
  return Array.isArray(providers) && providers.includes('email')
}

async function load(session: Session | null): Promise<void> {
  const seq = ++loadSeq
  if (!session) {
    setState(GUEST)
    return
  }
  const { data, error } = await createClient()
    .from('profiles')
    .select('username')
    .eq('id', session.user.id)
    .maybeSingle()
  if (seq !== loadSeq) return // llegó otro evento de auth mientras tanto

  const email = session.user.email ?? null
  if (error || !data?.username) {
    setState({ status: 'needs-username', id: session.user.id, email })
    return
  }
  setState({
    status: 'authed',
    user: {
      id: session.user.id,
      name: data.username,
      email,
      hasPassword: hasPasswordIdentity(session),
    },
  })
}

function start(): void {
  if (started) return
  started = true
  createClient().auth.onAuthStateChange((_event, session) => {
    // No llamar a Supabase de forma síncrona dentro del callback (puede bloquearse):
    // se difiere la carga del perfil al siguiente tick.
    setTimeout(() => void load(session), 0)
  })
}

export function readAuth(): AuthState {
  return state
}

export function subscribeAuth(cb: () => void): () => void {
  start()
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export const serverAuth = (): AuthState => LOADING

// Vuelve a leer el perfil (p. ej. tras elegir o cambiar el nombre de jugador).
export async function refreshProfile(): Promise<void> {
  const {
    data: { session },
  } = await createClient().auth.getSession()
  await load(session)
}

export async function signOut(): Promise<void> {
  await createClient().auth.signOut()
}
