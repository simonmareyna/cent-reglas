# El molde del Portal Cientemas

Fuente de verdad única para los subagentes `portal-*`. Cada uno lee este archivo al arrancar
en vez de repetir estas reglas veinte veces. Si una regla cambia, cambia aquí.

Repo: `ciente-plus-portal` → `cientemas.centapp.mx`. Next 14 App Router, React 18, Tailwind 3,
Supabase (`xixlkxegtcbrglhophdx`), Resend. **No hay tests en este repo.** Lo único que separa un
bug de producción es este molde y el `revisor-entrega`.

> **Ánclate en `$CLAUDE_PROJECT_DIR`.** Hay copias viejas del proyecto en el disco — entre ellas
> `/Users/simonmareyna/Vicenta operativo /`, de mayo–junio 2026. El 2026-07-28 un agente terminó ahí
> y reportó que los scripts de verificación "no existen". Usa siempre
> `"$CLAUDE_PROJECT_DIR/ciente-plus-portal"`, nunca un `cd` relativo ni una ruta bajo `~`. Si un
> archivo que este molde da por existente no aparece, sospecha de la copia antes de reportarlo como
> ausente.

---

## 1. Página del portal

Server Component + panel cliente hermano en el mismo directorio (`vacaciones/page.tsx` +
`vacaciones/vacaciones-panel.tsx` con `'use client'`).

```
createClient() → auth.getUser() → if (!user) redirect('/login')
createAdminClient()
getPageEmpresaId(user.email!) → if (!empresaId) redirect('/dashboard')
Promise.all([ ...todas las queries en paralelo, cada una .eq('empresa_id', empresaId) ])
normalizar joins de Supabase (una FK llega como array → conviértela a objeto)
<div className="p-6 lg:p-8 max-w-4xl mx-auto"> header eyebrow / h-page / text-meta + <XPanel />
```

`export const dynamic = 'force-dynamic'` en cuanto los datos puedan cambiar desde Vicenta.

**Y arriba del panel, el arranque:**

```tsx
<PuestaEnMarcha modulo="vacaciones" empresaId={empresaId} ruta="/vacaciones"
  accionLegal="registrar vacaciones y permisos" />   // accionLegal solo si es de encargo
```

No es decoración: es la respuesta a «¿qué le falta a este módulo para servir?», y hasta el
2026-09-04 solo NOM-035 la tenía. Ver §11.

## 2. API route autenticada

```
createClient() → auth.getUser()            → 401 'No autorizado'
getEffectiveEmpresaId(user.email!)         → 403 'Sin empresa'
createAdminClient()                        // todo el trabajo de DB va por service role
...query SIEMPRE con .eq('empresa_id', empresaId)
try/catch → console.error('VERBO /api/x:', err) + 500 'Error inesperado'
```

Los `UPDATE` llevan el estado esperado en el filtro (`.eq('estado','pendiente')`) y
`.select().maybeSingle()`; sin fila de vuelta → 404 "no encontrada o ya resuelta".
Es concurrencia optimista sin transacciones — respétalo.

## 3. API route pública (empleado, sin sesión)

```
cleanText(campo, maxLen) / isUuid(token)        // @/lib/public-validation
createAdminClient()
rateLimitOk(admin, `modulo:${ipDeRequest(req)}`, N, ventana) → 429   // @/lib/rate-limit (fail-open)
resolver empresa por token: .eq('<x>_token', tok).eq('ciclo_vida','Activo CiENTe+')
insert → crearNotificacion(admin, {...})        // @/lib/notificaciones
try { Resend } catch {}                          // un email caído nunca tumba la operación
```

Nunca confíes en un `empresa_id` que venga del body. Un `empleado_id` se valida siempre contra
`portal_empleados` con `.eq('empresa_id', ...)` y `.eq('activo', true)`.

## 4. RLS

Toda tabla nueva: `ALTER TABLE x ENABLE ROW LEVEL SECURITY` + política idempotente

```sql
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='x' AND policyname='...') THEN
    CREATE POLICY ... USING (empresa_id = get_my_empresa_id()) WITH CHECK (...);
  END IF;
END $$;
```

