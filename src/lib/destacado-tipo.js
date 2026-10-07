/** Etiquetas de un plato destacado. Comparten carrusel en la WebApp. */
/** @type {ReadonlyArray<'chef' | 'promocion'>} */
export const DESTACADO_TIPOS = Object.freeze(['chef', 'promocion']);

/** @type {Readonly<Record<'chef' | 'promocion', string>>} */
export const DESTACADO_TIPO_LABELS = Object.freeze({
  chef: 'Sugerencia del Chef',
  promocion: 'Promoción',
});

/**
 * @param {unknown} value
 * @returns {'chef' | 'promocion'}
 */
export function normalizeDestacadoTipo(value) {
  const key = String(value ?? '').trim().toLowerCase();
  if (key === 'promocion' || key === 'promoción' || key === 'promo') return 'promocion';
  return 'chef';
}

/**
 * Título del carrusel según la mezcla de destacados.
 * @param {Array<{ destacadoTipo?: string }>} destacados
 */
export function destacadosHeading(destacados) {
  const tipos = new Set((destacados || []).map((p) => normalizeDestacadoTipo(p?.destacadoTipo)));
  if (tipos.size === 1 && tipos.has('promocion')) return 'Promociones';
  if (tipos.size === 1) return 'Sugerencias del Chef';
  return 'Sugerencias & Promociones';
}
