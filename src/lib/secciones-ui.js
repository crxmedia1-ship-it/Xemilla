/**
 * Fondos y UI atómica por sección (Lego).
 * Persistido en restaurantes.secciones_fondo (JSONB).
 */

const FONDO_TIPOS = new Set(['color', 'image', 'carrusel', 'video']);

/**
 * Parsea URLs de fondo (imagen fija o carrusel).
 * Acepta separación por coma, punto y coma o saltos de línea.
 * @param {unknown} value
 * @returns {string[]}
 */
export function parseFondoMediaUrls(value) {
  const raw = String(value || '').trim();
  if (!raw) return [];
  return raw
    .split(/[\n,;]+/)
    .map((u) => u.trim())
    .filter((u) => u.length > 0 && !u.startsWith('#'));
}

/**
 * @param {unknown} value
 * @returns {Record<string, { tipo: string, valor: string }>}
 */
export function parseSeccionesFondo(value) {
  let raw = value;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = {};
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) raw = {};

  /** @type {Record<string, { tipo: string, valor: string }>} */
  const out = {};
  for (const key of ['home', 'nosotros', 'menu', 'ubicacion']) {
    const entry = /** @type {Record<string, unknown>} */ (raw)[key];
    out[key] = normalizeFondoEntry(entry);
  }
  return out;
}

/**
 * @param {unknown} entry
 * @returns {{ tipo: string, valor: string }}
 */
export function normalizeFondoEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return { tipo: 'color', valor: '' };
  }
  const e = /** @type {Record<string, unknown>} */ (entry);
  let tipoRaw = String(e.tipo ?? e.type ?? 'color')
    .trim()
    .toLowerCase();
  // Aliases
  if (tipoRaw === 'carousel' || tipoRaw === 'slideshow' || tipoRaw === 'rotacion') {
    tipoRaw = 'carrusel';
  }
  if (tipoRaw === 'img' || tipoRaw === 'foto') tipoRaw = 'image';
  const tipo = FONDO_TIPOS.has(tipoRaw) ? tipoRaw : 'color';
  const valor = String(e.valor ?? e.value ?? e.url ?? '').trim();
  return { tipo, valor };
}

/**
 * Construye el objeto secciones_fondo desde el body del dashboard.
 * @param {Record<string, unknown>} raw
 */
export function buildSeccionesFondoFromBody(raw) {
  /** @type {Record<string, { tipo: string, valor: string }>} */
  const result = {};
  for (const key of ['home', 'nosotros', 'menu', 'ubicacion']) {
    const tipo =
      raw[`fondo_${key}_tipo`] ??
      (key === 'home' ? raw.fondo_tipo : undefined);
    const valor =
      raw[`fondo_${key}_valor`] ??
      (key === 'home' ? raw.fondo_valor : undefined);
    result[key] = normalizeFondoEntry({ tipo, valor });
  }
  return result;
}

/**
 * Resuelve fondo efectivo (nuevo JSON → legacy imagen_fondo / color_fondo).
 * @param {Record<string, { tipo: string, valor: string }>} secciones
 * @param {string} key
 * @param {{ tipo?: string, valor?: string }} [legacy]
 */
export function resolveSectionFondo(secciones, key, legacy = {}) {
  const entry = secciones?.[key] || { tipo: 'color', valor: '' };
  let tipo = entry.tipo || 'color';
  let valor = entry.valor || '';

  if (!valor && key === 'home') {
    if (legacy.valor && (legacy.tipo === 'image' || /^https?:\/\//i.test(legacy.valor))) {
      tipo = 'image';
      valor = legacy.valor;
    } else if (legacy.valor) {
      tipo = 'color';
      valor = legacy.valor;
    }
  }

  if (!FONDO_TIPOS.has(tipo)) tipo = 'color';
  return { tipo, valor };
}

/**
 * @param {unknown} config
 */
export function parseReservasConfig(config) {
  let raw = config;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = {};
    }
  }
  if (!raw || typeof raw !== 'object') raw = {};
  const c = /** @type {Record<string, unknown>} */ (raw);

  const destinoTipo = String(c.destino_tipo || c.tipo || '')
    .trim()
    .toLowerCase();
  const tipo =
    destinoTipo === 'whatsapp' || destinoTipo === 'wa'
      ? 'whatsapp'
      : 'enlace';

  const destinoValor = String(
    c.destino_valor || c.url || c.href || c.telefono || c.whatsapp || '',
  ).trim();
  const label = String(c.label || c.boton_texto || c.titulo || 'PEDIR / RESERVAR').trim();

  let href = '';
  if (destinoValor) {
    if (tipo === 'whatsapp') {
      if (/^https?:\/\//i.test(destinoValor)) {
        href = destinoValor;
      } else {
        const digits = destinoValor.replace(/\D/g, '');
        href = digits ? `https://wa.me/${digits}` : '';
      }
    } else {
      href = /^https?:\/\//i.test(destinoValor)
        ? destinoValor
        : `https://${destinoValor.replace(/^\/+/, '')}`;
    }
  }

  return {
    label: label || 'PEDIR / RESERVAR',
    destinoTipo: tipo,
    destinoValor,
    url: href,
    href,
  };
}

const REDES_ALLOWED = new Set(['instagram', 'facebook', 'tiktok', 'tripadvisor']);

/**
 * @param {unknown} value
 * @returns {Array<{ red: string, url: string, activo: boolean }>}
 */
export function parseRedesSociales(value) {
  let raw = value;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = [];
    }
  }
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const red = String(item.red || item.network || item.tipo || '')
        .trim()
        .toLowerCase();
      const url = String(item.url || item.href || '').trim();
      if (!REDES_ALLOWED.has(red) || !url) return null;
      const flag = item.activo ?? item.active ?? item.enabled ?? item.on;
      const activo =
        flag === undefined ? true : flag !== false && flag !== 'false' && flag !== 0;
      return { red, url: normalizeSocialUrl(red, url), activo };
    })
    .filter(Boolean);
}

