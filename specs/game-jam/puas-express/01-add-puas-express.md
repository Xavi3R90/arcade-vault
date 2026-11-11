# SPEC GJ-puas-express-01 — Juego PÚAS EXPRESS (MVP jugable e integración)

> **Status:** Borrador
> **Depends on:** SPEC 06
> **Date:** 2026-11-11
> **Tema game jam:** Cruza la carretera y el río sin convertirte en papilla
> **Objetivo:** Implementar PÚAS EXPRESS, un juego de cruzar carriles de ida y vuelta con un erizo repartidor, como componente React con canvas 800×600, HUD en React, modal de game over con leaderboard en Supabase y ruta propia `'puas-express'`.

---

## Scope

**In:**

- `lib/types.ts`: añadir `'puas-express'` a `RouteName`.
- `components/screens/PuasExpressScreen.tsx`: componente nuevo con canvas 800×600 lógico, rejilla de 20×15 celdas de 40 px, 5 carriles de carretera y 5 de río, salto casilla a casilla con animación, viaje de ida (recoger baya) y vuelta (entregarla en la madriguera), temporizador por entrega, 3 vidas, HUD en React, modal de game over, props `{ navigate, user, onSaveScore }`, cleanup de RAF y listeners en `useEffect`.
- `app/globals.css`: clase `.cover-puas-express` con gradientes + carriles y erizo estilizado en `::before`/`::after`, paleta `yellow`.
- `app/page.tsx`: importar `PuasExpressScreen` y añadir el caso `'puas-express'` en el if/else if de rutas.
- Supabase tabla `games`: INSERT de la fila `puas-express` vía `mcp__supabase__apply_migration`.

**Fuera de scope (para specs posteriores):**

- Controles táctiles / mobile.
- Sonido y efectos de audio.
- Multijugador.
- Jornadas (niveles) con velocidad creciente, tabla de niveles y pantalla de transición → spec 02.
- Multiplicador de racha, bonus de jornada y vida extra por puntos → spec 02.
- Power-ups (escudo de púas, reloj, seta dorada) → spec 02.
- Enemigo garza, corrientes que cambian de sentido y fase nocturna → spec 02.
- Partículas, screen shake, flashes, squash & stretch del salto → spec 03.
- Pantalla de inicio in-canvas "PULSA ESPACIO PARA EMPEZAR" y controles WASD → spec 03.
- Récord personal de la sesión en el HUD y cover animada → spec 03.

---

## Data model

### Fila en tabla `games`

```ts
{
  id: 'puas-express',
  title: 'PÚAS EXPRESS',
  short: 'Cruza carretera y río con tu erizo sin acabar en papilla.',
  long: 'Púas, el erizo repartidor, debe cruzar cinco carriles de tráfico y un río de troncos y balsas de hojas para recoger bayas en el huerto y traerlas de vuelta a su madriguera. Cada viaje de ida y vuelta suma puntos, pero el reloj corre y un mal salto te deja hecho papilla. Tres vidas y un tráfico implacable — ¿cuántas entregas aguantas?',
  cat: 'ESQUIVA',
  cover: 'cover-puas-express',
  color: 'yellow',
  best: 0,
  plays: '0',
  playRoute: 'puas-express',
}
```

### SQL equivalente (para la migración)

```sql
INSERT INTO public.games (id, title, short, long, cat, cover, color, best, plays, play_route)
VALUES (
  'puas-express',
  'PÚAS EXPRESS',
  'Cruza carretera y río con tu erizo sin acabar en papilla.',
  'Púas, el erizo repartidor, debe cruzar cinco carriles de tráfico y un río de troncos y balsas de hojas para recoger bayas en el huerto y traerlas de vuelta a su madriguera. Cada viaje de ida y vuelta suma puntos, pero el reloj corre y un mal salto te deja hecho papilla. Tres vidas y un tráfico implacable — ¿cuántas entregas aguantas?',
  'ESQUIVA',
  'cover-puas-express',
  'yellow',
  0,
  '0',
  'puas-express'
);
```

