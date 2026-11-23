# SPEC 12 — Registro, login y autenticación con Supabase

> **Status:** Aprobado
> **Depends on:** SPEC 01, SPEC 04, SPEC 06
> **Date:** 2026-11-23
> **Objetivo:** Sustituir el login simulado por autenticación real con Supabase (email + contraseña, Google y GitHub), con perfiles de jugador únicos y puntuaciones que solo pueden guardar los usuarios autenticados.

---

## Por qué este spec

Hoy `components/screens/Auth.tsx` es un mock: cualquier formulario "inicia sesión" y guarda `{ name }` en `localStorage['av_user']` (decisión de SPEC 01). Cualquiera puede insertar puntuaciones con cualquier nombre, y las tablas no tienen RLS (SPEC 06 lo dejó explícitamente para "el spec de auth").

SPEC 04 ya instaló `@supabase/ssr` y el `middleware.ts` que refresca la sesión. Este spec añade la lógica de autenticación encima de esa base.

El routing de la app es por estado en `app/page.tsx`, no file-based. Los enlaces de email y OAuth necesitan una URL real donde aterrizar. Por eso se añade un único route handler (`app/auth/callback/route.ts`) que canjea el código y redirige a `/?auth=<motivo>`. El shell lee ese parámetro una vez y abre la pantalla correcta.

El usuario decidió mantener todo en un único spec, aunque cubre base de datos, rutas, UI y configuración externa. El plan está ordenado para que cada paso deje la app funcionando.

---

## Scope

**In:**

- **Supabase — base de datos** (vía `mcp__supabase__apply_migration`, sin archivos SQL locales):
  - Tabla `public.profiles` (`id` = `auth.users.id`, `username` único).
  - Trigger `on_auth_user_created` que crea el perfil al registrarse.
  - Columna `scores.user_id` y trigger que fija `player_name` desde el perfil.
  - Trigger que propaga un cambio de `username` a los `scores` del usuario.
  - RLS en `profiles`, `scores` y `games`.
- **Supabase — configuración del panel** (paso manual del usuario): confirmación de email activada, Site URL, Redirect URLs y proveedores Google y GitHub.
- `app/auth/callback/route.ts` (nuevo): canjea el código (`exchangeCodeForSession`) y redirige a `/?auth=confirmed | recovery | oauth | error`.
- `lib/authStore.ts` (nuevo): store de sesión + perfil leído con `useSyncExternalStore` y alimentado por `supabase.auth.onAuthStateChange`. Sustituye a `lib/userStore.ts`, que se elimina.
- `lib/authErrors.ts` (nuevo): traducción al español de los errores de Supabase Auth.
- `lib/types.ts`: `User` pasa a incluir `id`, `email` y `hasPassword`. `RouteName` añade `'cuenta'`.
- `components/screens/Auth.tsx` (reescrito), con los modos:
  - **Iniciar sesión:** email + contraseña.
  - **Crear cuenta:** nombre de jugador + email + contraseña.
  - **Revisa tu correo:** tras registrarse o pedir recuperación.
  - **¿Olvidaste tu contraseña?:** pide el email y envía el enlace.
  - **Nueva contraseña:** al volver del enlace de recuperación.
  - **Elige tu nombre:** primer login OAuth sin `username`.
  - Botones GOOGLE y GITHUB funcionales.
  - Botón JUGAR COMO INVITADO (se mantiene).
  - Mensaje de error bajo el formulario y botón en estado `CARGANDO…` durante la petición.
- `components/screens/AccountScreen.tsx` (nuevo, ruta `'cuenta'`): cambiar nombre de jugador y cambiar contraseña.
- `components/Nav.tsx`: menú desplegable del usuario (nombre, MI CUENTA, CERRAR SESIÓN) en escritorio y en el menú móvil.
- `app/page.tsx`: usa `authStore`, lee `?auth=`, fuerza el modo "Elige tu nombre" si falta `username`, añade la ruta `'cuenta'`. `handleSaveScore` envía `user_id` y no guarda nada si no hay usuario.
- Modal de game over en `AsteroidsScreen`, `TetrisScreen`, `ArkanoidScreen`, `SnakeScreen`, `FroggerScreen` y `GamePlayer`:
  - autenticado → nombre de jugador fijo (no editable) y botón GUARDAR PUNTUACIÓN;
  - invitado → texto "INICIA SESIÓN PARA GUARDAR TU PUNTUACIÓN" y botón INICIAR SESIÓN.
