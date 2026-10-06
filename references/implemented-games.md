# Juegos implementados

Catálogo de los juegos realmente jugables en Arcade Vault (`play_route IS NOT NULL` en la tabla `games` de Supabase). Los juegos con `play_route = null` son placeholders de catálogo del MVP UI y no están incluidos aquí.

Fuente: tabla `public.games` — consulta `SELECT * FROM public.games WHERE play_route IS NOT NULL`.

Última actualización: 2026-10-06.

---

## ARKANOID

- **id / slug:** `arkanoid`
- **Ruta:** `arkanoid`
- **Categoría:** ARCADE
- **Color:** magenta
- **Cover CSS:** `.cover-arkanoid`
- **Screen:** `components/screens/ArkanoidScreen.tsx`
- **Spec:** `specs/08-add-arkanoid.md`
- **Short:** Rompe bloques con la pelota sin dejarla caer al vacío.
- **Long:** Tu paleta rebota la pelota contra los bloques de colores que llenan la pantalla. Destruye filas enteras para avanzar por los cinco niveles mientras la bola gana velocidad en cada etapa. Tres vidas te separan del game over — pero completar los cinco niveles es la victoria definitiva.

## ASTEROIDS

- **id / slug:** `asteroids`
- **Ruta:** `asteroids`
- **Categoría:** SHOOTER
- **Color:** yellow
- **Cover CSS:** `.cover-asteroids`
- **Screen:** `components/screens/AsteroidsScreen.tsx`
- **Spec:** `specs/05-asteroids-game.md`
- **Short:** Destruye rocas en el vacío del espacio.
- **Long:** Tu nave triangular flota en gravedad cero. Dispara para dividir asteroides en fragmentos cada vez más pequeños mientras esquivas su órbita caótica. Recoge el power-up 3x para triplicar tus disparos.

## SNAKE

- **id / slug:** `snake`
- **Ruta:** `snake`
- **Categoría:** SNAKE
- **Color:** green
- **Cover CSS:** `.cover-snake`
- **Screen:** `components/screens/SnakeScreen.tsx`
- **Spec:** `specs/09-add-snake.md`
- **Short:** Guía tu serpiente y devora frutas sin chocar contigo mismo.
- **Long:** Tu serpiente crece con cada fruta que devora. Veintidós variedades de frutas aparecen de forma aleatoria mientras la velocidad aumenta gradualmente. Muere si colisionas contigo mismo — las paredes te teletransportan al lado contrario.

## TETRIS

- **id / slug:** `tetris`
- **Ruta:** `tetris`
- **Categoría:** PUZZLE
- **Color:** cyan
- **Cover CSS:** `.cover-tetris`
- **Screen:** `components/screens/TetrisScreen.tsx`
- **Spec:** `specs/07-add-tetris.md`
- **Short:** Encaja piezas y elimina líneas antes de que el tablero se llene.
- **Long:** Siete piezas geométricas caen desde la cima de un tablero de diez columnas; tú decides cuándo girarlas y dónde aterrizan. Completa filas horizontales para eliminarlas y acumular puntos: borrar cuatro líneas a la vez es un Tetris y da la mayor recompensa. El ritmo se acelera con cada nivel — ¿hasta dónde aguanta tu tablero?

---

## Resumen

| Slug      | Título    | Categoría | Color   | Spec                 |
| --------- | --------- | --------- | ------- | -------------------- |
| arkanoid  | ARKANOID  | ARCADE    | magenta | 08-add-arkanoid.md   |
| asteroids | ASTEROIDS | SHOOTER   | yellow  | 05-asteroids-game.md |
| snake     | SNAKE     | SNAKE     | green   | 09-add-snake.md      |
| tetris    | TETRIS    | PUZZLE    | cyan    | 07-add-tetris.md     |

**Total: 4 juegos implementados.**
