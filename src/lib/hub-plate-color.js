/**
 * Color de placa del logo a partir del cover del Hub.
 * Muestrea la franja inferior (donde vive el rectángulo del logo).
 */

/**
 * @param {string} hex
 * @returns {{ r: number, g: number, b: number } | null}
 */
export function parseHex(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  const n = Number.parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/**
 * @param {number} r
 * @param {number} g
 * @param {number} b
 */
export function toHex(r, g, b) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`;
}

/**
 * Suaviza el promedio para que el logo (sobre todo blanco) se lea bien.
 * @param {number} r
 * @param {number} g
 * @param {number} b
 */
export function tunePlateColor(r, g, b) {
  // Un poco más oscuro y saturado que el promedio crudo
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const darken = lum > 0.72 ? 0.72 : lum < 0.18 ? 1.15 : 0.88;
  let nr = r * darken;
  let ng = g * darken;
  let nb = b * darken;
  const avg = (nr + ng + nb) / 3;
  const sat = 1.12;
  nr = avg + (nr - avg) * sat;
  ng = avg + (ng - avg) * sat;
  nb = avg + (nb - avg) * sat;
  return toHex(nr, ng, nb);
}

/**
 * Extrae color de placa desde ImageData (banda inferior ya dibujada).
 * @param {ImageData} imageData
 */
export function colorFromImageData(imageData) {
  const { data } = imageData;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  // Submuestreo cada 4 px
  for (let i = 0; i < data.length; i += 16) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n += 1;
  }
  if (!n) return '#111111';
  return tunePlateColor(r / n, g / n, b / n);
}

/**
 * @param {CanvasImageSource & { naturalWidth?: number, naturalHeight?: number, width?: number, height?: number }} source
 * @param {{ bandStart?: number, bandEnd?: number }} [opts]
 */
export function samplePlateColorFromSource(source, opts = {}) {
  const bandStart = opts.bandStart ?? 0.7;
  const bandEnd = opts.bandEnd ?? 1;
  const nw =
    'naturalWidth' in source && source.naturalWidth
      ? source.naturalWidth
      : Number(source.width) || 0;
  const nh =
    'naturalHeight' in source && source.naturalHeight
      ? source.naturalHeight
      : Number(source.height) || 0;
  if (!nw || !nh) return '#111111';

  const y0 = Math.floor(nh * bandStart);
  const y1 = Math.floor(nh * bandEnd);
  const srcH = Math.max(1, y1 - y0);
  const canvas = document.createElement('canvas');
  const tw = 64;
  const th = 32;
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return '#111111';
  ctx.drawImage(source, 0, y0, nw, srcH, 0, 0, tw, th);
  return colorFromImageData(ctx.getImageData(0, 0, tw, th));
}

/**
 * Carga una URL de cover y muestrea el color de placa.
 * @param {string} url
 * @returns {Promise<string>}
 */
export async function samplePlateColorFromUrl(url) {
  const src = String(url || '').trim();
  if (!src || typeof document === 'undefined') return '#111111';

  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    // Necesario para leer píxeles si el storage permite CORS
    img.crossOrigin = 'anonymous';
    const done = (hex) => resolve(hex || '#111111');
    img.onload = () => {
      try {
        done(samplePlateColorFromSource(img));
      } catch {
        done('#111111');
      }
    };
    img.onerror = () => done('#111111');
    img.src = src;
  });
}
