# SPEC 04 — Integración base de Supabase

> **Status:** Aprobado
> **Depends on:** SPEC 01
> **Date:** 2026-09-22
> **Objective:** Instalar y configurar Supabase (cliente browser, cliente servidor y middleware de sesión) como capa de datos y autenticación lista para ser usada por specs posteriores.

---

## Scope

**In:**

- `package.json`: instalar `@supabase/supabase-js` y `@supabase/ssr` vía `npm install`.
- `.env.template`: añadir `NEXT_PUBLIC_SUPABASE_URL=` y `NEXT_PUBLIC_SUPABASE_ANON_KEY=` con valores vacíos.
- `.env.local`: añadir `NEXT_PUBLIC_SUPABASE_URL=` y `NEXT_PUBLIC_SUPABASE_ANON_KEY=` con los valores reales del proyecto.
- `lib/supabase/client.ts`: nuevo, cliente de browser con `createBrowserClient` de `@supabase/ssr`.
- `lib/supabase/server.ts`: nuevo, cliente de servidor con `createServerClient` de `@supabase/ssr`, compatible con Server Components y Route Handlers.
- `middleware.ts`: nuevo (en la raíz del proyecto), refresca la sesión de Supabase en cada request mediante `createServerClient`.

**Out of scope:**

- Autenticación real (sign up, sign in, OAuth) — spec posterior.
- Tablas de base de datos (scores, perfiles) — specs posteriores.
- Funciones Edge de Supabase — spec posterior.
- Tiempo real (Supabase Realtime) — spec posterior.
- UI de login/registro (reemplazar la pantalla `/auth` actual) — spec posterior.
- Row Level Security (RLS) — se configurará cuando se definan las tablas.

---

## Data model

No se introducen tablas ni interfaces nuevas. El proyecto de Supabase ya existe y está vacío.

Variables de entorno nuevas:

```
NEXT_PUBLIC_SUPABASE_URL=        # URL del proyecto Supabase (pública)
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # clave anon/public del proyecto Supabase (pública)
```

Ambas llevan el prefijo `NEXT_PUBLIC_` porque el cliente de browser las necesita en el bundle del cliente.

---

## Implementation plan

1. **Instalar paquetes:** ejecutar `npm install @supabase/supabase-js @supabase/ssr`. Test: `package.json` incluye ambos en `dependencies`.

2. **Actualizar `.env.template`:** añadir las dos variables con valores vacíos y un comentario indicando dónde obtenerlas (panel de Supabase → Project Settings → API). Test: el archivo queda documentado para nuevos colaboradores.

3. **Actualizar `.env.local`:** añadir las dos variables con los valores reales del proyecto Supabase. Verificar que `.gitignore` ya incluye `.env.local`. Test: las variables son accesibles en `process.env` al arrancar el servidor de desarrollo.

4. **Crear `lib/supabase/client.ts`:** exportar función `createClient()` que llama a `createBrowserClient(url, anonKey)` de `@supabase/ssr`. Este cliente se usará exclusivamente en Client Components (`'use client'`). Test: archivo existe sin errores de TypeScript.

5. **Crear `lib/supabase/server.ts`:** exportar función async `createClient()` que llama a `createServerClient(url, anonKey, { cookies })` de `@supabase/ssr`, obteniendo el cookie store con `await cookies()` de `next/headers`. Este cliente se usará en Server Components y Route Handlers. Test: archivo existe sin errores de TypeScript.

6. **Crear `middleware.ts` en la raíz del proyecto:** implementar el middleware de Supabase SSR que refresca la sesión en cada request. Incluir el `matcher` para excluir archivos estáticos (`_next/static`, `_next/image`, `favicon.ico`, imágenes). Test: `npm run dev` arranca sin errores de middleware.

7. **Verificación final:** ejecutar `npm run build`. Test: build termina sin errores de TypeScript ni de compilación. Los tres archivos `lib/supabase/client.ts`, `lib/supabase/server.ts` y `middleware.ts` existen en el proyecto.

---

## Acceptance criteria

- [ ] `package.json` incluye `@supabase/supabase-js` y `@supabase/ssr` en `dependencies`.
- [ ] `.env.template` contiene `NEXT_PUBLIC_SUPABASE_URL=` y `NEXT_PUBLIC_SUPABASE_ANON_KEY=` con valores vacíos.
- [ ] `.env.local` contiene los valores reales de las dos variables (no commiteado).
- [ ] `lib/supabase/client.ts` existe y exporta `createClient()` usando `createBrowserClient`.
- [ ] `lib/supabase/server.ts` existe y exporta `createClient()` async usando `createServerClient` con cookie store de `next/headers`.
- [ ] `middleware.ts` existe en la raíz y contiene el `matcher` de Supabase SSR.
- [ ] `npm run build` termina sin errores de TypeScript ni de compilación.
- [ ] No hay errores en consola al navegar por todas las pantallas existentes (Home, Library, About, Auth, HallOfFame).

---

## Decisiones

- **`@supabase/ssr` + `@supabase/supabase-js` desde este spec** — instalando ambos ahora, el spec de auth solo necesita implementar lógica, sin preocuparse por setup de paquetes.
- **Tres archivos de cliente separados** (`client.ts`, `server.ts`, `middleware.ts`) — patrón oficial de Supabase para Next.js App Router; mezclarlos causaría errores de runtime por uso de APIs de Node en el bundle del cliente.
- **Prefijo `NEXT_PUBLIC_` en las variables** — URL y anon key son credenciales públicas; no contienen información sensible y el cliente browser las necesita en el bundle. Las claves de servicio (service role) se añadirán sin ese prefijo cuando sean necesarias.
- **Sin verificación con llamada real a Supabase** — código de prueba temporal que luego se borra introduce ruido en el historial; `npm run build` es suficiente para validar la integración base.
- **Middleware en este spec, no en el de auth** — sin el middleware las cookies de sesión expiran silenciosamente; es una dependencia de la capa base, no de la lógica de autenticación.
- **Sin RLS en este spec** — no hay tablas aún; se configurará junto con cada tabla en sus specs respectivos.

---

## Riesgos

| Riesgo                                                           | Mitigación                                                                                                                 |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `.env.local` accidentalmente en el repo                          | Verificar que `.gitignore` ya contiene `.env.local` antes del commit                                                       |
| `cookies()` de `next/headers` llamado en un Client Component     | El cliente de servidor solo se importa desde `lib/supabase/server.ts`; los Client Components usan `lib/supabase/client.ts` |
| El middleware intercepta rutas estáticas y ralentiza el servidor | El `matcher` excluye `_next/static`, `_next/image`, `favicon.ico` e imágenes                                               |
