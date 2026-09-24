'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Route, SavedScore, User } from '@/lib/types'

// ── Constants ──────────────────────────────────────────────────────────────

const COLS = 10
const ROWS = 20
const BLOCK = 30

const COLORS: (string | null)[] = [
  null,
  '#4dd0e1', // I — cyan
  '#ffd54f', // O — yellow
  '#ba68c8', // T — purple
  '#81c784', // S — green
  '#e57373', // Z — red
  '#90caf9', // J — blue
  '#ffb74d', // L — orange
]

const PIECES: (number[][] | null)[] = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
]

const LINE_SCORES = [0, 100, 300, 500, 800]

// ── Types ──────────────────────────────────────────────────────────────────

interface Piece {
  type: number
  shape: number[][]
  x: number
  y: number
}

interface GS {
  board: number[][]
  current: Piece
  next: Piece
  score: number
  lines: number
  level: number
  dropInterval: number
  dropAccum: number
  lastTime: number
  over: boolean
}

// ── Pure game functions ────────────────────────────────────────────────────

function mkBoard(): number[][] {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0))
}

function mkPiece(): Piece {
  const type = Math.floor(Math.random() * 7) + 1
  const shape = PIECES[type]!.map((r) => [...r])
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 }
}

function fits(board: number[][], shape: number[][], ox: number, oy: number): boolean {
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue
      const nx = ox + c
      const ny = oy + r
      if (nx < 0 || nx >= COLS || ny >= ROWS) return false
      if (ny >= 0 && board[ny][nx]) return false
    }
  return true
}

function rotateCW(shape: number[][]): number[][] {
  const rows = shape.length
  const cols = shape[0].length
  const out = Array.from({ length: cols }, () => new Array(rows).fill(0))
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out[c][rows - 1 - r] = shape[r][c]
  return out
}

function ghostY(board: number[][], piece: Piece): number {
  let gy = piece.y
  while (fits(board, piece.shape, piece.x, gy + 1)) gy++
  return gy
}

function mergeInto(gs: GS) {
  const { current, board } = gs
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c]) board[current.y + r][current.x + c] = current.shape[r][c]
}

function sweepLines(gs: GS) {
  let cleared = 0
  for (let r = ROWS - 1; r >= 0; r--) {
    if (gs.board[r].every((v) => v !== 0)) {
      gs.board.splice(r, 1)
      gs.board.unshift(new Array(COLS).fill(0))
      cleared++
      r++
    }
  }
  if (cleared) {
    gs.lines += cleared
    gs.score += (LINE_SCORES[cleared] ?? 0) * gs.level
    gs.level = Math.floor(gs.lines / 10) + 1
    gs.dropInterval = Math.max(100, 1000 - (gs.level - 1) * 90)
  }
}

function spawnNext(gs: GS): boolean {
  gs.current = gs.next
  gs.next = mkPiece()
  return !fits(gs.board, gs.current.shape, gs.current.x, gs.current.y)
}

function lockPiece(gs: GS): boolean {
  mergeInto(gs)
  sweepLines(gs)
  return spawnNext(gs)
}

function tryRotate(gs: GS) {
  const rotated = rotateCW(gs.current.shape)
  for (const kick of [0, -1, 1, -2, 2]) {
    if (fits(gs.board, rotated, gs.current.x + kick, gs.current.y)) {
      gs.current.shape = rotated
      gs.current.x += kick
      return
    }
  }
}

function mkGs(): GS {
  return {
    board: mkBoard(),
    current: mkPiece(),
    next: mkPiece(),
    score: 0,
    lines: 0,
    level: 1,
    dropInterval: 1000,
    dropAccum: 0,
    lastTime: performance.now(),
    over: false,
  }
}

// ── Drawing helpers ────────────────────────────────────────────────────────

function drawBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  ci: number,
  size: number,
  alpha = 1,
) {
  const color = COLORS[ci]
  if (!color) return
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2)
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.fillRect(x * size + 1, y * size + 1, size - 2, 4)
  ctx.globalAlpha = 1
}

