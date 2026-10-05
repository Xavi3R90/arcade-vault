# SPEC 09 — Juego Snake

> **Status:** Aprobado
> **Depends on:** SPEC 06
> **Date:** 2026-10-05
> **Objetivo:** Implementar Snake como componente React con canvas 800×600, sprites de frutas rotatorios, movimiento en grid con wrap-around, velocidad creciente y leaderboard en Supabase.

---

## Scope

**In:**

- `lib/types.ts`: añadir `'snake'` a `RouteName`.
- `public/snake-fruits.png`: copiar el sprite sheet desde `references/source-assets/snake-assets/fruits.png` para que sea accesible desde el navegador.
- `components/screens/SnakeScreen.tsx`: componente nuevo con canvas 800×600 lógico, lógica de juego en grid (40×30 celdas de 20 px), HUD en React, modal de game over, props `{ navigate, user, onSaveScore }`, cleanup de `clearInterval` y listeners en `useEffect`.
- `app/globals.css`: clase `.cover-snake` con gradientes verdes + serpiente estilizada en pseudo-elementos `::before`/`::after`.
- `app/page.tsx`: caso `'snake'` en el if/else if de rutas.
- Supabase tabla `games`: INSERT de la fila del juego `snake` vía `mcp__supabase__apply_migration`.

**Fuera de scope (para specs posteriores):**

- Controles táctiles / mobile.
- Sonido y efectos de audio.
- Multijugador.
- Modo de dificultad configurable (velocidad inicial ajustable por el usuario).
- Niveles explícitos con pantalla de transición entre niveles.

---

## Data model

Fila en tabla `games`:

```sql
INSERT INTO public.games (id, title, short, long, cat, cover, color, best, plays, play_route)
VALUES (
  'snake',
  'SNAKE',
  'Guía tu serpiente y devora frutas sin chocar contigo mismo.',
  'Tu serpiente crece con cada fruta que devora. Veintidós variedades de frutas aparecen de forma aleatoria mientras la velocidad aumenta gradualmente. Muere si colisionas contigo mismo — las paredes te teletransportan al lado contrario.',
  'SNAKE',
  'cover-snake',
  'green',
  0,
  '0',
  'snake'
);
```

`RouteName` actualizado:

```ts
export type RouteName =
  | 'home'
  | 'games'
  | 'detalle'
  | 'player'
  | 'auth'
  | 'salon'
  | 'about'
  | 'asteroids'
  | 'tetris'
  | 'arkanoid'
  | 'snake'
```

Estado interno del juego (no persiste entre sesiones):

```ts
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
type Cell = { col: number; row: number }

const COLS = 40 // 800 px / 20 px
const ROWS = 30 // 600 px / 20 px
const CELL = 20 // tamaño de celda en píxeles lógicos
const BASE_INTERVAL = 150 // ms entre ticks al inicio
const MIN_INTERVAL = 60 // ms mínimo (velocidad máxima)
const SPEED_STEP = 5 // ms que se resta por cada fruta comida
const POINTS_PER_FRUIT = 10
```

Atlas de sprites (derivado de `references/source-assets/snake-assets/sprites.js`):

```ts
type SpriteCoords = { x: number; y: number; w: number; h: number }
// 22 entradas: banana, orange, grape, garlic, eggplant, strawberry, cherry,
// carrot, mushroom, broccoli, watermelon, pepper, kiwi, lemon, peach, peanut,
// apple, tomato, berries, grapes2, pineapple, melon
// Todas en la fila y=136–295 (h=160 px) del sprite sheet fruits.png.
const FRUITS: SpriteCoords[] = [/* coordenadas exactas de sprites.js */]
```

---

## Plan de implementación

1. **Actualizar `lib/types.ts`:** añadir `'snake'` al union `RouteName`. Test: `npm run build` sin errores de tipo.

2. **Copiar sprite sheet a `public/`:** copiar `references/source-assets/snake-assets/fruits.png` a `public/snake-fruits.png`. Test: `GET /snake-fruits.png` devuelve la imagen con `npm run dev`.

