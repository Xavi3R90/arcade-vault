import type { GamePalette, SkinId } from '@/lib/skins'

/**
 * Paletas de Snake.
 *
 * Roles comunes:
 *  - bg: fondo del canvas
 *  - grid: líneas de la rejilla
 *  - fg: cabeza de la serpiente
 *  - accent: cuerpo de la serpiente
 *  - danger: fruta (forma dibujada si no se usa el sprite)
 *  - text: valores del HUD (puntuación y longitud)
 *
 * extra:
 *  - fruitSprite: 'yes' dibuja el sprite de frutas a color; 'no' dibuja la fruta con `danger`
 *  - scanline: color de las scanlines (si `scanlines` está activo)
 *  - hud*, modal*: estilos del HUD y del modal de game over
 */
export const snakeSkins: Record<SkinId, GamePalette> = {
  // Valores exactos del aspecto original (canvas + CSS de .player-hud / .modal).
  classic: {
    bg: '#0a1a0a',
    grid: 'rgba(0,48,0,0.35)',
    fg: '#00ff55',
    accent: '#00bb33',
    danger: '#ff4444',
    text: '#00f5ff',
    glow: 0,
    scanlines: false,
    extra: {
      fruitSprite: 'yes',
      scanline: 'rgba(0, 0, 0, 0)',
      hudBg: '#0f0f18',
      hudBorder: 'rgba(0, 245, 255, 0.18)',
      hudLabel: '#4a4f70',
      hudValueShadow: '0 0 6px rgba(0, 245, 255, 0.5)',
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

  // Neón: cabeza verde brillante, cuerpo verde profundo con glow, fruta magenta.
  neon: {
    bg: '#05050a',
    grid: 'rgba(0, 245, 255, 0.07)',
    fg: '#00ff88',
    accent: '#007040',
    danger: '#ff006e',
    text: '#00f5ff',
    glow: 12,
    scanlines: false,
    extra: {
      fruitSprite: 'no',
      scanline: 'rgba(0, 0, 0, 0)',
      hudBg: '#07070d',
      hudBorder: 'rgba(0, 255, 136, 0.4)',
      hudLabel: '#8a8fb5',
      hudValueShadow: '0 0 8px rgba(0, 245, 255, 0.85), 0 0 18px rgba(0, 245, 255, 0.45)',
      modalBg: '#07070d',
      modalBorder: '#00ff88',
      modalShadow: '0 0 34px rgba(0, 255, 136, 0.4), inset 0 0 18px rgba(0, 255, 136, 0.18)',
      modalTitle: '#ff006e',
      modalTitleShadow: '0 0 10px rgba(255, 0, 110, 0.9), 0 0 26px rgba(255, 0, 110, 0.5)',
      modalFinal: '#f5ff00',
      modalFinalShadow: '0 0 12px rgba(245, 255, 0, 0.9), 0 0 28px rgba(245, 255, 0, 0.45)',
      modalLabel: '#8a8fb5',
    },
  },

  // Retro: handheld oscuro de 4 tonos, sin glow y con scanlines.
  // Tonos: fondo #081208 · cuerpo #3f8a30 · fruta #8fd060 · cabeza/texto #d8f5b0
  retro: {
    bg: '#081208',
    grid: 'rgba(63, 138, 48, 0.18)',
    fg: '#d8f5b0',
    accent: '#3f8a30',
    danger: '#8fd060',
    text: '#d8f5b0',
    glow: 0,
    scanlines: true,
    extra: {
      fruitSprite: 'no',
      scanline: 'rgba(0, 0, 0, 0.3)',
      hudBg: '#081208',
      hudBorder: '#3f8a30',
      hudLabel: '#8fd060',
      hudValueShadow: 'none',
      modalBg: '#081208',
      modalBorder: '#3f8a30',
      modalShadow: 'none',
      modalTitle: '#d8f5b0',
      modalTitleShadow: 'none',
      modalFinal: '#d8f5b0',
      modalFinalShadow: 'none',
      modalLabel: '#8fd060',
    },
  },
}
