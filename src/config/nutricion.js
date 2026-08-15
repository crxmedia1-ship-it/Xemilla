/**
 * Ficha nutricional / alérgenos — catálogo compartido admin + WebApp.
 * Códigos estables en `platos.alergias` (text[]).
 */

/** @typedef {{ id: string, label: string, emoji: string, color: string }} AlergenoOption */

/** @type {AlergenoOption[]} */
export const ALERGENOS_OPTIONS = [
  { id: 'gluten', label: 'Gluten', emoji: '🌾', color: '#eab308' },
  { id: 'lacteos', label: 'Lácteos', emoji: '🥛', color: '#38bdf8' },
  { id: 'huevo', label: 'Huevo', emoji: '🥚', color: '#facc15' },
  { id: 'mani', label: 'Maní', emoji: '🥜', color: '#f97316' },
  { id: 'frutos_secos', label: 'Frutos secos', emoji: '🌰', color: '#c4a574' },
  { id: 'mariscos', label: 'Mariscos', emoji: '🦐', color: '#fb7185' },
  { id: 'pescado', label: 'Pescado', emoji: '🐟', color: '#22d3ee' },
  { id: 'soja', label: 'Soja', emoji: '🫘', color: '#84cc16' },
  { id: 'sesamo', label: 'Sésamo', emoji: '⚪', color: '#d6d3d1' },
  { id: 'picante', label: 'Picante', emoji: '🌶️', color: '#ef4444' },
  { id: 'carne', label: 'Carne', emoji: '🥩', color: '#f43f5e' },
  { id: 'no_vegano', label: 'No vegano', emoji: '🚫', color: '#a78bfa' },
];

/**
 * @param {unknown} id
 * @returns {{ id: string, label: string, emoji: string, color: string }}
 */
export function getAlergenoMeta(id) {
  const key = String(id || '')
    .trim()
    .toLowerCase();
  const opt = ALERGENOS_OPTIONS.find((a) => a.id === key);
  return {
    id: key,
    label: opt?.label || key,
    emoji: opt?.emoji || '⚠️',
    color: opt?.color || '#94a3b8',
  };
}

/**
 * Píldoras públicas: ocultan platos que contengan alguno de `hidesAny`.
 * @type {Array<{ id: string, label: string, emoji: string, hidesAny: string[], hideUnknown?: boolean }>}
 */
export const NUTRICION_FILTROS_PUBLICOS = [
  { id: 'sin_gluten', label: 'Sin Gluten', emoji: '🌾', hidesAny: ['gluten'] },
  {
    id: 'vegano',
    label: 'Vegano',
    emoji: '🌱',
    hidesAny: ['lacteos', 'huevo', 'mariscos', 'pescado', 'carne', 'no_vegano'],
    hideUnknown: true,
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

/** @type {Record<string, string>} */
const ALERGENO_ALIASES = {
  huevos: 'huevo',
  egg: 'huevo',
  eggs: 'huevo',
  lacteo: 'lacteos',
  leche: 'lacteos',
  dairy: 'lacteos',
  peanut: 'mani',
  peanuts: 'mani',
  nuts: 'frutos_secos',
  frutossecos: 'frutos_secos',
  shellfish: 'mariscos',
  fish: 'pescado',
  soy: 'soja',
  sesame: 'sesamo',
  spicy: 'picante',
  meat: 'carne',
  carnes: 'carne',
  non_vegan: 'no_vegano',
  novegano: 'no_vegano',
  trigo: 'gluten',
  wheat: 'gluten',
  celiaco: 'gluten',
  celiac: 'gluten',
};

/**
 * Normaliza un token de alérgeno al id canónico (o string vacío).
 * @param {unknown} value
 * @returns {string}
 */
export function canonAlergenoId(value) {
  const id = String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[-\s]+/g, '_');
  if (!id) return '';
  const mapped = ALERGENO_ALIASES[id] || id;
  return ALERGENO_IDS.has(mapped) ? mapped : mapped;
}

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
    const mapped = canonAlergenoId(item);
    if (!mapped || !ALERGENO_IDS.has(mapped)) continue;
    if (!out.includes(mapped)) out.push(mapped);
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
  const ingredientes = String(
    plato.ingredientes_detalle || plato.ingredientesDetalle || '',
  ).trim().length > 0;
  return macros || alergias || ingredientes;
}

/**
 * @param {string[]} alergias
 * @param {string[]} hidesAny
 */
export function alergiasMatchFilter(alergias, hidesAny) {
  if (!Array.isArray(alergias) || alergias.length === 0) return false;
  const set = new Set(alergias.map((a) => canonAlergenoId(a)).filter(Boolean));
  return hidesAny.some((id) => set.has(canonAlergenoId(id)));
}

/** Pistas en el nombre/ingredientes si el tag no llegó al DOM. */
const GLUTEN_HINT =
  /gluten|\btrigo\b|\bwheat\b|centeno|cebada|espelta|pan\s*rallad|harina\s+de\s+trigo|bread\s*crumb/i;
const LACTEOS_HINT =
  /\bl[aá]cteo|\bleche\b|mantequilla|queso|crema|yogur|bechamel|dairy|\bbutter\b|\bcheese\b/i;
const NUTS_HINT = /fruto[s]?\s*seco|\bmani\b|\bnuez|\balmendr|cacahuate|pistachio|avellana|\bpeanut|\bwalnut/i;
const PICANTE_HINT = /picante|ají|aji\b|chile|habanero|cayena|sriracha|spicy/i;

/**
 * @param {string} filtroId  sin_gluten | sin_lacteos | …
 * @param {string} nombre
 * @param {string} ingredientes
 */
export function textoSugiereAlergeno(filtroId, nombre, ingredientes) {
  const blob = `${nombre || ''} ${ingredientes || ''}`;
  if (filtroId === 'sin_gluten') return GLUTEN_HINT.test(blob);
  if (filtroId === 'sin_lacteos') return LACTEOS_HINT.test(blob);
  if (filtroId === 'sin_frutos_secos') return NUTS_HINT.test(blob);
  if (filtroId === 'sin_picante') return PICANTE_HINT.test(blob);
  return false;
}
