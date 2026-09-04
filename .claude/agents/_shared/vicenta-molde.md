# El molde de Vicenta

Fuente de verdad única para los subagentes `vicenta-*`. Hermano de `portal-molde.md`.
Si una regla vale para todos los módulos de Vicenta, va aquí y no en dieciséis archivos.

Repo: `cent-operation-system` → `vicenta.centapp.mx`. Next 14 App Router, React 18, Tailwind 3,
Supabase (`xixlkxegtcbrglhophdx`), Resend, Manrope. Deploy: push a `main` → producción,
**sin staging**. **No hay tests.**

> **Ánclate en `$CLAUDE_PROJECT_DIR`.** Hay copias viejas del proyecto en el disco — entre ellas
> `/Users/simonmareyna/Vicenta operativo /`, de mayo–junio 2026, cuyo `package.json` no tiene ni
> `typecheck` ni `verify`. El 2026-07-28 un agente terminó ahí y reportó que los scripts de
> verificación "no existen". Usa siempre `"$CLAUDE_PROJECT_DIR/cent-operation-system"`, nunca un `cd`
> relativo ni una ruta bajo `~`. Si un archivo que este molde da por existente no aparece, sospecha
> de la copia antes de reportarlo como ausente.

---

## Dinero: la contabilidad no se reescribe

Aplica a cualquier módulo que toque pesos. La misma cifra se calculaba de cinco formas distintas y
ninguna coincidía con la pantalla; el 2026-07-28 se unificó.

- **Precio: $100 sin IVA → $116 con IVA.** El $116 es lo que se comunica al empleado **y** lo que se
  factura. **No existe ningún precio de $134.56** — es aplicarle IVA a un precio que ya lo trae.
  `npm run verify` falla si vuelve al código. Nunca escribas el precio a mano: `calcularPrecios(empresa)`
  de `src/lib/precios.ts`, que respeta overrides y `descuento_pct`.
- **Importa, no reimplementes.** Cobranza sale de `src/lib/cobranza-utils.ts`
  (`isEmpresaActivaEnMes`, `isPagada`, `getCobranzaSummary`, `calculateMRR`) y el P&L de
  `src/lib/finance-utils.ts` (`netAmount`, `isCostoMovimiento`, `esCobranzaDuplicada`). Son las
  mismas que consumen `/dashboard`, `/finanzas` y `/ciente-ops`.
- **IVA etiquetado.** `cobranza_mensual.monto_facturado/monto_cobrado` y `empresas.cuota_mensual`
  están CON IVA; `pnl_operativo.monto` es neto salvo `iva_incluido`. Si devuelves un monto en una API
  o en un tool result, **di en qué unidad está** (`_con_iva` / `_sin_iva`).
- **`monto_cobrado` no es evidencia de pago.** El cobrado real solo cuenta filas con `ya_pago` o
  estatus `Pagado` / `Complemento de Pago Enviado`. **Esta columna tenía cuatro puertas**, y
  arreglar una no cerró el bug: `init-mes` al crear el mes (31-jul), **aprobar una lista** en
  `portal/lista-review`, la tool **`actualizar_cobranza`** escribiendo `input.monto_cobrado` crudo
  —bastaba pedírselo a Vicenta por chat— y el input "Monto" de `/ciente-ops`, que **mostraba
  `monto_facturado` y guardaba `monto_cobrado`**. Julio salió 35.6% arriba; agosto llegó a 23 filas
  por $94,076 sin un solo pago. Las cuatro se cerraron el 2026-08-04 y los datos se limpiaron.
  **Escríbela solo con `montoCobradoParaGuardar` (`cobranza-utils.ts`) y corre
  `npm run check:cobrado`.** El `input_schema` de una tool no es un guardrail: describe lo que el
  modelo puede mandar, no lo que la base puede aceptar. Y al leerla, sigue filtrando por `isPagada`.
- **El P&L excluye `categoria = 'Cobranza CiENTe+'`**: esas filas duplican `cobranza_mensual`.

---

## 0. La frontera: Vicenta ve todo, Vicente no

Es la regla que gobierna todo lo demás.