/**
 * @param {string} red
 * @param {string} url
 */
function normalizeSocialUrl(red, url) {
  if (/^https?:\/\//i.test(url)) return url;
  const handle = url.replace(/^@/, '');
  if (red === 'instagram') return `https://instagram.com/${handle}`;
  if (red === 'facebook') return `https://facebook.com/${handle}`;
  if (red === 'tiktok') return `https://www.tiktok.com/@${handle}`;
  if (red === 'tripadvisor') return `https://www.tripadvisor.com/${handle}`;
  return url;
}

/**
 * Body dashboard → redes_sociales JSONB.
 * Acepta array o campos planos redes_instagram, etc.
 * @param {Record<string, unknown>} raw
 */
export function buildRedesSocialesFromBody(raw) {
  if (Array.isArray(raw.redes_sociales)) {
    return parseRedesSociales(raw.redes_sociales);
  }
  if (typeof raw.redes_sociales === 'string') {
    return parseRedesSociales(raw.redes_sociales);
  }

  /** @type {Array<{ red: string, url: string, activo: boolean }>} */
  const list = [];
  for (const red of REDES_ALLOWED) {
    const url = String(raw[`redes_${red}`] ?? '').trim();
    if (!url) continue;
    const flag = raw[`redes_${red}_activo`];
    const activo =
      flag === undefined ? true : flag !== false && flag !== 'false' && flag !== 0;
    list.push({ red, url: normalizeSocialUrl(red, url), activo });
  }
  return list;
}

/**
 * @param {unknown} value
 * @returns {Array<{ titulo: string, texto: string, media_url: string, alineacion: string }>}
 */
export function parseNosotrosBloques(value) {
  let raw = value;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = [];
    }
  }
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const titulo = String(item.titulo || item.title || '').trim();
      const texto = String(item.texto || item.contenido || item.body || '').trim();
      const media_url = String(
        item.media_url || item.imagen || item.media || item.url || '',
      ).trim();
      const alineacionRaw = String(item.alineacion || item.alignment || 'alternada')
        .trim()
        .toLowerCase();
      const alineacion =
        alineacionRaw === 'inversa' || alineacionRaw === 'inverse'
          ? 'inversa'
          : 'alternada';
      if (!titulo && !texto && !media_url) return null;
      return { titulo, texto, media_url, alineacion };
    })
    .filter(Boolean);
}

/**
 * @param {Record<string, unknown>} raw
 */
export function buildNosotrosBloquesFromBody(raw) {
  if (Array.isArray(raw.nosotros_bloques)) {
    return parseNosotrosBloques(raw.nosotros_bloques);
  }
  if (typeof raw.nosotros_bloques === 'string') {
    return parseNosotrosBloques(raw.nosotros_bloques);
  }
  return [];
}

/** Tokens tipográficos Home + colores por sección (JSONB ui_estilo). */

export const HOME_TRACKINGS = new Set([
  'tracking-normal',
  'tracking-wider',
  'tracking-widest',
  'tracking-[0.3em]',
]);

/** Defaults y rangos en px (Admin + WebApp). */
export const HOME_PX_DEFAULTS = Object.freeze({
  logo: 160,
  titulo: 28,
  eslogan: 14,
  menu: 16,
  logo_x: 0,
  logo_y: 0,
  titulo_x: 0,
  titulo_y: 0,
  eslogan_x: 0,
  /** Separación tipográfica automática título → eslogan */
  eslogan_y: 12,
  menu_x: 0,
  menu_y: 0,
  overlay_opacity: 40,
  overlay_estilo: 'oscuro',
  /** Fondo media: in | out | pan | float | glow | ninguna (default in) */
  fondo_animacion: 'in',
  estilo_navegacion: 'frontal',
  efecto_entrada: 'ninguno',
  titulo_color: '#ffffff',
  eslogan_color: '#e5e7eb',
  menu_color: '#ffffff',
  subtexto_color: '#9f1239',
  borde_destacado_color: '#9f1239',
});

export const HOME_PX_RANGES = Object.freeze({
  logo: { min: 10, max: 400 },
  titulo: { min: 12, max: 72 },
  eslogan: { min: 10, max: 36 },
  menu: { min: 12, max: 36 },
  offset_x: { min: -50, max: 50 },
  offset_y: { min: -100, max: 100 },
  /** Offsets cortos (título / eslogan) */
  offset_sm: { min: -50, max: 50 },
  overlay: { min: 0, max: 90 },
});

/** Canonical: frontal | hamburguesa | app_tabs (legacy fijo→frontal, oculto→hamburguesa). */
export const HOME_NAV_STYLES = Object.freeze(
  new Set(['frontal', 'hamburguesa', 'app_tabs']),
);
export const HOME_OVERLAY_ESTILOS = Object.freeze(
  new Set(['puro', 'gradiente', 'vineta', 'oscuro', 'cinematico']),
);
/** Animación de fondo media (imagen / video / carrusel single). */
export const HOME_FONDO_ANIMACIONES = Object.freeze(
  new Set(['in', 'out', 'pan', 'float', 'glow', 'ninguna']),
);
export const HOME_EFECTOS_ENTRADA = Object.freeze(
  new Set(['rise', 'blur', 'reveal', 'ninguno']),
);

/** Migración legacy escala 1–5 (XS–XL) → px aproximados. */
const LEGACY_LOGO_PX = Object.freeze({ 1: 40, 2: 64, 3: 96, 4: 128, 5: 160 });
const LEGACY_TITULO_PX = Object.freeze({ 1: 14, 2: 16, 3: 20, 4: 30, 5: 48 });
const LEGACY_ESLOGAN_PX = Object.freeze({ 1: 11, 2: 12, 3: 14, 4: 20, 5: 28 });

const TRACKING_CSS = {
  'tracking-normal': '0em',
  'tracking-wider': '0.05em',
  'tracking-widest': '0.1em',
  'tracking-[0.3em]': '0.3em',
};

