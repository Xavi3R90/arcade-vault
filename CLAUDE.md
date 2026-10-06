# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault es una plataforma de juegos arcade online donde los jugadores compiten por la puntuación más alta. Usa **Spec Driven Design** con los skills `/spec`, `/spec-impl` y `/add-game` (basados en `Klerith/fernando-skills`). Los specs viven en `specs/NN-*.md` y se implementan tras aprobarse manualmente.

Juegos integrados actualmente: **Asteroids, Tetris, Arkanoid, Snake**.

## Commands

```bash
npm run dev      # start dev server
npm run build    # production build
npm run start    # serve production build
npm run lint     # run ESLint
npm run format   # Prettier --write .
```

## Stack

- **Next.js 16.3.4** — App Router only (no Pages Router)
- **React 19.2.8**
- **TypeScript** — strict mode, path alias `@/*` → `./*`
- **Tailwind CSS v4** — vía PostCSS; usa `@import "tailwindcss"` y `@theme inline` (no los `@tailwind` directives de v3)
- **Supabase** — `@supabase/ssr` + `@supabase/supabase-js` para persistencia de `games` y `scores`
- **Resend** — envío de emails desde `app/api/contact/route.ts`
- **Prettier** — con `prettier-plugin-tailwindcss` (ordena clases Tailwind)

## Estructura del proyecto

```
app/
  page.tsx              # Shell cliente: routing por estado + carga de games desde Supabase
  layout.tsx            # Root layout
  globals.css           # Theme Tailwind v4 + covers CSS por juego (.cover-<slug>)
  api/contact/route.ts  # POST → Resend (requiere RESEND_API_KEY y CONTACT_TO_EMAIL)
components/
  Nav.tsx, GameCard.tsx
  screens/              # Una pantalla por ruta: HomeScreen, Library, GameDetail,
                        # GamePlayer, Auth, HallOfFame, AboutScreen, y la pantalla
                        # de cada juego (AsteroidsScreen, TetrisScreen, …)
lib/
  types.ts              # RouteName, Route, Game, ScoreRow, SavedScore, User
  supabase/client.ts    # createBrowserClient — uso cliente
  supabase/server.ts    # createServerClient — uso Server Components / Route Handlers
specs/                  # Specs 01–09 (MVP UI, Home, About, Supabase, juegos, …)
references/             # Juegos originales en HTML/JS para portar
.claude/
  settings.json         # Hook PostToolUse → format.ps1
  hooks/format.ps1      # Trim + Prettier + ESLint --fix tras cada Write/Edit
  skills/add-game/      # Generador de specs para nuevos juegos
  skills/spec/          # Generador de specs genéricos
  skills/spec-impl/     # Implementador de specs aprobados
  skills/frontend-design/
```

## Routing (cliente)

El shell en `app/page.tsx` **no usa file-based routing** para las sub-pantallas: mantiene `useState<Route>` y renderiza la pantalla correspondiente según `route.name` (`'home' | 'games' | 'detalle' | 'player' | 'auth' | 'salon' | 'about' | '<slug-de-juego>'`). Al añadir un juego hay que: ampliar el union `RouteName` en `lib/types.ts`, importar la screen en `app/page.tsx` y añadir su `else if` en el switch.

## Supabase

- Tablas: `games` (catálogo con `id`, `title`, `short`, `long`, `cat`, `cover`, `color`, `best`, `plays`, `play_route`) y `scores` (`game_id`, `player_name`, `score`).
- El `color` de `games` está restringido por CHECK a `cyan | magenta | yellow | green`.
- Para insertar un juego nuevo, usar `mcp__supabase__apply_migration` con nombre `NNN_add_<slug>_game` — **no** crear archivos SQL locales (ver SPEC 06).
- Scores se guardan vía `createClient().from('scores').insert(...)` desde el handler `handleSaveScore` en `app/page.tsx`.

## Env vars

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
RESEND_API_KEY=
CONTACT_TO_EMAIL=
```

## Patrón para añadir juegos

1. Lanzar `/add-game <slug>` para generar `specs/NN-add-<slug>.md`.
2. Revisar y marcar el spec como `Aprobado`.
3. Lanzar `/spec-impl NN-add-<slug>` — crea rama, implementa paso a paso.
4. Convenciones duras: canvas 800×600 lógico escalado por CSS (`aspect-ratio: 800/600`), componente `components/screens/<Slug>Screen.tsx`, cover `.cover-<slug>` en `app/globals.css`, props `{ navigate, user, onSaveScore }`, cleanup de RAF y listeners en `useEffect`, modal de game over con input (máx. 10 chars, mayúsculas).

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
- `/add-game <slug>` — genera un spec para un juego nuevo (portado desde `references/started-games/` o desde cero). No implementa; produce el `.md` listo para `/spec-impl`.


# Revisar juegos implementados

- Cuando necesites revisar que juegos están implementados y como implementar uno nuevo revisa en esta lista los juegos implementados: `references/implemented-games.md`