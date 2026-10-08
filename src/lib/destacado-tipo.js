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

const DESTACADO_OPCIONES = [
  {
    value: 'none',
    label: 'Sin destacar',
    icon: '<path d="M6 12h12"/>',
  },
  {
    value: 'chef',
    label: 'Chef',
    icon: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  },
  {
    value: 'promocion',
    label: 'Promo',
    icon: '<path d="M3.5 12.6V4.5a1 1 0 0 1 1-1h8.1l7.9 7.9a1 1 0 0 1 0 1.4l-6.7 6.7a1 1 0 0 1-1.4 0z"/><circle cx="8" cy="8" r="1.4"/>',
  },
];

/**
 * Selector de una sola pulsación: sin destacar | Chef | Promo.
 * Lo usan la tabla SSR y las filas creadas en el cliente.
 * @param {{ destacado?: boolean, destacado_tipo?: unknown }} plato
 */
export function destacadoPickerHtml(plato) {
  const value = plato?.destacado ? normalizeDestacadoTipo(plato?.destacado_tipo) : 'none';
  const current = DESTACADO_OPCIONES.find((o) => o.value === value) ?? DESTACADO_OPCIONES[0];
  const buttons = DESTACADO_OPCIONES.map((o) => {
    const on = o.value === value;
    const title = o.value === 'none' ? o.label : DESTACADO_TIPO_LABELS[o.value];
    return `<button type="button" role="radio" aria-checked="${on}" aria-label="${title}" title="${title}" data-set-destacado="${o.value}" class="dest-pick__opt${on ? ' is-active' : ''}"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${o.icon}</svg></button>`;
  }).join('');
  return `<div class="dest-pick" role="radiogroup" aria-label="Destacado" data-destacado-picker data-value="${value}"><div class="dest-pick__seg">${buttons}</div><span class="dest-pick__label" data-destacado-label>${current.label}</span></div>`;
}

/** Etiqueta corta visible bajo el selector. */
export function destacadoPickerLabel(value) {
  return (DESTACADO_OPCIONES.find((o) => o.value === value) ?? DESTACADO_OPCIONES[0]).label;
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
