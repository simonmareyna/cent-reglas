/**
 * Rotación — fórmula ÚNICA para CENT y para el cliente.
 *
 * La regla del negocio: **la rotación que ve el cliente en su portal tiene que ser
 * idéntica a la que CENT le reporta**. Para eso las dos leen la misma fuente
 * (`cobranza_mensual`, el snapshot mensual de headcount que se factura) y aplican
 * esta misma fórmula.
 *
 * Este archivo es la ÚNICA copia. Antes vivía duplicado —`src/lib/rotacion.ts` en el
 * portal y el mismo bucle escrito a mano dentro de `/api/crm/rotacion` en Vicenta— y
 * mantenerlos iguales dependía de que alguien se acordara.
 *
 * Por qué `cobranza_mensual` y no `portal_empleados.fecha_baja`:
 * `num_bajas` es una columna propia, no el delta neto del headcount, así que detecta
 * la rotación aunque la plantilla no cambie de tamaño. Caso real: Promosoluciones en
 * abr-2026 tuvo 15 altas y 15 bajas con headcount clavado en 37 — 40% de rotación
 * mensual que es invisible si solo mirás el headcount. Además no depende de que RH
 * haya capturado fechas de baja.
 *
 * ⚠️ Pero `cobranza_mensual` mide **membresía al programa, no empleo**. Un `num_bajas`
 * mezcla "renunció", "lo sacaron del cupo" y "RH corrigió el alta inicial". Solo la
 * primera es rotación — de ahí `es_ajuste_padron`, ver abajo.
 */

/** Meses cuyos `num_altas`/`num_bajas` se reconstruyeron como delta neto del headcount.
 *  En ellos un mes plano con movimiento (1 alta + 1 baja) aparece como 0 bajas, así que
 *  no son medibles. Debe coincidir con Vicenta. */
const MESES_APROXIMADOS = new Set(['2026-6', '2026-7'])

export interface FilaCobranza {
  anio: number
  mes: number
  num_total: number | null
  num_altas: number | null
  num_bajas: number | null
  /** Marcado por CENT: el movimiento de este mes es un ajuste de padrón, no rotación. */
  es_ajuste_padron?: boolean | null
}

/** Por qué un mes no cuenta para la rotación. `null` = sí cuenta. */
export type MotivoNoMedible = 'primer_mes' | 'aproximado' | 'ajuste_padron'

export interface PuntoRotacion {
  anio: number
  mes: number
  numTotal: number
  numAltas: number
  numBajas: number
  /** % del mes: bajas / headcount promedio. `null` si el mes no es medible. */
  rotacionPct: number | null
  aproximado: boolean
  ajustePadron: boolean
  primerMes: boolean
  /** `null` cuando el mes sí es medible. */
  motivoNoMedible: MotivoNoMedible | null
  /** Etiqueta corta para el eje X, p. ej. "Ago 26". */
  label: string
}

const MESES3 = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export interface ResultadoRotacion {
  serie: PuntoRotacion[]
  /** Bajas de los últimos ≤12 meses MEDIBLES sobre su headcount promedio, escalado a 12. */
  rotacionAnualizadaPct: number | null
  mesesMedidos: number
  /** Último mes con rotación calculable. */
  ultimo: PuntoRotacion | null
  /** Puntos porcentuales vs el baseline pre-CiENTe+. Negativo = la rotación bajó. */
  deltaVsBaseline: number | null
  /** true si algún mes de la serie es aproximado. */
  tieneAproximados: boolean
  /** Cuántos meses quedaron fuera del cálculo y por qué. Para declararlo en la UI. */
  excluidos: { aproximados: number; ajustesPadron: number }
  /** La anualizada escala por `12/n`, así que con pocos meses medidos multiplica también
   *  el ruido: con n=3 el factor es 4, y dos salidas en una plantilla de 10 se convierten
   *  en "77% anual". Se marca cuando el factor es ≥4 (n ≤ 3) para que la UI lo presente
   *  como proyección y no como una tasa anual observada. */
  extrapolado: boolean
}

