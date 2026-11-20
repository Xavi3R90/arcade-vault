// SPEC 11 — Caché de render de Frogger.
//
// Todo lo que no cambia entre frames se dibuja una vez por skin en canvas
// offscreen y luego se compone con drawImage(). El glow (shadowBlur) del skin
// Neón queda "horneado" en esos canvas, así que se paga una vez y no en cada frame.
//
// Este módulo también es la fuente de la geometría del tablero y de los tipos
// de dibujo compartidos con FroggerGame.tsx.

import type { SkinId } from '@/lib/skins'

// ── Geometría ──────────────────────────────────────────────────────────────
// Canvas lógico 800×600 (convención del repo, escalado por CSS con
// aspect-ratio 800/600). El tablero de 16×14 celdas de 40 px (640×560) se
// dibuja centrado: 80 px de margen lateral y 20 px arriba/abajo.
export const W = 800
export const H = 600
export const COLS = 16
export const ROWS = 14
export const CELL = 40 // px
export const CANVAS_W = COLS * CELL // 640 — área de juego dentro del canvas 800×600
export const CANVAS_H = ROWS * CELL // 560
export const OFFSET_X = (W - CANVAS_W) / 2 // 80
export const OFFSET_Y = (H - CANVAS_H) / 2 // 20

// Zonas (índice de fila, 0 = arriba)
export const ROW_GOALS = 0
export const ROW_RIVER_TOP = 1
export const ROW_RIVER_BOT = 6
export const ROW_ROAD_TOP = 8
export const ROW_ROAD_BOT = 12
export const ROW_START = 13

// 5 bocas destino; cada una ocupa 2 columnas: [c, c + 1].
export const GOAL_COLS = [1, 4, 7, 10, 13]

export const isRiverRow = (row: number) => row >= ROW_RIVER_TOP && row <= ROW_RIVER_BOT
export const isRoadRow = (row: number) => row >= ROW_ROAD_TOP && row <= ROW_ROAD_BOT

// ── Tipos de dibujo ────────────────────────────────────────────────────────
export type Direction = 'up' | 'down' | 'left' | 'right'

// Colores del canvas: salen de la paleta del skin activo (lib/skins/frogger.ts).
export interface Colors {
  bezel: string
  goalsBg: string
  goalMouth: string
  goalBorder: string
  river: string
  safe: string
  road: string
  laneLine: string
  wheel: string
  windshield: string
  truck: string
  truckCab: string
  log: string
  logLine: string
  turtle: string
  turtleScale: string
  turtleUnder: string
  frog: string
  frogDark: string
  eye: string
  pupil: string
  hudLabel: string
  hudText: string
  timeOk: string
  timeWarn: string
  timeLow: string
  car: string // color de respaldo de los coches
  carColors: Record<number, string>
  glow: number
  scanlines: boolean
  scanline: string
}

