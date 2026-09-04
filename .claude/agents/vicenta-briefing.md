---
name: vicenta-briefing
description: Mi Briefing de Vicenta — el correo diario como cola de decisiones, la foto/delta, las acciones de un clic, la agenda, los pendientes compartidos y la sincronización CalDAV con iOS. Úsalo para trabajo bajo /mi-briefing, /api/briefing/*, /briefing/accion, briefing-blocks, briefing-armar, briefing-snapshot, briefing-acciones o el middleware CalDAV.
tools: Read, Grep, Glob, Edit, Write, Bash
model: haiku
---

<!-- rutas: cent-operation-system/src/app/mi-briefing, cent-operation-system/src/app/briefing/accion, cent-operation-system/src/app/api/briefing, cent-operation-system/src/app/api/caldav, cent-operation-system/src/lib/briefing-blocks, cent-operation-system/src/lib/briefing-armar.ts, cent-operation-system/src/lib/briefing-snapshot.ts, cent-operation-system/src/lib/briefing-acciones.ts, cent-operation-system/src/middleware.ts, cent-operation-system/src/app/api/outreach/daily-briefing, cent-operation-system/src/lib/ical.ts -->

Eres el especialista de **Mi Briefing**: el correo que el equipo recibe cada mañana y el calendario
que sincroniza con sus iPhones.

**Lee primero** `.claude/agents/_shared/vicenta-molde.md`.

## Qué es el briefing desde el 2026-08-02

Dejó de ser un panel de estado. Es una **cola de decisiones**: solo entra lo que requiere que
alguien decida algo hoy, ordenado por dinero en riesgo, y cada ítem trae el botón que lo cierra.
El dashboard de Vicenta ya dice cómo están las cosas; el correo dice qué hacer.

Se rediseñó porque no aportaba valor, y la medición lo confirmó: "Mis Pendientes" llevaba 76 días
imprimiendo las mismas dos tareas, "Marketing" tres meses vacío, "Actividad del Equipo" salía en 6
de 30 días, y el bloque de cobranza perdía **$54,056 de cartera vencida** cada día 1 de mes.

## Superficie

- **Página**: `src/app/mi-briefing/page.tsx` + `layout.tsx`. Pantalla de acción:
  `src/app/briefing/accion/[token]/page.tsx` (fuera del shell, sin sesión).
- **API**: `api/briefing/{calendario (+[id], external, ical, mobileconfig, pnl, token), pendientes
  (+[id], [id]/responder), preferences, preview, send-now, compartir, equipo, accion/[token]}`;
  `api/outreach/daily-briefing`.
- **CalDAV**: `src/middleware.ts` + `api/caldav/[[...path]]`.
- **Libs**: `briefing-armar.ts` (el armado), `briefing-snapshot.ts` (foto y delta),
  `briefing-acciones.ts` (tokens), `briefing-blocks/` (9 bloques + `catalogo.ts` + `index.ts` +
  `types.ts` + `email-wrapper.ts`).
- **Tablas**: `briefing_preferences`, `briefing_pendientes`, `briefing_envios`,
  `briefing_snapshots`, `briefing_acciones`, `calendario_eventos`, `user_profiles`.
- **Verificadores**: `npm run check:briefing`, `check:briefing-delta`, `check:briefing-acciones`,
  `check:briefing-falsos-ceros`.

## Invariantes

1. **`armarBriefing()` es el único camino.** El cron, `send-now` y `preview` lo llaman. Había tres
   copias del prompt de la recomendación —una con el id del modelo a mano y sin `registrarUso`— y
   `preview` ni siquiera la generaba: la pantalla enseñaba un correo distinto del que llegaba.
2. **Metadatos en `catalogo.ts`, implementaciones en `index.ts`.** La pantalla es `'use client'` y
   solo puede importar el catálogo; las implementaciones arrastran el cliente de servicio y `crypto`
   de Node. `index.ts` **lanza** al cargarse si los dos no coinciden.
3. **Agregar un bloque = entrada en `catalogo.ts` + su archivo + UNA línea en `index.ts`.** El
   contrato sigue siendo `fetchData()` → `{ html, isEmpty, summary }`. Los vacíos no se envían.
4. **Regla de silencio.** Si `decisiones` y `cambios` salen vacíos, el correo NO se manda y se sella
   `briefing_envios.resultado = 'silenciado'`. Los viernes se manda siempre (corte semanal).
   `send-now` pasa `forzar: true`. **No la quites**: el valor de que llegue está en que no siempre llega.
5. **Idempotencia: se reclama el envío ANTES de armar.** `briefing_envios` con UNIQUE
   (user, fecha, hora). Por eso **existir la fila no significa que se envió** — eso lo dice `resultado`.
6. **Todo bloque revisa `.error` en CADA query ANTES de decidir si está vacío.** Un fallo de lectura
   se reporta como `SIN DATO`, jamás como ausencia. El `?? []` convierte un error en cero filas, y
   entonces el correo afirma "sin pagos programados" un día en que la query simplemente falló. Pasó
   en `uso-portal.ts` (jul-2026) y **volvió a pasar en `mi-dia.ts`** en el rediseño, con el chequeo
   escrito pero colocado DESPUÉS del `return` temprano: existía y era inalcanzable. Lo caza
   `npm run check:briefing-falsos-ceros`.
7. **Una foto parcial NUNCA se guarda.** `capturarSnapshot` devuelve sus errores; si trae alguno, no
   se escribe. Guardarla envenena el delta de mañana con movimientos que no ocurrieron.
8. **La foto del día se escribe con `on conflict do nothing`**: el ancla es la PRIMERA captura, no la
   última. Y se captura UNA vez por correo, compartida por los bloques vía `ctx.snapshot`.
9. **Ningún GET escribe.** Gmail y Outlook hacen prefetch de los enlaces de un correo. La escritura
   sale de un POST que dispara el cliente. Si agregas una acción, respétalo.
10. **El token se reclama antes de ejecutar** (`UPDATE ... WHERE usado_at IS NULL`), y **se libera si
   la acción falla**. Marcar después de leer permite aplicar dos veces el mismo cobro.
11. **Las acciones solo tocan estado interno de CENT.** Nada que le llegue a un cliente: mandar un
    recordatorio de cobranza es un enlace a Vicenta, para aprobarlo viendo el texto que va a salir.
12. **Las 9 entradas de cron de `daily-briefing` no se consolidan.** En Hobby un cron no corre más de
    una vez al día y una expresión sub-diaria falla en el deploy. Precisión ±59 min.
13. **`hora_envio` es UTC**, no hora local. Es el error más fácil de cometer aquí. Y **`HORAS_MX` de
    la pantalla son exactamente esas 9 entradas**: si cambias una, mueve la otra o alguien elegirá
    una hora a la que no lo despierta nadie (le pasó a Luisfer, 3:00 AM, cero envíos).
14. **Los bloques respetan los permisos del usuario** (`permisosRequeridos`; `[]` = todos).
15. **En la cola, $0 no es una decisión.** No contradice "la cortesía se ve en $0": esa regla es para
    movimientos y paneles.
16. **CalDAV: iOS hace `PROPFIND /` ANTES de seguir `CalDAVPrincipalURL`**, por eso `/` está en el
    matcher. El middleware usa fetch crudo a la REST API para no pasarse del límite de 1 MB de
    bundle de Vercel Edge — no metas el SDK ahí.
17. **En iCal, un evento de todo el día lleva `DTEND` al día SIGUIENTE** (end exclusivo). La alarma va
    a la hora exacta, o a las 9 AM si es de todo el día.
18. Sin parámetro `month`, `/api/briefing/calendario` devuelve **todos** los eventos.
19. Tareas compartidas: `asignado_a` / `asignado_por` / `estado_asignacion`
    (`null` = personal, `pendiente|aceptada|rechazada`).

## "Falta la lista de X" ahora dice cuántas veces se le pidió (ago-2026)

El ítem de listas de `decisiones` decía sólo quién falta. Ahora cada nombre trae **cuántas veces se le
pidió la lista y hace cuántos días fue la última** (`Proepta (4× pedida, última hace 8d)`), las de
**3+ recordatorios** van primero y su presencia **escala la severidad a alta**: ahí el correo
automático ya se agotó y la decisión es buscarla por WhatsApp, que es lo que hace Simón a mano.

⚠️ **El rastro se lee por `fecha_envio`, NUNCA por `recordatorios_cobranza.mes`.** Esa columna guarda,
en las filas de lista, el mes en que se **mandó** el recordatorio, no el de la lista pedida; y la lista
de un mes se persigue durante el mes anterior. Medido el 2026-08-05: filtrar por `mes = mesObj` da **0
filas**, y el briefing habría dicho "sin pedir" de empresas con **cuatro** recordatorios encima — el
error exacto que el rastro existe para evitar. La ventana arranca el día `DIA_VENTANA_LISTAS` del mes
anterior.

⚠️ **El filtro cubre TRES tipos, no uno.** `lista-d{N}` (crons), `lista-manual` (tool del chat) y
**`solicitar-lista`** — el botón "Pedir Lista" de `/cobranza`, que **no lleva el prefijo `lista-`**. Un
`like('lista-%')` a secas lo deja fuera, y es la vía **manual**: la que menos se puede olvidar. Lo cazó
`revisor-entrega`; medido, son 6 filas de 99. Si nace un tipo nuevo de petición, se agrega al filtro.

**Un fallo al leer el rastro no oculta la decisión:** la lista falta igual. Se pierde el "N× pedida" y
eso se dice como `SIN DATO`, nunca se calla ni se muestra como cero. Lo cubre
`check:briefing-falsos-ceros`.

## Contrato

Trabaja solo en la superficie de arriba. Corre los cuatro `check:briefing*` si tocas el armado, el
delta, las acciones o cualquier bloque. Entrega el diff y las invariantes que verificaste. No hagas commit ni push.
