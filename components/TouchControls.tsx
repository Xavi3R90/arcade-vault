'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { SKINS, writeSkin, isSkinId, type SkinId } from '@/lib/skins'
import { useIsLandscape } from '@/lib/useTouchMobile'
import {
  REPEAT_DELAY,
  REPEAT_INTERVAL,
  dispatchKey,
  type KeyBinding,
  type TouchButtonId,
  type TouchMapping,
} from '@/lib/touch'

// Gamepad virtual compartido (SPEC 10): cruceta + A/B + pie (PAUSA, skin, SALIR).

type TouchControlsProps = {
  mapping: TouchMapping
  paused: boolean
  onTogglePause: () => void
  onExit: () => void
  skin: SkinId
}

type Held = {
  pointerId: number
  binding: KeyBinding
  delay?: ReturnType<typeof setTimeout>
  interval?: ReturnType<typeof setInterval>
}

const DPAD: { id: TouchButtonId; label: string; aria: string }[] = [
  { id: 'up', label: '↑', aria: 'Arriba' },
  { id: 'left', label: '←', aria: 'Izquierda' },
  { id: 'right', label: '→', aria: 'Derecha' },
  { id: 'down', label: '↓', aria: 'Abajo' },
]

export default function TouchControls({
  mapping,
  paused,
  onTogglePause,
  onExit,
  skin,
}: TouchControlsProps) {
  const heldRef = useRef<Partial<Record<TouchButtonId, Held>>>({})
  const isLandscape = useIsLandscape()

  // Últimos valores de paused/onTogglePause, leídos desde el efecto de orientación.
  const pauseStateRef = useRef({ paused, onTogglePause })
  useEffect(() => {
    pauseStateRef.current = { paused, onTogglePause }
  })

  const [pressed, setPressed] = useState<Partial<Record<TouchButtonId, boolean>>>({})

  const release = useCallback((id: TouchButtonId) => {
    const h = heldRef.current[id]
    if (!h) return
    if (h.delay) clearTimeout(h.delay)
    if (h.interval) clearInterval(h.interval)
    delete heldRef.current[id]
    dispatchKey('keyup', h.binding)
    setPressed((p) => ({ ...p, [id]: false }))
  }, [])

  const releaseAll = useCallback(() => {
    ;(Object.keys(heldRef.current) as TouchButtonId[]).forEach(release)
  }, [release])

  // Liberar teclas al ocultar la pestaña y al desmontar (evita teclas "pegadas").
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') releaseAll()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      releaseAll()
    }
  }, [releaseAll])

  // Al entrar en horizontal: soltar teclas y pausa automática una sola vez (si no estaba
  // ya en pausa). Al volver a vertical la partida sigue pausada hasta pulsar REANUDAR.
  useEffect(() => {
    if (!isLandscape) return
    releaseAll()
    const { paused: isPaused, onTogglePause: toggle } = pauseStateRef.current
    if (!isPaused) toggle()
  }, [isLandscape, releaseAll])

  const onDown = (id: TouchButtonId) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    const binding = mapping[id]
    if (!binding) return
    e.preventDefault()
    if (heldRef.current[id]) release(id)
    e.currentTarget.setPointerCapture(e.pointerId)
    const held: Held = { pointerId: e.pointerId, binding }
    heldRef.current[id] = held
    dispatchKey('keydown', binding)
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(10)
    }
    if (binding.repeat) {
      held.delay = setTimeout(() => {
        held.interval = setInterval(() => dispatchKey('keydown', binding), REPEAT_INTERVAL)
      }, REPEAT_DELAY)
    }
    setPressed((p) => ({ ...p, [id]: true }))
  }

  const onUp = (id: TouchButtonId) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    const h = heldRef.current[id]
    if (!h || h.pointerId !== e.pointerId) return
    release(id)
  }

  const btnProps = (id: TouchButtonId) => {
    const enabled = !!mapping[id]
    return {
      type: 'button' as const,
      disabled: !enabled,
      'aria-disabled': !enabled,
      'data-btn': id,
      onPointerDown: onDown(id),
      onPointerUp: onUp(id),
      onPointerCancel: onUp(id),
      onLostPointerCapture: onUp(id),
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    }
  }

  const cls = (base: string, id: TouchButtonId) =>
    base + (pressed[id] ? ' is-pressed' : '') + (mapping[id] ? '' : ' is-disabled')

  if (isLandscape) {
    return (
      <div className="touch-rotate" role="alert">
        <svg
          width="64"
          height="64"
          viewBox="0 0 64 64"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="22" y="8" width="20" height="36" rx="3" />
          <line x1="30" y1="39" x2="34" y2="39" />
          <path d="M12 46 a20 20 0 0 0 20 12" />
          <polyline points="27 53 32 58 27 62" />
        </svg>
        <div>GIRA EL DISPOSITIVO</div>
        <div className="touch-rotate-hint">Los juegos se juegan en vertical</div>
      </div>
    )
  }

  return (
    <div className="touch-controls">
      <div className="touch-pad">
        <div className="touch-dpad" role="group" aria-label="Cruceta">
          {DPAD.map((d) => (
            <button
              key={d.id}
              className={cls(`touch-btn touch-dir touch-dir-${d.id}`, d.id)}
              aria-label={d.aria}
              {...btnProps(d.id)}
            >
              <span aria-hidden="true">{d.label}</span>
            </button>
          ))}
          <span className="touch-dpad-center" aria-hidden="true" />
        </div>

        <div className="touch-ab" role="group" aria-label="Botones de acción">
          <button
            className={cls('touch-btn touch-round touch-b', 'b')}
            aria-label="B"
            {...btnProps('b')}
          >
            B
          </button>
          <button
            className={cls('touch-btn touch-round touch-a', 'a')}
            aria-label="A"
            {...btnProps('a')}
          >
            A
          </button>
        </div>
      </div>

      <div className="touch-footer">
        <button
          type="button"
          className={`btn ${paused ? 'cyan' : 'yellow'}`}
          onClick={onTogglePause}
        >
          {paused ? '▶ REANUDAR' : 'Ⅱ PAUSA'}
        </button>
        <select
          className="touch-skin"
          aria-label="Skin de los juegos"
          value={skin}
          onChange={(e) => {
            if (isSkinId(e.target.value)) writeSkin(e.target.value)
          }}
        >
          {SKINS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <button type="button" className="btn ghost" onClick={onExit}>
          ← SALIR
        </button>
      </div>
    </div>
  )
}