3. **Crear `components/screens/SnakeScreen.tsx`:** componente React con la siguiente lógica:
   - Canvas `width=800 height=600` envuelto en un contenedor con `width: 100%; max-width: 800px; aspect-ratio: 800/600`. Las coordenadas de juego son siempre las 40×30 celdas lógicas.
   - El sprite sheet `public/snake-fruits.png` se carga una vez con `new Image()` en `useEffect` y se guarda en un `useRef<HTMLImageElement>`. Mientras no cargue, las frutas se dibujan como círculo de color fallback.
   - **Loop:** `setInterval` (no RAF) con intervalo inicial `BASE_INTERVAL`. Cada tick mueve la serpiente un paso en la dirección actual. El `intervalRef` se actualiza (clear + nuevo set) cuando cambia la velocidad al comer una fruta.
   - **Wrap-around:** si `col < 0 → col = COLS - 1`, si `col >= COLS → col = 0`; ídem para `row`.
   - **Game over:** solo al colisionar la cabeza con cualquier segmento del propio cuerpo (nunca con la pared).
   - **Dirección:** se encola el siguiente cambio y se aplica al inicio del siguiente tick; no se permite la dirección opuesta a la actual (previene colisión instantánea al presionar dos teclas rápido).
   - **Score:** `+POINTS_PER_FRUIT` por cada fruta comida. Al comer, `intervalMs = Math.max(MIN_INTERVAL, intervalMs - SPEED_STEP)`.
   - **Frutas:** al generar una nueva fruta, elegir `FRUITS[Math.floor(Math.random() * FRUITS.length)]` y una posición de celda libre. Dibujar con `ctx.drawImage(img, sprite.x, sprite.y, sprite.w, sprite.h, col*CELL, row*CELL, CELL, CELL)`.
   - **HUD React** (`position: absolute` sobre el canvas): score actual y longitud actual de la serpiente (número de segmentos).
   - **Pausa:** tecla `P` o `Escape` pausa/reanuda llamando a `clearInterval` / `setInterval`.
   - **Modal de game over React:** input nombre pre-relleno con `user?.name ?? 'INVITADO'`, máx 10 chars, mayúsculas. Botones: GUARDAR PUNTUACIÓN → `onSaveScore({ game: 'snake', score, name, at: Date.now() })`; JUGAR DE NUEVO reinicia el estado; VOLVER AL VAULT → `navigate({ name: 'games' })`.
   - **Props:** `{ navigate: (r: Route) => void; user: User | null; onSaveScore: (entry: SavedScore) => void }`.
   - **Cleanup en `useEffect`:** `clearInterval(intervalRef.current)` + `window.removeEventListener('keydown', handler)`.
   - Test: navegar a `'snake'` muestra la serpiente en movimiento; `ArrowLeft/Right/Up/Down` cambian la dirección; comer una fruta crece la serpiente y actualiza el score en el HUD; colisionar con el propio cuerpo muestra el modal de game over; guardar puntuación inserta una fila en Supabase.

4. **Añadir `.cover-snake` en `app/globals.css`:** fondo con gradiente radial oscuro en tonos verdes, cuerpo de serpiente representado con segmentos verdes encadenados en `::before`/`::after` (bordes redondeados, `clip-path` o `border-radius`), fruta pequeña como acento. Paleta: `var(--green)`. Test: la card de Snake en la Library tiene cover visible y coherente con las demás.

5. **Registrar la ruta en `app/page.tsx`:** importar `SnakeScreen` desde `@/components/screens/SnakeScreen`; añadir `} else if (route.name === 'snake') { screen = <SnakeScreen navigate={navigate} user={user} onSaveScore={handleSaveScore} />; }`. Test: `npm run dev` arranca sin errores de consola.

6. **Insertar fila en tabla `games` vía MCP:** ejecutar `mcp__supabase__apply_migration` con nombre de migración `010_add_snake_game` y el SQL del Data model. **No crear archivo SQL local.** Test: la tabla `games` muestra la nueva fila con `play_route = 'snake'`; la Library carga y muestra la card "SNAKE".

---

## Criterios de aceptación