- `FroggerScreen.tsx`: elimina `localStorage['av_player_name']`.
- `HallOfFame.tsx`: "mi mejor puntuación" filtra por `user_id`, no por `player_name`.
- Limpieza: borrar `localStorage['av_user']` al cargar la app.
- Documentación: convención del modal de game over en `CLAUDE.md` y en `.claude/skills/add-game/SKILL.md`.

**Fuera de scope (para specs posteriores):**

- Cambiar el email de la cuenta.
- Eliminar la cuenta.
- Vincular o desvincular proveedores (por ejemplo, añadir GitHub a una cuenta de email).
- Avatar u otros campos de perfil.
- SMTP propio (por ejemplo, Resend) y plantillas de email personalizadas. Se usa el SMTP por defecto de Supabase.
- Guardar la puntuación de una partida de invitado después de iniciar sesión.
- Login por nombre de jugador (solo email).
- Magic link y otros proveedores OAuth.
- Rate limiting o captcha propios.
- Renombrar `middleware.ts` a `proxy.ts` (convención de Next.js 16).
- Rutas file-based o enlaces directos a pantallas distintas de `?auth=`.

---

## Data model

### Supabase — migración `012_auth_profiles`

El número es tentativo. Antes de aplicar, comprobar el siguiente libre con `SELECT name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 1;` (SPEC 11 y `puas-express` ya usan `011`).

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique check (username ~ '^[A-Z0-9_]{3,10}$'),
  created_at timestamptz not null default now()
);
-- username null = usuario OAuth que aún no ha elegido nombre.

-- handle_new_user(): security definer, search_path = ''.
-- Inserta (new.id, upper(new.raw_user_meta_data->>'username')).
-- Para OAuth el metadato no existe → username null.
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
-- select: público (para mostrar nombres y comprobar disponibilidad).
-- update: solo la fila propia (auth.uid() = id). Sin insert ni delete desde cliente.

alter table public.games enable row level security;
-- select: público. Sin insert/update/delete desde cliente.
```

### Supabase — migración `013_scores_user_id` (paso 10)

```sql
alter table public.scores
  add column user_id uuid references auth.users(id) on delete set null;
-- Las filas existentes quedan con user_id null.
create index scores_user_id_game_id_idx on public.scores (user_id, game_id);
```

### Supabase — migración `014_scores_rls` (paso 11)

```sql
-- scores_set_player_name(): before insert, security definer.
-- player_name := username del perfil de new.user_id; si es null → raise exception.

-- profiles_propagate_username(): after update of username on profiles.
-- update scores set player_name = new.username where user_id = new.id.

alter table public.scores enable row level security;
-- select: público.
-- insert: solo authenticated, with check (auth.uid() = user_id).
-- Sin update ni delete desde cliente.
```

### TypeScript

`lib/types.ts`:

```ts
export type RouteName = /* …existentes… */ 'cuenta'

export interface User {
  id: string // auth.users.id
  name: string // profiles.username (siempre definido: si falta, el usuario está "pendiente de nombre")
  email: string | null
  hasPassword: boolean // identities incluye provider 'email'
}
```

`lib/authStore.ts`:

```ts
export type AuthState =
  | { status: 'loading' }
  | { status: 'guest' }
  | { status: 'needs-username'; id: string; email: string | null }
  | { status: 'authed'; user: User }

