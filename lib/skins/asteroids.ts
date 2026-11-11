import type { GamePalette, SkinId } from '@/lib/skins'

/**
 * Paletas de Asteroids.
 *
 * Roles comunes:
 *  - bg: fondo del canvas
 *  - grid: color de las scanlines (Asteroids no tiene rejilla)
 *  - fg: nave
 *  - accent: power-up 3x (rombo + etiqueta)
 *  - danger: llama del propulsor
 *  - text: valor de puntuación del HUD
 *
 * extra:
 *  - asteroid, bullet: trazos del canvas
 *  - particle: triplete "r,g,b" (el alpha lo pone la partícula)
 *  - hud*, modal*, pause*: estilos del HUD, modal de game over y overlay de pausa
 */
export const asteroidsSkins: Record<SkinId, GamePalette> = {
  // Valores exactos del aspecto original (canvas + CSS de .player-hud / .modal).
  classic: {
    bg: '#000',
    grid: 'rgba(0, 0, 0, 0)',
    fg: '#fff',
    accent: '#0ff',
    danger: 'rgba(255, 130, 0, 0.85)',
    text: '#00f5ff',
    glow: 0,
    scanlines: false,
    extra: {
      asteroid: '#fff',
      bullet: '#fff',
      particle: '255,255,255',
      hudBg: '#0f0f18',
      hudBorder: 'rgba(0, 245, 255, 0.18)',
      hudLabel: '#4a4f70',
      hudScoreShadow: '0 0 6px rgba(0, 245, 255, 0.5)',
      hudLevel: '#f5ff00',
      hudLevelShadow: '0 0 6px rgba(245, 255, 0, 0.5)',
      hudLives: '#ff006e',
      hudLivesShadow: '0 0 6px rgba(255, 0, 110, 0.5)',
      hudPower: '#00f5ff',
      hudPowerShadow: '0 0 6px rgba(0,245,255,0.5)',
      pauseOverlay: 'rgba(0,0,0,0.6)',
      pauseTitle: '#f5ff00',
      pauseTitleShadow: '0 0 6px rgba(245, 255, 0, 0.7), 0 0 16px rgba(245, 255, 0, 0.4)',
      pauseText: '#8a8fb5',
      modalBg: '#0f0f18',
      modalBorder: '#ff006e',
      modalShadow: '0 0 30px rgba(255, 0, 110, 0.4), inset 0 0 16px rgba(255, 0, 110, 0.18)',
      modalTitle: '#ff006e',
      modalTitleShadow: '0 0 12px rgba(255, 0, 110, 0.7)',
      modalFinal: '#f5ff00',
      modalFinalShadow: '0 0 16px rgba(245, 255, 0, 0.6)',
      modalLabel: '#4a4f70',
    },
  },

  // Neón: rocas magenta (amenaza), nave cian, balas verdes, power-up amarillo.
  neon: {
    bg: '#05050a',
    grid: 'rgba(0, 0, 0, 0)',
    fg: '#00f5ff',
    accent: '#f5ff00',
    danger: 'rgba(245, 255, 0, 0.9)',
    text: '#00f5ff',
    glow: 12,
    scanlines: false,
    extra: {
      asteroid: '#ff006e',
      bullet: '#00ff88',
      particle: '255,0,110',
      hudBg: '#07070d',
      hudBorder: 'rgba(255, 0, 110, 0.45)',
      hudLabel: '#8a8fb5',
      hudScoreShadow: '0 0 8px rgba(0, 245, 255, 0.85), 0 0 18px rgba(0, 245, 255, 0.45)',
      hudLevel: '#f5ff00',
      hudLevelShadow: '0 0 8px rgba(245, 255, 0, 0.85), 0 0 18px rgba(245, 255, 0, 0.45)',
      hudLives: '#ff006e',
      hudLivesShadow: '0 0 8px rgba(255, 0, 110, 0.85), 0 0 18px rgba(255, 0, 110, 0.45)',
      hudPower: '#f5ff00',
      hudPowerShadow: '0 0 8px rgba(245, 255, 0, 0.85)',
      pauseOverlay: 'rgba(5, 5, 10, 0.72)',
      pauseTitle: '#ff006e',
      pauseTitleShadow: '0 0 8px rgba(255, 0, 110, 0.9), 0 0 22px rgba(255, 0, 110, 0.5)',
      pauseText: '#8a8fb5',
      modalBg: '#07070d',
      modalBorder: '#00f5ff',
      modalShadow: '0 0 34px rgba(0, 245, 255, 0.45), inset 0 0 18px rgba(0, 245, 255, 0.2)',
      modalTitle: '#ff006e',
      modalTitleShadow: '0 0 10px rgba(255, 0, 110, 0.9), 0 0 26px rgba(255, 0, 110, 0.5)',
      modalFinal: '#f5ff00',
      modalFinalShadow: '0 0 12px rgba(245, 255, 0, 0.9), 0 0 28px rgba(245, 255, 0, 0.45)',
      modalLabel: '#8a8fb5',
    },
  },

  // Retro: monitor de fósforo verde, 4 tonos, sin glow y con scanlines.
  // Tonos: fondo #030c05 · oscuro #0f3a1a · medio #2fa84a · brillante #b6ffc4
  retro: {
    bg: '#030c05',
    grid: 'rgba(0, 0, 0, 0.35)',
    fg: '#b6ffc4',
    accent: '#b6ffc4',
    danger: '#2fa84a',
    text: '#b6ffc4',
    glow: 0,
    scanlines: true,
    extra: {
      asteroid: '#2fa84a',
      bullet: '#b6ffc4',
      particle: '47,168,74',
      hudBg: '#030c05',
      hudBorder: '#0f3a1a',
      hudLabel: '#2fa84a',
      hudScoreShadow: 'none',
      hudLevel: '#b6ffc4',
      hudLevelShadow: 'none',
      hudLives: '#b6ffc4',
      hudLivesShadow: 'none',
      hudPower: '#b6ffc4',
      hudPowerShadow: 'none',
      pauseOverlay: 'rgba(3, 12, 5, 0.75)',
      pauseTitle: '#b6ffc4',
      pauseTitleShadow: 'none',
      pauseText: '#2fa84a',
      modalBg: '#030c05',
      modalBorder: '#2fa84a',
      modalShadow: 'none',
      modalTitle: '#b6ffc4',
      modalTitleShadow: 'none',
      modalFinal: '#b6ffc4',
      modalFinalShadow: 'none',
      modalLabel: '#2fa84a',
    },
  },
}
