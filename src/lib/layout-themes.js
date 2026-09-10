/**
 * Plantillas de estructura (Layout Themes) para Home, Nosotros y Ubicación.
 */

/** 4 temas canónicos del Home (2026-09-09). */
export const HOME_THEME_IDS = /** @type {const} */ ([
  'editorial', // Grand Editorial
  'sheet',     // Bottom Glass Sheet
  'split',     // Split Architecture
  'cards',     // Showcase Cards
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
export const DEFAULT_HOME_THEME = 'editorial';
export const DEFAULT_NOSOTROS_THEME = 'editorial';
export const DEFAULT_UBICACION_THEME = 'modal';

/**
 * Normaliza home_theme DB/Admin → 4 IDs canónicos.
 * Aliases: cinematic/minimal → sheet · bento/hero → cards · split-stage → split.
 * @param {unknown} theme
 * @returns {'editorial' | 'sheet' | 'split' | 'cards'}
 */
export function normalizeTheme(theme) {
  const clean = String(theme || '').toLowerCase().trim();

  if (
    clean === 'sheet' ||
    clean === 'bottom-glass-sheet' ||
    clean === 'cinematic' ||
    clean === 'hamburguesa' ||
    clean === 'minimal' ||
    clean === 'bottom-showcase' ||
    clean === 'full-cinematic' ||
    clean.includes('sheet') ||
    clean.includes('cinematic') ||
    clean.includes('hamburguesa') ||
    clean.includes('burger') ||
    clean.includes('alchemist') ||
    clean.includes('minimal') ||
    (clean.includes('bottom') && !clean.includes('bento'))
  ) {
    return 'sheet';
  }

  if (
    clean === 'editorial' ||
    clean === 'grand-editorial' ||
    clean.includes('editorial') ||
    clean.includes('boutique')
  ) {
    return 'editorial';
  }

  if (
    clean === 'split' ||
    clean === 'split-architecture' ||
    clean === 'split-stage' ||
    clean.includes('split-architecture') ||
    (clean.includes('split') && !clean.includes('bento'))
  ) {
    return 'split';
  }

  if (
    clean === 'cards' ||
    clean === 'showcase-cards' ||
    clean === 'bento' ||
    clean === 'bento-spatial' ||
    clean === 'hero' ||
    clean.includes('cards') ||
    clean.includes('showcase') ||
    clean.includes('bento') ||
    clean.includes('spatial') ||
    clean.includes('hero')
  ) {
    return 'cards';
  }

  return 'editorial';
}

/** @param {unknown} raw */
export function sanitizeTheme(raw) {
  return normalizeTheme(raw);
}

/** Alias Admin / API */
export function normalizeHomeTheme(value) {
  return normalizeTheme(value);
}

export const HOME_THEME_MAP = Object.freeze({
  editorial: 'editorial',
  sheet: 'sheet',
  split: 'split',
  cards: 'cards',
  cinematic: 'sheet',
  hamburguesa: 'sheet',
  minimal: 'sheet',
  bento: 'cards',
  hero: 'cards',
});

/** Layouts del Studio Home/Core (UI) → theme canónico. */
export const HOME_LAYOUT_OPTIONS = Object.freeze([
  {
    id: 'grand-editorial',
    theme: 'editorial',
    label: 'Grand Editorial',
    hint: 'Tipografía pura Michelin / Monocle',
    navBadge: '≡ Índice',
  },
  {
    id: 'bottom-glass-sheet',
    theme: 'sheet',
    label: 'Bottom Glass Sheet',
    hint: 'Atmósfera libre + bandeja de cristal inferior',
    navBadge: '↓ Sheet',
  },
  {
    id: 'split-architecture',
    theme: 'split',
    label: 'Split Architecture',
    hint: 'Identidad arriba + bloques de impacto abajo',
    navBadge: '⇅ Split',
  },
  {
    id: 'showcase-cards',
    theme: 'cards',
    label: 'Showcase Cards',
    hint: 'Bento gastronómico con cards de cristal',
    navBadge: '⊞ Cards',
  },
]);

/**
 * @param {unknown} value
 * @returns {'grand-editorial' | 'bottom-glass-sheet' | 'split-architecture' | 'showcase-cards'}
 */
export function normalizeHomeLayout(value) {
  const clean = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-');

  if (clean === 'grand-editorial' || clean === 'hero-editorial' || clean.includes('editorial')) {
    return 'grand-editorial';
  }
  if (
    clean === 'bottom-glass-sheet' ||
    clean === 'sheet' ||
    clean === 'full-cinematic' ||
    clean === 'bottom-showcase' ||
    clean === 'hamburguesa' ||
    clean === 'cinematic' ||
    clean === 'minimal' ||
    clean.includes('sheet') ||
    clean.includes('cinematic') ||
    clean.includes('minimal') ||
    (clean.includes('showcase') && !clean.includes('cards'))
  ) {
    return 'bottom-glass-sheet';
  }
  if (
    clean === 'split-architecture' ||
    clean === 'split' ||
    clean === 'split-stage' ||
    clean.includes('split')
  ) {
    return 'split-architecture';
  }
  if (
    clean === 'showcase-cards' ||
    clean === 'cards' ||
    clean === 'bento-spatial' ||
    clean === 'bento' ||
    clean === 'hero' ||
    clean.includes('cards') ||
    clean.includes('bento') ||
    clean.includes('spatial')
  ) {
    return 'showcase-cards';
  }
  return 'grand-editorial';
}

/**
 * @param {unknown} layoutOrTheme
 * @returns {'editorial' | 'sheet' | 'split' | 'cards'}
 */
export function homeLayoutToTheme(layoutOrTheme) {
  const layout = normalizeHomeLayout(layoutOrTheme);
  if (layout === 'grand-editorial') return 'editorial';
  if (layout === 'bottom-glass-sheet') return 'sheet';
  if (layout === 'split-architecture') return 'split';
  if (layout === 'showcase-cards') return 'cards';
  return /** @type {'editorial' | 'sheet' | 'split' | 'cards'} */ (normalizeTheme(layoutOrTheme));
}

/**
 * @param {unknown} theme
 * @returns {'grand-editorial' | 'bottom-glass-sheet' | 'split-architecture' | 'showcase-cards'}
 */
export function homeThemeToLayout(theme) {
  const t = normalizeTheme(theme);
  if (t === 'sheet') return 'bottom-glass-sheet';
  if (t === 'split') return 'split-architecture';
  if (t === 'cards') return 'showcase-cards';
  return 'grand-editorial';
}

/**
 * Plantilla Home + navegación (desacoplados).
 * @param {unknown} homeThemeRaw
 * @param {unknown} estiloNavRaw
 * @returns {{
 *   homeTheme: 'editorial' | 'sheet' | 'split' | 'cards',
 *   layout: 'grand-editorial' | 'bottom-glass-sheet' | 'split-architecture' | 'showcase-cards',
 *   estiloNavegacion: 'frontal' | 'hamburguesa' | 'app_tabs',
 * }}
 */
export function resolveHomeThemeAndNav(homeThemeRaw, estiloNavRaw) {
  const homeTheme = homeLayoutToTheme(homeThemeRaw);

  const navLegacy = String(estiloNavRaw || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const estiloNavegacion =
    navLegacy === 'hamburguesa' || navLegacy === 'oculto'
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