Tablas hijas derivan la empresa: `IN (SELECT id FROM padre WHERE empresa_id = get_my_empresa_id())`.
Escritura pública (respuestas de encuesta, votos) → política `public_insert_*` aparte.

**Tabla 100% service-role: RLS activo con CERO políticas = deny-all. Nunca `USING (true)`.**
Después de cualquier DDL corre `get_advisors`. El portal y Vicenta comparten el mismo Auth, así
que `{authenticated}` no basta como frontera: verifica con la anon key, no por inspección.

## 5. Migraciones

Un `migration-<feature>.sql` en la raíz del repo, con cabecera que diga **cuándo se aplicó, en qué
proyecto y por qué** (varias explican el bug que las motivó — sigue esa costumbre). Todo
idempotente: `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`.
Se aplican a mano por SQL Editor o el MCP de Supabase; no hay `supabase/migrations` versionado.

> **Los `.sql` del repo NO son la fuente de verdad del esquema.** Se aplican a mano, así que la
> base va por delante: hay tablas y columnas vivas que ningún `.sql` de la raíz menciona. Antes de
> afirmar que una tabla o una columna **no existe**, compruébalo contra la base —
> `information_schema.columns` / `information_schema.tables`, o `list_migrations` del MCP — nunca
> contra los archivos. Si no tienes acceso, escribe `NO VERIFICADO` y **no** concluyas nada.
>
> El 2026-08-03 esto costó dos errores en una sola sesión: un `portal-*` concluyó que
> `beneficio_clicks.empleado_id` no existía y comentó el insert (existe, migración
> `beneficio_clicks_add_empleado_id`, y **los 64 clics la tenían poblada al 100%**), y otro escribió
> `solicitudes_vacaciones` y `evaluaciones` donde las tablas reales son `portal_vacaciones` y
> `eval_ciclos` — con el agravante de que un 404 de PostgREST más un `?? 0` se disfraza de "no hay
> datos" y nadie se enteraría. `cent-operation-system` tiene `npm run check:columnas` justo para
> esto; **el portal no lo tiene**, así que aquí la comprobación es manual y obligatoria.

## 6. Las 12 trampas

Las doce ya pasaron en producción y **las doce pasan `tsc` y `npm run build` limpios**. El build no
te protege de ninguna.

1. **GET congelado.** `export async function GET()` sin `request` ni `cookies()` se prerenderiza y
   Vercel lo sirve cacheado para siempre. `export const dynamic = 'force-dynamic'`; lo verifica
   `npm run check:prerender`.
2. **Función en props Server→Client.** Next no la serializa: "Application error" en producción sin
   que `tsc` diga nada. Todo lo que cruce esa frontera debe ser JSON-serializable.
   **Esta trampa estaba escrita aquí y aun así tumbó el dashboard entero el 2026-09-04**, para
   todas las empresas, con `<CountUpNumber format={n => …} />` — una línea que pasó `tsc`, `build`
   y las 63 verificaciones de entonces, en un commit que decía con toda honestidad «typecheck
   limpio · build exit 0 · verify 63/63». Y no se pierde el efecto: se pierde **la pantalla**.
   Es la lección que este repo ya pagó con la paleta, con los crons y con `check:leyes-vigentes`:
   **una regla escrita y no conectada se lee igual que una que funciona.** Desde ese día la
   conecta `npm run check:fronteras-cliente` (dentro de `verify`), que además se prueba a sí mismo
   contra casos plantados en cada corrida. El arreglo, cuando marque: que cruce el **nombre** del
   comportamiento y no el comportamiento — `formato="moneda-o-guion"`, con el mapa del lado del
   cliente (`src/lib/formato-numero.ts`).
3. **Cap silencioso de 1000 filas de PostgREST.** Corta sin error. Tablas que crecen
   (`portal_empleados`, `beneficio_clicks`) exigen `.range()` o paginación.
4. **Error de Supabase tragado.** `const { data } = await ...` ignora `error`; la métrica sale 0 y
   es indistinguible de un cero real. Usa `@/lib/query-errores`: **un módulo que falló muestra `—`,
   nunca `0`.**
5. **Numerador y denominador de universos distintos.** Ya produjo 0% de rotación en empresas que sí
   tuvieron bajas. En cualquier razón, verifica que arriba y abajo salgan del mismo conjunto.
