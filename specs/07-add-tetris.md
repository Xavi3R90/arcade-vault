# SPEC 07 — Juego Tetris

> **Status:** Aprobado
> **Depends on:** SPEC 06
> **Date:** 2026-09-24
> **Objetivo:** Portar el Tetris de `references/started-games/03-tetris/` a un componente React con canvas portrait 300×600, HUD lateral en React, modal de game over que guarda en Supabase, y ruta propia `'tetris'` en el sistema de navegación.

---

## Scope

**In:**

- `lib/types.ts`: añadir `'tetris'` al union `RouteName`.
- `components/screens/TetrisScreen.tsx`: nuevo componente que traduce `game.js` a TypeScript/React; canvas 300×600 lógico (tablero 10×20 @ 30 px/celda), HUD lateral en React con score/líneas/nivel/preview siguiente pieza, modal de game over; props `{ navigate, user, onSaveScore }`; cleanup de RAF y listeners.
- `app/globals.css`: clase `.cover-tetris` con gradientes CSS + pseudo-elementos `::before/::after`, paleta `cyan`.
- `app/page.tsx`: importar `TetrisScreen`; añadir `else if (route.name === 'tetris')` al switch de rutas.
- Supabase tabla `games`: INSERT de la fila de Tetris vía `mcp__supabase__apply_migration` con `play_route = 'tetris'`.

**Out of scope:**

- Controles táctiles / mobile — spec posterior.
- Sonido — no existe en la referencia; spec posterior si se desea.
- Multijugador — spec posterior.
- Pieza-N (tuerca, 8ª pieza no canónica de la referencia) — puede añadirse como variante en un spec posterior.
- Sistema SRS completo de wall kicks — la referencia usa `[0, ±1, ±2]`; suficiente para este spec.
- Tabla de puntuaciones top en tiempo real (Supabase Realtime) — spec posterior.
- Persistencia de partida en curso al cerrar pestaña.

---

## Data model

### Fila en tabla `games`

```ts
{
  id: 'tetris',
  title: 'TETRIS',
  short: 'Encaja piezas y elimina líneas antes de que el tablero se llene.',
  long: 'Siete piezas geométricas caen desde la cima de un tablero de diez columnas; tú decides cuándo girarlas y dónde aterrizan. Completa filas horizontales para eliminarlas y acumular puntos: borrar cuatro líneas a la vez es un Tetris y da la mayor recompensa. El ritmo se acelera con cada nivel — ¿hasta dónde aguanta tu tablero?',
  cat: 'PUZZLE',
  cover: 'cover-tetris',
  color: 'cyan',
  best: 0,
  plays: '0',
  playRoute: 'tetris',
}
```

### SQL equivalente (para la migración)

```sql
INSERT INTO public.games (id, title, short, long, cat, cover, color, best, plays, play_route)
VALUES (
  'tetris',
  'TETRIS',
  'Encaja piezas y elimina líneas antes de que el tablero se llene.',
  'Siete piezas geométricas caen desde la cima de un tablero de diez columnas; tú decides cuándo girarlas y dónde aterrizan. Completa filas horizontales para eliminarlas y acumular puntos: borrar cuatro líneas a la vez es un Tetris y da la mayor recompensa. El ritmo se acelera con cada nivel — ¿hasta dónde aguanta tu tablero?',
  'PUZZLE',
  'cover-tetris',
  'cyan',
  0,
  '0',
  'tetris'
);
```

### Cambios en TypeScript

`RouteName` en `lib/types.ts`:

```ts
export type RouteName =
  'home' | 'games' | 'detalle' | 'player' | 'auth' | 'salon' | 'about' | 'asteroids' | 'tetris'
```

No se añaden nuevas interfaces: `Game` ya tiene `playRoute?: RouteName` desde SPEC 05.

---

## Implementation plan

1. **Actualizar `lib/types.ts`:** añadir `'tetris'` al union `RouteName`. Test: `npm run build` reporta errores en los componentes que aún no usan la ruta — estado esperado antes del paso siguiente.

