# Hallazgos de rendimiento — juegos de Arcade Vault

Documento vivo creado en SPEC 11 (`specs/11-frogger-performance.md`). Recoge las mediciones de FPS y los puntos calientes de cada juego, para los specs de rendimiento que vengan después.

## Cómo se mide

```bash
npm run build && npm run start     # medir siempre contra producción
npm run perf -- <slug>             # p. ej. npm run perf -- frogger
```

`scripts/perf/fps.mjs` usa Chromium headless de Playwright con estas condiciones:

- Viewport móvil de 390×844 (DPR 3, `isMobile`, `hasTouch`).
- CPU limitada 10× (`Emulation.setCPUThrottlingRate`).
- Medición de 10 s tras 1 s de calentamiento, sin tocar los controles (partida en curso desde el inicio).
- 3 pasadas por skin (`--runs=3`), cada una con partida nueva. Se informa la mediana de cada métrica, porque una sola pasada con CPU 10× varía ±7 FPS.

Métricas:

- `avgFps`: frames de `requestAnimationFrame` por segundo.
- `p95FrameMs`: percentil 95 de la duración de frame.
- `longFramesPct`: porcentaje de frames de más de 20 ms.
- `cpuMsPerFrame`: ms de main thread por frame (`TaskDuration` de CDP). Es la métrica estable para comparar pasos; no forma parte del umbral.

Umbral de SPEC 11: `avgFps ≥ 55` y `longFramesPct ≤ 5`.

> Con CPU 4× todos los juegos daban unos 60 FPS en el PC de desarrollo y la medición no detectaba los tirones vistos en móvil. Por eso SPEC 11 usa 10×. Los números son relativos a esa máquina: sirven para comparar antes y después y entre juegos, no como FPS reales de un teléfono concreto.

## Resumen de la medición de partida (2026-11-18, código anterior a SPEC 11)

Formato de cada celda: `avgFps` / `longFramesPct`.

| Juego     | Clásico       | Neón              | Retro         | ¿Cumple el umbral? |
| --------- | ------------- | ----------------- | ------------- | ------------------ |
| Frogger   | 45,0 / 33,6 % | **21,8 / 97,2 %** | 43,4 / 38,9 % | ❌ los tres skins  |
| Asteroids | 58,4 / 3,3 %  | 46,7 / 27,8 %     | 53,9 / 11,7 % | ❌ Neón y Retro    |
| Tetris    | 60,1 / 0 %    | 60,1 / 0 %        | 60,1 / 0 %    | ✅                 |
| Arkanoid  | 59,9 / 0,2 %  | **30,7 / 85,7 %** | 59,7 / 0,5 %  | ❌ Neón            |
| Snake     | 60,1 / 0 %    | 60,1 / 0 %        | 60,1 / 0 %    | ✅                 |

## Frogger

### Antes (código original)

```json
{"game":"frogger","skin":"classic","avgFps":45,"p95FrameMs":33.4,"longFramesPct":33.6,"durationS":10}
{"game":"frogger","skin":"neon","avgFps":21.8,"p95FrameMs":50.1,"longFramesPct":97.2,"durationS":10}
{"game":"frogger","skin":"retro","avgFps":43.4,"p95FrameMs":33.4,"longFramesPct":38.9,"durationS":10}
```

Las capturas de referencia están en `scripts/perf/out/frogger-<skin>-before.png`. Esa carpeta no se versiona; se regeneran con `npm run perf -- frogger --screenshots=before` sobre el código original.

Causas, ya detalladas en SPEC 11:

- Redibujado completo de cada frame.
- `shadowBlur` por entidad en Neón.
- 200 `fillRect` de scanlines en Retro.
- RAF activo en pausa.
- `mix-blend-mode` del CRT.
- `.av-bg` animado.

### Después (SPEC 11 completo)

`npm run perf -- frogger --screenshots=after`, mediana de 3 pasadas, termina con código 0:

```json
{"game":"frogger","skin":"classic","avgFps":60,"p95FrameMs":16.8,"longFramesPct":0.2,"cpuMsPerFrame":12,"durationS":10,"runs":3}
{"game":"frogger","skin":"neon","avgFps":59.9,"p95FrameMs":16.7,"longFramesPct":0.5,"cpuMsPerFrame":14.3,"durationS":10,"runs":3}
{"game":"frogger","skin":"retro","avgFps":59.8,"p95FrameMs":16.8,"longFramesPct":0.5,"cpuMsPerFrame":13.7,"durationS":10,"runs":3}
```

| Skin    | FPS antes → después | Frames lentos antes → después | CPU/frame antes → después  |
| ------- | ------------------- | ----------------------------- | -------------------------- |
| Clásico | 45,8 → **60,0**     | 31,4 % → **0,2 %**            | 21,6 → **12,0 ms** (−44 %) |
| Neón    | 22,0 → **59,9**     | 95,5 % → **0,5 %**            | 45,7 → **14,3 ms** (−69 %) |
| Retro   | 41,8 → **59,8**     | 43,3 % → **0,5 %**            | 23,8 → **13,7 ms** (−42 %) |