export function readAuth(): AuthState
export function subscribeAuth(cb: () => void): () => void
export const serverAuth = (): AuthState => ({ status: 'loading' })
export function refreshProfile(): Promise<void> // tras cambiar el username
```

`app/page.tsx` deriva `user: User | null` (`authed` → `user`, resto → `null`) y lo pasa a las pantallas como hasta ahora. Las props de los juegos no cambian.

`Auth.tsx`:

```ts
type AuthMode = 'in' | 'up' | 'check-email' | 'forgot' | 'reset' | 'username'
// Prop opcional initialMode, fijada por page.tsx según ?auth= o needs-username.
```

Parámetro `?auth=` (lo pone el callback y se borra con `history.replaceState` tras leerlo):

| Valor       | Origen                     | Efecto en `page.tsx`                                  |
| ----------- | -------------------------- | ----------------------------------------------------- |
| `confirmed` | Enlace de confirmación     | Ruta `games` + aviso "CUENTA CONFIRMADA"              |
| `recovery`  | Enlace de recuperación     | Ruta `auth`, modo `reset`                             |
| `oauth`     | Vuelta de Google/GitHub    | `games`, o `auth` modo `username` si falta nombre     |
| `error`     | Código inválido o caducado | Ruta `auth`, modo `in`, con error "ENLACE NO VÁLIDO…" |

Validación de nombre de jugador (cliente y servidor): `^[A-Z0-9_]{3,10}$`. El input convierte a mayúsculas mientras se escribe. La contraseña tiene un mínimo de 8 caracteres en cliente, alineado con el mínimo configurado en Supabase.

Claves de `localStorage`: `av_user` y `av_player_name` dejan de usarse. `av_user` se borra al cargar. La sesión vive en las cookies que gestiona `@supabase/ssr`. `av-skin` no cambia.

---

## Implementation plan

1. **Migración de perfiles.**
   - Comprobar el siguiente número de migración libre.
   - Aplicar `012_auth_profiles` con `mcp__supabase__apply_migration`: `profiles`, `handle_new_user`, trigger y RLS de `profiles` y `games`.
   - Insertar un perfil (con `username` null) para cada `auth.users` existente.
   - Test: `select * from profiles` funciona; la Library sigue cargando juegos; guardar puntuaciones sigue funcionando (scores aún sin RLS).
2. **Configuración del panel de Supabase (manual, la hace el usuario).**
   - Authentication → Providers → Email: "Confirm email" activado; longitud mínima de contraseña 8.
   - URL Configuration: Site URL y Redirect URLs `http://localhost:3000/auth/callback` y la URL de producción equivalente.
   - Providers Google y GitHub: crear las apps OAuth en Google Cloud y GitHub con callback `https://<proyecto>.supabase.co/auth/v1/callback` y pegar client id y secret.
   - Test: los proveedores aparecen como habilitados en el panel.
3. **Store de sesión.**
   - Crear `lib/authStore.ts` y actualizar `User` en `lib/types.ts`.
   - `app/page.tsx` pasa a usar `authStore`. Borra `localStorage['av_user']` al montar. `handleSignOut` llama a `supabase.auth.signOut()`.
   - Eliminar `lib/userStore.ts`.
   - El `Auth.tsx` mock deja de llamar a `onLogin`, de forma provisional.
   - Test: la app carga como invitado; el Nav muestra "Iniciar Sesión".
4. **Callback.**
   - Crear `app/auth/callback/route.ts` con `createClient` de `lib/supabase/server.ts`.
   - Lee `code` y `next` (`confirmed | recovery | oauth`) y redirige a `/?auth=<next>`, o a `/?auth=error` si falla.
   - `page.tsx` lee `?auth=`, aplica la tabla del Data model y limpia la URL.
   - Test: `/auth/callback` sin código redirige a `/?auth=error` y se ve la pantalla de login con el error.
5. **Registro e inicio de sesión con email.**
   - Reescribir `Auth.tsx` con los modos `in`, `up` y `check-email`.
   - `signUp` envía `options.data.username` y `emailRedirectTo = origin + '/auth/callback?next=confirmed'`.
   - Antes de `signUp` se comprueba que el nombre está libre en `profiles`.
   - `signInWithPassword` para entrar.
   - Crear `lib/authErrors.ts`. Mensaje bajo el formulario; botón `CARGANDO…`.
   - Test: registrarse → "Revisa tu correo" → enlace → sesión iniciada con el nombre elegido en el Nav.
