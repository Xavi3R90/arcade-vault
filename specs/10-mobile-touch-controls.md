# SPEC 10 — Soporte móvil: controles táctiles y shell responsive

> **Status:** Aprobado
> **Depends on:** SPEC 05, SPEC 07, SPEC 08, SPEC 09
> **Date:** 2026-11-11
> **Objetivo:** Que los cuatro juegos (Asteroids, Tetris, Arkanoid, Snake) y todas las pantallas del shell se puedan usar de principio a fin en un móvil o tablet con pantalla táctil.

---

## Por qué existe este spec

Hoy los juegos solo responden a teclado (`keydown`/`keyup` en `window`). En un móvil se ven pero no se pueden jugar. El usuario decidió cubrir en un único spec los controles táctiles y la revisión responsive del shell, aunque toque varias áreas. Esa decisión queda registrada en **Decisiones**.

---

## Scope

**In:**

- `lib/touch-controls.ts`: store de preferencia de controles táctiles (detección automática + override manual persistido en `localStorage['av-touch-controls']`), con el mismo patrón que `lib/skins.ts`.
- **Gamepad único para todos los juegos** (ver mockup en _Diseño del gamepad_): misma cruceta ↑ ↓ ← →, mismos botones redondos **B** y **A** y misma barra inferior **PAUSA · skin · SALIR** en los 4 juegos. Cada juego solo decide qué tecla emite cada botón; los botones sin uso se pintan atenuados y deshabilitados.
- `lib/touch-layouts.ts`: mapeo declarativo `slot del gamepad → tecla` por juego (`key`, `code`, `aria-label`, auto-repetición).
- `components/Gamepad.tsx`: gamepad común. Emite `KeyboardEvent` sintéticos (`keydown`/`keyup`) en `window` con el mismo `key` y `code` que la tecla real. Soporta multi-touch con Pointer Events. PAUSA llama a un callback, el selector cambia el skin global (`writeSkin`) y SALIR navega al detalle del juego.
- `components/GameStage.tsx`: contenedor común del canvas de cada juego. Sin controles táctiles muestra solo el canvas; con controles táctiles pasa a **modo consola portátil**: canvas dentro del bezel CRT (el mismo de `GamePlayer`) con barra de estado `SEÑAL OK · <JUEGO> · CRT-83 · 60 HZ · CARGA · 1MB` y el `Gamepad` debajo.
- `components/TouchToggle.tsx`: botón para mostrar u ocultar los controles táctiles. Aparece en la barra de HUD de cada juego.
- Integración de `GameStage` y `TouchToggle` en `AsteroidsScreen`, `TetrisScreen`, `ArkanoidScreen` y `SnakeScreen`, sin modificar la lógica de juego.
- Layout adaptado a la orientación: en vertical, bezel a todo el ancho, cruceta + B/A debajo y la barra PAUSA · skin · SALIR al final; en horizontal, cruceta a la izquierda, bezel en el centro y B/A + barra (en columna) a la derecha.
- Estilos de los botones por skin (Clásico, Neón, Retro) vía `[data-skin='…']` en `app/globals.css`. El color base de cada juego sale de `games.color`.
- Bloquear scroll, pull-to-refresh, doble-tap zoom, menú contextual de pulsación larga y selección de texto **solo** en el área de juego y los controles.
- Modal de game over usable con teclado virtual en los cuatro juegos (input visible, sin auto-zoom en iOS, Enter guarda).
- `app/layout.tsx`: export `viewport` según la API de Next 16 (`width=device-width`, `initialScale: 1`, `viewportFit: 'cover'`).
- Revisión responsive y correcciones en Nav, Home, Biblioteca, Detalle, GamePlayer, Salón de la Fama, Auth y About en los viewports de referencia.

**Fuera de scope (para specs posteriores):**

- Controles por gestos (swipe, arrastrar la paleta, tap sobre el canvas).
- Vibración háptica (`navigator.vibrate`).
- Mandos físicos (Gamepad API).
- PWA, instalación en pantalla de inicio y modo offline.
- Pantalla completa (`requestFullscreen`) y bloqueo de orientación.
- Personalizar la posición o el tamaño de los botones por el usuario.
- Pruebas en dispositivo físico (la verificación es solo con Playwright).
- Puas Express y cualquier juego que no esté en `references/implemented-games.md`.

