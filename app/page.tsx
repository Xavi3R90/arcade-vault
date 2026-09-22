'use client'

import { useState, useEffect } from 'react'
import type { Route, User, SavedScore, Game } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import Nav from '@/components/Nav'
import HomeScreen from '@/components/screens/HomeScreen'
import Library from '@/components/screens/Library'
import GameDetail from '@/components/screens/GameDetail'
import GamePlayer from '@/components/screens/GamePlayer'
import Auth from '@/components/screens/Auth'
import HallOfFame from '@/components/screens/HallOfFame'
import AboutScreen from '@/components/screens/AboutScreen'
import AsteroidsScreen from '@/components/screens/AsteroidsScreen'

export default function Home() {
  const [route, setRoute] = useState<Route>({ name: 'home' })
  const [user, setUser] = useState<User | null>(null)
  const [games, setGames] = useState<Game[]>([])

  useEffect(() => {
    try {
      const stored = localStorage.getItem('av_user')
      if (stored) setUser(JSON.parse(stored))
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
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
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  const handleLogin = (u: User | null) => {
    setUser(u)
    if (u) {
      localStorage.setItem('av_user', JSON.stringify(u))
    } else {
      localStorage.removeItem('av_user')
    }
  }

  const handleSignOut = () => {
    setUser(null)
    localStorage.removeItem('av_user')
  }

  const handleSaveScore = async (entry: SavedScore) => {
    try {
      await createClient()
        .from('scores')
        .insert({ game_id: entry.game, player_name: entry.name, score: entry.score })
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
    screen = <Auth navigate={navigate} onLogin={handleLogin} />
  } else if (route.name === 'salon') {
    screen = <HallOfFame games={games} user={user} navigate={navigate} />
  } else if (route.name === 'about') {
    screen = <AboutScreen navigate={navigate} />
  } else if (route.name === 'asteroids') {
    screen = <AsteroidsScreen navigate={navigate} user={user} onSaveScore={handleSaveScore} />
  }

  return (
    <>
      <div className="av-bg" />
      <div className="av-noise" />
      {/* Replicates #root { position: relative; z-index: 2 } from the original template
          so all app content renders above av-bg (z-index:0) and av-noise (z-index:1) */}
      <div id="root">
        <Nav route={route} navigate={navigate} user={user} onSignOut={handleSignOut} />
        <main className="av-main">{screen}</main>
        <footer
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
