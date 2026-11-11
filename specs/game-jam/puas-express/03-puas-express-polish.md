# SPEC GJ-puas-express-03 — PÚAS EXPRESS: pulido y game feel

> **Status:** Borrador
> **Depends on:** `specs/game-jam/puas-express/02-puas-express-levels.md`
> **Date:** 2026-11-11
> **Tema game jam:** Cruza la carretera y el río sin convertirte en papilla
> **Objetivo:** Dar a PÚAS EXPRESS feedback visual (papilla, salpicaduras, shake, flashes, squash & stretch), pantalla de inicio in-canvas, controles WASD, récord de la sesión en el HUD y una cover animada, sin cambiar las reglas de puntuación.

---

## Scope

**In:**

- `components/screens/PuasExpressScreen.tsx`:
  - Sistema de partículas con pool preasignado de 220 partículas.
  - Efectos por evento: papilla (atropello), salpicadura (agua), polvo de salto, destellos de baya, confeti de entrega, plumas de garza.
  - Manchas persistentes de papilla en el asfalto (decals).
  - Screen shake, flashes de pantalla y textos flotantes de puntos.
  - Squash & stretch del erizo al saltar y al aterrizar.
  - Estelas de agua detrás de troncos y balsas.
  - Aviso de tiempo bajo (últimos 10 s).
  - Pantalla de inicio in-canvas con instrucciones y "PULSA ESPACIO PARA EMPEZAR".
  - Overlay de pausa mejorado con recordatorio de controles.
  - Controles WASD además de flechas; `Space`/`Enter` para empezar.
  - Récord personal de la sesión en el HUD y aviso "¡NUEVO RÉCORD!" en el modal.
  - Respeto de `prefers-reduced-motion` (sin shake ni flashes).
- `app/globals.css`: `.cover-puas-express` refinada y animada con `@keyframes`, desactivada con `prefers-reduced-motion`.

**Fuera de scope (para specs posteriores):**

- Controles táctiles / mobile.
- Sonido y efectos de audio.
- Multijugador.
- Sprites o assets de imagen externos (todo sigue dibujado con primitivas).
- Cambios en reglas de puntuación, jornadas o power-ups del spec 02.
- Persistencia del récord entre sesiones del navegador (el leaderboard de Supabase cubre ese caso).
- Migraciones, columnas nuevas en `games` y cambios en `RouteName`.

---

## Data model

Este spec no toca Supabase ni `lib/types.ts`.

### Partículas

```ts
type ParticleKind = 'papilla' | 'pua' | 'gota' | 'polvo' | 'chispa' | 'confeti' | 'pluma'
type Particle = {
  active: boolean
  kind: ParticleKind
  x: number
  y: number
  vx: number // px/s
  vy: number // px/s
  life: number // ms restantes
  maxLife: number // ms
  size: number // px
  color: string
  rot: number // rad (solo 'pua' y 'confeti')
}

const MAX_PARTICLES = 220 // pool preasignado; nunca se hace `new` en el loop
const GRAVITY = 600 // px/s² para papilla, gota y confeti
```

| Evento                  | Partículas | Kind(s)           | Colores                                    | Vida (ms) | Velocidad inicial                         |
| ----------------------- | ---------- | ----------------- | ------------------------------------------ | --------- | ----------------------------------------- |
| Atropello (papilla)     | 28 + 10    | `papilla` + `pua` | `#c9a27e`, `#a0785a` / `#4e342e`           | 500–900   | 120–320 px/s radial                       |
| Agua (ahogado/arrastre) | 20         | `gota`            | `#9fd8ff`, `#ffffff`                       | 400–700   | 80–220 px/s hacia arriba                  |
| Salto                   | 4          | `polvo`           | `#8a8fb5`                                  | 250       | 30–60 px/s opuesto al salto               |
| Recoger baya            | 12         | `chispa`          | `#e0245e`, `#ff8fb1`                       | 450       | 60–160 px/s radial                        |
| Entrega                 | 30         | `confeti`         | `#f5ff00`, `#00f5ff`, `#ff006e`, `#00ff88` | 900       | 150–350 px/s hacia arriba                 |
| Picotazo de garza       | 8          | `pluma`           | `#eceff1`                                  | 900       | 40–100 px/s, caída lenta (gravedad ×0.15) |
| Power-up recogido       | 10         | `chispa`          | color del power-up                         | 400       | 60–140 px/s radial                        |

- Si el pool está lleno, el evento reutiliza las partículas con menor `life` restante.
- Con el atropello también se crea un decal.

### Decals, shake, flashes y textos

