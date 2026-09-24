# SPEC 08 — Juego Arkanoid

> **Status:** Aprobado
> **Depends on:** SPEC 06
> **Date:** 2026-09-24
> **Objetivo:** Portar el Arkanoid de `references/started-games/04-arkanoid/` a un componente React con canvas 800×600, HUD en React, overlay de pausa con selector de nivel dibujado en canvas, modal unificado de game over/victoria que guarda en Supabase, y ruta propia `'arkanoid'` en el sistema de navegación.

---

## Scope

**In:**

- `lib/types.ts`: añadir `'arkanoid'` al union `RouteName`.
- `components/screens/ArkanoidScreen.tsx`: nuevo componente que traduce `game.js` y `levels.js` a TypeScript/React; canvas 800×600 lógico escalado por CSS, gráficos con canvas primitivas (sin spritesheet), HUD en React superpuesto, overlay de pausa dibujado en canvas con selector de nivel 1–5, modal React unificado para game over y victoria; props `{ navigate, user, onSaveScore }`; cleanup de RAF, listeners de teclado, ratón y click.
- `app/globals.css`: clase `.cover-arkanoid` con gradientes CSS + pseudo-elementos `::before/::after`, paleta `magenta`.
- `app/page.tsx`: importar `ArkanoidScreen`; añadir `else if (route.name === 'arkanoid')` al switch de rutas.
- Supabase tabla `games`: INSERT de la fila de Arkanoid vía `mcp__supabase__apply_migration` con `play_route = 'arkanoid'`.

**Fuera de scope (para specs posteriores):**

- Controles táctiles / mobile.
- Efectos de sonido (los archivos `.mp3` existen en la referencia; spec posterior si se desea).
- Multijugador.
- Sprites del spritesheet (`assets/spritesheet-breakout.png`) — descartados en favor de canvas primitivas.
- Animaciones de explosión al romper bloques (dependen del spritesheet; spec posterior con partículas CSS si se desea).
- Bloques con múltiples vidas (todos los bloques mueren en un golpe, como en la referencia).
- Power-ups (no existen en la referencia).
- Tabla de puntuaciones en tiempo real (Supabase Realtime) — spec posterior.

---

## Data model

### Fila en tabla `games`

```ts
{
  id: 'arkanoid',
  title: 'ARKANOID',
  short: 'Rompe bloques con la pelota sin dejarla caer al vacío.',
  long: 'Tu paleta rebota la pelota contra los bloques de colores que llenan la pantalla. Destruye filas enteras para avanzar por los cinco niveles mientras la bola gana velocidad en cada etapa. Tres vidas te separan del game over — pero completar los cinco niveles es la victoria definitiva.',
  cat: 'ARCADE',
  cover: 'cover-arkanoid',
  color: 'magenta',
  best: 0,
  plays: '0',
  playRoute: 'arkanoid',
}
```

### SQL equivalente (para la migración)

```sql
INSERT INTO public.games (id, title, short, long, cat, cover, color, best, plays, play_route)
VALUES (
  'arkanoid',
  'ARKANOID',
  'Rompe bloques con la pelota sin dejarla caer al vacío.',
  'Tu paleta rebota la pelota contra los bloques de colores que llenan la pantalla. Destruye filas enteras para avanzar por los cinco niveles mientras la bola gana velocidad en cada etapa. Tres vidas te separan del game over — pero completar los cinco niveles es la victoria definitiva.',
  'ARCADE',
  'cover-arkanoid',
  'magenta',
  0,
  '0',
  'arkanoid'
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
```

No se añaden nuevas interfaces: `Game` ya tiene `playRoute?: RouteName` desde SPEC 05.

---

## Plan de implementación

1. **Actualizar `lib/types.ts`:** añadir `'arkanoid'` al union `RouteName`. Test: `npm run build` sin errores de tipo.