---

## Data model

### Preferencia de controles táctiles

```ts
// lib/touch-controls.ts
export const TOUCH_STORAGE_KEY = 'av-touch-controls'
export type TouchPref = 'on' | 'off' | 'auto' // 'auto' = no hay clave en localStorage

// Visible si pref === 'on', o si pref === 'auto' y matchMedia('(pointer: coarse)').matches
export function readTouchPref(): TouchPref
export function writeTouchPref(pref: TouchPref): void // 'auto' borra la clave
export function subscribeTouchPref(cb: () => void): () => void
export function useTouchControlsVisible(): boolean // useSyncExternalStore; servidor = false
```

Si `localStorage` no está disponible, la preferencia se mantiene en memoria (igual que `lib/skins.ts`).

### Diseño del gamepad

Todos los juegos generan **el mismo gamepad** (modo consola portátil). Mockup en vertical (390×844):

```
┌──────────────────────────────────────┐
│ ╭──────────────────────────────────╮ │  ← bezel CRT (.game-screen)
│ │                                  │ │
│ │          CANVAS DEL JUEGO        │ │
│ │                                  │ │
│ ╰──────────────────────────────────╯ │
│  ● SEÑAL OK  ASTEROIDS · CRT-83 · 60 HZ   CARGA · 1MB
└──────────────────────────────────────┘
        ┌───┐
        │ ↑ │
  ┌───┐ └───┘ ┌───┐          ( B )  ( A )
  │ ← │       │ → │          azul   roja
  └───┘ ┌───┐ └───┘
        │ ↓ │   ← atenuado si el juego no lo usa
        └───┘
 ┌──────────────┐ ┌──────────┐ ┌──────────┐
 │ ⏸  PAUSA     │ │ Neón   ▾ │ │ ← SALIR  │
 └──────────────┘ └──────────┘ └──────────┘
```

- **Cruceta:** 4 flechas de 56×56 px en una rejilla 3×3 con hueco central.
- **B y A:** círculos de 64 px. B azul (`#14273d` / borde `#4f86c6`), A roja (`#3a1418` / borde `#c2474f`).
- **Barra inferior:** PAUSA (amarilla, pasa a `▶ REANUDAR` en pausa) · selector de skin (Clásico / Neón / Retro, cambia el skin global) · `← SALIR` (vuelve al detalle del juego).
- **Slot sin binding:** se renderiza igual pero con `opacity: 0.3`, `disabled` y `aria-hidden`. El gamepad es idéntico en todos los juegos, nunca se ocultan botones.
- **Horizontal:** cruceta | bezel | B/A con la barra apilada en columna debajo.
- En modo consola, los botones PAUSA/SALIR del HUD se ocultan (viven en el gamepad); el HUD conserva `TouchToggle`.

### Layouts de botones (slot → tecla)

```ts
// lib/touch-layouts.ts
export type GamepadSlot = 'up' | 'down' | 'left' | 'right' | 'b' | 'a'

export interface TouchBinding {
  ariaLabel: string // 'Girar a la izquierda', 'Disparar', …
  key: string // KeyboardEvent.key  ('ArrowLeft', ' ')
  code: string // KeyboardEvent.code ('ArrowLeft', 'Space')
  repeat?: boolean // true = keydown repetido mientras se mantiene (estilo auto-repeat del SO)
}

export type TouchGameId = 'asteroids' | 'tetris' | 'arkanoid' | 'snake'
export type GamepadLayout = Partial<Record<GamepadSlot, TouchBinding>> // slot ausente = atenuado
export const SLOT_LABEL: Record<GamepadSlot, string> // ↑ ↓ ← → B A (iguales en todos los juegos)
export const TOUCH_LAYOUTS: Record<TouchGameId, GamepadLayout>
```

Mapeo cerrado (— = slot atenuado):