2. **Crear `components/screens/TetrisScreen.tsx`:** traducción completa de `references/started-games/03-tetris/game.js` a TypeScript/React. Puntos clave:
   - **Canvas portrait:** `<canvas ref={boardRef} width={300} height={600}>` envuelto en un contenedor con `aspect-ratio: 10/20; max-height: 600px; height: 80vh`. Canvas lógico fijo 300×600; el CSS escala la visualización. _Nota: canvas portrait 300×600, no 800×600 — Tetris es un juego retrato._
   - **Segundo canvas (preview):** `<canvas ref={nextRef} width={120} height={120}>` renderizado en el HUD lateral para la vista previa de la siguiente pieza. Referencia independiente, cleanup incluido.
   - **Clases del juego:** funciones puras `collide`, `rotateCW`, `tryRotate`, `clearLines`, `ghostY` traducidas a TypeScript dentro del archivo; reciben los parámetros explícitamente en lugar de cerrar sobre globales.
   - **Piezas:** solo las 7 piezas estándar (I, O, T, S, Z, J, L). La pieza-N de la referencia se elimina.
   - **Game loop:** `requestAnimationFrame` iniciado en `useEffect`; `dropAccum` acumula el delta de tiempo; la pieza cae cuando `dropAccum >= dropInterval`. Cleanup con `cancelAnimationFrame`.
   - **Teclado:** listeners `keydown` registrados en `useEffect` sobre `window`; cleanup con `removeEventListener`. Mapeo: `ArrowLeft/Right` mover, `ArrowUp/X` rotar CW (wall kicks `[0,±1,±2]`), `ArrowDown` soft drop (+1 pto/fila), `Space` hard drop (+2 ptos/celda), `P` pausar/reanudar.
   - **Estado → React:** `setScore`, `setLines`, `setLevel` se llaman solo cuando el valor cambia. El estado `gameOver` activa el modal.
   - **HUD lateral React:** `<div>` a la derecha del canvas (no overlay) con score, líneas, nivel y el canvas de preview de la siguiente pieza. Botones PAUSA y SALIR → `navigate({ name: 'detalle', id: 'tetris' })`.
   - **Pausa:** ref `pausedRef` detiene la actualización del loop; un overlay semitransparente cubre el canvas.
   - **Modal de game over React:** patrón AsteroidsScreen — input de nombre (máx. 10 chars, mayúsculas) pre-rellenado con `user?.name ?? 'INVITADO'`, botón "GUARDAR PUNTUACIÓN" → `onSaveScore({ game: 'tetris', score, name, at: Date.now() })`, botón "JUGAR DE NUEVO" reinicia `initGame()`, botón "VOLVER AL VAULT" → `navigate({ name: 'games' })`.
   - **Props:** `{ navigate: (r: Route) => void; user: User | null; onSaveScore: (entry: SavedScore) => void }`.
   - Test: navegar a `'tetris'` renderiza el tablero vacío con las piezas cayendo; ArrowLeft/Right mueven la pieza; ArrowUp rota; Space hace hard drop; P pausa; perder muestra el modal; guardar inserta en Supabase.

3. **Añadir `.cover-tetris` en `app/globals.css`:** diseño CSS puro inspirado en las piezas del Tetris — fondo oscuro con tonos cyan, `::before` con una pieza-L o pieza-I dibujada con `clip-path` o `box-shadow` en `var(--cyan)`, `::after` con bloques adicionales simulando un tablero parcialmente lleno. Test: la card de Tetris en Library muestra cover visible y coherente con las demás.

4. **Registrar la ruta en `app/page.tsx`:** importar `TetrisScreen` desde `@/components/screens/TetrisScreen`; añadir:

   ```tsx
   } else if (route.name === 'tetris') {
     screen = <TetrisScreen navigate={navigate} user={user} onSaveScore={handleSaveScore} />
   }
   ```

   Test: `npm run dev` arranca sin errores de consola.

5. **Insertar fila en tabla `games` vía MCP:** ejecutar `mcp__supabase__apply_migration` con nombre `008_add_tetris_game` y el SQL del Data model. **No crear archivo SQL local.** Test: la tabla `games` tiene la nueva fila con `play_route = 'tetris'`; la Library carga y muestra la card "TETRIS".

---

## Acceptance criteria