/**
 * Normaliza un tamaño Home a px (número entero).
 * Acepta: 160, "160", "160px", o legacy escala 1–5.
 *
 * @param {unknown} value
 * @param {{ min: number, max: number, fallback: number, legacyMap?: Record<number, number> }} opts
 * @returns {number}
 */
export function normalizeHomePx(value, opts) {
  const { min, max, fallback, legacyMap } = opts;
  // null / vacío / 0 → fallback elegante (tamaños nunca “colapsan”)
  if (value == null || value === '' || value === 0 || value === '0') return fallback;

  if (typeof value === 'number' && Number.isFinite(value)) {
    const n = Math.round(value);
    if (legacyMap && n >= 1 && n <= 5) return clampPx(legacyMap[n] ?? fallback, min, max);
    return clampPx(n, min, max);
  }

  const raw = String(value).trim().toLowerCase();
  if (!raw) return fallback;

  // "180px" | "180"
  const pxMatch = raw.match(/^(\d+(?:\.\d+)?)\s*px$/i);
  if (pxMatch) {
    return clampPx(Math.round(Number(pxMatch[1])), min, max);
  }

  const asNum = Number(raw);
  if (Number.isFinite(asNum)) {
    const n = Math.round(asNum);
    if (legacyMap && n >= 1 && n <= 5) return clampPx(legacyMap[n] ?? fallback, min, max);
    return clampPx(n, min, max);
  }

  // Legacy labels
  if (legacyMap) {
    if (raw === 'xs' || raw === 'text-sm' || raw === 'text-lg' || raw === 'h-8')
      return clampPx(legacyMap[1], min, max);
    if (raw === 'sm' || raw === 'text-base' || raw === 'text-xl' || raw === 'h-12')
      return clampPx(legacyMap[2], min, max);
    if (raw === 'md' || raw === 'normal' || raw === 'text-2xl' || raw === 'h-16')
      return clampPx(legacyMap[3], min, max);
    if (raw === 'lg' || raw === 'text-3xl' || raw === 'text-4xl' || raw === 'h-24')
      return clampPx(legacyMap[4], min, max);
    if (raw === 'xl' || raw === 'text-5xl' || raw === 'h-32')
      return clampPx(legacyMap[5], min, max);
  }

  return fallback;
}

/**
 * @param {number} n
 * @param {number} min
 * @param {number} max
 */
function clampPx(n, min, max) {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/**
 * Offset firmado en px (posición X/Y del Home).
 * @param {unknown} value
 * @param {{ min: number, max: number, fallback?: number }} opts
 * @returns {number}
 */
export function normalizeHomeOffset(value, opts) {
  const fallback = opts.fallback ?? 0;
  if (value == null || value === '') return fallback;
  const raw = String(value).trim().replace(/px$/i, '');
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return fallback;
  return clampPx(n, opts.min, opts.max);
}

/** @deprecated Prefer normalizeHomePx — alias para no romper imports. */
export function normalizeScale(value, fallback = 3) {
  const n = Number(value);
  if (Number.isFinite(n) && n >= 1 && n <= 5) return Math.round(n);
  return fallback;
}

export function scaleLabel() {
  return 'PX';
}

/**
 * @param {unknown} value
 */
function normalizeHexColor(value, fallback = '') {
  if (value == null) return fallback;
  const v = String(value).trim();
  if (!v) return fallback;
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) return v.toLowerCase();
  return fallback;
}

/**
 * Overlay 0–90 (%) para Admin; default 40.
 * @param {unknown} value
 * @param {number} [fallback=40]
 * @returns {number}
 */
export function normalizeOverlayOpacity(value, fallback = HOME_PX_DEFAULTS.overlay_opacity) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return clampPx(Math.round(n), HOME_PX_RANGES.overlay.min, HOME_PX_RANGES.overlay.max);
}

/**
 * Normaliza estilo_navegacion Home.
 * Legacy DB: `fijo` → `frontal`, `oculto` → `hamburguesa`.
 *
 * @param {unknown} value
 * @returns {'frontal' | 'hamburguesa' | 'app_tabs'}
 */
export function normalizeEstiloNavegacion(value) {
  const v = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
  if (
    v === 'hamburguesa' ||
    v === 'oculto' ||
    v === 'michelin' ||
    v === 'menu_hamburger' ||
    v === 'hamburger' ||
    v === 'alchemist'
  ) {
    return 'hamburguesa';
  }
  if (
    v === 'app_tabs' ||
    v === 'apptabs' ||
    v === 'tabs' ||
    v === 'nativa' ||
    v === 'app_nativa'
  ) {
    return 'app_tabs';
  }
  // frontal | fijo | linktree | default
  return 'frontal';
}

/**
 * @param {unknown} value
 * @returns {'puro' | 'gradiente' | 'vineta' | 'oscuro' | 'cinematico'}
 */
export function normalizeOverlayEstilo(value) {
  const v = String(value || '')
    .trim()
    .toLowerCase();
  if (v === 'puro' || v === 'pure' || v === 'text-shadow') return 'puro';
  if (v === 'gradiente' || v === 'gradient') return 'gradiente';
  if (v === 'vineta' || v === 'vignette' || v === 'viñeta') return 'vineta';
  if (
    v === 'cinematico' ||
    v === 'cinematic' ||
    v === 'grain' ||
    v === 'film_grain' ||
    v === 'film-grain' ||
    v === 'oscuro_grain'
  ) {
    return 'cinematico';
  }
  if (v === 'oscuro' || v === 'dark' || v === 'filtro' || v === 'regulable') return 'oscuro';
  return HOME_PX_DEFAULTS.overlay_estilo;
}

/**
 * Animación de fondo (imagen / video).
 * Default `in` = Zoom Cinemático In (scale 1→1.18).
 * @param {unknown} value
 * @returns {'in' | 'out' | 'pan' | 'float' | 'glow' | 'ninguna'}
 */
