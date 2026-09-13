# SPEC 02 — Pantalla Home (Landing Page)

> **Status:** Aprobado
> **Depends on:** SPEC 01
> **Date:** 2026-09-12
> **Objective:** Implementar la pantalla Home como landing page inicial de Arcade Vault, renombrando la ruta 'biblioteca' a 'games', y conectar la sección "Actividad en vivo" con los scores de localStorage.

---

## Scope

**In:**

- Nuevo componente `components/screens/HomeScreen.tsx` traducido de `references/templates/home-about/home.jsx`.
- `lib/types.ts`: añadir `'home'` y renombrar `'biblioteca'` → `'games'` en `RouteName`.
- `app/page.tsx`: ruta inicial cambia a `'home'`; render de `<HomeScreen>` para la ruta `'home'`; case `'biblioteca'` renombrado a `'games'`.
- `components/Nav.tsx`: actualizar referencia interna `'biblioteca'` → `'games'` (label visible sin cambios).
- `components/screens/Library.tsx`: reemplazar toda llamada `navigate({ name: 'biblioteca' })` por `navigate({ name: 'games' })`.
- `app/globals.css`: migrar desde `references/templates/home-about/styles.css` todas las reglas de Home (prefijos `.home-`, `.mini-`, `.feature-`, `.stats-`, `.activity-`, `.pricing-`, `.hero-scroll`, `.reveal`, `.silo`, `.ft-`, `.tick-`, `.tp-`, `.pc-`, `.faq-`, `.home-final`). Las clases que ya existen en globals.css no se duplican.
- Sección "ACTIVIDAD EN VIVO" de HomeScreen lee de `localStorage['av_scores']`; si tiene datos suficientes los usa; si no, rellena con el mock estático del template.

**Out of scope:**

- Pantalla About/Contacto (spec posterior).
- Renombrar el archivo `Library.tsx`.
- Datos de actividad en tiempo real o WebSockets.
- Cambio del label visible "BIBLIOTECA" en el Nav (solo cambia el identificador interno de ruta).

---

## Data model

No se introducen nuevas interfaces. El único cambio es en el union type:

```ts
// lib/types.ts
export type RouteName = 'home' | 'games' | 'detalle' | 'player' | 'auth' | 'salon';
```

**Lógica de "ACTIVIDAD EN VIVO"** (implementada dentro de `HomeScreen.tsx`):

- **Ticker (Últimas puntuaciones):** leer `SavedScore[]` de `localStorage['av_scores']`, ordenar por `at` desc, tomar los primeros 7. Si hay menos de 7 entradas reales, rellenar con filas mock estáticas del template hasta completar 7.
- **Top jugadores:** agregar `SavedScore[]` por `name` (suma de `score`), ordenar desc, tomar top 5. Si localStorage está vacío, mostrar el top mock estático del template.

---

## Implementation plan

1. **Actualizar `lib/types.ts`:** añadir `'home'` y cambiar `'biblioteca'` → `'games'` en `RouteName`. Test: `npm run build` no reporta errores de tipo.

2. **Actualizar `components/Nav.tsx`:** reemplazar la referencia interna `{ name: 'biblioteca' }` por `{ name: 'games' }` en el onClick del link. Test: el link de Biblioteca en el Nav sigue funcionando.

3. **Actualizar `components/screens/Library.tsx`:** buscar y reemplazar `navigate({ name: 'biblioteca' })` → `navigate({ name: 'games' })` en cualquier llamada interna (ej. botón "VOLVER"). Test: sin errores de TypeScript.

4. **Actualizar `app/page.tsx`:**
   - Importar `HomeScreen` desde `@/components/screens/HomeScreen`.
   - Cambiar el estado inicial: `useState<Route>({ name: 'home' })`.
   - Añadir case `'home'` → `<HomeScreen navigate={navigate} />`.
   - Renombrar el case `'biblioteca'` → `'games'` (sigue renderizando `<Library>`).
   - Test: `npm run dev` arranca sin errores de consola.

5. **Migrar CSS de Home a `app/globals.css`:** copiar de `references/templates/home-about/styles.css` únicamente los bloques de reglas que no existen ya en `globals.css`. Comprobar antes de copiar que `.btn`, `.blink`, `.fade-in`, `.pixel` y `.neon-*` no se redefinen. Test: la página no presenta estilos rotos al abrir la Home.

