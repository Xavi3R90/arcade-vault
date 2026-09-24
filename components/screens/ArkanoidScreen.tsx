'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Route, User, SavedScore } from '@/lib/types'

// ── Constants ──────────────────────────────────────────────────────────────
const W = 800
const H = 600
const PADDLE_SPEED = 400
const BLOCK_COLS = 10
const BLOCK_ROWS = 6
const BLOCK_W = 64
const BLOCK_H = 24
const BLOCKS_ORIGIN_X = (W - BLOCK_COLS * BLOCK_W) / 2
const BLOCKS_ORIGIN_Y = 80
const BASE_BALL_VX = 200
const BASE_BALL_VY = -300
const PAUSE_BTN_W = 60
const PAUSE_BTN_H = 40
const PAUSE_BTN_GAP = 12
const PAUSE_BTN_Y = 340
const PAUSE_BTN_ROW_X = (W - (5 * PAUSE_BTN_W + 4 * PAUSE_BTN_GAP)) / 2

// ── Levels ────────────────────────────────────────────────────────────────
interface LevelBlock {
  col: number
  row: number
  color: string
}
interface Level {
  speed: number
  blocks: LevelBlock[]
}

const LEVELS: Level[] = (() => {
  const rowColors1 = ['red', 'yellow', 'cyan', 'magenta', 'hotpink', 'green']
  const rowColors2 = ['gray', 'cyan', 'hotpink', 'yellow', 'magenta', 'green']
  const rowColors4 = ['cyan', 'magenta', 'green', 'yellow', 'hotpink', 'red']

  const l1: LevelBlock[] = []
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++) l1.push({ col, row, color: rowColors1[row] })

  const l2: LevelBlock[] = []
  const pyStart = [4, 3, 2, 1, 0, 0]
  const pyEnd = [5, 6, 7, 8, 9, 9]
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = pyStart[row]; col <= pyEnd[row]; col++)
      l2.push({ col, row, color: rowColors2[row] })

  const l3: LevelBlock[] = []
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++)
      if ((col + row) % 2 === 0) l3.push({ col, row, color: row < 3 ? 'yellow' : 'magenta' })

  const gaps4 = [
    [2, 5, 8],
    [0, 4, 7, 9],
    [1, 3, 6],
    [2, 5, 8, 9],
    [0, 4, 7],
    [1, 3, 6, 9],
  ]
  const l4: LevelBlock[] = []
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++)
      if (!gaps4[row].includes(col)) l4.push({ col, row, color: rowColors4[row] })

  const l5: LevelBlock[] = []
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++) {
      const isFrame = col === 0 || col === 9 || row === 0 || row === 5
      const isCross = col === 4 || row === 2
      if (isFrame || isCross) l5.push({ col, row, color: isCross && !isFrame ? 'hotpink' : 'cyan' })
    }

  return [
    { speed: 1.0, blocks: l1 },
    { speed: 1.1, blocks: l2 },
    { speed: 1.21, blocks: l3 },
    { speed: 1.33, blocks: l4 },
    { speed: 1.46, blocks: l5 },
  ]
})()

// ── Game State ─────────────────────────────────────────────────────────────
interface Block {
  x: number
  y: number
  w: number
  h: number
  color: string
  alive: boolean
}

interface GS {
  paddle: { x: number; y: number; w: number; h: number }
  ball: { x: number; y: number; w: number; h: number; vx: number; vy: number }
  blocks: Block[]
  lives: number
  score: number
  currentLevel: number
  state: 'playing' | 'gameover' | 'win'
}

function loadLevelInto(gs: GS, n: number) {
  gs.currentLevel = n
  const level = LEVELS[n - 1]
  gs.blocks = level.blocks.map((b) => ({
    x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
    y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
    w: BLOCK_W,
    h: BLOCK_H,
    color: b.color,
    alive: true,
  }))
  gs.ball.x = gs.paddle.x + (gs.paddle.w - gs.ball.w) / 2
  gs.ball.y = gs.paddle.y - gs.ball.h
  gs.ball.vx = BASE_BALL_VX * level.speed
  gs.ball.vy = BASE_BALL_VY * level.speed
}

function resetBall(gs: GS) {
  const speed = LEVELS[gs.currentLevel - 1].speed
  gs.ball.x = gs.paddle.x + (gs.paddle.w - gs.ball.w) / 2
  gs.ball.y = gs.paddle.y - gs.ball.h
  gs.ball.vx = BASE_BALL_VX * speed
  gs.ball.vy = BASE_BALL_VY * speed
}

