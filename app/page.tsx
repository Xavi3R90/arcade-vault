'use client'

import { useState, useEffect, useSyncExternalStore } from 'react'
import type { Route, User, SavedScore, Game } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { readSkin, serverSkin, subscribeSkin, writeSkin, type SkinId } from '@/lib/skins'
import { readAuth, serverAuth, signOut, subscribeAuth, type AuthState } from '@/lib/authStore'
import { MSG } from '@/lib/authErrors'
import Nav from '@/components/Nav'
import HomeScreen from '@/components/screens/HomeScreen'
import Library from '@/components/screens/Library'
import GameDetail from '@/components/screens/GameDetail'
import GamePlayer from '@/components/screens/GamePlayer'
import Auth, { type AuthMode } from '@/components/screens/Auth'
import HallOfFame from '@/components/screens/HallOfFame'
import AboutScreen from '@/components/screens/AboutScreen'
import AccountScreen from '@/components/screens/AccountScreen'
import AsteroidsScreen from '@/components/screens/AsteroidsScreen'
import TetrisScreen from '@/components/screens/TetrisScreen'
import ArkanoidScreen from '@/components/screens/ArkanoidScreen'
import SnakeScreen from '@/components/screens/SnakeScreen'
import FroggerScreen from '@/components/screens/FroggerScreen'

// Rutas de juego jugables: en móvil táctil ocultan el Nav (SPEC 10).
const GAME_ROUTES: readonly string[] = ['asteroids', 'tetris', 'arkanoid', 'snake', 'frogger']

// `?auth=<motivo>` que pone app/auth/callback/route.ts (SPEC 12). Se lee una sola vez.
const AUTH_INTENTS = ['confirmed', 'recovery', 'oauth', 'error'] as const
type AuthIntent = (typeof AUTH_INTENTS)[number]
let authIntentRead = false
let authIntent: AuthIntent | null = null
function readAuthIntent(): AuthIntent | null {
  if (!authIntentRead) {
    authIntentRead = true
    const v = new URLSearchParams(window.location.search).get('auth')
    authIntent = (AUTH_INTENTS as readonly string[]).includes(v ?? '') ? (v as AuthIntent) : null
  }
  return authIntent
}
const serverAuthIntent = (): AuthIntent | null => null
const subscribeNoop = () => () => {}

interface AuthView {
  mode: AuthMode
  error?: string
}
const DEFAULT_AUTH_VIEW: AuthView = { mode: 'in' }