6. **Recuperar contraseña.**
   - Modo `forgot`: `resetPasswordForEmail(email, { redirectTo: origin + '/auth/callback?next=recovery' })`, y después `check-email`.
   - Modo `reset`: nueva contraseña + confirmación, guardada con `updateUser({ password })`, y después ruta `games`.
   - Test: el flujo completo permite entrar con la contraseña nueva y no con la antigua.
7. **OAuth y "Elige tu nombre".**
   - Botones GOOGLE y GITHUB con `signInWithOAuth({ provider, options: { redirectTo: origin + '/auth/callback?next=oauth' } })`.
   - Con estado `needs-username`, `page.tsx` muestra siempre `Auth` en modo `username` (cualquier `navigate` vuelve a él, salvo cerrar sesión).
   - Guardar con `update profiles set username`; después `refreshProfile()`.
   - Test: el primer login con GitHub pide nombre; el segundo entra directo.
8. **Menú de usuario en el Nav.**
   - El botón con el nombre abre un desplegable con MI CUENTA y CERRAR SESIÓN. Se cierra al hacer clic fuera o con Esc.
   - Las mismas dos opciones aparecen en el menú móvil.
   - Añadir `'cuenta'` a `RouteName`.
   - Test: cerrar sesión vuelve a "Iniciar Sesión"; MI CUENTA navega a `'cuenta'`.
9. **Pantalla de cuenta.**
   - Crear `AccountScreen.tsx` y su `else if` en `page.tsx`. Si no hay usuario, redirige a `auth`.
   - Sección "Nombre de jugador": validación, comprobación de disponibilidad y `update` propio; después `refreshProfile()`.
   - Sección "Contraseña" (solo si `hasPassword`): nueva + confirmación con `updateUser`. Si `hasPassword` es false, muestra "TU CUENTA USA GOOGLE/GITHUB".
   - Test: cambiar el nombre lo actualiza en el Nav.
10. **Puntuaciones vinculadas a la cuenta (cliente).**
    - Aplicar `013_scores_user_id` (solo la columna `user_id` + índice), para que el cliente pueda enviarla y filtrar por ella. _(Añadido en implementación: la columna estaba en la migración del paso 11 y el paso 10 quedaba roto.)_
    - `handleSaveScore` hace `return` si no hay usuario. Inserta `{ game_id, score, user_id: user.id, player_name: user.name }`.
    - Actualizar el modal de game over en los 5 juegos y en `GamePlayer` (autenticado o invitado, según el Scope).
    - Quitar `av_player_name` de Frogger.
    - `HallOfFame` filtra por `user_id`.
    - Test: un usuario autenticado guarda una puntuación y aparece con su nombre; como invitado no se ofrece guardar.
11. **RLS de scores.**
    - Aplicar `014_scores_rls`: triggers `scores_set_player_name` y `profiles_propagate_username` + RLS de `scores` (comprobar antes el número).
    - Test: un insert sin sesión falla con error de RLS; un insert autenticado guarda `player_name` = `username` aunque el cliente envíe otro; cambiar el nombre en la cuenta actualiza los scores previos.
12. **Documentación.**
    - Actualizar en `CLAUDE.md` la convención del modal de game over: nombre tomado de `user`, sin input libre, CTA de login para invitados.
    - Actualizar en `CLAUDE.md` la estructura (`authStore.ts`, `authErrors.ts`, `app/auth/callback/route.ts`, `AccountScreen.tsx`, sin `userStore.ts`).
    - Actualizar el texto equivalente en `.claude/skills/add-game/SKILL.md`.

---

## Acceptance criteria