/** Activa el glow del skin (Neón) para el siguiente relleno; no-op si glow = 0. */
export function setGlow(ctx: CanvasRenderingContext2D, C: Colors, color: string) {
  if (C.glow <= 0) return
  ctx.shadowBlur = C.glow
  ctx.shadowColor = color
}
export function clearGlow(ctx: CanvasRenderingContext2D) {
  ctx.shadowBlur = 0
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// ── Caché ──────────────────────────────────────────────────────────────────
// Sprite pre-renderizado: el glow (shadowBlur) va "horneado" dentro del canvas,
// con margen `pad` para que el halo no se recorte.
export interface Sprite {
  canvas: HTMLCanvasElement
  pad: number // px de margen alrededor del contenido (≥ 2 × glow del skin)
}

// Claves de sprite (una entrada por variante visual distinta)
export type SpriteKey =
  | `car:${number}:${1 | -1}` // fila (color) : sentido (parabrisas)
  | `truck:${number}:${1 | -1}` // ancho en celdas : sentido (cabina)
  | `log:${number}` // ancho en celdas
  | 'turtle:up'
  | 'turtle:under' // celda de tortuga visible / sumergida
  | `frog:${Direction}:${0 | 1}` // orientación : saltando
  | 'life' // icono de vida del HUD

export interface FroggerSpriteCache {
  skin: SkinId
  background: HTMLCanvasElement // 800×600: bezel, zonas, separadores, bocas vacías, etiquetas fijas del HUD
  scanlines: HTMLCanvasElement | null // 800×600, solo si palette.scanlines
  sprites: Map<SpriteKey, Sprite>
}

function createLayer(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  return [canvas, canvas.getContext('2d')!]
}

/** Capa estática: todo lo que draw() pintaba igual en cada frame. */
function drawBackground(ctx: CanvasRenderingContext2D, C: Colors) {
  ctx.fillStyle = C.bezel
  ctx.fillRect(0, 0, W, H)

  ctx.save()
  ctx.translate(OFFSET_X, OFFSET_Y)
  ctx.beginPath()
  ctx.rect(0, 0, CANVAS_W, CANVAS_H)
  ctx.clip()

  // Fondo por zonas
  for (let row = 0; row < ROWS; row++) {
    ctx.fillStyle =
      row === ROW_GOALS ? C.goalsBg : isRiverRow(row) ? C.river : isRoadRow(row) ? C.road : C.safe
    ctx.fillRect(0, row * CELL, CANVAS_W, CELL)
  }
  // Separadores de carril de carretera
  ctx.strokeStyle = C.laneLine
  ctx.lineWidth = 2
  ctx.setLineDash([16, 12])
  for (let row = ROW_ROAD_TOP + 1; row <= ROW_ROAD_BOT; row++) {
    ctx.beginPath()
    ctx.moveTo(0, row * CELL)
    ctx.lineTo(CANVAS_W, row * CELL)
    ctx.stroke()
  }
  ctx.setLineDash([])

  // Bocas destino (vacías; las ranas que las ocupan se dibujan encima cada frame)
  for (const c of GOAL_COLS) {
    const gx = c * CELL
    ctx.fillStyle = C.goalMouth
    ctx.fillRect(gx + 3, ROW_GOALS * CELL + 3, CELL * 2 - 6, CELL - 6)
    ctx.strokeStyle = C.goalBorder
    ctx.lineWidth = 2
    setGlow(ctx, C, C.goalBorder)
    ctx.strokeRect(gx + 3, ROW_GOALS * CELL + 3, CELL * 2 - 6, CELL - 6)
    clearGlow(ctx)
  }
  ctx.restore()

  // Etiquetas fijas del HUD interno (los valores son dinámicos)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = C.hudLabel
  ctx.font = 'bold 11px monospace'
  ctx.fillText('SCORE', OFFSET_X / 2, 48)
  ctx.fillText('NIVEL', OFFSET_X / 2, 112)
  ctx.fillText('VIDAS', W - OFFSET_X / 2, 48)
}

/** Scanlines (Retro): líneas horizontales semitransparentes sobre todo el frame. */
function drawScanlines(ctx: CanvasRenderingContext2D, C: Colors) {
  ctx.fillStyle = C.scanline
  for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1)
}

// ── Entidades ──────────────────────────────────────────────────────────────
// El dibujo es el mismo que hacía drawEntity() en cada frame; ahora se ejecuta
// una vez por variante y skin, dentro de un canvas offscreen.
export type EntityType = 'car' | 'truck' | 'log' | 'turtle'
type BodyType = Exclude<EntityType, 'turtle'>