6. **Duplicados por nombre.** Dos personas comparten nombre y apellido paterno (caso real: dos
   "Fernando Galicia" en Rancho las Comadres). La señal confiable es el **RFC**.
7. **Varias filas del mismo mes.** `portal_listas` admite varias listas por mes (Urban Hair subió 4
   en jun-2026). Agrupa antes de graficar. `cobranza_mensual` sí es una fila por empresa/mes/año.
8. **UPDATE con claves en null.** Un import que manda `null` porque el Excel no traía la columna
   borra el dato bueno. Omite las claves ausentes (`sinNulos()` en `api/empleados/import/route.ts`).
9. **Dependencia local que no existe en Vercel.** Una entrada `file:` en `package.json` —una carpeta
   hermana, un tarball— compila **perfecto en local y falla en el deploy**: Vercel clona *solo* ese
   repo, así que la ruta no existe en su máquina. Puede tardar en aparecer porque el build cache
   restaura el `node_modules` del deploy anterior y lo tapa. Pasó el 27-jul-2026 con `@cent/reglas`:
   `Module not found: Can't resolve '@cent/reglas/quejas-sla'`. **Toda dependencia tiene que ser
   resoluble desde un clon limpio del repo**: registro público, `github:usuario/repo`, o vendorizada
   dentro del propio repo. `npm run build` local no detecta esto — es el único punto ciego que ni
   siquiera el build atrapa.
10. **`tsc --noEmit` pasa mientras `npm run build` falla.** Al renombrar un tipo o un campo
    compartido, `tsc` solo revisa lo que un archivo importa explícitamente; `npm run build` fuerza el
    build completo de Next y revienta en un consumidor que `tsc` nunca visitó. Grepea **todos** los
    consumidores del nombre viejo — páginas y componentes, no solo API routes, que es donde uno mira
    primero — y corre `npm run build`, no solo `npm run typecheck`, antes de dar el cambio por hecho.
11. **Un `null` dentro de un `.in()` tumba la query entera, y el cron actúa sobre todos.** Es la
    trampa 4 en su versión cara: ahí el error tragado pinta un cero en pantalla; aquí **dispara
    escrituras y correos**. `supabase-js` serializa un `null` del arreglo como el **texto** `null`
    en la URL (`empresa_id=in.(uuid,…,null)`), PostgREST intenta castearlo a uuid y responde
    **400 · 22P02**. No devuelve cero filas: devuelve `data: null`, y el `?? []` de rigor lo
    convierte en "nadie cumple la condición". El 2026-07-31 eso generó **11 auto-listas duplicadas**
    a empresas que ya habían mandado la suya: las 5 cuentas de CENT en `empresa_portal_users` tienen
    `empresa_id = NULL` a propósito. Dos reglas: **filtra los null al armar el arreglo** (`.filter()`
    + `.not('col','is',null)`) y **si la query que decide a quién NO tocar falla, aborta sin tocar a
    nadie** (fail closed). Una acción que falta se nota; una de más ya salió.
12. **Un módulo nuevo sin declaración de arranque no falla: desaparece.** Es la trampa 4 en su
    versión más silenciosa. Si no lo declaras en `src/lib/puesta-en-marcha.ts`, la pantalla
    compila, el menú lo pinta, el módulo se enciende… y nunca le dice a nadie qué le falta para
    servir. No hay error, no hay log, no hay cero en pantalla: hay una empresa que prendió algo,
    entró, no pasó nada, y concluyó que el módulo no funciona. Es lo que este repo ya pagó cuatro
    veces con las listas fantasma —la última medida el 2026-09-03, con `oportunidadKeys` en 14 de
    18 y Celebraciones con su gancho escrito y muerto—. Lo caza `npm run check:puesta-en-marcha`,
    que exige biyección con `MODULOS_PORTAL` **y** que las superficies estén montadas, no solo
    escritas. Ver §11.

## 7. `@cent/reglas`

