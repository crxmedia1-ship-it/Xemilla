/**
 * Design System — ADN visual multi-marca (Xemilla / CRX).
 * Tipografías, radios, ritmo y motion tokens para la WebApp pública.
 */

/** @typedef {'elegant' | 'modern' | 'retro'} DesignDnaId */

/**
 * @typedef {Object} DesignDna
 * @property {DesignDnaId} id
 * @property {string} label
 * @property {string} description
 * @property {{ display: string, body: string, stack: string, googleHref: string }} fonts
 * @property {{ card: string, chip: string, media: string, button: string }} radius
 * @property {{ section: string, item: string, cardPad: string }} spacing
 * @property {{ ui: string, reveal: string, spring: string }} motion
 * @property {string} borderStyle
 * @property {string} contrast
 */

/** @type {Record<DesignDnaId, DesignDna>} */
export const designThemes = {
  elegant: {
    id: 'elegant',
    label: 'Fine Dining',
    description: 'Tipografía editorial, espacios amplios, radios contenidos y fades suaves.',
    fonts: {
      display: 'Playfair Display',
      body: 'Syne',
      stack: '"Playfair Display", Syne, ui-serif, Georgia, serif',
      googleHref:
        'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,500&family=Syne:wght@500;600;700;800&display=swap',
    },
    radius: {
      card: '0.375rem',
      chip: '0.375rem',
      media: '0.375rem',
      button: '0.375rem',
    },
    spacing: {
      section: '2.75rem',
      item: '1.5rem',
      cardPad: '1.25rem',
    },
    motion: {
      ui: '280ms cubic-bezier(0.22, 1, 0.36, 1)',
      reveal: '620ms cubic-bezier(0.22, 1, 0.36, 1)',
      spring: '320ms cubic-bezier(0.22, 1, 0.36, 1)',
    },
    borderStyle: '1px solid rgba(255,255,255,0.1)',
    contrast: 'soft',
  },

  modern: {
    id: 'modern',
    label: 'Fast Casual',
    description: 'Sans geométrica, radios generosos y microinteracciones elásticas.',
    fonts: {
      display: 'Outfit',
      body: 'Plus Jakarta Sans',
      stack: 'Outfit, "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
      googleHref:
        'https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap',
    },
    radius: {
      card: '1rem',
      chip: '9999px',
      media: '0.875rem',
      button: '9999px',
    },
    spacing: {
      section: '2.25rem',
      item: '1.25rem',
      cardPad: '1rem',
    },
    motion: {
      ui: '200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
      reveal: '480ms cubic-bezier(0.22, 1, 0.36, 1)',
      spring: '220ms cubic-bezier(0.34, 1.56, 0.64, 1)',
    },
    borderStyle: '1px solid rgba(255,255,255,0.12)',
    contrast: 'balanced',
  },

  retro: {
    id: 'retro',
    label: 'Urban / Street',
    description: 'Display pesada, bordes finos y contraste alto.',
    fonts: {
      display: 'Rubik Dirt',
      body: 'Rubik',
      stack: '"Rubik Dirt", Rubik, ui-sans-serif, system-ui, sans-serif',
      googleHref:
        'https://fonts.googleapis.com/css2?family=Rubik+Dirt&family=Rubik:wght@400;500;600;700;800&display=swap',
    },
    radius: {
      card: '0.25rem',
      chip: '0.25rem',
      media: '0.25rem',
      button: '0.25rem',
    },
    spacing: {
      section: '2rem',
      item: '1.15rem',
      cardPad: '0.9rem',
    },
    motion: {
      ui: '160ms ease-out',
      reveal: '420ms ease-out',
      spring: '180ms ease-out',
    },
    borderStyle: '1px solid rgba(255,255,255,0.22)',
    contrast: 'high',
  },
};

export const DEFAULT_DESIGN_DNA = /** @type {DesignDnaId} */ ('elegant');

/** Fallback por slug conocido (antes de que exista `estilo_adn` en Supabase). */
const SLUG_DNA_FALLBACK = /** @type {Record<string, DesignDnaId>} */ ({
  blacksushi: 'elegant',
  'black-sushi': 'elegant',
  sanza: 'elegant',
});

/**
 * @param {unknown} value
 * @returns {DesignDnaId | null}
 */
function normalizeDnaId(value) {
  if (typeof value !== 'string') return null;
  const key = value.trim().toLowerCase();
  if (key === 'elegant' || key === 'fine' || key === 'fine-dining') return 'elegant';
  if (key === 'modern' || key === 'fast' || key === 'fast-casual') return 'modern';
  if (key === 'retro' || key === 'urban' || key === 'street') return 'retro';
  return null;
}

/**
 * Resuelve el ADN de diseño desde fila Supabase + slug.
 * @param {Record<string, unknown> | null | undefined} row
 * @param {string} [slug]
 * @returns {DesignDna}
 */
export function resolveDesignDna(row, slug = '') {
  const fromDb =
    normalizeDnaId(row?.estilo_adn) ||
    normalizeDnaId(row?.tema_estilo) ||
    normalizeDnaId(row?.design_dna);

  const raw = String(slug || '').trim().toLowerCase();
  const compact = raw.replace(/[_-]/g, '').replace(/\s+/g, '');
  const fromSlug =
    (raw && SLUG_DNA_FALLBACK[raw]) ||
    (compact && SLUG_DNA_FALLBACK[compact]) ||
    null;
  const id = fromDb || fromSlug || DEFAULT_DESIGN_DNA;
  return designThemes[id] ?? designThemes[DEFAULT_DESIGN_DNA];
}

/**
 * Variables CSS del design system (radios, motion, tipografías de ADN).
 * @param {DesignDna} dna
 */
export function designDnaToCssVars(dna) {
  return [
    `--fuente-principal: ${dna.fonts.stack}`,
    `--fuente-display: ${dna.fonts.display}, ${dna.fonts.stack}`,
    `--radius-card: ${dna.radius.card}`,
    `--radius-chip: ${dna.radius.chip}`,
    `--radius-media: ${dna.radius.media}`,
    `--radius-button: ${dna.radius.button}`,
    `--space-section: ${dna.spacing.section}`,
    `--space-item: ${dna.spacing.item}`,
    `--pad-card: ${dna.spacing.cardPad}`,
    `--motion-ui: ${dna.motion.ui}`,
    `--motion-reveal: ${dna.motion.reveal}`,
    `--motion-spring: ${dna.motion.spring}`,
  ].join('; ');
}