| Juego     | ↑                | ↓                    | ← / →                               | B                    | A                |
| --------- | ---------------- | -------------------- | ----------------------------------- | -------------------- | ---------------- |
| Asteroids | `ArrowUp` empuje | —                    | `ArrowLeft` / `ArrowRight` giro     | `ArrowUp` empuje     | `Space` disparar |
| Tetris    | `ArrowUp` rotar  | `ArrowDown` (repeat) | `ArrowLeft` / `ArrowRight` (repeat) | `Space` caída rápida | `ArrowUp` rotar  |
| Arkanoid  | —                | —                    | `ArrowLeft` / `ArrowRight`          | —                    | —                |
| Snake     | `ArrowUp`        | `ArrowDown`          | `ArrowLeft` / `ArrowRight`          | —                    | —                |

- Asteroids, Arkanoid: mantener = tecla presionada. Multi-touch (↑/B + A a la vez).
- Si dos slots comparten tecla (↑ y B en Asteroids), el `keyup` solo se emite cuando se suelta el último.
- Auto-repetición (`repeat: true`): primer `keydown` inmediato, luego 170 ms de espera y después uno cada 50 ms hasta soltar.

### Props de los componentes

```ts
// components/Gamepad.tsx
export interface GamepadProps {
  game: TouchGameId
  color: 'cyan' | 'magenta' | 'yellow' | 'green' // de games.color
  paused: boolean // etiqueta PAUSA / REANUDAR
  onPause: () => void
  onExit: () => void // SALIR
  disabled?: boolean // true en game over: no emite eventos
}

// components/GameStage.tsx
interface GameStageProps extends GamepadProps {
  title: string // barra de estado del bezel
  aspect: number // 800/600; Tetris 0.5
  maxWidth: number // px; Tetris 300
  children: ReactNode // canvas + overlays
}
```

Cada `KeyboardEvent` sintético se crea con `{ key, code, bubbles: true }` y se despacha en `window`. Los juegos ya leen `e.key` (Arkanoid, Snake) o `e.code` (Asteroids, Tetris), así que funcionan sin cambios.

---

## Plan de implementación

1. **Viewport.** Leer `node_modules/next/dist/docs/` para la API de `viewport` en Next 16. Añadir `export const viewport: Viewport` en `app/layout.tsx` con `width: 'device-width'`, `initialScale: 1` y `viewportFit: 'cover'`. No fijar `maximumScale`. Prueba manual: la Home a 390×844 en Playwright no aparece reducida.
2. **Store de preferencia.** Crear `lib/touch-controls.ts` con `readTouchPref`, `writeTouchPref`, `subscribeTouchPref` y `useTouchControlsVisible`, con el patrón de `lib/skins.ts`. Escucha cambios de `matchMedia('(pointer: coarse)')` y el evento `storage`.
3. **Layouts.** Crear `lib/touch-layouts.ts` con `GamepadSlot`, `TouchBinding`, `SLOT_LABEL` y `TOUCH_LAYOUTS` según la tabla del Data model.
4. **Componente `Gamepad`.** Crear `components/Gamepad.tsx` con la estructura del mockup (`.gp-dpad`, `.gp-ab`, `.gp-bar`):
   - `onPointerDown`: `setPointerCapture`, despachar `keydown` y arrancar el auto-repeat si corresponde.
   - `onPointerUp` / `onPointerCancel` / `onLostPointerCapture`: parar el repeat y despachar `keyup` (si ningún otro slot presionado usa la misma tecla).
   - `onContextMenu`: `preventDefault`.
   - Al desmontar, en `window` `blur` y en `visibilitychange` oculto: soltar todas las teclas presionadas (`keyup`) y limpiar timers.
   - Slots sin binding: atenuados y `disabled`.
   - Barra: PAUSA → `onPause`; selector de skin → `writeSkin`; SALIR → `onExit`.
   - `disabled` impide emitir eventos.
   - Flechas de 56×56 px, B/A de 64 px, botones de la barra ≥ 44 px de alto, todos con `aria-label`.
