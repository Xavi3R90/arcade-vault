# SPEC 10 — Controles táctiles y layout móvil para los juegos

> **Status:** Aprobado
> **Depends on:** SPEC 05, SPEC 07, SPEC 08, SPEC 09
> **Date:** 2026-11-11
> **Objetivo:** Hacer jugables los 4 juegos actuales en móviles táctiles en vertical con un layout común: canvas arriba, gamepad virtual (cruceta + botones A/B) abajo y pie con PAUSA, selector de skin y SALIR.

---

## Por qué este spec

Hoy los cuatro juegos (Asteroids, Tetris, Arkanoid y Snake) solo se controlan con teclado. En un móvil no se pueden jugar. Todos tendrán el mismo control virtual para que la experiencia sea consistente. Los juegos no reescriben su lógica de entrada: el control táctil emite eventos de teclado sintéticos que los handlers actuales ya entienden.

Referencia visual: captura aportada por el usuario. Muestra el canvas con HUD arriba, una cruceta de 4 flechas a la izquierda, los botones circulares **B** (azul) y **A** (rojo) a la derecha y un pie con `PAUSA`, selector de skin y `← SALIR`.

---

## Scope

**In:**

- `lib/touch.ts`: tipos `TouchButtonId`, `KeyBinding`, `TouchMapping`, constante `TOUCH_MAPPINGS` con el mapeo por juego y helper `dispatchKey()` que despacha `KeyboardEvent` en `window`.
- `lib/useTouchMobile.ts`: hooks `useIsTouchMobile()` y `useIsLandscape()` basados en `matchMedia` + `useSyncExternalStore` (servidor = `false`).
- `components/TouchControls.tsx`: componente compartido con cruceta, botones A/B, pie (PAUSA/REANUDAR, `<select>` de skin, SALIR) y aviso de orientación horizontal.
- `app/globals.css`: estilos del control (`.touch-controls`, `.touch-dpad`, `.touch-btn`, `.touch-ab`, `.touch-footer`, `.touch-rotate`) y reglas del layout móvil, todo bajo `@media (pointer: coarse) and (max-width: 900px)`.
- `app/page.tsx`: atributo `data-game-route` en `#root` cuando la ruta activa es un juego; con él se oculta `.av-nav` en móvil.
- `components/screens/SnakeScreen.tsx`, `AsteroidsScreen.tsx`, `ArkanoidScreen.tsx`, `TetrisScreen.tsx`: renderizar `<TouchControls>` cuando `useIsTouchMobile()` es `true` y adaptar el contenedor al layout vertical.
- Mantener pulsado (hold real): `pointerdown` → `keydown`, `pointerup`/`pointercancel`/`lostpointercapture` → `keyup`.
- Auto-repeat solo en Tetris (flechas izquierda/derecha/abajo).
- Feedback: estado visual pulsado y `navigator.vibrate(10)` cuando exista.
- Orientación horizontal en móvil: overlay "GIRA EL DISPOSITIVO" y pausa automática.

**Fuera de scope (para specs posteriores):**

- Integración del control táctil en juegos nuevos y actualización del skill `/add-game` y de las "convenciones duras" de `CLAUDE.md`. Irá en un requerimiento aparte, como pidió el usuario.
- Layout jugable en horizontal (landscape).
- Gestos sobre el canvas (swipe, arrastrar la paleta de Arkanoid con el dedo).
- Refactor de la entrada de cada juego a una API de input propia (callbacks).
- Personalizar o reubicar los botones por el usuario.
- Tablets grandes y laptops táctiles (> 900 px de ancho): siguen con el layout de escritorio.
- Pantalla completa (Fullscreen API) y bloqueo de orientación (`screen.orientation.lock`).
- Sonido.

---

## Data model

No hay persistencia nueva. El skin sigue usando el store existente `localStorage['av-skin']` vía `readSkin`/`writeSkin` de `lib/skins`.

`lib/touch.ts`:

```ts
export type TouchButtonId = 'up' | 'down' | 'left' | 'right' | 'a' | 'b'

// key → para juegos que leen e.key (Arkanoid, Snake)
// code → para juegos que leen e.code (Asteroids, Tetris)
export type KeyBinding = { key: string; code: string; repeat?: boolean }

// Botón ausente = se renderiza deshabilitado/atenuado (mismo diseño en todos los juegos)
export type TouchMapping = Partial<Record<TouchButtonId, KeyBinding>>

export type TouchGameId = 'asteroids' | 'tetris' | 'arkanoid' | 'snake'
export const TOUCH_MAPPINGS: Record<TouchGameId, TouchMapping>
```

