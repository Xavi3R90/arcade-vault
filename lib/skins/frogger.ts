import type { GamePalette, SkinId } from '@/lib/skins'

/**
 * Paletas de Frogger.
 *
 * Roles comunes:
 *  - bg: marco del canvas (márgenes 800×600 alrededor del tablero 640×560)
 *  - grid: separadores discontinuos de los carriles de carretera
 *  - fg: rana (cuerpo, ranas en las bocas y vidas del HUD interno)
 *  - accent: borde de las bocas destino
 *  - danger: coche de la fila 12 (y color de respaldo de cualquier coche)
 *  - text: valores del HUD interno del canvas
 *
 * extra (canvas):
 *  - goalsBg, goalMouth, river, safe, road: fondos por zona
 *  - carColors: [fila 12, fila 11, fila 9]
 *  - wheel, windshield, truck, truckCab, log, logLine
 *  - turtle, turtleScale, turtleUnder (contorno de la tortuga sumergida)
 *  - frogDark (patas), eye, pupil
 *  - hudLabel (etiquetas del HUD interno)
 *  - timeOk, timeWarn, timeLow: barra de tiempo
 *  - scanline: color de las scanlines (si `scanlines` está activo)
 *
 * extra (React): hud*, modal*: HUD superior y modal de game over.
 */