5. **Componente `GameStage`.** Crear `components/GameStage.tsx`. Usa `useTouchControlsVisible()`: sin controles renderiza solo `.game-canvas`; con controles añade la clase `is-console`, el bezel CRT con barra de estado y el `Gamepad`.
6. **Estilos base y por skin.** En `app/globals.css`: `.game-stage`, `.is-console`, `.game-screen`, `.gp-*`, con `touch-action: none`, `user-select: none` y `-webkit-touch-callout: none`. Color del juego por `data-color` (glow del bezel). Variantes `[data-skin='neon' | 'retro']` (Clásico = base). Contraste de las etiquetas ≥ 4.5:1 en los 3 skins.
7. **`TouchToggle`.** Crear `components/TouchToggle.tsx`. Ciclo `auto → on → off → auto` con una etiqueta que indique el estado actual (p. ej. `CONTROLES: AUTO`). Usa `writeTouchPref`.
8. **Layout de juego por orientación.** Grid de `.game-stage.is-console`:
   - Vertical: `'screen screen' / 'dpad ab' / 'bar bar'`.
   - Horizontal: `'dpad screen ab' / 'dpad screen bar'`, barra en columna.
   - El ancho del canvas se limita por el alto disponible (`100dvh` − HUD − alto del gamepad) para que todo quepa sin scroll.
   - Respetar `env(safe-area-inset-*)`.
   - Mantener `aspect-ratio: 800 / 600` (Tetris `1 / 2`).
9. **Integrar en Snake.** Pasar el toggle de pausa inline a una función `togglePause`. Montar `TouchToggle` en el HUD y envolver el canvas en `GameStage` (`game="snake"`, `title="Snake"`, `color="green"`, `paused`, `onPause={togglePause}`, `onExit` → detalle, `disabled={over}`). Prueba: en Playwright con `hasTouch`, la cruceta cambia la dirección.
10. **Integrar en Arkanoid.** Igual que el paso 9 (`color="magenta"`). Prueba: mantener ← mueve la paleta hasta soltar; ↑ ↓ B A aparecen atenuados.
11. **Integrar en Tetris.** Igual que el paso 9 (`color="cyan"`, `aspect={0.5}`, `maxWidth={300}`). Prueba: mantener ← desplaza la pieza varias columnas; B la deja caer; A rota.
12. **Integrar en Asteroids.** Igual que el paso 9 (`color="yellow"`). Prueba: mantener ↑ y A a la vez empuja y dispara; ↓ aparece atenuado.
13. **Bloqueo de gestos en partida.** Mientras se renderiza una pantalla de juego, poner la clase `in-game` en `#root` con `overscroll-behavior: none`. Usar `touch-action: none` en `.game-stage`. Así se bloquean pull-to-refresh y el doble-tap zoom en el área de juego sin afectar al resto del sitio.
14. **Modal de game over móvil.** En los 4 juegos:
    - El modal usa `max-height: 100dvh` y `overflow-y: auto`.
    - El input usa `font-size: 16px` o más (evita el auto-zoom de iOS), `autoCapitalize="characters"`, `autoComplete="off"` y `enterKeyHint="done"`.
    - Enter dispara GUARDAR.
    - Se mantienen el límite de 10 caracteres y las mayúsculas.
15. **Responsive del shell (1/2).** Auditar Nav, Home, Biblioteca y Detalle a 360×740, 390×844 y 768×1024, en vertical y horizontal. Corregir en `app/globals.css` cualquier scroll horizontal, texto cortado o elemento táctil menor de 44×44 px.
16. **Responsive del shell (2/2).** La misma auditoría y correcciones en GamePlayer, Salón de la Fama, Auth y About.

---

## Criterios de aceptación

Todas las comprobaciones se hacen con Playwright en los viewports 360×740, 390×844 y 768×1024, en vertical y en horizontal. Los criterios táctiles usan emulación táctil (`hasTouch: true`).

**Detección y toggle**

- [ ] Con emulación táctil y sin clave `av-touch-controls`, los controles táctiles se ven en los 4 juegos.
- [ ] Sin emulación táctil (escritorio) y sin clave, no se ven controles táctiles.
- [ ] `TouchToggle` cicla `AUTO → ON → OFF → AUTO`, y la etiqueta refleja el estado.
- [ ] Con `ON` en escritorio, los controles se ven. Con `OFF` en táctil, no se ven.
- [ ] La preferencia sobrevive a una recarga de página.
- [ ] El teclado físico sigue funcionando en los 4 juegos con los controles visibles.

