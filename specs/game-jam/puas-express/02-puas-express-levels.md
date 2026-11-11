# SPEC GJ-puas-express-02 — PÚAS EXPRESS: jornadas, dificultad y power-ups

> **Status:** Borrador
> **Depends on:** `specs/game-jam/puas-express/01-add-puas-express.md`
> **Date:** 2026-11-11
> **Tema game jam:** Cruza la carretera y el río sin convertirte en papilla
> **Objetivo:** Añadir a PÚAS EXPRESS una progresión por jornadas de 2 entregas con velocidad creciente, nuevos peligros (corriente que cambia de sentido, garza en la mediana y fase nocturna), multiplicador de racha, vida extra y tres power-ups.

---

## Scope

**In:**

- `components/screens/PuasExpressScreen.tsx`:
  - Tabla `LEVELS` de 8 jornadas y fórmula de escalado a partir de la jornada 9.
  - Paso de jornada cada 2 entregas, con bonus de jornada y transición dibujada en canvas ("JORNADA N").
  - Multiplicador de racha por entregas consecutivas sin perder vida.
  - Vida extra cada 5000 puntos, máximo 5 vidas.
  - Peligro nuevo **corriente cambiante**: carriles de río que invierten el sentido cada 8 s con aviso previo.
  - Peligro nuevo **garza**: enemigo que patrulla la mediana (fila 7).
  - Peligro nuevo **noche**: oscuridad con radio de visión alrededor del erizo y conos de faros.
  - Power-ups: escudo de púas, reloj de arena y seta dorada.
  - HUD ampliado: JORNADA, multiplicador, power-up activo y tiempo restante del power-up.

**Fuera de scope (para specs posteriores):**

- Controles táctiles / mobile.
- Sonido y efectos de audio.
- Multijugador.
- Selector de jornada inicial o modos de dificultad.
- Partículas, screen shake, flashes y pantalla de inicio → spec 03.
- Cambios en la tabla `games`, columnas nuevas o migraciones (no se requieren).
- Cambios en `RouteName`, `app/page.tsx` o `lib/types.ts` (no se requieren).

---

## Data model

Este spec no toca Supabase ni `lib/types.ts`. Todos los tipos y constantes viven en `PuasExpressScreen.tsx`.

### Jornadas

```ts
type LevelConfig = {
  level: number
  speedMul: number // multiplica `speed` de todos los carriles de LANES
  platformMul: number // multiplica `length` de troncos y balsas (spacing no cambia)
  tripTime: number // s por entrega, sustituye a TRIP_TIME
  reversingRows: number[] // filas de río con corriente cambiante
  heronSpeed: number // px/s; 0 = sin garza
  night: boolean
}

const DELIVERIES_PER_LEVEL = 2

const LEVELS: LevelConfig[] = [
  {
    level: 1,
    speedMul: 1.0,
    platformMul: 1.0,
    tripTime: 60,
    reversingRows: [],
    heronSpeed: 0,
    night: false,
  },
  {
    level: 2,
    speedMul: 1.15,
    platformMul: 1.0,
    tripTime: 58,
    reversingRows: [],
    heronSpeed: 0,
    night: false,
  },
  {
    level: 3,
    speedMul: 1.3,
    platformMul: 0.95,
    tripTime: 55,
    reversingRows: [4],
    heronSpeed: 0,
    night: false,
  },
  {
    level: 4,
    speedMul: 1.4,
    platformMul: 0.9,
    tripTime: 52,
    reversingRows: [4],
    heronSpeed: 50,
    night: false,
  },
  {
    level: 5,
    speedMul: 1.5,
    platformMul: 0.9,
    tripTime: 50,
    reversingRows: [4],
    heronSpeed: 50,
    night: true,
  },
  {
    level: 6,
    speedMul: 1.6,
    platformMul: 0.85,
    tripTime: 48,
    reversingRows: [4],
    heronSpeed: 70,
    night: false,
  },
  {
    level: 7,
    speedMul: 1.75,
    platformMul: 0.8,
    tripTime: 45,
    reversingRows: [2, 4],
    heronSpeed: 70,
    night: true,
  },
  {
    level: 8,
    speedMul: 1.9,
    platformMul: 0.75,
    tripTime: 45,
    reversingRows: [2, 4],
    heronSpeed: 90,
    night: true,
  },
]

// Jornada 9 en adelante: se parte de LEVELS[7] y
// speedMul = Math.min(2.4, 1.9 + 0.1 * (level - 8)), platformMul = 0.7, resto igual.
const MAX_SPEED_MUL = 2.4
```