### Cambios en TypeScript

`RouteName` en `lib/types.ts`:

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
  | 'puas-express'
```

No se añaden interfaces a `lib/types.ts`: `Game` ya tiene `playRoute?: RouteName`.

### Layout del tablero (filas de 40 px, origen arriba-izquierda)

| Fila | Zona                  | Comportamiento                                                    |
| ---- | --------------------- | ----------------------------------------------------------------- |
| 0    | Banda superior        | Decorativa (bajo el HUD). No jugable.                             |
| 1    | Huerto (orilla norte) | Segura. Contiene la baya a recoger en una columna aleatoria 2–17. |
| 2–6  | Río                   | Mortal salvo encima de una plataforma (tronco o balsa de hojas).  |
| 7    | Mediana de hierba     | Segura.                                                           |
| 8–12 | Carretera             | Segura salvo contacto con un vehículo.                            |
| 13   | Seto de la madriguera | Segura. Punto de salida y de entrega (cualquier columna).         |
| 14   | Banda inferior        | Decorativa. No jugable.                                           |

### Tipos y constantes internos (en `PuasExpressScreen.tsx`)

```ts
type LaneType = 'road' | 'river'
type EntityKind = 'moto' | 'coche' | 'tractor' | 'furgoneta' | 'camion' | 'tronco' | 'balsa'
type Dir = 'up' | 'down' | 'left' | 'right'
type Leg = 'ida' | 'vuelta' // ida: hacia el huerto; vuelta: hacia la madriguera con la baya
type DeathCause = 'papilla' | 'ahogado' | 'arrastrado' | 'tiempo'

type LaneConfig = {
  row: number
  type: LaneType
  dir: 1 | -1 // 1 = hacia la derecha
  speed: number // px/s
  kind: EntityKind
  length: number // px
  spacing: number // px entre bordes izquierdos de entidades consecutivas (spacing > length)
}
type LaneEntity = { x: number; length: number; kind: EntityKind } // x = borde izquierdo
type Lane = LaneConfig & { entities: LaneEntity[] }

type Hop = { fromX: number; fromRow: number; toX: number; toRow: number; t: number } // t en ms
type Player = { x: number; row: number; facing: Dir; hop: Hop | null; carrying: boolean }

type GameStatus = 'playing' | 'dying' | 'gameover'
type GameState = {
  status: GameStatus
  score: number
  lives: number
  deliveries: number
  timeLeft: number // s
  leg: Leg
  legBestRow: number // fila más avanzada alcanzada en el tramo actual
  berryCol: number
  deathTimer: number // ms restantes de la animación de muerte
  deathCause: DeathCause | null
}

const CANVAS_W = 800
const CANVAS_H = 600
const CELL = 40
const COLS = 20
const ROWS = 15
const ROW_ORCHARD = 1
const ROW_MEDIAN = 7
const ROW_DEN = 13
const RIVER_ROWS = [2, 3, 4, 5, 6]
const ROAD_ROWS = [8, 9, 10, 11, 12]
const START_X = 400 // centro de la columna 10
const HOP_MS = 120
const PLAYER_HITBOX = 26 // px, cuadrado centrado
const VEHICLE_HITBOX_H = 30 // px, centrado en el carril
const PLATFORM_TOLERANCE = 6 // px que el centro del erizo debe estar dentro del borde
const TRIP_TIME = 60 // s por entrega (ida + vuelta)
const START_LIVES = 3
const DEATH_ANIM_MS = 700
const MAX_DT = 0.05 // s

const POINTS_ROW = 10 // por cada fila nueva alcanzada en el tramo actual
const POINTS_PICKUP = 50 // al recoger la baya
const POINTS_DELIVERY = 200 // al entregar en la madriguera
const POINTS_PER_SECOND_LEFT = 10 // × segundos enteros restantes al entregar

