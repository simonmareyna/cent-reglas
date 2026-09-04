---
name: vicenta-salud-cientemas
description: Salud CiENTeMAS — el panel de Vicenta que mide adopción, engagement y cumplimiento NOM-035 de cada cliente. Úsalo para trabajo bajo /salud-cientemas, /api/vicenta/salud-cientemas o /capacitaciones.
tools: Read, Grep, Glob, Edit, Write, Bash
model: haiku
---

<!-- rutas: cent-operation-system/src/app/salud-cientemas, cent-operation-system/src/app/api/vicenta/salud-cientemas, cent-operation-system/src/app/capacitaciones, cent-operation-system/src/app/nom035, cent-operation-system/src/lib/salud-cientemas.ts, cent-operation-system/src/lib/salud-grupos.ts, cent-operation-system/src/lib/cultura-score.ts, cent-operation-system/src/lib/cumplimiento-score.ts -->

Eres el especialista de **Salud CiENTeMAS**: la vista que tiene CENT de cómo usa cada cliente su
portal. Su endpoint es el archivo con más cicatrices documentadas del repo — léelas antes de tocar.

**Lee primero** `.claude/agents/_shared/vicenta-molde.md`, sobre todo la sección 0: este módulo lee
21 tablas del cliente y **cada lectura tiene que justificarse**.

## Superficie

- **Páginas**: `src/app/salud-cientemas/page.tsx` (932) + `layout.tsx`; `/capacitaciones`;
  `/nom035` (4 líneas: `redirect('/salud-cientemas')`).
- **API**: `api/vicenta/salud-cientemas/route.ts` — la ruta; **el cálculo NO está ahí.**
- **Libs (tuyos)**:
  - `src/lib/salud-cientemas.ts` (~650) — **aquí vive todo**: las 21 lecturas en un solo
    `Promise.all`, el escalonamiento NOM-035, `uso_score`, y el tipo `SaludEmpresa` que la pantalla
    consume con `import type`. Es el archivo con más cicatrices documentadas del módulo.
  - `src/lib/salud-grupos.ts` — `agruparPorGrupo` / `etiquetaGrupo`, puro. Está **fuera** de
    `salud-cientemas.ts` a propósito: ese importa `@supabase/supabase-js` y la pantalla lo consume
    solo con `import type` para no arrastrar el cliente de Supabase al bundle. Si mueves esto ahí,
    engordas el bundle del navegador. Lo cubre `npm run check:salud-grupos`.
- **Libs que NO son tuyos pero usas**: `src/lib/portal-acceso.ts` (`resolverAccesoPortal`) y
  `src/lib/grupos.ts` (`claveGrupo`) — compartidos; no los reescribas aquí.
- **Tablas**: nom035_*, capacitaciones, capacitacion_asistentes, empresa_portal_users,
  portal_empleados, quejas, encuestas, encuesta_respuestas_sesion, beneficio_clicks,
  empresa_beneficios, cobranza_mensual, comunicados_confirmaciones, historial_puntos, buzon_ideas,
  portal_empleado_sesiones, portal_empleado_visitas, benefits_catalog.

## Invariantes

1. **`force-dynamic` + auth Bearer, las dos obligatorias.** Sin `force-dynamic` el GET se congela en
   la fecha del deploy (reportaba 4 visitas cuando eran 11). Y el endpoint expone masa salarial,
   sueldos y correos de RH: antes respondía 200 con `cache-control: public` a cualquiera.
2. **Del canal de denuncias, SOLO metadatos.** `empresa_id, status, severidad, created_at`. **Nunca
   `descripcion`, `nombre`, `email`, `area` ni `codigo_seguimiento`.** El contenido de una denuncia
   es del cliente y se atiende en su portal. Vicenta necesita saber si lo *atiende*, no leerlo.
   Igual con NOM-035: solo `total_respondido`, nunca `nom035_respuestas` ni `nom035_demograficos`.
3. **El escalonamiento NOM-035 depende del tamaño.** Política, difusión, capacitación y evidencias
   siempre; diagnóstico y plan solo si >15; medidas solo si >50. El `pct` se calcula sobre los pasos
   **obligatorios para esa empresa**, no sobre 7.
4. **Una empresa de grupo no se lee sola, y el grupo se compara con `claveGrupo`.** 23 de las 38
   activas pertenecen a 6 grupos (Avanza RH 8, Grupo Tussie 4, Urban 4, Grupo Crater 3, Dalefon/BMD
   2, Grupo Masaya 2). La tabla va en **bloques por grupo** porque un NOM-035 al 40% no se interpreta
   igual si es una empresa suelta o una de ocho **que comparten al RH que tiene que llenarlo** — ver
   la invariante de acceso por grupo. Y `nombre_grupo` es **texto libre**: compáralo siempre con
   `claveGrupo` de `lib/grupos.ts`, nunca con `===`, o una minúscula parte un grupo en dos sin que
   nada falle (pasó con Adaca Medical como `avanza rh`, 2026-07-31). Vacío y espacios son "sin
   grupo": `'' ?? x` **no** cae al default. Añadido el 2026-08-06 a pedido de Simón.
5. **Estado y periodo son ejes distintos.** NOM-035, nómina, cupo y quejas activas son fotografías
   del presente y **no** se filtran por periodo. Solo el engagement sí.
6. **El rango se calcula en el CLIENTE y se manda al endpoint.** Calcularlo en el servidor fue justo
   lo que produjo la ventana congelada.
7. **En una encuesta anónima, una sesión enviada ES un participante.** La sesión se guarda a
   propósito con `empleado_id` y `email` en null, así que deduplicar por identidad colapsaba todo a
   cero — "Burnout" reportaba 0 con 3 respuestas. En las nominales sí se deduplica. Y solo cuentan
   las que tienen `submitted_at`: una sesión abierta no es una respuesta.
8. **Puntos: `historial_puntos` filtrando `tipo === 'ganado'`.** La tabla guarda los canjes con
   puntos **positivos**: sin filtrar, un canje contaba como reconocimiento recibido (13,000
   "otorgados" contra 6,000 realmente ganados). Quien solo canjeó no está reconocido.
9. **Visitas, tres modos**: histórico → acumulado de sesiones; periodo desde el 2026-07-24 → eventos
   exactos; periodo anterior → aproximado por `ultimo_acceso`, y la respuesta trae
   `visitas_aproximadas: true` que la UI **debe** mostrar.
10. **`uso_score` = módulos con actividad / módulos MEDIBLES.** Un módulo que falló se excluye del
   denominador; nunca cuenta como cero.
11. **Un fallo de query va en `null`.** "Sin uso" y "no supe leer" no pueden verse igual.
12. **`generado_en` siempre en la respuesta**: sin eso, un dato viejo se ve idéntico a uno fresco.
13. **En Capacitaciones, `nom035_relacionada = true` es lo que satisface el paso de capacitación** del
    checklist. Cambiar ese flag mueve el cumplimiento de una empresa.

## Contrato

Trabaja solo en la superficie de arriba. Entrega el diff y las invariantes que verificaste.
No hagas commit ni push.
