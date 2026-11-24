'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Route, User, SavedScore } from '@/lib/types'
import FroggerGame from '@/components/games/FroggerGame'
import { DEFAULT_SKIN, type GamePalette, type SkinId } from '@/lib/skins'
import { froggerSkins } from '@/lib/skins/frogger'
import TouchControls from '@/components/TouchControls'
import { TOUCH_MAPPINGS } from '@/lib/touch'
import { useIsTouchMobile } from '@/lib/useTouchMobile'

const START_LIVES = 3
const ex = (p: GamePalette, key: string) => p.extra[key] as string

interface Props {
  navigate: (r: Route) => void
  user: User | null
  onSaveScore: (entry: SavedScore) => void
  skin?: SkinId
}

export default function FroggerScreen({ navigate, user, onSaveScore, skin = DEFAULT_SKIN }: Props) {
  const p = froggerSkins[skin]
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(START_LIVES)
  const [level, setLevel] = useState(1)
  const [paused, setPaused] = useState(false)
  const [over, setOver] = useState(false)
  const [saved, setSaved] = useState(false)
  const [gameKey, setGameKey] = useState(0)
  const isTouchMobile = useIsTouchMobile()

  // El gamepad (SPEC 10) emite KeyboardEvent sintéticos en window, pero FroggerGame
  // escucha en document y un evento con target window no pasa por document. Se
  // reenvían a document solo los sintéticos (no isTrusted) y sin burbujeo, así el
  // teclado físico no se duplica y no hay bucle.
  useEffect(() => {
    if (!isTouchMobile) return
    const relay = (e: KeyboardEvent) => {
      if (e.isTrusted || e.target !== window) return
      document.dispatchEvent(
        new KeyboardEvent(e.type, { key: e.key, code: e.code, bubbles: false, cancelable: true }),
      )
    }
    window.addEventListener('keydown', relay)
    window.addEventListener('keyup', relay)
    return () => {
      window.removeEventListener('keydown', relay)
      window.removeEventListener('keyup', relay)
    }
  }, [isTouchMobile])

  // Callbacks estables: FroggerGame los guarda en un ref, pero así evitamos efectos extra.
  const handleGameOver = useCallback((finalScore: number) => {
    setScore(finalScore)
    setOver(true)
  }, [])

  const togglePause = () => {
    if (!over) setPaused((p) => !p)
  }

  const exit = () => navigate({ name: 'detalle', id: 'frogger' })

  const saveScore = () => {
    if (saved || !user) return
    setSaved(true) // deshabilita el botón antes del insert: sin doble envío
    onSaveScore({ game: 'frogger', score, name: user.name, at: Date.now() })
  }

  const playAgain = () => {
    setScore(0)
    setLives(START_LIVES)
    setLevel(1)
    setPaused(false)
    setOver(false)
    setSaved(false)
    setGameKey((k) => k + 1) // remonta FroggerGame desde cero
  }

  return (
    <div className={'av-player fade-in' + (isTouchMobile ? ' game-mobile' : '')}>
      <div
        className="player-hud"
        style={{ background: ex(p, 'hudBg'), borderColor: ex(p, 'hudBorder') }}
      >
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="hud-stat">
            <div className="l" style={{ color: ex(p, 'hudLabelCss') }}>
              Puntuación
            </div>
            <div
              className="v"
              style={{ color: ex(p, 'hudScore'), textShadow: ex(p, 'hudScoreShadow') }}
            >
              {score.toLocaleString('es-ES')}
            </div>
          </div>
          <div className="hud-stat lives">
            <div className="l" style={{ color: ex(p, 'hudLabelCss') }}>
              Vidas
            </div>
            <div
              className="v"
              style={{ color: ex(p, 'hudLives'), textShadow: ex(p, 'hudLivesShadow') }}
            >
              {'♥ '.repeat(lives).trim() || '—'}
            </div>
          </div>
          <div className="hud-stat level">
            <div className="l" style={{ color: ex(p, 'hudLabelCss') }}>
              Nivel
            </div>
            <div
              className="v"
              style={{ color: ex(p, 'hudLevel'), textShadow: ex(p, 'hudLevelShadow') }}
            >
              {String(level).padStart(2, '0')}
            </div>
          </div>
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={togglePause} disabled={over}>
            {paused ? 'REANUDAR' : 'PAUSA'}
          </button>
          <button className="btn ghost" onClick={exit}>
            SALIR
          </button>
        </div>
      </div>

      {/* Misma estructura en móvil y escritorio: el canvas nunca se remonta. */}
      <div className={isTouchMobile ? 'game-stage-area' : undefined}>
        <div className={isTouchMobile ? 'crt game-stage frogger-crt' : 'crt'}>
          <div className="crt-screen">
            <FroggerGame
              key={gameKey}
              paused={paused || over}
              onScoreChange={setScore}
              onLivesChange={setLives}
              onLevelChange={setLevel}
              onGameOver={handleGameOver}
              skin={skin}
            />
            {paused && !over && (
              <div className="crt-content" style={{ background: 'rgba(0,0,0,0.6)', zIndex: 5 }}>
                <div>
                  <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                    EN PAUSA
                  </div>
                  <div
                    className="mono"
                    style={{
                      fontSize: 11,
                      color: 'var(--ink-dim)',
                      marginTop: 10,
                      letterSpacing: '0.16em',
                    }}
                  >
                    PULSA REANUDAR PARA CONTINUAR
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="crt-bottom">
            <span className="led">SEÑAL OK</span>
            <span>FROGGER · CRT-83 · 60 HZ</span>
            <span>← ↑ → ↓ SALTAR</span>
          </div>
        </div>
      </div>

      {isTouchMobile && (
        <TouchControls
          mapping={TOUCH_MAPPINGS.frogger}
          paused={paused}
          onTogglePause={togglePause}
          onExit={exit}
          skin={skin}
        />
      )}

      {over && (
        <div className="modal-bd">
          <div
            className="modal"
            style={{
              background: ex(p, 'modalBg'),
              borderColor: ex(p, 'modalBorder'),
              boxShadow: ex(p, 'modalShadow'),
            }}
          >
            <h2 style={{ color: ex(p, 'modalTitle'), textShadow: ex(p, 'modalTitleShadow') }}>
              GAME OVER
            </h2>
            <div className="final-label" style={{ color: ex(p, 'modalLabel') }}>
              PUNTUACIÓN FINAL
            </div>
            <div
              className="final"
              style={{ color: ex(p, 'modalFinal'), textShadow: ex(p, 'modalFinalShadow') }}
            >
              {score.toLocaleString('es-ES')}
            </div>
            {!user ? (
              <div className="save-guest">
                <p>INICIA SESIÓN PARA GUARDAR TU PUNTUACIÓN</p>
                <button className="btn yellow" onClick={() => navigate({ name: 'auth' })}>
                  INICIAR SESIÓN
                </button>
              </div>
            ) : !saved ? (
              <div className="input-row">
                <div className="save-player" aria-label="Jugador">
                  {user.name}
                </div>
                <button className="btn yellow" onClick={saveScore} disabled={saved}>
                  GUARDAR PUNTUACIÓN
                </button>
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            <div className="actions">
              <button className="btn" onClick={playAgain}>
                JUGAR DE NUEVO
              </button>
              <button className="btn magenta" onClick={() => navigate({ name: 'games' })}>
                VOLVER AL VAULT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