2. **Crear `components/screens/ArkanoidScreen.tsx`:** traducción completa de `references/started-games/04-arkanoid/game.js` y `levels.js` a TypeScript/React. Puntos clave:
   - **Canvas 800×600:** `<canvas ref={boardRef} width={800} height={600}>` en contenedor con `width: 100%; max-width: 800px; aspect-ratio: 800/600`. Coordenadas lógicas 800×600 fijas; CSS escala la visualización. Patrón AsteroidsScreen sin desviación.
   - **Niveles como constante TypeScript:** transcribir el array `LEVELS` de `levels.js` al inicio del archivo (`{ speed: number; blocks: { col: number; row: number; color: string }[] }[]`). Sin módulo separado: ~30 líneas de datos estáticos no justifican un archivo propio.
   - **Gráficos con canvas primitivas:** bloques como `fillRect` con los colores de `BLOCK_COLORS`; paddle como `fillRect` redondeado; pelota como `arc`. Sin `drawImage` ni spritesheet.
   - **Game loop:** `requestAnimationFrame` en `useEffect`; patrón AsteroidsScreen — el loop nunca se detiene, `pausedRef.current` y `gs.state !== 'playing'` gatan `update(dt)`. Cleanup con `cancelAnimationFrame`.
   - **Física:** `update(dt)` mueve paddle por teclado, mueve pelota, procesa rebotes en paredes izq/der/techo, rebote en paddle (con corrección de posición para evitar túneles), colisiones AABB con bloques activos (un bloque por frame, score += 10). Al destruir todos los bloques: `currentLevel < 5` → `loadLevel(currentLevel + 1)`, de lo contrario `gs.state = 'win'`. Al caer la pelota: `lives--`; si `lives <= 0` → `gs.state = 'gameover'`; si no → `initBall()`.
   - **Teclado:** `keydown/keyup` en `window` para `ArrowLeft/Right` (mover paddle a `PADDLE_SPEED * dt`); `keydown` para `P`/`Escape` (toggle `pausedRef`). Cleanup con `removeEventListener`.
   - **Ratón:** listener `mousemove` en el elemento canvas; escalar con `(e.clientX - rect.left) * (800 / rect.width)` para obtener la coordenada lógica. Cleanup con `removeEventListener`.
   - **Overlay de pausa en canvas:** dentro de `draw()`, si `pausedRef.current`, dibujar overlay semitransparente + texto "PAUSA" + 5 botones numerados 1–5 centrados. Listener `canvas.click` (escalando coords igual que `mousemove`) procesa la selección de nivel solo si `pausedRef.current === true`. Al seleccionar nivel `n`: `loadLevel(n)`, `pausedRef.current = false`, `setPaused(false)`. Cleanup del listener en `useEffect`.
   - **Estado → React:** `setScore`, `setLives`, `setLevel` solo cuando el valor cambia. `gs.state === 'gameover' | 'win'` activa el modal vía `setOver('gameover' | 'win')`.
   - **HUD React:** `<div>` con `position: absolute` sobre el canvas; muestra score, nivel y vidas (iconos de pelota `●` repetidos). Botón PAUSA → toggle `pausedRef`; botón SALIR → `navigate({ name: 'detalle', id: 'arkanoid' })`.
   - **Modal React unificado para game over y win:** patrón AsteroidsScreen. Título dinámico: `GAME OVER` si `over === 'gameover'`, `¡COMPLETASTE EL JUEGO!` si `over === 'win'`. Input de nombre (máx. 10 chars, mayúsculas) pre-rellenado con `user?.name ?? 'INVITADO'`; botón "GUARDAR PUNTUACIÓN" → `onSaveScore({ game: 'arkanoid', score, name, at: Date.now() })`; botón "JUGAR DE NUEVO" → `restartGame()`; botón "VOLVER AL VAULT" → `navigate({ name: 'games' })`.
   - **Props:** `{ navigate: (r: Route) => void; user: User | null; onSaveScore: (entry: SavedScore) => void }`.
   - Test: navegar a `'arkanoid'` renderiza canvas con paddle, pelota y bloques; `ArrowLeft/Right` mueven el paddle; `mousemove` mueve el paddle; la pelota rebota; destruir bloque suma 10 pts; completar nivel avanza al siguiente; `P` muestra overlay con botones 1–5; click en botón 3 carga nivel 3; 3 vidas agotadas muestra modal de game over; nivel 5 completado muestra modal de victoria; guardar inserta en Supabase.

3. **Añadir `.cover-arkanoid` en `app/globals.css`:** diseño CSS puro — fondo oscuro con tono magenta oscuro, `::before` dibuja la pelota (círculo) y el paddle (rectángulo redondeado) con `border-radius` o `clip-path` en `var(--magenta)`, `::after` simula 2–3 filas de bloques de colores usando gradientes lineales repetidos (`background-image`, `background-size`). Test: la card de Arkanoid en Library muestra cover visible y coherente con las demás.

4. **Registrar la ruta en `app/page.tsx`:** importar `ArkanoidScreen` desde `@/components/screens/ArkanoidScreen`; añadir:

   ```tsx
   } else if (route.name === 'arkanoid') {
     screen = <ArkanoidScreen navigate={navigate} user={user} onSaveScore={handleSaveScore} />
   }
   ```

   Test: `npm run dev` arranca sin errores de consola.

5. **Insertar fila en tabla `games` vía MCP:** ejecutar `mcp__supabase__apply_migration` con nombre `009_add_arkanoid_game` y el SQL del Data model. **No crear archivo SQL local.** Test: la tabla `games` tiene la nueva fila con `play_route = 'arkanoid'`; la Library carga y muestra la card "ARKANOID".

---

## Acceptance criteria

