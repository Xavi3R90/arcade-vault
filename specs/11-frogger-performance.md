# SPEC 11 — Rendimiento de Frogger en móvil

> **Status:** Aprobado
> **Depends on:** SPEC 10, `game-jam/frogger/01-frogger-core.md`
> **Date:** 2026-11-18
> **Objetivo:** Conseguir que Frogger se juegue a ≥ 55 FPS medios en móvil (390×844, CPU 10× más lenta) con los tres skins, sin cambiar su aspecto visual, y dejar medido y documentado el estado del resto de juegos.

---

## Por qué este spec

En móvil, Frogger da tirones y baja de FPS. Revisando el código aparecen varias causas que se suman en cada frame:

- `FroggerGame.tsx` redibuja **todo** el frame desde cero: fondo por zonas, separadores discontinuos (`setLineDash`), bocas, entidades, rana y HUD.
- En el skin **Neón**, `setGlow()` aplica `shadowBlur` a cada coche, camión, tronco, tortuga, rana, boca, vida y barra de tiempo. `shadowBlur` es la operación más cara del Canvas 2D.
- Cada tortuga son 8 `arc()` por celda, y hay 8 grupos de 2 o 3 celdas.
- En el skin **Retro** se pintan 200 `fillRect` de scanlines en cada frame.
- El RAF sigue dibujando con el juego en pausa.
- En CSS, `.crt-screen::after` usa `mix-blend-mode: multiply` encima del canvas. Eso obliga al navegador a recomponer esa capa en cada frame del canvas.
- En CSS, `.av-bg::before` anima `background-position` a pantalla completa (`gridscroll`). Eso repinta el fondo continuamente detrás del juego.

Los otros cuatro juegos comparten varios de estos patrones. Por decisión del usuario no se tocan aquí: se miden y se documentan para specs posteriores.

---

## Scope

**In:**

- `scripts/perf/fps.mjs`: script de Playwright que mide FPS en Frogger. Usa un viewport móvil de 390×844 (`isMobile`, `hasTouch`) y limita la CPU 10× con CDP (`Emulation.setCPUThrottlingRate`). Recorre los skins `classic`, `neon` y `retro`. Admite el slug del juego como argumento para poder reutilizarse.
- `package.json`: `playwright` como devDependency y el script `"perf": "node scripts/perf/fps.mjs"`.
- `components/games/froggerSprites.ts` (nuevo): caché de capas y sprites pre-renderizados en canvas offscreen por skin: fondo estático, scanlines, entidades y rana.
- `components/games/FroggerGame.tsx`:
  - `draw()` compone el frame con `drawImage` a partir de la caché en vez de dibujar formas y `shadowBlur`.
  - La caché se regenera al cambiar de skin.
  - El bucle RAF se detiene en pausa y en game over, y se reanuda sin salto de `dt`.
  - `getContext('2d', { alpha: false })`.
  - Ninguna asignación de arrays u objetos por frame en `draw()` ni en `update()`.
- `app/page.tsx`: `data-game-route` pasa a valer `route.name` (antes era `''`). El selector `#root[data-game-route]` de SPEC 10 sigue funcionando igual.
- `app/globals.css`, solo bajo `#root[data-game-route="frogger"]`:
  - pausar la animación de `.av-bg::before` (`animation-play-state: paused`);
  - quitar `mix-blend-mode` de `.crt-screen::after`.
- `references/performance-findings.md` (nuevo): números de referencia antes y después de Frogger, más los hallazgos de Asteroids, Tetris, Arkanoid y Snake con su causa probable y su línea de código.

**Fuera de scope (para specs posteriores):**

- Arreglar el rendimiento de Asteroids, Tetris, Arkanoid y Snake. Se documentan en `references/performance-findings.md`, por ejemplo:
  - Asteroids llama a `setScore`/`setLives`/`setLevel`/`setTripleShot` en cada frame, así que React vuelve a renderizar 60 veces por segundo;
  - todos redibujan en pausa;
  - glow con `shadowBlur`;
  - scanlines con `fillRect`.
- Cambios en `.av-bg` o en `.crt-screen` para otros juegos o páginas.
- Utilidades de render compartidas en `lib/` para todos los juegos.
- Rediseñar o simplificar visualmente skins, efectos o el CRT.
- Ajustar la resolución del canvas al `devicePixelRatio`.
- Un modo "bajo consumo" o un selector de calidad.
- Ejecutar la medición de FPS en CI.
- Soporte de URL o de query params para enlazar directamente a un juego.

---

## Data model