6. **Crear `components/screens/HomeScreen.tsx`:** traducción completa de `home.jsx` a TypeScript/React con las siguientes partes:
   - Hook `useReveal()` con `IntersectionObserver` (threshold 0.12, class `.in`).
   - Componente `FloatingSilhouettes` con los 8 SVGs pixel-art del template.
   - Componente `FeatureIcon` con los 4 iconos SVG (GAMEPAD, FREE, TROPHY, ROCKET).
   - Componente `MiniCard` con `game: Game` y `onClick`.
   - Sección Hero: eyebrow + título 3 líneas + subtítulo + CTAs ("EXPLORAR JUEGOS" → `'games'`, "CREAR CUENTA" → `'auth'`) + hero-scroll decorativo.
   - Sección "¿POR QUÉ ARCADE VAULT?" con los 4 feature-cards.
   - Sección "JUEGOS DISPONIBLES AHORA" con `GAMES.slice(0, 6)` como `MiniCard`.
   - Sección "STATS" (12+, MILES, GLOBAL) estática.
   - Sección "ACTIVIDAD EN VIVO" con la lógica de localStorage descrita en el Data model.
   - Sección "PRECIOS" estática con el plan único y FAQ.
   - Sección "Final CTA" con botón "INSERTAR MONEDA →" → `'games'`.
   - Props: `{ navigate: (r: Route) => void }`.
   - Test: la ruta inicial muestra el hero con "EL ARCADE CLÁSICO ESTÁ DE VUELTA".

7. **Verificación integral:** navegar entre todas las pantallas y confirmar que ningún flujo rompe tras el rename. Hacer grep de `'biblioteca'` en el proyecto para detectar referencias residuales. Test: `npm run build` sin errores; no hay errores de consola al navegar por todas las pantallas.

---

## Acceptance criteria

- [ ] La app carga directamente en la pantalla Home (hero visible sin clic previo).
- [ ] El hero muestra "EL ARCADE CLÁSICO ESTÁ DE VUELTA" con las siluetas flotantes animadas.
- [ ] El botón "EXPLORAR JUEGOS" navega a la pantalla Library (ruta 'games').
- [ ] El botón "CREAR CUENTA" navega a la pantalla Auth.
- [ ] La sección "JUEGOS DISPONIBLES AHORA" muestra 6 MiniCards con los primeros 6 juegos de `GAMES`.
- [ ] Hacer clic en una MiniCard navega al GameDetail del juego correspondiente.
- [ ] "VER TODOS LOS JUEGOS →" navega a la Library (ruta 'games').
- [ ] La sección "ACTIVIDAD EN VIVO" muestra datos de `localStorage['av_scores']` cuando existen entradas; si no hay, muestra el mock estático.
- [ ] Las animaciones `.reveal` se activan al hacer scroll (visibles solo al entrar en el viewport).
- [ ] El link de Biblioteca en el Nav navega a la ruta 'games' sin error de TypeScript ni de runtime.
- [ ] Navegar a Library, GameDetail, GamePlayer, Auth y HallOfFame sigue funcionando después del rename de ruta.
- [ ] `npm run build` termina sin errores de TypeScript ni de compilación.
- [ ] No hay errores en consola al cargar la Home y al navegar entre todas las pantallas.

---

## Decisiones

- **Sí: renombrar ruta 'biblioteca' → 'games'** — el usuario lo indicó explícitamente; hace el identificador de ruta más descriptivo en inglés, consistente con el resto del código TypeScript.
- **No: renombrar el archivo `Library.tsx`** — cambio cosmético sin valor funcional; evita diff innecesario en el historial de git.
- **Sí: fallback a mock cuando localStorage está vacío** — un usuario nuevo no ve la sección de actividad vacía; la experiencia es coherente desde el primer acceso.
- **No: pantalla About en este spec** — reservada por el usuario para un spec posterior independiente.
- **No: actividad en tiempo real** — fuera del scope del MVP; los datos se reflejan al navegar a Home.
- **Sí: nombre del componente `HomeScreen`** — evita colisión con el default export `Home` que ya existe en `app/page.tsx`.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Clases CSS de Home colisionan con clases del SPEC 01 ya en `globals.css` | Revisar existencia antes de copiar cada bloque; priorizar no duplicar `.btn`, `.blink`, `.fade-in`, `.pixel`. |
| Referencias residuales a `'biblioteca'` no detectadas rompen TypeScript | Paso 7 incluye un grep explícito de `'biblioteca'` en el proyecto antes de cerrar la implementación. |