export function normalizeFondoAnimacion(value) {
  const v = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
  if (
    v === 'ninguna' ||
    v === 'none' ||
    v === 'off' ||
    v === '0' ||
    v === 'false' ||
    v === 'fijo'
  ) {
    return 'ninguna';
  }
  if (
    v === 'out' ||
    v === 'ken_burns_out' ||
    v === 'zoom_out' ||
    v === 'animate_ken_burns_out'
  ) {
    return 'out';
  }
  if (
    v === 'pan' ||
    v === 'pan_horizontal' ||
    v === 'horizontal' ||
    v === 'animate_pan_horizontal'
  ) {
    return 'pan';
  }
  if (
    v === 'float' ||
    v === 'float_vertical' ||
    v === 'vertical' ||
    v === 'animate_float_vertical'
  ) {
    return 'float';
  }
  if (
    v === 'glow' ||
    v === 'pulse' ||
    v === 'pulse_glow' ||
    v === 'animate_pulse_glow'
  ) {
    return 'glow';
  }
  // in | ken_burns | zoom_in | vacío / unset → in (compat)
  return 'in';
}

/** Mapa canónico valor → clase Tailwind de atmósfera */
export const FONDO_ANIMACION_CLASS = {
  in: 'animate-ken-burns',
  out: 'animate-ken-burns-out',
  pan: 'animate-pan-horizontal',
  float: 'animate-float-vertical',
  glow: 'animate-pulse-glow',
  ninguna: '',
};

/**
 * Clase Tailwind de animación de fondo, o '' si ninguna.
 * @param {unknown} value
 * @returns {string}
 */
export function fondoAnimacionClass(value) {
  const v = normalizeFondoAnimacion(value);
  return FONDO_ANIMACION_CLASS[v] || '';
}

/**
 * @param {unknown} value
 * @returns {'reveal' | 'rise' | 'blur' | 'zoom' | 'tracking' | 'ninguno'}
 */
export function normalizeEfectoEntrada(value) {
  const v = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-');
  if (v === 'rise' || v === 'fadeup' || v === 'rise-up' || v === 'cinematic') {
    return 'rise';
  }
  if (v === 'blur' || v === 'blur-fade' || v === 'blur-in') return 'blur';
  if (v === 'reveal' || v === 'text-reveal' || v === 'mascara') return 'reveal';
  if (v === 'zoom' || v === 'zoom-in' || v === 'scale') return 'zoom';
  if (v === 'tracking' || v === 'letter-spacing' || v === 'tracking-expansion') {
    return 'tracking';
  }
  return 'ninguno';
}

/**
 * CSS avanzado del restaurante (alias canónico de custom_css).
 * Bloquea cierre de style/script; no valida selectores.
 * @param {unknown} value
 * @returns {string}
 */
export function sanitizeCssAvanzado(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<\/style/gi, '/* blocked */')
    .replace(/<script/gi, '/* blocked */')
    .trim();
}

/**
 * Envuelve CSS bajo `.restaurant-app` si aún no está scoped.
 * @param {unknown} value
 * @returns {string}
 */
export function scopeCssAvanzado(value) {
  const css = sanitizeCssAvanzado(value);
  if (!css) return '';
  if (/\.restaurant-app\b/.test(css)) {
    return `/* CSS Avanzado — scope: .restaurant-app */\n${css}`;
  }
  return `/* CSS Avanzado — scope: .restaurant-app */\n.restaurant-app {\n${css}\n}`;
}

/**
 * @param {unknown} value
 * @param {boolean} fallback
 */
function parseBoolish(value, fallback = false) {
  if (value === true || value === 1 || value === '1' || value === 'true' || value === 'on') {
    return true;
  }
  if (value === false || value === 0 || value === '0' || value === 'false' || value === 'off') {
    return false;
  }
  return fallback;
}

/**
 * @param {unknown} value
 */