No hay persistencia nueva. El skin se sigue leyendo de `localStorage['av-skin']`. El script de medición lo escribe con `addInitScript` antes de cargar la página.

`components/games/froggerSprites.ts`:

```ts
// Sprite pre-renderizado: el glow (shadowBlur) va "horneado" dentro del canvas,
// con margen `pad` para que el halo no se recorte.
export interface Sprite {
  canvas: HTMLCanvasElement
  pad: number // px de margen alrededor del contenido (≥ 2 × glow del skin)
}

export interface FroggerSpriteCache {
  skin: SkinId
  background: HTMLCanvasElement // 800×600: bezel, zonas, separadores, bocas vacías, etiquetas fijas del HUD
  scanlines: HTMLCanvasElement | null // 800×600, solo si palette.scanlines
  sprites: Map<SpriteKey, Sprite>
}

// Claves de sprite (una entrada por variante visual distinta)
type SpriteKey =
  | `car:${number}:${1 | -1}` // fila (color) : sentido (parabrisas)
  | `truck:${number}:${1 | -1}` // ancho en celdas : sentido (cabina)
  | `log:${number}` // ancho en celdas
  | 'turtle:up'
  | 'turtle:under' // celda de tortuga visible / sumergida
  | `frog:${Direction}:${0 | 1}` // orientación : saltando
  | 'life' // icono de vida del HUD

export function buildFroggerSprites(colors: Colors, skin: SkinId): FroggerSpriteCache
```

Convenciones:

- Los sprites se dibujan en coordenadas enteras (`Math.round`) para evitar el remuestreo bilineal.
- `Colors`, `Direction`, `Entity` y `Lane` pasan a exportarse desde `FroggerGame.tsx`, o se mueven a `froggerSprites.ts`, para compartir tipos. No cambian de forma.
- Partes que siguen siendo vectoriales cada frame, porque son baratas o dinámicas:
  - los números del HUD (score y nivel);
  - la barra de tiempo, cuyo ancho es variable (con glow en Neón, pero es un único `fillRect`).

Salida de `scripts/perf/fps.mjs`, una línea JSON por skin con la mediana de 3 pasadas (`--runs=3`):

```json
{
  "game": "frogger",
  "skin": "neon",
  "avgFps": 58.7,
  "p95FrameMs": 18.1,
  "longFramesPct": 2.4,
  "cpuMsPerFrame": 9.8,
  "durationS": 10,
  "runs": 3
}
```

- `longFramesPct` es el porcentaje de frames de más de 20 ms.
- `cpuMsPerFrame` es el tiempo de main thread por frame: `TaskDuration` de CDP `Performance.getMetrics` dividido entre los frames medidos. Sirve para comparar los pasos entre sí, pero no forma parte del umbral.
- El script termina con código 1 si la mediana de algún skin no llega a los umbrales: `avgFps < 55` o `longFramesPct > 5`.

---

## Implementation plan

1. **Script de medición.**
   - Añadir `playwright` como devDependency y el npm script `perf`.
   - Crear `scripts/perf/fps.mjs`. El script:
     - abre `BASE_URL`, que por defecto es `http://localhost:3000`;
     - fija el skin con `addInitScript` (`localStorage['av-skin']`);
     - navega por la UI hasta el juego indicado: Home → Juegos → tarjeta → Jugar;
     - limita la CPU 10× y mide durante 10 s con un contador `requestAnimationFrame` inyectado.
   - Probar con `npm run build && npm run start` y `npm run perf -- frogger`: imprime las 3 líneas JSON.
2. **Baseline.**
   - Ejecutar el script sobre el código actual de Frogger (producción) y apuntar los resultados en `references/performance-findings.md`, sección "Frogger — antes".
   - Medir también los otros cuatro juegos y anotar sus resultados junto con los hallazgos de código (ver Fuera de scope).
   - Guardar capturas de referencia de los 3 skins (pausa al segundo 2) en `scripts/perf/out/` (ignorado en git).
3. **CSS acotado a Frogger.**
   - `app/page.tsx`: `data-game-route={route.name}` para rutas de juego.
   - `app/globals.css`: reglas bajo `#root[data-game-route="frogger"]` que pausan `.av-bg::before` y quitan `mix-blend-mode` de `.crt-screen::after`.
   - Comprobar que en móvil el Nav sigue oculto en los 5 juegos (selector de SPEC 10).
4. **Pausa sin redibujar.**
   - En `FroggerGame.tsx`, al pausar o en game over se cancela el RAF tras un último `draw()`.
   - Al reanudar, `last = performance.now()` antes de pedir el siguiente frame.
   - El cambio de skin en pausa sigue repintando vía `redrawRef`.
