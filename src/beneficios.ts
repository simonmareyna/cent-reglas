/**
 * Categorías y catálogo mínimo de los beneficios de la red CiENTe+ — la lista ÚNICA.
 *
 * ## Por qué vive aquí (2026-09-30)
 *
 * El portal ESCRIBE `beneficio_clicks.beneficio_clave` y `categoria`; Vicenta los LEE para
 * Salud CiENTeMAS. Hasta hoy Vicenta tenía una copia a mano de las categorías y de los
 * nombres, que se iba a desincronizar con el primer beneficio nuevo.
 *
 * Aquí va lo mínimo que comparten: clave, nombre, emoji, categoría y `slugPadre` (la
 * tarjeta de `beneficios_catalogo` a la que pertenece). Topes, textos, formularios y todo
 * lo de la ficha se quedan en `ciente-plus-portal/src/lib/beneficios-red.ts`, que valida
 * contra este catálogo en `check:beneficios-catalogo`.
 *
 * ## Lo desconocido no desaparece
 *
 * `categoriaDeBeneficio` resuelve la categoría de un clic: primero la clave del catálogo
 * (así una fila histórica sin `categoria` se clasifica sola), después la `categoria` que
 * mandó el tracking si es válida, y si no, `null` = «sin clasificar». Quien pinta enseña
 * la clave cruda en esa cubeta; nunca la tira.
 *
 * Puro, sin dependencias, JSON-serializable (ver README).
 */

export const CATEGORIAS_BENEFICIO = [
  { id: 'emergencias', emoji: '🚨', nombre: 'Emergencias y accidentes' },
  { id: 'salud',       emoji: '🩺', nombre: 'Salud y prevención' },
  { id: 'mente',       emoji: '🧠', nombre: 'Salud mental' },
  { id: 'familia',     emoji: '🕊️', nombre: 'Protección para tu familia' },
  { id: 'dinero',      emoji: '💰', nombre: 'Haz crecer tu dinero' },
  { id: 'casa',        emoji: '🏠', nombre: 'Casa, trámites y día a día' },
  { id: 'descuentos',  emoji: '🏷️', nombre: 'Red de descuentos' },
] as const

export type CategoriaBeneficioId = (typeof CATEGORIAS_BENEFICIO)[number]['id']

export const CATEGORIAS_BENEFICIO_IDS: readonly string[] = CATEGORIAS_BENEFICIO.map(c => c.id)

export interface BeneficioCatalogo {
  clave: string
  nombre: string
  emoji: string
  categoria: CategoriaBeneficioId
  /** Slug de la tarjeta en `beneficios_catalogo` (el seguro Thona agrupa varias). */
  slugPadre: string
}

const THONA = 'seguro-thona'

