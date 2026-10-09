const CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * @param {unknown} value
 * @param {number} fallback
 * @param {number} min
 * @param {number} max
 */
function clampInt(value, fallback, min, max) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Diseños listos. Uno nuevo se guarda en `catalogo` del restaurante. */
export const DISENOS_FIDELIDAD = Object.freeze([
  { id: 'tinta', nombre: 'Tinta', fondo: '#1c1917', tinta: '#fafaf9', acento: '#d6d3d1' },
  { id: 'brasa', nombre: 'Brasa', fondo: '#1c1917', tinta: '#fff7ed', acento: '#ff0200' },
  { id: 'hangang', nombre: 'Hangang', fondo: '#06261c', tinta: '#f4efe4', acento: '#c11a1d' },
  { id: 'canton', nombre: 'Cantón', fondo: '#2a0a14', tinta: '#f8efe6', acento: '#d4a574' },
  { id: 'oro', nombre: 'Oro', fondo: '#292017', tinta: '#faf6ef', acento: '#d4a574' },
  { id: 'nube', nombre: 'Nube', fondo: '#fafaf9', tinta: '#1c1917', acento: '#a1a1aa' },
]);

/**
 * @param {unknown} value
 * @param {string} fallback
 */
function readHex(value, fallback) {
  const raw = String(value || '').trim();
  return HEX.test(raw) ? raw.toLowerCase() : fallback;
}

/**
 * @param {unknown} value
 */
function readNivel(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? /** @type {Record<string, unknown>} */ (value)
    : null;
  if (!source) return null;
  const rawDesde = Math.round(Number(source.desde));
  if (!Number.isFinite(rawDesde) || rawDesde < 1) return null;
  const desde = Math.min(99, rawDesde);
  return {
    nombre: String(source.nombre || 'Nivel').trim().slice(0, 24) || 'Nivel',
    desde,
    diseno: String(source.diseno || '').trim().slice(0, 24),
    fondo: readHex(source.fondo, '#1c1917'),
    tinta: readHex(source.tinta, '#fafaf9'),
    acento: readHex(source.acento, '#d6d3d1'),
    ...readReglasPropias(source),
  };
}

/**
 * @param {Record<string, unknown>} source
 */
function readReglasPropias(source) {
  const puntos = source.puntos == null || source.puntos === '' ? null : clampInt(source.puntos, 10, 1, 500);
  const meta = source.meta == null || source.meta === '' ? null : clampInt(source.meta, 80, 1, 5000);
  return {
    puntos,
    meta,
    premio: String(source.premio || '').trim().slice(0, 80),
  };
}

/**
 * @param {unknown} value
 */
function readCatalogo(value) {
  const seen = new Set(DISENOS_FIDELIDAD.map((item) => item.id));
  return (Array.isArray(value) ? value : [])
    .map((item) => {
      const source = item && typeof item === 'object' ? /** @type {Record<string, unknown>} */ (item) : null;
      if (!source) return null;
      const id = String(source.id || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24);
      const nombre = String(source.nombre || '').trim().slice(0, 24);
      if (!id || !nombre || seen.has(id)) return null;
      seen.add(id);
      return {
        id,
        nombre,
        fondo: readHex(source.fondo, '#1c1917'),
        tinta: readHex(source.tinta, '#fafaf9'),
        acento: readHex(source.acento, '#d6d3d1'),
      };
    })
    .filter((item) => item)
    .slice(0, 12);
}

/**
 * @param {unknown} value
 */
export function readFidelidadDiseno(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? /** @type {Record<string, unknown>} */ (value)
    : {};
  const seen = new Set();
  const niveles = (Array.isArray(source.niveles) ? source.niveles : [])
    .map(readNivel)
    .filter((nivel) => {
      if (!nivel || seen.has(nivel.desde)) return false;
      seen.add(nivel.desde);
      return true;
    })
    .sort((a, b) => a.desde - b.desde)
    .slice(0, 3);
  return {
    diseno: String(source.diseno || '').trim().slice(0, 24),
    fondo: readHex(source.fondo, '#1c1917'),
    tinta: readHex(source.tinta, '#fafaf9'),
    acento: readHex(source.acento, '#d6d3d1'),
    titulo: String(source.titulo || '').trim().slice(0, 40),
    pedido: String(source.pedido || '').trim().slice(0, 120),
    catalogo: readCatalogo(source.catalogo),
    ...readReglasPropias(source),
    niveles,
  };
}