export function parseUiEstilo(value) {
  let raw = value;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = {};
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) raw = {};

  const home = /** @type {Record<string, unknown>} */ (raw.home || {});
  const nosotros = /** @type {Record<string, unknown>} */ (raw.nosotros || {});
  const ubicacion = /** @type {Record<string, unknown>} */ (raw.ubicacion || {});

  const tracking = String(home.tracking || home.letter_spacing || 'tracking-[0.3em]').trim();

  return {
    home: {
      titulo_size: normalizeHomePx(home.titulo_size ?? home.tituloSize ?? home.titulo_scale, {
        ...HOME_PX_RANGES.titulo,
        fallback: HOME_PX_DEFAULTS.titulo,
        legacyMap: LEGACY_TITULO_PX,
      }),
      logo_size: normalizeHomePx(home.logo_size ?? home.logoSize ?? home.logo_scale, {
        ...HOME_PX_RANGES.logo,
        fallback: HOME_PX_DEFAULTS.logo,
        legacyMap: LEGACY_LOGO_PX,
      }),
      eslogan_size: normalizeHomePx(home.eslogan_size ?? home.esloganSize ?? home.eslogan_scale, {
        ...HOME_PX_RANGES.eslogan,
        fallback: HOME_PX_DEFAULTS.eslogan,
        legacyMap: LEGACY_ESLOGAN_PX,
      }),
      menu_size: normalizeHomePx(home.menu_size ?? home.menuSize ?? home.boton_size, {
        ...HOME_PX_RANGES.menu,
        fallback: HOME_PX_DEFAULTS.menu,
      }),
      logo_x: normalizeHomeOffset(
        home.logo_x ?? home.logoX ?? home.posicion_x ?? home.posicionX,
        { ...HOME_PX_RANGES.offset_x, fallback: HOME_PX_DEFAULTS.logo_x },
      ),
      logo_y: normalizeHomeOffset(
        home.logo_y ?? home.logoY ?? home.posicion_y ?? home.posicionY,
        { ...HOME_PX_RANGES.offset_y, fallback: HOME_PX_DEFAULTS.logo_y },
      ),
      titulo_x: normalizeHomeOffset(home.titulo_x ?? home.tituloX, {
        ...HOME_PX_RANGES.offset_x,
        fallback: HOME_PX_DEFAULTS.titulo_x,
      }),
      titulo_y: normalizeHomeOffset(home.titulo_y ?? home.tituloY, {
        ...HOME_PX_RANGES.offset_sm,
        fallback: HOME_PX_DEFAULTS.titulo_y,
      }),
      eslogan_x: normalizeHomeOffset(home.eslogan_x ?? home.esloganX, {
        ...HOME_PX_RANGES.offset_x,
        fallback: HOME_PX_DEFAULTS.eslogan_x,
      }),
      eslogan_y: normalizeHomeOffset(home.eslogan_y ?? home.esloganY, {
        ...HOME_PX_RANGES.offset_sm,
        fallback: HOME_PX_DEFAULTS.eslogan_y,
      }),
      menu_x: normalizeHomeOffset(home.menu_x ?? home.menuX, {
        ...HOME_PX_RANGES.offset_x,
        fallback: HOME_PX_DEFAULTS.menu_x,
      }),
      menu_y: normalizeHomeOffset(home.menu_y ?? home.menuY, {
        ...HOME_PX_RANGES.offset_y,
        fallback: HOME_PX_DEFAULTS.menu_y,
      }),
      tracking: HOME_TRACKINGS.has(tracking) ? tracking : 'tracking-[0.3em]',
      tagline_superior: String(
        home.tagline_superior ?? home.taglineSuperior ?? '',
      ).trim(),
      subtitulo_color: normalizeHexColor(home.subtitulo_color || home.subtituloColor, ''),
      titulo_color: normalizeHexColor(
        home.titulo_color || home.tituloColor,
        HOME_PX_DEFAULTS.titulo_color,
      ),
      eslogan_color: normalizeHexColor(
        home.eslogan_color || home.esloganColor,
        HOME_PX_DEFAULTS.eslogan_color,
      ),
      menu_color: normalizeHexColor(
        home.menu_color || home.menuColor,
        HOME_PX_DEFAULTS.menu_color,
      ),
      subtexto_color: normalizeHexColor(
        home.subtexto_color || home.subtextoColor,
        HOME_PX_DEFAULTS.subtexto_color,
      ),
      borde_destacado_color: normalizeHexColor(
        home.borde_destacado_color || home.bordeDestacadoColor,
        HOME_PX_DEFAULTS.borde_destacado_color,
      ),
      overlay_opacity: normalizeOverlayOpacity(
        home.overlay_opacity ?? home.overlayOpacity,
        HOME_PX_DEFAULTS.overlay_opacity,
      ),
      overlay_estilo: normalizeOverlayEstilo(
        home.overlay_estilo ?? home.overlayEstilo ?? home.overlay_style,
      ),
      fondo_animacion: normalizeFondoAnimacion(
        home.fondo_animacion ??
          home.fondoAnimacion ??
          home.ken_burns ??
          home.bg_animacion ??
          home.bgAnimacion,
      ),
      estilo_navegacion: normalizeEstiloNavegacion(
        home.estilo_navegacion ?? home.estiloNavegacion ?? home.nav_style,
      ),
      efecto_entrada: normalizeEfectoEntrada(
        home.efecto_entrada ?? home.efectoEntrada ?? home.entrada_animacion,
      ),
    },
    menu: {
      fondos_cinematicos: parseBoolish(
        /** @type {Record<string, unknown>} */ (raw.menu || {}).fondos_cinematicos ??
          /** @type {Record<string, unknown>} */ (raw.menu || {}).fondosCinematicos,
        null,
      ),
      color_texto: normalizeHexColor(
        /** @type {Record<string, unknown>} */ (raw.menu || {}).color_texto ??
          /** @type {Record<string, unknown>} */ (raw.menu || {}).colorTexto,
        '',
      ),
    },
    nosotros: {
      color_fondo: normalizeHexColor(nosotros.color_fondo || nosotros.colorFondo, ''),
      color_titulo: normalizeHexColor(nosotros.color_titulo || nosotros.colorTitulo, ''),
      color_cuerpo: normalizeHexColor(nosotros.color_cuerpo || nosotros.colorCuerpo, ''),
      theme: String(nosotros.theme || '').trim().toLowerCase() || '',
    },
    ubicacion: {
      color_fondo: normalizeHexColor(ubicacion.color_fondo || ubicacion.colorFondo, ''),
      color_titulo: normalizeHexColor(ubicacion.color_titulo || ubicacion.colorTitulo, ''),
      color_cuerpo: normalizeHexColor(ubicacion.color_cuerpo || ubicacion.colorCuerpo, ''),
    },
    /** Canónico; alias histórico: columna restaurantes.custom_css */
    css_avanzado: sanitizeCssAvanzado(
      raw.css_avanzado ?? raw.custom_css ?? home.css_avanzado ?? home.custom_css ?? '',
    ),
  };
}

/**
 * @param {Record<string, unknown>} raw
 */