**Controles por juego**

- [ ] Los 4 juegos muestran el mismo gamepad (cruceta, B, A, PAUSA · skin · SALIR) dentro del modo consola con bezel CRT.
- [ ] Los slots sin uso aparecen atenuados y deshabilitados: Asteroids ↓; Arkanoid ↑ ↓ B A; Snake B A.
- [ ] Asteroids: mantener ← o → hace girar la nave hasta soltar. ↑ o B la empujan. A dispara.
- [ ] Asteroids: ↑ y A presionados a la vez (dos pointers) actúan simultáneamente. Soltar ↑ con B aún presionado no corta el empuje.
- [ ] Tetris: un toque en ← o → mueve una columna. Mantenerlo mueve varias columnas.
- [ ] Tetris: ↓ baja la pieza, ↑ y A la rotan una vez por toque y B la deja caer.
- [ ] Arkanoid: mantener ← o → mueve la paleta. Al soltar se detiene.
- [ ] Snake: cada flecha de la cruceta cambia la dirección. La dirección opuesta sigue bloqueada.
- [ ] PAUSA pausa y reanuda la partida en los 4 juegos (la etiqueta pasa a REANUDAR).
- [ ] El selector del gamepad cambia el skin global (Clásico / Neón / Retro) sin reiniciar la partida.
- [ ] SALIR vuelve a la pantalla de detalle del juego.
- [ ] Salir de la pestaña (`visibilitychange`) con un botón presionado no deja teclas "pegadas" al volver.
- [ ] Con el modal de game over abierto, los controles no emiten eventos.

**Layout y gestos**

- [ ] En vertical, el canvas completo y todos los botones son visibles sin scroll en 390×844.
- [ ] En horizontal, la cruceta queda a la izquierda y B/A + barra a la derecha del bezel, y el canvas completo cabe en el alto del viewport.
- [ ] Las flechas miden 56×56 px, B/A 64×64 px y los botones de la barra ≥ 44 px de alto.
- [ ] La etiqueta de los botones tiene un contraste ≥ 4.5:1 en Clásico, Neón y Retro.
- [ ] `.game-stage` tiene `touch-action: none`. Durante la partida, `#root` tiene `overscroll-behavior: none`.
- [ ] Fuera de las pantallas de juego, la página se desplaza con normalidad.

**Modal de game over**

- [ ] El input del modal tiene `font-size` ≥ 16px y `enterKeyHint="done"` en los 4 juegos.
- [ ] Pulsar Enter en el input guarda la puntuación.
- [ ] El input sigue limitado a 10 caracteres en mayúsculas.
- [ ] En 360×740 el modal entero (input y botones) se puede alcanzar con scroll interno.

**Shell responsive**

- [ ] En Nav, Home, Biblioteca, Detalle, GamePlayer, Salón, Auth y About, `document.documentElement.scrollWidth <= window.innerWidth` en los 6 casos (3 viewports × 2 orientaciones).
- [ ] Ningún enlace ni botón interactivo del shell mide menos de 44×44 px en 360×740.
- [ ] El menú hamburguesa abre y cierra, y sus enlaces navegan, en 360×740 y 390×844.
- [ ] Desde la Biblioteca se puede abrir un juego y jugarlo en 390×844 solo con toques.

**General**

- [ ] `npm run build` termina sin errores de TypeScript.
- [ ] `npm run lint` termina sin errores.
- [ ] No hay errores de consola al recorrer todas las pantallas en 390×844.

---

## Decisiones

