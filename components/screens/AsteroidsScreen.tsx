'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Route, User, SavedScore } from '@/lib/types'

// ── Constants ──────────────────────────────────────────────────────────────
const W = 800
const H = 600
const POWERUP_DROP_CHANCE = 0.15
const POWERUP_DURATION = 5
const POWERUP_TTL = 12
const TRIPLE_SPREAD = 0.18
const RADII = [0, 16, 30, 50]
const SPEEDS = [0, 85, 55, 32]
const POINTS = [0, 100, 50, 20]

// ── Utils ──────────────────────────────────────────────────────────────────
const wrap = (v: number, max: number) => ((v % max) + max) % max
const gDist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y)
const rand = (min: number, max: number) => min + Math.random() * (max - min)
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1))

// ── Classes ────────────────────────────────────────────────────────────────
class Bullet {
  x: number
  y: number
  vx: number
  vy: number
  ttl = 1.1
  radius = 2
  dead = false

  constructor(x: number, y: number, angle: number) {
    this.x = x
    this.y = y
    const SPEED = 520
    this.vx = Math.cos(angle) * SPEED
    this.vy = Math.sin(angle) * SPEED
  }

  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, W)
    this.y = wrap(this.y + this.vy * dt, H)
    this.ttl -= dt
    if (this.ttl <= 0) this.dead = true
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2)
    ctx.fill()
  }
}

class Asteroid {
  x: number
  y: number
  size: number
  radius: number
  dead = false
  vx: number
  vy: number
  rotSpeed: number
  rot: number
  verts: [number, number][]

  constructor(x: number, y: number, size = 3) {
    this.x = x
    this.y = y
    this.size = size
    this.radius = RADII[size]
    const angle = rand(0, Math.PI * 2)
    const speed = SPEEDS[size] + rand(-15, 15)
    this.vx = Math.cos(angle) * speed
    this.vy = Math.sin(angle) * speed
    this.rotSpeed = rand(-1.2, 1.2)
    this.rot = rand(0, Math.PI * 2)
    const n = randInt(8, 13)
    this.verts = []
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      const r = this.radius * rand(0.6, 1.0)
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r])
    }
  }

  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, W)
    this.y = wrap(this.y + this.vy * dt, H)
    this.rot += this.rotSpeed * dt
  }

  split(): Asteroid[] {
    if (this.size <= 1) return []
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ]
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save()
    ctx.translate(this.x, this.y)
    ctx.rotate(this.rot)
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 1.5
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(this.verts[0][0], this.verts[0][1])
    for (let i = 1; i < this.verts.length; i++) ctx.lineTo(this.verts[i][0], this.verts[i][1])
    ctx.closePath()
    ctx.stroke()
    ctx.restore()
  }
}

class PowerUp {
  x: number
  y: number
  vx: number
  vy: number
  radius = 12
  ttl: number
  dead = false

  constructor(x: number, y: number) {
    this.x = x
    this.y = y
    const angle = rand(0, Math.PI * 2)
    const speed = rand(20, 40)
    this.vx = Math.cos(angle) * speed
    this.vy = Math.sin(angle) * speed
    this.ttl = POWERUP_TTL
  }

  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, W)
    this.y = wrap(this.y + this.vy * dt, H)
    this.ttl -= dt
    if (this.ttl <= 0) this.dead = true
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.ttl < 2 && Math.floor(this.ttl * 8) % 2 === 0) return
    const pulse = 0.85 + Math.sin(performance.now() / 150) * 0.15
    ctx.save()
    ctx.translate(this.x, this.y)
    ctx.rotate(Math.PI / 4)
    ctx.strokeStyle = '#0ff'
    ctx.lineWidth = 2
    const r = this.radius * pulse
    ctx.strokeRect(-r, -r, r * 2, r * 2)
    ctx.restore()
    ctx.fillStyle = '#0ff'
    ctx.font = 'bold 12px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('3x', this.x, this.y)
  }
}

class Ship {
  x = W / 2
  y = H / 2
  angle = -Math.PI / 2
  vx = 0
  vy = 0
  radius = 12
  thrusting = false
  invincible = 3
  shootCooldown = 0
  dead = false
  tripleShot = 0

  reset() {
    this.x = W / 2
    this.y = H / 2
    this.angle = -Math.PI / 2
    this.vx = 0
    this.vy = 0
    this.thrusting = false
    this.invincible = 3
    this.shootCooldown = 0
    this.dead = false
  }

