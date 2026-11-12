// ── Gamepad táctil común (SPEC 10) ────────────────────────────────────────
// Todos los juegos muestran el MISMO gamepad: cruceta (↑ ↓ ← →) + botones B y A.
// Cada juego solo decide qué tecla emite cada slot. Un slot sin binding se
// pinta atenuado y deshabilitado (p. ej. ↓ en Asteroids).
// Cada binding emite un KeyboardEvent sintético con el mismo `key` y `code`
// que la tecla real, de modo que la lógica de cada juego no cambia.

export type GamepadSlot = 'up' | 'down' | 'left' | 'right' | 'b' | 'a'

export const GAMEPAD_SLOTS: readonly GamepadSlot[] = ['up', 'left', 'right', 'down', 'b', 'a']

export interface TouchBinding {
  ariaLabel: string // 'Girar a la izquierda', 'Disparar', …
  key: string // KeyboardEvent.key  ('ArrowLeft', ' ')
  code: string // KeyboardEvent.code ('ArrowLeft', 'Space')
  repeat?: boolean // true = keydown repetido mientras se mantiene (auto-repeat del SO)
}

export type TouchGameId = 'asteroids' | 'tetris' | 'arkanoid' | 'snake'

export type GamepadLayout = Partial<Record<GamepadSlot, TouchBinding>>

/** Glifo visible de cada slot: idéntico en todos los juegos. */
export const SLOT_LABEL: Record<GamepadSlot, string> = {
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
  b: 'B',
  a: 'A',
}

const LEFT = { key: 'ArrowLeft', code: 'ArrowLeft' }
const RIGHT = { key: 'ArrowRight', code: 'ArrowRight' }
const UP = { key: 'ArrowUp', code: 'ArrowUp' }
const DOWN = { key: 'ArrowDown', code: 'ArrowDown' }
const SPACE = { key: ' ', code: 'Space' }

export const TOUCH_LAYOUTS: Record<TouchGameId, GamepadLayout> = {
  // ↓ sin uso. B = empuje (para empujar con el pulgar derecho mientras se dispara).
  asteroids: {
    up: { ariaLabel: 'Empuje', ...UP },
    left: { ariaLabel: 'Girar a la izquierda', ...LEFT },
    right: { ariaLabel: 'Girar a la derecha', ...RIGHT },
    b: { ariaLabel: 'Empuje', ...UP },
    a: { ariaLabel: 'Disparar', ...SPACE },
  },
  // ← → ↓ con auto-repeat. ↑ y A rotan, B deja caer la pieza.
  tetris: {
    up: { ariaLabel: 'Rotar pieza', ...UP },
    left: { ariaLabel: 'Mover a la izquierda', repeat: true, ...LEFT },
    right: { ariaLabel: 'Mover a la derecha', repeat: true, ...RIGHT },
    down: { ariaLabel: 'Bajar pieza', repeat: true, ...DOWN },
    b: { ariaLabel: 'Caída rápida', ...SPACE },
    a: { ariaLabel: 'Rotar pieza', ...UP },
  },
  // Solo ← →. El resto del gamepad queda atenuado.
  arkanoid: {
    left: { ariaLabel: 'Mover paleta a la izquierda', ...LEFT },
    right: { ariaLabel: 'Mover paleta a la derecha', ...RIGHT },
  },
  // Cruceta completa. A y B sin uso.
  snake: {
    up: { ariaLabel: 'Arriba', ...UP },
    left: { ariaLabel: 'Izquierda', ...LEFT },
    right: { ariaLabel: 'Derecha', ...RIGHT },
    down: { ariaLabel: 'Abajo', ...DOWN },
  },
}

/** Parámetros de auto-repetición (bindings con `repeat: true`). */
export const REPEAT_DELAY_MS = 170
export const REPEAT_INTERVAL_MS = 50
