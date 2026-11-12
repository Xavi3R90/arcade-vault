'use client'

import { useSyncExternalStore } from 'react'

// ── Preferencia de controles táctiles (SPEC 10) ───────────────────────────
// 'on' | 'off' se persisten en localStorage['av-touch-controls'].
// 'auto' = no hay clave: se decide por matchMedia('(pointer: coarse)').
// Si localStorage falla, la preferencia se mantiene en memoria (como lib/skins.ts).

export const TOUCH_STORAGE_KEY = 'av-touch-controls'

export type TouchPref = 'on' | 'off' | 'auto'

const TOUCH_EVENT = 'av-touch-controls-change'
const COARSE_QUERY = '(pointer: coarse)'

let memoryPref: TouchPref = 'auto'

const isStoredPref = (v: unknown): v is 'on' | 'off' => v === 'on' || v === 'off'

export function readTouchPref(): TouchPref {
  try {
    const stored = localStorage.getItem(TOUCH_STORAGE_KEY)
    if (isStoredPref(stored)) return stored
    if (stored === null) return 'auto'
  } catch {
    // localStorage no disponible
  }
  return memoryPref
}

export function writeTouchPref(pref: TouchPref) {
  memoryPref = pref
  try {
    if (pref === 'auto') localStorage.removeItem(TOUCH_STORAGE_KEY)
    else localStorage.setItem(TOUCH_STORAGE_KEY, pref)
  } catch {
    // localStorage no disponible: queda en memoria
  }
  window.dispatchEvent(new Event(TOUCH_EVENT))
}

export function subscribeTouchPref(cb: () => void) {
  const mql = window.matchMedia(COARSE_QUERY)
  window.addEventListener(TOUCH_EVENT, cb)
  window.addEventListener('storage', cb)
  mql.addEventListener('change', cb)
  return () => {
    window.removeEventListener(TOUCH_EVENT, cb)
    window.removeEventListener('storage', cb)
    mql.removeEventListener('change', cb)
  }
}

function readVisible(): boolean {
  const pref = readTouchPref()
  if (pref === 'on') return true
  if (pref === 'off') return false
  return window.matchMedia(COARSE_QUERY).matches
}

const serverVisible = () => false
const serverPref = (): TouchPref => 'auto'

/** true si los controles táctiles deben mostrarse. Servidor = false. */
export function useTouchControlsVisible(): boolean {
  return useSyncExternalStore(subscribeTouchPref, readVisible, serverVisible)
}

/** Preferencia actual ('auto' | 'on' | 'off'), reactiva. Servidor = 'auto'. */
export function useTouchPref(): TouchPref {
  return useSyncExternalStore(subscribeTouchPref, readTouchPref, serverPref)
}
