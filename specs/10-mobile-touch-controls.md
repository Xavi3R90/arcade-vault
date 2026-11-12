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
- `lib/touch-layouts.ts`: definición declarativa de los botones de cada juego (etiqueta, `key`, `code`, zona, auto-repetición).
- `components/TouchControls.tsx`: componente común de botones virtuales. Emite `KeyboardEvent` sintéticos (`keydown`/`keyup`) en `window` con el mismo `key` y `code` que la tecla real. Soporta multi-touch con Pointer Events. Incluye un botón de pausa que llama a un callback.
- `components/TouchToggle.tsx`: botón para mostrar u ocultar los controles táctiles. Aparece en la barra de HUD de cada juego.
- Integración de `TouchControls` y `TouchToggle` en `AsteroidsScreen`, `TetrisScreen`, `ArkanoidScreen` y `SnakeScreen`, sin modificar la lógica de juego.
- Layout adaptado a la orientación: en vertical, canvas a todo el ancho y controles debajo; en horizontal, canvas centrado con alto limitado al viewport y controles a ambos lados.
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

### Layouts de botones

```ts
// lib/touch-layouts.ts
export interface TouchButtonDef {
  id: string
  label: string // glifo visible: '◀', '▶', '▲', '▼', '⟳', '⤓', 'FUEGO'
  ariaLabel: string // 'Girar a la izquierda', 'Disparar', …
  key: string // KeyboardEvent.key  ('ArrowLeft', ' ')
  code: string // KeyboardEvent.code ('ArrowLeft', 'Space')
  zone: 'left' | 'right'
  repeat?: boolean // true = keydown repetido mientras se mantiene (estilo auto-repeat del SO)
}

export type TouchGameId = 'asteroids' | 'tetris' | 'arkanoid' | 'snake'
export const TOUCH_LAYOUTS: Record<TouchGameId, TouchButtonDef[]>
```

Mapeo cerrado:

| Juego     | Zona izquierda                               | Zona derecha                                  | Semántica                                          |
| --------- | -------------------------------------------- | --------------------------------------------- | -------------------------------------------------- |
| Asteroids | ◀ `ArrowLeft`, ▶ `ArrowRight`                | ▲ `ArrowUp` (empuje), FUEGO `Space`           | Mantener = tecla presionada. Multi-touch.          |
| Tetris    | ◀ `ArrowLeft`, ▶ `ArrowRight`, ▼ `ArrowDown` | ⟳ `ArrowUp` (rotar), ⤓ `Space` (caída rápida) | ◀ ▶ ▼ con `repeat: true`; ⟳ y ⤓ un solo `keydown`. |
| Arkanoid  | ◀ `ArrowLeft`                                | ▶ `ArrowRight`                                | Mantener = tecla presionada.                       |
| Snake     | Cruceta ▲ ▼ ◀ ▶ (flechas)                    | —                                             | Un `keydown` por pulsación.                        |

Auto-repetición (`repeat: true`): primer `keydown` inmediato, luego 170 ms de espera y después uno cada 50 ms hasta soltar.

### Props del componente

```ts
// components/TouchControls.tsx
interface TouchControlsProps {
  game: TouchGameId
  color: 'cyan' | 'magenta' | 'yellow' | 'green' // de games.color
  onPause: () => void
  disabled?: boolean // true en game over: no emite eventos
}
```

Cada `KeyboardEvent` sintético se crea con `{ key, code, bubbles: true }` y se despacha en `window`. Los juegos ya leen `e.key` (Arkanoid, Snake) o `e.code` (Asteroids, Tetris), así que funcionan sin cambios.

---

## Plan de implementación

1. **Viewport.** Leer `node_modules/next/dist/docs/` para la API de `viewport` en Next 16. Añadir `export const viewport: Viewport` en `app/layout.tsx` con `width: 'device-width'`, `initialScale: 1` y `viewportFit: 'cover'`. No fijar `maximumScale`. Prueba manual: la Home a 390×844 en Playwright no aparece reducida.
2. **Store de preferencia.** Crear `lib/touch-controls.ts` con `readTouchPref`, `writeTouchPref`, `subscribeTouchPref` y `useTouchControlsVisible`, con el patrón de `lib/skins.ts`. Escucha cambios de `matchMedia('(pointer: coarse)')` y el evento `storage`.
3. **Layouts.** Crear `lib/touch-layouts.ts` con `TouchButtonDef`, `TouchGameId` y `TOUCH_LAYOUTS` según la tabla del Data model.
4. **Componente `TouchControls`.** Crear `components/TouchControls.tsx`:
   - `onPointerDown`: `setPointerCapture`, despachar `keydown` y arrancar el auto-repeat si corresponde.
   - `onPointerUp` / `onPointerCancel` / `onLostPointerCapture`: despachar `keyup` y parar el repeat.
   - `onContextMenu`: `preventDefault`.
   - Al desmontar, en `window` `blur` y en `visibilitychange` oculto: soltar todas las teclas presionadas (`keyup`) y limpiar timers.
   - Botón ⏸ que llama a `onPause`.
   - `disabled` impide emitir eventos.
   - Botones de al menos 56×56 px CSS con `aria-label`.