Mapeo cerrado:

| Juego     | ↑                | ↓                    | ←                    | →                     | A                | B                      |
| --------- | ---------------- | -------------------- | -------------------- | --------------------- | ---------------- | ---------------------- |
| asteroids | `ArrowUp` empuje | —                    | `ArrowLeft` girar    | `ArrowRight` girar    | `Space` disparar | —                      |
| tetris    | `ArrowUp` rotar  | `ArrowDown` (repeat) | `ArrowLeft` (repeat) | `ArrowRight` (repeat) | `ArrowUp` rotar  | `Space` caída instant. |
| arkanoid  | —                | —                    | `ArrowLeft`          | `ArrowRight`          | —                | —                      |
| snake     | `ArrowUp`        | `ArrowDown`          | `ArrowLeft`          | `ArrowRight`          | —                | —                      |

`Space` se emite como `{ key: ' ', code: 'Space' }`. Las flechas se emiten con `key` y `code` iguales (`'ArrowUp'`, etc.).

Constantes de auto-repeat (Tetris):

```ts
const REPEAT_DELAY = 170 // ms hasta la primera repetición
const REPEAT_INTERVAL = 50 // ms entre repeticiones
```

Media queries:

```ts
const MOBILE_QUERY = '(pointer: coarse) and (max-width: 900px)'
const LANDSCAPE_QUERY = '(orientation: landscape)'
```

Props de `TouchControls`:

```ts
type TouchControlsProps = {
  mapping: TouchMapping
  paused: boolean
  onTogglePause: () => void
  onExit: () => void
  skin: SkinId
}
```

---

## Plan de implementación

1. **Crear `lib/touch.ts`.** Tipos, `TOUCH_MAPPINGS` según la tabla y `dispatchKey(type: 'keydown' | 'keyup', b: KeyBinding)`. El helper hace `window.dispatchEvent(new KeyboardEvent(type, { key, code, bubbles: true, cancelable: true }))`. Test: `npm run build` sin errores de tipo.

2. **Crear `lib/useTouchMobile.ts`.** `useIsTouchMobile()` y `useIsLandscape()` con `useSyncExternalStore`: se suscriben a `matchMedia(...).addEventListener('change')` y el snapshot de servidor devuelve `false`. Test: en DevTools con emulación de iPhone el hook devuelve `true`; en escritorio, `false`.

3. **Crear `components/TouchControls.tsx` (sin estilos finales).**
   - Cruceta 3×3 con ↑ ↓ ← → y botones circulares B (izquierda) y A (derecha), como en la referencia.
   - Cada botón usa Pointer Events: `pointerdown` → `setPointerCapture` + `dispatchKey('keydown')` + vibración; `pointerup`/`pointercancel`/`lostpointercapture` → `dispatchKey('keyup')`.
   - Si el binding tiene `repeat: true`, mientras está pulsado re-emite `keydown` tras `REPEAT_DELAY` y luego cada `REPEAT_INTERVAL`.
   - Botón sin binding: `disabled`, `aria-disabled`, opacidad reducida, no emite nada.
   - Estado pulsado vía clase `.is-pressed` mientras dura el puntero.
   - Pie: botón `PAUSA`/`REANUDAR` (`onTogglePause`), `<select>` con `SKINS` de `lib/skins` que llama a `writeSkin(id)`, botón `← SALIR` (`onExit`).
   - Cleanup: al desmontar y en `visibilitychange` a `hidden`, emitir `keyup` de todos los botones pulsados y limpiar timers de repeat.
   - Test: montar el componente en Snake temporalmente y ver en consola los `keydown`/`keyup`.

4. **Estilos en `app/globals.css` usando `/frontend-design`.** Gamepad oscuro coherente con la estética del Vault (referencia de la captura). Cruceta con teclas cuadradas redondeadas, A roja y B azul circulares, pie con botones `.btn` existentes. Tamaño mínimo táctil de 56×56 px por botón. `touch-action: none`, `user-select: none`, `-webkit-user-select: none` y `-webkit-touch-callout: none` en el control y en el canvas. Respetar `env(safe-area-inset-bottom)`. Todo dentro de `@media (pointer: coarse) and (max-width: 900px)`. Test: el control se ve como la referencia en emulación 390×844.

5. **Ocultar el Nav en juegos móviles.** En `app/page.tsx`, añadir `data-game-route` a `#root` cuando `route.name` ∈ `['asteroids', 'tetris', 'arkanoid', 'snake']`. En CSS, bajo la media query móvil: `#root[data-game-route] .av-nav { display: none }`. Test: en emulación móvil el Nav desaparece al entrar a un juego y vuelve al salir; en escritorio no cambia.

