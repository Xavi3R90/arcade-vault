'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { SKINS, isSkinId, readSkin, serverSkin, subscribeSkin, writeSkin } from '@/lib/skins'
import {
  REPEAT_DELAY_MS,
  REPEAT_INTERVAL_MS,
  SLOT_LABEL,
  TOUCH_LAYOUTS,
  type GamepadSlot,
  type TouchBinding,
  type TouchGameId,
} from '@/lib/touch-layouts'

export interface GamepadProps {
  game: TouchGameId
  color: 'cyan' | 'magenta' | 'yellow' | 'green' // de games.color
  paused: boolean
  onPause: () => void
  onExit: () => void
  disabled?: boolean // true en game over: no emite eventos
}

interface Held {
  binding: TouchBinding
  pointerId: number
  delay?: ReturnType<typeof setTimeout>
  interval?: ReturnType<typeof setInterval>
}

// Los juegos escuchan keydown/keyup en window: un evento sintético con el mismo
// key/code que la tecla real se procesa igual que el teclado físico.
function dispatchKey(type: 'keydown' | 'keyup', b: TouchBinding) {
  window.dispatchEvent(new KeyboardEvent(type, { key: b.key, code: b.code, bubbles: true }))
}

/**
 * Gamepad táctil común a todos los juegos (SPEC 10): cruceta + B/A + barra
 * inferior (PAUSA · skin · SALIR). Se monta desde <GameStage> solo cuando los
 * controles táctiles están visibles.
 * Usa display: contents en sus contenedores para que .gp-dpad, .gp-ab y .gp-bar
 * sean celdas del grid de .game-stage (layout distinto en vertical/horizontal).
 */
export default function Gamepad({
  game,
  color,
  paused,
  onPause,
  onExit,
  disabled = false,
}: GamepadProps) {
  const layout = TOUCH_LAYOUTS[game]
  const skin = useSyncExternalStore(subscribeSkin, readSkin, serverSkin)
  const heldRef = useRef(new Map<GamepadSlot, Held>())
  const [pressed, setPressed] = useState<ReadonlySet<GamepadSlot>>(new Set())

  const syncPressed = () => setPressed(new Set(heldRef.current.keys()))

  // Dos slots pueden compartir tecla (↑ y B en Asteroids): solo se emite keyup
  // cuando ya no queda ningún slot presionado con ese mismo code.
  const release = useCallback((slot: GamepadSlot) => {
    const held = heldRef.current.get(slot)
    if (!held) return
    clearTimeout(held.delay)
    clearInterval(held.interval)
    heldRef.current.delete(slot)
    const stillHeld = [...heldRef.current.values()].some(
      (h) => h.binding.code === held.binding.code,
    )
    if (!stillHeld) dispatchKey('keyup', held.binding)
  }, [])

  const releaseAll = useCallback(() => {
    if (heldRef.current.size === 0) return
    for (const slot of [...heldRef.current.keys()]) release(slot)
    setPressed(new Set())
  }, [release])

  // Soltar todo al desmontar, al perder el foco y al ocultar la pestaña.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') releaseAll()
    }
    window.addEventListener('blur', releaseAll)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('blur', releaseAll)
      document.removeEventListener('visibilitychange', onVisibility)
      releaseAll()
    }
  }, [releaseAll])

  useEffect(() => {
    if (disabled) releaseAll()
  }, [disabled, releaseAll])

  const onPointerDown = (slot: GamepadSlot, b: TouchBinding) => (e: ReactPointerEvent) => {
    e.preventDefault()
    if (disabled || heldRef.current.has(slot)) return
    e.currentTarget.setPointerCapture(e.pointerId)

    const held: Held = { binding: b, pointerId: e.pointerId }
    dispatchKey('keydown', b)
    if (b.repeat) {
      held.delay = setTimeout(() => {
        held.interval = setInterval(() => dispatchKey('keydown', b), REPEAT_INTERVAL_MS)
      }, REPEAT_DELAY_MS)
    }
    heldRef.current.set(slot, held)
    syncPressed()
  }

  const onPointerEnd = (slot: GamepadSlot) => (e: ReactPointerEvent) => {
    const held = heldRef.current.get(slot)
    if (!held || held.pointerId !== e.pointerId) return
    release(slot)
    syncPressed()
  }

  const renderSlot = (slot: GamepadSlot) => {
    const binding = layout[slot]
    const round = slot === 'a' || slot === 'b'
    const cls =
      (round ? 'gp-btn gp-round' : 'gp-btn gp-arrow') +
      (pressed.has(slot) ? ' pressed' : '') +
      (binding ? '' : ' unused')
    if (!binding) {
      return (
        <button key={slot} type="button" className={cls} data-slot={slot} disabled aria-hidden>
          {SLOT_LABEL[slot]}
        </button>
      )
    }
    return (
      <button
        key={slot}
        type="button"
        className={cls}
        data-slot={slot}
        aria-label={binding.ariaLabel}
        disabled={disabled}
        onPointerDown={onPointerDown(slot, binding)}
        onPointerUp={onPointerEnd(slot)}
        onPointerCancel={onPointerEnd(slot)}
        onLostPointerCapture={onPointerEnd(slot)}
        onContextMenu={(e) => e.preventDefault()}
      >
        {SLOT_LABEL[slot]}
      </button>
    )
  }

  return (
    <div className="gamepad" data-color={color} role="group" aria-label="Controles táctiles">
      <div className="gp-dpad">
        {renderSlot('up')}
        {renderSlot('left')}
        <span className="gp-hub" aria-hidden />
        {renderSlot('right')}
        {renderSlot('down')}
      </div>
      <div className="gp-ab">
        {renderSlot('b')}
        {renderSlot('a')}
      </div>
      <div className="gp-bar">
        <button
          type="button"
          className="gp-pill gp-pause"
          disabled={disabled}
          onClick={onPause}
          aria-pressed={paused}
          aria-label={paused ? 'Reanudar' : 'Pausa'}
        >
          <span aria-hidden>{paused ? '▶' : '⏸'}</span>
          <span className="gp-label">{paused ? 'REANUDAR' : 'PAUSA'}</span>
        </button>
        <label className="gp-pill gp-skin">
          <select
            aria-label="Skin"
            value={skin}
            onChange={(e) => {
              if (isSkinId(e.target.value)) writeSkin(e.target.value)
            }}
          >
            {SKINS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label.charAt(0) + s.label.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="gp-pill gp-exit" onClick={onExit} aria-label="Salir">
          <span aria-hidden>←</span>
          <span className="gp-label">SALIR</span>
        </button>
      </div>
    </div>
  )
}