Los valores «antes» son los de la fila «Original» de la tabla de progreso (misma metodología de 3 pasadas).

Las capturas `scripts/perf/out/frogger-<skin>-after.png` se han comparado con las `-before`. No hay diferencias apreciables en colores, glow, scanlines, tortugas sumergidas, bocas ni HUD; solo cambia la posición de las entidades. Las capturas se hacen a los 2 s de partida, así que no incluyen ranas en las bocas.

Qué aportó cada cambio:

- **Sprites de entidades con glow horneado (paso 6):** casi toda la mejora, sobre todo en Neón, donde `shadowBlur` por entidad dominaba el frame.
- **Fondo y scanlines cacheados, rana y vidas en sprites (pasos 5 y 7):** mejoras pequeñas pero consistentes.
- **CSS acotado a Frogger (paso 3):** reduce el trabajo de composición fuera del canvas.
- **Pausa sin RAF (paso 4):** no aparece en la medición (se mide jugando), pero en pausa el canvas deja de redibujarse por completo (0 RAF en 5 s).
- **Sin asignaciones por frame (paso 8):** sin efecto medible en FPS; evita que el recolector de basura tenga que limpiar durante la partida.

Las técnicas reutilizables para los otros juegos son: sprites con el glow horneado, capas estáticas offscreen, detener el RAF en pausa y medir con `npm run perf -- <slug>`.

### Progreso por paso (mediana de 3 pasadas, `cpuMsPerFrame` en ms)

La fila «Original» se mide reconstruyendo temporalmente el `draw()` vectorial y el `data-game-route` vacío, porque el código original de Frogger no está en git.

| Estado                                    | Clásico (FPS / ms) | Neón (FPS / ms) | Retro (FPS / ms) |
| ----------------------------------------- | ------------------ | --------------- | ---------------- |
| Original                                  | 45,8 / 21,6        | 22,0 / 45,7     | 41,8 / 23,8      |
| Pasos 3–5 (CSS, pausa, fondo cacheado)    | 48,9 / 20,3        | 23,7 / 42,5     | 45,3 / 21,9      |
| Paso 6 (sprites de entidades)             | 60,0 / 12,6        | 59,2 / 15,8     | 59,6 / 15,0      |
| Paso 7 (sprites de rana y vidas)          | 60,1 / 11,9        | 59,8 / 14,5     | 59,2 / 14,4      |
| Paso 8 (sin asignaciones, contexto opaco) | 60,1 / 11,8        | 59,5 / 14,9     | 60,1 / 13,4      |

## Asteroids — `components/screens/AsteroidsScreen.tsx`

Optimizado el 2026-11-20 (agente `game-performance-booster`). Todo el cambio está en `AsteroidsScreen.tsx`; no se ha tocado CSS ni archivos compartidos.

### Antes (código original)

Hay dos mediciones del código original, porque la carga de la máquina cambió mucho durante la sesión (otras 3 mediciones de juegos en paralelo compartían CPU):

```json
// 10:51, máquina cargada (no comparable con el «después»)
{"game":"asteroids","skin":"classic","avgFps":59.8,"p95FrameMs":16.8,"longFramesPct":0.5,"cpuMsPerFrame":13.7,"durationS":10,"runs":3}
{"game":"asteroids","skin":"neon","avgFps":51.1,"p95FrameMs":33.4,"longFramesPct":17,"cpuMsPerFrame":19.3,"durationS":10,"runs":3}
{"game":"asteroids","skin":"retro","avgFps":59.7,"p95FrameMs":16.8,"longFramesPct":0.8,"cpuMsPerFrame":13.8,"durationS":10,"runs":3}
// 11:28, misma sesión de lock y mismas condiciones que el «después» (referencia de la comparación)
{"game":"asteroids","skin":"classic","avgFps":60.1,"p95FrameMs":16.8,"longFramesPct":0.2,"cpuMsPerFrame":11,"durationS":10,"runs":3}
{"game":"asteroids","skin":"neon","avgFps":59.4,"p95FrameMs":16.8,"longFramesPct":1.2,"cpuMsPerFrame":15.5,"durationS":10,"runs":3}
{"game":"asteroids","skin":"retro","avgFps":59.9,"p95FrameMs":16.8,"longFramesPct":0.2,"cpuMsPerFrame":12.9,"durationS":10,"runs":3}
```

Con la máquina tranquila el original ya cumple el umbral; con carga, Neón cae a 46–51 FPS (17–28 % de frames lentos, como en la medición de partida del 2026-11-18). El margen de Neón es el más ajustado: es el skin que más CPU por frame gasta.