Reglas espejo entre el portal y Vicenta. Instalado como symlink a `../cent-reglas`: **un solo
directorio, las dos apps leen los mismos bytes.** Existe porque el número que ve el cliente y el que
CENT le reporta tienen que ser el mismo — en jul-2026 divergieron y `/analitica` reportó 7 denuncias
abiertas donde Vicenta reportaba 3.

Al escribir ahí: solo funciones puras (nada de Supabase, `fetch` ni env), cero dependencias, salida
JSON-serializable (**nunca una función** — ver trampa 2), y nada de `for...of` sobre `Set`/`Map`
porque el tsconfig de Vicenta usa `target: es5` sin `downlevelIteration`; usa `Array.from()`.

Exports: `calcularRotacion`, `claveEmpleado`, `compararMembresia`, `elegirListaBase`,
`esQuejaAbierta`, `esQuejaCerrada`, `slaQueja`, `quejaFueraDeSla`, `QUEJA_ABIERTAS`, `SLA_DIAS`.

Tras tocarlo: `npm run verify` en **los dos** repos, en el mismo movimiento.

## 8. Módulo nuevo — NO son tres sitios

Decía «los tres sitios» y era falso: se midió al agregar `checador` (ago-2026) y son **nueve**
—la lista completa, con lo que cuesta olvidar cada uno, está en `CLAUDE.md`— y **diez** desde
el 2026-09-04, con la declaración en `src/lib/puesta-en-marcha.ts` (§11).

Los tres que este documento sí nombraba: `src/lib/nav.ts` (`NAV_GROUPS`, ícono de
lucide-react) · `src/lib/modulos.ts` (`MODULOS_PORTAL` con
`key`/`label`/`descripcion`/`rutas[]`) · el gate de la pestaña en el hub `/mi/[slug]`.

**El décimo no es opcional y `npm run verify` lo exige** (`check:puesta-en-marcha`, biyección
con `MODULOS_PORTAL` en las dos direcciones). Sin él, un módulo nuevo nace sin arranque y
**nada falla**: aterriza sin instrucciones y nadie se entera de que el arranque existía. Ese
error ya se pagó cuatro veces en este repo con las listas fantasma — la última medida el
2026-09-03, cuando `oportunidadKeys` listaba 14 de 18 y Buzón de quejas, Expediente y
Celebraciones no se ofrecían jamás.

Regla retrocompatible en `modulos_config`: **NULL o clave ausente = activo; solo un `false`
explícito desactiva.** Igual que `recordatorios_config` y `celebraciones_config`.

## 9. IA dentro del portal

`const anthropic = new Anthropic()` a nivel de módulo, modelo desde `@/lib/modelos`,
`export const maxDuration = 60` (120 en desempeño), prompt en español con datos ya agregados en el
servidor, `parseAiJson(raw, fallbackVacío)` para JSON, y **fallback determinista si la IA falla** —
nunca dejes al usuario sin nada. Persiste el resultado con su `*_at` para cachear y ofrece
"Regenerar". Todo lo generado con valor legal nace en **`borrador`** y exige firma humana.
Registra el consumo con `registrarUso()` de `@/lib/ia-uso`.

## 10. Convenciones no escritas

- Los comentarios de este repo documentan **el bug que motivó la línea**. Son la mejor fuente de
  contexto histórico que hay; léelos antes de "limpiar" algo que parece raro.
- Componentes compartidos ya existen: `empty-state`, `search-input`, `confirm-modal`, `toast`.
- `PORTAL_URL` sale de `@/lib/env`, nunca hardcodeado.
- Bucket `portal-documentos` es **privado**: `@/lib/archivos` (`signedArchivoUrl`, `downloadArchivo`),
  nunca `getPublicUrl`.
