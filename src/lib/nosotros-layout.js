/**
 * Helpers compartidos para layouts de la sección Nosotros.
 */

/**
 * @typedef {{
 *   subtitulo?: string,
 *   titulo?: string,
 *   tituloAcento?: string,
 *   caption?: string,
 *   imagen?: string | null,
 *   media_url?: string | null,
 *   media?: string[],
 *   texto?: string,
 *   contenido?: string,
 *   alineacion?: string,
 *   acentos?: string[],
 * }} NosotrosBloque
 */

export const MAX_BLOQUE_MEDIA = 3;

/** Estilo visual de las tarjetas / contenedor de Nosotros. */
export const CONTENEDOR_ESTILOS = /** @type {const} */ ([
  'vidrio',
  'solido',
  'linea',
  'ninguno',
]);

/**
 * @param {unknown} value
 * @returns {'vidrio' | 'solido' | 'linea' | 'ninguno'}
 */
export function normalizeContenedorEstilo(value) {
  const v = String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (
    v === 'ninguno' ||
    v === 'sin contenedor' ||
    v === 'sincontenedor' ||
    v === 'transparente' ||
    v === 'transparent' ||
    v === 'none'
  ) {
    return 'ninguno';
  }
  if (v === 'solido' || v === 'solid' || v === 'opaco' || v === 'filled') return 'solido';
  if (v === 'linea' || v === 'outline' || v === 'borde' || v === 'line') return 'linea';
  return 'vidrio';
}

/**
 * Inline style para tarjetas según estilo + color de contenedor.
 * @param {'vidrio' | 'solido' | 'linea' | 'ninguno'} estilo
 * @param {string} [color]
 */
export function contenedorCardStyle(estilo, color = '') {
  const bg = String(color || '').trim();
  if (estilo === 'ninguno') {
    return 'background:transparent; backdrop-filter:none; -webkit-backdrop-filter:none; border-color:transparent; box-shadow:none;';
  }
  if (estilo === 'solido') {
    return bg
      ? `background:${bg}; border:1px solid color-mix(in srgb, ${bg} 72%, transparent); backdrop-filter:none; -webkit-backdrop-filter:none; box-shadow:0 16px 40px color-mix(in srgb, #000 18%, transparent);`
      : 'background:var(--sec-nosotros-fondo, var(--color-fondo, #141414)); border:1px solid color-mix(in srgb, currentColor 20%, transparent); backdrop-filter:none; -webkit-backdrop-filter:none; box-shadow:0 16px 40px color-mix(in srgb, #000 18%, transparent);';
  }
  if (estilo === 'linea') {
    return 'background:transparent; border:1px solid color-mix(in srgb, currentColor 28%, transparent); backdrop-filter:none; -webkit-backdrop-filter:none; box-shadow:none;';
  }
  return bg
    ? `background:color-mix(in srgb, ${bg} 78%, transparent); border:1px solid color-mix(in srgb, ${bg} 48%, transparent);`
    : '';
}

/**
 * @param {unknown} value
 */
export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * @param {string} value
 */
export function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {string} title
 * @param {string} [accent]
 */
export function renderTitleHtml(title, accent) {
  const safe = escapeHtml(title);
  if (!accent || !accent.trim()) return safe;
  const needle = escapeHtml(accent.trim());
  const re = new RegExp(`(${escapeRegExp(needle)})`, 'i');
  return safe.replace(re, '<span class="editorial-accent">$1</span>');
}

/**
 * @param {string} body
 * @param {string[]} [words]
 */
export function renderBodyHtml(body, words = []) {
  let html = escapeHtml(body);
  for (const word of words) {
    if (!word?.trim()) continue;
    const needle = escapeHtml(word.trim());
    const re = new RegExp(`(${escapeRegExp(needle)})`, 'gi');
    html = html.replace(re, '<span class="editorial-accent">$1</span>');
  }
  return html;
}

/**
 * @param {string} url
 */
export function isVideoUrl(url) {
  return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url) || /\/video\/upload\//i.test(url);
}

/**
 * Normaliza 1–3 URLs de media (imagen o video) por bloque.
 * Acepta `media` (array), `media_urls`, o legacy `media_url` / `imagen`.
 * @param {unknown} bloque
 * @returns {string[]}
 */
export function normalizeBloqueMedia(bloque) {
  if (!bloque || typeof bloque !== 'object') return [];
  const b = /** @type {Record<string, unknown>} */ (bloque);
  /** @type {string[]} */
  const out = [];
  const push = (v) => {
    const url = String(v || '').trim();
    if (!url || out.length >= MAX_BLOQUE_MEDIA) return;
    out.push(url);
  };

  if (Array.isArray(b.media) && b.media.length > 0) {
    for (const item of b.media) push(item);
    return out;
  }
  if (Array.isArray(b.media_urls)) {
    for (const item of b.media_urls) push(item);
  }
  push(b.media_url);
  push(b.imagen);
  if (typeof b.media === 'string') push(b.media);

  return out;
}

/**
 * @param {{
 *   bloques?: NosotrosBloque[],
 *   texto?: string,
 *   highlights?: string[],
 * }} opts
 * @returns {NosotrosBloque[]}
 */
export function resolveNosotrosBloques(opts = {}) {
  const { bloques = [], texto = '', highlights = [] } = opts;

  if (Array.isArray(bloques) && bloques.length > 0) {
    return bloques
      .map((b) => {
        if (!b) return null;
        const textoBody = String(b.texto || b.contenido || '').trim();
        const media = normalizeBloqueMedia(b);
        const primary = media[0] || null;
        return {
          ...b,
          titulo: String(b.titulo || '').trim(),
          texto: textoBody,
          media,
          media_url: primary,
          imagen: primary,
          alineacion: b.alineacion === 'inversa' ? 'inversa' : 'alternada',
        };
      })
      .filter((b) => b && (b.titulo || b.texto || (b.media && b.media.length > 0)));
  }

  if (texto) {
    return [
      {
        subtitulo: highlights[0] || 'Nuestra historia',
        titulo: 'Nosotros',
        caption: '',
        imagen: null,
        media_url: null,
        media: [],
        texto,
        alineacion: 'alternada',
        acentos: [],
      },
    ];
  }

  return [];
}

/**
 * mediaPrimero: true → media arriba / izquierda
 * @param {{ alineacion?: string }} bloque
 * @param {number} index
 */
export function mediaPrimero(bloque, index) {
  if (bloque.alineacion === 'inversa') return true;
  return index % 2 === 1;
}
