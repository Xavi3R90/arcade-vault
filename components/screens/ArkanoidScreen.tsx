'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Route, User, SavedScore } from '@/lib/types'
import { DEFAULT_SKIN, type GamePalette, type SkinId } from '@/lib/skins'
import { arkanoidSkins } from '@/lib/skins/arkanoid'
import TouchControls from '@/components/TouchControls'
import { TOUCH_MAPPINGS } from '@/lib/touch'
import { useIsTouchMobile } from '@/lib/useTouchMobile'

// Contenedor del canvas en escritorio (en móvil lo sustituye .game-stage, SPEC 10).
const DESKTOP_STAGE = {
  position: 'relative',
  width: '100%',
  maxWidth: 800,
  margin: '0 auto',
  aspectRatio: '800 / 600',
} as const

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
const PADDLE_W = 81
const PADDLE_H = 14
const PADDLE_RADIUS = 4
const BALL_SIZE = 16
// Área pintada de cada bloque (1 px de separación por lado) y alto del brillo superior.
const BLOCK_FILL_W = BLOCK_W - 2
const BLOCK_FILL_H = BLOCK_H - 2
const BLOCK_SHINE_H = 5

// ── Skins ─────────────────────────────────────────────────────────────────
const ex = (p: GamePalette, key: string) => p.extra[key] as string
// Familia de color de LEVELS → clave de la paleta (lib/skins/arkanoid.ts).
const BLOCK_KEY: Record<string, string> = {
  red: 'blockRed',
  yellow: 'blockYellow',
  cyan: 'blockCyan',
  magenta: 'blockMagenta',
  hotpink: 'blockHotpink',
  green: 'blockGreen',
  gray: 'blockGray',
}
const blockColor = (p: GamePalette, family: string) => ex(p, BLOCK_KEY[family]) ?? family

// ── Render cache (SPEC 11) ────────────────────────────────────────────────
// Sprite pre-renderizado: el glow (shadowBlur) va "horneado" dentro del canvas,
// con margen `pad` para que el halo no se recorte.
interface Sprite {
  canvas: HTMLCanvasElement
  pad: number
}

interface RenderCache {
  pal: GamePalette
  blocks: Map<string, Sprite> // familia de color de LEVELS → bloque (relleno + glow + brillo)
  paddle: Sprite
  ball: Sprite
  scanlines: HTMLCanvasElement | null // 800×600, solo si pal.scanlines
  layer: HTMLCanvasElement // 800×600: fondo + bloques vivos; se regenera al romper un bloque
  layerCtx: CanvasRenderingContext2D
}

function createLayer(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  return [canvas, canvas.getContext('2d') as CanvasRenderingContext2D]
}

// Margen ≥ 2 × glow para que el halo del shadowBlur quepa entero en el sprite.
const spritePad = (p: GamePalette) => Math.max(2, Math.ceil(p.glow * 2))

function buildSprite(
  p: GamePalette,
  w: number,
  h: number,
  paint: (ctx: CanvasRenderingContext2D, pad: number) => void,
): Sprite {
  const pad = spritePad(p)
  const [canvas, ctx] = createLayer(w + 2 * pad, h + 2 * pad)
  paint(ctx, pad)
  return { canvas, pad }
}

const setGlow = (ctx: CanvasRenderingContext2D, p: GamePalette, color: string) => {
  if (p.glow > 0) {
    ctx.shadowBlur = p.glow
    ctx.shadowColor = color
  }
}

function buildRenderCache(pal: GamePalette): RenderCache {
  const blocks = new Map<string, Sprite>()
  for (const family of Object.keys(BLOCK_KEY)) {
    const color = blockColor(pal, family)
    blocks.set(
      family,
      buildSprite(pal, BLOCK_FILL_W, BLOCK_FILL_H, (ctx, pad) => {
        ctx.fillStyle = color
        setGlow(ctx, pal, color)
        ctx.fillRect(pad, pad, BLOCK_FILL_W, BLOCK_FILL_H)
        ctx.shadowBlur = 0
        ctx.fillStyle = ex(pal, 'blockShine')
        ctx.fillRect(pad, pad, BLOCK_FILL_W, BLOCK_SHINE_H)
      }),
    )
  }

  const paddle = buildSprite(pal, PADDLE_W, PADDLE_H, (ctx, pad) => {
    ctx.fillStyle = pal.fg
    setGlow(ctx, pal, pal.fg)
    ctx.beginPath()
    ctx.roundRect(pad, pad, PADDLE_W, PADDLE_H, PADDLE_RADIUS)
    ctx.fill()
  })

  const ball = buildSprite(pal, BALL_SIZE, BALL_SIZE, (ctx, pad) => {
    ctx.fillStyle = pal.accent
    setGlow(ctx, pal, pal.accent)
    ctx.beginPath()
    ctx.arc(pad + BALL_SIZE / 2, pad + BALL_SIZE / 2, BALL_SIZE / 2, 0, Math.PI * 2)
    ctx.fill()
  })

  let scanlines: HTMLCanvasElement | null = null
  if (pal.scanlines) {
    const [canvas, ctx] = createLayer(W, H)
    ctx.fillStyle = pal.grid
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1)
    scanlines = canvas
  }

  const [layer, layerCtx] = createLayer(W, H)
  return { pal, blocks, paddle, ball, scanlines, layer, layerCtx }
}

