'use client'

import { useState } from 'react'
import type { Route } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { authErrorMessage, MSG, PASSWORD_MIN, USERNAME_PATTERN } from '@/lib/authErrors'
import { refreshProfile, signOut } from '@/lib/authStore'

export type AuthMode = 'in' | 'up' | 'check-email' | 'forgot' | 'reset' | 'username'

interface AuthProps {
  navigate: (r: Route) => void
  initialMode?: AuthMode
  initialError?: string
  // Solo en modo 'username': id del usuario OAuth que aún no tiene nombre.
  pendingUserId?: string
}

type OAuthProvider = 'google' | 'github'

const callbackUrl = (next: 'confirmed' | 'recovery' | 'oauth') =>
  `${window.location.origin}/auth/callback?next=${next}`

// Nombre de jugador: se escribe ya en mayúsculas y sin caracteres no permitidos.
const sanitizeUsername = (v: string) =>
  v
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '')
    .slice(0, 10)

export default function Auth({
  navigate,
  initialMode = 'in',
  initialError,
  pendingUserId,
}: AuthProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [error, setError] = useState<string | null>(initialError ?? null)
  const [loading, setLoading] = useState(false)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [sentTo, setSentTo] = useState('')
  const [sentKind, setSentKind] = useState<'signup' | 'recovery'>('signup')

  const switchMode = (m: AuthMode) => {
    setMode(m)
    setError(null)
  }

  const signIn = async () => {
    const { error: err } = await createClient().auth.signInWithPassword({
      email: email.trim(),
      password: pass,
    })
    if (err) throw err
    navigate({ name: 'games' })
  }

  const signUp = async () => {
    if (!USERNAME_PATTERN.test(username)) {
      setError(MSG.usernameInvalid)
      return
    }
    if (pass.length < PASSWORD_MIN) {
      setError(MSG.passwordShort)
      return
    }
    const supabase = createClient()
    const { count, error: countErr } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('username', username)
    if (countErr) throw countErr
    if (count) {
      setError(MSG.usernameTaken)
      return
    }
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password: pass,
      options: { data: { username }, emailRedirectTo: callbackUrl('confirmed') },
    })
    if (err) throw err
    // Email ya registrado (p. ej. con Google/GitHub): Supabase responde 200 con un usuario
    // sin identidades y NO envía correo (protección contra enumeración de emails).
    if (data.user && data.user.identities?.length === 0) {
      setError(MSG.emailTaken)
      return
    }
    setSentTo(email.trim())
    setSentKind('signup')
    setPass('')
    setMode('check-email')
  }

  const requestReset = async () => {
    const { error: err } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: callbackUrl('recovery'),
    })
    if (err) throw err
    setSentTo(email.trim())
    setSentKind('recovery')
    setMode('check-email')
  }

  // Llega con la sesión de recuperación que abrió /auth/callback?next=recovery.
  const saveNewPassword = async () => {
    if (pass.length < PASSWORD_MIN) {
      setError(MSG.passwordShort)
      return
    }
    if (pass !== pass2) {
      setError(MSG.passwordMismatch)
      return
    }
    const { error: err } = await createClient().auth.updateUser({ password: pass })
    if (err) throw err
    navigate({ name: 'games' })
  }

  // Primer login OAuth: el perfil existe (trigger) pero sin username.
  const chooseUsername = async () => {
    if (!USERNAME_PATTERN.test(username)) {
      setError(MSG.usernameInvalid)
      return
    }
    if (!pendingUserId) throw new Error('missing user id')
    const { data, error: err } = await createClient()
      .from('profiles')
      .update({ username })
      .eq('id', pendingUserId)
      .select('id')
    if (err) throw err
    if (!data?.length) throw new Error('profile not updated')
    await refreshProfile()
    navigate({ name: 'games' })
  }

  const oauth = async (provider: OAuthProvider) => {
    if (loading) return
    setError(null)
    setLoading(true)
    const { error: err } = await createClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo: callbackUrl('oauth') },
    })
    // Si va bien, el navegador sale hacia el proveedor; solo volvemos aquí si falla.
    if (err) {
      setError(authErrorMessage(err))
      setLoading(false)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setError(null)
    setLoading(true)
    try {
      if (mode === 'up') await signUp()
      else if (mode === 'username') await chooseUsername()
      else if (mode === 'forgot') await requestReset()
      else if (mode === 'reset') await saveNewPassword()
      else await signIn()
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const header = (
    <div className="auth-header">
      <div className="mark"></div>
      <h2 className="neon-cyan">ARCADE VAULT</h2>
      <div
        className="mono"
        style={{
          fontSize: 11,
          color: 'var(--ink-faint)',
          letterSpacing: '0.16em',
          marginTop: 6,
        }}
      >
        ACCESO AL SISTEMA · v2.6
      </div>
    </div>
  )

  if (mode === 'check-email') {
    return (
      <div className="av-auth-wrap fade-in">
        <div className="auth-card">
          {header}
          <div className="auth-sent" role="status">
            <h3 className="neon-green">REVISA TU CORREO</h3>
            <p>
              Hemos enviado un enlace a <strong>{sentTo || 'tu email'}</strong>. Ábrelo en este
              mismo navegador para{' '}
              {sentKind === 'recovery' ? 'elegir una contraseña nueva' : 'activar tu cuenta'}.
            </p>
            <p className="auth-hint">¿No llega? Mira en spam o espera un par de minutos.</p>
          </div>
          <button
            className="btn lg"
            type="button"
            style={{ width: '100%', marginTop: 8 }}
            onClick={() => switchMode('in')}
          >
            VOLVER A INICIAR SESIÓN
          </button>
        </div>
      </div>
    )
  }

  const errorBox = error && (
    <div className="auth-error" role="alert">
      {error}
    </div>
  )

  if (mode === 'username') {
    return (
      <div className="av-auth-wrap fade-in">
        <div className="auth-card">
          {header}
          <div className="auth-sent">
            <h3 className="neon-cyan">ELIGE TU NOMBRE</h3>
            <p>
              Es el nombre con el que aparecerás en el Salón de la Fama. Podrás cambiarlo en tu
              cuenta.
            </p>
          </div>
          <form onSubmit={submit}>
            <div className="field">
              <label htmlFor="auth-username">Nombre de jugador</label>
              <input
                id="auth-username"
                value={username}
                onChange={(e) => setUsername(sanitizeUsername(e.target.value))}
                placeholder="PX_KAI"
                autoComplete="username"
                autoFocus
                required
                minLength={3}
                maxLength={10}
                pattern="[A-Z0-9_]{3,10}"
              />
              <div className="auth-hint">3–10 caracteres: letras, números o _</div>
            </div>
            <button
              className="btn lg"
              type="submit"
              disabled={loading}
              aria-busy={loading}
              style={{ width: '100%', marginTop: 8 }}
            >
              {loading ? 'CARGANDO…' : 'GUARDAR Y JUGAR'}
            </button>
            {errorBox}
          </form>
          <button
            className="btn ghost"
            type="button"
            style={{ width: '100%', marginTop: 10 }}
            onClick={() => void signOut()}
          >
            CERRAR SESIÓN
          </button>
        </div>
      </div>
    )
  }

  if (mode === 'forgot' || mode === 'reset') {
    const isReset = mode === 'reset'
    return (
      <div className="av-auth-wrap fade-in">
        <div className="auth-card">
          {header}
          <div className="auth-sent">
            <h3 className="neon-cyan">{isReset ? 'NUEVA CONTRASEÑA' : 'RECUPERAR CONTRASEÑA'}</h3>
            <p>
              {isReset
                ? 'Elige la contraseña con la que entrarás a partir de ahora.'
                : 'Escribe el email de tu cuenta y te enviaremos un enlace para cambiar la contraseña.'}
            </p>
          </div>
          <form onSubmit={submit}>
            {isReset ? (
              <>
                <div className="field">
                  <label htmlFor="auth-new-pass">Contraseña nueva</label>
                  <input
                    id="auth-new-pass"
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
                  <label htmlFor="auth-new-pass2">Repite la contraseña</label>
                  <input
                    id="auth-new-pass2"
                    type="password"
                    value={pass2}
                    onChange={(e) => setPass2(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    required
                    minLength={PASSWORD_MIN}
                  />
                </div>
              </>
            ) : (
              <div className="field">
                <label htmlFor="auth-email">Correo electrónico</label>
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jugador@vault.gg"
                  autoComplete="email"
                  required
                />
              </div>
            )}
            <button
              className="btn lg"
              type="submit"
              disabled={loading}
              aria-busy={loading}
              style={{ width: '100%', marginTop: 8 }}
            >
              {loading ? 'CARGANDO…' : isReset ? 'GUARDAR CONTRASEÑA' : 'ENVIAR ENLACE'}
            </button>
            {errorBox}
          </form>
          {!isReset && (
            <button
              className="btn ghost"
              type="button"
              style={{ width: '100%', marginTop: 10 }}
              onClick={() => switchMode('in')}
            >
              VOLVER A INICIAR SESIÓN
            </button>
          )}
        </div>
      </div>
    )
  }

  const isUp = mode === 'up'

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        {header}

        <div className="auth-tabs">
          <button type="button" className={!isUp ? 'on' : ''} onClick={() => switchMode('in')}>
            INICIAR SESIÓN
          </button>
          <button type="button" className={isUp ? 'on' : ''} onClick={() => switchMode('up')}>
            CREAR CUENTA
          </button>
        </div>

        <form onSubmit={submit}>
          {isUp && (
            <div className="field slide-in">
              <label htmlFor="auth-username">Nombre de jugador</label>
              <input
                id="auth-username"
                value={username}
                onChange={(e) => setUsername(sanitizeUsername(e.target.value))}
                placeholder="PX_KAI"
                autoComplete="username"
                required
                minLength={3}
                maxLength={10}
                pattern="[A-Z0-9_]{3,10}"
              />
              <div className="auth-hint">3–10 caracteres: letras, números o _</div>
            </div>
          )}
          <div className="field">
            <label htmlFor="auth-email">Correo electrónico</label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jugador@vault.gg"
              autoComplete="email"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="auth-pass">Contraseña</label>
            <input
              id="auth-pass"
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
              autoComplete={isUp ? 'new-password' : 'current-password'}
              required
              minLength={isUp ? PASSWORD_MIN : undefined}
            />
          </div>
          <button
            className="btn lg"
            type="submit"
            disabled={loading}
            aria-busy={loading}
            style={{ width: '100%', marginTop: 8 }}
          >
            {loading ? 'CARGANDO…' : isUp ? 'CREAR CUENTA' : 'ENTRAR AL VAULT'}
          </button>
          {errorBox}
          {!isUp && (
            <button type="button" className="auth-link" onClick={() => switchMode('forgot')}>
              ¿Olvidaste tu contraseña?
            </button>
          )}
        </form>

        <button
          className="btn ghost"
          type="button"
          style={{ width: '100%', marginTop: 10 }}
          onClick={() => navigate({ name: 'games' })}
        >
          JUGAR COMO INVITADO
        </button>

        <div className="auth-divider">O CONTINÚA CON</div>
        <div className="social">
          <button
            className="btn ghost"
            type="button"
            disabled={loading}
            onClick={() => void oauth('google')}
          >
            ◆ GOOGLE
          </button>
          <button
            className="btn ghost"
            type="button"
            disabled={loading}
            onClick={() => void oauth('github')}
          >
            ▣ GITHUB
          </button>
        </div>

        <div
          style={{
            marginTop: 18,
            textAlign: 'center',
            fontSize: 11,
            color: 'var(--ink-faint)',
            letterSpacing: '0.1em',
          }}
        >
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  )
}