```ts
type Decal = { x: number; y: number; life: number } // mancha de papilla en el asfalto
const MAX_DECALS = 5
const DECAL_MS = 4000 // fade lineal en el último 1000 ms

type Shake = { time: number; duration: number; amplitude: number }
const SHAKE_PAPILLA = { duration: 300, amplitude: 8 } // ms, px
const SHAKE_AGUA = { duration: 150, amplitude: 4 }
const SHAKE_PICOTAZO = { duration: 200, amplitude: 5 }

type Flash = { color: string; alpha: number; duration: number; time: number }
const FLASH_DEATH = { color: '#ffffff', alpha: 0.35, duration: 120 }
const FLASH_DELIVERY = { color: '#f5ff00', alpha: 0.25, duration: 160 }
const FLASH_LEVELUP = { color: '#f5ff00', alpha: 0.3, duration: 250 }

type FloatingText = { text: string; x: number; y: number; life: number; color: string }
const MAX_FLOATING_TEXTS = 12
const FLOATING_TEXT_MS = 700 // sube 40 px y se desvanece
```

### Squash & stretch y estelas

```ts
const HOP_STRETCH = 1.15 // escala en el eje del salto a mitad del hop
const LAND_SQUASH = 0.85 // escala en el eje del salto al aterrizar
const LAND_SQUASH_MS = 80
const WAKE_SPACING = 24 // px entre líneas de estela
const WAKE_COLOR = 'rgba(255, 255, 255, 0.35)'
```

### Inicio, controles y récord de sesión

```ts
type GameStatus = 'title' | 'playing' | 'dying' | 'levelup' | 'gameover'

const KEYMAP: Record<string, Dir> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
}
const START_KEYS = ['Space', 'Enter']
const LOW_TIME_THRESHOLD = 10 // s

const SESSION_BEST_KEY = 'puas-express:session-best' // sessionStorage, número entero
```

---

## Plan de implementación

1. **Pool de partículas:** preasignar `MAX_PARTICLES` objetos `Particle` en un `useRef` al montar. `spawnBurst(kind, x, y, count, opts)` activa partículas libres (o las de menor `life`). `updateParticles(dt)` integra posición, aplica `GRAVITY` según `kind` y desactiva al llegar `life <= 0`. `drawParticles(ctx)` dibuja círculos (`papilla`, `gota`, `polvo`, `chispa`), trazos de 6 px rotados (`pua`), rectángulos 4×8 rotados (`confeti`) y elipses (`pluma`), con `globalAlpha = life / maxLife`. Test: atropellar al erizo muestra la explosión de papilla y púas; el contador de partículas activas nunca supera 220.

2. **Efectos por evento y decals:** conectar `spawnBurst` a atropello, ahogado/arrastre, salto, recoger baya, entrega, picotazo y power-up según la tabla del Data model. El atropello crea un `Decal` (máx. 5, el más antiguo se elimina) dibujado bajo los vehículos como elipse `#a0785a` de 30×18 px con 6 púas `#4e342e`. Test: tras un atropello la mancha permanece 4 s en el asfalto y se desvanece en el último segundo.

3. **Screen shake y flashes:** `ctx.save(); ctx.translate(dx, dy)` con `dx, dy = (Math.random() * 2 - 1) * amplitude * (1 - time / duration)` antes de dibujar el mundo; el HUD React no se mueve. Flash como `fillRect` a pantalla completa con alpha decreciente. Si `window.matchMedia('(prefers-reduced-motion: reduce)').matches`, shake y flashes no se aplican. Test: un atropello sacude el canvas 300 ms; con reduced-motion activado en el sistema no hay sacudida ni flash.

4. **Textos flotantes:** al sumar puntos de entrega, bonus de jornada y power-up, crear un `FloatingText` (`+460`, `×2`, `+15 s`) en la posición del erizo, máximo 12 activos. Los 10 puntos por fila no generan texto para evitar ruido. Test: una entrega muestra un texto "+N" que sube y desaparece en 700 ms.

5. **Squash & stretch y estelas:** durante el hop, escala en el eje del salto `1 + (HOP_STRETCH - 1) * sin(π · t / HOP_MS)` y la inversa en el eje perpendicular; al aterrizar, `LAND_SQUASH` durante 80 ms. Estelas: líneas horizontales cortas `WAKE_COLOR` cada `WAKE_SPACING` px detrás de cada plataforma según su `dir`. Test: el erizo se estira visiblemente en el salto y se achata al aterrizar; las plataformas dejan estela en el lado contrario a su movimiento.

6. **Aviso de tiempo bajo:** con `timeLeft <= LOW_TIME_THRESHOLD`, el valor TIEMPO del HUD pasa a `var(--magenta)` y parpadea a 2 Hz, y el canvas dibuja un borde interior de 4 px `#ff006e` con alpha oscilando entre 0.2 y 0.6. Test: a los 10 s restantes el HUD y el borde cambian; al entregar vuelven a la normalidad.

