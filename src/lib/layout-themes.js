/**
 * Plantillas de estructura (Layout Themes) para Home, Nosotros y Ubicación.
 */

export const HOME_THEME_IDS = /** @type {const} */ ([
  'editorial',
  'bento',
  'hamburguesa',
  'hero',
  'minimal',
]);
export const NOSOTROS_THEME_IDS = /** @type {const} */ ([
  'editorial',
  'cinematic',
  'capsule',
  'split',
  'bento',
  'timeline',
]);
export const UBICACION_THEME_IDS = /** @type {const} */ (['modal', 'split', 'minimal']);

/** Fallback cuando Supabase no trae home_theme. */
export const DEFAULT_HOME_THEME = 'bento';
export const DEFAULT_NOSOTROS_THEME = 'editorial';
export const DEFAULT_UBICACION_THEME = 'modal';

/**
 * Slugify / match flexible de home_theme (Admin labels + slugs DB).
 * @param {unknown} theme
 * @returns {'editorial' | 'bento' | 'hamburguesa' | 'hero' | 'minimal'}
 */
export function normalizeTheme(theme) {
  const clean = String(theme || '').toLowerCase();
  if (
    clean.includes('full-cinematic') ||
    clean.includes('cinematic') ||
    clean.includes('hamburguesa') ||
    clean.includes('burger') ||
    clean.includes('hambur')
  ) {
    return 'hamburguesa';
  }
  if (
    clean.includes('hero-editorial') ||
    clean.includes('editorial') ||
    clean.includes('boutique')
  ) {
    return 'editorial';
  }
  if (clean.includes('split-stage') || clean.includes('split')) return 'hero';
  if (clean.includes('bento-spatial') || clean.includes('bento') || clean.includes('spatial')) {
    return 'bento';
  }
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
  hamburguesa: 'hamburguesa',
  hero: 'hero',
  minimal: 'minimal',
});

/** Layouts del Studio Home/Core (UI) → theme canónico. */
export const HOME_LAYOUT_OPTIONS = Object.freeze([
  {
    id: 'bento-spatial',
    theme: 'bento',
    label: 'Bento Spatial',
    hint: 'Cuadrícula modular con nav frontal',
  },
  {
    id: 'hero-editorial',
    theme: 'editorial',
    label: 'Hero Editorial',
    hint: 'Tipografía protagonista y lista central',
  },
  {
    id: 'split-stage',
    theme: 'hero',
    label: 'Split Stage',
    hint: 'Escenario dividido con tarjetas hero',
  },
  {
    id: 'full-cinematic',
    theme: 'hamburguesa',
    label: 'Full Cinematic',
    hint: 'Inmersivo: logo + menú hamburguesa',
  },
]);

/**
 * @param {unknown} value
 * @returns {'bento-spatial' | 'hero-editorial' | 'split-stage' | 'full-cinematic'}
 */
export function normalizeHomeLayout(value) {
  const clean = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_]+/g, '-');
  if (clean === 'bento-spatial' || clean === 'bento' || clean.includes('spatial')) {
    return 'bento-spatial';
  }
  if (
    clean === 'hero-editorial' ||
    clean === 'editorial' ||
    clean.includes('editorial')
  ) {
    return 'hero-editorial';
  }
  if (
    clean === 'split-stage' ||
    clean === 'hero' ||
    clean.includes('split') ||
    clean.includes('stage')
  ) {
    return 'split-stage';
  }
  if (
    clean === 'full-cinematic' ||
    clean === 'hamburguesa' ||
    clean === 'minimal' ||
    clean.includes('cinematic') ||
    clean.includes('hamburguesa')
  ) {
    return 'full-cinematic';
  }
  return 'bento-spatial';
}

/**
 * @param {unknown} layoutOrTheme
 * @returns {'editorial' | 'bento' | 'hamburguesa' | 'hero' | 'minimal'}
 */
export function homeLayoutToTheme(layoutOrTheme) {
  const layout = normalizeHomeLayout(layoutOrTheme);
  const hit = HOME_LAYOUT_OPTIONS.find((opt) => opt.id === layout);
  return /** @type {'editorial' | 'bento' | 'hamburguesa' | 'hero' | 'minimal'} */ (
    hit?.theme || normalizeTheme(layoutOrTheme)
  );
}