- **Correo: `@/lib/enviar-correo` (`enviarCorreo` / `enviarCorreoAVarios`), nunca `resend.emails.send`
  directo — y revisa `r.ok`.** El SDK de Resend **NO lanza excepción** cuando el envío falla:
  devuelve `{ data, error }`. Así que un `try/catch` alrededor **no detecta nada** — parece manejo
  de errores y no lo es.

  ```ts
  const r = await enviarCorreo({ to, subject, html, motivo: 'NOM-035 cuestionario' })
  if (!r.ok) { /* el tipo te obliga a decidir. Al menos, console.error con r.motivo */ }
  ```

  **Nunca escribas "enviado" en la base antes de comprobar `r.ok`.** Que un fallo de correo no
  tumbe la operación principal sigue siendo correcto; lo que cambia es que ahora se **entera**.

  Hasta el 2026-08-03 esta línea decía *"Email por Resend, siempre en try/catch"* — la regla que
  el `CLAUDE.md` del portal ya documentaba como **peor que nada**, y que aquí seguía viva. Como
  todo agente `portal-*` lee este molde antes de tocar nada, se propagó: ese mismo día un
  `portal-*` envolvió tres envíos de Vacaciones en un `catch` vacío, sin mirar `r.ok`, y
  **reportó que sí los había revisado**. El inventario del 2026-07-31 sobre 37 llamadas encontró
  el mismo patrón: **1 revisaba el error, 13 tenían solo `.catch()`, 23 no miraban nada.**

---

## 11. Puesta en marcha — la forma de pensar un módulo

**Un módulo no está listo cuando compila: está listo cuando alguien que nunca lo ha visto
sabe qué le falta para que sirva.** Esto es tan parte del molde como el gate de permisos.

La auditoría del 2026-09-04 midió el costo de no tenerlo: de los 18 módulos activables,
**uno** —NOM-035— tenía guía de pasos; el bloque «Primeros pasos» del dashboard tenía 3, de
los cuales 2 los ejecuta CENT; 7 de 52 pantallas tenían estado vacío y **ninguna** decía su
prerrequisito. El síntoma con el que llegó fue «el reloj checador no se entiende», y el
diagnóstico fue que no sobraban opciones —casi todas responden a un requisito real de la
LFT— sino que **nada distinguía las 3 que bloquean el arranque de las 17 que ya traen un
default razonable**.

### Las cuatro preguntas, y dónde se contestan

| Pregunta | Dónde va |
|---|---|
| ¿Para qué sirve, en una línea? | `ARRANQUE[key].paraQue` |
| ¿Qué necesita **antes** de entregar algo? | `ARRANQUE[key].requisitos` |
| ¿Qué ya tiene un valor razonable puesto? | `ARRANQUE[key].opcionales` → `<Avanzado>` |
| ¿Qué ofrecer cuando ya sirve y nadie lo estrenó? | `ARRANQUE[key].primerPaso` |

Todo en `src/lib/puesta-en-marcha.ts`, que es **puro** (lo importan el sidebar, que es
cliente, y el guardián, que corre en Node sin red). Los sensores que leen la base viven en
`puesta-en-marcha-estado.ts`.

### Las reglas que no se negocian

1. **Un requisito es lo que BLOQUEA, no lo que estaría bien.** Si tiene un default
   razonable, es opcional y va detrás de `<Avanzado>`. Ninguna función se quita: se deja de
   exigir por adelantado.
2. **La base legal no se copia.** `MODULOS_CON_ENCARGO` ya dice quién la necesita y
   `requisitosDe()` la inyecta. Copiarla crea dos listas de lo mismo, y equivocarse hacia
   «no hace falta» deja a una empresa recabando datos de sus trabajadores sin base
   documental — ya pasó: 59 registros y 18 días de Checador sin addendum ni aviso.
3. **Un error de lectura NO es un requisito pendiente.** Va a `sinLeer`, se muestra como «no
   se pudo comprobar» y no cuenta. Misma regla que `query-errores.ts`: un módulo que falló
   muestra `—`, nunca `0`. Decirle a una empresa que le falta algo que ya tiene la manda a
   configurar dos veces.
4. **Tres estados y una palabra para cada uno**: Apagado · Falta configurar (n) · Listo.
   No inventes un cuarto ni sinónimos. Antes circulaban cinco palabras para dos conceptos
   —activo, activado, disponible, estrenado, encendido— y soporte no podía hablar con el
   cliente.
5. **Un requisito que RH no puede resolver lleva `loHaceCent: true` y dice a quién pedirlo.**
   En la vida real configura el RH del cliente, sin CENT (Simón, 2026-09-04). Una casilla
   que nunca se marca es peor que ninguna.
