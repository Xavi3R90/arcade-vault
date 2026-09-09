# SPEC 01 — MVP visual de Arcade Vault

> **Status:** Approve
> **Depends on:** —
> **Date:** 2026-09-09
> **Objective:** Implementar todas las pantallas visuales de Arcade Vault como una SPA en Next.js 16 usando los templates de `references/templates` como referencia de diseño.

---

## Scope

**In:**

- Componente `Nav` con logo, links de navegación, contador de créditos, botón de usuario/sesión y menú hamburguesa mobile.
- Pantalla `Library` (Biblioteca): hero section, búsqueda por nombre, filtro por categoría, grid de `GameCard` con tilt effect.
- Pantalla `GameDetail` (Detalle): cover, tags, descripción larga, estadísticas (`plays`, `best`, `difficulty`), mini-leaderboard de 10 entradas, botones "JUGAR AHORA" y "VOLVER AL VAULT".
- Pantalla `GamePlayer` (Reproductor): HUD con score, vidas, nivel, jugador; CRT con sprites CSS animados copiados del template (placeholder sin juego real); overlay de pausa; modal de fin de juego con guardado de score en localStorage.
- Pantalla `Auth`: tabs "INICIAR SESIÓN" / "CREAR CUENTA", campos de formulario, mock login (cualquier input válido inicia sesión), "JUGAR COMO INVITADO", botones sociales decorativos.
- Pantalla `HallOfFame` (Salón de la Fama): tabs por juego, pódium top-3, tabla completa de 12 entradas, fila resaltada del usuario autenticado.
- Routing SPA con estado en `app/page.tsx` — tipo `{ name, id? }` gestionado con `useState`.
- Persistencia de sesión de usuario en `localStorage` (`av_user`).
- Persistencia de scores en `localStorage` (`av_scores`).
- Datos mock en `lib/data.ts` (GAMES, CATS, seededScores).
- Tipos compartidos en `lib/types.ts` (Route, Game, Score, User).

**Out of scope (para futuros specs):**

- Lógica real de ningún juego.
- Autenticación real (NextAuth, Clerk, Supabase, etc.).
- Base de datos de scores (el salón de la fama usa datos seeded deterministas).
- Internacionalización.
- Versión PWA o instalable.

---

## Data model

```ts
// lib/types.ts

export type RouteName = 'biblioteca' | 'detalle' | 'player' | 'auth' | 'salon';

export interface Route {
  name: RouteName;
  id?: string;
}

export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: string;
  cover: string;           // nombre de clase CSS, e.g. "cover-bricks"
  color: 'cyan' | 'magenta' | 'yellow' | 'green';
  best: number;
  plays: string;
}

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string;            // "DD/MM/YYYY"
}

export interface SavedScore {
  game: string;
  score: number;
  name: string;
  at: number;              // Date.now()
}

export interface User {
  name: string;            // max 10 chars, uppercase
}
```

`GAMES` es un array de 8 objetos `Game`. `CATS` es `["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"]`. `seededScores(seed, count)` genera filas deterministas a partir de un entero semilla.

---

## Implementation plan

1. **Crear `lib/types.ts`** con los tipos Route, Game, ScoreRow, SavedScore, User. Manual test: `npm run build` no reporta errores de tipo.

2. **Crear `lib/data.ts`** con el array `GAMES` (8 juegos), `CATS`, y la función `seededScores`. Traducción directa de `references/templates/data.jsx`. Manual test: importar en cualquier componente y loguear `GAMES.length === 8`.

3. **Crear `components/Nav.tsx`** con logo, links (Biblioteca, Salón de la Fama), coin counter, botón auth/usuario y menú mobile (backdrop + aside panel). Recibe props `route`, `navigate`, `user`, `onSignOut`. Manual test: renderiza sin errores en `npm run dev`.

4. **Crear `components/GameCard.tsx`** con tilt effect por mouse, cover art (clase CSS), categoría badge, título, descripción corta, mejor puntuación y botón JUGAR. Recibe `game: Game` y `onSelect: (game: Game) => void`. Manual test: visible en la pantalla de Biblioteca.

5. **Crear `components/screens/Library.tsx`** con hero section (título con `.flicker`, subtítulo con `.blink`), barra de búsqueda, chips de categoría y grid de `GameCard`. Recibe `navigate`. Manual test: filtrar por "ARCADE" muestra solo los 5 juegos de esa categoría; buscar "CAÍDA" muestra un resultado.

6. **Crear `components/screens/GameDetail.tsx`** con la cover grande, tags, descripción larga, stat-strip, mini-leaderboard (`seededScores(id.length * 17 + 3, 10)`) y botones de acción. Recibe `id: string` y `navigate`. Manual test: entrar al detalle de "caida" muestra "CAÍDA" y su leaderboard.

7. **Crear `components/screens/GamePlayer.tsx`** con HUD (jugador, puntuación auto-incremental con `setInterval`, vidas, nivel), área CRT con grid-floor y sprites animados copiados del template, overlay de pausa y modal de fin de juego con input de iniciales y botón de guardado. Recibe `id`, `user`, `navigate`, `onSaveScore`. Manual test: la puntuación aumenta sola; pausa la detiene; "FIN" abre el modal; "GUARDAR PUNTUACIÓN" escribe en `localStorage['av_scores']`.