// Fondo + bloques vivos, en el mismo orden que antes: el halo de cada bloque
// se superpone al anterior igual que con shadowBlur directo.
function paintBlocksLayer(cache: RenderCache, blocks: Block[]) {
  const c = cache.layerCtx
  c.fillStyle = cache.pal.bg
  c.fillRect(0, 0, W, H)
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]
    if (!b.alive) continue
    const sp = cache.blocks.get(b.color)
    if (sp) c.drawImage(sp.canvas, b.x + 1 - sp.pad, b.y + 1 - sp.pad)
  }
}

// Menú de pausa: solo se pinta en el último frame antes de parar el RAF.
function drawPauseMenu(ctx: CanvasRenderingContext2D, pal: GamePalette, currentLevel: number) {
  ctx.fillStyle = ex(pal, 'pauseOverlay')
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = ex(pal, 'pauseText')
  ctx.font = 'bold 56px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('PAUSA', W / 2, 260)

  ctx.font = 'bold 16px monospace'
  ctx.fillText('Saltar al nivel:', W / 2, 310)

  for (let i = 0; i < 5; i++) {
    const bx = PAUSE_BTN_ROW_X + i * (PAUSE_BTN_W + PAUSE_BTN_GAP)
    const isActive = i + 1 === currentLevel
    ctx.fillStyle = isActive ? ex(pal, 'pauseBtnActive') : ex(pal, 'pauseBtn')
    ctx.strokeStyle = ex(pal, 'pauseBtnStroke')
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(bx, PAUSE_BTN_Y, PAUSE_BTN_W, PAUSE_BTN_H, 6)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = isActive ? ex(pal, 'pauseBtnTextActive') : ex(pal, 'pauseBtnText')
    ctx.font = 'bold 20px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(i + 1), bx + PAUSE_BTN_W / 2, PAUSE_BTN_Y + PAUSE_BTN_H / 2)
  }
}

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
    paddle: { x: 0, y: 560, w: PADDLE_W, h: PADDLE_H },
    ball: { x: 0, y: 0, w: BALL_SIZE, h: BALL_SIZE, vx: 0, vy: 0 },
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
  skin?: SkinId
}

