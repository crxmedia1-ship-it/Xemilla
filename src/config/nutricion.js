/**
 * Ficha nutricional / alérgenos — catálogo compartido admin + WebApp.
 * Códigos estables en `platos.alergias` (text[]).
 */

/** @typedef {{ id: string, label: string }} AlergenoOption */

/** @type {AlergenoOption[]} */
export const ALERGENOS_OPTIONS = [
  { id: 'gluten', label: 'Gluten' },
  { id: 'lacteos', label: 'Lácteos' },
  { id: 'huevo', label: 'Huevo' },
  { id: 'mani', label: 'Maní' },
  { id: 'frutos_secos', label: 'Frutos secos' },
  { id: 'mariscos', label: 'Mariscos' },
  { id: 'pescado', label: 'Pescado' },
  { id: 'soja', label: 'Soja' },
  { id: 'sesamo', label: 'Sésamo' },
  { id: 'picante', label: 'Picante' },
  { id: 'no_vegano', label: 'No vegano' },
];

/**
 * Píldoras públicas: ocultan platos que contengan alguno de `hidesAny`.
 * @type {Array<{ id: string, label: string, emoji: string, hidesAny: string[] }>}
 */
export const NUTRICION_FILTROS_PUBLICOS = [
  { id: 'sin_gluten', label: 'Sin Gluten', emoji: '🌾', hidesAny: ['gluten'] },
  {
    id: 'vegano',
    label: 'Vegano',
    emoji: '🌱',
    hidesAny: ['lacteos', 'huevo', 'mariscos', 'pescado', 'no_vegano'],
  },
  { id: 'sin_lacteos', label: 'Sin Lácteos', emoji: '🥛', hidesAny: ['lacteos'] },
  {
    id: 'sin_frutos_secos',
    label: 'Sin Frutos Secos',
    emoji: '🥜',
    hidesAny: ['mani', 'frutos_secos'],
  },
  { id: 'sin_picante', label: 'Sin Picante', emoji: '🌶️', hidesAny: ['picante'] },
];

const ALERGENO_IDS = new Set(ALERGENOS_OPTIONS.map((a) => a.id));

/**
 * @param {unknown} value
 * @returns {string[]}
 */
export function normalizeAlergias(value) {
  /** @type {unknown[]} */
  let raw = [];
  if (Array.isArray(value)) raw = value;
  else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) raw = parsed;
      else raw = trimmed.split(/[,|;]/);
    } catch {
      raw = trimmed.split(/[,|;]/);
    }
  } else {
    return [];
  }

  /** @type {string[]} */
  const out = [];
  for (const item of raw) {
    const id = String(item ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/\s+/g, '_');
    if (!id || !ALERGENO_IDS.has(id)) continue;
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
export function parseMacroInt(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number.parseInt(String(value).replace(/[^\d-]/g, ''), 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/**
 * @param {Record<string, unknown> | null | undefined} plato
 */
export function platoHasNutricionData(plato) {
  if (!plato || typeof plato !== 'object') return false;
  const macros = ['calorias', 'proteinas', 'carbs', 'grasas'].some((k) => {
    const n = Number(plato[k]);
    return Number.isFinite(n) && n >= 0;
  });
  const alergias = normalizeAlergias(plato.alergias).length > 0;
  const ingredientes = String(plato.ingredientes_detalle || '').trim().length > 0;
  return macros || alergias || ingredientes;
}

/**
 * @param {string[]} alergias
 * @param {string[]} hidesAny
 */
export function alergiasMatchFilter(alergias, hidesAny) {
  if (!Array.isArray(alergias) || alergias.length === 0) return false;
  const set = new Set(alergias.map((a) => String(a).toLowerCase()));
  return hidesAny.some((id) => set.has(id));
}