| Jornada | Velocidad            | Plataformas | Tiempo | Corriente cambiante | Garza (px/s) | Noche |
| ------- | -------------------- | ----------- | ------ | ------------------- | ------------ | ----- |
| 1       | ×1.00                | ×1.00       | 60 s   | —                   | —            | No    |
| 2       | ×1.15                | ×1.00       | 58 s   | —                   | —            | No    |
| 3       | ×1.30                | ×0.95       | 55 s   | fila 4              | —            | No    |
| 4       | ×1.40                | ×0.90       | 52 s   | fila 4              | 50           | No    |
| 5       | ×1.50                | ×0.90       | 50 s   | fila 4              | 50           | Sí    |
| 6       | ×1.60                | ×0.85       | 48 s   | fila 4              | 70           | No    |
| 7       | ×1.75                | ×0.80       | 45 s   | filas 2 y 4         | 70           | Sí    |
| 8       | ×1.90                | ×0.75       | 45 s   | filas 2 y 4         | 90           | Sí    |
| 9+      | +0.10/j (máx. ×2.40) | ×0.70       | 45 s   | filas 2 y 4         | 90           | Sí    |

### Corriente cambiante

```ts
const REVERSE_PERIOD = 8 // s entre inversiones
const REVERSE_WARNING = 1.5 // s de aviso antes de invertir
```

- Cada fila de `reversingRows` tiene un temporizador propio que arranca en `REVERSE_PERIOD`.
- Durante los últimos `REVERSE_WARNING` s se dibujan flechas `#f5ff00` parpadeando a 4 Hz en ambos extremos del carril apuntando al nuevo sentido.
- Al llegar a 0: `lane.dir *= -1` y el temporizador vuelve a `REVERSE_PERIOD`. El erizo que esté encima cambia de sentido con la plataforma.
- El wrap de entidades se recalcula con el nuevo `dir` (las reglas de wrap del spec 01 ya dependen de `dir`).

### Garza

```ts
type Heron = { x: number; dir: 1 | -1; speed: number; width: number }
const HERON_WIDTH = 48 // px
const HERON_HITBOX_H = 30 // px
```

- Patrulla la fila `ROW_MEDIAN` (7) de lado a lado, rebotando al tocar `x <= 0` o `x + HERON_WIDTH >= CANVAS_W`.
- Contacto AABB con el erizo → muerte con nueva causa `'picotazo'` (`type DeathCause = 'papilla' | 'ahogado' | 'arrastrado' | 'tiempo' | 'picotazo'`).
- Dibujo: cuerpo elipse `#b0bec5`, cuello y pico `#ffb300`, patas como líneas `#ffb300` que alternan cada 200 ms.

### Noche

```ts
const NIGHT_ALPHA = 0.88 // opacidad de la oscuridad
const NIGHT_RADIUS = 150 // px de visión alrededor del erizo
const HEADLIGHT_LENGTH = 160 // px del cono de faros
```

- Un canvas offscreen de 800×600 creado una sola vez en `useEffect` se rellena con `rgba(5, 5, 20, NIGHT_ALPHA)` y se le recorta con `globalCompositeOperation = 'destination-out'` un `radialGradient` de radio `NIGHT_RADIUS` centrado en el erizo.
- Los vehículos dibujan, después de la oscuridad y con `globalCompositeOperation = 'lighter'`, un triángulo de faros `rgba(245, 255, 0, 0.25)` de longitud `HEADLIGHT_LENGTH` en su sentido de marcha.
- La baya y los power-ups se dibujan por encima de la oscuridad con un halo de 10 px para ser siempre visibles.

### Racha, bonus y vidas

```ts
const LEVEL_BONUS = 500 // × número de jornada completada
const EXTRA_LIFE_EVERY = 5000
const MAX_LIVES = 5

// streak = entregas consecutivas sin perder vida, contando la actual
const comboMul = (streak: number) => (streak >= 5 ? 3 : streak >= 3 ? 2 : streak >= 2 ? 1.5 : 1)
```

| Evento                 | Puntos                                                    |
| ---------------------- | --------------------------------------------------------- |
| Fila nueva en el tramo | 10 (sin multiplicador)                                    |
| Recoger baya           | 50 (sin multiplicador)                                    |
| Entrega                | `Math.round((200 + 10 × s restantes) × comboMul(streak))` |
| Completar jornada      | `Math.round(500 × jornada × comboMul(streak))`            |
| Recoger power-up       | 25                                                        |
| Seta dorada activa     | ×2 adicional a todos los eventos anteriores durante 10 s  |

