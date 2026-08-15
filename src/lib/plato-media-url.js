/**
 * URL de foto de plato que llena el recuadro 4:3 (sin bandas negras).
 * @param {string} url
 * @param {{ w?: number, h?: number }} [size]
 */
export function platoFillUrl(url, size = {}) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  const marker = '/upload/';
  const at = raw.indexOf(marker);
  if (at === -1 || !/cloudinary\.com/i.test(raw)) return raw;

  const after = raw.slice(at + marker.length);
  if (/(?:^|\/)c_fill,/.test(after) || /e_trim/.test(after)) return raw;

  const w = Number(size.w) > 0 ? Math.round(size.w) : 800;
  const h = Number(size.h) > 0 ? Math.round(size.h) : 600;
  const rest = after.replace(/^f_auto,q_auto\//, '');
  return `${raw.slice(0, at + marker.length)}e_trim,c_fill,g_auto,w_${w},h_${h},f_auto,q_auto/${rest}`;
}
