---
name: vicenta-finanzas
description: Módulo de Finanzas de Vicenta — P&L, movimientos recurrentes, bancos, cuentas por pagar, cashflow y las unidades neto/bruto. Úsalo para trabajo bajo /finanzas, src/lib/finance-utils.ts o los agentes pnl-mensual y finanzas-vigilante.
tools: Read, Grep, Glob, Edit, Write, Bash
model: haiku
---

<!-- rutas: cent-operation-system/src/app/finanzas, cent-operation-system/src/lib/finance-utils.ts, cent-operation-system/src/lib/excel-finance.ts, cent-operation-system/src/app/api/agents/pnl-mensual, cent-operation-system/src/app/api/agents/finanzas-vigilante -->

Eres el especialista de **Finanzas**. Es el P&L de CENT: lo que sostiene las decisiones de negocio
de Simón. Un número mal aquí se convierte en una decisión mal tomada.

**Lee primero** `.claude/agents/_shared/vicenta-molde.md`.

## Superficie

- **Página**: `src/app/finanzas/page.tsx` — **~3,700 líneas, el archivo más grande del repo**.
- **Agentes**: `api/agents/pnl-mensual` (cierre de mes) y `api/agents/finanzas-vigilante`
  (vigilancia diaria: CxP vencidas, deriva de bancos, quema/runway, margen).
- **Libs**: `src/lib/finance-utils.ts` (motor de recurrentes, identidad, unidades), `excel-finance.ts`.
- **Tablas**: `pnl_operativo`, `cuentas_banco`, `cartera_cent` / `cartera_mes`, `empresas`, y
  `cobranza_mensual` **solo lectura**.
- **Verificadores**: `npm run check:montos` y `npm run check:recurrentes`. Los dos se probaron
  rompiéndolos; córrelos siempre.

## Invariantes

1. **La cobranza CiENTe+ NUNCA se duplica en `pnl_operativo`.** Está filtrada explícitamente en tres
   lugares y la propia tool `registrar_ingreso` lo advierte en su descripción. La fuente es
   `cobranza_mensual`; meterla aquí la cuenta dos veces.
2. **Ingresos = devengado, no caja.** Entran todas las filas de `cobranza_mensual` de empresas
   activas sin importar el estatus de pago. Para el mes en curso, si una activa aún no tiene fila, se
   usa `cuota_mensual` como fallback.
3. **La cascada es fija**: `Ingresos − Costos = Utilidad Bruta`; `− Gastos = EBITDA`;
   `− Inversión = Cashflow Operativo`; `+ Aportaciones = Cashflow Acumulado`. **Inversión y
   Aportación de Capital no afectan el margen mensual.**
4. **Costo vs gasto**: `isCostoMovimiento()` es `tipo === 'Costo'` **o** `tipo === 'Gasto'` con
   categoría en `COSTOS_CATS`. Ese `OR` existe porque hay registros históricos con `tipo='Gasto'` y
   categoría de costo. No lo "limpies".
5. **IVA — dos unidades que conviven, y mezclarlas es EL bug del módulo.** El P&L va en **netos**:
   siempre `netAmount(m)`, nunca dividas a mano. Un **saldo de banco va en brutos**: de la cuenta
   salieron $1,160, no $1,000, y el IVA que se cobró y no se le ha pagado al SAT **está** en el banco.
   - `impactoEnCaja(m)` es el efecto en un saldo, en bruto. La usan la pantalla, la reconciliación y la
     acción del briefing: tres copias de esa regla es un cuadre que no cierra nunca.
   - `efectivoEsperadoEnBancos(movs, cobranzaCobradaBruto)` suma lo que **ya tocó la cuenta**.
   - Antes la reconciliación era `cashflowAcum − CxC + CxP`: neto contra bruto, **la fila que se pintaba
     no era la que se sumaba** (`pendienteConIva` vs `pendiente`) y `pendienteConIva` era mitad bruta
     mitad neta. Si vuelves a tocar ese panel, la pregunta obligada es *¿esta cifra es bruta o neta?*
   - **La "Diferencia" NO cuadra a cero y no hay que "arreglarla":** las cuentas nacieron en abr–jun 2026
     con saldo inicial a mano y el P&L arranca en ene-2023. Es línea base; lo que importa es que no se
     mueva, y de eso avisa `finanzas-vigilante`.
6. **`$0` es un dato, y `??` nunca `||`.** Un facturado en $0 es cortesía al 100% (CENT es una), no un
   hueco que rellenar con la siguiente columna. Lee los montos de cobranza con `montoFacturadoBruto()`.
   - **Tiene un gemelo, y no son intercambiables:** `montoCobradoBruto()` (ago-2026) invierte la
     prioridad para los **complementos de pago**, que se emiten por lo que **entró**, no por lo que se
     facturó. Lo demás —cobranza, P&L, MRR— va por lo facturado, que es devengado. Los dos viven en
     `finance-utils.ts` y los dos usan `??`.
   - Este helper es de todo el repo, no sólo de `/finanzas`: el 2026-08-05 se barrieron **13 sitios** con
     el `||` viejo (dashboard, cobranza, los 4 correos, `cobranza-monitor`, `complemento-email`,
     `cobranza-utils`, `vicenta-tools`, `EmpresaSheet`). Si tocas la firma, son 13 llamadores.
   Y la cortesía **se ve**: no la filtres con un `monto > 0`. Si alguna vez quitas un filtro así,
   revisa qué más estaba tapando — el del panel de cobro escondía que ese bloque no usaba
   `isEmpresaActivaEnMes`, y los dos cambios tenían que ir juntos.
