# SPEC 05 — Juego Asteroids

> **Status:** Aprobado
> **Depends on:** SPEC 01
> **Date:** 2026-09-22
> **Objective:** Adaptar el juego Asteroids de `references/started-games/02-asteroids/` a un componente React con canvas responsivo, HUD en React, modal de game over que guarda en `localStorage['av_scores']`, y ruta propia `'asteroids'` en el sistema de navegación.

---

## Scope

**In:**

- `lib/types.ts`: añadir `'asteroids'` al union `RouteName`; añadir campo opcional `playRoute?: RouteName` a la interfaz `Game`.
- `lib/data.ts`: añadir entrada `{ id: 'asteroids', ... , playRoute: 'asteroids' }` al array `GAMES`.
- `app/globals.css`: añadir clase `.cover-asteroids` para la cover art de la card en Library.
- `components/screens/GameDetail.tsx`: actualizar botón "▶ JUGAR AHORA" para que use `game.playRoute` si existe (`navigate({ name: game.playRoute })`), y conserve el comportamiento actual (`navigate({ name: 'player', id: game.id })`) si no.
- `app/page.tsx`: importar `AsteroidsScreen` y añadir `case 'asteroids'` → `<AsteroidsScreen navigate={navigate} user={user} onSaveScore={saveScore} />`.
- `components/screens/AsteroidsScreen.tsx`: nuevo componente que traduce `game.js` a TypeScript/React con canvas 800×600 responsivo, HUD en React, loop con `requestAnimationFrame` y cleanup, modal de game over.

**Out of scope:**

- El juego `'rocas'` (placeholder existente en GAMES) — spec independiente posterior.
- Controles táctiles / mobile — spec posterior.
- Tabla de scores de Asteroids en Supabase — spec posterior (auth + DB).
- Pausa con menú elaborado — la pausa detiene el loop; la UI de pausa es minimalista.
- Sonido — no existe en la referencia; fuera de este spec.
- Mover el HUD de otros juegos (GamePlayer mock) a React — fuera de este spec.

---

## Data model

Nueva entrada en `GAMES`:

```ts
{
  id: 'asteroids',
  title: 'ASTEROIDS',
  short: 'Destruye rocas en el vacío del espacio.',
  long: 'Tu nave triangular flota en gravedad cero. Dispara para dividir asteroides en fragmentos cada vez más pequeños mientras esquivas su órbita caótica. Recoge el power-up 3x para triplicar tus disparos.',
  cat: 'SHOOTER',
  cover: 'cover-asteroids',
  color: 'yellow',
  best: 41200,
  plays: '15.6K',
  playRoute: 'asteroids',
}
```

Campo nuevo en `Game`:

```ts
export interface Game {
  // ... campos existentes ...
  playRoute?: RouteName // si está presente, GameDetail navega aquí en lugar de 'player'
}
```

`RouteName` actualizado:

```ts
export type RouteName =
  'home' | 'games' | 'detalle' | 'player' | 'auth' | 'salon' | 'about' | 'asteroids'
```

Persistencia: `localStorage['av_scores']` con tipo `SavedScore[]` existente — sin cambios de esquema.

---

## Implementation plan

1. **Actualizar `lib/types.ts`:** añadir `'asteroids'` a `RouteName`; añadir `playRoute?: RouteName` a `Game`. Test: `npm run build` sin errores de tipo.

2. **Actualizar `lib/data.ts`:** añadir la entrada de Asteroids al array `GAMES` con todos los campos (ver Data model). Test: la Library muestra una nueva card "ASTEROIDS".

3. **Añadir `.cover-asteroids` a `app/globals.css`:** diseño de la cover en CSS — fondo negro, nave triangular y silueta de asteroide dibujados con `clip-path` o bordes, paleta amarilla. Test: la card de Asteroids en la Library tiene cover visible y coherente con las demás.