function drawWheels(ctx: CanvasRenderingContext2D, C: Colors, x: number, y: number, w: number) {
  ctx.fillStyle = C.wheel
  for (const wx of [x + 8, x + w - 8]) {
    for (const wy of [y + 7, y + CELL - 7]) {
      ctx.beginPath()
      ctx.arc(wx, wy, 4, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

/** Coche, camión o tronco de `width` celdas con esquina superior izquierda en (x, y). */
function paintBody(
  ctx: CanvasRenderingContext2D,
  C: Colors,
  type: BodyType,
  width: number,
  dir: 1 | -1,
  row: number,
  x: number,
  y: number,
) {
  const w = width * CELL
  if (type === 'car') {
    drawWheels(ctx, C, x + 2, y, w - 4)
    const body = C.carColors[row] ?? C.car
    ctx.fillStyle = body
    setGlow(ctx, C, body)
    roundRect(ctx, x + 3, y + 9, w - 6, CELL - 18, 5)
    ctx.fill()
    clearGlow(ctx)
    // parabrisas hacia el sentido de la marcha
    ctx.fillStyle = C.windshield
    const wsX = dir === 1 ? x + w - 14 : x + 8
    ctx.fillRect(wsX, y + 13, 6, CELL - 26)
  } else if (type === 'truck') {
    drawWheels(ctx, C, x + 2, y, w - 4)
    const cabW = 26
    const cabX = dir === 1 ? x + w - cabW - 3 : x + 3
    const boxX = dir === 1 ? x + 3 : x + 3 + cabW + 3
    ctx.fillStyle = C.truck
    setGlow(ctx, C, C.truck)
    ctx.fillRect(boxX, y + 7, w - cabW - 9, CELL - 14)
    ctx.fillStyle = C.truckCab
    roundRect(ctx, cabX, y + 9, cabW, CELL - 18, 4)
    ctx.fill()
    clearGlow(ctx)
  } else {
    ctx.fillStyle = C.log
    setGlow(ctx, C, C.log)
    roundRect(ctx, x + 2, y + 6, w - 4, CELL - 12, 12)
    ctx.fill()
    clearGlow(ctx)
    ctx.strokeStyle = C.logLine
    ctx.lineWidth = 2
    for (const ly of [y + 14, y + 20, y + 26]) {
      ctx.beginPath()
      ctx.moveTo(x + 12, ly)
      ctx.lineTo(x + w - 12, ly)
      ctx.stroke()
    }
  }
}

/** Una celda de tortuga centrada en (cx, cy): visible con escamas o sumergida. */
function paintTurtleCell(
  ctx: CanvasRenderingContext2D,
  C: Colors,
  submerged: boolean,
  cx: number,
  cy: number,
) {
  if (submerged) {
    ctx.strokeStyle = C.turtleUnder
    ctx.globalAlpha = 0.35
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(cx, cy, 15, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 1
    return
  }
  ctx.fillStyle = C.turtle
  setGlow(ctx, C, C.turtle)
  ctx.beginPath()
  ctx.arc(cx, cy, 15, 0, Math.PI * 2)
  ctx.fill()
  clearGlow(ctx)
  // patrón de escamas
  ctx.fillStyle = C.turtleScale
  ctx.beginPath()
  ctx.arc(cx, cy, 5, 0, Math.PI * 2)
  ctx.fill()
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3
    ctx.beginPath()
    ctx.arc(cx + Math.cos(a) * 9.5, cy + Math.sin(a) * 9.5, 3, 0, Math.PI * 2)
    ctx.fill()
  }
}

// Claves de sprite precalculadas: las búsquedas por frame no crean strings.
// Índices: [sentido (0 = -1, 1 = +1)][fila o ancho en celdas].
const keyTable = <K extends SpriteKey>(n: number, make: (i: number) => K): K[] =>
  Array.from({ length: n }, (_, i) => make(i))
const CAR_KEYS = [
  keyTable(ROWS, (r) => `car:${r}:-1` as const),
  keyTable(ROWS, (r) => `car:${r}:1` as const),
]
const TRUCK_KEYS = [
  keyTable(COLS + 1, (w) => `truck:${w}:-1` as const),
  keyTable(COLS + 1, (w) => `truck:${w}:1` as const),
]
const LOG_KEYS = keyTable(COLS + 1, (w) => `log:${w}` as const)
const FROG_KEYS: Record<Direction, [SpriteKey, SpriteKey]> = {
  up: ['frog:up:0', 'frog:up:1'],
  down: ['frog:down:0', 'frog:down:1'],
  left: ['frog:left:0', 'frog:left:1'],
  right: ['frog:right:0', 'frog:right:1'],
}

/** Margen del sprite: ≥ 2 × glow para que el halo de Neón no se recorte. */
const spritePad = (C: Colors) => Math.ceil(C.glow * 2) + 2

/** Sprite de `wCells` × 1 celdas; `paint` recibe la esquina superior izquierda del contenido. */
function makeSprite(
  C: Colors,
  wCells: number,
  paint: (ctx: CanvasRenderingContext2D, x: number, y: number) => void,
): Sprite {
  const pad = spritePad(C)
  const [canvas, ctx] = createLayer(wCells * CELL + 2 * pad, CELL + 2 * pad)
  paint(ctx, pad, pad)
  return { canvas, pad }
}

/** Sprite de coche, camión o tronco; se crea la primera vez que se pide. */
export function bodySprite(
  cache: FroggerSpriteCache,
  C: Colors,
  type: BodyType,
  width: number,
  dir: 1 | -1,
  row: number,
): Sprite {
  const d = dir === 1 ? 1 : 0
  const key =
    type === 'car' ? CAR_KEYS[d][row] : type === 'truck' ? TRUCK_KEYS[d][width] : LOG_KEYS[width]
  let sprite = cache.sprites.get(key)
  if (!sprite) {
    sprite = makeSprite(C, width, (ctx, x, y) => paintBody(ctx, C, type, width, dir, row, x, y))
    cache.sprites.set(key, sprite)
  }
  return sprite
}

/** Sprite de una celda de tortuga (visible o sumergida); se crea la primera vez que se pide. */
export function turtleSprite(cache: FroggerSpriteCache, C: Colors, submerged: boolean): Sprite {
  const key: SpriteKey = submerged ? 'turtle:under' : 'turtle:up'
  let sprite = cache.sprites.get(key)
  if (!sprite) {
    sprite = makeSprite(C, 1, (ctx, x, y) =>
      paintTurtleCell(ctx, C, submerged, x + CELL / 2, y + CELL / 2),
    )
    cache.sprites.set(key, sprite)
  }
  return sprite
}

// ── Rana y vidas ───────────────────────────────────────────────────────────
const FACING_ANGLE: Record<Direction, number> = {
  up: 0,
  right: Math.PI / 2,
  down: Math.PI,
  left: -Math.PI / 2,
}

/** Rana centrada en (cx, cy), mirando "arriba" antes de rotar. Cabe en una celda. */
function paintFrog(
  ctx: CanvasRenderingContext2D,
  C: Colors,
  cx: number,
  cy: number,
  facing: Direction,
  jumping: boolean,
) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(FACING_ANGLE[facing])

  // patas: extendidas durante el salto, recogidas en reposo
  ctx.strokeStyle = C.frogDark
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  const reach = jumping ? 17 : 12
  const legs: [number, number, number, number][] = [
    [-10, -6, -reach, jumping ? -16 : -11],
    [10, -6, reach, jumping ? -16 : -11],
    [-10, 6, -reach, jumping ? 17 : 12],
    [10, 6, reach, jumping ? 17 : 12],
  ]
  for (const [x1, y1, x2, y2] of legs) {
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }

  // cuerpo: elipse 28×24
  ctx.fillStyle = C.frog
  setGlow(ctx, C, C.frog)
  ctx.beginPath()
  ctx.ellipse(0, 0, 14, 12, 0, 0, Math.PI * 2)
  ctx.fill()
  clearGlow(ctx)

  // ojos
  for (const ex of [-6, 6]) {
    ctx.fillStyle = C.eye
    ctx.beginPath()
    ctx.arc(ex, -8, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = C.pupil
    ctx.beginPath()
    ctx.arc(ex, -9, 2, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

/**
 * Sprite de rana de 1×1 celdas (8 variantes: orientación × saltando); se crea
 * la primera vez que se pide. El centro de la rana está en (pad + CELL/2, pad + CELL/2).
 */
export function frogSprite(
  cache: FroggerSpriteCache,
  C: Colors,
  facing: Direction,
  jumping: boolean,
): Sprite {
  const key = FROG_KEYS[facing][jumping ? 1 : 0]
  let sprite = cache.sprites.get(key)
  if (!sprite) {
    sprite = makeSprite(C, 1, (ctx, x, y) =>
      paintFrog(ctx, C, x + CELL / 2, y + CELL / 2, facing, jumping),
    )
    cache.sprites.set(key, sprite)
  }
  return sprite
}

/** Radio del icono de vida del HUD (px). */
export const LIFE_R = 8

/** Icono de vida: círculo con el color de la rana (y glow en Neón), centro en (pad + LIFE_R, pad + LIFE_R). */
export function lifeSprite(cache: FroggerSpriteCache, C: Colors): Sprite {
  let sprite = cache.sprites.get('life')
  if (!sprite) {
    const pad = spritePad(C)
    const [canvas, ctx] = createLayer(LIFE_R * 2 + 2 * pad, LIFE_R * 2 + 2 * pad)
    ctx.fillStyle = C.frog
    setGlow(ctx, C, C.frog)
    ctx.beginPath()
    ctx.arc(pad + LIFE_R, pad + LIFE_R, LIFE_R, 0, Math.PI * 2)
    ctx.fill()
    clearGlow(ctx)
    sprite = { canvas, pad }
    cache.sprites.set('life', sprite)
  }
  return sprite
}

/** Construye la caché de un skin. Llamar solo en cliente (usa document). */
export function buildFroggerSprites(C: Colors, skin: SkinId): FroggerSpriteCache {
  const [background, bgCtx] = createLayer(W, H)
  drawBackground(bgCtx, C)

  let scanlines: HTMLCanvasElement | null = null
  if (C.scanlines) {
    const [layer, slCtx] = createLayer(W, H)
    drawScanlines(slCtx, C)
    scanlines = layer
  }

  return { skin, background, scanlines, sprites: new Map() }
}
