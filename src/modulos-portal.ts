/**
 * El catálogo de módulos del Portal Cientemas — la lista ÚNICA.
 *
 * ## Por qué vive aquí (Simón, 2026-09-30)
 *
 * «Salud CiENTeMAS es la pantalla más importante a futuro: nos dice en qué y cómo tenemos
 * que trabajar. Si cambiamos algo, debe ajustarse aquí de forma automática.»
 *
 * Hasta hoy la lista existía tres veces: `MODULOS_PORTAL` en el portal (lo que RH enciende),
 * `ModuloKey` en `modulos-activos.ts` del portal, y `MODULOS_POR_SUJETO` en Vicenta (lo que
 * Salud mide). Un módulo nuevo en el portal no aparecía en Salud hasta que alguien se
 * acordara de copiarlo — y mientras tanto el despliegue se calculaba sobre un universo
 * equivocado sin que nada fallara.
 *
 * Ahora:
 * - el portal construye `MODULOS_PORTAL` y `ModuloKey` desde aquí (TS lo obliga a darle
 *   descripción y rutas a cada llave);
 * - Vicenta construye sus reglas de medición desde aquí, y `check:salud-reglas` falla si un
 *   módulo × sujeto no tiene regla ni está declarado «sin medición» con motivo;
 * - en runtime, un módulo sin regla sale como «encendido, sin medición (falta regla)»:
 *   cuenta en el despliegue, nunca desaparece ni cuenta 0.
 *
 * ## Qué NO está aquí
 *
 * Los módulos BASE (dashboard, empleados, listas, facturación, contrato, ajustes): no se
 * apagan, no son despliegue. Y el interruptor maestro `portal`, que no es un módulo.
 *
 * Puro, sin dependencias, JSON-serializable (ver README).
 */

/** Quién usa el módulo: el RH del cliente, o el colaborador desde su hub. */
export type SujetoModulo = 'rh' | 'colab'

export interface ModuloPortalCatalogo {
  /** La llave en `empresas.modulos_config`. */
  key: string
  label: string
  /** Siempre `true` en este catálogo: todos tienen llave en `modulos_config`. */
  conLlave: true
  /** Qué sujetos lo usan. Define qué caras tiene que medir Salud. */
  sujetos: readonly SujetoModulo[]
  /** Sobrevive al portal apagado (los beneficios se pagan aparte del portal). */
  sinPortal?: boolean
  /**
   * Solo-CENT: se enciende únicamente con `true` explícito y RH no puede encenderlo desde
   * Ajustes. NO entra al universo del despliegue. Hoy NINGÚN módulo lo es (el Canal lo fue
   * del 2026-09-23 al 30); se conserva el campo para no reinventarlo si vuelve a hacer falta.
   */
  soloCent?: boolean
}

/** En el orden en que el portal los enseña en Ajustes → Módulos. */
export const MODULOS_PORTAL_CATALOGO = [
  { key: 'nomina',          label: 'Nómina',             conLlave: true, sujetos: ['rh', 'colab'] },
  { key: 'vacaciones',      label: 'Vacaciones',         conLlave: true, sujetos: ['rh', 'colab'] },
  { key: 'expediente',      label: 'Expediente digital', conLlave: true, sujetos: ['rh', 'colab'] },
  { key: 'analitica',       label: 'Analítica',          conLlave: true, sujetos: ['rh'] },
  { key: 'beneficios',      label: 'Beneficios',         conLlave: true, sujetos: ['colab'], sinPortal: true },
  { key: 'cultura',         label: 'Cultura',            conLlave: true, sujetos: ['rh'] },
  { key: 'comunicaciones',  label: 'Comunicados',        conLlave: true, sujetos: ['rh', 'colab'] },
  { key: 'encuestas',       label: 'Encuestas',          conLlave: true, sujetos: ['rh', 'colab'] },
  { key: 'reconocimientos', label: 'Metas y reconocimientos', conLlave: true, sujetos: ['rh', 'colab'] },
  { key: 'desempeno',       label: 'Desempeño',          conLlave: true, sujetos: ['rh', 'colab'] },
  { key: 'ideas',           label: 'Buzón de ideas',     conLlave: true, sujetos: ['rh', 'colab'] },
  { key: 'nom035',          label: 'NOM-035',            conLlave: true, sujetos: ['rh', 'colab'] },
  { key: 'capacitaciones',  label: 'Capacitaciones',     conLlave: true, sujetos: ['rh', 'colab'] },
  { key: 'quejas',          label: 'Buzón de quejas',    conLlave: true, sujetos: ['rh', 'colab'] },
  { key: 'celebraciones',   label: 'Celebraciones',      conLlave: true, sujetos: ['colab'] },
  { key: 'checador',        label: 'Checador',           conLlave: true, sujetos: ['rh', 'colab'] },
  { key: 'muro',            label: 'Muro',               conLlave: true, sujetos: ['rh', 'colab'] },
  { key: 'agenda',          label: 'Agenda',             conLlave: true, sujetos: ['rh', 'colab'] },
  // Desde el 2026-09-30 (Simón) el Canal sigue la regla general: encendido salvo `false`, RH
  // lo apaga desde Ajustes o /canal. Ya no es solo-CENT y entra al universo del despliegue.
  // RH también lo usa: le contesta al colaborador en su canal «Recursos Humanos».
  { key: 'canal',           label: 'Canal interno',      conLlave: true, sujetos: ['rh', 'colab'] },
] as const satisfies readonly ModuloPortalCatalogo[]

export type ModuloPortalKey = (typeof MODULOS_PORTAL_CATALOGO)[number]['key']

/** Los que el cliente puede encender: el denominador del despliegue. */
export const MODULOS_DEL_CLIENTE_CATALOGO: readonly ModuloPortalCatalogo[] =
  (MODULOS_PORTAL_CATALOGO as readonly ModuloPortalCatalogo[]).filter(m => !m.soloCent)

/** Llaves que solo se encienden con `true` explícito. */
export const MODULOS_SOLO_CENT: readonly string[] =
  (MODULOS_PORTAL_CATALOGO as readonly ModuloPortalCatalogo[]).filter(m => m.soloCent).map(m => m.key)

/** Llaves que sobreviven al portal apagado. */
export const MODULOS_SIN_PORTAL: readonly string[] =
  (MODULOS_PORTAL_CATALOGO as readonly ModuloPortalCatalogo[]).filter(m => m.sinPortal).map(m => m.key)

/**
 * ¿Está encendido este módulo para esta empresa? Ausente = encendido, salvo los solo-CENT
 * (requieren `true`), y el maestro `portal === false` apaga todo menos lo que sobrevive.
 * Acepta una llave que no esté en el catálogo: se trata como módulo normal.
 */
export function moduloPortalEncendido(
  config: Record<string, boolean | undefined> | null | undefined,
  key: string,
): boolean {
  const def = (MODULOS_PORTAL_CATALOGO as readonly ModuloPortalCatalogo[]).filter(m => m.key === key)[0]
  if (config?.[key] === false) return false
  if (def?.soloCent && config?.[key] !== true) return false
  if (config?.portal === false && !def?.sinPortal) return false
  return true
}
