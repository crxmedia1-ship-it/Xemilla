/**
 * Temas visuales del panel admin Xemilla.
 * Persistidos en localStorage bajo `xemilla-admin-theme`.
 *
 * Canónico (Sol/Luna): `dark` (Observatorio Cósmico) | `light` (La Habitación del Tiempo)
 * Legacy: `onyx` → dark, `alabastro`/`organico`/`cristalino` → light
 */

export const ADMIN_THEME_KEY = 'xemilla-admin-theme';

/** @typedef {'dark' | 'light'} AdminThemeId */

/** @type {AdminThemeId[]} */
export const ADMIN_THEME_IDS = ['dark', 'light'];

/**
 * @type {Record<AdminThemeId, { label: string, swatch: string, metaColor: string }>}
 */
export const ADMIN_THEME_META = {
  dark: {
    label: 'Observatorio Cósmico',
    swatch: '#030712',
    metaColor: '#030712',
  },
  light: {
    label: 'La Habitación del Tiempo',
    swatch: '#f8fafc',
    metaColor: '#f8fafc',
  },
};

/**
 * @param {unknown} value
 * @returns {AdminThemeId}
 */
export function normalizeAdminTheme(value) {
  const v = String(value || '')
    .trim()
    .toLowerCase();
  if (
    v === 'light' ||
    v === 'claro' ||
    v === 'alabastro' ||
    v === 'organico' ||
    v === 'organic' ||
    v === 'cristalino' ||
    v === 'habitacion' ||
    v === 'habitacion-del-tiempo'
  ) {
    return 'light';
  }
  if (
    v === 'dark' ||
    v === 'oscuro' ||
    v === 'onyx' ||
    v === 'deep-space' ||
    v === 'deepspace' ||
    v === 'observatorio' ||
    v === 'observatorio-cosmico'
  ) {
    return 'dark';
  }
  return 'dark';
}
