'use client'

import type { CSSProperties, ReactNode } from 'react'
import { useTouchControlsVisible } from '@/lib/touch-controls'
import Gamepad, { type GamepadProps } from '@/components/Gamepad'

interface GameStageProps extends GamepadProps {
  title: string // se muestra en la barra de estado del bezel CRT
  aspect: number // ancho / alto lógico del canvas (800/600, Tetris 0.5)
  maxWidth: number // ancho CSS máximo del canvas
  children: ReactNode // canvas + overlays (pausa, modal…)
}

/**
 * Contenedor común de todas las pantallas de juego (SPEC 10).
 * - Sin controles táctiles: solo el canvas escalado (aspecto de escritorio).
 * - Con controles táctiles: modo "consola portátil" — canvas dentro del bezel
 *   CRT con barra de estado y debajo (o a los lados en horizontal) el gamepad
 *   común: cruceta, B/A y la barra PAUSA · skin · SALIR.
 */
export default function GameStage({ title, aspect, maxWidth, children, ...pad }: GameStageProps) {
  const touch = useTouchControlsVisible()

  return (
    <div
      className={'game-stage' + (touch ? ' is-console' : '')}
      data-game={pad.game}
      data-color={pad.color}
      style={{ '--stage-ar': aspect, '--stage-max-w': `${maxWidth}px` } as CSSProperties}
    >
      <div className="game-screen">
        <div className="game-canvas">{children}</div>
        {touch && (
          <div className="crt-bottom gp-status" aria-hidden>
            <span className="led">SEÑAL OK</span>
            <span>{title.toUpperCase()} · CRT-83 · 60 HZ</span>
            <span>CARGA · 1MB</span>
          </div>
        )}
      </div>
      {touch && <Gamepad {...pad} />}
    </div>
  )
}
