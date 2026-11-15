# Juegos con soporte móvil

Registro de qué juegos de Arcade Vault se juegan en móviles táctiles en vertical con el gamepad virtual de SPEC 10. Lo mantiene el agente `mobile-porter`, que porta o revisa **un único juego por ejecución**, solo el que indica el usuario.

Última actualización: 2026-11-15.

---

## Estado

| Juego     | Slug      | Gamepad | Layout vertical | Horizontal (aviso + pausa) | Escritorio intacto | Mapeo (↑ · ↓ · ← · → · A · B)                                                    | Fecha      |
| --------- | --------- | ------- | --------------- | -------------------------- | ------------------ | -------------------------------------------------------------------------------- | ---------- |
| ARKANOID  | arkanoid  | ok      | ok              | ok                         | ok                 | — · — · ArrowLeft · ArrowRight · — · —                                           | 2026-11-11 |
| ASTEROIDS | asteroids | ok      | ok              | ok                         | ok                 | ArrowUp · — · ArrowLeft · ArrowRight · Space · —                                 | 2026-11-11 |
| SNAKE     | snake     | ok      | ok              | ok                         | ok                 | ArrowUp · ArrowDown · ArrowLeft · ArrowRight · — · —                             | 2026-11-11 |
| TETRIS    | tetris    | ok      | ok              | ok                         | ok                 | ArrowUp · ArrowDown (rep) · ArrowLeft (rep) · ArrowRight (rep) · ArrowUp · Space | 2026-11-11 |

Estados posibles: `pendiente` · `ok` · `falla`.

Un juego está **completo** cuando sus 4 columnas de estado están en `ok`.

Los estados iniciales corresponden a la implementación de SPEC 10 (2026-11-11); aún no se han revalidado con `mobile-porter`.

---

## Convención

Fuente de verdad: `specs/10-mobile-touch-controls.md`.

- **Detección:** `(pointer: coarse) and (max-width: 900px)` vía `useIsTouchMobile()` (`lib/useTouchMobile.ts`, `useSyncExternalStore`, servidor = `false`). Tablets grandes, laptops táctiles y escritorio no cambian.
- **Mapeo:** una entrada por juego en `TOUCH_MAPPINGS` (`lib/touch.ts`) y el slug en el union `TouchGameId`.
  - Botones: `up`, `down`, `left`, `right`, `a`, `b`. Botón sin función = ausente (atenuado y `disabled`, nunca oculto).
  - Se emiten `key` y `code` a la vez. Space = `{ key: ' ', code: 'Space' }`.
  - `repeat: true` solo para acciones discretas que se repiten manteniendo (`REPEAT_DELAY` 170 ms, `REPEAT_INTERVAL` 50 ms).
- **Ruta:** el slug va en `GAME_ROUTES` (`app/page.tsx`) para que `#root[data-game-route]` oculte `.av-nav` y `.av-footer` en móvil.
- **Screen:** `useIsTouchMobile()` → clase `game-mobile` en `.av-player`, canvas dentro de `.game-stage-area` > `.game-stage` sin remontarlo y `<TouchControls mapping paused onTogglePause onExit skin>` reutilizando PAUSA/SALIR existentes.
- **Estilos:** todo dentro de `@media (pointer: coarse) and (max-width: 900px)` en `app/globals.css`. Reglas propias de un juego como `.game-mobile .<slug>-*`.
- **Verificación** (Playwright):
  - Sin scroll vertical en 390×844 y 360×740.
  - Nav y footer ocultos en el juego; visibles en el resto de rutas.
  - Cada botón con binding emite `keydown` al pulsar y `keyup` al soltar o cancelar (sin teclas pegadas).
  - Horizontal: aviso "GIRA EL DISPOSITIVO" y pausa automática.
  - Escritorio 1280×800 idéntico al anterior.
  - Sin errores de hidratación en consola.

---

## Historial

<!-- mobile-porter añade aquí una línea por juego portado o revisado:
- AAAA-MM-DD — <slug>: gamepad/vertical/horizontal/escritorio ok · mapeo … · notas
-->

- 2026-11-11 — arkanoid, asteroids, snake, tetris: portados en SPEC 10 (`specs/10-mobile-touch-controls.md`).
