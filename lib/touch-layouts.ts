// ── Layouts de botones táctiles por juego (SPEC 10) ───────────────────────
// Cada botón emite un KeyboardEvent sintético con el mismo `key` y `code`
// que la tecla real, de modo que la lógica de cada juego no cambia.

export interface TouchButtonDef {
  id: string
  label: string // glifo visible: '◀', '▶', '▲', '▼', '⟳', '⤓', 'FUEGO'
  ariaLabel: string
  key: string // KeyboardEvent.key  ('ArrowLeft', ' ')
  code: string // KeyboardEvent.code ('ArrowLeft', 'Space')
  zone: 'left' | 'right'
  repeat?: boolean // true = keydown repetido mientras se mantiene
}

export type TouchGameId = 'asteroids' | 'tetris' | 'arkanoid' | 'snake'

const LEFT = { key: 'ArrowLeft', code: 'ArrowLeft' }
const RIGHT = { key: 'ArrowRight', code: 'ArrowRight' }
const UP = { key: 'ArrowUp', code: 'ArrowUp' }
const DOWN = { key: 'ArrowDown', code: 'ArrowDown' }
const SPACE = { key: ' ', code: 'Space' }

export const TOUCH_LAYOUTS: Record<TouchGameId, TouchButtonDef[]> = {
  asteroids: [
    { id: 'left', label: '◀', ariaLabel: 'Girar a la izquierda', zone: 'left', ...LEFT },
    { id: 'right', label: '▶', ariaLabel: 'Girar a la derecha', zone: 'left', ...RIGHT },
    { id: 'thrust', label: '▲', ariaLabel: 'Empuje', zone: 'right', ...UP },
    { id: 'fire', label: 'FUEGO', ariaLabel: 'Disparar', zone: 'right', ...SPACE },
  ],
  tetris: [
    {
      id: 'left',
      label: '◀',
      ariaLabel: 'Mover a la izquierda',
      zone: 'left',
      repeat: true,
      ...LEFT,
    },
    {
      id: 'right',
      label: '▶',
      ariaLabel: 'Mover a la derecha',
      zone: 'left',
      repeat: true,
      ...RIGHT,
    },
    { id: 'down', label: '▼', ariaLabel: 'Bajar pieza', zone: 'left', repeat: true, ...DOWN },
    { id: 'rotate', label: '⟳', ariaLabel: 'Rotar pieza', zone: 'right', ...UP },
    { id: 'drop', label: '⤓', ariaLabel: 'Caída rápida', zone: 'right', ...SPACE },
  ],
  arkanoid: [
    { id: 'left', label: '◀', ariaLabel: 'Mover paleta a la izquierda', zone: 'left', ...LEFT },
    { id: 'right', label: '▶', ariaLabel: 'Mover paleta a la derecha', zone: 'right', ...RIGHT },
  ],
  snake: [
    { id: 'up', label: '▲', ariaLabel: 'Arriba', zone: 'left', ...UP },
    { id: 'left', label: '◀', ariaLabel: 'Izquierda', zone: 'left', ...LEFT },
    { id: 'right', label: '▶', ariaLabel: 'Derecha', zone: 'left', ...RIGHT },
    { id: 'down', label: '▼', ariaLabel: 'Abajo', zone: 'left', ...DOWN },
  ],
}

/** Parámetros de auto-repetición (botones con `repeat: true`). */
export const REPEAT_DELAY_MS = 170
export const REPEAT_INTERVAL_MS = 50