- [ ] `RouteName` incluye `'snake'`.
- [ ] La Library muestra la card "SNAKE" con cover `.cover-snake` visible.
- [ ] El botón "JUGAR AHORA" en la ficha del juego navega a la ruta `'snake'`.
- [ ] La ruta `'snake'` renderiza el canvas con la serpiente en movimiento.
- [ ] `ArrowUp` mueve hacia arriba; `ArrowDown` hacia abajo; `ArrowLeft` a la izquierda; `ArrowRight` a la derecha.
- [ ] La serpiente no puede invertir su dirección instantáneamente (opuesto bloqueado).
- [ ] La serpiente cruza los bordes y reaparece por el lado opuesto (wrap-around).
- [ ] Comer una fruta crece la serpiente en 1 segmento.
- [ ] Comer una fruta incrementa el score en 10 puntos.
- [ ] La fruta es un sprite aleatorio de las 22 frutas disponibles, visible como imagen en el canvas.
- [ ] La velocidad de la serpiente aumenta gradualmente al comer frutas hasta el límite de 60 ms por tick.
- [ ] El HUD React muestra score y longitud actualizados en tiempo real.
- [ ] Colisionar la cabeza con el propio cuerpo muestra el modal de game over.
- [ ] El modal muestra la puntuación final de la partida.
- [ ] El input de nombre en el modal acepta hasta 10 caracteres en mayúsculas.
- [ ] "GUARDAR PUNTUACIÓN" inserta una fila en la tabla `scores` de Supabase.
- [ ] El score aparece en la pestaña de Snake en el Salón de la Fama.
- [ ] "JUGAR DE NUEVO" reinicia la partida sin recargar la página.
- [ ] "VOLVER AL VAULT" navega a `{ name: 'games' }`.
- [ ] `P` o `Escape` pausa y reanuda el juego.
- [ ] `npm run build` termina sin errores de TypeScript.
- [ ] No hay errores de consola al navegar por todas las pantallas.

---

## Decisiones

- **Slug `'snake'`, no `'serpentina'`** — `serpentina` es un placeholder pre-existente en la tabla `games`; crear `snake` como entrada independiente evita tocar datos ya sembrados.
- **`setInterval` en lugar de `requestAnimationFrame`** — Snake es un juego de tick fijo discreto: cada paso mueve exactamente una celda. RAF con acumulador de delta time añade complejidad sin aportar ventaja. `setInterval` con `intervalMs` variable modela la progresión de velocidad de forma directa y limpia.
- **Wrap-around en bordes** — elección del usuario. Elimina muertes por borde accidental y alarga las partidas.
- **22 sprites de frutas, todas a 10 pts** — variedad visual sin complejidad de balanceo de puntuación. Los sprites ya están mapeados en `references/source-assets/snake-assets/sprites.js`.
- **Sprite sheet en `public/`** — Next.js solo sirve archivos estáticos desde `public/`. Copiar `fruits.png` allí es la convención del framework; no se puede importar desde `references/`.
- **Grid 40×30 celdas de 20 px** — divide exactamente el canvas 800×600 sin fracciones. Colisiones se resuelven comparando índices de celda, no coordenadas de píxel.
- **Sin vidas** — Snake clásico no tiene vidas; una colisión termina la partida directamente.
- **Color `green`** — coherente con el tema visual de una serpiente; único entre los juegos actuales.
- **Velocidad gradual sin niveles explícitos** — −5 ms por fruta (mín. 60 ms) da una curva suave sin interrumpir el flujo. Los niveles con pantalla de transición quedan fuera de scope.

---

## Riesgos

| Riesgo                                                               | Mitigación                                                                                     |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `setState` desde el game loop causa renders excesivos                | Solo llamar a `setScore`/`setLength` al comer una fruta, no cada tick                          |
| La imagen `fruits.png` no carga antes del primer draw de fruta       | Comprobar `if (!imgRef.current?.complete)` y dibujar círculo fallback si aún no está lista     |
| `setInterval` se acumula si el `useEffect` se re-ejecuta sin cleanup | El `useEffect` retorna `() => clearInterval(intervalRef.current)` antes de registrar uno nuevo |
| Dirección opuesta causa colisión inmediata al siguiente tick         | Cola de dirección: ignorar la dirección opuesta a la actual al recibir el `keydown`            |