export function buildUiEstiloFromBody(raw) {
  const tracking = String(raw.home_tracking ?? '').trim();

  return {
    home: {
      /** Short names preferred (`logo_size`); `home_*` kept as API aliases. */
      titulo_size: normalizeHomePx(raw.titulo_size ?? raw.home_titulo_size, {
        ...HOME_PX_RANGES.titulo,
        fallback: HOME_PX_DEFAULTS.titulo,
        legacyMap: LEGACY_TITULO_PX,
      }),
      logo_size: normalizeHomePx(raw.logo_size ?? raw.home_logo_size, {
        ...HOME_PX_RANGES.logo,
        fallback: HOME_PX_DEFAULTS.logo,
        legacyMap: LEGACY_LOGO_PX,
      }),
      eslogan_size: normalizeHomePx(raw.eslogan_size ?? raw.home_eslogan_size, {
        ...HOME_PX_RANGES.eslogan,
        fallback: HOME_PX_DEFAULTS.eslogan,
        legacyMap: LEGACY_ESLOGAN_PX,
      }),
      menu_size: normalizeHomePx(raw.menu_size ?? raw.home_menu_size, {
        ...HOME_PX_RANGES.menu,
        fallback: HOME_PX_DEFAULTS.menu,
      }),
      logo_x: normalizeHomeOffset(raw.logo_x ?? raw.home_logo_x, {
        ...HOME_PX_RANGES.offset_x,
        fallback: HOME_PX_DEFAULTS.logo_x,
      }),
      logo_y: normalizeHomeOffset(raw.logo_y ?? raw.home_logo_y, {
        ...HOME_PX_RANGES.offset_y,
        fallback: HOME_PX_DEFAULTS.logo_y,
      }),
      titulo_x: normalizeHomeOffset(raw.titulo_x ?? raw.home_titulo_x, {
        ...HOME_PX_RANGES.offset_x,
        fallback: HOME_PX_DEFAULTS.titulo_x,
      }),
      titulo_y: normalizeHomeOffset(raw.titulo_y ?? raw.home_titulo_y, {
        ...HOME_PX_RANGES.offset_sm,
        fallback: HOME_PX_DEFAULTS.titulo_y,
      }),
      eslogan_x: normalizeHomeOffset(raw.eslogan_x ?? raw.home_eslogan_x, {
        ...HOME_PX_RANGES.offset_x,
        fallback: HOME_PX_DEFAULTS.eslogan_x,
      }),
      eslogan_y: normalizeHomeOffset(raw.eslogan_y ?? raw.home_eslogan_y, {
        ...HOME_PX_RANGES.offset_sm,
        fallback: HOME_PX_DEFAULTS.eslogan_y,
      }),
      menu_x: normalizeHomeOffset(raw.menu_x ?? raw.home_menu_x, {
        ...HOME_PX_RANGES.offset_x,
        fallback: HOME_PX_DEFAULTS.menu_x,
      }),
      menu_y: normalizeHomeOffset(raw.menu_y ?? raw.home_menu_y, {
        ...HOME_PX_RANGES.offset_y,
        fallback: HOME_PX_DEFAULTS.menu_y,
      }),
      tracking: HOME_TRACKINGS.has(tracking) ? tracking : 'tracking-[0.3em]',
      tagline_superior: String(
        raw.tagline_superior ?? raw.home_tagline_superior ?? '',
      ).trim(),
      subtitulo_color: normalizeHexColor(raw.home_subtitulo_color ?? raw.subtitulo_color, ''),
      titulo_color: normalizeHexColor(
        raw.titulo_color ?? raw.home_titulo_color,
        HOME_PX_DEFAULTS.titulo_color,
      ),
      eslogan_color: normalizeHexColor(
        raw.eslogan_color ?? raw.home_eslogan_color,
        HOME_PX_DEFAULTS.eslogan_color,
      ),
      menu_color: normalizeHexColor(
        raw.menu_color ?? raw.home_menu_color,
        HOME_PX_DEFAULTS.menu_color,
      ),
      subtexto_color: normalizeHexColor(
        raw.subtexto_color ?? raw.home_subtexto_color,
        HOME_PX_DEFAULTS.subtexto_color,
      ),
      borde_destacado_color: normalizeHexColor(
        raw.borde_destacado_color ?? raw.home_borde_destacado_color,
        HOME_PX_DEFAULTS.borde_destacado_color,
      ),
      overlay_opacity: normalizeOverlayOpacity(
        raw.home_overlay_opacity ?? raw.overlay_opacity,
        HOME_PX_DEFAULTS.overlay_opacity,
      ),
      overlay_estilo: normalizeOverlayEstilo(
        raw.home_overlay_estilo ??
          raw.overlay_estilo ??
          raw.overlayEstilo ??
          raw.home_overlayEstilo,
      ),
      fondo_animacion: normalizeFondoAnimacion(
        raw.home_fondo_animacion ??
          raw.fondo_animacion ??
          raw.fondoAnimacion ??
          raw.home_fondoAnimacion ??
          raw.ken_burns ??
          raw.bg_animacion,
      ),
      estilo_navegacion: normalizeEstiloNavegacion(
        raw.home_estilo_navegacion ?? raw.estilo_navegacion,
      ),
      efecto_entrada: normalizeEfectoEntrada(
        raw.home_efecto_entrada ?? raw.efecto_entrada,
      ),
    },
    menu: {
      fondos_cinematicos: parseBoolish(
        raw.menu_fondos_cinematicos ??
          raw.fondos_cinematicos_categoria ??
          raw.menu?.fondos_cinematicos,
        false,
      ),
      color_texto: normalizeHexColor(
        raw.menu_color_texto ?? raw.menu?.color_texto,
        '',
      ),
    },
    nosotros: {
      color_fondo: normalizeHexColor(raw.nosotros_color_fondo, ''),
      color_titulo: normalizeHexColor(raw.nosotros_color_titulo, ''),
      color_cuerpo: normalizeHexColor(raw.nosotros_color_cuerpo, ''),
      theme: String(raw.nosotros_theme ?? raw.nosotros?.theme ?? '')
        .trim()
        .toLowerCase() || 'editorial',
    },
    ubicacion: {
      color_fondo: normalizeHexColor(raw.ubicacion_color_fondo, ''),
      color_titulo: normalizeHexColor(raw.ubicacion_color_titulo, ''),
      color_cuerpo: normalizeHexColor(raw.ubicacion_color_cuerpo, ''),
    },
    css_avanzado: sanitizeCssAvanzado(raw.css_avanzado ?? raw.custom_css ?? ''),
  };
}

/**
 * CSS variables para Home + secciones (valores en px).
 * @param {ReturnType<typeof parseUiEstilo>} ui
 * @param {string} [fallbackPrimario]
 */