function gInit(): GS {
  const gs: GS = {
    paddle: { x: 0, y: 560, w: 81, h: 14 },
    ball: { x: 0, y: 0, w: 16, h: 16, vx: 0, vy: 0 },
    blocks: [],
    lives: 3,
    score: 0,
    currentLevel: 1,
    state: 'playing',
  }
  gs.paddle.x = (W - gs.paddle.w) / 2
  loadLevelInto(gs, 1)
  return gs
}

// ── Component ──────────────────────────────────────────────────────────────
interface Props {
  navigate: (r: Route) => void
  user: User | null
  onSaveScore: (entry: SavedScore) => void
}

export default function ArkanoidScreen({ navigate, user, onSaveScore }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gsRef = useRef<GS>(gInit())
  const keysRef = useRef<Record<string, boolean>>({})
  const rafRef = useRef<number>(0)
  const pausedRef = useRef(false)
  const lastTimeRef = useRef<number | null>(null)
  const overSetRef = useRef(false)

  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [level, setLevel] = useState(1)
  const [paused, setPaused] = useState(false)
  const [over, setOver] = useState<'gameover' | 'win' | null>(null)
  const [name, setName] = useState(user?.name ?? 'INVITADO')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') e.preventDefault()
      keysRef.current[e.key] = true
      if (
        (e.key === 'p' || e.key === 'P' || e.key === 'Escape') &&
        gsRef.current.state === 'playing'
      ) {
        pausedRef.current = !pausedRef.current
        setPaused(pausedRef.current)
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key] = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const mx = (e.clientX - rect.left) * (W / rect.width)
      const gs = gsRef.current
      gs.paddle.x = Math.max(0, Math.min(W - gs.paddle.w, mx - gs.paddle.w / 2))
    }
    canvas.addEventListener('mousemove', onMouseMove)

    const onCanvasClick = (e: MouseEvent) => {
      if (!pausedRef.current) return
      const rect = canvas.getBoundingClientRect()
      const mx = (e.clientX - rect.left) * (W / rect.width)
      const my = (e.clientY - rect.top) * (H / rect.height)
      for (let i = 0; i < 5; i++) {
        const bx = PAUSE_BTN_ROW_X + i * (PAUSE_BTN_W + PAUSE_BTN_GAP)
        if (
          mx >= bx &&
          mx <= bx + PAUSE_BTN_W &&
          my >= PAUSE_BTN_Y &&
          my <= PAUSE_BTN_Y + PAUSE_BTN_H
        ) {
          const gs = gsRef.current
          loadLevelInto(gs, i + 1)
          pausedRef.current = false
          setPaused(false)
          setLevel(gs.currentLevel)
          return
        }
      }
    }
    canvas.addEventListener('click', onCanvasClick)

    const loop = (ts: number) => {
      const gs = gsRef.current
      const dt =
        lastTimeRef.current === null ? 0 : Math.min((ts - lastTimeRef.current) / 1000, 0.05)
      lastTimeRef.current = ts

      if (!pausedRef.current && gs.state === 'playing') {
        if (keysRef.current['ArrowLeft']) gs.paddle.x = Math.max(0, gs.paddle.x - PADDLE_SPEED * dt)
        if (keysRef.current['ArrowRight'])
          gs.paddle.x = Math.min(W - gs.paddle.w, gs.paddle.x + PADDLE_SPEED * dt)

        gs.ball.x += gs.ball.vx * dt
        gs.ball.y += gs.ball.vy * dt

        if (gs.ball.x <= 0) {
          gs.ball.x = 0
          gs.ball.vx = Math.abs(gs.ball.vx)
        }
        if (gs.ball.x + gs.ball.w >= W) {
          gs.ball.x = W - gs.ball.w
          gs.ball.vx = -Math.abs(gs.ball.vx)
        }
        if (gs.ball.y <= 0) {
          gs.ball.y = 0
          gs.ball.vy = Math.abs(gs.ball.vy)
        }

        if (
          gs.ball.vy > 0 &&
          gs.ball.x + gs.ball.w > gs.paddle.x &&
          gs.ball.x < gs.paddle.x + gs.paddle.w &&
          gs.ball.y + gs.ball.h >= gs.paddle.y &&
          gs.ball.y + gs.ball.h <= gs.paddle.y + gs.paddle.h + 8
        ) {
          gs.ball.y = gs.paddle.y - gs.ball.h
          gs.ball.vy = -Math.abs(gs.ball.vy)
        }

        for (const block of gs.blocks) {
          if (!block.alive) continue
          if (
            gs.ball.x < block.x + block.w &&
            gs.ball.x + gs.ball.w > block.x &&
            gs.ball.y < block.y + block.h &&
            gs.ball.y + gs.ball.h > block.y
          ) {
            block.alive = false
            gs.score += 10
            gs.ball.vy = -gs.ball.vy
            setScore(gs.score)
            if (gs.blocks.every((b) => !b.alive)) {
              if (gs.currentLevel < 5) {
                loadLevelInto(gs, gs.currentLevel + 1)
                setLevel(gs.currentLevel)
              } else {
                gs.state = 'win'
              }
            }
            break
          }
        }

        if (gs.ball.y > H) {
          gs.lives--
          if (gs.lives <= 0) {
            gs.lives = 0
            gs.state = 'gameover'
          } else {
            resetBall(gs)
          }
          setLives(gs.lives)
        }

        if ((gs.state === 'gameover' || gs.state === 'win') && !overSetRef.current) {
          overSetRef.current = true
          setOver(gs.state)
        }
      }

      // Draw
      ctx.fillStyle = '#0a0a0f'
      ctx.fillRect(0, 0, W, H)

      for (const block of gs.blocks) {
        if (!block.alive) continue
        ctx.fillStyle = block.color
        ctx.fillRect(block.x + 1, block.y + 1, block.w - 2, block.h - 2)
        ctx.fillStyle = 'rgba(255,255,255,0.2)'
        ctx.fillRect(block.x + 1, block.y + 1, block.w - 2, 5)
      }

      ctx.fillStyle = '#e0e0e0'
      ctx.beginPath()
      ctx.roundRect(gs.paddle.x, gs.paddle.y, gs.paddle.w, gs.paddle.h, 4)
      ctx.fill()

      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(gs.ball.x + gs.ball.w / 2, gs.ball.y + gs.ball.h / 2, gs.ball.w / 2, 0, Math.PI * 2)
      ctx.fill()

      if (pausedRef.current) {
        ctx.fillStyle = 'rgba(0,0,0,0.65)'
        ctx.fillRect(0, 0, W, H)

        ctx.fillStyle = '#fff'
        ctx.font = 'bold 56px monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('PAUSA', W / 2, 260)

        ctx.font = 'bold 16px monospace'
        ctx.fillText('Saltar al nivel:', W / 2, 310)

        for (let i = 0; i < 5; i++) {
          const bx = PAUSE_BTN_ROW_X + i * (PAUSE_BTN_W + PAUSE_BTN_GAP)
          const isActive = i + 1 === gs.currentLevel
          ctx.fillStyle = isActive ? '#f0c040' : '#444'
          ctx.strokeStyle = '#fff'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.roundRect(bx, PAUSE_BTN_Y, PAUSE_BTN_W, PAUSE_BTN_H, 6)
          ctx.fill()
          ctx.stroke()
          ctx.fillStyle = isActive ? '#000' : '#fff'
          ctx.font = 'bold 20px monospace'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(String(i + 1), bx + PAUSE_BTN_W / 2, PAUSE_BTN_Y + PAUSE_BTN_H / 2)
        }
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('click', onCanvasClick)
    }
  }, [])

  const togglePause = useCallback(() => {
    pausedRef.current = !pausedRef.current
    setPaused((p) => !p)
  }, [])

  const restartGame = useCallback(() => {
    gsRef.current = gInit()
    lastTimeRef.current = null
    keysRef.current = {}
    pausedRef.current = false
    overSetRef.current = false
    setScore(0)
    setLives(3)
    setLevel(1)
    setPaused(false)
    setOver(null)
    setSaved(false)
  }, [])

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString('es-ES')}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, '0')}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {Array.from({ length: Math.max(0, lives) }).map((_, i) => (
                <span key={i}>●</span>
              ))}
              {lives <= 0 && '—'}
            </div>
          </div>
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={togglePause}>
            {paused ? 'REANUDAR' : 'PAUSA'}
          </button>
          <button
            className="btn ghost"
            onClick={() => navigate({ name: 'detalle', id: 'arkanoid' })}
          >
            SALIR
          </button>
        </div>
      </div>

      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 800,
          margin: '0 auto',
          aspectRatio: '800 / 600',
        }}
      >
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      </div>

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>{over === 'win' ? '¡COMPLETASTE EL JUEGO!' : 'GAME OVER'}</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString('es-ES')}</div>
            {!saved ? (
              <div className="input-row">
                <input
                  value={name}
                  maxLength={10}
                  onChange={(e) => setName(e.target.value.toUpperCase().slice(0, 10))}
                  placeholder="TUS INICIALES"
                />
                <button
                  className="btn yellow"
                  onClick={() => {
                    onSaveScore({ game: 'arkanoid', score, name, at: Date.now() })
                    setSaved(true)
                  }}
                >
                  GUARDAR PUNTUACIÓN
                </button>
              </div>
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