/**
 * La tarjeta inicial es el diseño base. Cada nivel se abre al llegar a sus canjes.
 * @param {{ fondo: string, tinta: string, acento: string, titulo?: string, diseno?: string, puntos?: number | null, meta?: number | null, premio?: string, niveles?: { nombre: string, desde: number, fondo: string, tinta: string, acento: string, diseno?: string, puntos?: number | null, meta?: number | null, premio?: string }[] }} diseno
 * @param {number} canjes
 */
export function nivelDeTarjeta(diseno, canjes) {
  const hechos = Math.max(0, Math.round(Number(canjes) || 0));
  const base = {
    nombre: 'Inicial',
    desde: 0,
    diseno: diseno.diseno || '',
    fondo: diseno.fondo,
    tinta: diseno.tinta,
    acento: diseno.acento,
    puntos: diseno.puntos ?? null,
    meta: diseno.meta ?? null,
    premio: diseno.premio || '',
  };
  return [base, ...(diseno.niveles || [])].reduce((actual, nivel) => (
    hechos >= nivel.desde ? nivel : actual
  ), base);
}

/**
 * @param {unknown} row
 */
/**
 * Cada diseño puede traer sus puntos y su premio. Si no, vale la regla del local.
 * @param {ReturnType<typeof readFidelidadDiseno>} diseno
 * @param {number} canjes
 * @param {{ puntos: number, meta: number, premio: string }} reglas
 */
export function reglasDeTarjeta(diseno, canjes, reglas) {
  const nivel = nivelDeTarjeta(diseno, canjes);
  return {
    puntos: nivel.puntos ?? reglas.puntos,
    meta: nivel.meta ?? reglas.meta,
    premio: nivel.premio || reglas.premio,
  };
}

export function readFidelidadReglas(row) {
  const source = row && typeof row === 'object' ? /** @type {Record<string, unknown>} */ (row) : {};
  return {
    puntos: clampInt(source.fidelidad_puntos, 10, 1, 500),
    meta: clampInt(source.fidelidad_meta, 80, 1, 5000),
    premio: String(source.fidelidad_premio || 'Un premio').trim().slice(0, 80) || 'Un premio',
  };
}

/**
 * @param {unknown} value
 */
export function readFidelidadTelefono(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 15);
  return digits.length >= 8 ? digits : '';
}

/**
 * @param {unknown} value
 */
export function readFidelidadNombre(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 60);
}

/**
 * @param {unknown} value
 */
export function readFidelidadCodigo(value) {
  const raw = String(value || '').trim().toUpperCase();
  const fromPayload = raw.match(/XEMILLA:FIDELIDAD:([A-Z2-9]{8})/);
  const code = fromPayload?.[1] || raw.replace(/[^A-Z2-9]/g, '').slice(0, 8);
  return /^[A-Z2-9]{8}$/.test(code) ? code : '';
}

export function nuevoCodigoFidelidad() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (n) => CODIGO[n % CODIGO.length]).join('');
}

/**
 * @param {number} puntos
 * @param {{ puntos: number, meta: number, premio: string }} reglas
 * @param {'visita' | 'canje'} motivo
 */
export function moverPuntos(puntos, reglas, motivo) {
  const actual = Math.max(0, Math.round(Number(puntos) || 0));
  if (motivo === 'visita') {
    const delta = reglas.puntos;
    return { puntos: Math.min(100000, actual + delta), delta };
  }
  if (motivo === 'canje') {
    if (actual < reglas.meta) return { error: 'Todavía no llega al premio.' };
    return { puntos: actual - reglas.meta, delta: -reglas.meta };
  }
  return { error: 'Movimiento inválido.' };
}

/**
 * @param {Record<string, unknown>} tarjeta
 * @param {{ puntos: number, meta: number, premio: string }} reglas
 */
export function tarjetaPublica(tarjeta, reglas) {
  const puntos = Math.max(0, Math.round(Number(tarjeta.puntos) || 0));
  const meta = reglas.meta;
  return {
    codigo: String(tarjeta.codigo || ''),
    nombre: String(tarjeta.nombre || ''),
    puntos,
    meta,
    premio: reglas.premio,
    listo: puntos >= meta,
    falta: Math.max(0, meta - puntos),
    visitas: reglas.puntos > 0 ? Math.ceil(Math.max(0, meta - puntos) / reglas.puntos) : 0,
    progreso: meta > 0 ? Math.min(100, Math.round((puntos / meta) * 100)) : 0,
  };
}
