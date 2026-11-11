import type { GamePalette, SkinId } from '@/lib/skins'

/**
 * Paletas de Arkanoid.
 *
 * Roles comunes:
 *  - bg: fondo del canvas
 *  - grid: color de las scanlines (Arkanoid no tiene rejilla)
 *  - fg: pala
 *  - accent: bola
 *  - danger: vidas del HUD
 *  - text: valor de puntuación del HUD
 *
 * extra:
 *  - block<Color>: color de cada familia de bloque de LEVELS (red, yellow, cyan,
 *    magenta, hotpink, green, gray). En los niveles, yellow/cyan/magenta/hotpink
 *    quedan contiguos entre sí (K4), así que Neón y Retro usan 4 escalones de
 *    luminancia distintos para que dos filas vecinas se distingan (≥ 1.5:1).
 *  - blockShine: brillo superior de cada bloque
 *  - hud*, modal*, pause*: estilos del HUD, modal de fin de partida y menú de pausa
 */
export const arkanoidSkins: Record<SkinId, GamePalette> = {
  // Valores exactos del aspecto original (canvas + CSS de .player-hud / .modal).
  classic: {
    bg: '#0a0a0f',
    grid: 'rgba(0, 0, 0, 0)',
    fg: '#e0e0e0',
    accent: '#ffffff',
    danger: '#ff006e',
    text: '#00f5ff',
    glow: 0,
    scanlines: false,
    extra: {
      blockRed: 'red',
      blockYellow: 'yellow',
      blockCyan: 'cyan',
      blockMagenta: 'magenta',
      blockHotpink: 'hotpink',
      blockGreen: 'green',
      blockGray: 'gray',
      blockShine: 'rgba(255,255,255,0.2)',
      hudBg: '#0f0f18',
      hudBorder: 'rgba(0, 245, 255, 0.18)',
      hudLabel: '#4a4f70',
      hudScoreShadow: '0 0 6px rgba(0, 245, 255, 0.5)',
      hudLevel: '#f5ff00',
      hudLevelShadow: '0 0 6px rgba(245, 255, 0, 0.5)',
      hudLivesShadow: '0 0 6px rgba(255, 0, 110, 0.5)',
      pauseOverlay: 'rgba(0,0,0,0.65)',
      pauseText: '#fff',
      pauseBtn: '#444',
      pauseBtnActive: '#f0c040',
      pauseBtnStroke: '#fff',
      pauseBtnText: '#fff',
      pauseBtnTextActive: '#000',
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

  // Neón: pala cian, bola amarilla, bloques saturados con glow.
  // Escalones de luminancia: amarillo > cian/verde/naranja > magenta > violeta.
  neon: {
    bg: '#05050a',
    grid: 'rgba(0, 0, 0, 0)',
    fg: '#00f5ff',
    accent: '#f5ff00',
    danger: '#ff006e',
    text: '#00f5ff',
    glow: 12,
    scanlines: false,
    extra: {
      blockRed: '#ff8a00',
      blockYellow: '#f5ff00',
      blockCyan: '#00c8ff',
      blockMagenta: '#ff006e',
      blockHotpink: '#8a00ff',
      blockGreen: '#00d870',
      blockGray: '#8a8fb5',
      blockShine: 'rgba(255,255,255,0.25)',
      hudBg: '#07070d',
      hudBorder: 'rgba(255, 0, 110, 0.45)',
      hudLabel: '#8a8fb5',
      hudScoreShadow: '0 0 8px rgba(0, 245, 255, 0.85), 0 0 18px rgba(0, 245, 255, 0.45)',
      hudLevel: '#f5ff00',
      hudLevelShadow: '0 0 8px rgba(245, 255, 0, 0.85), 0 0 18px rgba(245, 255, 0, 0.45)',
      hudLivesShadow: '0 0 8px rgba(255, 0, 110, 0.85), 0 0 18px rgba(255, 0, 110, 0.45)',
      pauseOverlay: 'rgba(5, 5, 10, 0.72)',
      pauseText: '#00f5ff',
      pauseBtn: '#14142a',
      pauseBtnActive: '#f5ff00',
      pauseBtnStroke: '#00f5ff',
      pauseBtnText: '#00f5ff',
      pauseBtnTextActive: '#05050a',
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

  // Retro: monitor de fósforo ámbar, sin glow y con scanlines.
  // 4 intensidades de fósforo sobre pantalla apagada (#0a0600):
  // tenue #9c4c00 · medio #c86a00 · alto #f0a838 · pico #ffe2a8
  retro: {
    bg: '#0a0600',
    grid: 'rgba(0, 0, 0, 0.3)',
    fg: '#ffe2a8',
    accent: '#ffe2a8',
    danger: '#ffe2a8',
    text: '#ffe2a8',
    glow: 0,
    scanlines: true,
    extra: {
      blockRed: '#c86a00',
      blockYellow: '#ffe2a8',
      blockCyan: '#f0a838',
      blockMagenta: '#c86a00',
      blockHotpink: '#9c4c00',
      blockGreen: '#f0a838',
      blockGray: '#9c4c00',
      blockShine: 'rgba(255, 226, 168, 0.18)',
      hudBg: '#0a0600',
      hudBorder: '#9c4c00',
      hudLabel: '#f0a838',
      hudScoreShadow: 'none',
      hudLevel: '#ffe2a8',
      hudLevelShadow: 'none',
      hudLivesShadow: 'none',
      pauseOverlay: 'rgba(10, 6, 0, 0.78)',
      pauseText: '#ffe2a8',
      pauseBtn: '#0a0600',
      pauseBtnActive: '#ffe2a8',
      pauseBtnStroke: '#f0a838',
      pauseBtnText: '#ffe2a8',
      pauseBtnTextActive: '#0a0600',
      modalBg: '#0a0600',
      modalBorder: '#f0a838',
      modalShadow: 'none',
      modalTitle: '#ffe2a8',
      modalTitleShadow: 'none',
      modalFinal: '#ffe2a8',
      modalFinalShadow: 'none',
      modalLabel: '#f0a838',
    },
  },
}
