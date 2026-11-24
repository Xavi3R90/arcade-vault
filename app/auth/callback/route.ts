import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// SPEC 12 — destino de los enlaces de email (confirmación, recuperación) y de OAuth.
// Canjea el código PKCE por una sesión (cookies) y vuelve al shell con `?auth=<motivo>`.

const NEXT_VALUES = ['confirmed', 'recovery', 'oauth'] as const
type NextValue = (typeof NEXT_VALUES)[number]

function isNextValue(v: string | null): v is NextValue {
  return v !== null && (NEXT_VALUES as readonly string[]).includes(v)
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  const back = (value: NextValue | 'error') => NextResponse.redirect(`${origin}/?auth=${value}`)

  // Supabase devuelve `error`/`error_description` si el enlace caducó o el usuario
  // canceló en el proveedor OAuth.
  if (!code || !isNextValue(next) || searchParams.has('error')) return back('error')

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return back('error')

  return back(next)
}
