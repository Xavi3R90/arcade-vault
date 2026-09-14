# SPEC 03 — Pantalla About + Formulario de Contacto con Resend

> **Status:** Aprobado
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-09-12
> **Objective:** Implementar la pantalla About con sección de misión, highlights y formulario de contacto que envía emails reales mediante Resend, añadiendo la ruta `'about'` al sistema de navegación y un enlace en el Nav.

---

## Scope

**In:**

- `lib/types.ts`: añadir `'about'` a `RouteName`.
- `components/Nav.tsx`: añadir enlace "Acerca" (desktop y mobile) con `navigate({ name: 'about' })`; actualizar `isActive` para incluir `'about'`.
- `app/page.tsx`: importar `AboutScreen`, añadir case `'about'` → `<AboutScreen navigate={navigate} />`.
- `app/globals.css`: migrar desde `references/templates/home-about/styles.css` los bloques del About (`.about-hero`, `.about-title`, `.about-mission`, `.highlight-row`, `.highlight.*`, `.about-divider`, `.div-bar`, `.div-pixels`, `.about-contact`, `.contact-grid`, `.contact-intro`, `.contact-title`, `.contact-sub`, `.contact-tips`, `.contact-form`, `.terminal-success`, `.btn.press`, `@keyframes pxblink`, `@keyframes shake`). No duplicar `.field`, `.field input`, `.field label` que ya existen de SPEC 01.
- `app/api/contact/route.ts`: nuevo handler POST en Next.js App Router que valida campos y llama a `resend.emails.send()`. Devuelve `{ ok: true }` en éxito o `{ error: string }` con status 500 en fallo.
- `components/screens/AboutScreen.tsx`: nuevo, traducción completa de `references/templates/home-about/about.jsx` a TypeScript/React. `onSubmit` llama a `fetch('/api/contact', { method: 'POST', … })`, muestra terminal de éxito si responde ok, muestra mensaje de error visible si falla.
- `.env.local`: añadir `RESEND_API_KEY=` (vacía; el usuario la completa) y `CONTACT_TO_EMAIL=` (email destino).
- `package.json`: instalar paquete `resend` via `npm install resend`.

**Out of scope:**

- Plantillas HTML elaboradas para el email (se usa HTML simple con los tres campos).
- Rate limiting o protección anti-spam en la API route.
- Archivos adjuntos en el formulario de contacto.
- Dominio de envío verificado (se usa el sandbox `onboarding@resend.dev`).
- Pantalla About separada de la pantalla de Contacto.
- Internacionalización del email.

---

## Data model

No se introducen nuevas interfaces en el frontend. El body del `POST /api/contact` es:

```ts
{ name: string; email: string; msg: string }
```

Variables de entorno nuevas en `.env.local`:

```
RESEND_API_KEY=          # clave de API de Resend (el usuario la añade)
CONTACT_TO_EMAIL=        # email destino de los mensajes del formulario
```

El email enviado tiene la siguiente estructura fija:

- **From:** `onboarding@resend.dev` (sandbox de Resend)
- **To:** `process.env.CONTACT_TO_EMAIL`
- **Subject:** `[Arcade Vault] Mensaje de {nombre}`
- **Body HTML:** nombre, email del remitente y mensaje en párrafos simples

---

## Implementation plan

1. **Instalar `resend`:** ejecutar `npm install resend`. Test: `package.json` incluye `resend` en `dependencies`.

2. **Configurar `.env.local`:** añadir las dos variables `RESEND_API_KEY=` y `CONTACT_TO_EMAIL=`. Verificar que `.gitignore` incluye `.env.local` (no commitear credenciales).

3. **Actualizar `lib/types.ts`:** añadir `'about'` al union `RouteName`. Test: `npm run build` sin errores de tipo.

4. **Actualizar `components/Nav.tsx`:** añadir enlace "Acerca" con `onClick={() => go({ name: 'about' })}` en la lista desktop y en el panel mobile; actualizar `isActive` si es necesario. Test: el enlace aparece en el Nav y está activo cuando la ruta es `'about'`.

5. **Actualizar `app/page.tsx`:** importar `AboutScreen` desde `@/components/screens/AboutScreen`; añadir case `'about'` → `<AboutScreen navigate={navigate} />`. Test: `npm run dev` arranca sin errores.

6. **Migrar CSS de About a `app/globals.css`:** copiar de `references/templates/home-about/styles.css` los bloques de About indicados en el Scope. Comprobar antes de copiar que `.field`, `.field input`, `.field label` no se redefinen. Test: la pantalla About no presenta estilos rotos al abrirla.

7. **Crear `app/api/contact/route.ts`:** handler `POST` que:
   - Parsea `{ name, email, msg }` del body JSON.
   - Valida que los tres campos no estén vacíos; si lo están, devuelve 400.
   - Llama a `resend.emails.send()` con from, to, subject y body HTML.
   - En éxito devuelve `NextResponse.json({ ok: true })`.
   - En error de Resend devuelve `NextResponse.json({ error: error.message }, { status: 500 })`.
   - Si `CONTACT_TO_EMAIL` no está definida, devuelve 500 con mensaje descriptivo.
   Test: `curl -X POST /api/contact` con body válido responde `{ ok: true }` (o error si el key es inválido).