`npm run perf -- asteroids --screenshots=…` **falla en Asteroids** (código 2): la captura busca `.crt-screen` y Asteroids no lo tiene. Las capturas se hicieron con un script aparte (canvas vía `toDataURL`, `Math.random` sembrado, pausa a los 0,5 s).

### Después

`npm run perf -- asteroids`, mediana de 3 pasadas, termina con código 0:

```json
{"game":"asteroids","skin":"classic","avgFps":59.9,"p95FrameMs":16.8,"longFramesPct":0.2,"cpuMsPerFrame":10.1,"durationS":10,"runs":3}
{"game":"asteroids","skin":"neon","avgFps":59.7,"p95FrameMs":16.7,"longFramesPct":0.8,"cpuMsPerFrame":13.4,"durationS":10,"runs":3}
{"game":"asteroids","skin":"retro","avgFps":59.8,"p95FrameMs":16.8,"longFramesPct":0.3,"cpuMsPerFrame":11.7,"durationS":10,"runs":3}
```

| Skin    | FPS antes → después | Frames lentos antes → después | CPU/frame antes → después  |
| ------- | ------------------- | ----------------------------- | -------------------------- |
| Clásico | 60,1 → **59,9**     | 0,2 % → **0,2 %**             | 11,0 → **10,1 ms** (−8 %)  |
| Neón    | 59,4 → **59,7**     | 1,2 % → **0,8 %**             | 15,5 → **13,4 ms** (−14 %) |
| Retro   | 59,9 → **59,8**     | 0,2 % → **0,3 %**             | 12,9 → **11,7 ms** (−9 %)  |

«Antes» es la medición de las 11:28 (mismas condiciones). Las capturas antes/después de los tres skins (misma semilla) difieren en menos del 0,5 % de los píxeles, solo por la posición de las entidades; fondo, colores, glow y scanlines son idénticos.

### Progreso (mediana de 3 pasadas, `cpuMsPerFrame` en ms)

| Estado                                                                   | Clásico (FPS / ms) | Neón (FPS / ms) | Retro (FPS / ms) | Carga |
| ------------------------------------------------------------------------ | ------------------ | --------------- | ---------------- | ----- |
| Original                                                                 | 59,8 / 13,7        | 51,1 / 19,3     | 59,7 / 13,8      | alta  |
| Todo + sprites rotados con glow horneado (asteroides y nave)             | 59,9 / 11,6        | 46,1 / 21,5     | 59,7 / 13,4      | alta  |
| Sin sprites rotados (asteroides y nave vuelven a `shadowBlur` vectorial) | 60,0 / 12,7        | 48,3 / 20,5     | 57,3 / 16,3      | alta  |
| Original                                                                 | 60,1 / 11,0        | 59,4 / 15,5     | 59,9 / 12,9      | baja  |
| **Final**                                                                | 59,9 / 10,1        | 59,7 / 13,4     | 59,8 / 11,7      | baja  |
| Final + CSS `.av-bg` pausado (inyectado solo en la medición)             | 60,1 / 7,3         | 59,9 / 12,1     | 60,1 / 9,8       | baja  |

Los pasos 1–3 y 7 de la checklist se aplicaron juntos por el lock de medición compartido; con la carga variable entre sesiones solo son comparables las filas de la misma carga.

### Hallazgos y qué se hizo

| #   | Hallazgo (línea original)                                                                                  | Impacto | Corregido | Ahora                                                                                                                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------------- | ------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `shadowBlur` en balas (l. 77)                                                                              | medio   | Sí        | Halo horneado por skin (`makeGlowSprite`, l. 64; `getSkinCache`, l. 99) y bala vectorial encima; `drawImage` en enteros (l. 173). Idéntico al píxel (delta máx. 0 en prueba aislada).          |
| 1   | `shadowBlur` en asteroides y nave (l. 137, 267)                                                            | alto    | No        | Siguen vectoriales con glow. Ver «No corregido».                                                                                                                                               |
| 2   | 200 `fillRect` de scanlines por frame en Retro (l. 559–562)                                                | medio   | Sí        | Capa 800×600 por skin, un `drawImage` al final de `draw()` (l. 610).                                                                                                                           |
| 5   | RAF activo en pausa y en game over (l. 550, 564)                                                           | medio   | Sí        | Se detiene tras un último `draw()` (l. 705); en game over, cuando acaba la explosión. `start()` (l. 714) fija `lastTime = performance.now()`; `redrawRef` (l. 722) repinta al cambiar de skin. |
| 6   | `setScore/setLives/setLevel/setTripleShot` cada frame (l. 489, 543–546)                                    | medio   | Sí        | `syncHud` (l. 576) solo llama a `setState` cuando cambia el valor; `tripleShot` cuando cambia el texto `toFixed(1)` (≈10 Hz en vez de 60 Hz durante el power-up).                              |
| 7   | `filter`/`concat`/`forEach` y `newAsteroids` por frame; template string `rgba(...)` por partícula (l. 320) | bajo    | Sí        | `compact()` in situ (l. 134), buffer de módulo `newAsteroidsBuf`, tabla de 101 colores por skin (l. 419), `PREVENT_KEYS` de módulo.                                                            |
| 8   | `getContext('2d')` con alpha                                                                               | bajo    | Sí        | `{ alpha: false }` (l. 556): el fondo opaco cubre todo el canvas.                                                                                                                              |
| 10  | `.av-bg::before` animado detrás del juego                                                                  | medio   | No        | Requiere `app/globals.css` (compartido). Ver propuesta.                                                                                                                                        |