export function calcularRotacion(
  filas: FilaCobranza[],
  baselinePct: number | null,
): ResultadoRotacion {
  const serie: PuntoRotacion[] = []
  let prevTotal: number | null = null

  // Se asume `filas` ordenada por (anio, mes) ascendente.
  for (const row of filas) {
    if (row.num_total === null) continue
    const total = row.num_total
    const bajas = row.num_bajas ?? 0
    const primerMes = prevTotal === null
    const aproximado = MESES_APROXIMADOS.has(`${row.anio}-${row.mes}`)
    const ajustePadron = row.es_ajuste_padron === true

    // Por qué un mes puede no ser medible, en orden de precedencia:
    //   primer_mes    → sus altas son el alta inicial en CiENTe+, no rotación.
    //   ajuste_padron → CENT marcó que el movimiento fue corrección de padrón.
    //   aproximado    → las bajas se reconstruyeron como delta neto y quedaron en 0.
    const motivoNoMedible: MotivoNoMedible | null =
      primerMes ? 'primer_mes'
      : ajustePadron ? 'ajuste_padron'
      : aproximado ? 'aproximado'
      : null

    // Un mes no medible NO dibuja número. Antes los aproximados mostraban su 0% como
    // si fuera un dato, y un ajuste de padrón mostraba el pico completo: La Cabaña de
    // Crater marcaba 155.6% en feb-2026 por una corrección de alta inicial.
    const promedio = primerMes ? null : (prevTotal! + total) / 2
    const rotacionPct = motivoNoMedible !== null ? null
      : promedio && promedio > 0 ? Math.round((bajas / promedio) * 1000) / 10
      : 0

    serie.push({
      anio: row.anio,
      mes: row.mes,
      numTotal: total,
      numAltas: row.num_altas ?? 0,
      numBajas: bajas,
      rotacionPct,
      aproximado,
      ajustePadron,
      primerMes,
      motivoNoMedible,
      label: `${MESES3[row.mes - 1]} ${String(row.anio).slice(2)}`,
    })
    // El mes sigue alimentando el promedio del mes SIGUIENTE aunque no sea medible:
    // esa gente sí estuvo, lo que no sabemos es si sus bajas fueron rotación.
    prevTotal = total
  }

  // Solo los meses medibles entran al KPI anualizado. Excluir los aproximados es un
  // cambio respecto de la versión anterior: ahí entraban con sus bajas en 0 y
  // SUBESTIMABAN la rotación, mientras el aviso de la UI solo cubría la gráfica.
  const medibles = serie.filter(p => p.motivoNoMedible === null)
  const ultimos = medibles.slice(-12)
  let rotacionAnualizadaPct: number | null = null
  if (ultimos.length > 0) {
    const bajasTotal = ultimos.reduce((s, p) => s + p.numBajas, 0)
    const headcountProm = ultimos.reduce((s, p) => s + p.numTotal, 0) / ultimos.length
    if (headcountProm > 0) {
      rotacionAnualizadaPct = Math.round((bajasTotal / headcountProm) * (12 / ultimos.length) * 1000) / 10
    }
  }

  const deltaVsBaseline = baselinePct != null && rotacionAnualizadaPct != null
    ? Math.round((rotacionAnualizadaPct - baselinePct) * 10) / 10
    : null

  return {
    serie,
    rotacionAnualizadaPct,
    mesesMedidos: ultimos.length,
    ultimo: medibles.length ? medibles[medibles.length - 1] : null,
    deltaVsBaseline,
    tieneAproximados: serie.some(p => p.motivoNoMedible === 'aproximado'),
    excluidos: {
      aproximados:   serie.filter(p => p.motivoNoMedible === 'aproximado').length,
      ajustesPadron: serie.filter(p => p.motivoNoMedible === 'ajuste_padron').length,
    },
    extrapolado: ultimos.length > 0 && ultimos.length <= 3,
  }
}