- [ ] `RouteName` incluye `'tetris'`.
- [ ] La Library muestra la card "TETRIS" con cover `.cover-tetris` visible.
- [ ] Hacer clic en la card navega a GameDetail de Tetris.
- [ ] El botón "JUGAR AHORA" en GameDetail de Tetris navega a la ruta `'tetris'`.
- [ ] El botón "JUGAR AHORA" en cualquier otro juego sigue navegando correctamente.
- [ ] La ruta `'tetris'` renderiza el canvas con el tablero vacío y una pieza cayendo.
- [ ] El canvas se escala al viewport sin distorsión (portrait, proporción 1:2).
- [ ] `ArrowLeft` / `ArrowRight` mueven la pieza horizontalmente.
- [ ] `ArrowUp` / `X` rotan la pieza en sentido horario; los wall kicks permiten rotar pegada a la pared.
- [ ] `ArrowDown` acelera la caída y suma 1 pto por fila.
- [ ] `Space` hace hard drop instantáneo y suma 2 ptos por celda recorrida.
- [ ] `P` pausa el juego y muestra overlay de pausa; vuelve a `P` para reanudar.
- [ ] Completar 1/2/3/4 líneas simultáneas suma 100/300/500/800 × nivel respectivamente.
- [ ] El nivel sube cada 10 líneas y la velocidad de caída aumenta.
- [ ] El HUD lateral muestra score, líneas, nivel y preview de la siguiente pieza actualizados en tiempo real.
- [ ] La ghost piece muestra dónde aterrizará la pieza actual.
- [ ] El tablero lleno (spawn colisiona) muestra el modal de game over con la puntuación final.
- [ ] El input de nombre en el modal acepta hasta 10 caracteres en mayúsculas.
- [ ] "GUARDAR PUNTUACIÓN" inserta una fila en la tabla `scores` de Supabase.
- [ ] El score aparece en la pestaña "TETRIS" del Salón de la Fama.
- [ ] "JUGAR DE NUEVO" reinicia la partida sin recargar la página.
- [ ] "VOLVER AL VAULT" navega a `{ name: 'games' }`.
- [ ] El botón SALIR del HUD navega a `{ name: 'detalle', id: 'tetris' }`.
- [ ] `npm run build` termina sin errores de TypeScript ni de compilación.
- [ ] No hay errores de consola al navegar por todas las pantallas existentes.

---

## Decisiones

- **Canvas 300×600 (portrait) en lugar de 800×600:** Tetris es un juego retrato; el tablero es 10 cols × 20 filas × 30 px/celda = 300×600. Forzar 800×600 obligaría a redimensionar la cuadrícula y romper las proporciones visuales. Se documenta como desviación deliberada del patrón de AsteroidsScreen.
- **HUD lateral, no overlay:** el tablero de Tetris tiene solo 300 px de ancho; superponer el HUD con `position: absolute` oscurecería las piezas. Se usa un panel lateral a la derecha del canvas, coherente con el diseño original de la referencia.
- **Pieza-N (tuerca) descartada:** la referencia incluye una 8ª pieza no canónica. Se eliminó para mantener el Tetris reconocible. Puede añadirse como variante en un spec posterior.
- **Wall kicks básicos `[0, ±1, ±2]`:** la referencia no implementa el sistema SRS completo; se conserva su lógica simple. El comportamiento cubre el 95 % de los casos; se documenta como limitación conocida.
- **Segundo canvas para preview:** el canvas de preview de la siguiente pieza se gestiona con un segundo `ref` de React y se limpia en el mismo `useEffect` que el canvas principal. Alternativa descartada: dibujar el preview en el canvas principal — complicaría el layout.
- **Color cyan:** coincide con la pieza-I icónica del Tetris y no colisiona con ningún otro juego del catálogo.
- **Plays y best = 0:** juego nuevo sin datos ficticios, coherente con la política de SPEC 06.

---

## Riesgos

| Riesgo                                                         | Mitigación                                                                                                                            |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `setState` desde el game loop causa renders excesivos          | Comparar el valor nuevo con el anterior antes de llamar al setter; solo actualizar cuando cambia                                      |
| El segundo canvas (next-preview) no se limpia al desmontar     | Incluirlo en el cleanup del mismo `useEffect`; el `cancelAnimationFrame` y los `removeEventListener` deben cubrir ambos refs          |
| Wall kicks incompletos bloquean piezas en situaciones extremas | Limitación conocida documentada; si ocurre, el usuario puede girar en la dirección opuesta. Solución completa (SRS) en spec posterior |
| El canvas portrait ocupa demasiado espacio vertical en móvil   | `max-height: 600px; height: 80vh` evita que desborde; los controles táctiles son fuera de scope y se añadirán en spec posterior       |