### No corregido

- **Glow de asteroides y nave (`shadowBlur`).** Se probó a hornear el halo en un sprite por asteroide (solo el halo, con la forma vectorial encima) y dibujarlo rotado. En un microbenchmark con CPU 10× (4 asteroides de radio 50, glow 12), el `drawImage` **rotado** cuesta más que el `shadowBlur` del trazo: unos 8–11 ms/frame más, tanto con suavizado bilineal como con `imageSmoothingEnabled = false`, con `ImageBitmap` o con sprite a media resolución. En el `perf` real empeoró Neón de 19,3 a 21,5 ms. En Frogger los sprites funcionan porque no rotan. Sprites por ángulo discretizado no compensan: unos 5–20 MB por asteroide grande y un `shadowBlur` por ángulo nuevo. Se dejan vectoriales, como el original.
- **Power-up (`PowerUp.draw`, l. 284–290) y llama del propulsor (l. 381).** Siguen con `shadowBlur`: el power-up es una sola entidad, poco frecuente, que pulsa de tamaño; la llama es aleatoria en cada frame y solo aparece al acelerar.
- **`.crt-screen::after`** no aplica: Asteroids no usa `.crt-screen`.

### Propuesta pendiente (archivo compartido)

Añadir Asteroids a la regla acotada de `app/globals.css` (solo `.av-bg`, no tiene `.crt-screen`):

```css
body:has(#root[data-game-route='frogger']) .av-bg::before,
body:has(#root[data-game-route='asteroids']) .av-bg::before {
  animation-play-state: paused;
}
```

Medida inyectando la regla con Playwright (sin tocar el archivo): ahorra 1,3–2,8 ms/frame (Clásico 10,1 → 7,3; Neón 13,4 → 12,1; Retro 11,7 → 9,8). Es el margen que más falta le hace a Neón cuando la CPU va cargada.

`scripts/perf/fps.mjs`: la captura con `--screenshots` debería caer al `canvas` cuando no hay `.crt-screen`.

## Arkanoid — `components/screens/ArkanoidScreen.tsx`

Optimizado el 2026-11-20. **Cumple el umbral en los tres skins.** Resumen (`avgFps` / `longFramesPct`): Clásico 59,7 / 0,3 % · Neón 59,8 / 0,3 % · Retro 59,8 / 0,5 %.

### Antes (2026-11-20, código original)

`npm run perf -- arkanoid`, mediana de 3 pasadas, termina con código 1:

```json
{"game":"arkanoid","skin":"classic","avgFps":59.9,"p95FrameMs":16.7,"longFramesPct":0.2,"cpuMsPerFrame":9.1,"durationS":10,"runs":3}
{"game":"arkanoid","skin":"neon","avgFps":35.3,"p95FrameMs":33.4,"longFramesPct":67.8,"cpuMsPerFrame":28.2,"durationS":10,"runs":3}
{"game":"arkanoid","skin":"retro","avgFps":59.9,"p95FrameMs":16.8,"longFramesPct":0.3,"cpuMsPerFrame":10.2,"durationS":10,"runs":3}
```

### Después

`npm run perf -- arkanoid`, mediana de 3 pasadas, termina con código 0:

```json
{"game":"arkanoid","skin":"classic","avgFps":59.7,"p95FrameMs":16.7,"longFramesPct":0.3,"cpuMsPerFrame":10.4,"durationS":10,"runs":3}
{"game":"arkanoid","skin":"neon","avgFps":59.8,"p95FrameMs":16.8,"longFramesPct":0.3,"cpuMsPerFrame":10.3,"durationS":10,"runs":3}
{"game":"arkanoid","skin":"retro","avgFps":59.8,"p95FrameMs":16.8,"longFramesPct":0.5,"cpuMsPerFrame":11.5,"durationS":10,"runs":3}
```

| Skin    | FPS antes → después | Frames lentos antes → después | CPU/frame antes → después  |
| ------- | ------------------- | ----------------------------- | -------------------------- |
| Clásico | 59,9 → 59,7         | 0,2 % → 0,3 %                 | 9,1 → 10,4 ms              |
| Neón    | 35,3 → **59,8**     | 67,8 % → **0,3 %**            | 28,2 → **10,3 ms** (−63 %) |
| Retro   | 59,9 → 59,8         | 0,3 % → 0,5 %                 | 10,2 → 11,5 ms             |

