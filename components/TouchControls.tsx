'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useTouchControlsVisible } from '@/lib/touch-controls'
import {
  REPEAT_DELAY_MS,
  REPEAT_INTERVAL_MS,
  TOUCH_LAYOUTS,
  type TouchButtonDef,
  type TouchGameId,
} from '@/lib/touch-layouts'

interface TouchControlsProps {
  game: TouchGameId
  color: 'cyan' | 'magenta' | 'yellow' | 'green' // de games.color
  onPause: () => void
  disabled?: boolean // true en game over: no emite eventos
}

interface Held {
  btn: TouchButtonDef
  pointerId: number
  delay?: ReturnType<typeof setTimeout>
  interval?: ReturnType<typeof setInterval>
}

// Los juegos escuchan keydown/keyup en window: un evento sintético con el mismo
// key/code que la tecla real se procesa igual que el teclado físico.
function dispatchKey(type: 'keydown' | 'keyup', btn: TouchButtonDef) {
  window.dispatchEvent(new KeyboardEvent(type, { key: btn.key, code: btn.code, bubbles: true }))
}

export default function TouchControls({
  game,
  color,
  onPause,
  disabled = false,
}: TouchControlsProps) {
  const visible = useTouchControlsVisible()
  const heldRef = useRef(new Map<string, Held>())
  const [pressed, setPressed] = useState<ReadonlySet<string>>(new Set())

  const syncPressed = () => setPressed(new Set(heldRef.current.keys()))

  const release = useCallback((id: string) => {
    const held = heldRef.current.get(id)
    if (!held) return
    clearTimeout(held.delay)
    clearInterval(held.interval)
    heldRef.current.delete(id)
    dispatchKey('keyup', held.btn)
  }, [])

  const releaseAll = useCallback(() => {
    if (heldRef.current.size === 0) return
    for (const id of [...heldRef.current.keys()]) release(id)
    setPressed(new Set())
  }, [release])

  // Soltar todo al desmontar, al perder el foco, al ocultar la pestaña y al deshabilitar.
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
    if (disabled || !visible) releaseAll()
  }, [disabled, visible, releaseAll])

  if (!visible) return null

  const onPointerDown = (btn: TouchButtonDef) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    if (disabled || heldRef.current.has(btn.id)) return
    e.currentTarget.setPointerCapture(e.pointerId)

    const held: Held = { btn, pointerId: e.pointerId }
    dispatchKey('keydown', btn)
    if (btn.repeat) {
      held.delay = setTimeout(() => {
        held.interval = setInterval(() => dispatchKey('keydown', btn), REPEAT_INTERVAL_MS)
      }, REPEAT_DELAY_MS)
    }
    heldRef.current.set(btn.id, held)
    syncPressed()
  }

  const onPointerEnd = (btn: TouchButtonDef) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    const held = heldRef.current.get(btn.id)
    if (!held || held.pointerId !== e.pointerId) return
    release(btn.id)
    syncPressed()
  }

  const layout = TOUCH_LAYOUTS[game]
  const renderZone = (zone: 'left' | 'right') => (
    <div className="touch-zone" data-zone={zone} data-game={game}>
      {zone === 'right' && (
        <button
          type="button"
          className="touch-btn touch-pause"
          aria-label="Pausa"
          disabled={disabled}
          onClick={onPause}
          onContextMenu={(e) => e.preventDefault()}
        >
          ⏸
        </button>
      )}
      {layout
        .filter((b) => b.zone === zone)
        .map((btn) => (
          <button
            key={btn.id}
            type="button"
            className={'touch-btn' + (pressed.has(btn.id) ? ' pressed' : '')}
            data-btn={btn.id}
            aria-label={btn.ariaLabel}
            disabled={disabled}
            onPointerDown={onPointerDown(btn)}
            onPointerUp={onPointerEnd(btn)}
            onPointerCancel={onPointerEnd(btn)}
            onLostPointerCapture={onPointerEnd(btn)}
            onContextMenu={(e) => e.preventDefault()}
          >
            {btn.label}
          </button>
        ))}
    </div>
  )

  return (
    <div className="touch-controls" data-color={color} aria-label="Controles táctiles" role="group">
      {renderZone('left')}
      {renderZone('right')}
    </div>
  )
}