4. **Actualizar `components/screens/GameDetail.tsx`:** cambiar el `onClick` del botón "JUGAR AHORA" de `navigate({ name: 'player', id: game.id })` a `game.playRoute ? navigate({ name: game.playRoute }) : navigate({ name: 'player', id: game.id })`. Test: "JUGAR AHORA" en la ficha de Asteroids navega a la ruta `'asteroids'`; "JUGAR AHORA" en cualquier otro juego sigue navegando a `'player'`.

5. **Actualizar `app/page.tsx`:** importar `AsteroidsScreen` desde `@/components/screens/AsteroidsScreen`; añadir `case 'asteroids': return <AsteroidsScreen navigate={navigate} user={user} onSaveScore={saveScore} />;`. Test: `npm run dev` arranca sin errores de consola.

6. **Crear `components/screens/AsteroidsScreen.tsx`:** traducción completa de `references/started-games/02-asteroids/game.js` a TypeScript/React. Puntos clave de la adaptación:
   - **Canvas responsivo:** `<canvas ref={canvasRef} width={800} height={600}>` envuelto en un contenedor con `aspect-ratio: 800/600; width: 100%; max-width: 800px`. El canvas usa `width: 100%; height: 100%` en CSS — las coordenadas de física siguen siendo 800×600.
   - **Clases del juego:** `Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp` traducidas a TypeScript dentro del archivo; reciben `ctx: CanvasRenderingContext2D` como argumento en lugar de usar la global.
   - **Game loop:** `requestAnimationFrame` iniciado en `useEffect`. La función de cleanup llama a `cancelAnimationFrame`.
   - **Teclado:** `keydown/keyup` registrados en `useEffect` sobre `window`; cleanup con `removeEventListener`.
   - **Estado → React:** al finalizar cada frame, si cambian `score`, `lives`, `level`, `tripleShot` o `state`, se llama a los setters de React (`setScore`, `setLives`, etc.). El estado `'gameover'` activa el modal.
   - **HUD eliminado del canvas:** la función `drawHUD()` de la referencia se elimina; el HUD lo renderiza React con un `<div>` superpuesto al canvas con `position: absolute`.
   - **HUD React:** score, nivel, vidas (iconos SVG de nave como en `GamePlayer` existente), indicador `3x` con tiempo restante cuando `tripleShot > 0`; botón PAUSA (detiene el loop), botón SALIR → `navigate({ name: 'detalle', id: 'asteroids' })`.
   - **Pausa:** una variable ref `pausedRef` detiene el `update()` del loop (pero no el `draw()`) cuando está activa.
   - **Modal de game over (React):** mismo patrón que `GamePlayer` — input de nombre pre-relleno con `user?.name ?? 'INVITADO'`, botón "GUARDAR PUNTUACIÓN" → `onSaveScore({ game: 'asteroids', score, name, at: Date.now() })`, botón "JUGAR DE NUEVO" reinicia `initGame()`, botón "VOLVER AL VAULT" → `navigate({ name: 'games' })`.
   - **Props:** `{ navigate: (r: Route) => void; user: User | null; onSaveScore: (entry: SavedScore) => void }`.
   - Test: navegar a la ruta `'asteroids'` renderiza el canvas con la nave y los asteroides; ArrowLeft/Right/Up mueven y rotan la nave; Space dispara; destruir un asteroide incrementa el score en el HUD React; perder todas las vidas muestra el modal; guardar puntuación la añade a `localStorage['av_scores']`.

7. **Verificación final:** `npm run build` sin errores de TypeScript ni de compilación; navegar por todas las pantallas existentes sin errores de consola; HomeScreen "ACTIVIDAD EN VIVO" refleja la puntuación guardada tras una partida.

---

## Acceptance criteria