En Clásico y Retro el código original ya cumplía; la ligera subida de `cpuMsPerFrame` (+1,3 ms) está dentro del ruido de la medición, tomada con otras 3 instancias del agente compilando y midiendo en la misma máquina.

Las capturas `--screenshots` del script no funcionan en Arkanoid: la screen no tiene `.crt-screen` (el script espera ese contenedor y falla con `TimeoutError`). Se compararon capturas del `<canvas>` hechas con un script temporal con el mismo flujo (partida en curso a 0,5 s y pausa a los 2 s, en los 3 skins): no hay diferencias apreciables en colores, glow de Neón (halo completo, sin recortes), brillo de los bloques, scanlines de Retro ni menú de pausa. La pala puede desplazarse hasta 0,5 px por el `Math.round`.

### Progreso

Los cambios se aplicaron de una vez (4 instancias del agente compartían build, servidor y CPU, con un lock), así que solo hay medición inicial y final.

| Estado                                              | Clásico (FPS / ms) | Neón (FPS / ms) | Retro (FPS / ms) |
| --------------------------------------------------- | ------------------ | --------------- | ---------------- |
| Original                                            | 59,9 / 9,1         | 35,3 / 28,2     | 59,9 / 10,2      |
| Pasos 2, 4, 5, 6 y 7 (pausa, capas, sprites, opaco) | 59,7 / 10,4        | 59,8 / 10,3     | 59,8 / 11,5      |

### Hallazgos (líneas del código original) y qué se hizo

| #   | Hallazgo                                                                                        | Impacto            | Corregido                                                                                                                                                                                                                                                                                     |
| --- | ----------------------------------------------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `shadowBlur` por bloque en Neón (l. 355–360), en la pala (l. 366–369) y en la bola (l. 375–378) | Alto (Neón)        | Sí. Sprites con el glow horneado (`pad = 2 × glow`) por familia de color, pala y bola (`buildRenderCache`, l. 107). Aporta casi toda la mejora de Neón.                                                                                                                                       |
| 3   | Fondo y hasta 60 bloques redibujados cada frame (l. 348–363)                                    | Alto               | Sí. Capa offscreen fondo + bloques vivos (`paintBlocksLayer`, l. 154), repintada desde los sprites solo al romper un bloque, cambiar de nivel, reiniciar o cambiar de skin (`layerDirtyRef`). Mantiene el orden de pintado: el halo de cada bloque se solapa con el anterior igual que antes. |
| 2   | Scanlines con 200 `fillRect` por frame en Retro (l. 384–387)                                    | Medio              | Sí. Capa 800×600 por skin, un único `drawImage`.                                                                                                                                                                                                                                              |
| 4   | `roundRect` (pala) y `arc` (bola) por frame (l. 370–381)                                        | Bajo (una entidad) | Sí, dentro de los sprites de pala y bola.                                                                                                                                                                                                                                                     |
| 5   | RAF activo en pausa y en game over (l. 420)                                                     | Medio              | Sí. El RAF se para tras el último `draw()` (l. 550). `wake()` (l. 456) lo relanza con `lastTimeRef = null` (primer `dt` = 0). `redrawRef` repinta al cambiar de skin; con el RAF parado, mover el ratón repinta la pala como antes.                                                           |
| 6   | `setState` en el loop                                                                           | —                  | No aplica: `setScore`/`setLevel`/`setLives`/`setOver` solo se llaman cuando cambia el valor.                                                                                                                                                                                                  |
| 7   | Asignaciones por frame (`for…of`, `blockColor`/`ex()` por bloque, `String(i + 1)`)              | Bajo               | Sí: bucle indexado en colisiones; colores resueltos en la caché; el menú de pausa (`drawPauseMenu`, l. 167) solo se pinta una vez al pausar. `gs.blocks.every(...)` queda, pero solo se ejecuta al romper un bloque.                                                                          |
| 8   | `getContext('2d')` con alpha (l. 215)                                                           | Bajo               | Sí. `{ alpha: false }` (l. 372): el fondo cubre todo el canvas.                                                                                                                                                                                                                               |
| 9   | Pala y bola en posiciones fraccionarias                                                         | Bajo               | Sí. `Math.round` en x/y al dibujar los sprites (l. 447–449).                                                                                                                                                                                                                                  |
| 10  | CSS: `.av-bg::before` animado (`gridscroll`)                                                    | Medio              | **No** (ver «Propuesta pendiente»). Arkanoid no usa `.crt-screen`, así que `mix-blend-mode` no le afecta.                                                                                                                                                                                     |

Verificación (Playwright, 390×844 móvil, Neón): 0 RAF en 5 s de pausa; al reanudar, frames de 17 ms y primer `dt` del juego = 0; cambiar el skin a Retro en pausa repinta el canvas sin reanudar; `.av-nav` y `.av-footer` siguen con `display: none`; sin errores en consola.

### No corregido

