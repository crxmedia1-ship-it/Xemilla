/**
 * Tipografías del menú interactivo (títulos + precios).
 * Acepta presets legacy (elegant/modern/urban) o cualquier familia Google Fonts.
 */

/**
 * @typedef {Object} MenuFontPreset
 * @property {string} id
 * @property {string} label
 * @property {string} family
 * @property {string} stack
 * @property {string} googleHref
 */

/** @type {Record<string, MenuFontPreset>} */
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

export const DEFAULT_MENU_FONT = 'elegant';

/** Catálogo agrupado para el selector del admin. */
export const MENU_FONT_GROUPS = [
  {
    label: 'Serif / Editorial',
    fonts: [
      'Playfair Display',
      'Cinzel',
      'Cormorant Garamond',
      'Fraunces',
      'Libre Baskerville',
      'Lora',
      'Newsreader',
      'EB Garamond',
      'Source Serif 4',
      'Cormorant',
    ],
  },
  {
    label: 'Sans / Moderna',
    fonts: [
      'Inter',
      'Space Grotesk',
      'Syne',
      'Outfit',
      'Manrope',
      'DM Sans',
      'Plus Jakarta Sans',
      'Instrument Sans',
      'Montserrat',
      'Archivo',
      'IBM Plex Sans',
      'Josefin Sans',
      'Karla',
      'Nunito',
      'Raleway',
      'Work Sans',
    ],
  },
  {
    label: 'Display / Impacto',
    fonts: ['Oswald', 'Bebas Neue', 'Italiana', 'Great Vibes'],
  },
];

export const MENU_GOOGLE_FONT_OPTIONS = MENU_FONT_GROUPS.flatMap((g) => g.fonts);

/** Hoja Google Fonts para previsualizar el selector en Identidad. */
export const MENU_FONTS_PREVIEW_HREF = `https://fonts.googleapis.com/css2?${MENU_GOOGLE_FONT_OPTIONS.map(
  (name) => `family=${name.replace(/ /g, '+')}:wght@400;500;600;700`,
).join('&')}&display=swap`;

/**
 * @param {unknown} value
 * @returns {string}
 */
export function sanitizeMenuFontFamily(value) {
  if (typeof value !== 'string') return '';
  const cleaned = value
    .replace(/["'`\\;{}<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  if (!cleaned || /url\(|@import|https?:/i.test(cleaned)) return '';
  if (!/^[A-Za-z0-9][A-Za-z0-9 \-]*$/.test(cleaned)) return '';
  return cleaned;
}

/**
 * @param {string} family
 */
export function googleFontHrefForFamily(family) {
  const name = sanitizeMenuFontFamily(family);
  if (!name) return '';
  const encoded = name.replace(/ /g, '+');
  return `https://fonts.googleapis.com/css2?family=${encoded}:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap`;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeMenuFontId(value) {
  if (typeof value !== 'string') return DEFAULT_MENU_FONT;
  const key = value.trim().toLowerCase();
  if (key === 'elegant' || key === 'elegante' || key === 'alta-cocina' || key === 'playfair') {
    return 'elegant';
  }
  if (key === 'modern' || key === 'moderna' || key === 'minimalista' || key === 'space-grotesk') {
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
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return MENU_FONT_PRESETS[DEFAULT_MENU_FONT];

  const presetKey = normalizeMenuFontId(raw);
  const looksLikePreset =
    /^(elegant|elegante|modern|moderna|urban|urbana|alta-cocina|minimalista|street|playfair|oswald|barlow|space-grotesk)$/i.test(
      raw,
    );
  if (looksLikePreset && MENU_FONT_PRESETS[presetKey]) {
    return MENU_FONT_PRESETS[presetKey];
  }

  const family = sanitizeMenuFontFamily(raw);
  if (!family) return MENU_FONT_PRESETS[DEFAULT_MENU_FONT];

  const lower = family.toLowerCase();
  const presetMatch = Object.values(MENU_FONT_PRESETS).find(
    (p) => p.family.toLowerCase() === lower,
  );
  if (presetMatch) return presetMatch;

  return {
    id: family.toLowerCase().replace(/\s+/g, '-'),
    label: family,
    family,
    stack: `"${family}", ui-sans-serif, system-ui, sans-serif`,
    googleHref: googleFontHrefForFamily(family),
  };
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