export function uiEstiloToCssVars(ui, fallbackPrimario = '#9f1239') {
  const home = ui?.home || {};
  const nosotros = ui?.nosotros || {};
  const ubicacion = ui?.ubicacion || {};
  const subColor = home.subtitulo_color || fallbackPrimario;

  const titulo = normalizeHomePx(home.titulo_size, {
    ...HOME_PX_RANGES.titulo,
    fallback: HOME_PX_DEFAULTS.titulo,
    legacyMap: LEGACY_TITULO_PX,
  });
  const logo = normalizeHomePx(home.logo_size, {
    ...HOME_PX_RANGES.logo,
    fallback: HOME_PX_DEFAULTS.logo,
    legacyMap: LEGACY_LOGO_PX,
  });
  const eslogan = normalizeHomePx(home.eslogan_size, {
    ...HOME_PX_RANGES.eslogan,
    fallback: HOME_PX_DEFAULTS.eslogan,
    legacyMap: LEGACY_ESLOGAN_PX,
  });
  const menu = normalizeHomePx(home.menu_size, {
    ...HOME_PX_RANGES.menu,
    fallback: HOME_PX_DEFAULTS.menu,
  });
  const logoX = normalizeHomeOffset(home.logo_x, {
    ...HOME_PX_RANGES.offset_x,
    fallback: HOME_PX_DEFAULTS.logo_x,
  });
  const logoY = normalizeHomeOffset(home.logo_y, {
    ...HOME_PX_RANGES.offset_y,
    fallback: HOME_PX_DEFAULTS.logo_y,
  });
  const tituloX = normalizeHomeOffset(home.titulo_x, {
    ...HOME_PX_RANGES.offset_x,
    fallback: HOME_PX_DEFAULTS.titulo_x,
  });
  const tituloY = normalizeHomeOffset(home.titulo_y, {
    ...HOME_PX_RANGES.offset_sm,
    fallback: HOME_PX_DEFAULTS.titulo_y,
  });
  const esloganX = normalizeHomeOffset(home.eslogan_x, {
    ...HOME_PX_RANGES.offset_x,
    fallback: HOME_PX_DEFAULTS.eslogan_x,
  });
  const esloganY = normalizeHomeOffset(home.eslogan_y, {
    ...HOME_PX_RANGES.offset_sm,
    fallback: HOME_PX_DEFAULTS.eslogan_y,
  });
  const menuX = normalizeHomeOffset(home.menu_x, {
    ...HOME_PX_RANGES.offset_x,
    fallback: HOME_PX_DEFAULTS.menu_x,
  });
  const menuY = normalizeHomeOffset(home.menu_y, {
    ...HOME_PX_RANGES.offset_y,
    fallback: HOME_PX_DEFAULTS.menu_y,
  });
  const overlayOpacity = normalizeOverlayOpacity(
    home.overlay_opacity,
    HOME_PX_DEFAULTS.overlay_opacity,
  );
  const overlayEstilo = normalizeOverlayEstilo(home.overlay_estilo);
  const fondoAnimacion = normalizeFondoAnimacion(home.fondo_animacion);
  const estiloNavegacion = normalizeEstiloNavegacion(home.estilo_navegacion);
  const efectoEntrada = normalizeEfectoEntrada(home.efecto_entrada);
  const tituloColor = home.titulo_color || HOME_PX_DEFAULTS.titulo_color;
  const esloganColor = home.eslogan_color || HOME_PX_DEFAULTS.eslogan_color;
  const menuColor = home.menu_color || HOME_PX_DEFAULTS.menu_color;
  const subtextoColor = home.subtexto_color || HOME_PX_DEFAULTS.subtexto_color;
  const bordeColor = home.borde_destacado_color || HOME_PX_DEFAULTS.borde_destacado_color;

  /** Short names = live-preview source of truth; `--home-*` aliases for backward compat. */
  return [
    `--logo-size: ${logo}px`,
    `--logo-x: ${logoX}px`,
    `--logo-y: ${logoY}px`,
    `--titulo-size: ${titulo}px`,
    `--titulo-x: ${tituloX}px`,
    `--titulo-y: ${tituloY}px`,
    `--titulo-color: ${tituloColor}`,
    `--eslogan-size: ${eslogan}px`,
    `--eslogan-x: ${esloganX}px`,
    `--eslogan-y: ${esloganY}px`,
    `--eslogan-color: ${esloganColor}`,
    `--menu-size: ${menu}px`,
    `--menu-x: ${menuX}px`,
    `--menu-y: ${menuY}px`,
    `--menu-color: ${menuColor}`,
    `--subtexto-color: ${subtextoColor}`,
    `--borde-destacado: ${bordeColor}`,
    `--home-titulo-size: ${titulo}px`,
    `--home-titulo-max-w: 28rem`,
    `--home-logo-size: ${logo}px`,
    `--home-eslogan-size: ${eslogan}px`,
    `--home-eslogan-max-w: 24rem`,
    `--home-menu-size: ${menu}px`,
    `--home-logo-x: ${logoX}px`,
    `--home-logo-y: ${logoY}px`,
    `--home-titulo-x: ${tituloX}px`,
    `--home-titulo-y: ${tituloY}px`,
    `--home-eslogan-x: ${esloganX}px`,
    `--home-eslogan-y: ${esloganY}px`,
    `--home-menu-x: ${menuX}px`,
    `--home-menu-y: ${menuY}px`,
    `--home-overlay-opacity: ${overlayOpacity}`,
    `--home-overlay-estilo: ${overlayEstilo}`,
    `--home-fondo-animacion: ${fondoAnimacion}`,
    `--home-estilo-navegacion: ${estiloNavegacion}`,
    `--home-efecto-entrada: ${efectoEntrada}`,
    `--home-tracking: ${TRACKING_CSS[home.tracking] || TRACKING_CSS['tracking-[0.3em]']}`,
    `--home-subtitulo-color: ${subColor}`,
    `--home-titulo-color: ${tituloColor}`,
    `--home-eslogan-color: ${esloganColor}`,
    `--home-menu-color: ${menuColor}`,
    `--home-subtexto-color: ${subtextoColor}`,
    `--home-borde-destacado: ${bordeColor}`,
    nosotros.color_fondo ? `--sec-nosotros-fondo: ${nosotros.color_fondo}` : '',
    nosotros.color_titulo ? `--sec-nosotros-titulo: ${nosotros.color_titulo}` : '',
    nosotros.color_cuerpo ? `--sec-nosotros-cuerpo: ${nosotros.color_cuerpo}` : '',
    ubicacion.color_fondo ? `--sec-ubicacion-fondo: ${ubicacion.color_fondo}` : '',
    ubicacion.color_titulo ? `--sec-ubicacion-titulo: ${ubicacion.color_titulo}` : '',
    ubicacion.color_cuerpo ? `--sec-ubicacion-cuerpo: ${ubicacion.color_cuerpo}` : '',
    ui?.menu?.color_texto ? `--menu-texto-color: ${ui.menu.color_texto}` : '',
  ]
    .filter(Boolean)
    .join('; ');
}