- [ ] `RouteName` incluye `'arkanoid'`.
- [ ] La Library muestra la card "ARKANOID" con cover `.cover-arkanoid` visible.
- [ ] Hacer clic en la card navega a GameDetail de Arkanoid.
- [ ] El botón "JUGAR AHORA" en GameDetail de Arkanoid navega a la ruta `'arkanoid'`.
- [ ] El botón "JUGAR AHORA" en cualquier otro juego sigue navegando correctamente.
- [ ] La ruta `'arkanoid'` renderiza el canvas 800×600 con paddle, pelota y bloques del nivel 1.
- [ ] El canvas se escala al viewport sin distorsión (aspecto 800/600).
- [ ] `ArrowLeft` / `ArrowRight` mueven el paddle horizontalmente.
- [ ] `mousemove` sobre el canvas posiciona el paddle de forma directa y responsiva.
- [ ] La pelota rebota en las paredes izquierda, derecha y techo.
- [ ] La pelota rebota en el paddle.
- [ ] Destruir un bloque suma 10 puntos al score visible en el HUD.
- [ ] Al destruir todos los bloques del nivel actual, se carga el nivel siguiente.
- [ ] Al completar el nivel 5, se muestra el modal de victoria (`¡COMPLETASTE EL JUEGO!`).
- [ ] La velocidad de la pelota es notablemente mayor en el nivel 5 que en el nivel 1.
- [ ] Al perder una vida (pelota cae), la pelota se reposiciona sobre el paddle.
- [ ] Al agotar las 3 vidas, se muestra el modal de game over.
- [ ] `P` / `Escape` pausa el juego y muestra el overlay de pausa con botones de nivel 1–5.
- [ ] Hacer click en un botón 1–5 del overlay de pausa carga ese nivel y reanuda la partida.
- [ ] El HUD muestra score, nivel y vidas actualizados en tiempo real.
- [ ] El modal de game over o victoria muestra el input de nombre (máx. 10 chars, mayúsculas).
- [ ] "GUARDAR PUNTUACIÓN" inserta una fila en la tabla `scores` de Supabase.
- [ ] El score aparece en la pestaña "ARKANOID" del Salón de la Fama.
- [ ] "JUGAR DE NUEVO" reinicia la partida desde el nivel 1 sin recargar la página.
- [ ] "VOLVER AL VAULT" navega a `{ name: 'games' }`.
- [ ] El botón SALIR del HUD navega a `{ name: 'detalle', id: 'arkanoid' }`.
- [ ] `npm run build` termina sin errores de TypeScript ni de compilación.
- [ ] No hay errores de consola al navegar por todas las pantallas existentes.

---

## Decisiones

- **Canvas primitivas, no spritesheet:** el spritesheet original (`assets/spritesheet-breakout.png`) se descartó para mantener coherencia con AsteroidsScreen y TetrisScreen, que dibujan todo con primitivas de canvas. Incluir un asset estático PNG habría roto el patrón de cero-assets-externos del stack.
- **Canvas 800×600 (landscape):** Arkanoid es un juego horizontal; la referencia usa 800×600. Se respeta la convención del proyecto sin desviación (a diferencia de TetrisScreen, que sí se desvía a portrait 300×600).
- **Modal unificado para game over y win:** un solo componente React con título dinámico simplifica el código y asegura que los scores se guarden en ambos estados terminales. La referencia usaba overlays separados dibujados en canvas.
- **Overlay de pausa en canvas:** el selector de niveles se dibuja directamente en canvas (siguiendo la referencia), con un `canvas.click` que escala coordenadas. Alternativa descartada: React overlay — requeriría un tercer sistema de coordenadas y complicaría la integración con la escala del canvas.
- **`LEVELS` como constante en el mismo archivo:** en lugar de un módulo `levels.ts` separado, el array se transcribe al inicio de `ArkanoidScreen.tsx`. No se justifica un módulo para ~30 líneas de datos estáticos.
- **Color `magenta`:** `cyan` y `yellow` ya asignados a Tetris y Asteroids respectivamente. `magenta` es coherente con la paleta vibrante de los bloques y no colisiona con ningún juego existente.

---

## Riesgos

| Riesgo                                                                                    | Mitigación                                                                                                                    |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `setState` desde el game loop causa renders excesivos                                     | Comparar el valor nuevo con el anterior antes de llamar al setter; solo actualizar cuando cambia                              |
| Coordenadas del mouse erróneas con canvas escalado                                        | Escalar siempre con `(e.clientX - rect.left) * (800 / rect.width)` tanto en `mousemove` como en `canvas.click`                |
| El listener `canvas.click` del selector de niveles procesa clicks durante el juego activo | Guard: `if (!pausedRef.current) return` al inicio del handler del click                                                       |
| Túnel de pelota a velocidades altas (nivel 5 ×1.46)                                       | Limitar `dt` a un máximo de 50 ms en el loop (como TetrisScreen); si persiste, considerar subdivisión de pasos en el `update` |