export const BENEFICIOS_CATALOGO = [
  { clave: 'ambulancia', nombre: 'Ambulancia', emoji: '🚑', categoria: 'emergencias', slugPadre: THONA },
  { clave: 'taxi-seguro', nombre: 'Taxi seguro', emoji: '🚕', categoria: 'emergencias', slugPadre: THONA },
  { clave: 'gastos-medicos-accidente', nombre: 'Gastos médicos por accidente', emoji: '🏥', categoria: 'emergencias', slugPadre: THONA },
  { clave: 'accidente-bicicleta', nombre: 'Accidente en bicicleta', emoji: '🚲', categoria: 'emergencias', slugPadre: THONA },
  { clave: 'abogado-asalto', nombre: 'Abogado por asalto', emoji: '🛡️', categoria: 'emergencias', slugPadre: THONA },
  { clave: 'asesoria-choque', nombre: 'Asesoría por choque', emoji: '🚗', categoria: 'emergencias', slugPadre: THONA },
  { clave: 'medico-telefono', nombre: 'Médico general por teléfono', emoji: '📞', categoria: 'salud', slugPadre: THONA },
  { clave: 'videoconsulta', nombre: 'Videoconsulta con receta', emoji: '💻', categoria: 'salud', slugPadre: THONA },
  { clave: 'medico-domicilio', nombre: 'Médico a domicilio', emoji: '🩺', categoria: 'salud', slugPadre: THONA },
  { clave: 'estudio-laboratorio', nombre: 'Estudio de laboratorio anual', emoji: '🔬', categoria: 'salud', slugPadre: THONA },
  { clave: 'laboratorio-domicilio', nombre: 'Laboratorio a domicilio', emoji: '🧪', categoria: 'salud', slugPadre: THONA },
  { clave: 'enfermera-domicilio', nombre: 'Enfermera a domicilio', emoji: '👩‍⚕️', categoria: 'salud', slugPadre: THONA },
  { clave: 'dental', nombre: 'Dental', emoji: '🦷', categoria: 'salud', slugPadre: THONA },
  { clave: 'odontologo-telefono', nombre: 'Odontólogo por teléfono', emoji: '☎️', categoria: 'salud', slugPadre: THONA },
  { clave: 'visual', nombre: 'Visual', emoji: '👓', categoria: 'salud', slugPadre: THONA },
  { clave: 'lhogros', nombre: 'Terapia con Lhogros', emoji: '🧠', categoria: 'mente', slugPadre: 'psicologos-lhogros' },
  { clave: 'psicologia-telefono', nombre: 'Psicología por teléfono', emoji: '💬', categoria: 'mente', slugPadre: THONA },
  { clave: 'seguro-vida', nombre: 'Seguro de vida por accidente', emoji: '❤️', categoria: 'familia', slugPadre: THONA },
  { clave: 'funeraria', nombre: 'Huella Funeraria 360', emoji: '🕊️', categoria: 'familia', slugPadre: THONA },
  { clave: 'cent-app', nombre: 'CENT App', emoji: '💰', categoria: 'dinero', slugPadre: 'cent-app' },
  { clave: 'vicente-ia', nombre: 'Vicente+', emoji: '🤖', categoria: 'dinero', slugPadre: 'vicente-ia' },
  { clave: 'central-cuentas', nombre: 'CENTral de Cuentas', emoji: '🧾', categoria: 'dinero', slugPadre: 'central-cuentas' },
  { clave: 'curso-finanzas', nombre: 'Finanzas con CENTido', emoji: '📚', categoria: 'dinero', slugPadre: 'curso-finanzas' },
  { clave: 'legal-telefono', nombre: 'Asesoría legal por teléfono', emoji: '⚖️', categoria: 'casa', slugPadre: THONA },
  { clave: 'hogar', nombre: 'Plomería, carpintería y electricidad', emoji: '🔧', categoria: 'casa', slugPadre: THONA },
  { clave: 'pc', nombre: 'Orientación técnica de computadora', emoji: '🖥️', categoria: 'casa', slugPadre: THONA },
  { clave: 'internet', nombre: 'Internet para el Bienestar', emoji: '📱', categoria: 'casa', slugPadre: 'sim-datos' },
  { clave: 'red-medica-descuentos', nombre: 'Red médica de descuentos', emoji: '🏷️', categoria: 'descuentos', slugPadre: THONA },
  { clave: 'ciente-descuentos', nombre: 'CiENTe+ Descuentos', emoji: '🎟️', categoria: 'descuentos', slugPadre: 'ciente-descuentos' },
] as const satisfies readonly BeneficioCatalogo[]

export type ClaveBeneficio = (typeof BENEFICIOS_CATALOGO)[number]['clave']

function buscar(clave: string | null | undefined): BeneficioCatalogo | undefined {
  if (!clave) return undefined
  return (BENEFICIOS_CATALOGO as readonly BeneficioCatalogo[]).filter(b => b.clave === clave)[0]
}

export function beneficioDelCatalogo(clave: string | null | undefined): BeneficioCatalogo | null {
  return buscar(clave) ?? null
}

export function esCategoriaBeneficio(id: string | null | undefined): id is CategoriaBeneficioId {
  return !!id && CATEGORIAS_BENEFICIO_IDS.indexOf(id) >= 0
}

/**
 * Categoría de un clic. Catálogo primero (clasifica el histórico sin `categoria`), luego
 * lo que mandó el tracking si es una categoría válida, y si no `null` = sin clasificar.
 */
export function categoriaDeBeneficio(
  clave: string | null | undefined,
  categoriaTracking: string | null | undefined,
): CategoriaBeneficioId | null {
  const b = buscar(clave)
  if (b) return b.categoria
  return esCategoriaBeneficio(categoriaTracking) ? categoriaTracking : null
}

/** Nombre para mostrar. Una clave desconocida se enseña CRUDA, nunca se esconde. */
export function nombreDeBeneficio(clave: string): string {
  return buscar(clave)?.nombre ?? clave
}

export function categoriaBeneficioInfo(id: string | null | undefined): { id: string; emoji: string; nombre: string } {
  if (!id || id === 'sin') return { id: 'sin', emoji: '❔', nombre: 'Sin clasificar' }
  const c = CATEGORIAS_BENEFICIO.filter(x => x.id === id)[0]
  return c ? { id: c.id, emoji: c.emoji, nombre: c.nombre } : { id, emoji: '•', nombre: id }
}
