'use client'

import { useState } from 'react'
import type { Route, User } from '@/lib/types'
import { SKINS, type SkinId } from '@/lib/skins'

interface NavProps {
  route: Route
  navigate: (r: Route) => void
  user: User | null
  onSignOut: () => void
  skin: SkinId
  onSkinChange: (s: SkinId) => void
}

function SkinSwitch({
  skin,
  onSkinChange,
  className,
}: {
  skin: SkinId
  onSkinChange: (s: SkinId) => void
  className?: string
}) {
  return (
    <div
      className={'skin-switch ' + (className ?? '')}
      role="group"
      aria-label="Skin de los juegos"
    >
      <span className="skin-switch-label" aria-hidden="true">
        SKIN
      </span>
      {SKINS.map((s) => (
        <button
          key={s.id}
          type="button"
          className={'skin-opt' + (skin === s.id ? ' active' : '')}
          data-skin-opt={s.id}
          aria-pressed={skin === s.id}
          aria-label={s.label}
          title={`${s.label} · ${s.description}`}
          onClick={() => onSkinChange(s.id)}
        >
          <span className="skin-swatch" aria-hidden="true" />
          <span className="skin-name">{s.label}</span>
        </button>
      ))}
    </div>
  )
}

export default function Nav({ route, navigate, user, onSignOut, skin, onSkinChange }: NavProps) {
  const [open, setOpen] = useState(false)

  const isActive = (name: string) =>
    route.name === name ||
    (name === 'games' && route.name === 'detalle') ||
    (name === 'games' && route.name === 'player')

  const go = (r: Route) => {
    setOpen(false)
    navigate(r)
  }

  return (
    <>
      <nav className="av-nav">
        <div className="logo" onClick={() => go({ name: 'games' })}>
          <div className="logo-mark"></div>
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </div>

        <div className="links">
          <a className={isActive('games') ? 'active' : ''} onClick={() => go({ name: 'games' })}>
            Biblioteca
          </a>
          <a className={isActive('salon') ? 'active' : ''} onClick={() => go({ name: 'salon' })}>
            Salón de la Fama
          </a>
          <a className={isActive('about') ? 'active' : ''} onClick={() => go({ name: 'about' })}>
            Acerca
          </a>
        </div>

        <div className="spacer"></div>

        <SkinSwitch skin={skin} onSkinChange={onSkinChange} className="skin-switch-bar" />

        <div className="coin-counter">
          <span className="coin"></span>
          <span>CRÉDITOS · 03</span>
        </div>

        {user ? (
          <button className="btn ghost auth-btn" onClick={onSignOut}>
            {user.name} ▾
          </button>
        ) : (
          <button className="btn auth-btn" onClick={() => go({ name: 'auth' })}>
            Iniciar Sesión
          </button>
        )}

        <button className="btn ghost hamburger" onClick={() => setOpen(true)} aria-label="Menú">
          ≡
        </button>
      </nav>

      <div
        className={'av-mobile-backdrop' + (open ? ' open' : '')}
        onClick={() => setOpen(false)}
      />
      <aside className={'av-mobile-panel' + (open ? ' open' : '')}>
        <div className="pixel neon-cyan" style={{ fontSize: 11, marginBottom: 16 }}>
          MENÚ
        </div>
        <a className={isActive('games') ? 'active' : ''} onClick={() => go({ name: 'games' })}>
          Biblioteca
        </a>
        <a className={isActive('salon') ? 'active' : ''} onClick={() => go({ name: 'salon' })}>
          Salón de la Fama
        </a>
        <a className={isActive('about') ? 'active' : ''} onClick={() => go({ name: 'about' })}>
          Acerca
        </a>
        <a className={isActive('auth') ? 'active' : ''} onClick={() => go({ name: 'auth' })}>
          {user ? 'Cuenta' : 'Iniciar Sesión'}
        </a>
        <SkinSwitch skin={skin} onSkinChange={onSkinChange} className="skin-switch-panel" />
        <div style={{ flex: 1 }} />
        <div
          className="pixel"
          style={{ fontSize: 9, color: 'var(--ink-faint)', letterSpacing: '0.16em' }}
        >
          CRÉDITOS · 03
        </div>
      </aside>
    </>
  )
}
