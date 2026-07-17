/**
 * Tipografías curadas para títulos y precios del menú interactivo.
 * @typedef {'elegant' | 'modern' | 'urban'} MenuFontId
 */

/**
 * @typedef {Object} MenuFontPreset
 * @property {MenuFontId} id
 * @property {string} label
 * @property {string} family
 * @property {string} stack
 * @property {string} googleHref
 */

/** @type {Record<MenuFontId, MenuFontPreset>} */
export const MENU_FONT_PRESETS = {
  elegant: {
    id: 'elegant',
    label: 'Elegante / Alta Cocina',
    family: 'Playfair Display',
    stack: '"Playfair Display", ui-serif, Georgia, serif',
    googleHref:
      'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,500&display=swap',
  },
  modern: {
    id: 'modern',
    label: 'Moderna / Minimalista',
    family: 'Space Grotesk',
    stack: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif',
    googleHref:
      'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&display=swap',
  },
  urban: {
    id: 'urban',
    label: 'Urbana / Street Food',
    family: 'Oswald',
    stack: 'Oswald, "Barlow Condensed", ui-sans-serif, system-ui, sans-serif',
    googleHref:
      'https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&display=swap',
  },
};

export const DEFAULT_MENU_FONT = /** @type {MenuFontId} */ ('elegant');

/**
 * @param {unknown} value
 * @returns {MenuFontId}
 */
export function normalizeMenuFontId(value) {
  if (typeof value !== 'string') return DEFAULT_MENU_FONT;
  const key = value.trim().toLowerCase();
  if (key === 'elegant' || key === 'elegante' || key === 'alta-cocina' || key === 'playfair') {
    return 'elegant';
  }
  if (key === 'modern' || key === 'moderna' || key === 'minimalista' || key === 'space-grotesk' || key === 'syne') {
    return 'modern';
  }
  if (key === 'urban' || key === 'urbana' || key === 'street' || key === 'oswald' || key === 'barlow') {
    return 'urban';
  }
  return DEFAULT_MENU_FONT;
}

/**
 * @param {unknown} value
 * @returns {MenuFontPreset}
 */
export function resolveMenuFont(value) {
  const id = normalizeMenuFontId(value);
  return MENU_FONT_PRESETS[id] ?? MENU_FONT_PRESETS[DEFAULT_MENU_FONT];
}

/**
 * Combina hojas de Google Fonts (ADN + menú) en un solo href.
 * @param {...(string | null | undefined)} hrefs
 */
export function mergeGoogleFontHrefs(...hrefs) {
  /** @type {string[]} */
  const families = [];
  let display = 'swap';

  for (const href of hrefs) {
    if (!href || typeof href !== 'string') continue;
    try {
      const url = new URL(href);
      for (const [key, val] of url.searchParams.entries()) {
        if (key === 'family' && val && !families.includes(val)) {
          families.push(val);
        }
        if (key === 'display' && val) display = val;
      }
    } catch {
      // ignore malformed
    }
  }

  if (families.length === 0) return '';
  const params = families.map((f) => `family=${f.replace(/ /g, '+')}`).join('&');
  return `https://fonts.googleapis.com/css2?${params}&display=${display}`;
}
