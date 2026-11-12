// Controles táctiles compartidos (SPEC 10).
// El gamepad virtual emite KeyboardEvent sintéticos en window para que los
// juegos reutilicen sus handlers de teclado sin cambios.

export type TouchButtonId = 'up' | 'down' | 'left' | 'right' | 'a' | 'b'

// key → para juegos que leen e.key (Arkanoid, Snake)
// code → para juegos que leen e.code (Asteroids, Tetris)
export type KeyBinding = { key: string; code: string; repeat?: boolean }

// Botón ausente = se renderiza deshabilitado/atenuado (mismo diseño en todos los juegos)
export type TouchMapping = Partial<Record<TouchButtonId, KeyBinding>>

export type TouchGameId = 'asteroids' | 'tetris' | 'arkanoid' | 'snake'

// Auto-repeat (solo bindings con repeat: true)
export const REPEAT_DELAY = 170 // ms hasta la primera repetición
export const REPEAT_INTERVAL = 50 // ms entre repeticiones

const UP: KeyBinding = { key: 'ArrowUp', code: 'ArrowUp' }
const DOWN: KeyBinding = { key: 'ArrowDown', code: 'ArrowDown' }
const LEFT: KeyBinding = { key: 'ArrowLeft', code: 'ArrowLeft' }
const RIGHT: KeyBinding = { key: 'ArrowRight', code: 'ArrowRight' }
const SPACE: KeyBinding = { key: ' ', code: 'Space' }

export const TOUCH_MAPPINGS: Record<TouchGameId, TouchMapping> = {
  asteroids: { up: UP, left: LEFT, right: RIGHT, a: SPACE },
  tetris: {
    up: UP,
    down: { ...DOWN, repeat: true },
    left: { ...LEFT, repeat: true },
    right: { ...RIGHT, repeat: true },
    a: UP,
    b: SPACE,
  },
  arkanoid: { left: LEFT, right: RIGHT },
  snake: { up: UP, down: DOWN, left: LEFT, right: RIGHT },
}

export function dispatchKey(type: 'keydown' | 'keyup', b: KeyBinding): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new KeyboardEvent(type, { key: b.key, code: b.code, bubbles: true, cancelable: true }),
  )
}