- Perder una vida pone `streak = 0`.
- Cada vez que `score` cruza un múltiplo de `EXTRA_LIFE_EVERY` se suma 1 vida si `lives < MAX_LIVES` (se guarda `nextLifeAt` para no repetirlo).

### Power-ups

```ts
type PowerUpKind = 'escudo' | 'reloj' | 'seta'
type PowerUp = { kind: PowerUpKind; col: number; row: number; ttl: number } // ttl en s
type ActivePower = { kind: 'seta'; timeLeft: number } | null

const POWERUP_SPAWN_CHANCE = 0.35 // tras cada recogida de baya o entrega
const POWERUP_TTL = 12 // s en el tablero antes de desaparecer
const POWERUP_WEIGHTS: Record<PowerUpKind, number> = { escudo: 0.4, reloj: 0.35, seta: 0.25 }
const CLOCK_BONUS = 15 // s
const SETA_DURATION = 10 // s
```

| Power-up       | Dibujo                                         | Efecto                                                                                |
| -------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| Escudo de púas | Círculo `#4e342e` con 8 púas `#f5ff00`         | Absorbe el siguiente golpe de vehículo o garza (no agua, arrastre ni tiempo). Máx. 1. |
| Reloj de arena | Dos triángulos `#00f5ff` unidos por el vértice | `timeLeft += 15` (sin superar `tripTime` de la jornada + 15).                         |
| Seta dorada    | Sombrero semicírculo `#f5ff00`, pie `#f0f0f0`  | ×2 a los puntos durante 10 s.                                                         |

- Solo puede haber un power-up en el tablero a la vez. Aparece en la fila 7 (mediana) en una columna aleatoria 1–18 que no coincida con la garza.
- Se recoge al aterrizar en su celda.
- Con escudo activo, el erizo se dibuja con un anillo `#f5ff00` de 2 px; al absorber un golpe, el escudo desaparece y el erizo es invulnerable 1000 ms (parpadeo a 10 Hz).

### Estado ampliado

```ts
type GameStatus = 'playing' | 'dying' | 'levelup' | 'gameover'
type GameState = /* campos del spec 01 */ {
  level: number
  deliveriesInLevel: number
  streak: number
  nextLifeAt: number
  shield: boolean
  invulnTimer: number // ms
  activePower: ActivePower
  powerUp: PowerUp | null
  heron: Heron | null
  reverseTimers: Record<number, number> // fila → s
  levelupTimer: number // ms
}
const LEVELUP_MS = 2000
```

---

## Plan de implementación

1. **Introducir `LEVELS` y `getLevelConfig(level)`:** añadir las constantes y una función pura que devuelve `LEVELS[level - 1]` o la fórmula de jornada 9+. `buildLanes(config)` aplica `speedMul` a `speed` y `platformMul` a `length` de carriles de río. `TRIP_TIME` se sustituye por `config.tripTime`. Test: forzando `level = 3` en el estado inicial, los vehículos de la fila 9 se mueven a 182 px/s (140 × 1.3) y el temporizador arranca en 55 s.

2. **Paso de jornada y transición:** al entregar, `deliveriesInLevel++`; si llega a `DELIVERIES_PER_LEVEL` → sumar bonus de jornada, `status = 'levelup'`, `levelupTimer = LEVELUP_MS`. En `'levelup'` las entidades se congelan y el canvas dibuja un overlay `rgba(10,10,15,0.75)` con "JORNADA N" (48 px, `#f5ff00`) y debajo "+BONUS" y el nombre de los peligros nuevos de esa jornada ("¡CORRIENTE CAMBIANTE!", "¡CUIDADO CON LA GARZA!", "CAE LA NOCHE"). Al terminar: `level++`, `deliveriesInLevel = 0`, reconstruir carriles, respawn en `ROW_DEN`, `status = 'playing'`. Test: tras la segunda entrega aparece "JORNADA 2" durante 2 s y después la velocidad es ×1.15.

3. **Racha, multiplicador y vida extra:** implementar `comboMul`, `streak` (reset al morir) y `nextLifeAt`. Aplicar el multiplicador a entrega y bonus de jornada; aplicar ×2 de la seta a todos los eventos si está activa. Test: tres entregas seguidas sin morir puntúan la tercera con ×2; al cruzar 5000 pts el contador de vidas sube en 1 hasta un máximo de 5.

