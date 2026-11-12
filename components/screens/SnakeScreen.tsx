'use client'

import { useEffect, useRef, useState } from 'react'
import type { Route, User, SavedScore } from '@/lib/types'
import { DEFAULT_SKIN, type GamePalette, type SkinId } from '@/lib/skins'
import { snakeSkins } from '@/lib/skins/snake'
import TouchControls from '@/components/TouchControls'
import TouchToggle from '@/components/TouchToggle'

// ── Constants ──────────────────────────────────────────────────────────────
const W = 800
const H = 600
const COLS = 40
const ROWS = 30
const CELL = 20
const BASE_INTERVAL = 150
const MIN_INTERVAL = 60
const SPEED_STEP = 5
const PTS = 10

const ex = (p: GamePalette, key: string) => p.extra[key] as string

// ── Sprite atlas (from references/source-assets/snake-assets/sprites.js) ──
type Sprite = { x: number; y: number; w: number; h: number }

const FRUITS: Sprite[] = [
  { x: 34, y: 136, w: 110, h: 160 }, // banana
  { x: 186, y: 136, w: 150, h: 160 }, // orange
  { x: 378, y: 136, w: 110, h: 160 }, // grape
  { x: 540, y: 136, w: 130, h: 160 }, // garlic
  { x: 712, y: 136, w: 130, h: 160 }, // eggplant
  { x: 894, y: 136, w: 110, h: 160 }, // strawberry
  { x: 1066, y: 136, w: 110, h: 160 }, // cherry
  { x: 1228, y: 136, w: 130, h: 160 }, // carrot
  { x: 1400, y: 136, w: 130, h: 160 }, // mushroom
  { x: 1582, y: 136, w: 110, h: 160 }, // broccoli
  { x: 1734, y: 136, w: 150, h: 160 }, // watermelon
  { x: 1906, y: 136, w: 150, h: 160 }, // pepper
  { x: 2068, y: 136, w: 170, h: 160 }, // kiwi
  { x: 2250, y: 136, w: 140, h: 160 }, // lemon
  { x: 2432, y: 136, w: 130, h: 160 }, // peach
  { x: 2604, y: 136, w: 130, h: 160 }, // peanut
  { x: 2786, y: 136, w: 110, h: 160 }, // apple
  { x: 2948, y: 136, w: 130, h: 160 }, // tomato
  { x: 3110, y: 136, w: 150, h: 160 }, // berries
  { x: 3302, y: 136, w: 110, h: 160 }, // grapes2
  { x: 3454, y: 136, w: 150, h: 160 }, // pineapple
  { x: 3637, y: 136, w: 130, h: 160 }, // melon
]

// ── Types ──────────────────────────────────────────────────────────────────
type Dir = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
type Cell = { col: number; row: number }
type FruitState = { col: number; row: number; sprite: Sprite }

const OPPOSITE: Record<Dir, Dir> = {
  UP: 'DOWN',
  DOWN: 'UP',
  LEFT: 'RIGHT',
  RIGHT: 'LEFT',
}

function mkFruit(snake: Cell[]): FruitState {
  let col: number, row: number
  do {
    col = Math.floor(Math.random() * COLS)
    row = Math.floor(Math.random() * ROWS)
  } while (snake.some((s) => s.col === col && s.row === row))
  return { col, row, sprite: FRUITS[Math.floor(Math.random() * FRUITS.length)] }
}

function mkSnake(): Cell[] {
  return [
    { col: 20, row: 15 },
    { col: 19, row: 15 },
    { col: 18, row: 15 },
  ]
}

function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
  ctx.fill()
}

// ── Component ──────────────────────────────────────────────────────────────
interface Props {
  navigate: (r: Route) => void
  user: User | null
  onSaveScore: (entry: SavedScore) => void
  skin?: SkinId
}