/**
 * @param {unknown} theme
 * @returns {'bento-spatial' | 'hero-editorial' | 'split-stage' | 'full-cinematic'}
 */
export function homeThemeToLayout(theme) {
  const t = normalizeTheme(theme);
  if (t === 'editorial') return 'hero-editorial';
  if (t === 'hero') return 'split-stage';
  if (t === 'hamburguesa' || t === 'minimal') return 'full-cinematic';
  return 'bento-spatial';
}

/**
 * Plantilla Home + navegación (estilo nav unificado en plantilla/layout).
 * @param {unknown} homeThemeRaw
 * @param {unknown} estiloNavRaw
 * @returns {{
 *   homeTheme: 'editorial' | 'bento' | 'hamburguesa' | 'hero' | 'minimal',
 *   layout: 'bento-spatial' | 'hero-editorial' | 'split-stage' | 'full-cinematic',
 *   estiloNavegacion: 'frontal' | 'hamburguesa' | 'app_tabs',
 * }}
 */
export function resolveHomeThemeAndNav(homeThemeRaw, estiloNavRaw) {
  let homeTheme = homeLayoutToTheme(homeThemeRaw);
  const navLegacy = String(estiloNavRaw || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (homeTheme !== 'hamburguesa' && (navLegacy === 'hamburguesa' || navLegacy === 'oculto')) {
    homeTheme = 'hamburguesa';
  }

  const estiloNavegacion =
    homeTheme === 'hamburguesa'
      ? 'hamburguesa'
      : navLegacy === 'app_tabs' || navLegacy === 'tabs'
        ? 'app_tabs'
        : 'frontal';

  return {
    homeTheme,
    layout: homeThemeToLayout(homeTheme),
    estiloNavegacion,
  };
}

/**
 * @param {unknown} value
 * @returns {'editorial' | 'cinematic' | 'capsule' | 'split' | 'bento' | 'timeline'}
 */
export function normalizeNosotrosTheme(value) {
  const key = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ');

  if (!key) return DEFAULT_NOSOTROS_THEME;

  if (
    key === 'timeline' ||
    key.includes('linea de tiempo') ||
    key.includes('línea de tiempo') ||
    key.includes('cronolog') ||
    key.includes('hitos')
  ) {
    return 'timeline';
  }
  if (
    key === 'split' ||
    key === 'split story' ||
    key.includes('split_story') ||
    key.includes('split-story') ||
    key.includes('split screen')
  ) {
    return 'split';
  }
  if (
    key === 'bento' ||
    key === 'bento story' ||
    key.includes('bento_story') ||
    key.includes('bento-story') ||
    key.includes('bento narrativo')
  ) {
    return 'bento';
  }
  if (
    key.includes('cinematic') ||
    key.includes('cinemat') ||
    key.includes('hero') ||
    key.includes('palmer')
  ) {
    return 'cinematic';
  }
  if (
    key.includes('capsule') ||
    key.includes('capsul') ||
    key.includes('album') ||
    key.includes('scrapbook') ||
    key.includes('polaroid')
  ) {
    return 'capsule';
  }
  if (key.includes('divid') || key.includes('split')) {
    return 'split';
  }
  if (key.includes('grid') || key.includes('bento')) {
    return 'bento';
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

/** Layouts del Studio Nosotros (UI) → theme canónico. */
export const NOSOTROS_LAYOUT_OPTIONS = Object.freeze([
  {
    id: 'editorial',
    theme: 'editorial',
    label: 'Editorial Clásico',
    hint: 'Texto amplio, narrativa sobria',
  },
  {
    id: 'split_story',
    theme: 'split',
    label: 'Split Screen',
    hint: 'Foto grande a un lado + historia al otro',
  },
  {
    id: 'timeline',
    theme: 'timeline',
    label: 'Línea de Tiempo',
    hint: 'Hitos cronológicos del restaurante',
  },
  {
    id: 'bento_story',
    theme: 'bento',
    label: 'Bento Narrativo',
    hint: 'Mosaico con fotos del chef/espacio y citas',
  },
]);

/**
 * @param {unknown} value
 * @returns {'editorial' | 'split_story' | 'timeline' | 'bento_story'}
 */
export function normalizeNosotrosLayout(value) {
  const clean = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s]+/g, '_')
    .replace(/-/g, '_');

  if (clean === 'editorial' || clean.includes('editorial') || clean.includes('clasico') || clean.includes('clásico')) {
    return 'editorial';
  }
  if (
    clean === 'split_story' ||
    clean === 'split' ||
    clean === 'cinematic' ||
    clean.includes('split') ||
    clean.includes('cinematic')
  ) {
    return 'split_story';
  }
  if (clean === 'timeline' || clean.includes('timeline') || clean.includes('tiempo') || clean.includes('hitos')) {
    return 'timeline';
  }
  if (
    clean === 'bento_story' ||
    clean === 'bento' ||
    clean === 'capsule' ||
    clean.includes('bento') ||
    clean.includes('capsule') ||
    clean.includes('mosaico')
  ) {
    return 'bento_story';
  }
  return 'editorial';
}

/**
 * @param {unknown} layoutOrTheme
 * @returns {'editorial' | 'cinematic' | 'capsule' | 'split' | 'bento' | 'timeline'}
 */
export function nosotrosLayoutToTheme(layoutOrTheme) {
  const layout = normalizeNosotrosLayout(layoutOrTheme);
  const hit = NOSOTROS_LAYOUT_OPTIONS.find((opt) => opt.id === layout);
  return /** @type {'editorial' | 'cinematic' | 'capsule' | 'split' | 'bento' | 'timeline'} */ (
    hit?.theme || normalizeNosotrosTheme(layoutOrTheme)
  );
}

/**
 * @param {unknown} theme
 * @returns {'editorial' | 'split_story' | 'timeline' | 'bento_story'}
 */
export function nosotrosThemeToLayout(theme) {
  const t = normalizeNosotrosTheme(theme);
  if (t === 'split' || t === 'cinematic') return 'split_story';
  if (t === 'bento' || t === 'capsule') return 'bento_story';
  if (t === 'timeline') return 'timeline';
  return 'editorial';
}

/** Layouts del Studio Horarios & Ubicación (UI) → theme canónico. */
export const UBICACION_LAYOUT_OPTIONS = Object.freeze([
  {
    id: 'modal_drawer',
    theme: 'modal',
    label: 'Modal / Drawer Subterráneo',
    hint: 'Cajón inferior deslizable',
  },
  {
    id: 'split_map',
    theme: 'split',
    label: 'Split Screen (Mapa + Info)',
    hint: 'Mitad mapa interactivo, mitad datos',
  },
  {
    id: 'bento_info',
    theme: 'bento',
    label: 'Bento Grid Ubicación',
    hint: 'Tarjetas modulares de mapa, horario y contacto',
  },
  {
    id: 'minimal_clean',
    theme: 'minimal',
    label: 'Lista Minimalista',
    hint: 'Vista editorial limpia y tipográfica',
  },
]);

/**
 * @param {unknown} value
 * @returns {'modal_drawer' | 'split_map' | 'bento_info' | 'minimal_clean'}
 */
export function normalizeUbicacionLayout(value) {
  const clean = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s]+/g, '_')
    .replace(/-/g, '_');

  if (
    clean === 'modal_drawer' ||
    clean === 'modal' ||
    clean.includes('drawer') ||
    clean.includes('modal')
  ) {
    return 'modal_drawer';
  }
  if (
    clean === 'split_map' ||
    clean === 'split' ||
    clean.includes('split')
  ) {
    return 'split_map';
  }
  if (
    clean === 'bento_info' ||
    clean === 'bento' ||
    clean.includes('bento')
  ) {
    return 'bento_info';
  }
  if (
    clean === 'minimal_clean' ||
    clean === 'minimal' ||
    clean.includes('minimal') ||
    clean.includes('editorial') ||
    clean.includes('lista')
  ) {
    return 'minimal_clean';
  }
  return 'modal_drawer';
}