5. **Fondo y scanlines cacheados.**
   - Crear `froggerSprites.ts` con `buildFroggerSprites()`, por ahora solo con `background` y `scanlines`.
   - `draw()` empieza con `drawImage(background)` y termina con `drawImage(scanlines)`.
   - Se elimina el código vectorial equivalente de `draw()`.
   - Se regenera en el efecto de `skin`.
6. **Sprites de entidades.**
   - Pre-renderizar coches, camiones, troncos y tortugas (visible y sumergida) con su glow horneado.
   - `drawEntity()` pasa a ser un `drawImage` por entidad, o uno por celda en el caso de las tortugas.
7. **Sprites de rana y vidas.**
   - Pre-renderizar las 8 variantes de rana (4 orientaciones × saltando sí/no) y el icono de vida.
   - La rana de las bocas ocupadas usa `frog:down:0` con `globalAlpha = 0.8`.
8. **Sin asignaciones por frame y contexto opaco.**
   - Sacar a constantes de módulo los arrays de `drawWheels`, `legs` y separadores.
   - Sustituir `s.lanes.find` en `update()` por un índice fila → carril construido en `buildLanes()`.
   - Usar `getContext('2d', { alpha: false })`.
9. **Medición final y documentación.**
   - Ejecutar `npm run perf -- frogger` y anotar los resultados en "Frogger — después".
   - Comparar las capturas con las del paso 2.
   - Actualizar `references/performance-findings.md`.

---

## Acceptance criteria

- [ ] `npm run perf -- frogger` contra `npm run start` imprime una línea JSON por skin y termina con código 0.
- [ ] Con 390×844 y CPU 10×, Frogger da `avgFps ≥ 55` en `classic`, `neon` y `retro`.
- [ ] Con 390×844 y CPU 10×, Frogger da `longFramesPct ≤ 5` en los tres skins.
- [ ] Las capturas antes/después de los tres skins no muestran diferencias apreciables al compararlas lado a lado (colores, glow, scanlines, tortugas sumergidas, rana en las bocas). La única excepción permitida es la posición de las entidades.
- [ ] Con la partida en pausa, `FroggerGame` no tiene ningún `requestAnimationFrame` pendiente. Se verifica en una grabación de Performance: no hay frames de `draw` durante la pausa.
- [ ] Al reanudar tras 5 s de pausa, las entidades no dan saltos. El primer `dt` tras reanudar es ≤ `MAX_DT` y corresponde a un frame normal.
- [ ] Cambiar de skin con el juego en pausa repinta el canvas con el nuevo skin, sin reanudar la partida.
- [ ] En la ruta `frogger`, `getComputedStyle` de `.av-bg::before` devuelve `animationPlayState === 'paused'`.
- [ ] En la ruta `frogger`, `.crt-screen::after` devuelve `mixBlendMode === 'normal'`.
- [ ] En las rutas `asteroids`, `tetris`, `arkanoid` y `snake`, `.av-bg::before` sigue con `animationPlayState === 'running'`.
- [ ] En esas mismas rutas, `.crt-screen::after` sigue con `mixBlendMode === 'multiply'`.
- [ ] En móvil, el Nav sigue oculto en las 5 rutas de juego (`#root[data-game-route]` de SPEC 10).
- [ ] `draw()` de Frogger no contiene ninguna llamada a `shadowBlur`, `arc`, `ellipse` ni `setLineDash`.
- [ ] `references/performance-findings.md` existe e incluye los números antes y después de Frogger.
- [ ] `references/performance-findings.md` incluye, para cada uno de los otros 4 juegos, su medición y al menos un hallazgo con archivo y línea.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

---

## Decisions

