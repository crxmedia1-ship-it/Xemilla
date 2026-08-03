/**
 * Plantillas de estructura (Layout Themes) para Home y Ubicación.
 */

export const HOME_THEME_IDS = /** @type {const} */ ([
  'editorial',
  'bento',
  'hero',
  'minimal',
]);
export const UBICACION_THEME_IDS = /** @type {const} */ (['modal', 'split']);

/** Fallback cuando Supabase no trae home_theme. */
export const DEFAULT_HOME_THEME = 'bento';
export const DEFAULT_UBICACION_THEME = 'modal';

/**
 * Slugify / match flexible de home_theme (Admin labels + slugs DB).
 * Exact same logic for sanitizeTheme / normalizeTheme / normalizeHomeTheme / getNormalizedTheme.
 * @param {unknown} theme
 * @returns {'editorial' | 'hero' | 'bento' | 'minimal'}
 */
export function normalizeTheme(theme) {
  const clean = String(theme || '').toLowerCase();
  if (clean.includes('editorial') || clean.includes('boutique')) return 'editorial';
  if (clean.includes('hero') || clean.includes('cards')) return 'hero';
  if (clean.includes('minimal')) return 'minimal';
  return 'bento';
}

/** @param {unknown} raw */
export function sanitizeTheme(raw) {
  return normalizeTheme(raw);
}

/** Aliases compatibles con Admin / API */
export function getNormalizedTheme(rawTheme) {
  return normalizeTheme(rawTheme);
}

export function normalizeHomeTheme(value) {
  return normalizeTheme(value);
}

export const HOME_THEME_MAP = Object.freeze({
  editorial: 'editorial',
  bento: 'bento',
  hero: 'hero',
  minimal: 'minimal',
});

/**
 * @param {unknown} value
 * @returns {'modal' | 'split'}
 */
export function normalizeUbicacionTheme(value) {
  const key = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ');

  if (!key) return DEFAULT_UBICACION_THEME;

  const slug = key
    .replace(/[()]/g, ' ')
    .replace(/[/\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (
    key === 'split' ||
    key.includes('split') ||
    slug === 'split' ||
    slug === 'split-map' ||
    slug === 'splitmap'
  ) {
    return 'split';
  }

  if (
    key === 'modal' ||
    key.includes('modal') ||
    key.includes('drawer') ||
    key === 'sheet' ||
    slug === 'modal' ||
    slug === 'drawer'
  ) {
    return 'modal';
  }

  return DEFAULT_UBICACION_THEME;
}

/**
 * @param {string} id
 * @param {string} fallbackTagline
 * @param {{ wifiSsid?: string, wifiClave?: string }} [wifi]
 */
export function homeNavSubtitle(id, fallbackTagline, wifi = {}) {
  if (id === 'wifi') {
    const ssid = String(wifi.wifiSsid || '').trim();
    const clave = String(wifi.wifiClave || '').trim();
    if (ssid || clave) {
      const parts = [];
      if (ssid) parts.push(`SSID: ${ssid}`);
      if (clave) parts.push(`CLAVE: ${clave}`);
      return parts.join('  ·  ');
    }
    return 'GUEST NETWORK';
  }
  const map = {
    menu: '',
    nosotros: 'NUESTRA FILOSOFÍA',
    ubicacion: 'HORARIOS Y CONTACTO',
    dividir: 'SPLIT THE BILL',
    mesero: 'CALL YOUR SERVER',
    boutique: 'EXPLORA NUESTRA TIENDA OFICIAL',
    wifi: 'GUEST NETWORK',
  };
  if (id === 'menu') {
    const fromBrand = fallbackTagline?.trim();
    return fromBrand ? fromBrand.toUpperCase() : '';
  }
  return map[id] || '';
}

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   subtitle: string,
 *   kind: 'section' | 'reservas' | 'boutique',
 *   href?: string,
 *   requiresMesa?: boolean,
 * }} HomeNavItem
 */

/**
 * Construye la secuencia Carrd / Home preservando orden y gate de mesa.
 * @param {{
 *   tagline?: string,
 *   showWifi?: boolean,
 *   showDividir?: boolean,
 *   showLlamarMesero?: boolean,
 *   showBoutique?: boolean,
 *   wifiSsid?: string,
 *   wifiClave?: string,
 *   reservasCta?: { label?: string, href?: string } | null,
 *   compact?: boolean,
 * }} opts
 * @returns {HomeNavItem[]}
 */
export function buildHomeNavSequence(opts = {}) {
  const tagline = opts.tagline || '';
  const wifi = { wifiSsid: opts.wifiSsid || '', wifiClave: opts.wifiClave || '' };
  const compact = Boolean(opts.compact);

  /** @type {HomeNavItem[]} */
  const primary = [
    {
      id: 'menu',
      label: compact ? 'EL MENÚ' : 'EL MENÚ',
      subtitle: homeNavSubtitle('menu', tagline, wifi),
      kind: 'section',
    },
    {
      id: 'nosotros',
      label: compact ? 'NOSOTROS' : 'NOSOTROS',
      subtitle: homeNavSubtitle('nosotros', tagline, wifi),
      kind: 'section',
    },
  ];

  /** @type {HomeNavItem[]} */
  const trailing = [
    {
      id: 'ubicacion',
      label: compact ? 'UBICACIÓN' : 'UBICACIÓN Y HORARIOS',
      subtitle: homeNavSubtitle('ubicacion', tagline, wifi),
      kind: 'section',
    },
  ];

  if (opts.showWifi) {
    trailing.push({
      id: 'wifi',
      label: compact ? 'WI-FI' : 'CONECTAR WI-FI',
      subtitle: homeNavSubtitle('wifi', tagline, wifi),
      kind: 'section',
    });
  }
  if (opts.showLlamarMesero) {
    trailing.push({
      id: 'mesero',
      label: compact ? 'MESERO' : 'LLAMAR MESERO',
      subtitle: homeNavSubtitle('mesero', tagline, wifi),
      kind: 'section',
      requiresMesa: true,
    });
  }
  if (opts.showDividir) {
    trailing.push({
      id: 'dividir',
      label: compact ? 'LA CUENTA' : 'PEDIR LA CUENTA / DIVIDIR CUENTA',
      subtitle: homeNavSubtitle('dividir', tagline, wifi),
      kind: 'section',
      requiresMesa: true,
    });
  }
  if (opts.showBoutique) {
    trailing.push({
      id: 'boutique',
      label: compact ? 'BOUTIQUE' : 'BOUTIQUE / MERCHANDISE',
      subtitle: homeNavSubtitle('boutique', tagline, wifi),
      kind: 'boutique',
    });
  }

  const hasReservas = Boolean(opts.reservasCta?.href);
  /** @type {HomeNavItem | null} */
  const reservasItem = hasReservas
    ? {
        id: 'reservas',
        label: compact
          ? 'RESERVAS'
          : String(opts.reservasCta?.label || 'PEDIR / RESERVAR').toUpperCase(),
        subtitle: 'RESERVATIONS',
        kind: 'reservas',
        href: opts.reservasCta?.href,
      }
    : null;

  return [...primary, ...(reservasItem ? [reservasItem] : []), ...trailing];
}
