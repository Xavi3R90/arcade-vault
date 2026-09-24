---
name: add-game
description: Genera un spec para añadir un nuevo juego a Arcade Vault, ya sea portando código de references/started-games/ o creado desde cero. Sigue los patrones establecidos (RouteName, XxxScreen.tsx, cover CSS, fila en tabla games vía MCP). NO implementa código — solo escribe specs/NN-add-<slug>.md. Después ejecuta /spec-impl.
disable-model-invocation: true
argument-hint: '<slug del juego o descripción breve> (opcional)'
allowed-tools: Read, Glob, Grep, Write, AskUserQuestion, mcp__supabase__list_tables, mcp__supabase__execute_sql, Bash(ls:*), Bash(cat:*), Bash(date:*)
---

# /add-game — Generador de specs para juegos de Arcade Vault

## Contexto de sesión

Fecha de hoy (usar en el header del spec, nunca inventarla):
!`date +%F`

Specs existentes:
!`ls specs/ 2>/dev/null || echo "No existe la carpeta specs/"`

Juegos de referencia disponibles:
!`ls references/started-games/ 2>/dev/null || echo "No existe la carpeta references/started-games/"`

Componentes de pantalla existentes:
!`ls components/screens/ 2>/dev/null`

---

Este skill genera un spec para añadir un juego nuevo a la plataforma Arcade Vault siguiendo los patrones ya establecidos. **No escribe código.** Su salida es un único archivo `specs/NN-add-<slug>.md` con estado `Borrador`, listo para que el usuario lo revise, lo apruebe y ejecute `/spec-impl NN-add-<slug>` para implementarlo.

El skill conoce todos los detalles de integración: la tabla `games` de Supabase, el patrón de componente `<XxxScreen>` con canvas, el cover CSS, el sistema de leaderboard y el workflow MCP. El usuario solo necesita responder sobre su juego — el skill traduce esas respuestas al formato de spec correcto.

## Flujo de fases

Sigue las fases en orden. **Nunca saltes la Phase 2** — determinar el origen del juego define todo lo que viene después. Tus respuestas deben estar en el mismo idioma que el prompt inicial. Si el prompt es en español, responde en español; si es en inglés, en inglés.

---

### Phase 1 — Leer el contexto del proyecto

Antes de hacer preguntas, leer en este orden:

1. `CLAUDE.md` — contexto general del proyecto y stack.
2. `.claude/skills/spec/SKILL.md` — la guía autoritativa de cómo escribir specs en este proyecto: fases de preguntas, reglas duras (nunca código, idioma del prompt, criterios booleanos), estructura de secciones, cuándo escribir de una sola vez vs sección a sección, y cómo guardar el archivo. **Este skill es la referencia principal para Phase 6.**
3. `.claude/skills/spec/template.md` — la plantilla concreta con el formato de cada sección (header, scope, data model, plan, criterios, decisiones, riesgos).
4. `specs/05-asteroids-game.md` — el patrón completo de un juego con canvas (RouteName, componente screen, cover, controles, modal game over, `playRoute` en `games`).
5. `specs/06-supabase-games-leaderboard.md` — solo las secciones **Data model** e **Implementation plan** (esquema de `games` y `scores`, workflow MCP para INSERT, campos obligatorios).
6. `lib/types.ts` — `RouteName` actual y la interfaz `Game` (campos exactos).
7. `components/screens/AsteroidsScreen.tsx` — primeras 80 líneas (estructura del componente: props, refs, estado React, arranque del loop).
8. `app/globals.css` líneas 775–810 — el patrón de la clase `.cover-asteroids` (estructura de gradiente + `::before` + `::after`).
9. `app/page.tsx` — el switch `if/else if` de rutas para ver cómo se registra cada juego.

Opcionalmente, si el MCP de Supabase está disponible, ejecutar `mcp__supabase__list_tables` para confirmar las columnas exactas de la tabla `games`. Si la herramienta falla, continuar con la información de los specs 05 y 06 — no bloquear el flujo.

Si `$ARGUMENTS` ya contiene un slug o una descripción del juego, úsalo como punto de partida para Phase 2. Si viene vacío, continúa igualmente a Phase 2.

---

### Phase 2 — Determinar el origen del juego

Esta fase es bloqueante. Presenta las opciones al usuario con `AskUserQuestion`:

**Opción (a) — Portar desde `references/started-games/`:**

