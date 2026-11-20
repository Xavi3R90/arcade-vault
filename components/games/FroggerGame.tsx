'use client'

import { useEffect, useRef } from 'react'
import { DEFAULT_SKIN, type GamePalette, type SkinId } from '@/lib/skins'
import { froggerSkins } from '@/lib/skins/frogger'
// Geometría, tipos de dibujo y caché de render (SPEC 11) viven en froggerSprites.ts.
import {
  CANVAS_H,
  CANVAS_W,
  CELL,
  COLS,
  GOAL_COLS,
  H,
  OFFSET_X,
  OFFSET_Y,
  ROW_GOALS,
  ROW_START,
  ROWS,
  W,
  LIFE_R,
  bodySprite,
  buildFroggerSprites,
  clearGlow,
  frogSprite,
  isRiverRow,
  isRoadRow,
  lifeSprite,
  setGlow,
  turtleSprite,
  type Colors,
  type Direction,
  type FroggerSpriteCache,
} from './froggerSprites'

// ── Types (locales, no exportados) ─────────────────────────────────────────

interface Lane {
  row: number
  speed: number
  dir: 1 | -1
  entities: Entity[]
}

interface Entity {
  col: number
  width: number
  type: 'car' | 'truck' | 'log' | 'turtle'
  submerged?: boolean
  /** Sólo tortugas: ms transcurridos dentro de su ciclo de inmersión (independiente por grupo). */
  diveT?: number
}

interface Frog {
  col: number
  row: number
  animating: boolean
  animT: number
  targetCol: number
  targetRow: number
}

// ── Lanes ──────────────────────────────────────────────────────────────────
// Ciclo de inmersión de las tortugas: 3 s visibles → 1.5 s bajo el agua.
const TURTLE_VISIBLE_MS = 3000
const TURTLE_UNDER_MS = 1500
const TURTLE_CYCLE_MS = TURTLE_VISIBLE_MS + TURTLE_UNDER_MS
// Cada nivel incrementa todas las velocidades un 15 % (lineal sobre la base).
const LEVEL_SPEED_STEP = 0.15

interface LaneSpec {
  row: number
  speed: number // px/frame a nivel 1
  dir: 1 | -1
  type: Entity['type']
  width: number // celdas por entidad
  count: number
}

// Carretera (filas 8–12): 1.5–4 px/frame, sentidos alternos, vehículos de 1–3 celdas.
const ROAD_LANES: LaneSpec[] = [
  { row: 12, speed: 1.5, dir: -1, type: 'car', width: 1, count: 3 },
  { row: 11, speed: 2.2, dir: 1, type: 'car', width: 1, count: 3 },
  { row: 10, speed: 1.8, dir: -1, type: 'truck', width: 2, count: 3 },
  { row: 9, speed: 4, dir: 1, type: 'car', width: 1, count: 2 },
  { row: 8, speed: 2.6, dir: -1, type: 'truck', width: 3, count: 2 },
]

// Río (filas 1–6): 1–3 px/frame, troncos de 2–4 celdas, tortugas en grupos de 2–3.
const RIVER_LANES: LaneSpec[] = [
  { row: 6, speed: 1, dir: 1, type: 'log', width: 3, count: 3 },
  { row: 5, speed: 1.5, dir: -1, type: 'turtle', width: 3, count: 4 },
  { row: 4, speed: 2, dir: 1, type: 'log', width: 4, count: 3 },
  { row: 3, speed: 3, dir: -1, type: 'log', width: 2, count: 4 },
  { row: 2, speed: 1.8, dir: 1, type: 'turtle', width: 2, count: 4 },
  { row: 1, speed: 1.2, dir: -1, type: 'log', width: 3, count: 3 },
]

/**
 * Reparte `count` entidades equidistantes a lo largo del bucle del carril.
 * El bucle mide COLS + width (una entidad sale por un borde y reentra por el
 * otro en `-width` o `COLS`), así que el hueco entre entidades es
 * (COLS + width) / count - width, siempre ≥ 1 celda con las tablas de arriba.
 */
