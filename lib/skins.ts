export type SkinId = 'classic' | 'neon' | 'retro'

export const DEFAULT_SKIN: SkinId = 'classic'

export const SKIN_STORAGE_KEY = 'av-skin'

export const SKINS: { id: SkinId; label: string; description: string }[] = [
  { id: 'classic', label: 'CLÁSICO', description: 'La paleta original del juego' },
  { id: 'neon', label: 'NEÓN', description: 'Saturado, con glow' },
  { id: 'retro', label: 'RETRO', description: 'Fósforo / 8 bits, paleta limitada' },
]

export const isSkinId = (v: unknown): v is SkinId => SKINS.some((s) => s.id === v)

// ── Store del skin activo (para useSyncExternalStore) ─────────────────────
// Persistido en localStorage['av-skin']; si localStorage falla, se mantiene en memoria.
const SKIN_EVENT = 'av-skin-change'
let memorySkin: SkinId = DEFAULT_SKIN

export function readSkin(): SkinId {
  try {
    const stored = localStorage.getItem(SKIN_STORAGE_KEY)
    if (isSkinId(stored)) return stored
  } catch {
    // localStorage no disponible
  }
  return memorySkin
}

export function writeSkin(skin: SkinId) {
  memorySkin = skin
  try {
    localStorage.setItem(SKIN_STORAGE_KEY, skin)
  } catch {
    // localStorage no disponible: queda en memoria
  }
  window.dispatchEvent(new Event(SKIN_EVENT))
}

export function subscribeSkin(cb: () => void) {
  window.addEventListener(SKIN_EVENT, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(SKIN_EVENT, cb)
    window.removeEventListener('storage', cb)
  }
}

export const serverSkin = (): SkinId => DEFAULT_SKIN

export interface GamePalette {
  bg: string
  grid: string
  fg: string
  accent: string
  danger: string
  text: string
  glow: number // shadowBlur; 0 = sin glow
  scanlines: boolean
  extra: Record<string, string | string[]>
}