const LANES: LaneConfig[] = [
  // Río
  { row: 2, type: 'river', dir: -1, speed: 120, kind: 'tronco', length: 140, spacing: 300 },
  { row: 3, type: 'river', dir: 1, speed: 70, kind: 'balsa', length: 120, spacing: 220 },
  { row: 4, type: 'river', dir: -1, speed: 100, kind: 'tronco', length: 200, spacing: 340 },
  { row: 5, type: 'river', dir: 1, speed: 80, kind: 'balsa', length: 100, spacing: 240 },
  { row: 6, type: 'river', dir: -1, speed: 60, kind: 'tronco', length: 160, spacing: 280 },
  // Carretera
  { row: 8, type: 'road', dir: 1, speed: 90, kind: 'camion', length: 140, spacing: 380 },
  { row: 9, type: 'road', dir: -1, speed: 140, kind: 'furgoneta', length: 80, spacing: 320 },
  { row: 10, type: 'road', dir: 1, speed: 60, kind: 'tractor', length: 70, spacing: 300 },
  { row: 11, type: 'road', dir: -1, speed: 100, kind: 'coche', length: 60, spacing: 260 },
  { row: 12, type: 'road', dir: 1, speed: 70, kind: 'moto', length: 40, spacing: 220 },
]
```

### Paleta (hex)

| Elemento             | Color                                    |
| -------------------- | ---------------------------------------- |
| Fondo / bandas       | `#0a0a0f`                                |
| Huerto y seto        | `#2f6b3a`                                |
| Mediana              | `#3b7d46`                                |
| Asfalto              | `#1f1f2b`, líneas discontinuas `#f5ff00` |
| Río                  | `#0e4a6e`, reflejos `#1b6f9e`            |
| Tronco               | `#8b5a2b`, vetas `#5d3a1a`               |
| Balsa de hojas       | `#4caf50`, nervios `#2e7d32`             |
| Erizo: cuerpo / púas | `#c9a27e` / `#4e342e`                    |
| Baya                 | `#e0245e`                                |
| Moto                 | `#ff006e`                                |
| Coche                | `#00f5ff`                                |
| Tractor              | `#f5ff00`                                |
| Furgoneta            | `#f0f0f0`                                |
| Camión               | `#ff7a1a`                                |

---

## Plan de implementación

1. **Actualizar `lib/types.ts`:** añadir `'puas-express'` al union `RouteName` (ver Data model). Test: `npm run build` sin errores de tipo.