function buildLane(spec: LaneSpec, level: number): Lane {
  const loop = COLS + spec.width
  const spacing = loop / spec.count
  const entities: Entity[] = []
  for (let i = 0; i < spec.count; i++) {
    const entity: Entity = { col: -spec.width + i * spacing, width: spec.width, type: spec.type }
    if (spec.type === 'turtle') {
      // Desfase por grupo para que no se sumerjan todas a la vez.
      entity.diveT = (i * TURTLE_CYCLE_MS) / spec.count
      entity.submerged = entity.diveT >= TURTLE_VISIBLE_MS
    }
    entities.push(entity)
  }
  return {
    row: spec.row,
    speed: spec.speed * (1 + LEVEL_SPEED_STEP * (level - 1)),
    dir: spec.dir,
    entities,
  }
}

/**
 * Carriles de un nivel y su índice fila → carril (null en filas sin carril:
 * metas, mediana segura y salida). El índice evita búsquedas con closures en
 * cada frame (SPEC 11).
 */
function buildLanes(level: number): { lanes: Lane[]; laneByRow: (Lane | null)[] } {
  const lanes = [...ROAD_LANES, ...RIVER_LANES].map((spec) => buildLane(spec, level))
  const laneByRow: (Lane | null)[] = new Array(ROWS).fill(null)
  for (const lane of lanes) laneByRow[lane.row] = lane
  return { lanes, laneByRow }
}

// ── Component ──────────────────────────────────────────────────────────────
interface FroggerGameProps {
  paused: boolean
  onScoreChange: (score: number) => void
  onLivesChange: (lives: number) => void
  onLevelChange: (level: number) => void
  onGameOver: (finalScore: number) => void
  skin?: SkinId
}

// ── Game rules ─────────────────────────────────────────────────────────────
const JUMP_MS = 120
const START_LIVES = 3
const BASE_ROUND_S = 15
const MIN_ROUND_S = 8 // el temporizador baja 1 s por nivel hasta este mínimo
const PTS_ROW = 10
const PTS_GOAL = 50
const PTS_ROUND = 200
const PTS_TIME_PER_S = 10
const MAX_DT = 50 // ms — evita saltos enormes al volver de otra pestaña

const START_COL = COLS / 2 - 1 // 7 — columna central

const DIR_DELTA: Record<Direction, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
}
const KEY_DIR: Partial<Record<string, Direction>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
}

const roundTimeMs = (level: number) => Math.max(MIN_ROUND_S, BASE_ROUND_S - (level - 1)) * 1000
/** Desplazamiento en celdas de un carril en `dt` ms (speed está en px/frame a 60 fps). */
const laneStep = (lane: Lane, dt: number) => (lane.speed * lane.dir * dt) / 16 / CELL

function newFrog(): Frog {
  return {
    col: START_COL,
    row: ROW_START,
    animating: false,
    animT: 0,
    targetCol: START_COL,
    targetRow: ROW_START,
  }
}

interface GameState {
  lanes: Lane[]
  laneByRow: (Lane | null)[] // índice fila → carril (ver buildLanes)
  frog: Frog
  facing: Direction
  pendingDir: Direction | null
  goals: boolean[]
  score: number
  lives: number
  level: number
  timeMs: number
  bestRow: number // fila más alta alcanzada en la ronda (para +10 por celda nueva)
  over: boolean
}

function createState(): GameState {
  return {
    ...buildLanes(1),
    frog: newFrog(),
    facing: 'up',
    pendingDir: null,
    goals: GOAL_COLS.map(() => false),
    score: 0,
    lives: START_LIVES,
    level: 1,
    timeMs: roundTimeMs(1),
    bestRow: ROW_START,
    over: false,
  }
}

// ── Collisions (Paso 5) ────────────────────────────────────────────────────
// La rana ocupa [col, col + 1); se usa su centro (col + 0.5) para decidir en
// qué entidad / boca está, así un vehículo o tronco debe cubrir el centro.
const frogCenter = (frog: Frog) => frog.col + 0.5
const covers = (e: Entity, x: number) => x >= e.col && x < e.col + e.width