export default function Home() {
  const [route, setRoute] = useState<Route>({ name: 'home' })
  const [authView, setAuthView] = useState<AuthView>(DEFAULT_AUTH_VIEW)
  const [notice, setNotice] = useState<string | null>(null)

  // Aplica `?auth=` una vez (ajuste de estado durante el render, patrón recomendado por React).
  const intent = useSyncExternalStore(subscribeNoop, readAuthIntent, serverAuthIntent)
  const [intentHandled, setIntentHandled] = useState(false)
  if (intent && !intentHandled) {
    setIntentHandled(true)
    if (intent === 'confirmed') {
      setRoute({ name: 'games' })
      setNotice('▸ CUENTA CONFIRMADA. ¡BIENVENIDO AL VAULT!')
    } else if (intent === 'oauth') {
      setRoute({ name: 'games' })
    } else if (intent === 'recovery') {
      setRoute({ name: 'auth' })
      setAuthView({ mode: 'reset' })
    } else {
      setRoute({ name: 'auth' })
      setAuthView({ mode: 'in', error: MSG.linkInvalid })
    }
  }

  // Limpia `?auth=` de la URL tras leerlo.
  useEffect(() => {
    if (intent) window.history.replaceState(window.history.state, '', window.location.pathname)
  }, [intent])

  // El aviso se oculta solo a los 5 s.
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 5000)
    return () => clearTimeout(t)
  }, [notice])

  // Sesión de Supabase + perfil (SPEC 12). En servidor = 'loading'.
  const auth = useSyncExternalStore<AuthState>(subscribeAuth, readAuth, serverAuth)
  const user: User | null = auth.status === 'authed' ? auth.user : null
  const [games, setGames] = useState<Game[]>([])
  // Skin global: hidratado desde localStorage['av-skin'] (servidor = 'classic').
  const skin = useSyncExternalStore<SkinId>(subscribeSkin, readSkin, serverSkin)
  const handleSkinChange = (s: SkinId) => writeSkin(s)

  useEffect(() => {
    // Limpieza del usuario simulado anterior a SPEC 12.
    try {
      localStorage.removeItem('av_user')
    } catch {
      // localStorage no disponible
    }
    createClient()
      .from('games')
      .select('*')
      .order('title')
      .then(({ data }) => {
        if (data) {
          setGames(
            data.map(({ play_route, ...g }) => ({
              ...g,
              playRoute: play_route ?? undefined,
            })) as Game[],
          )
        }
      })
  }, [])

  const navigate = (r: Route) => {
    setRoute(r)
    setAuthView(DEFAULT_AUTH_VIEW)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  const handleSignOut = () => {
    void signOut()
  }

  // Solo usuarios autenticados guardan (SPEC 12). player_name lo fija también un trigger
  // en la BD a partir del perfil; aquí se envía por coherencia.
  const handleSaveScore = async (entry: SavedScore) => {
    if (!user) return
    try {
      await createClient().from('scores').insert({
        game_id: entry.game,
        score: entry.score,
        user_id: user.id,
        player_name: user.name,
      })
    } catch {
      // silent fail
    }
  }

  let screen: React.ReactNode = null
  if (route.name === 'home') {
    screen = <HomeScreen games={games} navigate={navigate} />
  } else if (route.name === 'games') {
    screen = <Library games={games} navigate={navigate} />
  } else if (route.name === 'detalle' && route.id) {
    screen = <GameDetail games={games} id={route.id} navigate={navigate} />
  } else if (route.name === 'player' && route.id) {
    screen = (
      <GamePlayer
        games={games}
        id={route.id}
        user={user}
        navigate={navigate}
        onSaveScore={handleSaveScore}
      />
    )
  } else if (route.name === 'auth') {
    screen = (
      <Auth
        key={`${authView.mode}:${authView.error ?? ''}`}
        navigate={navigate}
        initialMode={authView.mode}
        initialError={authView.error}
      />
    )
  } else if (route.name === 'salon') {
    screen = <HallOfFame games={games} user={user} navigate={navigate} />
  } else if (route.name === 'about') {
    screen = <AboutScreen navigate={navigate} />
  } else if (route.name === 'cuenta') {
    // Sin sesión (p. ej. tras cerrar sesión aquí) se muestra el login.
    if (user) screen = <AccountScreen navigate={navigate} user={user} />
    else if (auth.status !== 'loading') screen = <Auth navigate={navigate} />
  } else if (route.name === 'asteroids') {
    screen = (
      <AsteroidsScreen navigate={navigate} user={user} onSaveScore={handleSaveScore} skin={skin} />
    )
  } else if (route.name === 'tetris') {
    screen = (
      <TetrisScreen navigate={navigate} user={user} onSaveScore={handleSaveScore} skin={skin} />
    )
  } else if (route.name === 'arkanoid') {
    screen = (
      <ArkanoidScreen navigate={navigate} user={user} onSaveScore={handleSaveScore} skin={skin} />
    )
  } else if (route.name === 'snake') {
    screen = (
      <SnakeScreen navigate={navigate} user={user} onSaveScore={handleSaveScore} skin={skin} />
    )
  } else if (route.name === 'frogger') {
    screen = (
      <FroggerScreen navigate={navigate} user={user} onSaveScore={handleSaveScore} skin={skin} />
    )
  }

  // Usuario OAuth sin nombre de jugador: siempre ve "Elige tu nombre" (salvo que cierre sesión).
  if (auth.status === 'needs-username') {
    screen = (
      <Auth key="username" navigate={navigate} initialMode="username" pendingUserId={auth.id} />
    )
  }

  return (
    <>
      <div className="av-bg" />
      <div className="av-noise" />
      {/* Replicates #root { position: relative; z-index: 2 } from the original template
          so all app content renders above av-bg (z-index:0) and av-noise (z-index:1) */}
      <div
        id="root"
        data-skin={skin}
        data-game-route={GAME_ROUTES.includes(route.name) ? route.name : undefined}
      >
        <Nav
          route={route}
          navigate={navigate}
          user={user}
          authLoading={auth.status === 'loading'}
          onSignOut={handleSignOut}
          skin={skin}
          onSkinChange={handleSkinChange}
        />
        {notice && (
          <div className="auth-notice" role="status" onClick={() => setNotice(null)}>
            {notice}
          </div>
        )}
        <main className="av-main">{screen}</main>
        <footer
          className="av-footer"
          style={{
            borderTop: '1px solid var(--line)',
            padding: '20px 32px',
            textAlign: 'center',
            color: 'var(--ink-faint)',
            fontFamily: 'var(--mono)',
            fontSize: 11,
            letterSpacing: '0.16em',
          }}
        >
          © 2026 ARCADE VAULT · HECHO CON PIXELES Y NEÓN · v2.6.0
        </footer>
      </div>
    </>
  )
}
