# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault es una plataforma de juegos arcade online donde los jugadores compiten por la puntuación más alta. Usa **Spec Driven Design** con los skills `/spec`, `/spec-impl`, `/spec-impl-game` y `/add-game` (basados en `Klerith/fernando-skills`). Los specs viven en `specs/NN-*.md` (y `specs/game-jam/<slug>/`) y se implementan tras aprobarse manualmente.

Juegos integrados actualmente: **Asteroids, Tetris, Arkanoid, Snake, Frogger** (detalle en `references/implemented-games.md`).

## Commands

```bash
npm run dev               # start dev server
npm run build             # production build
npm run start             # serve production build
npm run lint              # run ESLint
npm run format            # Prettier --write .
npm run perf -- <slug>    # mide FPS en móvil emulado (390×844, CPU 10×) — SPEC 11
```

`npm run perf` (`scripts/perf/fps.mjs`, Playwright) se ejecuta siempre contra producción (`npm run build && npm run start`). Umbral: ≥ 55 FPS medios y ≤ 5 % de frames lentos por skin; opciones `--skins=`, `--duration=`, `--cpu=`, `--runs=`, `--screenshots=`.

## Stack

- **Next.js 16.3.4** — App Router only (no Pages Router)
- **React 19.2.8**
- **TypeScript** — strict mode, path alias `@/*` → `./*`
- **Tailwind CSS v4** — vía PostCSS; usa `@import "tailwindcss"` y `@theme inline` (no los `@tailwind` directives de v3)
- **Supabase** — `@supabase/ssr` + `@supabase/supabase-js` para persistencia de `games` y `scores`
- **Resend** — envío de emails desde `app/api/contact/route.ts`
- **Prettier** — con `prettier-plugin-tailwindcss` (ordena clases Tailwind)
- **Playwright** (dev) — usado por `npm run perf`
- **MCP** (`.mcp.json`) — servidores `playwright` (screenshots en `.playwright-mcp-screenshots/`) y `supabase`

## Estructura del proyecto

```
app/
  page.tsx              # Shell cliente: routing por estado, GAME_ROUTES, carga de games desde Supabase, skin y usuario
  layout.tsx            # Root layout
  globals.css           # Theme Tailwind v4 + covers CSS por juego (.cover-<slug>) + layout móvil (.game-mobile)
  api/contact/route.ts  # POST → Resend (requiere RESEND_API_KEY y CONTACT_TO_EMAIL)
  auth/callback/route.ts # Canjea el código de Supabase (email/OAuth) y redirige a /?auth=confirmed|recovery|oauth|error — SPEC 12
middleware.ts           # Refresco de sesión Supabase (createServerClient + auth.getUser)
components/
  Nav.tsx, GameCard.tsx
  TouchControls.tsx     # Gamepad virtual (cruceta + A/B) para móvil — SPEC 10
  screens/              # Una pantalla por ruta: HomeScreen, Library, GameDetail,
                        # GamePlayer, Auth (login/registro/recuperar/elige nombre),
                        # AccountScreen (ruta 'cuenta'), HallOfFame, AboutScreen, y la pantalla
                        # de cada juego (AsteroidsScreen, TetrisScreen, ArkanoidScreen,
                        # SnakeScreen, FroggerScreen)
  games/                # Lógica/render de juego separada de la screen (FroggerGame.tsx, froggerSprites.ts)
lib/
  types.ts              # RouteName, Route, Game, ScoreRow, SavedScore, User
  skins.ts              # SkinId (classic | neon | retro), lectura/escritura del skin, GamePalette
  skins/<slug>.ts       # Paletas por juego para los 3 skins
  touch.ts              # TouchGameId, TOUCH_MAPPINGS (botón → tecla), dispatchKey
  useTouchMobile.ts     # useIsTouchMobile / useIsLandscape (media queries)
  authStore.ts          # Sesión Supabase + perfil (loading | guest | needs-username | authed) vía useSyncExternalStore — SPEC 12
  authErrors.ts         # Errores de Supabase Auth traducidos al español + validación de username/contraseña
  supabase/client.ts    # createBrowserClient — uso cliente
  supabase/server.ts    # createServerClient — uso Server Components / Route Handlers
scripts/perf/fps.mjs    # Medidor de FPS (npm run perf)
specs/                  # Specs 01–12 (MVP UI, Home, About, Supabase, juegos, móvil, rendimiento, auth)
  game-jam/<slug>/      # Specs generados por el agente game-jam (frogger, puas-express)
references/
  implemented-games.md     # Catálogo de juegos jugables
  game-with-themes.md      # Registro de skins por juego (skin-designer)
  game-mobile-support.md   # Registro de soporte móvil (mobile-porter)
  performance-findings.md  # Mediciones FPS y hallazgos (game-performance-booster)
  game-suggestions-todo.md # To Do de juegos sugeridos (game-planner)
  started-games/           # Juegos originales en HTML/JS para portar
  templates/, source-assets/ # Plantillas UI originales y assets
.claude/
  settings.json         # Hook PostToolUse → format.ps1
  hooks/format.ps1      # Trim + Prettier + ESLint --fix tras cada Write/Edit
  agents/               # Definiciones de subagentes (ver sección Agentes)
  agent-memory/game-planner/ # Memoria persistente del agente game-planner
  skills/               # add-game, spec, spec-impl, spec-impl-game, frontend-design
.agents/skills/         # Copias instaladas de skills externos (skills-lock.json)
```