4. **Corriente cambiante:** temporizadores por fila en `reverseTimers`, aviso con flechas parpadeantes en los últimos 1.5 s, inversión de `lane.dir`. Test: en jornada 3 la fila 4 invierte el sentido cada 8 s y las flechas aparecen 1.5 s antes; el erizo sobre un tronco de esa fila cambia de sentido con él.

5. **Garza:** crear `heron` cuando `config.heronSpeed > 0`, moverla y rebotar en los bordes, colisión AABB con causa `'picotazo'`. Test: en jornada 4 la garza patrulla la fila 7 a 50 px/s y tocarla resta una vida.

6. **Noche:** canvas offscreen reutilizado, recorte radial alrededor del erizo y conos de faros con `'lighter'`. Test: en jornada 5 solo se ve un radio de 150 px alrededor del erizo más los conos de faros; la baya sigue visible fuera del radio.

7. **Power-ups:** generación con `POWERUP_SPAWN_CHANCE` tras recoger baya o entregar, TTL de 12 s, recogida al aterrizar, efectos de escudo, reloj y seta, invulnerabilidad de 1000 ms tras absorber un golpe. Test: con `POWERUP_SPAWN_CHANCE` forzado a 1, aparece un power-up en la fila 7 tras recoger la baya; recoger el reloj suma 15 s; con escudo, tocar un coche no resta vida.

8. **HUD ampliado:** añadir JORNADA, multiplicador (`×1`, `×1.5`, `×2`, `×3`; con seta se muestra el producto, p.ej. `×4`), icono textual del escudo (`ESCUDO`) y `SETA 7s` con segundos restantes. Los setters se llaman solo cuando el valor cambia. Test: el HUD refleja la jornada y el multiplicador correctos tras cada entrega.

---

## Criterios de aceptación

- [ ] La partida empieza en la jornada 1 con velocidades base del spec 01 y 60 s por entrega.
- [ ] Tras 2 entregas se muestra "JORNADA 2" en el canvas durante 2000 ms y la partida continúa en la jornada 2.
- [ ] Durante la transición de jornada los vehículos y plataformas no se mueven y el temporizador no baja.
- [ ] En la jornada 2 la velocidad de cada carril es 1.15 veces la de la jornada 1.
- [ ] En la jornada 8 la velocidad de cada carril es 1.9 veces la base y los troncos/balsas miden el 75 % de su longitud base.
- [ ] En la jornada 12 la velocidad es 2.3 veces la base; en la jornada 13 y siguientes es 2.4 veces la base.
- [ ] El temporizador arranca en el `tripTime` de la tabla para cada jornada (60, 58, 55, 52, 50, 48, 45, 45).
- [ ] Completar la jornada N suma `500 × N × multiplicador` puntos.
- [ ] La primera entrega puntúa con ×1, la segunda consecutiva con ×1.5, la tercera y cuarta con ×2 y la quinta en adelante con ×3.
- [ ] Perder una vida devuelve el multiplicador a ×1.
- [ ] Al cruzar 5000, 10000, 15000… puntos se gana 1 vida, sin superar 5 vidas.
- [ ] Desde la jornada 3 la fila 4 del río invierte su sentido cada 8 s.
- [ ] 1.5 s antes de cada inversión se muestran flechas amarillas parpadeantes en ese carril.
- [ ] Desde la jornada 7 la fila 2 también invierte su sentido.
- [ ] Desde la jornada 4 una garza patrulla la fila 7 rebotando en los bordes del canvas.
- [ ] Tocar la garza sin escudo resta 1 vida.
- [ ] En las jornadas 5, 7 y 8+ la pantalla se oscurece salvo un radio de 150 px alrededor del erizo.
- [ ] De noche los vehículos muestran un cono de faros en su sentido de marcha.
- [ ] De noche la baya y los power-ups son visibles fuera del radio de visión.
- [ ] En la jornada 6 no hay oscuridad.
- [ ] Nunca hay más de 1 power-up en el tablero a la vez.
- [ ] Un power-up no recogido desaparece a los 12 s.
- [ ] Recoger cualquier power-up suma 25 puntos.
- [ ] Con escudo, el primer golpe de vehículo o garza no resta vida y el escudo desaparece.
- [ ] Tras absorber un golpe el erizo parpadea y es invulnerable durante 1000 ms.
- [ ] El escudo no protege de caer al agua, del arrastre fuera del canvas ni del fin del tiempo.
- [ ] Recoger el reloj de arena suma 15 s al temporizador.
- [ ] Con la seta dorada activa, los puntos obtenidos durante 10 s se duplican.
- [ ] El HUD muestra JORNADA, multiplicador, ESCUDO si está activo y los segundos restantes de la seta.
- [ ] Al perder la última vida en cualquier jornada se muestra el modal de game over del spec 01 con el score acumulado.
- [ ] "JUGAR DE NUEVO" reinicia en la jornada 1 con multiplicador ×1, 3 vidas y sin power-ups.
- [ ] No se ha modificado `lib/types.ts`, `app/page.tsx` ni la tabla `games`.
- [ ] `npm run build` termina sin errores de TypeScript.
- [ ] No hay errores de consola durante 3 jornadas completas.

