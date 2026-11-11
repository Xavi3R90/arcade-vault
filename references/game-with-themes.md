# Juegos con skins (temas)

Registro de qué juegos de Arcade Vault tienen implementados los 3 skins obligatorios. Lo mantiene el agente `skin-designer`, que aplica los skins **a un único juego por ejecución**, solo al que indica el usuario.

Última actualización: 2026-11-11.

---

## Estado

| Juego     | Slug      | Clásico                | Neón      | Retro     | Contraste mín. (oscuro)                                                 | Paleta                   | Fecha      |
| --------- | --------- | ---------------------- | --------- | --------- | ----------------------------------------------------------------------- | ------------------------ | ---------- |
| ARKANOID  | arkanoid  | contraste insuficiente | ok        | ok        | clásico 1.17:1 (distinción) / 2.4:1 (texto) · neón 1.55:1 · retro 1.6:1 | `lib/skins/arkanoid.ts`  | 2026-11-11 |
| ASTEROIDS | asteroids | contraste insuficiente | ok        | ok        | clásico 1.0:1 (distinción) / 2.4:1 (texto) · neón 2.8:1 · retro 2.6:1   | `lib/skins/asteroids.ts` | 2026-11-11 |
| SNAKE     | snake     | contraste insuficiente | ok        | ok        | clásico 1.3:1 (distinción) / 2.4:1 (texto) · neón 1.6:1 · retro 1.55:1  | `lib/skins/snake.ts`     | 2026-11-11 |
| TETRIS    | tetris    | pendiente              | pendiente | pendiente | —                                                                       | —                        | —          |

Estados posibles: `pendiente` · `ok` · `contraste insuficiente`.

Un juego está **completo** cuando sus 3 columnas de skin están en `ok`.

---

## Convención

- **Skins obligatorios** (`SkinId = 'classic' | 'neon' | 'retro'`, definido en `lib/skins.ts`):
  - **Clásico** (`classic`, por defecto): la paleta original del juego, sin ningún cambio visual.
  - **Neón** (`neon`): colores saturados de la marca (`--cyan`, `--magenta`, `--yellow`, `--green`), glow con `shadowBlur` y fondo casi negro.
  - **Retro** (`retro`): paleta limitada de fósforo u 8 bits (verde/ámbar CRT o 4 tonos estilo handheld), sin glow y con scanlines opcionales.
- **Paletas:** un archivo por juego en `lib/skins/<slug>.ts` que exporta `Record<SkinId, GamePalette>`.
  - Roles comunes: `bg`, `grid`, `fg`, `accent`, `danger` y `text`.
  - Los roles propios de cada juego van en `extra`.
- **Selección:** selector global en `components/Nav.tsx`, guardado en `localStorage['av-skin']`.
  - `app/page.tsx` pasa la prop `skin` solo a las screens ya migradas.
  - Las screens leen la paleta con un ref dentro del loop RAF, así que cambiar de skin no reinicia la partida.
- **Cover:** variantes `[data-skin="neon"] .cover-<slug>` y `[data-skin="retro"] .cover-<slug>` en `app/globals.css`.
- **Modo oscuro** (umbrales que deben cumplir los 3 skins):
  - Luminancia relativa de `bg` ≤ 0.05.
  - Contraste WCAG ≥ 3:1 entre cada elemento jugable y `bg`.
  - Contraste ≥ 4.5:1 entre el texto/HUD y su fondo.
  - Contraste ≥ 1.5:1 entre elementos que haya que distinguir entre sí (p. ej. dos piezas contiguas, o la serpiente y la fruta).

---

## Historial

<!-- skin-designer añade aquí una línea por juego aplicado:
- AAAA-MM-DD — <slug>: classic/neon/retro ok · contraste mín. X.X:1 · lib/skins/<slug>.ts
-->

- 2026-11-11 — asteroids: classic contraste insuficiente / neon ok / retro ok · contraste mín. neón 2.8:1, retro 2.6:1 (distinción; fondo ≥ 5.3:1, texto ≥ 5.2:1) · lib/skins/asteroids.ts · Clásico sin modificar: nave, rocas y balas comparten `#fff` (1.0:1 entre sí) y las etiquetas del HUD/modal `#4a4f70` sobre `#0f0f18` dan 2.4:1 (< 4.5:1). Pendiente de decisión del usuario.
- 2026-11-11 — snake: classic contraste insuficiente / neon ok / retro ok · contraste mín. neón 1.6:1, retro 1.55:1 (distinción; fondo ≥ 3.3:1 neón / 4.4:1 retro, texto ≥ 5.2:1) · lib/skins/snake.ts · Clásico sin modificar: etiquetas del HUD/modal `#4a4f70` sobre `#0f0f18` dan 2.4:1 (< 4.5:1) y la fruta de respaldo `#ff4444` frente al cuerpo `#00bb33` da 1.3:1 (solo se ve si no carga el sprite). Pendiente de decisión del usuario.
- 2026-11-11 — arkanoid: classic contraste insuficiente / neon ok / retro ok · contraste mín. neón 1.55:1, retro 1.6:1 (distinción entre filas contiguas; fondo ≥ 3.4:1 neón / 3.3:1 retro, texto ≥ 5.2:1 neón / 10.0:1 retro) · lib/skins/arkanoid.ts · Clásico sin modificar: bloques contiguos `yellow`/`cyan` dan 1.17:1 y `magenta`/`hotpink` 1.18:1 (< 1.5:1), y las etiquetas del HUD/modal `#4a4f70` sobre `#0f0f18` dan 2.4:1 (< 4.5:1). Neón y Retro usan 4 escalones de luminancia porque yellow/cyan/magenta/hotpink se tocan entre sí en algún nivel. Pendiente de decisión del usuario.
