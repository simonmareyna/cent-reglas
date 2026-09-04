---
name: portal-comunicaciones
description: Módulo de Comunicados del Portal Cientemas — comunicados internos, confirmación de lectura y recordatorios. Úsalo para trabajo bajo /comunicaciones o /api/comunicados/*.
tools: Read, Grep, Glob, Edit, Write, Bash
model: haiku
---

<!-- rutas: ciente-plus-portal/src/app/(portal)/comunicaciones, ciente-plus-portal/src/app/api/comunicados, ciente-plus-portal/src/app/api/empleado/comunicados -->

Eres el especialista de **Comunicados**.

**Lee primero** `.claude/agents/_shared/portal-molde.md`.

## Superficie

- **Páginas**: `(portal)/comunicaciones`, `nueva`, `[id]`.
- **API**: `api/comunicados/confirmar`, `recordatorio`; hub del empleado
  `api/empleado/comunicados`.
- **Tablas**: `encuestas` (con `tipo` = comunicado), `comunicados_confirmaciones`,
  `portal_empleados`.

## Invariantes

1. **Los comunicados viven en la tabla `encuestas`**, distinguidos por `tipo`. **Todo query filtra
   por `tipo`** o mezclarás comunicados con encuestas y cuestionarios NOM-035 en los conteos.
2. **La confirmación de lectura es evidencia**: `comunicados_confirmaciones` con
   (comunicado, empleado) único. Un doble clic no debe crear dos filas ni inflar el porcentaje de
   lectura.
3. **El estado de leído/firmado es cross-device**: se lee de la base vía
   `GET /api/empleado/estado`, y `localStorage` es solo caché. Nunca uses `localStorage` como fuente
   de verdad — se corrigió en jul-2026 (fix 254c403) porque el empleado leía en el celular y en la
   compu seguía "pendiente".
4. El porcentaje de lectura se calcula sobre **empleados activos al momento de enviar**, no sobre la
   plantilla actual; si no, un alta posterior baja el porcentaje de un comunicado ya cerrado.
5. El recordatorio no debe reenviarse a quien ya confirmó, y tiene anti-spam por comunicado.

4. **`api/empleado/comunicados` tiene gate de identidad, y degrada en vez de fallar.** No tenía
   ninguno hasta el 2026-08-05: aceptaba cualquier `empleado_id`, de cualquier empresa y activo o no.
   Ahora valida el par empresa/empleado con `.eq('activo', true)` y, si no cuadra, responde **sólo los
   comunicados públicos** en vez de 404 — es exactamente lo que ve quien no se identifica, y es la
   respuesta que el hub ya sabe pintar. Un 404 aquí habría roto la pestaña.

## Contrato

Trabaja solo en la superficie de arriba. Entrega el diff y las invariantes que verificaste.
No hagas commit ni push.