- [ ] Registrarse con nombre, email y contraseña muestra "Revisa tu correo" y no inicia sesión hasta confirmar.
- [ ] Iniciar sesión con un email sin confirmar muestra un error en español bajo el formulario.
- [ ] El enlace de confirmación lleva a `/auth/callback`, redirige a la app con la sesión iniciada y la URL final no contiene `?auth=`.
- [ ] Tras confirmar, el Nav muestra el nombre de jugador en mayúsculas.
- [ ] Registrarse con un nombre ya usado muestra "NOMBRE DE JUGADOR OCUPADO" y no crea la cuenta.
- [ ] Un nombre que no cumple `^[A-Z0-9_]{3,10}$` no se puede enviar (cliente), y la BD lo rechaza (CHECK).
- [ ] Credenciales incorrectas muestran un error en español y el botón vuelve de `CARGANDO…` a su texto normal.
- [ ] Recargar la página mantiene la sesión.
- [ ] CERRAR SESIÓN deja al usuario como invitado y, tras recargar, sigue como invitado.
- [ ] "¿Olvidaste tu contraseña?" envía el email; el enlace abre el modo "Nueva contraseña"; tras guardarla se entra con la nueva y la antigua falla.
- [ ] `/auth/callback` con un código inválido o sin código termina en la pantalla de login con el error de enlace no válido.
- [ ] Login con Google y login con GitHub funcionan. El primer acceso pide "Elige tu nombre" y no deja navegar a otra pantalla hasta elegirlo.
- [ ] El segundo login OAuth del mismo usuario entra directo, sin pedir nombre.
- [ ] El menú del usuario en el Nav (escritorio y móvil) muestra MI CUENTA y CERRAR SESIÓN, y se cierra con Esc o con un clic fuera.
- [ ] En MI CUENTA, cambiar el nombre actualiza el Nav y el `player_name` de los scores previos de ese usuario.
- [ ] En MI CUENTA, un usuario de email puede cambiar la contraseña. Un usuario solo OAuth no ve el formulario de contraseña.
- [ ] Al terminar una partida autenticado en cualquiera de los 5 juegos, el modal muestra el nombre del perfil (no editable) y GUARDAR PUNTUACIÓN inserta una fila con `user_id` correcto.
- [ ] Al terminar una partida como invitado, el modal no ofrece guardar y muestra INICIAR SESIÓN, que navega a `auth`.
- [ ] Un `insert` en `scores` con la clave anónima y sin sesión falla por RLS.
- [ ] Un `insert` autenticado con `player_name` falso se guarda con el `username` real del perfil.
- [ ] Un `insert` autenticado con un `user_id` ajeno falla por RLS.
- [ ] `update` y `delete` sobre `scores` y `games` desde el cliente fallan o no afectan a ninguna fila.
- [ ] Un usuario no puede modificar el `profiles` de otro usuario.
- [ ] La Library, GameDetail y el Salón de la Fama siguen mostrando juegos y leaderboards sin sesión.
- [ ] Los scores anteriores a este spec siguen visibles en los leaderboards.
- [ ] `lib/userStore.ts` no existe y no hay referencias a `av_user` ni a `av_player_name` en el código.
- [ ] `mcp__supabase__get_advisors` (security) no reporta tablas públicas sin RLS ni funciones `security definer` sin `search_path` fijo.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

---

## Decisions

