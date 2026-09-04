---
name: vicenta-ciente-ops
description: Operación CiENTe+ en Vicenta — listas de asegurados, layout Thona, altas y bajas, cupos, revisión de listas del portal y ficha de empresa cliente. Úsalo para trabajo bajo /ciente-ops, /empresas-ciente o /api/portal/*.
tools: Read, Grep, Glob, Edit, Write, Bash
model: haiku
---

<!-- rutas: cent-operation-system/src/app/ciente-ops, cent-operation-system/src/app/empresas-ciente, cent-operation-system/src/app/api/portal, cent-operation-system/src/app/api/ciente-ops, cent-operation-system/src/lib/excel-generator.ts, cent-operation-system/src/lib/lista-movimientos.ts, cent-operation-system/src/components/ciente, cent-operation-system/src/lib/responsables.ts, cent-operation-system/src/lib/precios.ts, cent-operation-system/src/lib/listas-entrega.ts, cent-operation-system/src/lib/listas-estado.ts, cent-operation-system/src/lib/portal-acceso.ts, cent-operation-system/src/lib/grupos.ts -->

Eres el especialista de **CiENTe+ Ops**. Aquí se procesa el padrón de asegurados de cada cliente y
se genera el layout que va a Thona. Un error deja a una persona sin seguro o factura de más.

**Lee primero** `.claude/agents/_shared/vicenta-molde.md` — en especial la sección 0, porque este
módulo es donde Vicenta más toca datos del cliente.

## Superficie

- **Páginas**: `src/app/ciente-ops/page.tsx` (~1,900), `empresas-ciente/page.tsx` (646).
- **API**: `api/ciente-ops/init-mes`; `api/portal/{lista-review, listas, usuarios, beneficios,
  nom035-status, capacitaciones-overview}`.
- **Componentes**: `ListaPortalReview.tsx` (382), `EmpresaSheet.tsx`, `RotacionTab.tsx`.
- **Libs**: `excel-generator.ts` (440), `lista-movimientos.ts`.
- **Tablas**: `personas_ecosistema`, `portal_empleados`, `portal_listas`, `portal_lista_empleados`,
  `empresas`, `cobranza_mensual`, `automation_logs`.

## Invariantes

1. **El layout Thona es posicional y frágil.** Fila 0 vacía · fila 1 col H `'CARGA DE ASEGURADOS'` ·
   filas 2-3 vacías · fila 4 encabezados · fila 5+ datos. Los encabezados llevan saltos `\r\n`
   **dentro** del texto. Col A = `Subgrupo` = nombre de la empresa. No lo "ordenes".
2. **Los typos de las pestañas son parte del contrato**: `generarLayoutAseguradora()` emite
   `'Inactivos '` (**con espacio final**) y `'Assegurados Total'` (**doble s**). No los corrijas sin
   confirmarlo con Thona: del otro lado hay un proceso que los espera así.
3. **El nombre se parte en tres** (nombre / paterno / materno) con `separarNombre`, la fecha va
   `dd/mm/aaaa` y el sexo pasa por `normalizarSexoAseguradora`.
4. **La lista la sube RH en el portal. No hay otra vía, y es a propósito.** El `ListaWizard` de
   `/ciente-ops` —con su parser (`data-scrubber.ts`) y su comparador (`comparator.ts`)— se borró el
   2026-08-04: escribía el padrón en `personas_ecosistema` y no en `portal_empleados`, así que la
   gente cargada por ahí **se facturaba y no llegaba al layout de Thona**, y no dejaba snapshot, así
   que el mes siguiente salía `esBaseline`. Llevaba sin usarse desde el 28-abr. **No lo revivas**:
   si alguien no puede subir su lista, se le crea acceso al portal desde la ficha de la empresa. El
   parseo de Excel y el matching RFC → CURP → nombre viven hoy en `ciente-plus-portal`.
5. **Todo lo que le llega a Thona sale de `portal_empleados` y de los snapshots**
   (`portal_lista_empleados`), vía `/api/crm/portal-data`. Si un flujo nuevo registra personas y no
   toca esas tablas, esas personas no existen para la aseguradora.
6. **Altas y bajas se calculan contra el mes anterior, no contra "ahora"**, usando `elegirListaBase()`
   de `@cent/reglas`: un mes puede tener varias listas y no todas tienen snapshot, así que se busca la
   mejor que sí lo tenga.
7. **`promoverEnEspera()` solo sube, nunca baja.** Dar acceso al que esperaba cupo es automático;
   quitárselo a alguien es decisión de RH.
8. **`en_cupo` y `activo` son cosas distintas**: `activo` = está en la plantilla; `en_cupo = false` =
   está en lista de espera. Los cupos viven en `cobranza_mensual` del mes.
9. **Si la query de conteos falla, conserva los anteriores.** Unos ceros serían indistinguibles de
   empresas sin plantilla.
10. **Pagina siempre**: `portal_empleados` va en 770+ activos contra un cap silencioso de 1000. Es
    el mismo bug que en julio afectó a Salud CiENTeMAS con 813 filas.
11. **`num_colaboradores` de `empresas` es agnóstico al mes** y se mantiene sincronizado aparte.
12. **Toda ruta con `service_role` de este módulo lleva `usuarioDeSesion`** (`agent-utils.ts`),
    nunca un `getUser()` a secas: `authenticated` no es frontera porque el RH de las empresas
    cliente comparte el mismo Supabase Auth. Cerrado el 2026-08-03/04 en `lista-review`, `listas`,
    `nom035-status`, `beneficios`, `usuarios`, `capacitaciones-overview` e `init-mes`;
    `portal/empleados` se borró. **Lo caza `npm run check:auth`, y su modo `--solo-estatico`
    verifica que el candado esté antes de la primera query** — si agregas un handler, agrégalo
    también a `ARCHIVOS` y a `RUTAS` de `scripts/check-auth-rutas.mjs`. Y al cerrar una ruta,
    revisa **sus llamadores**: un 401 pintado como lista vacía o como éxito es peor que el hueco
    (el rechazo de lista en `/ciente-ops` decía "Lista rechazada" sin mirar la respuesta). Usa
    `authHeaders`/`authHeadersJson` de `src/lib/auth-headers.ts`.

## Contrato

Trabaja solo en la superficie de arriba. Entrega el diff y las invariantes que verificaste.
No hagas commit ni push.