6. **Layout vertical común.** Clase contenedora `.game-mobile` aplicada por cada screen cuando `useIsTouchMobile()` es `true`. Columna flex de `100dvh`: HUD compacto arriba, canvas en el centro (mantiene su `aspect-ratio`, ancho máx. 100 %, alto máx. el sobrante) y `TouchControls` abajo. En móvil se ocultan los `.hud-actions` del HUD superior (PAUSA y SALIR pasan al pie). Test: sin scroll vertical en 390×844 ni en 360×740.

7. **Integrar en Snake.** Renderizar `<TouchControls mapping={TOUCH_MAPPINGS.snake} … />`. `onTogglePause` reutiliza la lógica del botón PAUSA actual. `onExit` hace lo mismo que el SALIR actual. Test: las 4 flechas cambian la dirección; A/B aparecen atenuados.

8. **Integrar en Asteroids.** Mismo patrón con `TOUCH_MAPPINGS.asteroids`. Test: mantener ← gira de forma continua; mantener ↑ empuja; A dispara (un disparo por toque, respetando `justPressedRef`); ↓ y B atenuados.

9. **Integrar en Arkanoid.** Mismo patrón con `TOUCH_MAPPINGS.arkanoid`. Test: mantener ←/→ mueve la paleta de forma continua; el menú de pausa dibujado en canvas responde a toques (eventos `click`).

10. **Integrar en Tetris.** Mismo patrón con `TOUCH_MAPPINGS.tetris`. En móvil, el panel lateral (puntuación, líneas, nivel, siguiente pieza) pasa a una fila compacta encima del tablero, y el tablero 1:2 ajusta su alto al espacio disponible. Test: mantener ← desplaza la pieza con auto-repeat; ↑ y A rotan; B hace caída instantánea; ↓ mantenido baja la pieza de forma continua.

11. **Orientación horizontal.** En `TouchControls`, cuando `useIsLandscape()` es `true`: overlay `.touch-rotate` a pantalla completa con el texto "GIRA EL DISPOSITIVO" e icono. Si la partida no está en pausa, llamar a `onTogglePause()` una vez al entrar en horizontal. Al volver a vertical, el overlay desaparece y la partida sigue pausada hasta que el usuario pulsa REANUDAR. Test: rotar la emulación pausa el juego y muestra el aviso.

---

## Criterios de aceptación

- [ ] En escritorio (ratón, > 900 px) los 4 juegos se ven y se juegan exactamente igual que antes.
- [ ] En emulación móvil (DevTools, iPhone 12 / Pixel 7, vertical) cada juego muestra HUD + canvas arriba y el gamepad abajo, sin scroll de página.
- [ ] En emulación móvil el Nav del sitio no aparece en ninguna ruta de juego y sí en el resto de rutas.
- [ ] El gamepad tiene la misma disposición en los 4 juegos: cruceta a la izquierda, B y A a la derecha, pie con PAUSA, selector de skin y SALIR.
- [ ] Los botones sin función en un juego se ven atenuados y no emiten eventos.
- [ ] Snake: ↑ ↓ ← → cambian la dirección de la serpiente.
- [ ] Asteroids: mantener ←/→ gira, mantener ↑ empuja, A dispara.
- [ ] Arkanoid: mantener ←/→ mueve la paleta de forma continua.
- [ ] Tetris: ←/→/↓ mantenidos repiten el movimiento; ↑ y A rotan; B hace caída instantánea.
- [ ] Soltar el dedo fuera del botón (arrastrándolo) detiene la acción (no quedan teclas "pegadas").
- [ ] Cambiar de pestaña con un botón pulsado no deja la tecla pegada al volver.
- [ ] El botón pulsado muestra un estado visual distinto mientras se mantiene.
- [ ] En un navegador con `navigator.vibrate` (Android Chrome) el teléfono vibra al pulsar; en iOS no hay error.
- [ ] PAUSA en el pie pausa el juego y cambia a REANUDAR; REANUDAR lo reanuda.
- [ ] El selector de skin del pie cambia el skin del juego en curso sin reiniciar la partida y el cambio persiste al recargar.
- [ ] SALIR del pie navega al mismo destino que el SALIR de escritorio de cada juego.
- [ ] Girar a horizontal muestra "GIRA EL DISPOSITIVO" y pausa la partida; volver a vertical oculta el aviso y la partida sigue en pausa.
- [ ] Tocar repetidamente el gamepad no provoca zoom, selección de texto ni menú contextual.
- [ ] El modal de game over sigue funcionando en móvil: el input acepta nombre (máx. 10, mayúsculas) y guarda la puntuación.
- [ ] `npm run build` y `npm run lint` pasan sin errores.
- [ ] No hay errores ni warnings de hidratación en consola al cargar un juego en móvil ni en escritorio.