8. **Crear `components/screens/Auth.tsx`** con tabs login/registro, campos usuario, email (solo en registro) y contraseña, submit que llama `onLogin({ name })` y navega a Biblioteca, botón "JUGAR COMO INVITADO". Recibe `navigate` y `onLogin`. Manual test: enviar el formulario con cualquier texto en usuario muestra ese nombre en el Nav.

9. **Crear `components/screens/HallOfFame.tsx`** con tabs por juego (chip por cada `GAME`), pódium top-3 (oro, plata, bronce), tabla completa con 12 filas animadas y fila extra del usuario autenticado si `user !== null`. Recibe `user` y `navigate`. Manual test: cambiar de tab actualiza el pódium y la tabla; si hay usuario, aparece su fila en amarillo al final.

10. **Actualizar `app/page.tsx`** como raíz SPA: `useState<Route>({ name: 'biblioteca' })`, `useState<User | null>` con init desde `localStorage['av_user']`, handlers `navigate`, `handleLogin`, `handleSignOut`, `handleSaveScore`. Renderiza `<Nav>` + el screen correspondiente al `route.name` + `<footer>`. Manual test: navegar entre todas las pantallas funciona sin recarga de página.

---

## Acceptance criteria

- [ ] La ruta inicial carga la Biblioteca con 8 game cards visibles.
- [ ] El filtro de categoría muestra solo los juegos de esa categoría.
- [ ] La búsqueda por nombre filtra en tiempo real; sin resultados muestra el mensaje "NO HAY RESULTADOS".
- [ ] Hacer clic en una card navega a GameDetail con el título y descripción correctos del juego.
- [ ] GameDetail muestra 10 entradas en su mini-leaderboard.
- [ ] "JUGAR AHORA" navega a GamePlayer del mismo juego.
- [ ] En GamePlayer la puntuación se incrementa automáticamente cuando no está pausada.
- [ ] El botón PAUSA detiene el incremento y muestra el overlay "EN PAUSA".
- [ ] "FIN" abre el modal con la puntuación final.
- [ ] El input de iniciales en el modal acepta hasta 10 caracteres en mayúsculas.
- [ ] "GUARDAR PUNTUACIÓN" escribe una entrada en `localStorage['av_scores']` y muestra "PUNTUACIÓN GUARDADA_".
- [ ] "JUGAR DE NUEVO" reinicia score, vidas y nivel a valores iniciales.
- [ ] El formulario de Auth con cualquier texto en usuario llama a `onLogin` y redirige a Biblioteca.
- [ ] "JUGAR COMO INVITADO" navega a Biblioteca sin `user`.
- [ ] El nombre del usuario autenticado aparece en el Nav con el botón de cierre de sesión.
- [ ] Cerrar sesión elimina `localStorage['av_user']` y restaura el botón "Iniciar Sesión".
- [ ] HallOfFame muestra el pódium con los 3 primeros del tab activo.
- [ ] Cambiar de tab en HallOfFame actualiza el pódium y la tabla sin recarga.
- [ ] Si hay usuario autenticado, aparece su fila resaltada en amarillo al final de la tabla.
- [ ] El menú hamburguesa mobile se abre y cierra correctamente.
- [ ] `npm run build` termina sin errores de TypeScript ni de compilación.
- [ ] No hay errores en consola al navegar por todas las pantallas.

---

## Decisiones

- **Sí: SPA en `app/page.tsx`** — el usuario lo eligió explícitamente; preserva la lógica del template con mínimo overhead.
- **No: App Router con rutas reales** — descartado en esta iteración; añadir rutas reales es el candidato natural para un spec posterior.
- **Sí: `globals.css` existente como base de estilos** — el archivo ya tiene todos los estilos retro migrados; evita duplicar trabajo.
- **No: Reescribir estilos en Tailwind v4** — descartado; aumentaría el scope sin mejora visual perceptible en el MVP.
- **Sí: Mock auth con localStorage** — sin backend real; cualquier formulario válido inicia sesión.
- **No: NextAuth / Clerk** — fuera del scope del MVP visual.
- **Sí: Sprites CSS animados como placeholder en GamePlayer** — copiados directamente del template; mantienen la ilusión visual sin lógica de juego.
- **No: Pantalla negra "PRÓXIMAMENTE"** — descartado; el placeholder animado es más fiel al diseño.
- **Sí: localStorage para scores** — coherente con el MVP; sin base de datos.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Conflictos entre clases de `globals.css` y utilidades de Tailwind v4 | Usar prefijos `.av-` para clases custom; Tailwind solo para layout utilitario adicional. |
| El tilt effect de `GameCard` usa `useRef` y eventos de mouse — comportamiento en React 19 | Verificar que `el.style.transform` funciona con referencias de DOM en React 19 (`'use client'` requerido). |

---

## Lo que NO está en este spec

- Lógica real de ningún juego (cada juego irá en su propio spec).
- Autenticación real con backend.
- Base de datos de scores persistida en servidor.
- Internacionalización ni soporte multi-idioma.