2. **Crear `components/screens/PuasExpressScreen.tsx`:** componente React con la siguiente lógica:
   - **Canvas 800×600:** `<canvas ref={canvasRef} width={800} height={600}>` dentro de un contenedor con `position: relative; width: 100%; max-width: 800px; aspect-ratio: 800/600`. Coordenadas lógicas fijas 800×600; el CSS escala la visualización.
   - **Estado del juego en refs:** `gsRef = useRef<GameState>()`, `playerRef = useRef<Player>()`, `lanesRef = useRef<Lane[]>()`, `pausedRef = useRef(false)`, `queuedDirRef = useRef<Dir | null>(null)`. React solo guarda lo que pinta el HUD/modal (`score`, `lives`, `deliveries`, `timeLeft`, `carrying`, `paused`, `over`).
   - **Inicialización de carriles (`buildLanes`):** para cada `LaneConfig`, `count = Math.ceil((CANVAS_W + 2 * length) / spacing) + 1`; entidades con `x = -length + i * spacing` para `i = 0..count-1`.
   - **Loop:** `requestAnimationFrame` en `useEffect`, `dt = Math.min(MAX_DT, (now - last) / 1000)`. El loop nunca se detiene (patrón AsteroidsScreen): `pausedRef.current` y `status === 'gameover'` bloquean `update(dt)`; `draw()` se ejecuta siempre. Se elige RAF y no `setInterval` porque los vehículos y plataformas se mueven de forma continua en px/s, aunque el erizo salte por casillas.
   - **Movimiento de carriles:** `e.x += dir * speed * dt`. Wrap: si `dir > 0 && e.x > CANVAS_W` → `e.x -= count * spacing`; si `dir < 0 && e.x + e.length < 0` → `e.x += count * spacing`.
   - **Salto del erizo:** al recibir una dirección, si no hay `hop` en curso se crea `Hop` hacia la celda destino (±40 px en x o ±1 fila); si hay salto en curso se guarda en `queuedDirRef` (buffer de 1) y se aplica al terminar. Duración `HOP_MS`; posición visual interpolada linealmente. Límites: fila entre `ROW_ORCHARD` y `ROW_DEN`; `x` entre `20` y `780` (salto lateral que saldría del rango se ignora).
   - **Arrastre en río:** si el erizo no está saltando y su fila es de río, `player.x += lane.dir * lane.speed * dt` de la plataforma sobre la que está.
   - **Colisiones:**
     - Vehículos: AABB entre el cuadrado `PLAYER_HITBOX` centrado en la posición visual (incluido mid-hop) y cada vehículo del carril de la fila visual redondeada (`x..x+length`, alto `VEHICLE_HITBOX_H`). Contacto → muerte `'papilla'`.
     - Río: al terminar un salto y en cada frame sin salto en una fila de río, buscar una plataforma con `e.x + PLATFORM_TOLERANCE <= player.x <= e.x + e.length - PLATFORM_TOLERANCE`. Si no hay → muerte `'ahogado'`. Durante el salto no se comprueba el agua.
     - Bordes: si en una fila de río `player.x < 0 || player.x > CANVAS_W` → muerte `'arrastrado'`.
   - **Ida y vuelta:** en `leg === 'ida'`, al aterrizar en `ROW_ORCHARD` en la columna `berryCol` (`Math.floor(player.x / CELL) === berryCol`) → `carrying = true`, `+POINTS_PICKUP`, `leg = 'vuelta'`, `legBestRow = ROW_ORCHARD`. En `leg === 'vuelta'`, al aterrizar en `ROW_DEN` con `carrying` → `+POINTS_DELIVERY + Math.floor(timeLeft) * POINTS_PER_SECOND_LEFT`, `deliveries++`, `carrying = false`, `leg = 'ida'`, `legBestRow = ROW_DEN`, `timeLeft = TRIP_TIME`, nueva `berryCol = 2 + Math.floor(Math.random() * 16)`.
   - **Puntos por avance:** al aterrizar, si `leg === 'ida' && row < legBestRow` o `leg === 'vuelta' && row > legBestRow` → `+POINTS_ROW` y `legBestRow = row`.
   - **Temporizador:** `timeLeft -= dt` en `status === 'playing'`; al llegar a 0 → muerte `'tiempo'`.
   - **Muerte y respawn:** `status = 'dying'`, `deathTimer = DEATH_ANIM_MS`, `lives--`. Durante `'dying'` los carriles siguen moviéndose y se dibuja una mancha de papilla (`'papilla'`: círculo `#c9a27e` aplastado + 8 trazos `#4e342e`) o un anillo de agua (`'ahogado'`/`'arrastrado'`: círculo `#9fd8ff` sin relleno de radio creciente) o el erizo gris (`'tiempo'`). Al terminar: si `lives <= 0` → `status = 'gameover'`; si no, respawn en `x = START_X` y fila de inicio del tramo actual (`ROW_DEN` en ida, `ROW_ORCHARD` en vuelta conservando la baya), `timeLeft = TRIP_TIME`, `legBestRow` = fila de respawn.
   - **Dibujo con primitivas:** zonas por fila con los colores de la paleta; vehículos como `fillRect` redondeados con ventanilla y faros según `kind`; troncos con vetas; balsas como elipses verdes con nervio central; erizo como semicírculo de púas (triángulos `#4e342e`) sobre cuerpo ovalado `#c9a27e`, orientado según `facing`; la baya como círculo `#e0245e` en el huerto y, si `carrying`, sobre el lomo del erizo.
   - **Teclado:** `keydown` en `window`: `ArrowUp/ArrowDown/ArrowLeft/ArrowRight` → salto (con `preventDefault` para no hacer scroll); `e.repeat === true` se ignora (un salto por pulsación). `P` / `Escape` → toggle `pausedRef` y `setPaused`. Cleanup con `removeEventListener`.
   - **Pausa:** con `pausedRef.current` el canvas dibuja un overlay `rgba(10,10,15,0.7)` con el texto "PAUSA" centrado; el temporizador no avanza.
   - **HUD React** (`position: absolute; top: 0; left: 0; right: 0` sobre el canvas): SCORE, VIDAS (iconos `●` en `var(--yellow)`), ENTREGAS, TIEMPO (segundos enteros) y BAYA (`SÍ`/`NO`). Botón PAUSA → toggle; botón SALIR → `navigate({ name: 'detalle', id: 'puas-express' })`.
   - **Estado → React:** los setters solo se llaman cuando el valor cambia (`Math.ceil(timeLeft)` comparado con el último valor publicado; score/lives/deliveries/carrying comparados con refs `lastHudRef`).
   - **Modal de game over React:** título "HECHO PAPILLA", score final y entregas realizadas. Input de nombre pre-rellenado con `user?.name ?? 'INVITADO'`, `maxLength={10}`, transformado a mayúsculas en `onChange`. Botones: "GUARDAR PUNTUACIÓN" → `onSaveScore({ game: 'puas-express', score, name, at: Date.now() })` (se deshabilita tras guardar); "JUGAR DE NUEVO" → `restartGame()` (reconstruye carriles y estado sin recargar); "VOLVER AL VAULT" → `navigate({ name: 'games' })`.
   - **Props:** `{ navigate: (r: Route) => void; user: User | null; onSaveScore: (entry: SavedScore) => void }`.
   - **Cleanup en `useEffect`:** `cancelAnimationFrame(rafRef.current)` + `window.removeEventListener('keydown', onKeyDown)`.
   - Test: navegar a `'puas-express'` muestra el tablero con tráfico y río en movimiento; las flechas hacen saltar al erizo una casilla; tocar un coche o caer al agua resta una vida; recoger la baya y volver a la madriguera suma 200 + bonus de tiempo; con 0 vidas aparece el modal; guardar inserta una fila en Supabase.

