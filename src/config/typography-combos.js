/**
 * Combinaciones tipográficas Pro (Google Fonts) para alta gastronomía.
 * Sustituye el selector "Estilo ADN" en Identidad de Marca.
 */

/** @typedef {'luxe-editorial' | 'modern-gastrobar' | 'classic-bistro' | 'minimal-stark'} TypographyComboId */

/**
 * @typedef {Object} TypographyCombo
 * @property {TypographyComboId} id
 * @property {string} label
 * @property {string} description
 * @property {string} heading
 * @property {string} body
 * @property {string} headingStack
 * @property {string} bodyStack
 * @property {string} googleHref
 */

/** @type {Record<TypographyComboId, TypographyCombo>} */
export const TYPOGRAPHY_COMBOS = {
  'luxe-editorial': {
    id: 'luxe-editorial',
    label: 'Luxe & Editorial',
    description: 'Cinzel + Plus Jakarta Sans',
    heading: 'Cinzel',
    body: 'Plus Jakarta Sans',
    headingStack: '"Cinzel", ui-serif, Georgia, serif',
    bodyStack: '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
    googleHref:
      'https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap',
  },
  'modern-gastrobar': {
    id: 'modern-gastrobar',
    label: 'Modern Gastrobar',
    description: 'Syne + Inter',
    heading: 'Syne',
    body: 'Inter',
    headingStack: 'Syne, ui-sans-serif, system-ui, sans-serif',
    bodyStack: 'Inter, ui-sans-serif, system-ui, sans-serif',
    googleHref:
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Syne:wght@500;600;700;800&display=swap',
  },
  'classic-bistro': {
    id: 'classic-bistro',
    label: 'Classic Bistro',
    description: 'Playfair Display + Montserrat',
    heading: 'Playfair Display',
    body: 'Montserrat',
    headingStack: '"Playfair Display", ui-serif, Georgia, serif',
    bodyStack: 'Montserrat, ui-sans-serif, system-ui, sans-serif',
    googleHref:
      'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,500&display=swap',
  },
  'minimal-stark': {
    id: 'minimal-stark',
    label: 'Minimal Stark',
    description: 'Space Grotesk + DM Sans',
    heading: 'Space Grotesk',
    body: 'DM Sans',
    headingStack: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif',
    bodyStack: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
    googleHref:
      'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Space+Grotesk:wght@500;600;700&display=swap',
  },
};

export const DEFAULT_TYPOGRAPHY_COMBO =
  /** @type {TypographyComboId} */ ('luxe-editorial');

export const TYPOGRAPHY_COMBO_OPTIONS = Object.values(TYPOGRAPHY_COMBOS);

/**
 * @param {unknown} value
 * @returns {TypographyComboId}
 */
export function normalizeTypographyComboId(value) {
  if (typeof value !== 'string') return DEFAULT_TYPOGRAPHY_COMBO;
  const raw = value.trim().toLowerCase();
  if (!raw) return DEFAULT_TYPOGRAPHY_COMBO;

  if (raw in TYPOGRAPHY_COMBOS) {
    return /** @type {TypographyComboId} */ (raw);
  }

  // Aliases / legacy ADN o stacks de fuentes
  if (
    raw === 'elegant' ||
    raw === 'luxe' ||
    raw === 'editorial' ||
    raw.includes('cinzel') ||
    raw.includes('jakarta')
  ) {
    return 'luxe-editorial';
  }
  if (
    raw === 'modern' ||
    raw === 'gastrobar' ||
    raw.includes('syne') ||
    (raw.includes('inter') && !raw.includes('display'))
  ) {
    return 'modern-gastrobar';
  }
  if (
    raw === 'classic' ||
    raw === 'bistro' ||
    raw.includes('playfair') ||
    raw.includes('montserrat')
  ) {
    return 'classic-bistro';
  }
  if (
    raw === 'minimal' ||
    raw === 'stark' ||
    raw === 'retro' ||
    raw.includes('space grotesk') ||
    raw.includes('dm sans')
  ) {
    return 'minimal-stark';
  }

  return DEFAULT_TYPOGRAPHY_COMBO;
}

/**
 * @param {unknown} value
 * @returns {TypographyCombo}
 */
export function resolveTypographyCombo(value) {
  const id = normalizeTypographyComboId(value);
  return TYPOGRAPHY_COMBOS[id] ?? TYPOGRAPHY_COMBOS[DEFAULT_TYPOGRAPHY_COMBO];
}
