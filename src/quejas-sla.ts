/**
 * SLA y taxonomía de estado del canal de denuncias.
 *
 * Plazo máximo de primera respuesta/atención según severidad (la clasifica la IA
 * del portal al recibir la queja):
 *
 *   alta → 3 días naturales · media → 7 días · baja → 15 días
 *
 * Esta regla vivía duplicada a mano en los dos repos y **divergió en menos de un
 * día**: la lista de status cerrados del portal no incluía `desestimada` y la de
 * Vicenta sí, así que `/analitica` contaba 7 denuncias abiertas donde Vicenta
 * contaba 3, y a 4 denuncias ya cerradas les salía chip "SLA vencido". Ni `tsc` ni
 * `npm run build` lo detectan: las dos copias compilaban perfecto por separado.
 */

export const SLA_DIAS: Record<string, number> = { alta: 3, media: 7, baja: 15 }

export type SlaEstado = 'vencida' | 'por_vencer' | 'en_tiempo' | 'na'

export interface SlaInfo {
  estado: SlaEstado
  limite: Date | null
  diasRestantes: number | null
}

/** Los únicos valores que acepta `quejas.status` — CHECK en la base (jul-2026):
 *  `nueva`, `en_revision`, `resuelta`, `desestimada`. */
export const QUEJA_STATUS = ['nueva', 'en_revision', 'resuelta', 'desestimada'] as const
export type QuejaStatus = (typeof QUEJA_STATUS)[number]

/** Status que dan por terminada una queja: no consumen SLA ni cuentan como abiertas.
 *
 *  `cerrada` y `descartada` no existen en el CHECK actual; se conservan por
 *  tolerancia a renombres. La verdad sobre qué existe está en `QUEJA_STATUS`. */
export const CERRADAS = ['resuelta', 'cerrada', 'descartada', 'desestimada']

/** Una queja sigue abierta mientras no haya llegado a un status terminal.
 *
 *  Único lugar donde se decide esto. Antes había cinco definiciones distintas
 *  repartidas entre `/analitica`, `/cultura`, `/dashboard`, el reporte ejecutivo y
 *  Vicente — y tres de ellas filtraban por `'pendiente'`, un status que no existe,
 *  así que el Centro de Acción nunca alertaba de una denuncia sin responder. */
export function esQuejaAbierta(status: string | null | undefined): boolean {
  return !status || !CERRADAS.includes(status)
}

/** Complemento de `esQuejaAbierta`. `resuelta` y `desestimada` cuentan las dos. */
export function esQuejaCerrada(status: string | null | undefined): boolean {
  return !esQuejaAbierta(status)
}

/** Los status abiertos, para filtrar en la base: `.in('status', QUEJA_ABIERTAS)`.
 *  Se deriva de las otras dos constantes para que no puedan contradecirse. */
export const QUEJA_ABIERTAS: QuejaStatus[] = QUEJA_STATUS.filter(s => !CERRADAS.includes(s))

/** Calcula el estado del SLA de una queja. `na` si ya está resuelta/cerrada. */
export function slaQueja(
  severidad: string | null | undefined,
  status: string | null | undefined,
  createdAt: string,
  hoy: Date = new Date(),
): SlaInfo {
  if (esQuejaCerrada(status)) return { estado: 'na', limite: null, diasRestantes: null }

  const dias = SLA_DIAS[severidad ?? ''] ?? SLA_DIAS.media
  const creada = new Date(createdAt)
  if (isNaN(creada.getTime())) return { estado: 'na', limite: null, diasRestantes: null }

  const limite = new Date(creada)
  limite.setDate(limite.getDate() + dias)

  const msRestantes = limite.getTime() - hoy.getTime()
  const diasRestantes = Math.ceil(msRestantes / (24 * 60 * 60 * 1000))

  if (diasRestantes < 0) return { estado: 'vencida', limite, diasRestantes }
  if (diasRestantes <= 1) return { estado: 'por_vencer', limite, diasRestantes }
  return { estado: 'en_tiempo', limite, diasRestantes }
}

/** true si la queja sigue abierta y ya pasó su plazo de atención.
 *  Lo usa Vicenta para contar denuncias fuera de plazo por empresa **sin leer su
 *  contenido**: el canal es del cliente y se atiende en su Portal Cientemas. */
export function quejaFueraDeSla(
  severidad: string | null | undefined,
  status: string | null | undefined,
  createdAt: string | null | undefined,
  hoy: Date = new Date(),
): boolean {
  if (!createdAt) return false
  return slaQueja(severidad, status, createdAt, hoy).estado === 'vencida'
}

export const SLA_LABEL: Record<SlaEstado, string> = {
  vencida: 'SLA vencido',
  por_vencer: 'Vence hoy/mañana',
  en_tiempo: 'En tiempo',
  na: '',
}