## Routing (cliente)

El shell en `app/page.tsx` **no usa file-based routing** para las sub-pantallas: mantiene `useState<Route>` y renderiza la pantalla correspondiente según `route.name` (`'home' | 'games' | 'detalle' | 'player' | 'auth' | 'salon' | 'about' | 'cuenta' | '<slug-de-juego>'`). La única excepción es `?auth=<motivo>`, que deja `app/auth/callback/route.ts` y el shell lee una vez para abrir la pantalla de auth correcta. Si la sesión está en `needs-username`, el shell muestra siempre "Elige tu nombre". Al añadir un juego hay que:

1. Ampliar el union `RouteName` en `lib/types.ts`.
2. Importar la screen en `app/page.tsx`, añadir su `else if` y su slug a `GAME_ROUTES` (pone `data-game-route`, que oculta el Nav en móvil).
3. Añadir el slug a `TouchGameId` y su mapeo a `TOUCH_MAPPINGS` en `lib/touch.ts`.

## Supabase

- Tablas: `games` (catálogo con `id`, `title`, `short`, `long`, `cat`, `cover`, `color`, `best`, `plays`, `play_route`), `scores` (`game_id`, `player_name`, `score`, `user_id`) y `profiles` (`id` = `auth.users.id`, `username` único `^[A-Z0-9_]{3,10}$`, null hasta que un usuario OAuth lo elige).
- El `color` de `games` está restringido por CHECK a `cyan | magenta | yellow | green`.
- Para insertar un juego nuevo, usar `mcp__supabase__apply_migration` con nombre `NNN_add_<slug>_game` — **no** crear archivos SQL locales (ver SPEC 06). Comprobar antes el siguiente número libre en `supabase_migrations.schema_migrations`.
- Auth (SPEC 12): email + contraseña con confirmación, Google y GitHub. El trigger `on_auth_user_created` crea el perfil.
- RLS activa en las tres tablas: lectura pública; `scores` solo admite insert autenticado con `user_id = auth.uid()`; `profiles` solo update de la fila propia; `games` sin escritura desde cliente.
- Scores se guardan vía `createClient().from('scores').insert(...)` desde `handleSaveScore` en `app/page.tsx`, solo si hay usuario. El trigger `scores_set_player_name` fija `player_name` desde el perfil, y `profiles_propagate_username` lo actualiza si el jugador cambia de nombre.