function drawScene(ctx: CanvasRenderingContext2D, gs: GS) {
  ctx.clearRect(0, 0, COLS * BLOCK, ROWS * BLOCK)

  ctx.strokeStyle = 'rgba(255,255,255,0.05)'
  ctx.lineWidth = 0.5
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath()
    ctx.moveTo(c * BLOCK, 0)
    ctx.lineTo(c * BLOCK, ROWS * BLOCK)
    ctx.stroke()
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath()
    ctx.moveTo(0, r * BLOCK)
    ctx.lineTo(COLS * BLOCK, r * BLOCK)
    ctx.stroke()
  }

  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) drawBlock(ctx, c, r, gs.board[r][c], BLOCK)

  const gy = ghostY(gs.board, gs.current)
  for (let r = 0; r < gs.current.shape.length; r++)
    for (let c = 0; c < gs.current.shape[r].length; c++)
      if (gs.current.shape[r][c])
        drawBlock(ctx, gs.current.x + c, gy + r, gs.current.shape[r][c], BLOCK, 0.2)

  for (let r = 0; r < gs.current.shape.length; r++)
    for (let c = 0; c < gs.current.shape[r].length; c++)
      if (gs.current.shape[r][c])
        drawBlock(ctx, gs.current.x + c, gs.current.y + r, gs.current.shape[r][c], BLOCK)
}

function drawPreview(nextCtx: CanvasRenderingContext2D, next: Piece) {
  nextCtx.clearRect(0, 0, 120, 120)
  const NB = 30
  const offX = Math.floor((4 - next.shape[0].length) / 2)
  const offY = Math.floor((4 - next.shape.length) / 2)
  for (let r = 0; r < next.shape.length; r++)
    for (let c = 0; c < next.shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, next.shape[r][c], NB)
}

// ── Component ──────────────────────────────────────────────────────────────

interface Props {
  navigate: (r: Route) => void
  user: User | null
  onSaveScore: (entry: SavedScore) => void
}