3. **Añadir `.cover-puas-express` en `app/globals.css`:** fondo `radial-gradient(circle at 50% 60%, #2a2a00, #0a0a0f)`. `::before` dibuja tres franjas horizontales (asfalto `#1f1f2b` con líneas discontinuas `var(--yellow)` mediante `repeating-linear-gradient`, mediana `#2f6b3a` y río `#0e4a6e`) con dos rectángulos de vehículo (`#ff006e`, `#00f5ff`) como `linear-gradient` posicionados. `::after` dibuja el erizo: forma de púas con `clip-path: polygon(...)` dentada en `#4e342e` sobre cuerpo `#c9a27e`, con `filter: drop-shadow(0 0 8px rgba(245, 255, 0, 0.6))`. Test: la card de PÚAS EXPRESS en la Library muestra la cover visible y coherente con las demás.

4. **Registrar la ruta en `app/page.tsx`:** importar `PuasExpressScreen` desde `@/components/screens/PuasExpressScreen`; añadir:

   ```tsx
   } else if (route.name === 'puas-express') {
     screen = <PuasExpressScreen navigate={navigate} user={user} onSaveScore={handleSaveScore} />
   }
   ```

   Test: `npm run dev` arranca sin errores de consola.

5. **Insertar fila en tabla `games` vía MCP:** ejecutar `mcp__supabase__apply_migration` con nombre de migración `011_add_puas_express_game` y el SQL del Data model. **No crear archivo SQL local.** Antes de aplicarla, verificar con `SELECT id FROM public.games WHERE id = 'puas-express';` que el slug sigue libre y con `SELECT name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 1;` que `011` es el siguiente número. Test: la tabla `games` muestra la fila con `play_route = 'puas-express'`; la Library carga y muestra la card "PÚAS EXPRESS".