/**
 * Resuelve tamaños Home en px para plantillas (logo / título / eslogan).
 * @param {Record<string, unknown> | null | undefined} homeUi
 */
export function resolveHomePxSizes(homeUi) {
  const home = homeUi && typeof homeUi === 'object' ? homeUi : {};
  return {
    logoSizePx: normalizeHomePx(home.logo_size ?? home.logoSize ?? home.logo_scale, {
      ...HOME_PX_RANGES.logo,
      fallback: HOME_PX_DEFAULTS.logo,
      legacyMap: LEGACY_LOGO_PX,
    }),
    tituloSizePx: normalizeHomePx(home.titulo_size ?? home.tituloSize ?? home.titulo_scale, {
      ...HOME_PX_RANGES.titulo,
      fallback: HOME_PX_DEFAULTS.titulo,
      legacyMap: LEGACY_TITULO_PX,
    }),
    esloganSizePx: normalizeHomePx(home.eslogan_size ?? home.esloganSize ?? home.eslogan_scale, {
      ...HOME_PX_RANGES.eslogan,
      fallback: HOME_PX_DEFAULTS.eslogan,
      legacyMap: LEGACY_ESLOGAN_PX,
    }),
    menuSizePx: normalizeHomePx(home.menu_size ?? home.menuSize ?? home.boton_size, {
      ...HOME_PX_RANGES.menu,
      fallback: HOME_PX_DEFAULTS.menu,
    }),
    logoX: normalizeHomeOffset(
      home.logo_x ?? home.logoX ?? home.posicion_x ?? home.posicionX,
      { ...HOME_PX_RANGES.offset_x, fallback: HOME_PX_DEFAULTS.logo_x },
    ),
    logoY: normalizeHomeOffset(
      home.logo_y ?? home.logoY ?? home.posicion_y ?? home.posicionY,
      { ...HOME_PX_RANGES.offset_y, fallback: HOME_PX_DEFAULTS.logo_y },
    ),
    tituloX: normalizeHomeOffset(home.titulo_x ?? home.tituloX, {
      ...HOME_PX_RANGES.offset_x,
      fallback: HOME_PX_DEFAULTS.titulo_x,
    }),
    tituloY: normalizeHomeOffset(home.titulo_y ?? home.tituloY, {
      ...HOME_PX_RANGES.offset_sm,
      fallback: HOME_PX_DEFAULTS.titulo_y,
    }),
    esloganX: normalizeHomeOffset(home.eslogan_x ?? home.esloganX, {
      ...HOME_PX_RANGES.offset_x,
      fallback: HOME_PX_DEFAULTS.eslogan_x,
    }),
    esloganY: normalizeHomeOffset(home.eslogan_y ?? home.esloganY, {
      ...HOME_PX_RANGES.offset_sm,
      fallback: HOME_PX_DEFAULTS.eslogan_y,
    }),
    menuX: normalizeHomeOffset(home.menu_x ?? home.menuX, {
      ...HOME_PX_RANGES.offset_x,
      fallback: HOME_PX_DEFAULTS.menu_x,
    }),
    menuY: normalizeHomeOffset(home.menu_y ?? home.menuY, {
      ...HOME_PX_RANGES.offset_y,
      fallback: HOME_PX_DEFAULTS.menu_y,
    }),
    tituloColor: normalizeHexColor(
      home.titulo_color ?? home.tituloColor,
      HOME_PX_DEFAULTS.titulo_color,
    ),
    esloganColor: normalizeHexColor(
      home.eslogan_color ?? home.esloganColor,
      HOME_PX_DEFAULTS.eslogan_color,
    ),
    menuColor: normalizeHexColor(
      home.menu_color ?? home.menuColor,
      HOME_PX_DEFAULTS.menu_color,
    ),
    subtextoColor: normalizeHexColor(
      home.subtexto_color ?? home.subtextoColor,
      HOME_PX_DEFAULTS.subtexto_color,
    ),
    bordeDestacadoColor: normalizeHexColor(
      home.borde_destacado_color ?? home.bordeDestacadoColor,
      HOME_PX_DEFAULTS.borde_destacado_color,
    ),
    overlayOpacity: normalizeOverlayOpacity(
      home.overlay_opacity ?? home.overlayOpacity,
      HOME_PX_DEFAULTS.overlay_opacity,
    ),
    overlayEstilo: normalizeOverlayEstilo(
      home.overlay_estilo ?? home.overlayEstilo ?? home.overlay_style,
    ),
    fondoAnimacion: normalizeFondoAnimacion(
      home.fondo_animacion ??
        home.fondoAnimacion ??
        home.ken_burns ??
        home.bg_animacion ??
        home.bgAnimacion,
    ),
    estiloNavegacion: normalizeEstiloNavegacion(
      home.estilo_navegacion ?? home.estiloNavegacion ?? home.nav_style,
    ),
    efectoEntrada: normalizeEfectoEntrada(
      home.efecto_entrada ?? home.efectoEntrada ?? home.entrada_animacion,
    ),
  };
}


