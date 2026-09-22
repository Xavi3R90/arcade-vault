# SPEC 06 — Catálogo de juegos y leaderboard en Supabase

> **Status:** Implementado
> **Depends on:** SPEC 04
> **Date:** 2026-09-22
> **Objective:** Migrar el catálogo de juegos y los scores a Supabase (tablas `games` y `scores`), eliminar los datos simulados de `lib/data.ts` y mostrar rankings reales en `HallOfFame`.

---

## Scope

**In:**

- Supabase: migración `001_create_games.sql` — tabla `games` con los 9 juegos actuales sembrados.
- Supabase: migración `002_create_scores.sql` — tabla `scores` para scores anónimos.
- `lib/data.ts`: eliminar `GAMES`, `CATS` y `seededScores`; si el archivo queda vacío, eliminarlo.
- `app/page.tsx`: añadir estado `games: Game[]`; `useEffect` que carga games desde Supabase al montar; `handleSaveScore` escribe en la tabla `scores` de Supabase (deja de escribir en `localStorage`); pasar `games` como prop a todos los screens que lo necesitan.
- `components/screens/Library.tsx`: recibir `games: Game[]` como prop en lugar de importar `GAMES`.
- `components/screens/HomeScreen.tsx`: recibir `games: Game[]` como prop en lugar de importar `GAMES`.
- `components/screens/GameDetail.tsx`: recibir `games: Game[]` como prop; eliminar import de `lib/data.ts`.
- `components/screens/GamePlayer.tsx`: recibir `games: Game[]` como prop; eliminar import de `lib/data.ts`.
- `components/screens/HallOfFame.tsx`: recibir `games: Game[]` como prop; fetch de `scores` tabla Supabase filtrado por `game_id`; mostrar "tu mejor marca" leyendo scores reales del usuario por nombre; eliminar dependencia de `seededScores`.
- `components/screens/GameDetail.tsx`: restaurar el `<aside>` de leaderboard con datos reales de Supabase — fetch de `scores` filtrado por `game_id`, ordenado por score desc, limit 10; mostrar "SIN PUNTUACIONES TODAVÍA" si la tabla está vacía para ese juego.

**Out of scope:**

- Autenticación real de usuarios — spec posterior.
- Row Level Security (RLS) en las tablas — se añadirá en el spec de auth.
- Tiempo real (Supabase Realtime) — spec posterior.
- Paginación del leaderboard.
- Admin CRUD para añadir/editar juegos desde la UI.
- Migración de `av_scores` de `localStorage` a Supabase para scores previos (se descartan al cambiar de almacén).

---

## Data model

### Tabla `games`

```sql
create table public.games (
  id         text primary key,
  title      text not null,
  short      text not null,
  long       text not null,
  cat        text not null,
  cover      text not null,
  color      text not null check (color in ('cyan', 'magenta', 'yellow', 'green')),
  best       integer not null default 0,
  plays      text not null default '0',
  play_route text
);
```