- **Sí:** un único spec con todo (email, OAuth, recuperación, menú y cuenta). Lo decidió el usuario. Se recomendó dividirlo en tres; el plan compensa con pasos que dejan la app funcionando.
- **Sí:** login con email + contraseña. Es el flujo nativo de Supabase.
- **No:** login por nombre de jugador. Necesita una RPC que resuelva nombre → email y expone qué nombres existen.
- **Sí:** tabla `profiles` con `username` único. Garantiza unicidad y permite RLS clara.
- **No:** guardar el nombre solo en `user_metadata`. No garantiza unicidad y el usuario puede modificarlo sin validación.
- **Sí:** confirmación de email obligatoria. Evita cuentas con emails falsos.
- **Sí:** paso "Elige tu nombre" para OAuth, en lugar de autogenerar el nombre a partir del proveedor.
- **Sí:** el invitado juega pero no guarda. El leaderboard solo contiene puntuaciones de cuentas reales.
- **Sí:** `scores.user_id` nullable. Conserva las puntuaciones históricas sin dueño.
- **No:** borrar las puntuaciones existentes.
- **Sí:** `player_name` lo fija un trigger desde el perfil, no el cliente. Nadie puede publicar con un nombre ajeno.
- **Sí:** propagar el cambio de nombre a los scores previos. El leaderboard muestra siempre el nombre actual y nadie puede reutilizar un nombre antiguo ajeno para confundir.
- **No:** guardar el nombre como instantánea en cada score.
- **Sí:** `app/auth/callback/route.ts` + `?auth=` leído por el shell. Respeta el routing por estado de `app/page.tsx` con un solo endpoint real.
- **No:** páginas file-based para recuperación o confirmación. Rompería el patrón del shell.
- **Sí:** eliminar `lib/userStore.ts` y `av_user`. La fuente de verdad es la sesión de Supabase. Los usuarios mock actuales pasan a ser invitados.
- **No:** mantener `av_user` como caché. Dos fuentes de verdad se desincronizan.
- **Sí:** errores en un único mensaje bajo el formulario, traducidos al español desde el código de Supabase.
- **No:** errores por campo. Más complejidad sin ganancia clara en formularios de 2 o 3 campos.
- **Sí:** RLS de `scores` en una migración aparte (paso 11), después de que el cliente envíe `user_id`. Así ningún paso intermedio rompe el guardado.
- **Sí:** RLS en `games` (solo lectura). Cierra el pendiente de SPEC 06.
- **No:** SMTP propio en este spec. Se acepta el límite de envíos del SMTP por defecto de Supabase durante el desarrollo.

---

## Risks

| Riesgo                                                                                                                      | Mitigación                                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| El SMTP por defecto de Supabase limita los emails por hora; en pruebas se agota rápido.                                     | Documentado. Para probar, reutilizar cuentas o confirmar usuarios desde el panel. SMTP propio en otro spec.                               |
| El enlace de email se abre en otro navegador o dispositivo: falta el `code_verifier` PKCE y `exchangeCodeForSession` falla. | El callback redirige a `?auth=error` con el mensaje "ABRE EL ENLACE EN EL MISMO NAVEGADOR DONDE TE REGISTRASTE".                          |
| Carrera de nombres: dos registros con el mismo nombre entre la comprobación y el `signUp`.                                  | El `unique` de `profiles` hace fallar el trigger. `authErrors.ts` traduce "Database error saving new user" a "NOMBRE DE JUGADOR OCUPADO". |
| Faltan las credenciales OAuth de Google/GitHub o están mal configuradas.                                                    | El paso 2 es un prerrequisito manual. El error del proveedor llega al callback como `?auth=error` y no rompe la app.                      |
| Activar RLS en `games`/`scores` rompe una lectura que no se tuvo en cuenta.                                                 | Las políticas de `select` son públicas. Se verifica Library, GameDetail y Salón sin sesión tras cada migración.                           |
| Usuarios existentes en `auth.users` sin perfil.                                                                             | El paso 1 crea su perfil con `username` null; al entrar pasan por "Elige tu nombre".                                                      |
| Parpadeo del Nav mientras la sesión carga (`status: 'loading'`).                                                            | El Nav no pinta ni "Iniciar Sesión" ni el nombre hasta salir de `loading`.                                                                |

---

## What is **not** in this spec

- Cambiar el email o eliminar la cuenta.
- Vincular o desvincular proveedores OAuth.
- Avatar u otros campos de perfil.
- SMTP propio y plantillas de email personalizadas.
- Recuperar la puntuación de una partida de invitado tras iniciar sesión.
- Login por nombre de jugador, magic link u otros proveedores.
- Captcha o rate limiting propios.
- Renombrar `middleware.ts` a `proxy.ts`.

Cada uno de estos, si llega, va en su propio spec.