- [ ] `lib/types.ts` incluye `'asteroids'` en `RouteName` y `playRoute?: RouteName` en `Game`.
- [ ] `lib/data.ts` incluye la entrada `{ id: 'asteroids', ... , playRoute: 'asteroids' }` en `GAMES`.
- [ ] La Library muestra la card "ASTEROIDS" con cover `.cover-asteroids` visible.
- [ ] Hacer clic en la card navega a GameDetail de Asteroids.
- [ ] El botón "JUGAR AHORA" en GameDetail de Asteroids navega a la ruta `'asteroids'`.
- [ ] El botón "JUGAR AHORA" en GameDetail de cualquier otro juego sigue navegando a `'player'`.
- [ ] La ruta `'asteroids'` renderiza el canvas 800×600 con nave y asteroides.
- [ ] El canvas se escala para adaptarse al viewport sin distorsión.
- [ ] ArrowLeft / ArrowRight rotan la nave; ArrowUp activa el propulsor; Space dispara.
- [ ] Disparar un asteroide grande lo divide en dos medianos; uno mediano en dos pequeños; uno pequeño desaparece.
- [ ] El HUD React muestra score, nivel y vidas actualizados en tiempo real.
- [ ] Completar un nivel (eliminar todos los asteroides) avanza al nivel siguiente.
- [ ] Perder todas las vidas muestra el modal de game over con la puntuación final.
- [ ] El input de nombre en el modal acepta hasta 10 caracteres en mayúsculas.
- [ ] "GUARDAR PUNTUACIÓN" añade una entrada a `localStorage['av_scores']`.
- [ ] "JUGAR DE NUEVO" reinicia la partida sin recargar la página.
- [ ] "VOLVER AL VAULT" navega a `{ name: 'games' }`.
- [ ] El botón SALIR del HUD navega a `{ name: 'detalle', id: 'asteroids' }`.
- [ ] `npm run build` termina sin errores de TypeScript ni de compilación.
- [ ] No hay errores de consola al navegar por todas las pantallas existentes.

---

## Decisiones

- **Id `'asteroids'`, no `'rocas'`** — el juego es nuevo; `rocas` es un placeholder independiente que se implementará en su propio spec.
- **`playRoute?: RouteName` en `Game`** — permite que cada juego declare su ruta de gameplay propia sin modificar la lógica genérica de `GameDetail`; escalable cuando se implementen más juegos.
- **Canvas fijo 800×600, escalado por CSS** — las coordenadas de física y colisiones no se tocan; solo el CSS escala el elemento `<canvas>`. Alternativa descartada: canvas dinámico (requeriría refactorizar toda la física).
- **HUD en React** — coherente con la plataforma (patrón `GamePlayer`); facilita integrar score en Supabase cuando llegue el spec de auth sin tocar el loop.
- **Modal de game over en React** — es la única parte que requiere interacción de texto (nombre del jugador); reutiliza el patrón y los estilos ya establecidos en `GamePlayer`.
- **Guardar en `localStorage['av_scores']`** — coherente con el patrón actual del proyecto; la migración a Supabase se hará en un spec posterior al de auth.
- **Sin controles táctiles** — complejidad suficiente para un spec propio; no bloquea el objetivo de este spec.
- **`drawHUD()` eliminado del canvas** — la responsabilidad de UI se traslada a React; evitar duplicar estado entre canvas y DOM.

---

## Riesgos

| Riesgo                                                                   | Mitigación                                                                                          |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `setState` desde el game loop causa renders excesivos                    | Comparar valores antes de llamar al setter; solo actualizar cuando cambia el valor                  |
| Listeners de teclado no se eliminan al desmontar                         | El `useEffect` retorna cleanup con `removeEventListener` para cada listener                         |
| Canvas no obtiene el contexto `ctx` si el ref no está listo              | Comprobar `if (!canvasRef.current) return` al inicio del `useEffect`                                |
| Las coordenadas del canvas CSS difieren de las lógicas al ser responsivo | Las colisiones usan las coords lógicas 800×600 del canvas HTML; el CSS solo escala la visualización |