export const froggerSkins: Record<SkinId, GamePalette> = {
  // Paleta original (objeto C / CAR_COLORS + CSS de .player-hud / .hud-stat / .modal) con
  // ajustes de contraste en modo oscuro (2026-11-15): metas #2e7d32 (antes #7ccf5a), río #06183a
  // (#0b2a5c), coche fila 11 #ab47bc (#fdd835), tronco #b5763a/#7b4a1e (#7b4a1e/#5a3412),
  // tortuga #43a047/#1b5e20 (#2e7d32/#66bb6a) y etiquetas HUD/modal #8a8fb5 (#4a4f70).
  classic: {
    bg: '#05070a',
    grid: '#3a3a3a',
    fg: '#39ff14',
    accent: '#e6b422',
    danger: '#e53935',
    text: '#ffffff',
    glow: 0,
    scanlines: false,
    extra: {
      goalsBg: '#2e7d32',
      goalMouth: '#0f3d1e',
      river: '#06183a',
      safe: '#14532d',
      road: '#000000',
      carColors: ['#e53935', '#ab47bc', '#1e88e5'],
      wheel: '#111111',
      windshield: 'rgba(255,255,255,0.55)',
      truck: '#9e9e9e',
      truckCab: '#5f6368',
      log: '#b5763a',
      logLine: '#7b4a1e',
      turtle: '#43a047',
      turtleScale: '#1b5e20',
      turtleUnder: '#81c784',
      frogDark: '#1b8a0a',
      eye: '#ffffff',
      pupil: '#000000',
      hudLabel: '#9aa4b2',
      timeOk: '#43a047',
      timeWarn: '#fdd835',
      timeLow: '#e53935',
      scanline: 'rgba(0, 0, 0, 0)',
      hudBg: '#0f0f18',
      hudBorder: 'rgba(0, 245, 255, 0.18)',
      hudLabelCss: '#8a8fb5',
      hudScore: '#00f5ff',
      hudScoreShadow: '0 0 6px rgba(0, 245, 255, 0.5)',
      hudLives: '#ff006e',
      hudLivesShadow: '0 0 6px rgba(255, 0, 110, 0.5)',
      hudLevel: '#f5ff00',
      hudLevelShadow: '0 0 6px rgba(245, 255, 0, 0.5)',
      modalBg: '#0f0f18',
      modalBorder: '#ff006e',
      modalShadow: '0 0 30px rgba(255, 0, 110, 0.4), inset 0 0 16px rgba(255, 0, 110, 0.18)',
      modalTitle: '#ff006e',
      modalTitleShadow: '0 0 12px rgba(255, 0, 110, 0.7)',
      modalFinal: '#f5ff00',
      modalFinalShadow: '0 0 16px rgba(245, 255, 0, 0.6)',
      modalLabel: '#8a8fb5',
    },
  },

  // Neón: fondos casi negros (zonas seguras en violeta), rana #00ff88 con glow, tráfico magenta /
  // naranja / violeta, camiones rosa, troncos naranja y tortugas azul eléctrico.
  neon: {
    bg: '#05050a',
    grid: '#2a2a4a',
    fg: '#00ff88',
    accent: '#f5ff00',
    danger: '#ff006e',
    text: '#00f5ff',
    glow: 12,
    scanlines: false,
    extra: {
      goalsBg: '#0a2416',
      goalMouth: '#020806',
      river: '#020c1f',
      safe: '#3a2070',
      road: '#000000',
      carColors: ['#ff006e', '#ff8c00', '#b45cff'],
      wheel: '#3a3a5a',
      windshield: 'rgba(255,255,255,0.6)',
      truck: '#ff3cac',
      truckCab: '#8a2be2',
      log: '#ff8c00',
      logLine: '#7a3a00',
      turtle: '#0099ff',
      turtleScale: '#00f5ff',
      turtleUnder: '#00f5ff',
      frogDark: '#00a85a',
      eye: '#ffffff',
      pupil: '#000000',
      hudLabel: '#8a8fb5',
      timeOk: '#00ff88',
      timeWarn: '#ff8c00',
      timeLow: '#ff006e',
      scanline: 'rgba(0, 0, 0, 0)',
      hudBg: '#07070d',
      hudBorder: 'rgba(0, 255, 136, 0.4)',
      hudLabelCss: '#8a8fb5',
      hudScore: '#00f5ff',
      hudScoreShadow: '0 0 8px rgba(0, 245, 255, 0.85), 0 0 18px rgba(0, 245, 255, 0.45)',
      hudLives: '#ff006e',
      hudLivesShadow: '0 0 8px rgba(255, 0, 110, 0.85), 0 0 18px rgba(255, 0, 110, 0.45)',
      hudLevel: '#f5ff00',
      hudLevelShadow: '0 0 8px rgba(245, 255, 0, 0.85), 0 0 18px rgba(245, 255, 0, 0.45)',
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

  // Retro: monitor ámbar CRT de 4 tonos, sin glow y con scanlines.
  // Tonos: #120a00 (fondo) · #4a2a00 (agua / detalles) · #c07800 (vehículos,
  // troncos, tortugas) · #ffcc66 (rana, texto, bordes).
  retro: {
    bg: '#120a00',
    grid: '#4a2a00',
    fg: '#ffcc66',
    accent: '#ffcc66',
    danger: '#c07800',
    text: '#ffcc66',
    glow: 0,
    scanlines: true,
    extra: {
      goalsBg: '#c07800',
      goalMouth: '#120a00',
      river: '#4a2a00',
      safe: '#120a00',
      road: '#120a00',
      carColors: ['#c07800', '#c07800', '#c07800'],
      wheel: '#4a2a00',
      windshield: 'rgba(18,10,0,0.7)',
      truck: '#c07800',
      truckCab: '#c07800',
      log: '#c07800',
      logLine: '#4a2a00',
      turtle: '#c07800',
      turtleScale: '#4a2a00',
      turtleUnder: '#ffcc66',
      frogDark: '#c07800',
      eye: '#120a00',
      pupil: '#ffcc66',
      hudLabel: '#c07800',
      timeOk: '#ffcc66',
      timeWarn: '#c07800',
      timeLow: '#ffcc66',
      scanline: 'rgba(0, 0, 0, 0.25)',
      hudBg: '#120a00',
      hudBorder: '#c07800',
      hudLabelCss: '#c07800',
      hudScore: '#ffcc66',
      hudScoreShadow: 'none',
      hudLives: '#ffcc66',
      hudLivesShadow: 'none',
      hudLevel: '#ffcc66',
      hudLevelShadow: 'none',
      modalBg: '#120a00',
      modalBorder: '#c07800',
      modalShadow: 'none',
      modalTitle: '#ffcc66',
      modalTitleShadow: 'none',
      modalFinal: '#ffcc66',
      modalFinalShadow: 'none',
      modalLabel: '#c07800',
    },
  },
}