- **`.av-bg::before` animado durante la partida.** Requiere añadir `body:has(#root[data-game-route='arkanoid']) .av-bg::before` a la regla acotada de Frogger en `app/globals.css`, archivo compartido que no se tocó en esta ejecución. El umbral ya se cumple sin ello.

### Propuesta pendiente (archivos compartidos)

- `app/globals.css`: añadir `body:has(#root[data-game-route='arkanoid']) .av-bg::before` al selector existente con `animation-play-state: paused`. No hace falta tocar `.crt-screen::after`, porque Arkanoid no lo usa.
- `scripts/perf/fps.mjs`: `--screenshots` captura `.crt-screen`, que no existe en Arkanoid (ni en las screens sin CRT). Propuesta: capturar `.crt-screen` si existe y, si no, el `canvas` de `#root[data-game-route]`.

## Tetris — `components/screens/TetrisScreen.tsx`

Medición del 2026-11-20 (agente `game-performance-booster`). Cumple el umbral antes y después en los tres skins. Tetris no tiene skin propio en `lib/skins/`: el canvas se ve igual en Clásico, Neón y Retro (el skin solo cambia el gamepad táctil), y no usa `.crt-screen`.

### Antes (código original)

```json
{"game":"tetris","skin":"classic","avgFps":60.1,"p95FrameMs":16.7,"longFramesPct":0,"cpuMsPerFrame":8,"durationS":10,"runs":3}
{"game":"tetris","skin":"neon","avgFps":60.1,"p95FrameMs":16.8,"longFramesPct":0,"cpuMsPerFrame":8.1,"durationS":10,"runs":3}
{"game":"tetris","skin":"retro","avgFps":60,"p95FrameMs":16.7,"longFramesPct":0.2,"cpuMsPerFrame":7.9,"durationS":10,"runs":3}
```

### Después

`npm run perf -- tetris` (sin `--screenshots`, ver abajo), mediana de 3 pasadas, código de salida 0:

```json
{"game":"tetris","skin":"classic","avgFps":60,"p95FrameMs":16.7,"longFramesPct":0.2,"cpuMsPerFrame":8.7,"durationS":10,"runs":3}
{"game":"tetris","skin":"neon","avgFps":60,"p95FrameMs":16.7,"longFramesPct":0.2,"cpuMsPerFrame":8.8,"durationS":10,"runs":3}
{"game":"tetris","skin":"retro","avgFps":60.1,"p95FrameMs":16.8,"longFramesPct":0,"cpuMsPerFrame":8.1,"durationS":10,"runs":3}
```

| Skin    | FPS antes → después | Frames lentos antes → después | CPU/frame antes → después |
| ------- | ------------------- | ----------------------------- | ------------------------- |
| Clásico | 60,1 → 60,0         | 0 % → 0,2 %                   | 8,0 → 8,7 ms              |
| Neón    | 60,1 → 60,0         | 0 % → 0,2 %                   | 8,1 → 8,8 ms              |
| Retro   | 60,0 → 60,1         | 0,2 % → 0 %                   | 7,9 → 8,1 ms              |

Las diferencias están dentro del ruido: la medición se hizo con otras 3 instancias del agente trabajando en paralelo en la misma máquina (otra pasada inmediatamente anterior dio 10,6 / 10,0 / 9,9 ms con el mismo código). El render del tablero de Tetris es barato (≈ 200 `fillRect` sin glow), así que el coste por frame lo domina el resto de la página. La mejora real está en la pausa y el game over, que la medición estándar no recoge.

### Progreso por paso

Por ser un juego que ya cumplía, los cambios se aplicaron juntos y se midieron una vez.

| Estado                                                       | Clásico (FPS / ms) | Neón (FPS / ms) | Retro (FPS / ms) |
| ------------------------------------------------------------ | ------------------ | --------------- | ---------------- |
| Original                                                     | 60,1 / 8,0         | 60,1 / 8,1      | 60,0 / 7,9       |
| Pausa sin RAF + rejilla cacheada + preview a demanda + opaco | 60,0 / 8,7         | 60,0 / 8,8      | 60,1 / 8,1       |

### Hallazgos (checklist SPEC 11) y qué se hizo

- **#5 RAF activo en pausa y game over** (antes l. 315–354: el loop redibujaba siempre). **Corregido:** el loop hace un último `drawScene` y deja de pedir frames en pausa/game over (l. 335). `startLoop` (l. 381) lo rearranca al reanudar (`KeyP`, `togglePause`) y al reiniciar (`restartGame`, l. 462), con `lastTime = performance.now()` para que el primer `dt` no acumule la pausa (además `dt` se acota a [0, 50] ms). Verificado: 0 RAF en 5 s de pausa, 60 RAF/s jugando.
- **#3 Rejilla redibujada cada frame** (antes l. 237–250: 29 `stroke()`). **Corregido:** capa `buildBackground()` (l. 237) offscreen 300×600 con el color de fondo y la rejilla; `drawScene` empieza con un único `drawImage` (l. 262).
- **#3/#7 Vista previa redibujada cada frame** (antes l. 347: `drawPreview` a 60 Hz sobre un segundo canvas, que además obligaba a recomponerlo). **Corregido:** solo se repinta cuando cambia `g.next` (l. 371).
- **#8 Contexto con alpha** (antes l. 308). **Corregido:** `getContext('2d', { alpha: false })` (l. 323); la capa de fondo cubre todo el tablero, con el mismo `#050510`.
- **#6 `setState`:** ya correcto (solo al cambiar el valor).
- **#1, #2, #4, #9:** no aplican (sin `shadowBlur`, sin scanlines, sin `arc`/`ellipse`, sin `drawImage` fraccionario; los bloques son `fillRect` en coordenadas enteras).

