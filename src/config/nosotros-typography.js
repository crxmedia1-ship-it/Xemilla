/**
 * Fuentes Google Fonts para títulos y cuerpo — sección Nosotros.
 */

/** @typedef {{ id: string, label: string, stack: string, google: string }} NosotrosFontOption */

/** @type {NosotrosFontOption[]} */
export const NOSOTROS_FUENTES_TITULO = [
  {
    id: 'cinzel',
    label: 'Cinzel — Lujo editorial',
    stack: '"Cinzel", ui-serif, Georgia, serif',
    google: 'Cinzel:wght@500;600;700',
  },
  {
    id: 'playfair',
    label: 'Playfair Display — Clásica',
    stack: '"Playfair Display", ui-serif, Georgia, serif',
    google: 'Playfair+Display:ital,wght@0,500;0,600;0,700;1,500',
  },
  {
    id: 'cormorant',
    label: 'Cormorant Garamond — Elegante',
    stack: '"Cormorant Garamond", ui-serif, Georgia, serif',
    google: 'Cormorant+Garamond:wght@500;600;700',
  },
  {
    id: 'fraunces',
    label: 'Fraunces — Carácter',
    stack: 'Fraunces, ui-serif, Georgia, serif',
    google: 'Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700',
  },
  {
    id: 'syne',
    label: 'Syne — Moderna bold',
    stack: 'Syne, ui-sans-serif, system-ui, sans-serif',
    google: 'Syne:wght@600;700;800',
  },
  {
    id: 'space-grotesk',
    label: 'Space Grotesk — Geométrica',
    stack: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif',
    google: 'Space+Grotesk:wght@500;600;700',
  },
  {
    id: 'dm-serif',
    label: 'DM Serif Display — Display',
    stack: '"DM Serif Display", ui-serif, Georgia, serif',
    google: 'DM+Serif+Display',
  },
  {
    id: 'libre-baskerville',
    label: 'Libre Baskerville — Serif',
    stack: '"Libre Baskerville", ui-serif, Georgia, serif',
    google: 'Libre+Baskerville:wght@400;700',
  },
];

/** @type {NosotrosFontOption[]} */
export const NOSOTROS_FUENTES_CUERPO = [
  {
    id: 'plus-jakarta',
    label: 'Plus Jakarta Sans — Limpia',
    stack: '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
    google: 'Plus+Jakarta+Sans:wght@400;500;600;700',
  },
  {
    id: 'inter',
    label: 'Inter — Neutral',
    stack: 'Inter, ui-sans-serif, system-ui, sans-serif',
    google: 'Inter:wght@400;500;600;700',
  },
  {
    id: 'montserrat',
    label: 'Montserrat — Versátil',
    stack: 'Montserrat, ui-sans-serif, system-ui, sans-serif',
    google: 'Montserrat:wght@400;500;600;700',
  },
  {
    id: 'dm-sans',
    label: 'DM Sans — Suave',
    stack: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
    google: 'DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700',
  },
  {
    id: 'lora',
    label: 'Lora — Serif cuerpo',
    stack: 'Lora, ui-serif, Georgia, serif',
    google: 'Lora:wght@400;500;600;700',
  },
  {
    id: 'source-sans',
    label: 'Source Sans 3 — Legible',
    stack: '"Source Sans 3", ui-sans-serif, system-ui, sans-serif',
    google: 'Source+Sans+3:wght@400;500;600;700',
  },
  {
    id: 'nunito-sans',
    label: 'Nunito Sans — Amigable',
    stack: '"Nunito Sans", ui-sans-serif, system-ui, sans-serif',
    google: 'Nunito+Sans:wght@400;500;600;700',
  },
  {
    id: 'literata',
    label: 'Literata — Lectura',
    stack: 'Literata, ui-serif, Georgia, serif',
    google: 'Literata:opsz,wght@7..72,400;7..72,500;7..72;600',
  },
];

export const DEFAULT_NOSOTROS_FUENTE_TITULO = 'cinzel';
export const DEFAULT_NOSOTROS_FUENTE_CUERPO = 'plus-jakarta';

/**
 * @param {unknown} value
 * @param {NosotrosFontOption[]} options
 * @param {string} fallbackId
 */
function resolveFontOption(value, options, fallbackId) {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase();
  if (!raw) {
    return options.find((o) => o.id === fallbackId) || options[0];
  }
  const hit = options.find((o) => o.id === raw);
  if (hit) return hit;
  const fuzzy = options.find((o) => {
    const label = o.label.toLowerCase();
    const stack = o.stack.toLowerCase();
    return (
      raw.includes(o.id) ||
      label.includes(raw) ||
      raw.includes(label.split('—')[0].trim()) ||
      stack.includes(raw)
    );
  });
  return fuzzy || options.find((o) => o.id === fallbackId) || options[0];
}

/** @param {unknown} value */
export function resolveNosotrosFuenteTitulo(value) {
  return resolveFontOption(value, NOSOTROS_FUENTES_TITULO, DEFAULT_NOSOTROS_FUENTE_TITULO);
}

/** @param {unknown} value */
export function resolveNosotrosFuenteCuerpo(value) {
  return resolveFontOption(value, NOSOTROS_FUENTES_CUERPO, DEFAULT_NOSOTROS_FUENTE_CUERPO);
}

/**
 * @param {unknown} tituloId
 * @param {unknown} cuerpoId
 */
export function buildNosotrosFontsHref(tituloId, cuerpoId) {
  const titulo = resolveNosotrosFuenteTitulo(tituloId);
  const cuerpo = resolveNosotrosFuenteCuerpo(cuerpoId);
  const families = new Set([titulo.google, cuerpo.google]);
  const query = [...families].join('&family=');
  return `https://fonts.googleapis.com/css2?family=${query}&display=swap`;
}