8. **Crear `components/screens/AboutScreen.tsx`:** traducción completa de `about.jsx` con:
   - Hook `useReveal()` con `IntersectionObserver` (threshold 0.12, class `.in`).
   - Componente `HighlightIcon` con los 3 SVGs pixel-art (HEART, BROWSER, PLANT).
   - Sección "ACERCA DE": eyebrow + título + misión + 3 highlight cards.
   - Divisor decorativo con píxeles parpadeantes.
   - Sección "CONTACTO": intro con tips + formulario controlado (`name`, `email`, `msg`).
   - `onSubmit`: valida vacíos en cliente (shake si falta algún campo), luego llama a `fetch('/api/contact', { method: 'POST', body: JSON.stringify(form) })`.
   - Si la respuesta es ok: muestra `terminal-success` con el nombre del usuario.
   - Si la respuesta falla (red o Resend): muestra mensaje de error visible en el formulario sin hacer shake.
   - Botón "ENVIAR OTRO MENSAJE" que resetea el formulario.
   - Props: `{ navigate: (r: Route) => void }`.
   Test: la ruta `'about'` muestra "ACERCA DE ARCADE VAULT"; el formulario vacío hace shake; el envío exitoso muestra la terminal.

9. **Verificación integral:** navegar a About desde el Nav, probar formulario vacío (shake), probar envío exitoso (terminal), probar con key inválida o sin `CONTACT_TO_EMAIL` (mensaje de error visible). Grep de `'about'` en el proyecto para confirmar referencias correctas. Test: `npm run build` sin errores; sin errores de consola al navegar por todas las pantallas.

---

## Acceptance criteria

- [ ] El Nav muestra enlace "Acerca" en desktop y en el panel mobile.
- [ ] Hacer clic en "Acerca" navega a la pantalla About (ruta `'about'`).
- [ ] La sección "ACERCA DE" muestra el título "ACERCA DE ARCADE VAULT", la misión y las 3 highlight cards con sus SVGs.
- [ ] Las animaciones `.reveal` se activan al hacer scroll en la pantalla About.
- [ ] El formulario de contacto valida campos vacíos con animación shake sin llamar a la API.
- [ ] Al enviar el formulario con los tres campos rellenos, se hace `POST /api/contact`.
- [ ] Si la respuesta es exitosa, aparece la terminal de éxito con el nombre del remitente.
- [ ] Si la respuesta falla (red o error de Resend), el formulario muestra un mensaje de error visible.
- [ ] Con `RESEND_API_KEY` válida, Resend envía el email a `CONTACT_TO_EMAIL` con asunto `[Arcade Vault] Mensaje de {nombre}`.
- [ ] Si `CONTACT_TO_EMAIL` no está definida en el entorno, la API devuelve 500 con mensaje descriptivo.
- [ ] `npm run build` termina sin errores de TypeScript ni de compilación.
- [ ] No hay errores de consola al cargar About, usar el formulario y navegar entre todas las pantallas.

---

## Decisiones

- **Ruta `'about'` en inglés** — coherente con `'home'`, `'games'`, `'auth'`; mantiene el código TypeScript en un solo idioma.
- **From `onboarding@resend.dev`** — sandbox de Resend hasta que el usuario tenga un dominio verificado en su panel. El sandbox solo entrega al email del owner de la cuenta Resend; documentar en `.env.local`.
- **`CONTACT_TO_EMAIL` como variable de entorno** — evitar hardcodear emails personales en el código; facilita cambiar el destino sin tocar el código.
- **Asunto `[Arcade Vault] Mensaje de {nombre}`** — aprobado por el usuario.
- **Error visible, no shake** — el shake está reservado para validación de campos vacíos (feedback de cliente); el error de red o API es una categoría distinta y merece un mensaje descriptivo.
- **Validación en cliente y en servidor** — el cliente valida antes de llamar a la API (evita llamadas innecesarias); el servidor valida igualmente (defensa en profundidad).
- **Sin rate limiting en este spec** — fuera del scope del MVP; se puede añadir en un spec posterior con middleware de Next.js.
- **`.btn.press` como extensión de `.btn`** — no es un nuevo componente base; se añade como modificador en globals.css igual que `.btn.ghost` o `.btn.xl`.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| El sandbox de Resend solo entrega al email del owner de la cuenta | Documentarlo en `.env.local` con comentarios; en producción cambiar from a dominio propio verificado |
| `CONTACT_TO_EMAIL` no configurada en producción | La API route devuelve 500 con mensaje descriptivo; el formulario lo muestra como error visible |
| `.env.local` accidentalmente en el repo | Verificar que `.gitignore` contiene `.env.local` antes de hacer commit |
| CSS de About colisiona con clases ya migradas | Revisar existencia antes de copiar cada bloque; `.field`, `.field input`, `.field label` ya existen de SPEC 01 |