/** Primera entidad del carril que cubre la columna x, o null (bucle sin closures). */
function entityAt(lane: Lane, x: number): Entity | null {
  const es = lane.entities
  for (let i = 0; i < es.length; i++) if (covers(es[i], x)) return es[i]
  return null
}

function checkRoadCollision(frog: Frog, laneByRow: (Lane | null)[]): boolean {
  const lane = laneByRow[frog.row]
  if (!lane || !isRoadRow(lane.row)) return false
  return entityAt(lane, frogCenter(frog)) !== null
}

/** Entidad del río sobre la que está la rana, o null. Una tortuga sumergida no sirve de apoyo. */
function getSupport(frog: Frog, laneByRow: (Lane | null)[]): Entity | null {
  const lane = laneByRow[frog.row]
  if (!lane || !isRiverRow(lane.row)) return null
  const e = entityAt(lane, frogCenter(frog))
  if (!e || (e.type === 'turtle' && e.submerged === true)) return null
  return e
}

/**
 * Si la rana está en la fila de metas, marca la boca libre que le corresponde y
 * devuelve 'goal'. Boca ya ocupada o fuera de una boca → 'dead'. En otra fila → null.
 */
function checkGoal(frog: Frog, goals: boolean[]): 'goal' | 'dead' | null {
  if (frog.row !== ROW_GOALS) return null
  const x = frogCenter(frog)
  const i = GOAL_COLS.findIndex((c) => x >= c && x < c + 2)
  if (i === -1 || goals[i]) return 'dead'
  goals[i] = true
  return 'goal'
}

// ── Drawing ────────────────────────────────────────────────────────────────
function toColors(p: GamePalette): Colors {
  const x = (k: string) => p.extra[k] as string
  const cars = p.extra.carColors as string[]
  return {
    bezel: p.bg,
    goalsBg: x('goalsBg'),
    goalMouth: x('goalMouth'),
    goalBorder: p.accent,
    river: x('river'),
    safe: x('safe'),
    road: x('road'),
    laneLine: p.grid,
    wheel: x('wheel'),
    windshield: x('windshield'),
    truck: x('truck'),
    truckCab: x('truckCab'),
    log: x('log'),
    logLine: x('logLine'),
    turtle: x('turtle'),
    turtleScale: x('turtleScale'),
    turtleUnder: x('turtleUnder'),
    frog: p.fg,
    frogDark: x('frogDark'),
    eye: x('eye'),
    pupil: x('pupil'),
    hudLabel: x('hudLabel'),
    hudText: p.text,
    timeOk: x('timeOk'),
    timeWarn: x('timeWarn'),
    timeLow: x('timeLow'),
    car: p.danger,
    carColors: { 12: cars[0], 11: cars[1], 9: cars[2] },
    glow: p.glow,
    scanlines: p.scanlines,
    scanline: x('scanline'),
  }
}

// Texto de los números del HUD: el string solo se crea cuando el valor cambia
// (slot 0 = score, 1 = nivel), no en cada frame.
const hudCache: { value: number; text: string }[] = [
  { value: NaN, text: '' },
  { value: NaN, text: '' },
]
function hudNumber(value: number, slot: 0 | 1): string {
  const c = hudCache[slot]
  if (c.value !== value) {
    c.value = value
    c.text = String(value)
  }
  return c.text
}