- Listar los directorios disponibles del contexto de sesión.
- Si el usuario eligió (a), pedirle que identifique cuál directorio es.
- Si el directorio indicado no existe en `references/started-games/`, detenerse y pedir corrección. No continuar con un path inventado.
- Si el directorio existe, leer: `README.md`, `CLAUDE.md` (si existe), `game.js`, `index.html`. Si hay `specs/` dentro del dir de referencia, leerlos también (ej. `04-arkanoid/specs/`).
- Extraer del código: tipo de loop, input de teclado, física, condición de game over, sistema de score, niveles. Pre-rellenar con esa información las preguntas de Phase 4 y pedir confirmación en lugar de preguntar desde cero.

**Opción (b) — Juego desde cero (generado por IA):**

- Preguntar: género (SHOOTER / PUZZLE / ARCADE / PLATFORMER / RACING / otro), descripción del core loop en 1–2 frases, referencias visuales o de jugabilidad si las hay.
- Si la descripción no cabe en 2 frases, preguntar si el alcance no es demasiado grande para un solo spec.

---

### Phase 3 — Metadata del juego (fila `games`)

Preguntar en un bloque los datos necesarios para la fila de la tabla `games`. Para cada campo, indicar el valor recomendado cuando aplique:

1. **`id` (slug)** — kebab-case, único. Antes de aceptarlo, comprobar si ya existe en `games` con `mcp__supabase__execute_sql` (`SELECT id FROM public.games WHERE id = '<slug>'`). Si colisiona, pedir otro slug. Si MCP no está disponible, advertir al usuario y continuar.
2. **`title`** — nombre en MAYÚSCULAS (ej. `TETRIS`, `ARKANOID`).
3. **`short`** — descripción breve ≤ 60 caracteres (una línea visible en la card).
4. **`long`** — descripción larga de 2–3 frases para la ficha del juego.
5. **`cat`** — categoría. Derivar sugerencia del género de Phase 2. Valores observados en el proyecto: `SHOOTER`, `PUZZLE`, `ARCADE`, `SNAKE`, `PLATAFORMAS`. Aceptar cualquier string en mayúsculas.
6. **`color`** — **estrictamente uno de:** `cyan`, `magenta`, `yellow`, `green`. Rechazar cualquier otro valor. Si el usuario propone otro, explicar la restricción del CHECK de la DB y pedir que elija uno de los cuatro.
7. **`cover`** — nombre de la clase CSS que se creará: `cover-<slug>` (ej. `cover-tetris`). No inventar otro formato.
8. **`plays`** — valor inicial de plays mostrado en la card. Recomendar `'0'` para un juego nuevo; aceptar mock como `'0'` o `'0K'`.
9. **`best`** — puntuación récord inicial. Recomendar `0`. Aceptar el valor que el usuario diga.

---

### Phase 4 — Mecánicas y controles

Si el juego viene de una referencia (Phase 2a), pre-rellenar con los datos extraídos del código y pedir confirmación o corrección. Si es desde cero (Phase 2b), preguntar explícitamente.

Cubrir estos puntos en un bloque:

1. **Teclado** — qué teclas y qué hacen (ArrowLeft/Right, Space, W/A/S/D, etc.).
2. **Ratón** — ¿se usa? ¿Para qué?
3. **Física** — grid-based (Tetris, Snake), continua con velocidad (Asteroids), gravedad (Arkanoid), otra.
4. **Colisiones** — tipo: bounding box, pixel-perfect, grid cell. Entre qué objetos.
5. **Condición de game over** — cuándo termina la partida.
6. **Sistema de score** — qué eventos dan puntos y cuántos.
7. **Vidas** — ¿cuántas? ¿Se pierden cómo? ¿O sin vidas?
8. **Niveles / progresión** — ¿cómo avanza el juego? (velocidad, más enemigos, nuevas piezas, etc.)
9. **Power-ups** — ¿existen? Describir brevemente.
10. **Pausa** — tecla de pausa (recomendar `P` o `Escape`).

---

### Phase 5 — Integración con leaderboard

Esta fase es mayormente informativa. Confirmar con una sola pregunta bloqueante:

> El juego guardará puntuaciones en la tabla `scores` de Supabase al terminar la partida usando `onSaveScore({ game: '<id>', score, name, at: Date.now() })`. El modal de game over seguirá el patrón de AsteroidsScreen: input de nombre (máx. 10 chars, mayúsculas), botón "GUARDAR PUNTUACIÓN", botón "JUGAR DE NUEVO" y botón "VOLVER AL VAULT". Una vez la fila exista en `games`, el Salón de la Fama mostrará una pestaña automática y GameDetail mostrará el leaderboard del juego. ¿Algún cambio a este comportamiento estándar?

Si el usuario no quiere modal de game over (ej. juego de puntuación continua sin fin), recoger el comportamiento alternativo y reflejarlo en el spec.