Capturas antes/después (390×844, skin Neón y los otros dos) comparadas: rejilla, fondo, bloques, pieza fantasma y HUD idénticos; solo cambia la pieza aleatoria.

### No corregido

- **#10 CSS (`.av-bg::before` animado):** en la ruta de Tetris sigue `animationPlayState: running`. Requiere añadir `body:has(#root[data-game-route='tetris']) .av-bg::before` a la regla acotada de `app/globals.css` (archivo compartido; pendiente de aprobación). `.crt-screen::after` no aplica: Tetris no usa `.crt-screen`.
- **`npm run perf -- tetris --screenshots=…` falla** (código 2) porque `scripts/perf/fps.mjs` captura `.crt-screen`, que Tetris no tiene. Las capturas se hicieron con un script aparte. Propuesta: que el script use `.crt-screen` si existe y si no `#root[data-game-route] canvas` o la página completa (infraestructura compartida; pendiente de aprobación).
- Asignaciones fuera del bucle de frame (`mkPiece`, `rotateCW`, `sweepLines`, array de kicks en `tryRotate`) solo ocurren por evento (pieza nueva, rotación), no por frame; se dejan.

## Snake — `components/screens/SnakeScreen.tsx`

Optimizado el 2026-11-20 siguiendo SPEC 11. Cumplía el umbral antes y lo sigue cumpliendo: Snake solo dibuja en cada tick de `setInterval` (150 → 60 ms), no a 60 Hz. Por eso el coste del canvas casi no aparece en la medición estándar.

Resumen (`avgFps` / `longFramesPct`, mediana de 3 pasadas, CPU 10×), 2026-11-20: Clásico 60,1 / 0 % · Neón 60,1 / 0 % · Retro 60,1 / 0 % → ✅ en los tres skins.

### Antes (2026-11-20, código de `main`)

```json
{"game":"snake","skin":"classic","avgFps":60.1,"p95FrameMs":16.7,"longFramesPct":0,"cpuMsPerFrame":6.1,"durationS":10,"runs":3}
{"game":"snake","skin":"neon","avgFps":60,"p95FrameMs":16.8,"longFramesPct":0.2,"cpuMsPerFrame":6.4,"durationS":10,"runs":3}
{"game":"snake","skin":"retro","avgFps":60.1,"p95FrameMs":16.7,"longFramesPct":0,"cpuMsPerFrame":6.4,"durationS":10,"runs":3}
```

### Después

`npm run perf -- snake` termina con código 0:

```json
{"game":"snake","skin":"classic","avgFps":60.1,"p95FrameMs":16.7,"longFramesPct":0,"cpuMsPerFrame":6.3,"durationS":10,"runs":3}
{"game":"snake","skin":"neon","avgFps":60.1,"p95FrameMs":16.7,"longFramesPct":0,"cpuMsPerFrame":6.3,"durationS":10,"runs":3}
{"game":"snake","skin":"retro","avgFps":60.1,"p95FrameMs":16.7,"longFramesPct":0,"cpuMsPerFrame":6.5,"durationS":10,"runs":3}
```

| Skin    | FPS antes → después | Frames lentos antes → después | CPU/frame antes → después |
| ------- | ------------------- | ----------------------------- | ------------------------- |
| Clásico | 60,1 → 60,1         | 0 % → 0 %                     | 6,1 → 6,3 ms              |
| Neón    | 60,0 → 60,1         | 0,2 % → 0 %                   | 6,4 → 6,3 ms              |
| Retro   | 60,1 → 60,1         | 0 % → 0 %                     | 6,4 → 6,5 ms              |

Las diferencias de `cpuMsPerFrame` (±0,2 ms) son ruido. Todos los cambios se aplicaron en un solo paso, así que no hay tabla de progreso por paso. Esto se debe a que el juego ya cumplía el umbral y la medición estándar no puede separar los pasos.