  update(dt: number, keys: Record<string, boolean>) {
    if (this.dead) return
    if (this.invincible > 0) this.invincible -= dt
    if (this.shootCooldown > 0) this.shootCooldown -= dt
    if (this.tripleShot > 0) this.tripleShot -= dt
    const ROT = 3.5
    const THRUST = 260
    const DRAG = 0.987
    if (keys['ArrowLeft']) this.angle -= ROT * dt
    if (keys['ArrowRight']) this.angle += ROT * dt
    this.thrusting = !!keys['ArrowUp']
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt
      this.vy += Math.sin(this.angle) * THRUST * dt
    }
    this.vx *= DRAG
    this.vy *= DRAG
    this.x = wrap(this.x + this.vx * dt, W)
    this.y = wrap(this.y + this.vy * dt, H)
  }

  tryShoot(): Bullet[] {
    if (this.shootCooldown > 0 || this.dead) return []
    this.shootCooldown = 0.2
    const NOSE = 21
    const ox = this.x + Math.cos(this.angle) * NOSE
    const oy = this.y + Math.sin(this.angle) * NOSE
    if (this.tripleShot > 0) {
      return [
        new Bullet(ox, oy, this.angle - TRIPLE_SPREAD),
        new Bullet(ox, oy, this.angle),
        new Bullet(ox, oy, this.angle + TRIPLE_SPREAD),
      ]
    }
    return [new Bullet(ox, oy, this.angle)]
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.dead) return
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return
    ctx.save()
    ctx.translate(this.x, this.y)
    ctx.rotate(this.angle)
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 1.5
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(20, 0)
    ctx.lineTo(-12, -9)
    ctx.lineTo(-7, 0)
    ctx.lineTo(-12, 9)
    ctx.closePath()
    ctx.stroke()
    if (this.thrusting && Math.random() > 0.35) {
      ctx.beginPath()
      ctx.moveTo(-8, -4)
      ctx.lineTo(-8 - rand(6, 14), 0)
      ctx.lineTo(-8, 4)
      ctx.strokeStyle = 'rgba(255, 130, 0, 0.85)'
      ctx.stroke()
    }
    ctx.restore()
  }
}

class Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  ttl: number
  dead = false

  constructor(x: number, y: number) {
    this.x = x
    this.y = y
    const angle = rand(0, Math.PI * 2)
    const speed = rand(30, 130)
    this.vx = Math.cos(angle) * speed
    this.vy = Math.sin(angle) * speed
    this.life = rand(0.4, 1.1)
    this.ttl = this.life
  }

  update(dt: number) {
    this.x += this.vx * dt
    this.y += this.vy * dt
    this.ttl -= dt
    if (this.ttl <= 0) this.dead = true
  }

  draw(ctx: CanvasRenderingContext2D) {
    const alpha = this.ttl / this.life
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(this.x, this.y)
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05)
    ctx.stroke()
  }
}

// ── Game state ─────────────────────────────────────────────────────────────
interface GS {
  ship: Ship
  bullets: Bullet[]
  asteroids: Asteroid[]
  particles: Particle[]
  powerUps: PowerUp[]
  score: number
  lives: number
  level: number
  state: 'playing' | 'dead' | 'gameover'
  deadTimer: number
  powerUpSpawned: boolean
  killsSinceSpawn: number
}

function gSpawn(gs: GS, count: number) {
  const SAFE = 130
  for (let i = 0; i < count; i++) {
    let x: number, y: number
    do {
      x = rand(0, W)
      y = rand(0, H)
    } while (Math.hypot(x - W / 2, y - H / 2) < SAFE)
    gs.asteroids.push(new Asteroid(x, y, 3))
  }
}

function gInit(): GS {
  const gs: GS = {
    ship: new Ship(),
    bullets: [],
    asteroids: [],
    particles: [],
    powerUps: [],
    score: 0,
    lives: 3,
    level: 1,
    state: 'playing',
    deadTimer: 0,
    powerUpSpawned: false,
    killsSinceSpawn: 0,
  }
  gSpawn(gs, 4)
  return gs
}

function gExplode(gs: GS, x: number, y: number, count = 8) {
  for (let i = 0; i < count; i++) gs.particles.push(new Particle(x, y))
}

function gKillShip(gs: GS) {
  gExplode(gs, gs.ship.x, gs.ship.y, 14)
  gs.ship.dead = true
  gs.lives--
  if (gs.lives <= 0) {
    gs.state = 'gameover'
  } else {
    gs.state = 'dead'
    gs.deadTimer = 2
  }
}

function gNextLevel(gs: GS) {
  gs.level++
  gs.bullets = []
  gs.particles = []
  gs.powerUps = []
  gs.powerUpSpawned = false
  gs.killsSinceSpawn = 0
  gs.ship.reset()
  gSpawn(gs, 3 + gs.level)
}

// ── Component ──────────────────────────────────────────────────────────────
interface Props {
  navigate: (r: Route) => void
  user: User | null
  onSaveScore: (entry: SavedScore) => void
}

