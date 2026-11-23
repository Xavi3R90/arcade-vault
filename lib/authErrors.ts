// SPEC 12 — Traducción al español de los errores de Supabase Auth / PostgREST.

export const USERNAME_PATTERN = /^[A-Z0-9_]{3,10}$/
export const PASSWORD_MIN = 8

export const MSG = {
  linkInvalid: 'ENLACE NO VÁLIDO O CADUCADO. ÁBRELO EN EL MISMO NAVEGADOR DONDE LO PEDISTE.',
  usernameTaken: 'NOMBRE DE JUGADOR OCUPADO. PRUEBA CON OTRO.',
  usernameInvalid: 'EL NOMBRE DEBE TENER DE 3 A 10 CARACTERES: LETRAS, NÚMEROS O _.',
  passwordShort: `LA CONTRASEÑA DEBE TENER AL MENOS ${PASSWORD_MIN} CARACTERES.`,
  passwordMismatch: 'LAS CONTRASEÑAS NO COINCIDEN.',
  generic: 'ALGO HA FALLADO. INTÉNTALO DE NUEVO EN UNOS SEGUNDOS.',
} as const

const BY_CODE: Record<string, string> = {
  invalid_credentials: 'EMAIL O CONTRASEÑA INCORRECTOS.',
  email_not_confirmed: 'CONFIRMA TU EMAIL ANTES DE ENTRAR. REVISA TU BANDEJA DE ENTRADA.',
  user_already_exists: 'YA EXISTE UNA CUENTA CON ESE EMAIL.',
  email_exists: 'YA EXISTE UNA CUENTA CON ESE EMAIL.',
  email_address_invalid: 'ESE EMAIL NO ES VÁLIDO.',
  weak_password: MSG.passwordShort,
  same_password: 'LA NUEVA CONTRASEÑA DEBE SER DISTINTA DE LA ACTUAL.',
  over_email_send_rate_limit:
    'DEMASIADOS EMAILS ENVIADOS. ESPERA UNOS MINUTOS Y VUELVE A INTENTARLO.',
  over_request_rate_limit: 'DEMASIADOS INTENTOS. ESPERA UNOS MINUTOS Y VUELVE A INTENTARLO.',
  signup_disabled: 'EL REGISTRO ESTÁ DESACTIVADO AHORA MISMO.',
  session_not_found: 'TU SESIÓN HA CADUCADO. VUELVE A INICIAR SESIÓN.',
  // Violación de unique en profiles.username (PostgREST)
  '23505': MSG.usernameTaken,
  // Violación del CHECK de formato de profiles.username
  '23514': MSG.usernameInvalid,
}

interface ErrorLike {
  code?: string
  message?: string
}

export function authErrorMessage(err: unknown): string {
  if (!err || typeof err !== 'object') return MSG.generic
  const { code, message = '' } = err as ErrorLike
  if (code && BY_CODE[code]) return BY_CODE[code]
  // El trigger handle_new_user falla si el username choca (carrera con la comprobación previa).
  if (/database error saving new user/i.test(message)) return MSG.usernameTaken
  if (/invalid login credentials/i.test(message)) return BY_CODE.invalid_credentials
  if (/email not confirmed/i.test(message)) return BY_CODE.email_not_confirmed
  if (/password should be at least/i.test(message)) return MSG.passwordShort
  // updateUser sin sesión (p. ej. enlace de recuperación caducado): AuthSessionMissingError
  if (/auth session missing/i.test(message)) return BY_CODE.session_not_found
  return MSG.generic
}
