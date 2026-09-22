'use client'

import { useMemo } from 'react'
import type { Route, Game } from '@/lib/types'

interface GameDetailProps {
  games: Game[]
  id: string
  navigate: (r: Route) => void
}

export default function GameDetail({ games, id, navigate }: GameDetailProps) {
  const game = useMemo(() => games.find((g) => g.id === id), [games, id])

  if (!game) return null

  return (
    <div className="av-detail fade-in">
      <div>
        <div className="detail-cover">
          <div className={'cover-bg ' + game.cover}></div>
        </div>
        <div style={{ marginTop: 20 }} className="detail-info">
          <div className="detail-tags">
            <span>{game.cat}</span>
            <span>1 JUGADOR</span>
            <span>TECLADO / TÁCTIL</span>
            <span>RETRO 1985</span>
          </div>
          <h2 className="neon-cyan">{game.title}</h2>
          <p>{game.long}</p>
          <div className="stat-strip">
            <div>
              <div className="l">Partidas</div>
              <div className="v">{game.plays}</div>
            </div>
            <div>
              <div className="l">Mejor global</div>
              <div
                className="v"
                style={{ color: 'var(--magenta)', textShadow: '0 0 6px rgba(255,0,110,0.5)' }}
              >
                {game.best.toLocaleString('es-ES')}
              </div>
            </div>
            <div>
              <div className="l">Dificultad</div>
              <div
                className="v"
                style={{ color: 'var(--yellow)', textShadow: '0 0 6px rgba(245,255,0,0.5)' }}
              >
                ★ ★ ★ ☆ ☆
              </div>
            </div>
          </div>
          <div className="detail-actions">
            <button
              className="btn xl pulse"
              onClick={() =>
                game.playRoute
                  ? navigate({ name: game.playRoute })
                  : navigate({ name: 'player', id: game.id })
              }
            >
              ▶ JUGAR AHORA
            </button>
            <button className="btn ghost lg" onClick={() => navigate({ name: 'games' })}>
              VOLVER AL VAULT
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
