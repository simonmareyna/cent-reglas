/**
 * Altas y bajas entre dos meses: el núcleo PURO.
 *
 * Cada lista mensual guarda un snapshot de su membresía en `portal_lista_empleados`.
 * Las altas/bajas de una lista nueva se calculan comparando su plantilla activa
 * contra el snapshot del mes anterior.
 *
 * Aquí vive solo la comparación. **Las consultas se quedan en cada app**: el portal
 * las hace en `src/lib/lista-movimientos.ts` y Vicenta en
 * `src/app/api/portal/lista-review/route.ts`, cada uno con su cliente de Supabase.
 * Este paquete no conoce Supabase.
 *
 * Restricción de escritura: **nada de `for...of` sobre `Set`/`Map`.** El tsconfig de
 * `cent-operation-system` tiene `target: es5` sin `downlevelIteration` y eso ya rompió
 * una compilación. Usar `Array.from()` y `.filter()`.
 */

export interface Movimientos {
  numAltas: number
  numBajas: number
}

/** Cualquier fila comparable: un renglón del snapshot o un empleado de la plantilla. */
export interface Comparable {
  empleado_id?: string | null
  id?: string
  rfc?: string | null
}

/**
 * Identidad de un colaborador para comparar dos meses.
 *
 * El RFC va primero a propósito: `portal_lista_empleados.empleado_id` es
 * `ON DELETE SET NULL`, así que si se borra un empleado su renglón del snapshot se
 * queda sin id. Con la regla anterior (`empleado_id ?? id ?? rfc`) ese renglón
 * pasaba a identificarse por RFC mientras la plantilla viva seguía usando el UUID,
 * y la MISMA persona se contaba como baja (desapareció del set nuevo) y como alta
 * (apareció con otra llave) — dos movimientos inventados de uno.
 *
 * Además es la señal correcta por sí sola: el nombre no distingue a dos personas
 * distintas (Rancho las Comadres tiene dos "Fernando Galicia", con RFC, CURP y
 * correo diferentes) y el RFC sí.
 */
export function claveEmpleado(e: Comparable): string {
  const rfc = (e.rfc ?? '').trim().toUpperCase()
  if (rfc) return `rfc:${rfc}`
  return `id:${e.empleado_id ?? e.id ?? ''}`
}

/**
 * Compara la membresía del mes anterior contra la actual.
 *
 * @param snapshotPrev renglones de `portal_lista_empleados` de la lista previa
 * @param activos      plantilla activa de hoy
 */
export function compararMembresia(
  snapshotPrev: Comparable[],
  activos: Comparable[],
): Movimientos {
  const clavesPrev = Array.from(new Set(snapshotPrev.map(claveEmpleado)))
  const clavesActual = Array.from(new Set(activos.map(claveEmpleado)))
  const setPrev = new Set(clavesPrev)
  const setActual = new Set(clavesActual)

  return {
    numAltas: clavesActual.filter(k => !setPrev.has(k)).length,
    numBajas: clavesPrev.filter(k => !setActual.has(k)).length,
  }
}

/**
 * De varias listas del mismo mes, cuál sirve como base de comparación.
 *
 * Un mes puede tener varias listas (Urban Hair subió 4 en jun-2026) y no todas
 * tienen snapshot. Antes se elegía la aprobada —o la más reciente— y si ESA no tenía
 * snapshot se reportaba "primer mes", aunque una hermana del mismo mes sí lo tuviera:
 * se perdían los movimientos teniendo con qué compararlos.
 *
 * La aprobada es la lista oficial del mes; solo si no tiene snapshot se usa la más
 * reciente que sí lo tenga. `listas` debe venir ordenada de más reciente a más vieja.
 */
export function elegirListaBase<T extends { id: string; estado: string }>(
  listas: T[],
  tieneSnapshot: (lista: T) => boolean,
): T | null {
  const conSnapshot = listas.filter(tieneSnapshot)
  return conSnapshot.find(l => l.estado === 'aprobada') ?? conSnapshot[0] ?? null
}