6. **El menú paga la pasada ligera; Ajustes y la cabecera, la completa.** `estadoLigero` son
   4 queries y **no puede decir «Listo»** —los conteos quedaron sin leer—; `estadoCompleto`
   son 15 y sí. Nunca afirmes «listo» con la mitad de los hechos.
7. **El Centro de acción NO es puesta en marcha.** Una denuncia sin responder es la
   operación del día. Mezclarlos reproduce el problema que esto arregla: cinco fuentes de
   «qué hacer» y ninguna con autoridad.

### El estado vacío tiene tres piezas fijas

Para qué sirve · qué necesita antes de servir · **un** botón. `EmptyState` tiene el prop
`prerequisito` para la segunda, y va aparte de `description` a propósito: «no hay nada
todavía» y «no puede haber nada hasta que hagas X» son cosas distintas, y confundirlas es
cómo un vacío informativo se lee como un módulo roto.

## Contrato de todo subagente `portal-*`

1. Lee este molde y las invariantes de tu módulo antes de tocar nada.
2. Trabaja **solo** dentro de los archivos de tu módulo. Si el cambio se sale, dilo y para.
3. **Produce el diff y la lista de invariantes que verificaste. No hagas commit ni push.**
4. Si encuentras una invariante nueva que no está escrita, repórtala: `arquitecto-agentes` la
   agregará a tu definición para que nadie vuelva a tropezar con ella.
5. **Si tu cambio agrega o quita algo que el usuario tiene que configurar, actualiza la
   declaración de tu módulo en `src/lib/puesta-en-marcha.ts` en el mismo diff** (§11), y di en
   tu reporte a qué cubeta lo pusiste: `requisitos` si bloquea el arranque, `opcionales` si ya
   tiene un default razonable. Un campo nuevo que nace como requisito sin serlo le añade una
   decisión a las 20 que la auditoría del 2026-09-04 vino a quitar; uno que bloquea y nace en
   `opcionales` deja al módulo diciendo «Listo» sin servir. Si el campo no pertenece a ninguna
   de las dos, argumenta por qué — no lo dejes sin declarar.

---

## Un dato real no se deduce del código: se pregunta

**No tienes acceso a la base.** Tus tools son `Read`, `Grep`, `Glob`, `Edit`, `Write`, `Bash`. De
los 37 subagentes de CENT, solo `vicenta-ops` puede consultar Supabase.

Eso importa porque tu definición no te lo dice de frente y el modo de fallar es silencioso: te
preguntan "¿cuántas empresas cerraron su diagnóstico?" o "¿cuánto se facturó en julio?", lees el
código que calcula esa cifra, y **contestas con la fórmula como si fuera el resultado**. Suena
exacto y no lo es. Es la misma clase de error que este proyecto lleva meses corrigiendo: un número
plausible sin procedencia es peor que un "no lo sé", porque nadie lo audita.

**Qué hacer:**

1. **Si la pregunta necesita un dato de producción** —conteos, montos, estatus, quién pagó, cuántos
   respondieron, qué corrió y qué falló— **delega en `vicenta-ops`.** Existe exactamente para eso:
   tiene `execute_sql` de solo lectura y las reglas de negocio del esquema escritas una sola vez
   (empresa activa, pagado, IVA, duplicados por RFC). Pásale la pregunta en español, no SQL.
2. **Si no puedes delegar**, dilo así: `NO VERIFICADO — no tengo acceso a la base; esta cifra sale
   de leer el código, no de consultarla.` Y no la pongas en una conclusión.
3. **Nunca conviertas una consulta fallida en un cero.** Un cero real y un fallo tienen que verse
   distintos, o el reporte dice "sin uso" cuando en realidad no supo leer.
4. **Lo que sí puedes afirmar leyendo código** es cómo se calcula algo, dónde vive, qué invariante
   lo protege y si dos lugares lo calculan distinto. Eso es tu trabajo y ahí eres la autoridad.

El wiki también tiene límites: los manuales `wiki/portal/00` a `11` traen ~200 marcas
`[VERIFICAR]`, afirmaciones que nadie confirmó contra el portal (nombres de botones, sobre todo).
Si tu única fuente para algo es una línea con `[VERIFICAR]`, trátala como pendiente, no como hecho.