---

## Decisiones

- **Sí:** eventos de teclado sintéticos (`KeyboardEvent` en `window`). Los juegos no cambian su lógica de input, y el mismo control servirá para futuros juegos basados en teclado.
- **No:** API de input por juego (callbacks). Obliga a refactorizar los 4 juegos; queda para otro spec si hiciera falta.
- **Sí:** emitir `key` y `code` a la vez. Asteroids y Tetris leen `e.code`; Arkanoid y Snake leen `e.key`.
- **Sí:** detección `(pointer: coarse) and (max-width: 900px)`. Solo afecta a móviles; las laptops táctiles y el escritorio con ventana estrecha no cambian.
- **No:** detección solo por ancho. Mostraría el gamepad a usuarios de ratón.
- **Sí:** hold real con Pointer Events y `setPointerCapture`. Asteroids y Arkanoid necesitan acciones continuas.
- **Sí:** auto-repeat solo en Tetris. Su handler es discreto (un movimiento por `keydown`); en el resto el hold basta.
- **Sí:** mismo diseño en todos los juegos y botones sin uso atenuados (no ocultos). La consistencia visual era un requisito del usuario.
- **Sí:** mapeo A/B: Asteroids A=disparar; Tetris A=rotar, B=caída instantánea. Arkanoid y Snake solo flechas. Aprobado por el usuario.
- **Sí:** el pie lleva PAUSA, selector de skin y SALIR, como en la referencia. En móvil se ocultan los botones del HUD superior para no duplicarlos.
- **Sí:** solo vertical, con overlay y pausa automática en horizontal. Un layout horizontal es otro diseño completo.
- **Sí:** ocultar el Nav en rutas de juego en móvil para dar todo el alto al juego. SALIR es la forma de volver.
- **Sí (añadido en implementación):** ocultar también el footer global (`.av-footer`) en rutas de juego en móvil; sin ello el layout tendría scroll vertical.
- **Sí (añadido en implementación):** migrar la carga de `av_user` en `app/page.tsx` a `useSyncExternalStore` (`lib/userStore.ts`) para eliminar el error de lint `set-state-in-effect` que ya existía.
- **Sí:** vibración (`navigator.vibrate(10)`) y estado visual pulsado como feedback.
- **No:** gestos sobre el canvas. Añaden ambigüedad con los toques del menú de pausa de Arkanoid.
- **No:** actualizar `/add-game` ni las convenciones de `CLAUDE.md` en este spec. El usuario lo dejó para un requerimiento posterior.

---

## Riesgos

| Riesgo                                                                           | Mitigación                                                                                                      |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Tecla "pegada" si se pierde el `pointerup` (dedo sale del botón, cambio de app). | `setPointerCapture` + `pointercancel`/`lostpointercapture` + liberar todo en `visibilitychange` y al desmontar. |
| Hidratación: el layout depende de `matchMedia`, que no existe en servidor.       | `useSyncExternalStore` con snapshot de servidor `false`; el layout móvil se activa tras hidratar.               |
| Multitouch: mantener ← y pulsar A a la vez (Asteroids).                          | Cada botón gestiona su propio `pointerId`; no se usa un único estado global de puntero.                         |
| La barra de direcciones de iOS/Android cambia el alto visible.                   | Usar `100dvh` en lugar de `100vh` en el contenedor móvil.                                                       |
| El teclado virtual del modal de game over empuja el layout.                      | El modal es overlay; se verifica en el criterio de aceptación del modal.                                        |
| `KeyboardEvent` sintéticos tienen `isTrusted = false`.                           | Ningún handler actual comprueba `isTrusted`; se verifica en cada paso de integración.                           |
| El menú de pausa de Arkanoid está dibujado en canvas y depende de `click`.       | Los toques generan `click`; verificado en el paso 9.                                                            |

---

## Lo que **no** está en este spec

- Integración del control en juegos nuevos ni cambios en `/add-game` o `CLAUDE.md`.
- Layout horizontal jugable.
- Gestos táctiles sobre el canvas.
- Refactor de la entrada de los juegos a una API propia.
- Botones personalizables o reubicables.
- Fullscreen API y bloqueo de orientación.
- Tablets grandes y laptops táctiles.
- Sonido.

Cada uno de estos puntos, si llega, irá en su propio spec.
