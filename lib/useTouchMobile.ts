'use client'

import { useSyncExternalStore } from 'react'

// Detección de móvil táctil y orientación (SPEC 10).
// Snapshot de servidor = false: el layout móvil se activa tras hidratar.

export const MOBILE_QUERY = '(pointer: coarse) and (max-width: 900px)'
export const LANDSCAPE_QUERY = '(orientation: landscape)'

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

export function useIsTouchMobile(): boolean {
  return useMediaQuery(MOBILE_QUERY)
}

export function useIsLandscape(): boolean {
  return useMediaQuery(LANDSCAPE_QUERY)
}