export default function ArkanoidScreen({
  navigate,
  user,
  onSaveScore,
  skin = DEFAULT_SKIN,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gsRef = useRef<GS>(gInit())
  const keysRef = useRef<Record<string, boolean>>({})
  const rafRef = useRef<number>(0)
  const pausedRef = useRef(false)
  const lastTimeRef = useRef<number | null>(null)
  const overSetRef = useRef(false)
  // Paleta leída dentro del loop RAF: cambiar de skin no reinicia la partida.
  const paletteRef = useRef<GamePalette>(arkanoidSkins[skin])
  // Sprites y capas offscreen del skin actual (SPEC 11); se reconstruyen al cambiar de skin.
  const cacheRef = useRef<RenderCache | null>(null)
  // true → hay que repintar la capa fondo + bloques (bloque roto, nivel nuevo, reinicio, skin).
  const layerDirtyRef = useRef(true)
  // Repinta un frame sin avanzar el juego (cambio de skin o ratón con el RAF parado).
  const redrawRef = useRef<(() => void) | null>(null)
  // Relanza el RAF si está parado (reanudar, reiniciar), sin salto de dt.
  const wakeRef = useRef<(() => void) | null>(null)
  const p = arkanoidSkins[skin]

  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [level, setLevel] = useState(1)
  const [paused, setPaused] = useState(false)
  const isTouchMobile = useIsTouchMobile()
  const [over, setOver] = useState<'gameover' | 'win' | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    paletteRef.current = arkanoidSkins[skin]
    // En pausa o game over el RAF está parado: repintar con el nuevo skin.
    redrawRef.current?.()
  }, [skin])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    // alpha: false — el fondo cubre todo el canvas; el navegador compone más rápido (SPEC 11).
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return
    const c: CanvasRenderingContext2D = ctx

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') e.preventDefault()
      keysRef.current[e.key] = true
      if (
        (e.key === 'p' || e.key === 'P' || e.key === 'Escape') &&
        gsRef.current.state === 'playing'
      ) {
        pausedRef.current = !pausedRef.current
        setPaused(pausedRef.current)
        wake()
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
      // Con el RAF parado (pausa, game over) la pala se sigue viendo moverse, como antes.
      if (!rafRef.current) draw()
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
          layerDirtyRef.current = true
          pausedRef.current = false
          setPaused(false)
          setLevel(gs.currentLevel)
          wake()
          return
        }
      }
    }
    canvas.addEventListener('click', onCanvasClick)

    function draw() {
      const gs = gsRef.current
      const pal = paletteRef.current
      let cache = cacheRef.current
      if (!cache || cache.pal !== pal) {
        cache = buildRenderCache(pal)
        cacheRef.current = cache
        layerDirtyRef.current = true
      }
      if (layerDirtyRef.current) {
        paintBlocksLayer(cache, gs.blocks)
        layerDirtyRef.current = false
      }

      // Fondo + bloques (capa cacheada), pala, bola y scanlines: todo con drawImage.
      c.drawImage(cache.layer, 0, 0)
      const pd = cache.paddle
      c.drawImage(pd.canvas, Math.round(gs.paddle.x) - pd.pad, Math.round(gs.paddle.y) - pd.pad)
      const bl = cache.ball
      c.drawImage(bl.canvas, Math.round(gs.ball.x) - bl.pad, Math.round(gs.ball.y) - bl.pad)
      if (cache.scanlines) c.drawImage(cache.scanlines, 0, 0)

      if (pausedRef.current) drawPauseMenu(c, pal, gs.currentLevel)
    }

    // Pide frame solo si el RAF está parado. Tras una pausa, el primer dt es 0 (sin saltos).
    function wake() {
      if (rafRef.current) return
      lastTimeRef.current = null
      rafRef.current = requestAnimationFrame(loop)
    }
    wakeRef.current = wake
    redrawRef.current = () => {
      if (!rafRef.current) draw()
    }

    const loop = (ts: number) => {
      rafRef.current = 0
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

        for (let i = 0; i < gs.blocks.length; i++) {
          const block = gs.blocks[i]
          if (!block.alive) continue
          if (
            gs.ball.x < block.x + block.w &&
            gs.ball.x + gs.ball.w > block.x &&
            gs.ball.y < block.y + block.h &&
            gs.ball.y + gs.ball.h > block.y
          ) {
            block.alive = false
            layerDirtyRef.current = true
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

      draw()
      // En pausa y en game over el RAF se detiene tras este último frame (SPEC 11).
      if (!pausedRef.current && gs.state === 'playing') rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
      wakeRef.current = null
      redrawRef.current = null
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('click', onCanvasClick)
    }
  }, [])

  const togglePause = useCallback(() => {
    pausedRef.current = !pausedRef.current
    setPaused((p) => !p)
    // Al pausar, el frame en curso pinta el menú y para; al reanudar, se relanza el RAF.
    wakeRef.current?.()
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
    layerDirtyRef.current = true
    wakeRef.current?.()
  }, [])

  const exit = () => navigate({ name: 'detalle', id: 'arkanoid' })

  return (
    <div className={'av-player fade-in' + (isTouchMobile ? ' game-mobile' : '')}>
      <div
        className="player-hud"
        style={{ background: ex(p, 'hudBg'), borderColor: ex(p, 'hudBorder') }}
      >
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="hud-stat">
            <div className="l" style={{ color: ex(p, 'hudLabel') }}>
              Puntuación
            </div>
            <div className="v" style={{ color: p.text, textShadow: ex(p, 'hudScoreShadow') }}>
              {score.toLocaleString('es-ES')}
            </div>
          </div>
          <div className="hud-stat level">
            <div className="l" style={{ color: ex(p, 'hudLabel') }}>
              Nivel
            </div>
            <div
              className="v"
              style={{ color: ex(p, 'hudLevel'), textShadow: ex(p, 'hudLevelShadow') }}
            >
              {String(level).padStart(2, '0')}
            </div>
          </div>
          <div className="hud-stat lives">
            <div className="l" style={{ color: ex(p, 'hudLabel') }}>
              Vidas
            </div>
            <div
              className="v"
              style={{
                display: 'flex',
                gap: 6,
                alignItems: 'center',
                color: p.danger,
                textShadow: ex(p, 'hudLivesShadow'),
              }}
            >
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
          <button className="btn ghost" onClick={exit}>
            SALIR
          </button>
        </div>
      </div>

      {/* Misma estructura en móvil y escritorio: el canvas nunca se remonta. */}
      <div className={isTouchMobile ? 'game-stage-area' : undefined}>
        <div
          className={isTouchMobile ? 'game-stage' : undefined}
          style={isTouchMobile ? undefined : DESKTOP_STAGE}
        >
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
        </div>
      </div>

      {isTouchMobile && (
        <TouchControls
          mapping={TOUCH_MAPPINGS.arkanoid}
          paused={paused}
          onTogglePause={togglePause}
          onExit={exit}
          skin={skin}
        />
      )}

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
              {over === 'win' ? '¡COMPLETASTE EL JUEGO!' : 'GAME OVER'}
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
            {!user ? (
              <div className="save-guest">
                <p>INICIA SESIÓN PARA GUARDAR TU PUNTUACIÓN</p>
                <button className="btn yellow" onClick={() => navigate({ name: 'auth' })}>
                  INICIAR SESIÓN
                </button>
              </div>
            ) : !saved ? (
              <div className="input-row">
                <div className="save-player" aria-label="Jugador">
                  {user.name}
                </div>
                <button
                  className="btn yellow"
                  onClick={() => {
                    onSaveScore({ game: 'arkanoid', score, name: user.name, at: Date.now() })
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