function draw(ctx: CanvasRenderingContext2D, s: GameState, C: Colors, cache: FroggerSpriteCache) {
  // Capa estática pre-renderizada (SPEC 11): bezel, zonas, separadores, bocas
  // vacías y etiquetas del HUD.
  ctx.drawImage(cache.background, 0, 0)

  ctx.save()
  ctx.translate(OFFSET_X, OFFSET_Y)
  ctx.beginPath()
  ctx.rect(0, 0, CANVAS_W, CANVAS_H)
  ctx.clip()

  // Ranas en las bocas ya ocupadas: sprite frog:down:0 al 80 % de opacidad
  const goalFrog = frogSprite(cache, C, 'down', false)
  ctx.globalAlpha = 0.8
  for (let i = 0; i < GOAL_COLS.length; i++) {
    if (s.goals[i]) {
      // la boca ocupa 2 celdas; la rana se centra en ella (centro en c·CELL + CELL)
      const gx = GOAL_COLS[i] * CELL + CELL / 2
      ctx.drawImage(goalFrog.canvas, gx - goalFrog.pad, ROW_GOALS * CELL - goalFrog.pad)
    }
  }
  ctx.globalAlpha = 1

  // Entidades: sprites pre-renderizados (glow incluido), en x entera para evitar
  // el remuestreo bilineal de drawImage en posiciones fraccionarias.
  for (const lane of s.lanes) {
    const y = lane.row * CELL
    for (const e of lane.entities) {
      const x = Math.round(e.col * CELL)
      if (e.type === 'turtle') {
        const sp = turtleSprite(cache, C, e.submerged === true)
        for (let i = 0; i < e.width; i++) {
          ctx.drawImage(sp.canvas, x + i * CELL - sp.pad, y - sp.pad)
        }
      } else {
        const sp = bodySprite(cache, C, e.type, e.width, lane.dir, lane.row)
        ctx.drawImage(sp.canvas, x - sp.pad, y - sp.pad)
      }
    }
  }

  // Rana (interpolada durante el salto)
  const f = s.frog
  const t = f.animating ? Math.min(1, f.animT / JUMP_MS) : 0
  const fc = f.col + (f.targetCol - f.col) * t
  const fr = f.row + (f.targetRow - f.row) * t
  if (!s.over) {
    const sp = frogSprite(cache, C, s.facing, f.animating)
    ctx.drawImage(sp.canvas, Math.round(fc * CELL) - sp.pad, Math.round(fr * CELL) - sp.pad)
  }

  ctx.restore()

  // ── HUD interno (márgenes laterales del canvas 800×600) ──
  // Las etiquetas SCORE / NIVEL / VIDAS ya están en la capa de fondo.
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  const leftX = OFFSET_X / 2
  const rightX = W - OFFSET_X / 2

  ctx.fillStyle = C.hudText
  ctx.font = 'bold 16px monospace'
  ctx.fillText(hudNumber(s.score, 0), leftX, 70)
  ctx.fillText(hudNumber(s.level, 1), leftX, 134)

  // Vidas: icono pre-renderizado centrado en (rightX, 66 + i·24)
  const life = lifeSprite(cache, C)
  const lifeOff = life.pad + LIFE_R
  for (let i = 0; i < s.lives; i++) {
    ctx.drawImage(life.canvas, rightX - lifeOff, 66 + i * 24 - lifeOff)
  }

  // Barra de tiempo: franja inferior bajo el tablero, ancho proporcional
  const ratio = Math.max(0, s.timeMs / roundTimeMs(s.level))
  const timeColor = ratio > 0.5 ? C.timeOk : ratio > 0.25 ? C.timeWarn : C.timeLow
  ctx.fillStyle = timeColor
  setGlow(ctx, C, timeColor)
  ctx.fillRect(OFFSET_X, OFFSET_Y + CANVAS_H + 5, CANVAS_W * ratio, OFFSET_Y - 10)
  clearGlow(ctx)

  // Scanlines (Retro): capa pre-renderizada sobre todo el frame
  if (cache.scanlines) ctx.drawImage(cache.scanlines, 0, 0)
}