/**
 * @param {unknown} layoutOrTheme
 * @returns {'modal' | 'split' | 'minimal' | 'bento'}
 */
export function ubicacionLayoutToTheme(layoutOrTheme) {
  const layout = normalizeUbicacionLayout(layoutOrTheme);
  const hit = UBICACION_LAYOUT_OPTIONS.find((opt) => opt.id === layout);
  return /** @type {'modal' | 'split' | 'minimal' | 'bento'} */ (
    hit?.theme || normalizeUbicacionTheme(layoutOrTheme)
  );
}

/**
 * @param {unknown} theme
 * @returns {'modal_drawer' | 'split_map' | 'bento_info' | 'minimal_clean'}
 */
export function ubicacionThemeToLayout(theme) {
  const t = normalizeUbicacionTheme(theme);
  if (t === 'split') return 'split_map';
  if (t === 'bento') return 'bento_info';
  if (t === 'minimal') return 'minimal_clean';
  return 'modal_drawer';
}

/**
 * @param {unknown} value
 * @returns {'modal' | 'split' | 'minimal' | 'bento'}
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
    key === 'bento' ||
    key.includes('bento') ||
    slug === 'bento' ||
    slug === 'bento-info' ||
    slug === 'bentoinfo'
  ) {
    return 'bento';
  }

  if (
    key === 'minimal' ||
    key.includes('minimal') ||
    key.includes('editorial') ||
    slug === 'minimal' ||
    slug === 'minimal-editorial' ||
    slug === 'minimal-clean'
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
    slug === 'drawer' ||
    slug === 'modal-drawer'
  ) {
    return 'modal';
  }

  return DEFAULT_UBICACION_THEME;
}

/** Layouts del Studio Pedir / Reservas. */
export const RESERVAS_LAYOUT_OPTIONS = Object.freeze([
  {
    id: 'whatsapp_concierge',
    destino: 'whatsapp',
    label: 'WhatsApp Asistido',
    hint: 'Mensaje estructurado con fecha y personas',
  },
  {
    id: 'native_modal',
    destino: 'nativo',
    label: 'Formulario Nativo',
    hint: 'Modal de solicitud de mesa dentro de la webapp',
  },
  {
    id: 'external_engine',
    destino: 'enlace',
    label: 'Plataforma Externa',
    hint: 'CoverManager, OpenTable, TheFork o URL',
  },
  {
    id: 'direct_call',
    destino: 'telefono',
    label: 'Llamada Directa',
    hint: 'Click-to-call telefónico',
  },
]);