## Env vars

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_DB_PASSWORD=
RESEND_API_KEY=
CONTACT_TO_EMAIL=
```

`.env.template` solo incluye las de Supabase; `RESEND_API_KEY` y `CONTACT_TO_EMAIL` hay que añadirlas a mano.

## Patrón para añadir juegos

0. (Opcional) Elegir qué juego con el agente `game-planner`, o inventar uno con el agente `game-jam`.
1. Lanzar `/add-game <slug>` para generar `specs/NN-add-<slug>.md`.
2. Revisar y marcar el spec como `Aprobado`.
3. Lanzar `/spec-impl NN-add-<slug>` — crea rama, implementa paso a paso. Alternativa: `/spec-impl-game NN-add-<slug>`, que además encadena `skin-designer` y luego `mobile-porter`.
4. (Opcional) Pasar `game-performance-booster` para validar FPS en móvil.
5. Convenciones duras: canvas 800×600 lógico escalado por CSS (`aspect-ratio: 800/600`), componente `components/screens/<Slug>Screen.tsx` (lógica pesada opcionalmente en `components/games/`), cover `.cover-<slug>` en `app/globals.css`, props `{ navigate, user, onSaveScore }`, cleanup de RAF y listeners en `useEffect`, modal de game over sin input de nombre (SPEC 12: con `user` muestra `user.name` fijo + GUARDAR PUNTUACIÓN con `name: user.name`; sin `user` muestra "INICIA SESIÓN PARA GUARDAR TU PUNTUACIÓN" + botón INICIAR SESIÓN → `navigate({ name: 'auth' })`; clases `.save-player` / `.save-guest`), 3 skins en `lib/skins/<slug>.ts` (classic/neon/retro), layout móvil SPEC 10 (`.game-mobile` + `TouchControls`) y objetivo de rendimiento SPEC 11.

## Hooks

`PostToolUse` sobre `Write|Edit` ejecuta `.claude/hooks/format.ps1`: normaliza EOL + trim + colapsa saltos, luego Prettier `--write` y ESLint `--fix` sobre el archivo tocado. No requiere acción manual.

## Next.js 16 breaking changes

Antes de escribir código Next.js, leer `node_modules/next/dist/docs/` para la API vigente. Diferencias clave frente a versiones anteriores:

- **`params` y `searchParams` son Promises.** Hacer `await` dentro de page/layout.

  ```tsx
  export default async function Page({ params }: PageProps<'/blog/[slug]'>) {
    const { slug } = await params
  }
  ```

- **`PageProps<'/route'>` y `LayoutProps<'/route'>` son helpers globales de tipo** — no se importan. Los genera `next dev`, `next build` o `next typegen`.

- **Los layouts reciben slots de parallel routes como props tipadas** vía `LayoutProps`. El root layout usa `LayoutProps<"/">`.

- **Tailwind CSS v4** no usa `@tailwind base/components/utilities`. Usar `@import "tailwindcss"` y declarar overrides con `@theme inline`.

## Skills

- `/frontend-design` — **úsalo siempre** para diseñar interfaces de usuario.
- `/spec` — genera specs genéricos en `specs/`.
- `/spec-impl <NN-spec>` — implementa un spec aprobado (crea rama, aplica cambios paso a paso).
- `/spec-impl-game <NN-spec>` — `/spec-impl` + `skin-designer` + `mobile-porter` en secuencia; admite specs de `specs/game-jam/<slug>/`. Nunca commitea.
- `/add-game <slug>` — genera el spec de un juego nuevo (portado desde `references/started-games/` o desde cero). No implementa.

## Agentes

Definidos en `.claude/agents/`. Para detalles (flujo, reglas, herramientas) leer el archivo de cada uno. Los agentes por juego actúan sobre **un único juego** por ejecución.

| Agente                     | Qué hace                                                                                            | Definición                                   |
| -------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `game-planner`             | Propone qué juego añadir; recuerda sus sugerencias y mantiene `references/game-suggestions-todo.md` | `.claude/agents/game-planner.md`             |
| `game-jam`                 | Inventa un juego original a partir de un tema y escribe 3 specs en `specs/game-jam/<slug>/`         | `.claude/agents/game-jam.md`                 |
| `skin-designer`            | Aplica los skins Clásico/Neón/Retro y actualiza `references/game-with-themes.md`                    | `.claude/agents/skin-designer.md`            |
| `mobile-porter`            | Porta el juego al layout móvil de SPEC 10 y actualiza `references/game-mobile-support.md`           | `.claude/agents/mobile-porter.md`            |
| `game-performance-booster` | Optimiza FPS según SPEC 11 sin cambiar el aspecto y actualiza `references/performance-findings.md`  | `.claude/agents/game-performance-booster.md` |

## Revisar juegos implementados

- Cuando necesites revisar qué juegos están implementados y cómo implementar uno nuevo, consulta `references/implemented-games.md`.
