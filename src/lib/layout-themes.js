/**
 * Plantillas de estructura (Layout Themes) para Home, Nosotros y Ubicación.
 */

export const HOME_THEME_IDS = /** @type {const} */ ([
  'editorial',
  'bento',
  'hero',
  'minimal',
]);
export const NOSOTROS_THEME_IDS = /** @type {const} */ ([
  'editorial',
  'cinematic',
  'capsule',
]);
export const UBICACION_THEME_IDS = /** @type {const} */ (['modal', 'split', 'minimal']);

/** Fallback cuando Supabase no trae home_theme. */
export const DEFAULT_HOME_THEME = 'bento';
export const DEFAULT_NOSOTROS_THEME = 'editorial';
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
 * @returns {'editorial' | 'cinematic' | 'capsule'}
 */
export function normalizeNosotrosTheme(value) {
  const key = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ');

  if (!key) return DEFAULT_NOSOTROS_THEME;

  if (
    key.includes('cinematic') ||
    key.includes('cinemat') ||
    key.includes('hero') ||
    key.includes('palmer') ||
    key.includes('split') ||
    key.includes('divid')
  ) {
    return 'cinematic';
  }
  if (
    key.includes('capsule') ||
    key.includes('capsul') ||
    key.includes('album') ||
    key.includes('scrapbook') ||
    key.includes('polaroid') ||
    key.includes('bento') ||
    key.includes('grid')
  ) {
    return 'capsule';
  }
  if (
    key.includes('editorial') ||
    key.includes('revista') ||
    key.includes('magazine') ||
    key === 'classic' ||
    key === 'default'
  ) {
    return 'editorial';
  }

  return DEFAULT_NOSOTROS_THEME;
}

/**
 * @param {unknown} value
 * @returns {'modal' | 'split' | 'minimal'}
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
    key === 'minimal' ||
    key.includes('minimal') ||
    key.includes('editorial') ||
    slug === 'minimal' ||
    slug === 'minimal-editorial'
  ) {
    return 'minimal';
  }

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
    ubicacion: 'HORARIOS Y UBICACIÓN',
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
      label: compact ? 'HORARIOS' : 'HORARIOS Y UBICACIÓN',
      subtitle: homeNavSubtitle('ubicacion', tagline, wifi),
      kind: 'section',
    },
  ];

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