7. **Pantalla de inicio y pausa:** nuevo estado `'title'` al montar. Los carriles se animan de fondo con la configuración de la jornada 1; encima, overlay `rgba(10,10,15,0.7)` con "PÚAS EXPRESS" (56 px, `#f5ff00`), un erizo dibujado a 3× escala, tres líneas de instrucciones ("FLECHAS O WASD: SALTAR", "RECOGE LA BAYA Y VUELVE A LA MADRIGUERA", "P / ESC: PAUSA") y "PULSA ESPACIO PARA EMPEZAR" parpadeando a 1.5 Hz. `Space` o `Enter` pasan a `'playing'`. El temporizador no corre en `'title'`. "JUGAR DE NUEVO" reinicia directamente en `'playing'`. El overlay de pausa añade debajo de "PAUSA" las mismas líneas de controles. Test: al entrar en la ruta se ve la pantalla de inicio; `Space` empieza; `JUGAR DE NUEVO` no vuelve a mostrarla.

8. **Controles WASD:** sustituir el mapeo de flechas por `KEYMAP` usando `e.code` (independiente del layout de teclado). `preventDefault` en todas las teclas del mapa y en `Space`. Test: `W/A/S/D` saltan igual que las flechas; `Space` no hace scroll.

9. **Récord de la sesión:** `sessionBest` inicializado desde `sessionStorage.getItem(SESSION_BEST_KEY)` (envuelto en `try/catch`, fallback `0`). Al entrar en `'gameover'`, si `score > sessionBest`, actualizar estado y `sessionStorage`, y mostrar "¡NUEVO RÉCORD!" en `var(--yellow)` en el modal. El HUD muestra "RÉCORD SESIÓN" con el mayor entre `sessionBest` y el score actual. Test: tras una partida de 1200 pts el HUD muestra 1200 como récord en la siguiente; recargar la pestaña lo conserva; cerrar la pestaña lo borra.

10. **Cover animada en `app/globals.css`:** refinar `.cover-puas-express`: `::before` con carriles de asfalto y río cuyo `background-position` se anima con `@keyframes puas-traffic` (3 s, lineal, infinito) para que las líneas discontinuas y dos bloques de vehículo se desplacen en sentidos opuestos; `::after` con el erizo (clip-path dentado `#4e342e` + cuerpo `#c9a27e` + baya `#e0245e` en el lomo) animado con `@keyframes puas-hop` (1.2 s, `ease-in-out`, `translateY(0 → -8px → 0)` y `scale(1, 1) → (0.95, 1.08) → (1.05, 0.92)`). `@media (prefers-reduced-motion: reduce) { .cover-puas-express::before, .cover-puas-express::after { animation: none; } }`. Test: la card en la Library muestra el tráfico desplazándose y el erizo saltando; con reduced-motion la cover queda estática.

---

## Criterios de aceptación

- [ ] Al entrar en la ruta `'puas-express'` se muestra la pantalla de inicio con el título, instrucciones y "PULSA ESPACIO PARA EMPEZAR".
- [ ] En la pantalla de inicio el temporizador no baja y el erizo no puede morir.
- [ ] `Space` o `Enter` en la pantalla de inicio empiezan la partida.
- [ ] "JUGAR DE NUEVO" empieza la partida sin volver a la pantalla de inicio.
- [ ] `W`, `A`, `S`, `D` producen el mismo salto que `ArrowUp`, `ArrowLeft`, `ArrowDown`, `ArrowRight`.
- [ ] `Space` y las teclas de movimiento no hacen scroll de la página.
- [ ] Un atropello genera la explosión de papilla con púas y deja una mancha en el asfalto durante 4 s.
- [ ] Nunca hay más de 5 manchas de papilla a la vez.
- [ ] Caer al agua o ser arrastrado genera una salpicadura de gotas.
- [ ] Cada salto genera polvo en el punto de despegue.
- [ ] Recoger la baya genera destellos rosas; entregarla genera confeti y un flash amarillo.
- [ ] El picotazo de la garza genera plumas que caen lentamente.
- [ ] El número de partículas activas nunca supera 220.
- [ ] Un atropello sacude el canvas durante 300 ms; caer al agua lo sacude durante 150 ms.
- [ ] El HUD React no se mueve durante el screen shake.
- [ ] Con `prefers-reduced-motion: reduce` no hay screen shake ni flashes y la cover no se anima.
- [ ] Entregar, completar jornada y recoger power-up muestran un texto flotante con los puntos o el efecto.
- [ ] Nunca hay más de 12 textos flotantes a la vez.
- [ ] El erizo se estira durante el salto y se achata 80 ms al aterrizar.
- [ ] Troncos y balsas muestran estela en el lado opuesto a su sentido de marcha.
- [ ] Con 10 s o menos, el TIEMPO del HUD se vuelve magenta y parpadea, y el canvas muestra un borde magenta pulsante.
- [ ] El overlay de pausa muestra "PAUSA" y la lista de controles.
- [ ] El HUD muestra "RÉCORD SESIÓN" con el mayor score de la sesión de la pestaña.
- [ ] Superar el récord de sesión muestra "¡NUEVO RÉCORD!" en el modal de game over.
- [ ] El récord de sesión se conserva al recargar la pestaña y no existe en una pestaña nueva.
- [ ] La card de la Library muestra la cover animada con tráfico desplazándose y el erizo saltando.
- [ ] La puntuación de un mismo recorrido es idéntica a la del spec 02 (el pulido no altera el score).
- [ ] Al salir de la pantalla no quedan RAF ni listeners activos.
- [ ] No se ha modificado `lib/types.ts`, `app/page.tsx` ni la tabla `games`.
- [ ] `npm run build` termina sin errores de TypeScript.
- [ ] No hay errores de consola durante una partida completa con todos los efectos.

