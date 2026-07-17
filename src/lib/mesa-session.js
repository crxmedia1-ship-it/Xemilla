/**
 * Mesa asignada vía QR (?mesa=) — persistencia de sesión en la WebApp.
 * Clave: xemilla-mesa
 */

export const MESA_STORAGE_KEY = 'xemilla-mesa';

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeMesa(value) {
  const raw = String(value ?? '')
    .trim()
    .slice(0, 16);
  if (!raw) return '';
  // Solo mesa “de verdad”: alfanumérico + guión / slash (ej. 12, 12A, 3-B)
  if (!/^[A-Za-z0-9][A-Za-z0-9\-_/]{0,15}$/.test(raw)) return '';
  return raw;
}

/**
 * Lee ?mesa= / ?table= de la URL actual.
 * @returns {string}
 */
export function readMesaFromUrl() {
  try {
    const q = new URLSearchParams(window.location.search);
    return normalizeMesa(q.get('mesa') || q.get('table') || '');
  } catch {
    return '';
  }
}

/**
 * Persiste mesa desde URL → sessionStorage y la recupera.
 * @returns {string} mesa válida o ''
 */
export function syncMesaSession() {
  try {
    const fromUrl = readMesaFromUrl();
    if (fromUrl) {
      sessionStorage.setItem(MESA_STORAGE_KEY, fromUrl);
      return fromUrl;
    }
    return normalizeMesa(sessionStorage.getItem(MESA_STORAGE_KEY) || '');
  } catch {
    return readMesaFromUrl();
  }
}

/**
 * @returns {string}
 */
export function getStoredMesa() {
  try {
    return normalizeMesa(sessionStorage.getItem(MESA_STORAGE_KEY) || '') || readMesaFromUrl();
  } catch {
    return readMesaFromUrl();
  }
}

/**
 * @returns {boolean}
 */
export function hasValidMesaSession() {
  return Boolean(getStoredMesa());
}
