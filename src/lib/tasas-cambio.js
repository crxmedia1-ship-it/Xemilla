/**
 * Tasas oficiales BCV (VES por 1 USD / 1 EUR).
 * Fuentes: bcv.today (USD+EUR) y ve.dolarapi.com (USD oficial).
 */

const CACHE_MS = 30 * 60 * 1000;
const FETCH_MS = 4500;

/** Última tasa BCV conocida (agosto 2026) — solo si fallan las APIs. */
export const TASAS_FALLBACK = {
  usdVes: 766.8603,
  eurVes: 885.0795,
  fuente: 'fallback',
  fecha: null,
};

/** @type {{ usdVes: number, eurVes: number, fuente: string, fecha: string | null, fetchedAt: number } | null} */
let memoryCache = null;

/**
 * @param {string} url
 * @returns {Promise<any>}
 */
async function fetchJson(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function asPositiveRate(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 1 ? n : null;
}

/**
 * @returns {Promise<{ usdVes: number, eurVes: number, fuente: string, fecha: string | null }>}
 */
export async function fetchTasasCambio() {
  if (memoryCache && Date.now() - memoryCache.fetchedAt < CACHE_MS) {
    const { fetchedAt: _t, ...rest } = memoryCache;
    return rest;
  }

  let usdVes = null;
  let eurVes = null;
  let fuente = '';
  let fecha = null;

  try {
    const bcv = await fetchJson('https://bcv.today/api/v1/rate.json');
    usdVes = asPositiveRate(bcv?.USD);
    eurVes = asPositiveRate(bcv?.EUR);
    if (usdVes) {
      fuente = 'bcv.today';
      fecha = String(bcv?.effective_date || bcv?.date || '').slice(0, 10) || null;
    }
  } catch {
    /* siguiente fuente */
  }

  if (!usdVes) {
    try {
      const oficial = await fetchJson('https://ve.dolarapi.com/v1/dolares/oficial');
      usdVes = asPositiveRate(oficial?.promedio ?? oficial?.venta ?? oficial?.compra);
      if (usdVes) {
        fuente = 'dolarapi';
        fecha = String(oficial?.fechaActualizacion || '').slice(0, 10) || null;
      }
    } catch {
      /* fallback estático */
    }
  }

  if (!usdVes) {
    memoryCache = { ...TASAS_FALLBACK, fetchedAt: Date.now() };
    return { ...TASAS_FALLBACK };
  }

  if (!eurVes) {
    eurVes = usdVes / 0.866;
  }

  const out = {
    usdVes,
    eurVes,
    fuente: fuente || 'bcv',
    fecha,
  };
  memoryCache = { ...out, fetchedAt: Date.now() };
  return out;
}