---

## Decisiones

- **La papilla como firma visual:** el tema dice "sin convertirte en papilla"; el atropello se convierte en el efecto más elaborado (papilla + púas volando + mancha persistente) en tono cartoon, sin gore: colores tostados del propio erizo, nunca rojo sangre.
- **Pool de partículas preasignado:** evita crear objetos en cada frame y la presión del recolector de basura; 220 cubre el peor caso realista (atropello 38 + confeti 30 + polvo continuo + plumas) con margen.
- **Decals limitados a 5 y 4 s:** dan memoria del peligro en el carril sin ensuciar la lectura del tráfico.
- **Shake mediante `ctx.translate` y no CSS:** solo se mueve el mundo del canvas; el HUD React permanece legible y no se fuerzan reflows.
- **`prefers-reduced-motion`:** el juego tiene sacudidas y flashes frecuentes; respetar la preferencia del sistema es barato y evita molestias.
- **Pantalla de inicio en canvas y no en React:** mantiene un solo sistema de overlays (pausa, transición de jornada e inicio) en el canvas, coherente con el spec 02 y ArkanoidScreen.
- **`e.code` para WASD:** funciona igual en teclados QWERTY, AZERTY y españoles para la posición física; los textos de ayuda indican WASD por ser la convención más conocida.
- **Récord de sesión en `sessionStorage`:** "sesión" se interpreta como la pestaña del navegador; sobrevive a una recarga accidental pero no compite con el leaderboard de Supabase. No se usa `localStorage['av_scores']`, deprecado desde SPEC 06.
- **Sin texto flotante para +10 por fila:** saldría en cada salto y taparía al erizo.
- **Sin cambios de puntuación en el pulido:** el near-miss u otros bonus alterarían el balance del leaderboard ya definido en el spec 02; el game feel se limita a lo visual.
- **Cover animada solo con `background-position` y `transform`:** propiedades que el navegador anima sin reflow; la Library puede mostrar varias covers a la vez.

---

## Riesgos

| Riesgo                                                                 | Mitigación                                                                                                                                              |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setState` desde el game loop causa renders excesivos                  | Comparar antes de setear: partículas, shake, flashes y textos viven en refs; solo el récord y el aviso de tiempo bajo pasan por React y solo al cambiar |
| Caída de FPS por exceso de partículas                                  | Pool fijo de 220 y reutilización de las de menor vida; sin `shadowBlur` en partículas                                                                   |
| `shadowBlur` o gradientes por entidad ralentizan la noche + partículas | Prohibido `shadowBlur` en el loop; los halos de baya y power-up se dibujan como círculos con alpha                                                      |
| Asignaciones en el loop (arrays/objetos nuevos por frame)              | Partículas, decals y textos en arrays de capacidad fija; se marcan inactivos en vez de usar `filter`                                                    |
| El shake desplaza el canvas y deja bordes sin pintar                   | Pintar el fondo con `fillRect(-10, -10, 820, 620)` antes de aplicar el `translate`                                                                      |
| `sessionStorage` no disponible (modo privado o bloqueado)              | Acceso en `try/catch`; fallback a estado en memoria con valor inicial `0`                                                                               |
| Animación de la cover consume CPU con muchas cards visibles            | Solo `transform` y `background-position`; desactivada con `prefers-reduced-motion`                                                                      |
| `Space` en la pantalla de inicio activa un botón con foco del HUD      | `preventDefault` en `Space` y `blur()` del elemento activo al empezar la partida                                                                        |
