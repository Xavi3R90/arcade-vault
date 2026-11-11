# MEMORY — game-planner

Última actualización: 2026-11-11

## Estado del catálogo

- Implementados (4): arkanoid (ARCADE/magenta), asteroids (SHOOTER/yellow), snake (SNAKE/green), tetris (PUZZLE/cyan). Un juego por color: cualquier color nuevo repetirá uno.
- Físicas cubiertas: grid (Tetris, Snake), inercia continua (Asteroids), rebote (Arkanoid).
- Sin cubrir: gravedad/salto (plataformas, runner), scroll lateral, defensa/apuntado, ritmo.
- `references/started-games/` solo contiene 02-asteroids, 03-tetris, 04-arkanoid (todos ya portados): no quedan referencias para portar; los nuevos juegos serán desde cero.
- No existen specs `NN-add-*` pendientes (último spec: 09-add-snake).

## Sesiones

- 2026-11-11: primera sesión. Supabase `execute_sql` falló ("Database is possibly not accessible"); se usó `references/implemented-games.md`. Sugeridos neon-runner (recomendado), neon-defense, lunar-drift.
- 2026-11-11 (2.ª): el usuario pidió 20 juegos con 4 instancias en paralelo (A acción, B puzzle, C plataformas/laberintos, D deportes/reflejos), 5 por foco, sin escribir archivos; el hilo principal consolidó. Top P5: orbit-gunner, shape-dock, tower-ascent, neon-stack. Ya hay 23 pendientes: priorizar elegir/descartar antes de sugerir más.

## Preferencias del usuario

- Le gusta lanzar el planner en paralelo para lotes grandes de sugerencias (2026-11-11).

## Descartes

- Ninguno.

## Criterios aprendidos

- Priorizar física/categoría nueva (gravedad) dado que grid, inercia y rebote ya están cubiertos.
- Al no haber referencias, puntuar "Referencia disponible" = 1 para todos los candidatos.

## Archivos

- `suggestions.md` — historial completo de sugerencias por slug.
- To Do visible: `references/game-suggestions-todo.md` (mantener coherente).