| | **Vicenta** (`vicenta.centapp.mx`) | **Cientemas + Vicente** (`cientemas.centapp.mx`) |
|---|---|---|
| Para quién | Las 5 personas de CENT | Los ~34 usuarios de RH de las 31 empresas cliente, y sus colaboradores |
| Alcance | **Todas** las empresas, el P&L de CENT, la cobranza completa | **Una sola empresa**: la suya |
| Quién es | staff, en `user_profiles` | cliente, en `empresa_portal_users` / `portal_empleados` |
| Su IA | Vicenta IA — escribe, manda correos, mueve dinero (49 tools al 2026-08-04; la lista viva es `TOOLS` en `vicenta-tools.ts`) | Vicente / Vicente+ — 9 tools, **solo lectura** salvo crear un ticket |

**Las dos apps comparten el mismo Supabase Auth.** De ahí la consecuencia que más caro ha salido:

> **`{authenticated}` NO es una frontera.** Una RH de un cliente autenticada es exactamente el mismo
> rol `authenticated` que Simón. El 2026-07-27 se cerró una exposición en la que una RH cliente veía
> **162 empresas, 224 filas de cobranza, 1,003 personas y 405 movimientos del P&L**.

Cómo se separa hoy:

- Lo que Vicenta lee **desde el navegador** (es client-side, con anon key) va detrás de
  `es_staff_cent()` — `SECURITY DEFINER` con `search_path` fijo para que no recurse.
- Lo que solo toca service_role va **deny-all**: RLS activo y cero políticas.
- **Nunca `USING (true)`.** Y ojo con dos trampas ya vistas: políticas llamadas `service_role_all`
  concedidas al rol `public`, y `auth.role() = 'authenticated'`, que **el advisor no reporta** pero
  concede igual. `get_advisors` excluye a propósito los `SELECT USING(true)`.
- Verificación: `npm run verify:rls` (con anon key) más el bloque de doble sesión de
  `supabase/rls-cross-tenant/README.md`. **Con la anon key, no por inspección.**

### Qué ve Vicenta del cliente — y qué no

Sí ve, porque sostiene el servicio: plantilla (`portal_empleados`: activos, salario, cupo — es la
base de la facturación y del layout Thona), cumplimiento NOM-035 **agregado**, engagement en
conteos, contactos de RH, y los tickets de soporte completos (*el soporte lo da CENT, no el cliente*).

**No ve, y es una prohibición explícita:**

> **El contenido de una denuncia.** De `quejas` solo `empresa_id, status, severidad, created_at`.
> Nunca `descripcion`, `nombre`, `email`, `area` ni `codigo_seguimiento`. En jul-2026 Vicenta tenía
> un panel `/quejas` que leía y respondía las denuncias de todas las empresas —con nombre y correo
> del denunciante— firmando como "CENT / RH". Se eliminó (commit `674b3372`). Lo que CENT necesita
> es saber si el cliente **atiende** su canal, no leerlo.

Tampoco `nom035_respuestas` (respuestas psicosociales individuales) ni `nom035_demograficos`. Del
diagnóstico solo el conteo `total_respondido`.

**Al escribir código nuevo, la pregunta es: ¿esto lo necesita CENT para sostener el servicio, o es
del cliente?** Si es del cliente, va en su Portal.

---

## 1. `force-dynamic` en todo GET que lea Supabase

No es opcional. Sin él, Next 14 prerenderiza el GET en el build y Vercel lo sirve cacheado **para
siempre** (`initialRevalidateSeconds: false`). Ya pasó: en julio 2026 Salud CiENTeMAS reportaba 4
visitas de Urban Hair cuando eran 11, y 15 empresas con uso cuando eran 17. El botón "Actualizar"
pedía el mismo blob viejo, y las fechas se congelaban en la fecha del deploy.

`tsc` y `npm run build` pasan limpios con el bug presente. Lo único que lo delata es el manifest:
**`npm run build && npm run check:prerender`**.

## 2. Paginar o mentir

PostgREST corta en 1000 filas **en silencio**. `portal_empleados` iba en 813 (81% del cap) y
`personas_ecosistema` en 818. Usa `fetchAllPaged` de `src/lib/paged-query.ts` en toda query sobre
tablas que crecen.

## 3. Un fallo de query es `null`, jamás `0`