// ── Component ──────────────────────────────────────────────────────────────
export default function FroggerGame({
  paused,
  onScoreChange,
  onLivesChange,
  onLevelChange,
  onGameOver,
  skin = DEFAULT_SKIN,
}: FroggerGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pausedRef = useRef(paused)
  const callbacksRef = useRef({ onScoreChange, onLivesChange, onLevelChange, onGameOver })
  // Paleta leída en draw(): cambiar de skin no reinicia la partida.
  const colorsRef = useRef<Colors>(toColors(froggerSkins[skin]))
  // Caché de render del skin activo (SPEC 11). Se crea en cliente: necesita document.
  const spritesRef = useRef<FroggerSpriteCache | null>(null)
  // Repinta el último estado (útil en pausa y tras game over, cuando el RAF está detenido).
  const redrawRef = useRef<(() => void) | null>(null)
  // Reanuda el bucle RAF tras una pausa (SPEC 11: en pausa no se pide ningún frame).
  const resumeRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    pausedRef.current = paused
    if (!paused) resumeRef.current?.()
  }, [paused])

  useEffect(() => {
    colorsRef.current = toColors(froggerSkins[skin])
    spritesRef.current = buildFroggerSprites(colorsRef.current, skin)
    redrawRef.current?.()
  }, [skin])

  useEffect(() => {
    callbacksRef.current = { onScoreChange, onLivesChange, onLevelChange, onGameOver }
  }, [onScoreChange, onLivesChange, onLevelChange, onGameOver])

  useEffect(() => {
    // alpha: false — el bezel cubre todo el canvas; el navegador compone más rápido (SPEC 11).
    const ctx = canvasRef.current?.getContext('2d', { alpha: false })
    if (!ctx) return

    const s = createState()
    // spritesRef ya está construida: el efecto de `skin` se declara antes y corre primero.
    /** Compone el frame con la paleta y la caché del skin activo. */
    function paint() {
      const cache = spritesRef.current
      if (cache) draw(ctx!, s, colorsRef.current, cache)
    }
    // Últimos valores notificados: los callbacks sólo se llaman si el valor cambia.
    const reported = { score: s.score, lives: s.lives, level: s.level }
    let raf = 0
    let last = performance.now()

    /** Muerte por vehículo, agua, tortuga sumergida, borde del río, boca inválida o tiempo. */
    function killFrog() {
      if (s.over) return // varias causas en el mismo frame cuentan como una sola muerte
      s.lives -= 1
      report() // onLivesChange(lives) inmediato (y score, si cambió)
      if (s.lives === 0) {
        // onLivesChange(0) ya se ha disparado justo antes; el loop se detiene en frame().
        s.over = true
        callbacksRef.current.onGameOver(s.score)
        return
      }
      s.frog = newFrog()
      s.facing = 'up'
      s.pendingDir = null
      s.timeMs = roundTimeMs(s.level)
    }

    /** Las 5 bocas llenas: bonus de ronda y nivel siguiente (más rápido y con menos tiempo). */
    function completeRound() {
      s.score += PTS_ROUND
      s.frog = newFrog()
      s.facing = 'up'
      s.pendingDir = null
      s.goals = GOAL_COLS.map(() => false)
      s.level += 1 // report() dispara onLevelChange(level) en este mismo frame
      const next = buildLanes(s.level)
      s.lanes = next.lanes
      s.laneByRow = next.laneByRow
      s.timeMs = roundTimeMs(s.level)
      s.bestRow = ROW_START // los +10 por celda nueva son por ronda
    }

    /** Lógica al aterrizar en la celda destino de un salto. */
    function resolveLanding() {
      const f = s.frog
      if (f.row < s.bestRow) {
        s.bestRow = f.row
        s.score += PTS_ROW
      }
      // Vehículo y agua se comprueban cada frame en update(); aquí sólo la meta.
      const goal = checkGoal(f, s.goals)
      if (goal === 'dead') {
        killFrog()
      } else if (goal === 'goal') {
        s.score += PTS_GOAL + Math.floor(s.timeMs / 1000) * PTS_TIME_PER_S
        if (s.goals.every(Boolean)) {
          completeRound()
        } else {
          // Siguiente rana desde la base con el temporizador completo.
          s.frog = newFrog()
          s.facing = 'up'
          s.timeMs = roundTimeMs(s.level)
        }
      }
    }

    function update(dt: number) {
      // Entidades: avance + reentrada por el lado opuesto; ciclo de las tortugas
      for (const lane of s.lanes) {
        const step = laneStep(lane, dt)
        for (const e of lane.entities) {
          e.col += step
          if (lane.dir === 1 && e.col >= COLS) e.col -= COLS + e.width
          else if (lane.dir === -1 && e.col <= -e.width) e.col += COLS + e.width
          if (e.diveT !== undefined) {
            e.diveT = (e.diveT + dt) % TURTLE_CYCLE_MS
            e.submerged = e.diveT >= TURTLE_VISIBLE_MS
          }
        }
      }

      // Rana: input → salto de 1 celda con animación de 120 ms
      const f = s.frog
      if (!f.animating) {
        const dir = s.pendingDir
        s.pendingDir = null
        if (dir) {
          const [dc, dr] = DIR_DELTA[dir]
          s.facing = dir
          // Horizontal: se ajusta a los bordes laterales; vertical: no sale del tablero.
          const tc = Math.min(COLS - 1, Math.max(0, f.col + dc))
          const tr = f.row + dr
          if (tr >= ROW_GOALS && tr <= ROW_START && (tc !== f.col || tr !== f.row)) {
            f.animating = true
            f.animT = 0
            f.targetCol = tc
            f.targetRow = tr
          }
        }
      } else {
        f.animT += dt
        if (f.animT >= JUMP_MS) {
          f.col = f.targetCol
          f.row = f.targetRow
          f.animating = false
          f.animT = 0
          resolveLanding()
        }
      }

      // Río: la rana viaja con su soporte; sin soporte o fuera de los bordes muere
      if (!s.frog.animating && isRiverRow(s.frog.row)) {
        const lane = s.laneByRow[s.frog.row]
        const support = getSupport(s.frog, s.laneByRow)
        if (support && lane) s.frog.col += laneStep(lane, dt)
        if (!support || s.frog.col < 0 || s.frog.col > COLS - 1) killFrog()
      }

      // Carretera
      if (!s.frog.animating && isRoadRow(s.frog.row) && checkRoadCollision(s.frog, s.laneByRow)) {
        killFrog()
      }

      // Temporizador de ronda
      s.timeMs = Math.max(0, s.timeMs - dt)
      if (s.timeMs === 0) killFrog()
    }

    function report() {
      const cb = callbacksRef.current
      if (s.score !== reported.score) {
        reported.score = s.score
        cb.onScoreChange(s.score)
      }
      if (s.lives !== reported.lives) {
        reported.lives = s.lives
        cb.onLivesChange(s.lives)
      }
      if (s.level !== reported.level) {
        reported.level = s.level
        cb.onLevelChange(s.level)
      }
    }

    function frame(now: number) {
      raf = 0
      const dt = Math.min(MAX_DT, now - last)
      last = now
      if (!pausedRef.current && !s.over) {
        update(dt)
        report()
      }
      paint()
      // En pausa o game over el bucle se detiene tras este último draw();
      // resume() lo vuelve a arrancar al quitar la pausa.
      if (!pausedRef.current && !s.over) raf = requestAnimationFrame(frame)
    }
    redrawRef.current = paint
    resumeRef.current = () => {
      if (raf !== 0 || s.over) return
      last = performance.now() // sin salto de dt: la pausa no cuenta como tiempo de juego
      raf = requestAnimationFrame(frame)
    }

    // Sólo flechas; P / Esc no pausan el canvas (la pausa es de la plataforma).
    const onKeyDown = (e: KeyboardEvent) => {
      const dir = KEY_DIR[e.key]
      if (!dir) return
      e.preventDefault()
      if (e.repeat || pausedRef.current || s.over) return
      s.pendingDir = dir // se consume al terminar el salto en curso
    }

    document.addEventListener('keydown', onKeyDown)
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKeyDown)
      redrawRef.current = null
      resumeRef.current = null
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}