- **Sí: un solo spec para controles y shell responsive.** Lo eligió el usuario. Se asume que es más largo de lo habitual. El plan separa los pasos de juego (1–14) de los del shell (15–16) para poder hacer commits independientes.
- **Sí: botones virtuales en los 4 juegos.** Elección del usuario: un componente común y uniforme.
- **Sí: el mismo gamepad (cruceta + B/A + PAUSA · skin · SALIR) en todos los juegos.** Corrección del usuario tras la primera implementación, que usaba zonas de botones distintas por juego (◀ ▶ / FUEGO / ⟳ / ⤓). Ahora cada juego solo mapea slots a teclas y los slots sin uso se atenúan en lugar de desaparecer, para que la consola sea idéntica en todos.
- **Sí: bezel CRT del `GamePlayer` en modo consola.** Solo cuando los controles táctiles están visibles; en escritorio el canvas se ve como antes.
- **Sí: PAUSA y SALIR del HUD se ocultan en modo consola.** Están en la barra del gamepad; duplicarlos roba alto en móvil.
- **No: gestos (swipe, arrastre).** Quedan fuera de scope. Pueden llegar en otro spec como alternativa por juego.
- **Sí: `KeyboardEvent` sintéticos en `window`.** Los cuatro juegos ya escuchan `window`. No hay que tocar su lógica ni duplicar handlers.
- **No: callbacks `onPress/onRelease` por juego.** Habría que refactorizar los handlers de las 4 screens sin ganar funcionalidad.
- **Sí: `onPause` como callback, no como tecla sintética.** Asteroids no tiene tecla de pausa (solo el botón de HUD), y cada juego usa una tecla distinta (`KeyP`, `p`, `Escape`). El callback reutiliza el `togglePause` existente.
- **Sí: detección por `(pointer: coarse)` con override manual.** Elección del usuario. Cubre tablets con teclado y portátiles táctiles.
- **Sí: clave `av-touch-controls`.** Sigue la convención con guion de `av-skin`, no `av:touch-controls`.
- **Sí: estilos de botón por skin.** Elección del usuario. Obliga a validar el contraste en 3 skins.
- **Sí: Pointer Events + `setPointerCapture`.** Multi-touch nativo y sin duplicar `touchstart`/`mousedown`.
- **Sí: auto-repeat solo en movimientos de Tetris.** En Asteroids y Arkanoid los juegos leen el estado de la tecla (mantener = presionada). En Snake, repetir no aporta nada.
- **No: `maximumScale: 1` ni `userScalable: false`.** Rompería el zoom de accesibilidad en todo el sitio. El bloqueo se aplica solo al área de juego con `touch-action`.
- **Sí: soporte de ambas orientaciones.** Elección del usuario. Hay layout distinto según `orientation`.
- **No: bloqueo de orientación ni pantalla completa.** iOS Safari no lo soporta desde web. Va a otro spec si llega.
- **Sí: verificación solo con Playwright.** Elección del usuario. Se acepta el riesgo de diferencias en iOS Safari real.

---

## Riesgos

| Riesgo                                                                                      | Mitigación                                                                                                                |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Tecla "pegada" si el `pointerup` se pierde (el dedo sale del botón, cambio de app)          | `setPointerCapture` + `pointercancel` + `lostpointercapture` + liberar todo en `blur`, `visibilitychange` y al desmontar. |
| La emulación de Playwright no reproduce iOS Safari (auto-zoom de inputs, `dvh`, safe areas) | Input con `font-size` ≥ 16px, `100dvh` con fallback `100vh` y `env(safe-area-inset-*)`. Riesgo aceptado por el usuario.   |
| Un juego escucha `keydown` en el canvas en lugar de `window` y no recibe los eventos        | Hoy los 4 escuchan `window` (verificado). Si un juego futuro no lo hace, `Gamepad` lo documenta como requisito.           |
| Los `KeyboardEvent` sintéticos llegan al input del modal de game over                       | `disabled={over}` en `GameStage`/`Gamepad`, y el modal se pinta por encima de los controles.                              |
| El alcance grande (juegos + shell) alarga la implementación                                 | Plan dividido en pasos con commit propio. El shell (15–16) va al final y no bloquea los controles.                        |
| El contraste por skin falla en alguna combinación color × skin                              | El criterio de aceptación exige ≥ 4.5:1. Se ajusta el fondo del botón, no el color del juego.                             |

---

## Lo que **no** está en este spec

- Controles por gestos (swipe, arrastre, tap en canvas).
- Vibración háptica.
- Gamepad API.
- PWA y modo offline.
- Pantalla completa y bloqueo de orientación.
- Personalizar la posición o el tamaño de los botones.
- Pruebas en dispositivo físico.
- Juegos que no estén implementados (Puas Express u otros).

Cada uno de esos, si llega, va en su propio spec.