5. **Estilos base.** En `app/globals.css`: `.touch-controls`, `.touch-zone`, `.touch-btn`, `.touch-btn.pressed`, con `touch-action: none`, `user-select: none` y `-webkit-touch-callout: none`. Color por `data-color`.
6. **Estilos por skin.** Añadir variantes `[data-skin='classic' | 'neon' | 'retro'] .touch-btn`. Contraste de la etiqueta del botón ≥ 4.5:1 sobre su fondo en los 3 skins.
7. **`TouchToggle`.** Crear `components/TouchToggle.tsx`. Ciclo `auto → on → off → auto` con una etiqueta que indique el estado actual (p. ej. `CONTROLES: AUTO`). Usa `writeTouchPref`.
8. **Layout de juego por orientación.** Contenedor `.game-stage` en `app/globals.css`:
   - Vertical (`orientation: portrait`): columna con canvas a todo el ancho y `TouchControls` debajo.
   - Horizontal: fila con zona izquierda, canvas y zona derecha. El canvas tiene alto limitado a `100dvh` menos el HUD.
   - Respetar `env(safe-area-inset-*)`.
   - Mantener `aspect-ratio: 800 / 600` (Tetris `1 / 2`).
9. **Integrar en Snake.** Pasar el toggle de pausa inline a una función `togglePause`. Montar `TouchToggle` en el HUD y `TouchControls` (`game="snake"`, `color="green"`, `onPause={togglePause}`, `disabled={over}`) dentro de `.game-stage`. Prueba: en Playwright con `hasTouch`, la cruceta cambia la dirección.
10. **Integrar en Arkanoid.** Igual que el paso 9 (`color="magenta"`). Prueba: mantener ◀ mueve la paleta hasta soltar.
11. **Integrar en Tetris.** Igual que el paso 9 (`color="cyan"`). Prueba: mantener ◀ desplaza la pieza varias columnas; ⤓ la deja caer.
12. **Integrar en Asteroids.** Igual que el paso 9 (`color="yellow"`). Prueba: mantener ▲ y FUEGO a la vez empuja y dispara.
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

- [ ] Asteroids: mantener ◀ o ▶ hace girar la nave hasta soltar. ▲ la empuja. FUEGO dispara.
- [ ] Asteroids: ▲ y FUEGO presionados a la vez (dos pointers) actúan simultáneamente.
- [ ] Tetris: un toque en ◀ o ▶ mueve una columna. Mantenerlo mueve varias columnas.
- [ ] Tetris: ▼ baja la pieza, ⟳ la rota una vez por toque y ⤓ la deja caer.
- [ ] Arkanoid: mantener ◀ o ▶ mueve la paleta. Al soltar se detiene.
- [ ] Snake: cada flecha de la cruceta cambia la dirección. La dirección opuesta sigue bloqueada.
- [ ] El botón ⏸ pausa y reanuda la partida en los 4 juegos.
- [ ] Salir de la pestaña (`visibilitychange`) con un botón presionado no deja teclas "pegadas" al volver.
- [ ] Con el modal de game over abierto, los controles no emiten eventos.

**Layout y gestos**

- [ ] En vertical, el canvas completo y todos los botones son visibles sin scroll en 390×844.
- [ ] En horizontal, los controles quedan a los lados del canvas y el canvas completo cabe en el alto del viewport.
- [ ] Todos los botones táctiles miden al menos 56×56 px CSS.
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
| Un juego escucha `keydown` en el canvas en lugar de `window` y no recibe los eventos        | Hoy los 4 escuchan `window` (verificado). Si un juego futuro no lo hace, `TouchControls` lo documenta como requisito.     |
| Los `KeyboardEvent` sintéticos llegan al input del modal de game over                       | `disabled={over}` en `TouchControls`, y el modal se pinta por encima de los controles.                                    |
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
