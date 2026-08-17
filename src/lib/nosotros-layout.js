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
 *   texto?: string,
 *   contenido?: string,
 *   alineacion?: string,
 *   acentos?: string[],
 * }} NosotrosBloque
 */

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
        const media = String(b.media_url || b.imagen || '').trim() || null;
        return {
          ...b,
          titulo: String(b.titulo || '').trim(),
          texto: textoBody,
          media_url: media,
          imagen: media,
          alineacion: b.alineacion === 'inversa' ? 'inversa' : 'alternada',
        };
      })
      .filter((b) => b && (b.titulo || b.texto || b.media_url));
  }

  if (texto) {
    return [
      {
        subtitulo: highlights[0] || 'Nuestra historia',
        titulo: 'Nosotros',
        caption: '',
        imagen: null,
        media_url: null,
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