---

## Decisiones

- **Jornadas de 2 entregas:** cada entrega es un viaje de ida y vuelta de unos 20–40 s; 2 entregas por jornada dan un cambio de ritmo cada 1–1,5 minutos, suficiente para notar la progresión sin alargar la partida.
- **Peligros temáticos en lugar de solo velocidad:** la corriente cambiante obliga a releer el río, la garza convierte la mediana segura en una zona de riesgo y la noche cambia la lectura de la carretera a los faros. Los tres refuerzan el tema de "cruzar sin acabar en papilla" con decisiones nuevas, no solo con números mayores.
- **Noche intermitente (5, 7, 8+):** alternar día y noche en las jornadas 5–7 da respiro tras la primera aparición; a partir de la 8 se fija para mantener la dificultad alta.
- **Plataformas más cortas y no más separadas:** reducir `length` manteniendo `spacing` endurece el río sin crear huecos imposibles; con `platformMul = 0.7` la balsa más corta mide 70 px (cabe con holgura un erizo de 26 px más la tolerancia).
- **Techo de velocidad ×2.4:** por encima, los vehículos de la fila 9 (336 px/s) cruzan una celda en ~120 ms, el mismo tiempo que un salto; más allá el juego deja de ser legible.
- **Multiplicador aplicado solo a entregas y bonus:** mantiene el score por avance predecible y premia la constancia, que es lo que distingue a un buen jugador en el leaderboard.
- **Escudo que no protege del agua:** el escudo es temático (el erizo se hace bola y aguanta un golpe), pero una bola de púas no flota; mantiene la tensión del río.
- **Power-ups en la mediana:** la mediana es el punto de paso obligado entre carretera y río en ambos sentidos; colocarlos ahí crea una decisión de riesgo (desviarse lateralmente) sin bloquear el camino.
- **Overlay de transición en canvas y no en React:** sigue el patrón del overlay de pausa de ArkanoidScreen y evita un tercer estado de UI en React.
- **Canvas offscreen para la noche:** recortar la oscuridad en un canvas aparte evita que `destination-out` borre el escenario del canvas principal.
- **Color y categoría sin cambios:** se mantienen `yellow` y `ESQUIVA` del spec 01; la fila de `games` no se modifica.

---

## Riesgos

| Riesgo                                                                      | Mitigación                                                                                                                     |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `setState` desde el game loop causa renders excesivos                       | Comparar antes de setear: jornada, multiplicador, escudo y segundos enteros de la seta solo se publican al cambiar             |
| La inversión de corriente deja entidades fuera del ciclo de wrap            | El wrap depende de `dir` en cada frame; tras invertir, la entidad que esté fuera vuelve al ciclo en el siguiente frame         |
| Huecos imposibles en el río con `platformMul` bajo                          | `spacing` no se escala; test manual en jornada 9 de que cada fila de río tiene al menos una plataforma visible en todo momento |
| La garza bloquea el único paso posible en la mediana                        | La garza mide 48 px de 800; el erizo puede esperar en la fila 8 o 6 y la garza rebota en los bordes                            |
| La oscuridad cuesta rendimiento si se recrea el canvas offscreen cada frame | Crear el canvas offscreen una sola vez en `useEffect`; cada frame solo `clearRect` + `fillRect` + gradiente                    |
| Power-up generado sobre la garza o fuera de alcance                         | Elegir columna 1–18 excluyendo las columnas que ocupa la garza en el momento de aparecer                                       |
| Vidas extra infinitas con farmeo de puntos                                  | El único farmeo posible (avance por fila) está limitado por `legBestRow`; además `MAX_LIVES = 5`                               |