- **Sí:** solo Frogger. El usuario lo prefiere así. Los demás juegos quedan medidos y documentados para specs posteriores.
- **No:** arreglar ya los otros 4 juegos. Aumentaría el alcance y el riesgo de regresiones visuales en juegos que ya funcionan.
- **Sí:** el aspecto debe quedar idéntico. Las optimizaciones se hacen con caché y sprites pre-renderizados, no recortando efectos.
- **No:** quitar o rebajar el glow o las scanlines en móvil. El usuario prefiere mantener el aspecto.
- **Sí:** glow "horneado" en sprites offscreen. `shadowBlur` se paga una vez por skin y no en cada frame.
- **No:** `OffscreenCanvas` en un Web Worker. Es más complejo y el cuello de botella es el coste por dibujo, no el hilo principal.
- **Sí:** quitar `mix-blend-mode: multiply` del overlay de scanlines del CRT. Multiplicar por negro con alpha 0.18 da el mismo resultado que superponer negro con alpha 0.18 en modo normal (`dst × 0.82`). El aspecto es idéntico y deja de recomponerse la capa en cada frame.
- **Sí:** pausar la rejilla animada `.av-bg` durante Frogger. Es la única diferencia visible y queda aceptada explícitamente por el usuario. Solo afecta al fondo, que queda casi tapado por el CRT.
- **Sí:** acotar el CSS con `#root[data-game-route="frogger"]` y hacer que `data-game-route` lleve el nombre de la ruta. El cambio queda limitado a Frogger y abre la puerta a aplicar lo mismo a otros juegos más adelante.
- **No:** reglas CSS bajo `[data-game-route]` genérico. Afectarían a los otros 4 juegos, que están fuera de scope.
- **Sí:** script versionado `scripts/perf/fps.mjs` con `npm run perf`. Es reproducible y sirve para los specs de rendimiento de los demás juegos.
- **No:** medir solo con el MCP de Playwright o a mano con DevTools. No sería repetible ni comparable entre specs.
- **Sí:** umbrales de `avgFps ≥ 55` y `longFramesPct ≤ 5` con CPU 10× en 390×844. Cambiado durante la implementación (paso 2): con 4× el código original ya daba ~60 FPS en los tres skins y el criterio no detectaba el problema; con 10× Frogger original cae a 40,4 / 21,4 / 42,6 FPS (Clásico / Neón / Retro), mientras que Tetris Neón aguanta 52 FPS incluso a 20×.
- **No:** CPU 4×. En Chromium headless de escritorio no reproduce los tirones que se ven en móvil.
- **Sí:** mediana de 3 pasadas por skin y métrica `cpuMsPerFrame`. Añadido durante la implementación (paso 5): con CPU 10× una sola pasada variaba ±7 FPS con el mismo código (Clásico daba entre 43,1 y 55,0), así que no se podía saber si un paso mejoraba o empeoraba. El tiempo de CPU por frame es mucho más estable para comparar pasos.
- **No:** una sola pasada de FPS. Con ese ruido, el criterio de ≥ 55 FPS no sería fiable.
- **Sí:** medir en build de producción (`npm run start`). El modo dev de Next/React añade una sobrecarga que falsea los números.
- **Sí:** los sprites viven en `components/games/froggerSprites.ts`. `FroggerGame.tsx` ya tiene unas 800 líneas, y separar el render cacheado lo mantiene legible.
- **Sí:** `getContext('2d', { alpha: false })`. El bezel ya cubre todo el canvas, así que no cambia nada visible y el navegador compone más rápido.

---

## Risks

| Riesgo                                                                                    | Mitigación                                                                                                                                |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Remuestreo bilineal de los sprites en posiciones fraccionarias que suaviza los bordes     | Dibujar en coordenadas enteras (`Math.round`). Comparar las capturas antes/después en el paso 9.                                          |
| Halo del glow recortado en los sprites de Neón                                            | Margen `pad ≥ 2 × glow` en cada sprite. Revisar específicamente la captura de Neón.                                                       |
| Navegación por UI del script frágil si cambian textos o clases de Home/Library/GameDetail | Selectores por rol y texto visible concentrados en una única función `gotoGame(slug)` del script.                                         |
| La CPU 10× de Chromium no representa Safari iOS                                           | Es la referencia reproducible del spec. La prueba manual en un dispositivo real queda como comprobación complementaria, no como criterio. |
| Cambiar el valor de `data-game-route` rompe selectores existentes                         | Solo existe `#root[data-game-route]` (presencia), que sigue funcionando. Se comprueba en un criterio de aceptación.                       |
| El RAF detenido en pausa no repinta en otros cambios (resize, skin)                       | `redrawRef` se mantiene y se invoca al cambiar de skin. El canvas tiene tamaño lógico fijo, así que un resize no requiere repintar.       |

---

## What is **not** in this spec

- Optimizaciones de Asteroids, Tetris, Arkanoid y Snake (solo medición y hallazgos documentados).
- Utilidades de render compartidas en `lib/`.
- Cambios visuales en skins, CRT o fondo, salvo pausar la rejilla de `.av-bg` durante Frogger.
- Ajuste a `devicePixelRatio`, modo de bajo consumo o selector de calidad.
- Medición de FPS en CI.
- Rutas por URL para abrir un juego directamente.

Cada uno de esos puntos, si se aborda, irá en su propio spec.