---

## Criterios de aceptación

- [ ] `RouteName` incluye `'puas-express'`.
- [ ] La Library muestra la card "PÚAS EXPRESS" con cover `.cover-puas-express` visible.
- [ ] Hacer clic en la card navega a GameDetail de PÚAS EXPRESS.
- [ ] El botón "JUGAR AHORA" en la ficha del juego navega a la ruta `'puas-express'`.
- [ ] La ruta `'puas-express'` renderiza el canvas 800×600 con 5 carriles de tráfico y 5 de río en movimiento.
- [ ] El canvas se escala al ancho disponible manteniendo la proporción 800/600.
- [ ] `ArrowUp` hace saltar al erizo una fila hacia arriba.
- [ ] `ArrowDown` hace saltar al erizo una fila hacia abajo.
- [ ] `ArrowLeft` / `ArrowRight` hacen saltar al erizo 40 px a izquierda / derecha.
- [ ] Mantener pulsada una flecha produce un único salto (el autorepeat se ignora).
- [ ] Las flechas no hacen scroll de la página mientras el juego está montado.
- [ ] El erizo no puede salir por encima de la fila 1 ni por debajo de la fila 13.
- [ ] Tocar un vehículo resta 1 vida y muestra la mancha de papilla durante 700 ms.
- [ ] Aterrizar en una fila de río fuera de una plataforma resta 1 vida.
- [ ] Sobre un tronco o balsa, el erizo se desplaza con la plataforma.
- [ ] Ser arrastrado fuera del canvas por una plataforma resta 1 vida.
- [ ] Llegar a 0 segundos en el temporizador resta 1 vida.
- [ ] Cada fila nueva alcanzada en el tramo actual suma 10 puntos; volver a una fila ya alcanzada no suma.
- [ ] Aterrizar sobre la baya en el huerto suma 50 puntos y el HUD muestra BAYA: SÍ.
- [ ] Llegar a la fila 13 con la baya suma 200 + 10 × segundos restantes, incrementa ENTREGAS en 1 y reinicia el temporizador a 60 s.
- [ ] Tras una entrega aparece una nueva baya en una columna entre 2 y 17 del huerto.
- [ ] Morir durante la vuelta reaparece en el huerto conservando la baya.
- [ ] El HUD muestra SCORE, VIDAS, ENTREGAS, TIEMPO y BAYA actualizados.
- [ ] Al perder la tercera vida se muestra el modal de game over con el score final.
- [ ] El input de nombre del modal acepta como máximo 10 caracteres y los muestra en mayúsculas.
- [ ] El input aparece pre-rellenado con el nombre del usuario o `INVITADO`.
- [ ] "GUARDAR PUNTUACIÓN" inserta una fila en la tabla `scores` de Supabase con `game_id = 'puas-express'`.
- [ ] El score aparece en la pestaña de PÚAS EXPRESS del Salón de la Fama.
- [ ] "JUGAR DE NUEVO" reinicia la partida con 3 vidas y score 0 sin recargar la página.
- [ ] "VOLVER AL VAULT" navega a `{ name: 'games' }`.
- [ ] El botón SALIR del HUD navega a `{ name: 'detalle', id: 'puas-express' }`.
- [ ] `P` o `Escape` pausa y reanuda; en pausa el temporizador no baja.
- [ ] Al salir de la pantalla no quedan RAF ni listeners `keydown` activos.
- [ ] `npm run build` termina sin errores de TypeScript.
- [ ] No hay errores de consola al navegar por todas las pantallas.

---

## Decisiones

