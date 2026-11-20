#!/usr/bin/env node
// Medición de FPS de un juego de Arcade Vault en móvil emulado (SPEC 11).
//
// Uso:
//   npm run build && npm run start      # medir siempre contra producción
//   npm run perf -- frogger [--skins=classic,neon,retro] [--duration=10]
//                           [--cpu=10] [--runs=3] [--screenshots=before]
//
// Variables de entorno:
//   BASE_URL  (por defecto http://localhost:3000)
//
// Cada skin se mide `runs` veces (partida nueva en cada pasada) y se informa la
// mediana de cada métrica: con CPU 10× una sola pasada varía ±7 FPS.
// Imprime una línea JSON por skin y termina con código 1 si la mediana de algún
// skin no cumple avgFps >= 55 y longFramesPct <= 5.
//
// cpuMsPerFrame: tiempo de main thread por frame (TaskDuration de CDP
// Performance.getMetrics / frames). Es más estable que contar frames y es la
// métrica para comparar pasos entre sí; no forma parte del umbral.

import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000'
const MIN_AVG_FPS = 55
const MAX_LONG_FRAMES_PCT = 5
const LONG_FRAME_MS = 20
const WARMUP_MS = 1000
const SCREENSHOT_AT_MS = 2000
const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out')

// ── Argumentos ─────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const opts = {
    game: 'frogger',
    skins: ['classic', 'neon', 'retro'],
    duration: 10,
    cpu: 10,
    runs: 3,
  }
  for (const arg of argv) {
    if (!arg.startsWith('--')) {
      opts.game = arg
      continue
    }
    const [key, value = ''] = arg.slice(2).split('=')
    if (key === 'skins') opts.skins = value.split(',').filter(Boolean)
    else if (key === 'duration') opts.duration = Number(value)
    else if (key === 'cpu') opts.cpu = Number(value)
    else if (key === 'runs') opts.runs = Math.max(1, Number(value))
    else if (key === 'screenshots') opts.screenshots = value || 'shot'
    else throw new Error(`Argumento desconocido: ${arg}`)
  }
  return opts
}

// ── Navegación por la UI: Biblioteca → tarjeta del juego → JUGAR AHORA ──────
// La app no tiene rutas por URL (routing por estado en app/page.tsx), así que
// se navega haciendo clic. Todos los selectores viven aquí.
async function gotoGame(page, slug) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' })
  await page.locator('.av-nav .logo').click()
  // El título de la tarjeta de un juego implementado es su slug en mayúsculas.
  // No basta con la cover: `cover-snake` también la usa SERPENTINA (sin play_route).
  const card = page.locator('.card', {
    has: page.locator('.title', { hasText: new RegExp(`^${slug}$`, 'i') }),
  })
  await card.waitFor({ state: 'visible', timeout: 15000 })
  await card.click()
  await page.getByRole('button', { name: /JUGAR AHORA/ }).click()
  await page.locator('#root[data-game-route] canvas').first().waitFor({ state: 'visible' })
}

// Contador de frames inyectado en la página: registra los intervalos entre
// requestAnimationFrame durante `ms` milisegundos.
async function measureFrames(page, ms) {
  return page.evaluate(
    (duration) =>
      new Promise((resolve) => {
        const deltas = []
        let last = performance.now()
        const start = last
        const tick = (now) => {
          deltas.push(now - last)
          last = now
          if (now - start < duration) requestAnimationFrame(tick)
          else resolve({ deltas, elapsed: now - start })
        }
        requestAnimationFrame(tick)
      }),
    ms,
  )
}

const round = (n) => Math.round(n * 10) / 10
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** Métricas de una pasada. `taskMs` = tiempo de main thread durante la medición. */
function summarizeRun({ deltas, elapsed }, taskMs) {
  const sorted = [...deltas].sort((a, b) => a - b)
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0
  const long = deltas.filter((d) => d > LONG_FRAME_MS).length
  return {
    avgFps: (deltas.length / elapsed) * 1000,
    p95FrameMs: p95,
    longFramesPct: deltas.length ? (long / deltas.length) * 100 : 100,
    cpuMsPerFrame: deltas.length ? taskMs / deltas.length : 0,
    durationS: elapsed / 1000,
  }
}

/** Mediana por métrica de todas las pasadas. */
function summarize(game, skin, runs) {
  const pick = (k) => round(median(runs.map((r) => r[k])))
  return {
    game,
    skin,
    avgFps: pick('avgFps'),
    p95FrameMs: pick('p95FrameMs'),
    longFramesPct: pick('longFramesPct'),
    cpuMsPerFrame: pick('cpuMsPerFrame'),
    durationS: pick('durationS'),
    runs: runs.length,
  }
}

async function taskDurationMs(cdp) {
  const { metrics } = await cdp.send('Performance.getMetrics')
  return (metrics.find((m) => m.name === 'TaskDuration')?.value ?? 0) * 1000
}

async function runSkin(browser, opts, skin) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  })
  await context.addInitScript((s) => {
    try {
      localStorage.setItem('av-skin', s)
    } catch {
      // sin localStorage: se mide con el skin por defecto
    }
  }, skin)
  const page = await context.newPage()
  try {
    const cdp = await context.newCDPSession(page)
    await cdp.send('Performance.enable')

    const runs = []
    for (let i = 0; i < opts.runs; i++) {
      // Navegación sin limitar la CPU; se limita solo durante la medición.
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
      await gotoGame(page, opts.game)
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: opts.cpu })
      await page.waitForTimeout(WARMUP_MS)
      const t0 = await taskDurationMs(cdp)
      const frames = await measureFrames(page, opts.duration * 1000)
      const taskMs = (await taskDurationMs(cdp)) - t0
      runs.push(summarizeRun(frames, taskMs))
    }
    const result = summarize(opts.game, skin, runs)

    if (opts.screenshots) {
      // Captura de referencia: partida nueva, pausa al segundo 2.
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
      await gotoGame(page, opts.game)
      await page.waitForTimeout(SCREENSHOT_AT_MS)
      await page.getByRole('button', { name: /PAUSA/ }).filter({ visible: true }).first().click()
      await mkdir(OUT_DIR, { recursive: true })
      const file = path.join(OUT_DIR, `${opts.game}-${skin}-${opts.screenshots}.png`)
      await page.locator('.crt-screen').first().screenshot({ path: file })
    }
    return result
  } finally {
    await context.close()
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const browser = await chromium.launch()
  let failed = false
  try {
    for (const skin of opts.skins) {
      const result = await runSkin(browser, opts, skin)
      console.log(JSON.stringify(result))
      if (result.avgFps < MIN_AVG_FPS || result.longFramesPct > MAX_LONG_FRAMES_PCT) failed = true
    }
  } finally {
    await browser.close()
  }
  process.exit(failed ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(2)
})