---

### Phase 6 — Escribir el spec

Si toda la información de Phase 2–5 está respondida sin suponer nada, **escribir el spec completo de una sola vez** y pasar a Phase 7. No pedir confirmación sección por sección — el usuario ya respondió todo en las fases anteriores y pedir de nuevo es fricción innecesaria.

Solo si falta información concreta (una pregunta sin respuesta, una ambigüedad que no se puede resolver), desarrollar el spec sección a sección y esperar confirmación de cada una antes de continuar.

#### Estructura del spec

Seguir las reglas de escritura del skill `/spec` (leído en Phase 1): cuándo escribir de una sola vez vs sección a sección, cómo formular criterios de aceptación booleanos, qué capturar en la sección de Decisiones, y cuándo omitir Riesgos. La estructura concreta de secciones viene de `template.md`. El spec debe estar en el mismo idioma que la conversación.

**Header:**

```markdown
# SPEC NN — Juego <TITLE>

> **Status:** Borrador
> **Depends on:** SPEC 06
> **Date:** <fecha del contexto de sesión>
> **Objetivo:** Una sola frase. Si no cabe en una, el spec es demasiado grande.
```

**Scope — In:**

- `lib/types.ts`: añadir `'<slug>'` a `RouteName`.
- `components/screens/<Slug>Screen.tsx`: componente nuevo con canvas 800×600 lógico, HUD en React, modal de game over, props `{ navigate, user, onSaveScore }`, cleanup de RAF y listeners en `useEffect`.
- `app/globals.css`: clase `.cover-<slug>` con gradientes + pseudo-elementos `::before/::after`.
- `app/page.tsx`: caso `'<slug>'` en el switch de rutas.
- Supabase tabla `games`: INSERT de la fila del nuevo juego vía `mcp__supabase__apply_migration`.

**Scope — Fuera de scope (para specs posteriores):**
Incluir siempre al menos: controles táctiles/mobile, sonido, multijugador. Añadir los que el usuario mencionó pero decidió diferir.

**Data model:**
Incluir la fila exacta del juego con todos los campos de la tabla `games`. También el tipo TypeScript si hay cambios en `Game` (raro — solo si se añade un campo nuevo, lo cual está fuera de scope en este patrón).

**Plan de implementación — estos 5 pasos exactos (adaptar slug y nombre):**

1. **Actualizar `lib/types.ts`:** añadir `'<slug>'` al union `RouteName`. Test: `npm run build` sin errores de tipo.
2. **Crear `components/screens/<Slug>Screen.tsx`:** traducción completa del juego al patrón React — canvas `width=800 height=600` escalado por CSS (`width: 100%; max-width: 800px; aspect-ratio: 800/600`), lógica en clases TypeScript (o funciones puras), loop con `requestAnimationFrame` + cleanup, listeners `keydown/keyup` en `useEffect` + cleanup, HUD en React (`position: absolute`), modal de game over con input de nombre + botones estándar. Props: `{ navigate: (r: Route) => void; user: User | null; onSaveScore: (entry: SavedScore) => void }`. Test: navegar a la ruta `'<slug>'` renderiza el canvas y el juego arranca.
3. **Añadir `.cover-<slug>` en `app/globals.css`:** diseño de la cover en CSS puro — fondo con gradiente radial, forma icónica del juego con `clip-path` o `::before/::after`, paleta de color `<color>`. Test: la card del juego en Library muestra cover visible y coherente con las demás.
4. **Registrar la ruta en `app/page.tsx`:** importar `<Slug>Screen`; añadir `} else if (route.name === '<slug>') { screen = <<Slug>Screen navigate={navigate} user={user} onSaveScore={handleSaveScore} />; }`. Test: `npm run dev` arranca sin errores.
5. **Insertar fila en tabla `games` vía MCP:** ejecutar `mcp__supabase__apply_migration` con nombre de migración `NNN_add_<slug>_game` y contenido: `INSERT INTO public.games (id, title, short, long, cat, cover, color, best, plays, play_route) VALUES ('<slug>', '<TITLE>', '<short>', '<long>', '<CAT>', 'cover-<slug>', '<color>', <best>, '<plays>', '<slug>');`. **No crear archivo SQL local.** Test: la tabla `games` muestra la nueva fila; la Library carga y muestra la card del juego.

**Criterios de aceptación:**
Lista booleana verificable. Incluir al menos:

- [ ] `RouteName` incluye `'<slug>'`.
- [ ] La Library muestra la card del juego con cover `.cover-<slug>` visible.
- [ ] El botón "JUGAR AHORA" en la ficha del juego navega a la ruta `'<slug>'`.
- [ ] La ruta `'<slug>'` renderiza el canvas con el juego activo.
- [ ] [Controles del juego — un ítem por tecla principal]
- [ ] Game over muestra el modal con input de nombre.
- [ ] "GUARDAR PUNTUACIÓN" inserta una fila en la tabla `scores` de Supabase.
- [ ] El score aparece en la pestaña del Salón de la Fama para este juego.
- [ ] `npm run build` termina sin errores de TypeScript.
- [ ] No hay errores de consola al navegar por todas las pantallas.

**Decisiones:**
Capturar al menos: por qué se eligió este juego, decisiones sobre física, color elegido y razón, cualquier desviación del patrón estándar de AsteroidsScreen.

**Riesgos:**
Solo si hay riesgos no obvios. Incluir siempre el de "setState desde el game loop causa renders excesivos" y su mitigación (comparar antes de setear).

---

### Phase 7 — Guardar el spec

1. Determinar el siguiente número secuencial a partir del listado de `specs/` del contexto de sesión. El más alto + 1, con cero a la izquierda si < 10.
2. Nombre del archivo: `specs/NN-add-<slug>.md`. Usar siempre el prefijo `add-` para distinguir estos specs de los genéricos.
3. Usar la fecha del contexto de sesión en el header. **Nunca inventar una fecha.**
4. Escribir el archivo directamente. No pedir permiso para escribirlo ni confirmar el nombre de antemano — solo avisar si el archivo ya existiera.
5. Estado: `Borrador` (convención española del proyecto).
6. Confirmar al usuario:
   - Path del archivo creado.
   - Recordatorio: cambiar el estado a `Aprobado` una vez revisado.
   - Próximo paso: ejecutar `/spec-impl NN-add-<slug>` para implementarlo.
7. **Detenerse aquí.** No proponer implementar el spec ni hacer nada más.

---

## Hard rules

- **Nunca escribir código.** Solo el archivo `.md` bajo `specs/` al final.
- **Nunca ejecutar `apply_migration` desde este skill.** `mcp__supabase__execute_sql` solo con `SELECT` para inspección. El INSERT real lo hará `/spec-impl`.
- **Nunca proponer implementación tras guardar el spec.** El trabajo termina en Phase 7.
- **Nunca asumir metadata** (id, color, controles) que el usuario no haya confirmado.
- **El idioma de la salida debe coincidir con el del prompt inicial.** En este repo el default es español.
- **Si Phase 2 elige (a) pero el directorio no existe**, detenerse y pedir corrección. No inventar un path.
- **Si el slug colisiona con una fila existente en `games`**, detenerse y pedir un slug distinto.
- **Si el color propuesto no es uno de `cyan | magenta | yellow | green`**, rechazarlo, explicar la restricción de la DB, y pedir que el usuario elija uno válido.

## Errores comunes a evitar (específicos de este dominio)

- Inventar un color fuera de `cyan | magenta | yellow | green` — viola el `CHECK` de la columna en Supabase.
- Omitir `play_route` en el INSERT — impide la navegación desde GameDetail al juego.
- Proponer añadir columnas nuevas a `games` — fuera de scope; el esquema está fijo.
- Usar coordenadas lógicas distintas a 800×600 para el canvas sin justificación explícita — rompe la convención de escalado CSS.
- Crear un archivo `.sql` local para la migración — SPEC 06 estableció el workflow MCP-only.
- Olvidar el cleanup de RAF y listeners en el `useEffect` — riesgo documentado en SPEC 05.
- Criterios de aceptación no booleanos como "el juego es fluido" o "la UX es buena".
- Referenciar `localStorage['av_scores']` — deprecado tras SPEC 06; los scores van a Supabase.
- Nombre de componente inconsistente — debe ser PascalCase `<Slug>Screen.tsx` (ej. `TetrisScreen.tsx`, `ArkanoidScreen.tsx`).
- Omitir el bloque "Fuera de scope" — sonido, controles táctiles y multijugador deben aparecer aunque sean obvios.

## Arguments

`$ARGUMENTS` es la **descripción o slug del juego**, no el nombre del archivo. Úsalo como punto de partida para Phase 2:

- Si es un slug kebab-case sin espacios (ej. `tetris`, `arkanoid`): buscar si existe un directorio coincidente en `references/started-games/` y proponer la opción (a) como pre-selección; el usuario confirma.
- Si es una descripción con espacios (ej. `"juego de laberinto tipo Pac-Man"`): proponer la opción (b) desde cero.
- Si viene vacío: empezar Phase 2 sin pre-selección.
