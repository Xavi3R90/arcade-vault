'use client'

import { useTouchPref, writeTouchPref, type TouchPref } from '@/lib/touch-controls'

// Ciclo del toggle (SPEC 10): AUTO → ON → OFF → AUTO
const NEXT: Record<TouchPref, TouchPref> = { auto: 'on', on: 'off', off: 'auto' }

const LABEL: Record<TouchPref, string> = { auto: 'AUTO', on: 'ON', off: 'OFF' }

const HINT: Record<TouchPref, string> = {
  auto: 'automático según el dispositivo',
  on: 'siempre visibles',
  off: 'ocultos',
}

export default function TouchToggle({ className }: { className?: string }) {
  const pref = useTouchPref()

  return (
    <button
      type="button"
      className={'btn ghost touch-toggle ' + (className ?? '')}
      data-pref={pref}
      onClick={() => writeTouchPref(NEXT[pref])}
      aria-label={`Controles táctiles: ${HINT[pref]}. Pulsa para cambiar.`}
      title={`Controles táctiles: ${HINT[pref]}`}
    >
      CONTROLES: {LABEL[pref]}
    </button>
  )
}
