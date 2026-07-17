/**
 * Fondos y UI atómica por sección (Lego).
 * Persistido en restaurantes.secciones_fondo (JSONB).
 */

const FONDO_TIPOS = new Set(['color', 'image', 'video']);

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
  const tipoRaw = String(e.tipo ?? e.type ?? 'color')
    .trim()
    .toLowerCase();
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
    result[key] = normalizeFondoEntry({
      tipo: raw[`fondo_${key}_tipo`],
      valor: raw[`fondo_${key}_valor`],
    });
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
 * @returns {Array<{ red: string, url: string }>}
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
      return { red, url: normalizeSocialUrl(red, url) };
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

  /** @type {Array<{ red: string, url: string }>} */
  const list = [];
  for (const red of REDES_ALLOWED) {
    const key = `redes_${red}`;
    const url = String(raw[key] ?? '').trim();
    if (url) list.push({ red, url: normalizeSocialUrl(red, url) });
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

const SCALE_LABELS = { 1: 'XS', 2: 'SM', 3: 'MD', 4: 'LG', 5: 'XL' };

/** Título marca / nav → Tailwind-equivalent rem */
const TITULO_SCALE_CSS = {
  1: '1.125rem', // text-lg
  2: '1.25rem', // text-xl
  3: '1.875rem', // text-3xl
  4: '2.25rem', // text-4xl
  5: '3rem', // text-5xl
};

/** Diámetro del logo (círculo) */
const LOGO_SCALE_CSS = {
  1: '3.5rem',
  2: '4.25rem',
  3: '5.25rem',
  4: '6.25rem',
  5: '7.25rem',
};

/** Eslogan / subtítulos Home */
const ESLOGAN_SCALE_CSS = {
  1: '0.6rem',
  2: '0.68rem',
  3: '0.72rem',
  4: '0.85rem',
  5: '1rem',
};

const TRACKING_CSS = {
  'tracking-normal': '0em',
  'tracking-wider': '0.05em',
  'tracking-widest': '0.1em',
  'tracking-[0.3em]': '0.3em',
};

/**
 * @param {unknown} value
 * @param {number} [fallback=3]
 * @returns {number}
 */
export function normalizeScale(value, fallback = 3) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const n = Math.round(value);
    if (n >= 1 && n <= 5) return n;
  }
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return fallback;

  const asNum = Number(raw);
  if (Number.isFinite(asNum)) {
    const n = Math.round(asNum);
    if (n >= 1 && n <= 5) return n;
  }

  // Legacy Tailwind class → escala
  if (raw === 'text-lg' || raw === 'xs') return 1;
  if (raw === 'text-xl' || raw === 'sm') return 2;
  if (raw === 'text-2xl' || raw === 'text-3xl' || raw === 'md' || raw === 'normal') return 3;
  if (raw === 'text-4xl' || raw === 'lg') return 4;
  if (raw === 'text-5xl' || raw === 'xl') return 5;

  return fallback;
}

export function scaleLabel(value) {
  return SCALE_LABELS[normalizeScale(value)] || 'MD';
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
      titulo_size: normalizeScale(home.titulo_size ?? home.tituloSize ?? home.titulo_scale, 3),
      logo_size: normalizeScale(home.logo_size ?? home.logoSize ?? home.logo_scale, 3),
      eslogan_size: normalizeScale(home.eslogan_size ?? home.esloganSize ?? home.eslogan_scale, 3),
      tracking: HOME_TRACKINGS.has(tracking) ? tracking : 'tracking-[0.3em]',
      subtitulo_color: normalizeHexColor(home.subtitulo_color || home.subtituloColor, ''),
    },
    nosotros: {
      color_fondo: normalizeHexColor(nosotros.color_fondo || nosotros.colorFondo, ''),
      color_titulo: normalizeHexColor(nosotros.color_titulo || nosotros.colorTitulo, ''),
      color_cuerpo: normalizeHexColor(nosotros.color_cuerpo || nosotros.colorCuerpo, ''),
    },
    ubicacion: {
      color_fondo: normalizeHexColor(ubicacion.color_fondo || ubicacion.colorFondo, ''),
      color_titulo: normalizeHexColor(ubicacion.color_titulo || ubicacion.colorTitulo, ''),
      color_cuerpo: normalizeHexColor(ubicacion.color_cuerpo || ubicacion.colorCuerpo, ''),
    },
  };
}

/**
 * @param {Record<string, unknown>} raw
 */
export function buildUiEstiloFromBody(raw) {
  const tracking = String(raw.home_tracking ?? '').trim();

  return {
    home: {
      titulo_size: normalizeScale(raw.home_titulo_size, 3),
      logo_size: normalizeScale(raw.home_logo_size, 3),
      eslogan_size: normalizeScale(raw.home_eslogan_size, 3),
      tracking: HOME_TRACKINGS.has(tracking) ? tracking : 'tracking-[0.3em]',
      subtitulo_color: normalizeHexColor(raw.home_subtitulo_color, ''),
    },
    nosotros: {
      color_fondo: normalizeHexColor(raw.nosotros_color_fondo, ''),
      color_titulo: normalizeHexColor(raw.nosotros_color_titulo, ''),
      color_cuerpo: normalizeHexColor(raw.nosotros_color_cuerpo, ''),
    },
    ubicacion: {
      color_fondo: normalizeHexColor(raw.ubicacion_color_fondo, ''),
      color_titulo: normalizeHexColor(raw.ubicacion_color_titulo, ''),
      color_cuerpo: normalizeHexColor(raw.ubicacion_color_cuerpo, ''),
    },
  };
}

/**
 * CSS variables para Home + secciones.
 * @param {ReturnType<typeof parseUiEstilo>} ui
 * @param {string} [fallbackPrimario]
 */
export function uiEstiloToCssVars(ui, fallbackPrimario = '#9f1239') {
  const home = ui?.home || {};
  const nosotros = ui?.nosotros || {};
  const ubicacion = ui?.ubicacion || {};
  const subColor = home.subtitulo_color || fallbackPrimario;
  const titulo = normalizeScale(home.titulo_size, 3);
  const logo = normalizeScale(home.logo_size, 3);
  const eslogan = normalizeScale(home.eslogan_size, 3);

  return [
    `--home-titulo-size: ${TITULO_SCALE_CSS[titulo]}`,
    `--home-logo-size: ${LOGO_SCALE_CSS[logo]}`,
    `--home-eslogan-size: ${ESLOGAN_SCALE_CSS[eslogan]}`,
    `--home-tracking: ${TRACKING_CSS[home.tracking] || TRACKING_CSS['tracking-[0.3em]']}`,
    `--home-subtitulo-color: ${subColor}`,
    nosotros.color_fondo ? `--sec-nosotros-fondo: ${nosotros.color_fondo}` : '',
    nosotros.color_titulo ? `--sec-nosotros-titulo: ${nosotros.color_titulo}` : '',
    nosotros.color_cuerpo ? `--sec-nosotros-cuerpo: ${nosotros.color_cuerpo}` : '',
    ubicacion.color_fondo ? `--sec-ubicacion-fondo: ${ubicacion.color_fondo}` : '',
    ubicacion.color_titulo ? `--sec-ubicacion-titulo: ${ubicacion.color_titulo}` : '',
    ubicacion.color_cuerpo ? `--sec-ubicacion-cuerpo: ${ubicacion.color_cuerpo}` : '',
  ]
    .filter(Boolean)
    .join('; ');
}


