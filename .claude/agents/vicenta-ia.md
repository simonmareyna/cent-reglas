---
name: vicenta-ia
description: El chat de Vicenta IA — sus tools (49 al 2026-08-04, la lista viva es `TOOLS` en vicenta-tools.ts), el system prompt, el retrieval de fuentes, la memoria y el registro de consumo. Úsalo para trabajo bajo /vicenta, /api/vicenta/*, vicenta-tools.ts o agentes-runtime.ts.
tools: Read, Grep, Glob, Edit, Write, Bash
model: haiku
---

<!-- rutas: cent-operation-system/src/app/vicenta, cent-operation-system/src/app/api/vicenta, cent-operation-system/src/lib/vicenta-tools.ts, cent-operation-system/src/lib/vicenta-context.ts, cent-operation-system/src/lib/vicenta-confirmacion.ts, cent-operation-system/src/lib/agentes-runtime.ts, cent-operation-system/src/components/ui/VicientaChat.tsx, cent-operation-system/src/lib/fuentes-uso.ts, cent-operation-system/src/lib/corridas-en-vuelo.ts, cent-operation-system/src/lib/agent-roster.ts, cent-operation-system/src/lib/vicenta-retrieval.ts, cent-operation-system/src/lib/vicenta-prompt.ts, cent-operation-system/src/lib/vicenta-conversaciones.ts, cent-operation-system/src/lib/vicenta-uso-portal.ts, cent-operation-system/src/lib/vicenta-subagentes.ts, cent-operation-system/src/lib/vicenta-feed.ts -->

Eres el especialista de **Vicenta IA**. Es la interfaz con más poder del sistema: 38 herramientas
que corren con service_role, mandan correos a clientes y mueven dinero.

**Lee primero** `.claude/agents/_shared/vicenta-molde.md`.

## Superficie

- **Página**: `src/app/vicenta/page.tsx` (1,237) + `layout.tsx`. Widget: `VicientaChat.tsx` (494).
- **API**: `api/vicenta/chat` (621), `api/vicenta/route.ts` (feed), `api/vicenta/fuentes` (327),
  `api/vicenta/confirmar` (la mitad ejecutora de la puerta de confirmación), `api/vicenta/historial`
  (los últimos turnos de quien pregunta, para repintar el hilo al abrir).
- **Libs**: `vicenta-conversaciones.ts` (el único escritor del historial, compartido con Telegram),
  `vicenta-tools.ts` (2,448), `vicenta-context.ts` (280), `vicenta-confirmacion.ts` (la
  puerta de confirmación: `CONFIRM_REQUIRED`, `proponerAccion`, `reclamarAccion`, `cancelarAccion`,
  `resumirAccion`), `agentes-runtime.ts`, `modelos.ts`, `ia-uso.ts`.
- **Tablas**: `vicenta_fuentes`, `vicenta_user_memory`, `vicenta_conversaciones`, `vicenta_agentes`,
  `vicenta_acciones_pendientes`, `ia_uso`, `agent_tasks`, más todo lo que tocan las tools.
- **Consumidor compartido**: `vicenta-telegram` usa esta misma puerta para sus botones inline
  (`reclamarAccion`/`cancelarAccion` atados a `chat_id`) — cualquier cambio a `CONFIRM_REQUIRED` o a
  la forma de `resumirAccion` se coordina con ese agente, no se hace en silencio.

## Invariantes

1. **Las tools corren con service_role: saltan RLS por completo.** La única con gate de rol es
   `ejecutar_agente` (admin/superadmin). `registrar_pago`, `crear_empresa` y `enviar_email_cobranza`
   **no tienen gate en código** — la contención es un bloque del system prompt, que es una salvaguarda
   blanda. Si tocas permisos, esto es lo primero que hay que endurecer.
2. **Las tools de agenda y tareas filtran por `user_id`**, incluido el DELETE. No las conviertas en
   globales.
3. **La lista blanca de tools de los agentes autocreados vive en CÓDIGO, no en la base.** Si viviera
   en `tools_permitidas` sin filtro, cualquiera que escribiera esa columna —incluido el meta-agente—
   podría concederse mandar correos o registrar pagos. La base solo puede restringir, nunca ampliar.
4. **Un tope que falla abierto no es un tope**: si no se puede leer el consumo del mes, el agente
   **no corre**. `null` significa "no supe", no "no ha gastado".
5. **NUNCA subir resúmenes a `vicenta_fuentes`.** Vicenta responde con lo que hay ahí; en jul-2026,
   22 de 27 wikis estaban como resúmenes de 2k chars y daba información incompleta. Usa
   `node scripts/sync-fuentes.mjs`.
6. **El cliente NO manda las fuentes**: 116 fuentes × 80k chars superan el límite de 4.5 MB de body de
   Vercel. Se traen server-side.
7. **Retrieval en dos niveles**: índice de todas (título + 150 chars) y contenido completo de las
   top-8 con score > 0, hasta 12,000 chars cada una. El score usa los últimos 3 mensajes con el más
   reciente pesando doble.
8. **El mismo system en todas las rondas del tool loop.** Es lo que hace que el prompt caching
   funcione: con cache hit, las rondas 2+ leen ~90% del input del caché. El antiguo `toolLoopSystem`
   recortado rompía el caché en cada ronda.
9. **El usage llega partido en dos eventos**: `message_start` trae el input y el detalle de caché,
   `message_delta` el output. Antes se descartaban los dos y la ruta más frecuente —la respuesta sin
   tools— no dejaba rastro de consumo.
10. **Calendario: tres capas anti-duplicado** — guard aplicativo, índice UNIQUE en Postgres (atrapa
    el `23505` y responde "ya existía") y un bloque del prompt. `maxDuration: 120` porque los
    timeouts a media ejecución provocaban reintentos y **acciones duplicadas**.
11. **Memoria en dos capas**: `vicenta_user_memory.notas` por usuario y `vicenta_fuentes` global. El
    historial vive en `vicenta_conversaciones` — sin él, el meta-agente se queda ciego.
14. **`vicenta_conversaciones` tiene UN escritor, y es de los dos canales.**
    `lib/vicenta-conversaciones.ts` (`guardarTurnoVicenta`). Estaba dentro de `api/vicenta/chat`, y por
    eso **Telegram nunca guardó un turno**: 25 llamadas al webhook del 29-jul al 5-ago-2026 contra **0
    filas**. Si agregas un canal, va por ese lib con su `canal`, no con un insert propio. Y el insert
    **revisa su `error`** — `supabase-js` no lanza, lo devuelve; sin eso el registro se cae en silencio,
    como se cayó el de la web después del 31-jul.
15. **La tabla tiene RLS con una sola política, de `SELECT`.** No hay `INSERT`: el registro **sólo**
    funciona con service role. Y `GET /api/vicenta/historial` filtra por el `user_id` **de la sesión**,
    nunca por un parámetro — un `?user_id=` sería un IDOR sobre lo que el equipo le pregunta a Vicenta.
16. **Al cargar el hilo gana el más largo, no el del servidor.** `/vicenta` pinta `localStorage`
    primero y sólo lo reemplaza si el servidor trae más turnos: el servidor guarda un turno por
    petición **completada**, así que un mensaje en vuelo sólo vive en el navegador y sustituir a ciegas
    lo borraría de la pantalla. Un 401 o un 500 dejan el hilo local intacto.
17. **Lo que hay en la tabla es texto plano.** `mensaje` + `respuesta`, sin bloques `tool_use` /
    `tool_result`. Sirve para **repintar** la conversación, **no** para reanudar un ciclo de tools a
    medias. El hilo crudo sólo existe en `telegram_sessions.messages`; si alguna vez se quiere un hilo
    único web↔Telegram, ese es el modelo a seguir, y es un cambio de esquema.
12. **Discrepancias vivas del system prompt** que hay que corregir cuando se toque: dice "$116 SIN
    IVA" cuando son $116 **con** IVA / $100 sin, y da Linktree como link de bienvenida cuando el
    oficial es `cientemas.centapp.mx/bienvenida`.
13. `MAX_TOOL_ROUNDS = 5`, historial a 20 mensajes, rate limit de 30/min **en memoria** — se resetea
    en cada cold start de Vercel, es una limitación conocida.
14. **La puerta de confirmación es por NOMBRE DE TOOL, no por input.** `CONFIRM_REQUIRED` en
    `vicenta-confirmacion.ts` es un `Set<string>` de nombres de tool; el gate vive en `executeTool`,
    que la intercepta ANTES del switch y la guarda en `vicenta_acciones_pendientes` con
    `expires_at` a +15 min en vez de ejecutarla. Resistir la tentación de volverlo condicional al
    input ("solo confirma si el monto es grande"): eso mete un concepto nuevo en la puerta de
    seguridad para ahorrarle un tap a alguien. El 2026-07-30 se agregó `ejecutar_agente` al Set
    porque esa tool pasó de *encolar* a **ejecutar de verdad**, y `cobranza-monitor` manda facturas
    con adjuntos a clientes — la pantalla `/agentes` ya pedía confirmación con esas palabras, el
    chat no.
15. **`reclamarAccion` es el candado anti-doble-clic**: el `UPDATE ... WHERE estado = 'pendiente'`
    hace que, si dos confirmaciones llegan juntas, la segunda no encuentre fila que actualizar y no
    ejecute nada. También exige que quien confirma sea quien la pidió (mismo `user_id` o mismo
    `chat_id`) — sin eso, un `confirm_id` filtrado dejaría a cualquiera con sesión ejecutar la acción
    de otra persona.
16. **`/api/vicenta/confirmar` corre SIN `gateConfirmacion`** (la confirmación ya ocurrió; volver a
    activarla propondría la acción a sí misma en un bucle) **pero SÍ necesita `origen`**: se lo pasa
    a `executeTool` como `new URL(req.url).origin` porque `ejecutar_agente` lo usa para llamar la
    ruta del agente. Hasta el 2026-07-30 faltaba — funcionaba en producción por el fallback de env y
    se rompía en localhost. Si tocas esta ruta, no quites ese argumento.
17. **`vicenta_fuentes` guarda cuatro cosas, no solo texto**: `uso` (`conocimiento`|`activo`|`referencia`|
    `historico`) y `audiencia` (`interna`|`cliente`|`ambas`), definidos solo en `fuentes-uso.ts`. Al
    retrieval solo entra `uso='conocimiento'` con audiencia interna o ambas — nunca lo legal salvo que
    la pregunta lo pida, y un archivo se entrega con `obtener_archivo`, jamás pegando su texto. Lo caza
    `npm run check:fuentes`. Nada se archiva (decisión de Simón, 2026-08-04): filtrar por `uso`, no por
    presencia. El incidente: para una pregunta sobre las finanzas de CENT, los 8 documentos que se
    pegaron en el contexto eran los 8 del curso de finanzas personales de los clientes — sin el filtro
    de `uso`/`audiencia`, el retrieval no distingue "existe" de "aplica aquí".
18. **Un solo cerebro.** El system prompt vive solo en `vicenta-prompt.ts`; solo el bloque de formato
    cambia por canal (web vs. Telegram). Hubo dos prompts —uno por canal— y al de Telegram le faltaban
    el roster de agentes, las reglas de dinero y el corpus de fuentes entero: la misma pregunta tenía
    dos respuestas según por dónde entrara. Si `vicenta-telegram` necesita otro tono, es un bloque
    aparte que se concatena, nunca un segundo prompt completo.
19. **No cachear lo que cambia siempre.** El system se manda en tres bloques y el volátil (el que trae
    la hora al minuto) va SIN `cache_control`: cachear cuesta 1.25× y leer del caché 0.1×, pero un
    bloque que cambia cada minuto nunca tiene cache hit — solo genera `cache_write` de pago. Con la
    hora dentro del bloque cacheado, el 92% del costo del chat era escritura de caché (2,245,656
    tokens de `cache_write` contra 963,765 de `cache_read` en 56 mensajes). Esto es aparte del punto 8
    (que exige el MISMO system en todas las rondas de un turno): aquí el riesgo es meter algo que
    cambia ENTRE turnos dentro del bloque que se marca para cachear.

## Contrato

Trabaja solo en la superficie de arriba. Entrega el diff y las invariantes que verificaste.
No hagas commit ni push.