- **Concepto original "ida y vuelta con carga":** el tema pide cruzar carretera y río sin acabar hecho papilla. En lugar de rellenar huecos en la orilla de llegada, cada partida es una ruta de reparto: Púas cruza hasta el huerto, recoge una baya y debe volver a cruzarlo todo en sentido contrario. Esto obliga a leer los carriles en ambas direcciones y convierte la mitad de cada entrega en un descenso, algo que el género no suele exigir. Nombre, protagonista (erizo repartidor), ambientación rural y vehículos (tractor, furgoneta, camión de leche) son propios.
- **Conceptos descartados:** (1) un robot de limpieza cruzando una autopista neón y un canal de residuos — encajaba peor con "papilla" y dependía de estética más que de mecánica; (2) un pato que lleva a sus patitos en fila — mecánica de cola tipo Snake, solapaba con un juego ya implementado.
- **Física híbrida:** el erizo se mueve por casillas de 40 px (salto discreto con tween de 120 ms) mientras vehículos y plataformas se mueven de forma continua en px/s. Aporta al catálogo un tipo de juego que no existe: esquiva en carriles con timing, distinto del grid puro de Tetris/Snake, la inercia de Asteroids y el rebote de Arkanoid.
- **RAF y no `setInterval`:** a diferencia de Snake, el movimiento del entorno es continuo; RAF con `dt` limitado a 50 ms evita saltos de posición tras pestañas inactivas.
- **Rejilla 20×15 de 40 px:** divide exactamente el canvas 800×600. Las filas 0 y 14 son decorativas para que el HUD React no tape zona jugable.
- **Entrega en cualquier columna del seto:** la dificultad está en el cruce; obligar a un hueco concreto en la madriguera alargaría las partidas sin añadir decisión interesante en el MVP.
- **Respawn en el inicio del tramo conservando la baya:** perder la baya además de la vida sería doblemente punitivo y desincentivaría la vuelta.
- **Puntos de avance por tramo (`legBestRow`):** impide farmear puntos subiendo y bajando la misma fila.
- **Categoría `ESQUIVA`:** el catálogo no tiene juego de esquiva por carriles; es la categoría que ya usa el agente `game-planner` para el género.
- **Color `yellow`:** los cuatro colores tienen un juego cada uno; `yellow` encaja con los faros, las líneas de la carretera y el tractor, y evita `green`, propuesto para la idea relacionada `grid-hopper` en `references/game-suggestions-todo.md`.
- **Sin desviaciones del patrón AsteroidsScreen:** canvas 800×600, loop RAF continuo con gating por pausa/estado, HUD React absoluto y modal React.
- **Slug no verificado contra la DB:** el MCP de Supabase no respondió al redactar este spec; el paso 5 incluye la verificación previa.

---

## Riesgos

| Riesgo                                                                   | Mitigación                                                                                                             |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `setState` desde el game loop causa renders excesivos                    | Comparar antes de setear: el tiempo se publica como `Math.ceil(timeLeft)` y solo cuando cambia ese entero              |
| Muerte injusta en mitad de un salto sobre el río                         | El agua solo se comprueba al aterrizar y cuando no hay salto en curso                                                  |
| El erizo "flota" a la deriva fuera de la rejilla tras bajar de un tronco | Al aterrizar en fila no-río, `x` se ajusta al centro de la columna más cercana (`Math.round((x - 20) / 40) * 40 + 20`) |
| Flechas hacen scroll de la página                                        | `preventDefault()` en el `keydown` de flechas mientras la pantalla está montada                                        |
| RAF o listener duplicado al re-montar                                    | El `useEffect` retorna cleanup con `cancelAnimationFrame` y `removeEventListener`                                      |
| Apóstrofes o comillas en `long` rompen el INSERT                         | El texto `long` no contiene comillas simples; revisarlo antes de aplicar la migración                                  |
| Slug o número de migración ocupados (MCP caído al redactar)              | Verificación con `SELECT` previa en el paso 5; si colisiona, renumerar la migración                                    |