Seed — los 9 juegos de `lib/data.ts` se insertan en la migración:
`bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `rocas`, `asteroids`, `ranaria`, `duelo-pixel`.

### Tabla `scores`

```sql
create table public.scores (
  id          uuid primary key default gen_random_uuid(),
  game_id     text not null,
  player_name text not null,
  score       integer not null,
  created_at  timestamptz not null default now()
);
```

### Cambios en TypeScript

No se añaden nuevas interfaces: `Game` y `SavedScore` en `lib/types.ts` ya cubren todo. `CATS` pasa de ser una constante importada a derivarse dinámicamente dentro de `Library.tsx` a partir del array de games recibido por prop.

---

## Implementation plan

1. **Crear migración `001_create_games.sql` en Supabase:** definir la tabla `games` con el esquema del Data model y el `INSERT` con los 9 juegos del catálogo actual. Test: la tabla aparece en el panel de Supabase con 9 filas.

2. **Crear migración `002_create_scores.sql` en Supabase:** definir la tabla `scores`. Test: la tabla aparece en el panel de Supabase vacía.

3. **Actualizar `lib/data.ts`:** eliminar `GAMES`, `CATS` y `seededScores`. Si el archivo queda vacío, eliminarlo. Test: `npm run build` reporta errores de importación pendientes en los componentes — es el estado esperado antes del siguiente paso.

4. **Actualizar `app/page.tsx`:**
   - Añadir `const [games, setGames] = useState<Game[]>([])`.
   - Añadir `useEffect` que al montar llama a `createClient().from('games').select('*').order('title')` y setea el resultado en `games`.
   - Actualizar `handleSaveScore`: reemplazar el bloque `localStorage` por `createClient().from('scores').insert({ game_id: entry.game, player_name: entry.name, score: entry.score })`. El error se captura en el catch (silent fail).
   - Pasar `games={games}` como prop a `<HomeScreen>`, `<Library>`, `<GameDetail>`, `<GamePlayer>` y `<HallOfFame>`.
   - Test: `npm run dev` arranca sin errores de consola y la Library muestra los juegos (aunque sea brevemente vacío al montar).

5. **Actualizar `components/screens/Library.tsx`:** añadir prop `games: Game[]`; sustituir el import de `GAMES` y `CATS` por el uso del prop; derivar `CATS` como `['TODOS', ...new Set(games.map(g => g.cat))]`. Test: la Library muestra los 9 juegos; el filtro por categoría funciona.

6. **Actualizar `components/screens/HomeScreen.tsx`:** añadir prop `games: Game[]`; sustituir el import de `GAMES` por el uso del prop. Test: la Home muestra las cards de juegos en la sección de juegos disponibles.

7. **Actualizar `components/screens/GameDetail.tsx`:** añadir prop `games: Game[]`; sustituir `GAMES.find(...)` por `games.find(...)`; eliminar import de `lib/data.ts`. Test: la ficha de cualquier juego se muestra correctamente.

8. **Actualizar `components/screens/GamePlayer.tsx`:** añadir prop `games: Game[]`; sustituir `GAMES.find(...)` por `games.find(...)`; eliminar import de `lib/data.ts`. Test: la pantalla de juego genérico carga sin errores.

9. **Actualizar `components/screens/HallOfFame.tsx`:**
   - Añadir prop `games: Game[]`; sustituir el import de `GAMES` por el uso del prop.
   - Eliminar import de `seededScores`.
   - Añadir estado `rows: ScoreRow[]` y `loading: boolean`.
   - Al cambiar `tab`, hacer `createClient().from('scores').select('*').eq('game_id', tab).order('score', { ascending: false }).limit(12)` y mapear al tipo `ScoreRow`.
   - Si no hay scores, mostrar mensaje "SIN PUNTUACIONES TODAVÍA" en lugar de la tabla vacía.
   - "Tu mejor marca": query `scores` filtrado por `game_id = tab` y `player_name = user.name`, ordenado por score desc limit 1.
   - Actualizar pódium y tabla con datos reales.
   - Test: después de jugar Asteroids y guardar puntuación, navegar al Salón de la Fama → aparece el score real bajo la pestaña "ASTEROIDS".

10. **Restaurar leaderboard en `GameDetail.tsx`:** añadir de nuevo el `<aside>` con fetch real de `scores` desde Supabase filtrado por `game_id`, ordenado por score desc limit 10; mostrar "SIN PUNTUACIONES TODAVÍA" si no hay filas. Test: la ficha de Asteroids muestra el leaderboard real tras jugar una partida.

11. **Verificación final:** ejecutar `npm run build`. Test: build termina sin errores de TypeScript ni de compilación. Navegar por todas las pantallas sin errores de consola.

---

## Acceptance criteria

- [ ] Tabla `games` existe en Supabase con 9 filas sembradas.
- [ ] Tabla `scores` existe en Supabase.
- [ ] `lib/data.ts` ya no exporta `GAMES`, `CATS` ni `seededScores`.
- [ ] La Library carga los juegos desde Supabase y los muestra.
- [ ] El filtro de categorías en Library funciona con los datos reales.
- [ ] La Home muestra las cards de juegos desde Supabase.
- [ ] La ficha de cada juego (`GameDetail`) se muestra correctamente.
- [ ] La pantalla genérica de juego (`GamePlayer`) carga sin errores.
- [ ] El Salón de la Fama muestra pestaña por juego usando los datos de Supabase.
- [ ] El Salón de la Fama muestra "SIN PUNTUACIONES TODAVÍA" si la tabla `scores` está vacía para ese juego.
- [ ] Jugar Asteroids y guardar puntuación inserta una fila en la tabla `scores` de Supabase.
- [ ] Después de guardar, el score aparece en la pestaña "ASTEROIDS" del Salón de la Fama.
- [ ] Si el usuario está logueado, "tu mejor marca" muestra el score real de ese usuario para el juego seleccionado.
- [ ] `npm run build` termina sin errores de TypeScript ni de compilación.
- [ ] No hay errores de consola al navegar por todas las pantallas.

---

## Decisiones

- **Un solo spec para ambas tablas** — el setup de migraciones Supabase y el prop-drilling de `games` se hacen una sola vez; separarlos habría creado un estado intermedio donde `games` viene de Supabase pero `scores` aún son simulados.
- **Scores de todos los juegos (no solo Asteroids)** — la tabla `scores` acepta cualquier `game_id`; solo Asteroids genera scores reales hoy, pero el esquema no limita el futuro.
- **Sin RLS** — no hay usuarios autenticados todavía; se añadirá en el spec de auth junto con las políticas de seguridad.
- **`handleSaveScore` escribe solo en Supabase, no en `localStorage`** — `HomeScreen` usa datos mock hardcodeados para "actividad en vivo" (no lee `av_scores`), así que no hay regresión. Simplifica el flujo evitando doble escritura.
- **`CATS` derivada dinámicamente** — en lugar de importarla de `lib/data.ts`, se calcula con `new Set(games.map(g => g.cat))` en `Library.tsx`. Evita mantener una lista duplicada sincronizada con la tabla.
- **`games` cargado en `app/page.tsx` y pasado por prop** — `app/page.tsx` ya es `'use client'` (SPA pattern); convertirlo a Server Component requeriría refactorizar el sistema de navegación. El `useEffect` con `createBrowserClient` es coherente con la arquitectura existente.
- **Silent fail en `handleSaveScore`** — sin auth ni UI de error definida, un catch silencioso evita romper el flujo de juego si hay un fallo de red.

---

## Riesgos

| Riesgo                                                                          | Mitigación                                                                                           |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `games` llega vacío al render inicial, mostrando Library en blanco              | Mostrar un estado de carga o spinner mientras `games.length === 0`                                   |
| Scores se insertan duplicados si el usuario hace clic varias veces en "Guardar" | Deshabilitar el botón de guardar tras el primer clic en el modal de game over                        |
| La tabla `scores` crece sin límite con jugadas anónimas                         | Aceptado para este spec; se añadirá limpieza o TTL en spec posterior                                 |
| `play_route` en tabla `games` no coincide con el `RouteName` de TypeScript      | La columna es `text`; la validación ocurre en TypeScript al asignar el valor; no requiere enum en DB |