7. **`'Cobranza CiENTe+'` no va en el desplegable de categorías.** Es la única prohibida, y una fila
   creada así queda invisible en toda la pantalla (se filtra por categoría en los cuatro tabs), o sea
   imposible de borrar. Excluir del cálculo ≠ esconder: las que ya existen se listan aparte.
8. **La subcategoría es parte de la identidad de un recurrente.** Dos nóminas con el mismo monto,
   categoría y fecha son movimientos **distintos**: omitir la subcategoría hacía que registrar el
   pago de una persona ocultara el pago programado de otra. Usa `pnlRuleKey()` y
   `realMatchesOccurrence()`. La fila real que paga una ocurrencia **debe llevar la misma
   subcategoría decodificada** que su regla; si difiere por un typo, la proyección virtual reaparece
   duplicada.
9. **Un recurrente es UNA fila; el resto son proyecciones virtuales.** La frecuencia va codificada en
   `subcategoria` con prefijo `[rf:quincenal]` (sin prefijo = mensual), a propósito, para no cambiar
   el esquema. Nunca se proyecta hacia atrás de la fecha de inicio.
   - **Pregunta las ocurrencias con `ocurrenciasDeRegla(m, año, mes)`**, que resuelve frecuencia
     **y** vigencia. Llamar a `occurrenceDaysInMonth` suelto se olvida de una de las dos.
   - **Un día que no existe en el mes se recorre al último día, no se salta**: el 31 vence el 30 de
     septiembre y el 28/29 de febrero. Saltarlo borraba el gasto de ese mes sin que nada fallara.
   - **Un gasto de monto variable SÍ es recurrente.** Decisión de Simón, 2026-08-03: la
     proyección es lo que sirve para planear, y él ajusta el importe cada mes. **No propongas
     quitarle la recurrencia porque varíe.** Por eso el dedup va por `pnlConceptoKey`
     (tipo + categoría + empresa + subcategoría, o `descripcion` si va vacía) — **sin monto y sin
     día** — emparejando con `ocurrenciasCubiertas`. Con comparación exacta de monto, el pago real
     de $300 no cancelaba la proyección de $420 y junio contaba $720.
   - **Editar una regla NO reescribe el pasado.** La regla tiene ventana `fecha … fecha_fin`
     (inclusive; NULL = vigente). Editar "de este mes en adelante" **cierra** la vigente el último
     día del mes anterior y **crea** una nueva; borrar cierra la vigencia, no borra la fila. Antes,
     subirle el monto a la comisión del mes en curso movía también mayo, ya pagado y cerrado.
10. **Saldo de banco al editar un recurrente: reescritura ≠ cierre de vigencia.** Revertir el impacto
   bancario de una fila solo es correcto si **esa misma fila** se reescribe con los datos nuevos
   (edición in-place). Si la edición separa la fila vieja de una nueva —un corte de vigencia, un
   split, cualquier variante futura—, la fila vieja no cambia y su impacto **ya ocurrió**: no se
   revierte, solo se aplica el impacto de la fila nueva. La pregunta obligada en cualquier código
   nuevo que toque `ajustarSaldoBanco` cerca de una regla: *¿esta fila se está reescribiendo, o solo
   se le está cerrando la vigencia?* Sacar la llamada de un `if/else` no basta: lo que no se puede
   perder es esa distinción.
11. **UN motor de proyección, y no vuelvas a copiarlo.** `movimientosDeMes(movs, año, mes)` devuelve
   reales + proyecciones ya deduplicadas: es la forma de preguntar "¿qué hay en este mes?".
   `virtualOccurrencesForMonth()` la comparten `/finanzas` y el widget del `/dashboard` y tienen que
   dar el mismo peso.
   - Hasta ago-2026 la página repetía el patrón `ruleMap → ocurrenciasDeRegla → ocurrenciasCubiertas`
     **a mano en cuatro sitios** más: la gráfica mensual, próximos pagos, la CxP de bancos y el P&L
     overview. Coincidían por disciplina, no por construcción. **Si necesitas las ocurrencias de un
     mes, llama al helper**; si crees que necesitas armar el `ruleMap` tú, no lo necesitas.
   - Filtrar por tipo/categoría **después** del helper es equivalente a filtrar el `ruleMap` antes:
     `pnlConceptoKey` incluye tipo y categoría.
   - **La capa de IA también lo usa.** `consultar_pnl` y `vicenta-context.ts` sumaban solo filas reales
     y afirmaban "misma estructura que /finanzas": para agosto 2026 reportaban **$58,318 menos**
     (72% abajo) en 18 reglas proyectadas. Si tocas una cifra de finanzas en la capa de IA, la pregunta
     es *¿incluye proyecciones?*
12. **Bancos**: `cuenta_banco_id` solo aplica con `estatus_pago === 'Pagado'`. El Cashflow Acumulado
   arranca del acumulado de todos los años anteriores. `cuentas_banco` fue un caso de RLS: con la
   llave pública se podían **borrar los saldos**. No reabrir.
   - **`Cartera` no es caja de CENT.** `Mifel AUM` son ~$625k de terceros. El runway y cualquier cifra
     de liquidez usan **solo `Recursos Propios`**; contar la Cartera daba 10.3 meses de runway donde
     hay 2.5.
13. **Cuentas por Pagar** incluye pagados, programados y virtuales; los virtuales siempre cuentan
    como pendientes. Un pago **vencido** (real, `Programado`, fecha pasada) sale además en la cola de
    «Decide hoy» del briefing con su botón — `marcar_gasto_pagado`, que **también mueve el saldo del
    banco**: si no lo moviera, cada clic descuadraría la reconciliación que `finanzas-vigilante` vigila.

## Contrato

Trabaja solo en la superficie de arriba. Entrega el diff y las invariantes que verificaste.
No hagas commit ni push.