export default function TetrisScreen({ navigate, user, onSaveScore }: Props) {
  const boardRef = useRef<HTMLCanvasElement>(null)
  const nextRef = useRef<HTMLCanvasElement>(null)
  const gsRef = useRef<GS>(mkGs())
  const rafRef = useRef<number>(0)
  const pausedRef = useRef(false)
  const overSetRef = useRef(false)

  const [score, setScore] = useState(0)
  const [lines, setLines] = useState(0)
  const [level, setLevel] = useState(1)
  const [paused, setPaused] = useState(false)
  const [over, setOver] = useState(false)
  const [name, setName] = useState((user?.name ?? 'INVITADO').slice(0, 10).toUpperCase())
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const board = boardRef.current
    const nextCanvas = nextRef.current
    if (!board || !nextCanvas) return
    const ctx = board.getContext('2d')!
    const nextCtx = nextCanvas.getContext('2d')!

    let lScore = 0
    let lLines = 0
    let lLevel = 1

    const loop = (ts: number) => {
      const g = gsRef.current
      const dt = Math.min(ts - g.lastTime, 50)
      g.lastTime = ts

      if (!pausedRef.current && !g.over) {
        g.dropAccum += dt
        if (g.dropAccum >= g.dropInterval) {
          g.dropAccum = 0
          if (fits(g.board, g.current.shape, g.current.x, g.current.y + 1)) {
            g.current.y++
          } else {
            const dead = lockPiece(g)
            if (dead && !overSetRef.current) {
              overSetRef.current = true
              g.over = true
              setOver(true)
            }
          }
        }
        if (g.score !== lScore) {
          lScore = g.score
          setScore(g.score)
        }
        if (g.lines !== lLines) {
          lLines = g.lines
          setLines(g.lines)
        }
        if (g.level !== lLevel) {
          lLevel = g.level
          setLevel(g.level)
        }
        drawPreview(nextCtx, g.next)
      }

      drawScene(ctx, g)
      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)

    const onKey = (e: KeyboardEvent) => {
      const g = gsRef.current

      if (e.code === 'KeyP') {
        if (g.over) return
        pausedRef.current = !pausedRef.current
        setPaused(pausedRef.current)
        return
      }

      if (pausedRef.current || g.over) return

      switch (e.code) {
        case 'ArrowLeft':
          if (fits(g.board, g.current.shape, g.current.x - 1, g.current.y)) g.current.x--
          break
        case 'ArrowRight':
          if (fits(g.board, g.current.shape, g.current.x + 1, g.current.y)) g.current.x++
          break
        case 'ArrowDown':
          if (fits(g.board, g.current.shape, g.current.x, g.current.y + 1)) {
            g.current.y++
            g.score += 1
          } else {
            const dead = lockPiece(g)
            if (dead && !overSetRef.current) {
              overSetRef.current = true
              g.over = true
              setOver(true)
            }
          }
          break
        case 'ArrowUp':
        case 'KeyX':
          tryRotate(g)
          break
        case 'Space': {
          e.preventDefault()
          const gy = ghostY(g.board, g.current)
          g.score += (gy - g.current.y) * 2
          g.current.y = gy
          const dead = lockPiece(g)
          if (dead && !overSetRef.current) {
            overSetRef.current = true
            g.over = true
            setOver(true)
          }
          break
        }
      }
    }

    window.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  const restartGame = useCallback(() => {
    gsRef.current = mkGs()
    pausedRef.current = false
    overSetRef.current = false
    setScore(0)
    setLines(0)
    setLevel(1)
    setPaused(false)
    setOver(false)
    setSaved(false)
  }, [])

  const togglePause = useCallback(() => {
    if (gsRef.current.over) return
    pausedRef.current = !pausedRef.current
    setPaused((p) => !p)
  }, [])

  return (
    <div className="av-player fade-in">
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          gap: 24,
          padding: '32px 16px',
        }}
      >
        {/* Board canvas — portrait 1:2 */}
        <div
          style={{
            position: 'relative',
            aspectRatio: '1 / 2',
            maxHeight: 600,
            height: '80vh',
            flexShrink: 0,
          }}
        >
          <canvas
            ref={boardRef}
            width={300}
            height={600}
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
              border: '1px solid rgba(255,255,255,0.1)',
              background: '#050510',
            }}
          />

          {/* Pause overlay */}
          {paused && !over && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0,0,0,0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div className="pixel neon-cyan" style={{ fontSize: 20 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: 'var(--ink-dim)',
                    marginTop: 10,
                    letterSpacing: '0.16em',
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}

          {/* Game over modal */}
          {over && (
            <div className="modal-bd">
              <div className="modal">
                <h2>FIN DEL JUEGO</h2>
                <div className="final-label">PUNTUACIÓN FINAL</div>
                <div className="final">{gsRef.current.score.toLocaleString('es-ES')}</div>
                {!saved ? (
                  <div className="input-row">
                    <input
                      value={name}
                      maxLength={10}
                      onChange={(e) => setName(e.target.value.toUpperCase().slice(0, 10))}
                      placeholder="TUS INICIALES"
                    />
                    <button
                      className="btn cyan"
                      onClick={() => {
                        onSaveScore({
                          game: 'tetris',
                          score: gsRef.current.score,
                          name,
                          at: Date.now(),
                        })
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
                  <button className="btn cyan" onClick={() => navigate({ name: 'games' })}>
                    VOLVER AL VAULT
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Side HUD */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            paddingTop: 8,
            minWidth: 128,
          }}
        >
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString('es-ES')}</div>
          </div>
          <div className="hud-stat">
            <div className="l">Líneas</div>
            <div className="v">{lines}</div>
          </div>
          <div className="hud-stat">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, '0')}</div>
          </div>

          <div>
            <div
              style={{
                fontSize: 10,
                letterSpacing: '0.18em',
                color: 'var(--ink-faint)',
                marginBottom: 8,
                textTransform: 'uppercase',
                fontFamily: 'var(--mono)',
              }}
            >
              Siguiente
            </div>
            <canvas
              ref={nextRef}
              width={120}
              height={120}
              style={{
                display: 'block',
                border: '1px solid rgba(255,255,255,0.1)',
                background: '#050510',
              }}
            />
          </div>

          <div className="hud-actions" style={{ flexDirection: 'column' }}>
            <button className={`btn ${paused ? 'cyan' : 'yellow'}`} onClick={togglePause}>
              {paused ? 'REANUDAR' : 'PAUSA'}
            </button>
            <button
              className="btn ghost"
              onClick={() => navigate({ name: 'detalle', id: 'tetris' })}
            >
              SALIR
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
