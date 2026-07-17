/**
 * Temas visuales del panel admin Xemilla.
 * Persistidos en localStorage bajo `xemilla-admin-theme`.
 */

export const ADMIN_THEME_KEY = 'xemilla-admin-theme';

/** @typedef {'organico' | 'onyx' | 'alabastro'} AdminThemeId */

/** @type {AdminThemeId[]} */
export const ADMIN_THEME_IDS = ['organico', 'onyx', 'alabastro'];

/**
 * @type {Record<AdminThemeId, { label: string, swatch: string }>}
 */
export const ADMIN_THEME_META = {
  organico: {
    label: 'Xemilla Orgánico',
    /** Base crema; el CSS del switcher añade el toque de lacre */
    swatch: '#F0EBE3',
  },
  onyx: {
    label: 'Xemilla Onyx',
    swatch: '#0A0A0B',
  },
  alabastro: {
    label: 'Xemilla Alabastro',
    swatch: '#FFFFFF',
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
  if (v === 'organico' || v === 'organic') return 'organico';
  if (v === 'onyx' || v === 'oscuro' || v === 'dark') return 'onyx';
  if (v === 'alabastro' || v === 'claro' || v === 'light') return 'alabastro';
  return 'onyx';
}