/**
 * @param {unknown} value
 * @returns {'whatsapp_concierge' | 'native_modal' | 'external_engine' | 'direct_call'}
 */
export function normalizeReservasLayout(value) {
  const clean = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  if (
    clean === 'whatsapp_concierge' ||
    clean === 'whatsapp' ||
    clean === 'wa' ||
    clean.includes('whatsapp') ||
    clean.includes('concierge')
  ) {
    return 'whatsapp_concierge';
  }
  if (
    clean === 'native_modal' ||
    clean === 'nativo' ||
    clean === 'native' ||
    clean.includes('modal') ||
    clean.includes('formulario')
  ) {
    return 'native_modal';
  }
  if (
    clean === 'direct_call' ||
    clean === 'telefono' ||
    clean === 'tel' ||
    clean === 'call' ||
    clean.includes('llamada') ||
    clean.includes('call')
  ) {
    return 'direct_call';
  }
  if (
    clean === 'external_engine' ||
    clean === 'enlace' ||
    clean === 'external' ||
    clean.includes('opentable') ||
    clean.includes('cover') ||
    clean.includes('thefork') ||
    clean.includes('extern')
  ) {
    return 'external_engine';
  }
  return 'whatsapp_concierge';
}

/**
 * @param {unknown} layoutOrDestino
 * @returns {'whatsapp' | 'enlace' | 'telefono' | 'nativo'}
 */
export function reservasLayoutToDestino(layoutOrDestino) {
  const layout = normalizeReservasLayout(layoutOrDestino);
  const hit = RESERVAS_LAYOUT_OPTIONS.find((opt) => opt.id === layout);
  return /** @type {'whatsapp' | 'enlace' | 'telefono' | 'nativo'} */ (
    hit?.destino || 'whatsapp'
  );
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
