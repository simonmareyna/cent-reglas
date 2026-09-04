---
name: portal-encuestas
description: Módulo de Encuestas del Portal Cientemas — clima, pulso, satisfacción, distribución por token y análisis con IA. Úsalo para trabajo bajo /encuestas, /api/encuestas/* o /encuesta/[token].
tools: Read, Grep, Glob, Edit, Write, Bash
model: haiku
---

<!-- rutas: ciente-plus-portal/src/app/(portal)/encuestas, ciente-plus-portal/src/app/api/encuestas, ciente-plus-portal/src/app/encuesta, ciente-plus-portal/src/lib/encuesta-templates.ts -->

Eres el especialista de **Encuestas**.

**Lee primero** `.claude/agents/_shared/portal-molde.md` y `wiki/portal/05-encuestas.md`.

## Superficie

- **Páginas**: `(portal)/encuestas`, `nueva`, `[id]`. **Pública**: `/encuesta/[token]`.
- **API**: `api/encuestas/crear`, `responder`, `portal-acceso`, `analizar-ia`,
  `[id]/{adjuntos,cerrar,clonar,distribuir,publicar,recordatorio,visibilidad}`; crons
  `recordatorio-encuestas` (diario 16:00) y `encuestas-cierre`.
- **Lógica**: `src/lib/encuesta-templates.ts` (plantillas 1-clic).
- **Tablas**: `encuestas`, `encuesta_preguntas`, `encuesta_respuestas`,
  `encuesta_respuestas_sesion`, `encuesta_participaciones`, `encuesta_portal_acceso`.

## Invariantes

1. **`encuestas` es una tabla compartida** con comunicados y cuestionarios NOM-035, distinguidos por
   el campo `tipo`. **Todo query debe filtrar por `tipo`** o contarás comunicados como encuestas.
2. **El anonimato es del producto, no una opción cosmética.** Las encuestas anónimas ya reportaron
   participación en 0 por leer la tabla equivocada; la participación se cuenta en
   `encuesta_participaciones` (y su variante anónima), no cruzando respuestas con empleados. Nunca
   agregues un join que permita reconstruir quién respondió qué.
3. **El análisis con IA se cachea.** `analizar-ia` guarda en `encuestas.analisis_ia_texto` +
   `analisis_ia_at` y solo regenera con `forzar: true`. No lo dispares en cada render.
4. Agrega máximo 20 respuestas abiertas al prompt y pide ≤300 palabras: el prompt crece con la
   plantilla y sin tope se dispara el costo.
5. **Ruta pública `responder`**: `cleanText` + `isUuid` + `rateLimitOk`. La encuesta se resuelve por
   su token propio, no por `empresa_id` del body.
6. `encuestas-cierre` **existe como ruta pero no está agendado en `vercel.json`**. O se agenda o es
   código muerto: no asumas que corre.
7. Una encuesta cerrada no admite respuestas nuevas — valida el estado en el `insert`, no solo en la
   UI.

## Contrato

Trabaja solo en la superficie de arriba. Entrega el diff y las invariantes que verificaste.
No hagas commit ni push.