Un cero real y un fallo tienen que verse distinto, o el panel reporta "Sin uso" cuando en realidad
no supo leer. Y el módulo que falló **se excluye del denominador**, no cuenta como cero.

## 4. Toda página va dentro de `AppShell`

`AppShell` es quien hace el chequeo de sesión: una página sin `layout.tsx` que lo envuelva **se abre
sin login**. Pasó con `/soporte`, y otra vez con `/contratos`, `/onboarding` y `/capacitaciones` —
el fix se escribió el 24-jul y quedó en una rama sin fusionar hasta el 27.

El contenedor raíz de la página es un `<div>` simple: sin `min-h-screen`, sin fondo, sin `p-6`, sin
`max-w-* mx-auto`. El `<main>` de AppShell ya los pone y se duplican.

Excepciones legítimas: `/login` y `/nom035` (solo hace `redirect`).

## 5. `@cent/reglas` — el paquete compartido con el portal

`quejas-sla`, `rotacion`, `lista-movimientos`. Se instala desde el **tarball de GitHub fijado por
SHA**; una dependencia `file:` no existe en la máquina de Vercel y rompe el deploy. El lockfile fija
el SHA **por repo**: si se actualiza en uno y no en el otro, quedan corriendo reglas distintas — es
el bug de jul-2026 (el portal contaba 7 denuncias abiertas donde Vicenta contaba 3), más lento y más
difícil de ver.

Tras tocarlo: **`npm run verify` en los dos repos**, y actualizar el SHA en los dos `package.json`.

## 6. IVA: la convención está escrita, respétala

Todo lo que devuelve `cobranza-utils.ts` viene **CON IVA** (raw de BD). El consumidor divide:
`/ciente-ops` **no** divide; Dashboard y Finanzas **sí** (`÷1.16`). En `pnl_operativo`, usa
`netAmount(m)` — nunca dividas a mano.

Precios: **$100 sin IVA → $116 con IVA**, y **$116 es lo que se factura** — el mismo número que se
le comunica al empleado. **No existe ningún $134.56** (hasta el 2026-07-28 esta línea lo afirmaba,
contradiciendo el encabezado de este mismo molde). Solo Portal: **$40 + IVA = $46.40**. Seguro de
vida **$50,000 — nunca $500,000**. Póliza Thona 70865-00.

## 7. Modelos e IA

`MODEL_SONNET` / `MODEL_HAIKU` desde `src/lib/modelos.ts` — nunca un string hardcodeado (llegaron a
convivir tres escrituras del mismo Haiku en 22 call-sites, y un Opus generando 200 tokens de
saludo). Registra el consumo con `registrarUso()` de `src/lib/ia-uso.ts`: es best-effort y **nunca
lanza**.

## 8. Identidad visual

Tokens de `tailwind.config.ts`, no hexadecimales sueltos:

- **Teal** `cent-teal-500 #3BBCC8` — la marca, para acentos y estados activos.
- **Blue-gray** — la familia **dominante**: `cent-bluegray-900 #1E2C36`, `-800 #2E404D` (sidebar),
  `-500 #51738C`, `-100 #DAE3EA`, `-50 #F0F4F6`.
- Fondo de página `#F6F9FB`, superficie blanca, `cent-ink #2E404D` para texto.
- **El navy `#0f1f2e` quedó deprecado en el rebrand v4.** Si lo ves, es código viejo.
- Fuente **Manrope**. Radios generosos (`rounded-xl` 20px, `2xl` 28px). Sombras tintadas en
  blue-gray (`shadow-sm`/`md`/`lg`), nunca negras. **Sin emoji en la UI.**

## 9. Antes de entregar

`npm run typecheck` · `npm run build` · `npm run check:prerender` · `npm run verify` ·
`npm run verify:rls`. Y el subagente `revisor-entrega`, que además lo exige un hook `Stop`.

---

## Contrato de todo subagente `vicenta-*`

1. Lee este molde y las invariantes de tu módulo antes de tocar nada.
2. Trabaja **solo** dentro de los archivos de tu módulo. Si el cambio se sale, dilo y para.
3. **Produce el diff y la lista de invariantes que verificaste. No hagas commit ni push.**
4. Si encuentras una invariante nueva que no está escrita, repórtala: `arquitecto-agentes` la
   agregará a tu definición.

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