**Prueba de estrés con una serpiente de 150 segmentos.** Se hizo con un script de scratch, no versionado: se sustituye `snakeRef` a través de la fibra de React, con CPU 10×, durante 10 s y 3 pasadas. Resultado en ms de main thread por segundo: Clásico 390 → 398, Neón 332 → 397, Retro 401 → 381. La diferencia queda dentro del ruido entre pasadas (±40 ms/s). En Chromium headless el raster del canvas (`shadowBlur` incluido) no pesa en el main thread con 7 ticks/s. La mejora del canvas es real, pero no se ve en esta métrica.

**Dónde se va realmente el main thread: la rejilla animada `.av-bg::before`.** Se hizo un experimento inyectando CSS solo en el navegador de prueba, en Neón y con 2 pasadas. Con `animation-play-state: paused` en `.av-bg::before`, `cpuMsPerFrame` pasa de 9,2 / 8,8 a 5,6 / 5,4 ms (**−40 %**). Es el coste dominante de Snake. Para corregirlo hay que añadir `body:has(#root[data-game-route='snake']) .av-bg::before` a la regla acotada de `app/globals.css`, que es un archivo compartido y queda pendiente. Snake no usa `.crt-screen`, así que la regla de `mix-blend-mode` no le aplica.

Capturas: `scripts/perf/fps.mjs --screenshots` no sirve para Snake porque espera a `.crt-screen`, que esta pantalla no tiene (timeout). Por eso las capturas antes y después del canvas se hicieron con un script de scratch, con el mismo procedimiento (pausa al segundo 2). Al compararlas, el fondo, la rejilla y las scanlines son idénticos (diferencia ≤ 2/255). En la serpiente solo hay diferencias de antialiasing en los bordes redondeados (≤ 13/255), que no se aprecian. El halo de Neón no se recorta (`pad = 2 × glow + 2 = 26 px`).

### Hallazgos (líneas del código original) y correcciones

| #   | Hallazgo                                                                                                             | Impacto                             | Corrección                                                                                                                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1/4 | `shadowBlur` + `fillRoundRect` (4 `arcTo`) por segmento (l. 184–191) y `shadowBlur` + `arc` en la fruta (l. 169–180) | Alto en Neón con serpiente larga    | ✅ Sprites `head`/`body`/`fruit` por skin con el glow horneado (`buildSnakeCache`, `segmentSprite`, `fruitSprite`). `draw()` hace un `drawImage` por segmento                                          |
| 3   | Fondo y rejilla de 72 `stroke()` redibujados en cada tick (l. 144–160)                                               | Medio                               | ✅ Capa `background` 800×600 por skin                                                                                                                                                                  |
| 2   | Scanlines con 200 `fillRect` por tick en Retro (l. 193–196)                                                          | Medio                               | ✅ Capa `scanlines` 800×600, un `drawImage` al final                                                                                                                                                   |
| 5   | En pausa, el `setInterval` seguía disparando y `tick()` salía al principio (l. 205, 289–296, 322–327)                | Bajo (no hay RAF ni redibujado)     | ✅ `setPausedState()` limpia el intervalo al pausar y lo reprograma con la velocidad actual al reanudar. Medido: 0 callbacks en 5 s de pausa; al reanudar, 8 ticks en 1,2 s (ritmo normal, sin saltos) |
| 6   | `setScore`/`setSnakeLen` solo al comer                                                                               | —                                   | No aplica (ya era correcto)                                                                                                                                                                            |
| 7   | Por tick: `snake.slice(0, -1).some(...)` (l. 224) y `[{…}, ...snake]` (l. 233) copiaban la serpiente entera          | Bajo                                | ✅ Bucle sin copia y `unshift`/`pop` sobre el mismo array                                                                                                                                              |
| 8   | `getContext('2d')` con alpha (l. 139); el fondo cubre todo el canvas                                                 | Bajo                                | ✅ `getContext('2d', { alpha: false })`                                                                                                                                                                |
| 9   | `drawImage` en posiciones fraccionarias                                                                              | —                                   | No aplica: todas las posiciones son enteras (celda × 20 + 1 − pad)                                                                                                                                     |
| 10  | `.av-bg::before` animado (`gridscroll`) detrás del juego                                                             | **Alto en la medición** (−40 % CPU) | ❌ Pendiente: requiere tocar `app/globals.css` (compartido)                                                                                                                                            |

No corregido también: la fruta del skin Clásico se sigue dibujando desde el atlas `/snake-fruits.png` con escalado (un único `drawImage` por tick, barato). Con la caché del skin activo, `draw()` ya no contiene `shadowBlur`, `arc` ni bucles. El único `arc` que queda está en `fruitSprite()` y se ejecuta una vez por skin.

Verificación (Playwright, 390×844 móvil, `npm run start`): `data-game-route='snake'`; `.av-nav` y `.av-footer` con `display: none`; el canvas no cambia en 5 s de pausa; cambiar a Retro en pausa repinta el canvas (píxel de fondo `#081208`) sin reanudar la partida (0 ticks, el botón sigue en REANUDAR); consola sin errores ni warnings de la app. `.av-bg::before` sigue `running` (ver hallazgo 10).