export default function AsteroidsScreen({ navigate, user, onSaveScore }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gsRef = useRef<GS>(gInit())
  const keysRef = useRef<Record<string, boolean>>({})
  const justPressedRef = useRef<Record<string, boolean>>({})
  const rafRef = useRef<number>(0)
  const pausedRef = useRef(false)
  const lastTimeRef = useRef<number | null>(null)
  const overSetRef = useRef(false)

  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [level, setLevel] = useState(1)
  const [tripleShot, setTripleShot] = useState(0)
  const [paused, setPaused] = useState(false)
  const [over, setOver] = useState(false)
  const [name, setName] = useState(user?.name ?? 'INVITADO')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space'].includes(e.code)) e.preventDefault()
      if (!keysRef.current[e.code]) justPressedRef.current[e.code] = true
      keysRef.current[e.code] = true
    }
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    const pressed = (code: string) => {
      const val = justPressedRef.current[code]
      justPressedRef.current[code] = false
      return val
    }

    const loop = (ts: number) => {
      const gs = gsRef.current
      const dt =
        lastTimeRef.current === null ? 0 : Math.min((ts - lastTimeRef.current) / 1000, 0.05)
      lastTimeRef.current = ts

      if (!pausedRef.current) {
        if (gs.state === 'gameover') {
          gs.particles.forEach((p) => p.update(dt))
          gs.particles = gs.particles.filter((p) => !p.dead)
          if (!overSetRef.current) {
            overSetRef.current = true
            setOver(true)
          }
        } else if (gs.state === 'dead') {
          gs.deadTimer -= dt
          gs.particles.forEach((p) => p.update(dt))
          gs.particles = gs.particles.filter((p) => !p.dead)
          gs.asteroids.forEach((a) => a.update(dt))
          if (gs.deadTimer <= 0) {
            gs.state = 'playing'
            gs.ship.reset()
          }
          setLives(gs.lives)
        } else {
          if (pressed('Space')) gs.bullets.push(...gs.ship.tryShoot())

          gs.ship.update(dt, keysRef.current)
          gs.bullets.forEach((b) => b.update(dt))
          gs.asteroids.forEach((a) => a.update(dt))
          gs.particles.forEach((p) => p.update(dt))
          gs.powerUps.forEach((p) => p.update(dt))

          gs.bullets = gs.bullets.filter((b) => !b.dead)
          gs.particles = gs.particles.filter((p) => !p.dead)
          gs.powerUps = gs.powerUps.filter((p) => !p.dead)

          for (const p of gs.powerUps) {
            if (!p.dead && gDist(gs.ship, p) < gs.ship.radius + p.radius) {
              p.dead = true
              gs.ship.tripleShot = POWERUP_DURATION
            }
          }

          const newAsteroids: Asteroid[] = []
          for (const b of gs.bullets) {
            for (const a of gs.asteroids) {
              if (!a.dead && !b.dead && gDist(b, a) < a.radius) {
                b.dead = true
                a.dead = true
                gs.score += POINTS[a.size]
                gExplode(gs, a.x, a.y, a.size * 5)
                newAsteroids.push(...a.split())
                if (!gs.powerUpSpawned) {
                  gs.killsSinceSpawn++
                  if (gs.killsSinceSpawn >= 5 || Math.random() < POWERUP_DROP_CHANCE) {
                    gs.powerUps.push(new PowerUp(a.x, a.y))
                    gs.powerUpSpawned = true
                  }
                }
              }
            }
          }
          gs.asteroids = gs.asteroids.filter((a) => !a.dead).concat(newAsteroids)
          gs.bullets = gs.bullets.filter((b) => !b.dead)

          if (gs.ship.invincible <= 0) {
            for (const a of gs.asteroids) {
              if (gDist(gs.ship, a) < gs.ship.radius + a.radius * 0.82) {
                gKillShip(gs)
                break
              }
            }
          }

          if (gs.asteroids.length === 0) gNextLevel(gs)

          setScore(gs.score)
          setLives(gs.lives)
          setLevel(gs.level)
          setTripleShot(Math.max(0, gs.ship.tripleShot))
        }
      }

      // Draw always (even when paused)
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, W, H)
      gs.particles.forEach((p) => p.draw(ctx))
      gs.asteroids.forEach((a) => a.draw(ctx))
      gs.powerUps.forEach((p) => p.draw(ctx))
      gs.bullets.forEach((b) => b.draw(ctx))
      gs.ship.draw(ctx)

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
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
    justPressedRef.current = {}
    pausedRef.current = false
    overSetRef.current = false
    setScore(0)
    setLives(3)
    setLevel(1)
    setTripleShot(0)
    setPaused(false)
    setOver(false)
    setSaved(false)
  }, [])

  return (
    <div className="av-player fade-in">
      {/* HUD */}
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
                <svg key={i} width="14" height="16" viewBox="0 0 20 22" fill="none">
                  <polygon
                    points="10,2 18,20 10,14 2,20"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                </svg>
              ))}
              {lives <= 0 && '—'}
            </div>
          </div>
          {tripleShot > 0 && (
            <div className="hud-stat">
              <div className="l" style={{ color: 'var(--cyan)' }}>
                3x DISPARO
              </div>
              <div
                className="v"
                style={{ color: 'var(--cyan)', textShadow: '0 0 6px rgba(0,245,255,0.5)' }}
              >
                {tripleShot.toFixed(1)}s
              </div>
            </div>
          )}
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={togglePause}>
            {paused ? 'REANUDAR' : 'PAUSA'}
          </button>
          <button
            className="btn ghost"
            onClick={() => navigate({ name: 'detalle', id: 'asteroids' })}
          >
            SALIR
          </button>
        </div>
      </div>

      {/* Canvas responsivo */}
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
        {paused && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
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
      </div>

      {/* Modal de game over */}
      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
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
                    onSaveScore({ game: 'asteroids', score, name, at: Date.now() })
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