export default function SnakeScreen({ navigate, user, onSaveScore, skin = DEFAULT_SKIN }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const imgReadyRef = useRef(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const snakeRef = useRef<Cell[]>(mkSnake())
  const dirRef = useRef<Dir>('RIGHT')
  const pendingDirRef = useRef<Dir>('RIGHT')
  const fruitRef = useRef<FruitState>(mkFruit(snakeRef.current))
  const intervalMsRef = useRef(BASE_INTERVAL)
  const scoreRef = useRef(0)
  const overRef = useRef(false)
  const pausedRef = useRef(false)
  // Paleta leída en draw(): cambiar de skin no reinicia la partida.
  const paletteRef = useRef<GamePalette>(snakeSkins[skin])
  const p = snakeSkins[skin]

  const [score, setScore] = useState(0)
  const [snakeLen, setSnakeLen] = useState(3)
  const [over, setOver] = useState(false)
  const [paused, setPaused] = useState(false)
  const [name, setName] = useState(user?.name ?? 'INVITADO')
  const [saved, setSaved] = useState(false)

  function draw() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const pal = paletteRef.current

    ctx.fillStyle = pal.bg
    ctx.fillRect(0, 0, W, H)

    ctx.strokeStyle = pal.grid
    ctx.lineWidth = 0.5
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath()
      ctx.moveTo(c * CELL, 0)
      ctx.lineTo(c * CELL, H)
      ctx.stroke()
    }
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath()
      ctx.moveTo(0, r * CELL)
      ctx.lineTo(W, r * CELL)
      ctx.stroke()
    }

    const fruit = fruitRef.current
    const fx = fruit.col * CELL
    const fy = fruit.row * CELL
    if (ex(pal, 'fruitSprite') === 'yes' && imgReadyRef.current && imgRef.current) {
      const { x, y, w, h } = fruit.sprite
      ctx.drawImage(imgRef.current, x, y, w, h, fx + 1, fy + 1, CELL - 2, CELL - 2)
    } else {
      ctx.fillStyle = pal.danger
      ctx.shadowBlur = pal.glow
      ctx.shadowColor = pal.danger
      if (pal.scanlines) {
        // Retro: fruta como bloque de píxeles
        ctx.fillRect(fx + 4, fy + 4, CELL - 8, CELL - 8)
      } else {
        ctx.beginPath()
        ctx.arc(fx + CELL / 2, fy + CELL / 2, CELL / 2 - 2, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.shadowBlur = 0
    }

    const snake = snakeRef.current
    for (let i = 0; i < snake.length; i++) {
      const { col, row } = snake[i]
      ctx.fillStyle = i === 0 ? pal.fg : pal.accent
      ctx.shadowBlur = pal.glow
      ctx.shadowColor = i === 0 ? pal.fg : pal.accent
      fillRoundRect(ctx, col * CELL + 1, row * CELL + 1, CELL - 2, CELL - 2, i === 0 ? 5 : 3)
    }
    ctx.shadowBlur = 0

    if (pal.scanlines) {
      ctx.fillStyle = ex(pal, 'scanline')
      for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1)
    }
  }

  function scheduleInterval(ms: number) {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(tick, ms)
  }

  function tick() {
    if (overRef.current || pausedRef.current) return

    dirRef.current = pendingDirRef.current

    const snake = snakeRef.current
    const head = snake[0]
    let nc = head.col
    let nr = head.row

    if (dirRef.current === 'UP') nr--
    else if (dirRef.current === 'DOWN') nr++
    else if (dirRef.current === 'LEFT') nc--
    else nc++

    // Wrap-around
    nc = ((nc % COLS) + COLS) % COLS
    nr = ((nr % ROWS) + ROWS) % ROWS

    // Self collision — skip tail since it will vacate
    if (snake.slice(0, -1).some((s) => s.col === nc && s.row === nr)) {
      overRef.current = true
      if (intervalRef.current) clearInterval(intervalRef.current)
      draw()
      setOver(true)
      return
    }

    const ate = nc === fruitRef.current.col && nr === fruitRef.current.row
    const newSnake: Cell[] = [{ col: nc, row: nr }, ...snake]
    if (!ate) newSnake.pop()
    snakeRef.current = newSnake

    if (ate) {
      const ns = scoreRef.current + PTS
      scoreRef.current = ns
      setScore(ns)
      setSnakeLen(newSnake.length)
      fruitRef.current = mkFruit(newSnake)

      const newMs = Math.max(MIN_INTERVAL, intervalMsRef.current - SPEED_STEP)
      if (newMs !== intervalMsRef.current) {
        intervalMsRef.current = newMs
        scheduleInterval(newMs)
      }
    }

    draw()
  }

  function togglePause() {
    if (overRef.current) return
    const next = !pausedRef.current
    pausedRef.current = next
    setPaused(next)
  }

  function restartGame() {
    const snake = mkSnake()
    snakeRef.current = snake
    dirRef.current = 'RIGHT'
    pendingDirRef.current = 'RIGHT'
    fruitRef.current = mkFruit(snake)
    intervalMsRef.current = BASE_INTERVAL
    scoreRef.current = 0
    overRef.current = false
    pausedRef.current = false
    setScore(0)
    setSnakeLen(snake.length)
    setOver(false)
    setPaused(false)
    setSaved(false)
    setName(user?.name ?? 'INVITADO')
    scheduleInterval(BASE_INTERVAL)
    draw()
  }

  useEffect(() => {
    paletteRef.current = snakeSkins[skin]
    // Repinta al instante (también en pausa o game over) sin tocar el intervalo.
    draw()
  }, [skin])

  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      imgReadyRef.current = true
      draw()
    }
    img.src = '/snake-fruits.png'
    imgRef.current = img

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        e.preventDefault()
        if (overRef.current) return
        const next = !pausedRef.current
        pausedRef.current = next
        setPaused(next)
        return
      }
      const map: Partial<Record<string, Dir>> = {
        ArrowUp: 'UP',
        ArrowDown: 'DOWN',
        ArrowLeft: 'LEFT',
        ArrowRight: 'RIGHT',
      }
      const nextDir = map[e.key]
      if (!nextDir) return
      e.preventDefault()
      if (nextDir !== OPPOSITE[dirRef.current]) {
        pendingDirRef.current = nextDir
      }
    }

    window.addEventListener('keydown', onKeyDown)
    draw()
    intervalRef.current = setInterval(tick, intervalMsRef.current)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="av-player fade-in">
      <div
        className="player-hud"
        style={{ background: ex(p, 'hudBg'), borderColor: ex(p, 'hudBorder') }}
      >
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="hud-stat">
            <div className="l" style={{ color: ex(p, 'hudLabel') }}>
              Puntuación
            </div>
            <div className="v" style={{ color: p.text, textShadow: ex(p, 'hudValueShadow') }}>
              {score.toLocaleString('es-ES')}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l" style={{ color: ex(p, 'hudLabel') }}>
              Longitud
            </div>
            <div className="v" style={{ color: p.text, textShadow: ex(p, 'hudValueShadow') }}>
              {snakeLen}
            </div>
          </div>
        </div>
        <div className="hud-actions">
          <TouchToggle />
          <button className="btn yellow" onClick={togglePause}>
            {paused ? 'REANUDAR' : 'PAUSA'}
          </button>
          <button className="btn ghost" onClick={() => navigate({ name: 'detalle', id: 'snake' })}>
            SALIR
          </button>
        </div>
      </div>

      <div
        className="game-stage"
        style={{ '--stage-ar': 800 / 600, '--stage-max-w': '800px' } as React.CSSProperties}
      >
        <div className="game-canvas" style={{ aspectRatio: '800 / 600' }}>
          <canvas ref={canvasRef} width={800} height={600} />
        </div>
        <TouchControls game="snake" color="green" onPause={togglePause} disabled={over} />
      </div>

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
            {!saved ? (
              <form
                className="input-row"
                onSubmit={(e) => {
                  e.preventDefault()
                  onSaveScore({ game: 'snake', score, name, at: Date.now() })
                  setSaved(true)
                }}
              >
                <input
                  value={name}
                  maxLength={10}
                  onChange={(e) => setName(e.target.value.toUpperCase().slice(0, 10))}
                  placeholder="TUS INICIALES"
                  autoCapitalize="characters"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="done"
                />
                <button type="submit" className="btn yellow">
                  GUARDAR PUNTUACIÓN
                </button>
              </form>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            <div className="actions">
              <button className="btn" onClick={restartGame}>
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
