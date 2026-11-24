'use client'

import { useState } from 'react'
import type { Route, User } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { authErrorMessage, MSG, PASSWORD_MIN, USERNAME_PATTERN } from '@/lib/authErrors'
import { refreshProfile } from '@/lib/authStore'

interface AccountScreenProps {
  navigate: (r: Route) => void
  user: User
}

type Status = { kind: 'ok' | 'error'; text: string } | null

const sanitizeUsername = (v: string) =>
  v
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '')
    .slice(0, 10)

function StatusBox({ status }: { status: Status }) {
  if (!status) return null
  return status.kind === 'ok' ? (
    <div className="account-ok" role="status">
      {status.text}
    </div>
  ) : (
    <div className="auth-error" role="alert">
      {status.text}
    </div>
  )
}

// SPEC 12 — Pantalla "Mi cuenta": cambiar nombre de jugador y contraseña.
export default function AccountScreen({ navigate, user }: AccountScreenProps) {
  const [name, setName] = useState(user.name)
  const [nameBusy, setNameBusy] = useState(false)
  const [nameStatus, setNameStatus] = useState<Status>(null)

  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [passBusy, setPassBusy] = useState(false)
  const [passStatus, setPassStatus] = useState<Status>(null)

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault()
    if (nameBusy) return
    setNameStatus(null)
    if (!USERNAME_PATTERN.test(name)) {
      setNameStatus({ kind: 'error', text: MSG.usernameInvalid })
      return
    }
    if (name === user.name) {
      setNameStatus({ kind: 'ok', text: '▸ ESE YA ES TU NOMBRE.' })
      return
    }
    setNameBusy(true)
    try {
      const supabase = createClient()
      const { count, error: countErr } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('username', name)
      if (countErr) throw countErr
      if (count) {
        setNameStatus({ kind: 'error', text: MSG.usernameTaken })
        return
      }
      const { data, error } = await supabase
        .from('profiles')
        .update({ username: name })
        .eq('id', user.id)
        .select('id')
      if (error) throw error
      if (!data?.length) throw new Error('profile not updated')
      await refreshProfile()
      setNameStatus({ kind: 'ok', text: '▸ NOMBRE ACTUALIZADO.' })
    } catch (err) {
      setNameStatus({ kind: 'error', text: authErrorMessage(err) })
    } finally {
      setNameBusy(false)
    }
  }

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (passBusy) return
    setPassStatus(null)
    if (pass.length < PASSWORD_MIN) {
      setPassStatus({ kind: 'error', text: MSG.passwordShort })
      return
    }
    if (pass !== pass2) {
      setPassStatus({ kind: 'error', text: MSG.passwordMismatch })
      return
    }
    setPassBusy(true)
    try {
      const { error } = await createClient().auth.updateUser({ password: pass })
      if (error) throw error
      setPass('')
      setPass2('')
      setPassStatus({ kind: 'ok', text: '▸ CONTRASEÑA ACTUALIZADA.' })
    } catch (err) {
      setPassStatus({ kind: 'error', text: authErrorMessage(err) })
    } finally {
      setPassBusy(false)
    }
  }

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card account-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">MI CUENTA</h2>
          {user.email && <div className="account-email">{user.email}</div>}
        </div>

        <section className="account-section" aria-labelledby="account-name-title">
          <h3 id="account-name-title">Nombre de jugador</h3>
          <p className="auth-hint">
            Así apareces en el Salón de la Fama. Al cambiarlo se actualizan también tus puntuaciones
            anteriores.
          </p>
          <form onSubmit={saveName}>
            <div className="field">
              <label htmlFor="account-username">Nombre</label>
              <input
                id="account-username"
                value={name}
                onChange={(e) => setName(sanitizeUsername(e.target.value))}
                autoComplete="username"
                required
                minLength={3}
                maxLength={10}
                pattern="[A-Z0-9_]{3,10}"
              />
              <div className="auth-hint">3–10 caracteres: letras, números o _</div>
            </div>
            <button className="btn" type="submit" disabled={nameBusy} aria-busy={nameBusy}>
              {nameBusy ? 'CARGANDO…' : 'GUARDAR NOMBRE'}
            </button>
            <StatusBox status={nameStatus} />
          </form>
        </section>

        <section className="account-section" aria-labelledby="account-pass-title">
          <h3 id="account-pass-title">Contraseña</h3>
          {user.hasPassword ? (
            <form onSubmit={savePassword}>
              <div className="field">
                <label htmlFor="account-pass">Contraseña nueva</label>
                <input
                  id="account-pass"
                  type="password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  minLength={PASSWORD_MIN}
                />
                <div className="auth-hint">Mínimo {PASSWORD_MIN} caracteres</div>
              </div>
              <div className="field">
                <label htmlFor="account-pass2">Repite la contraseña</label>
                <input
                  id="account-pass2"
                  type="password"
                  value={pass2}
                  onChange={(e) => setPass2(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  minLength={PASSWORD_MIN}
                />
              </div>
              <button className="btn" type="submit" disabled={passBusy} aria-busy={passBusy}>
                {passBusy ? 'CARGANDO…' : 'CAMBIAR CONTRASEÑA'}
              </button>
              <StatusBox status={passStatus} />
            </form>
          ) : (
            <p className="account-oauth">
              TU CUENTA USA GOOGLE/GITHUB. NO TIENE CONTRASEÑA PROPIA.
            </p>
          )}
        </section>

        <button
          className="btn ghost"
          type="button"
          style={{ width: '100%', marginTop: 8 }}
          onClick={() => navigate({ name: 'games' })}
        >
          VOLVER A LA BIBLIOTECA
        </button>
      </div>
    </div>
  )
}
