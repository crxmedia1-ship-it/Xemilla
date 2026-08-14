/**
 * Jerarquía Macro → Sub para el Studio (filtros de menú).
 * Las subcategorías reales del local se emparejan por nombre normalizado.
 *
 * Fuente de verdad del plato = nombre de categoría en DB / carga masiva.
 * Las macros son solo agrupación UI derivada de aliases + heurística.
 */

/** @typedef {{ id: string, label: string, aliases: string[], subs: string[] }} MenuMacro */

/** @type {MenuMacro[]} */
export const MENU_MACROS = [
  {
    id: 'entradas',
    label: 'Entradas',
    aliases: ['entradas', 'entrada'],
    subs: ['crudos', 'ensaladas', 'para compartir', 'sopas'],
  },
  {
    id: 'principales',
    label: 'Principales',
    aliases: ['principales', 'principal', 'platos fuertes'],
    subs: [
      'de la tierra',
      'de tierra',
      'del mar',
      'pastas',
      'asados',
      'a la brasa',
      'cocina',
    ],
  },
  {
    id: 'contornos',
    label: 'Contornos',
    aliases: [
      'contornos',
      'contorno',
      'guarniciones',
      'guarnicion',
      'acompañamientos',
      'acompanamientos',
      'sides',
    ],
    subs: [
      'contornos',
      'contorno',
      'guarniciones',
      'guarnicion',
      'acompañamientos',
      'acompanamientos',
      'tostones',
      'yuca',
      'arroz',
    ],
  },
  {
    id: 'bebidas',
    label: 'Bebidas & Licores',
    aliases: ['bebidas', 'bebidas & licores', 'bebidas y licores', 'licores'],
    subs: [
      'sin alcohol',
      'cervezas',
      'cerveza',
      'cerveza importada',
      'cerveza nacional',
      'vinos y espumantes',
      'vinos',
      'cócteles',
      'cocteles',
      'cocteles de autor',
      'servicio por botella',
      'jugos naturales',
      'jugos',
    ],
  },
  {
    id: 'postres',
    label: 'Postres',
    aliases: ['postres', 'postre', 'dulces'],
    subs: ['postres', 'postre', 'dulces'],
  },
];

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeCategoryName(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * @param {string} needle
 * @param {string} hay
 */
function softIncludes(needle, hay) {
  if (!needle || !hay) return false;
  return hay === needle || hay.includes(needle) || needle.includes(hay);
}

/**
 * @param {unknown} categoriaNombre
 * @returns {string} macro id
 */
export function resolveMacroId(categoriaNombre) {
  const n = normalizeCategoryName(categoriaNombre);
  if (!n || n === '—' || n === '-') return 'otros';

  for (const macro of MENU_MACROS) {
    if (macro.aliases.some((a) => normalizeCategoryName(a) === n)) return macro.id;
    if (macro.subs.some((s) => softIncludes(normalizeCategoryName(s), n))) return macro.id;
  }

  if (/contorno|guarnicion|acompan|side dish|sides?\b/.test(n)) return 'contornos';
  if (/vino|espumante|cerveza|coctel|cocktail|jugo|alcohol|botella|licor|bebida|trago/.test(n)) {
    return 'bebidas';
  }
  if (/postre|dulce|helado|tarta|mousse|brownie/.test(n)) return 'postres';
  if (/crudo|sopa|ensalada|compartir|entrada|ceviche|tartar/.test(n)) return 'entradas';
  if (/pasta|mar|tierra|brasa|asado|carne|pescado|principal|parrilla/.test(n)) {
    return 'principales';
  }
  return 'otros';
}

/**
 * Normaliza el nombre de categoría de carga masiva al canónico del macro
 * cuando el texto es un alias exacto (ej. "Guarniciones" / "Contorno" → "Contornos").
 * No renombra subcategorías específicas ("De Tierra", "Crudos", etc.).
 * @param {unknown} categoriaNombre
 * @returns {string}
 */
export function canonicalizeCategoryName(categoriaNombre) {
  const raw = String(categoriaNombre ?? '').trim();
  if (!raw) return 'General';
  const n = normalizeCategoryName(raw);
  const macro = getMacroById(resolveMacroId(raw));
  if (!macro) return raw;
  if (macro.aliases.some((a) => normalizeCategoryName(a) === n)) return macro.label;
  return raw;
}

/**
 * @param {string} macroId
 * @returns {MenuMacro | null}
 */
export function getMacroById(macroId) {
  return MENU_MACROS.find((m) => m.id === macroId) || null;
}

/**
 * Orden canónico de un nombre de subcategoría dentro de su macro.
 * @param {string} macroId
 * @param {string} categoriaNombre
 */
export function subSortIndex(macroId, categoriaNombre) {
  const macro = getMacroById(macroId);
  if (!macro) return 999;
  const n = normalizeCategoryName(categoriaNombre);
  const idx = macro.subs.findIndex((s) => softIncludes(normalizeCategoryName(s), n));
  return idx >= 0 ? idx : 500;
}

/**
 * Macros visibles según categorías reales del menú.
 * @param {Iterable<string>} categoryNames
 * @returns {Array<{ id: string, label: string }>}
 */
export function macrosPresentIn(categoryNames) {
  /** @type {Set<string>} */
  const present = new Set();
  for (const name of categoryNames) {
    present.add(resolveMacroId(name));
  }
  /** @type {Array<{ id: string, label: string }>} */
  const out = MENU_MACROS.filter((m) => present.has(m.id)).map((m) => ({
    id: m.id,
    label: m.label,
  }));
  if (present.has('otros')) {
    out.push({ id: 'otros', label: 'Otros' });
  }
  return out;
}

/**
 * Subcategorías reales que pertenecen a un macro, ordenadas.
 * @param {string} macroId
 * @param {Iterable<string>} categoryNames
 * @returns {string[]}
 */
export function subsForMacro(macroId, categoryNames) {
  const names = [...new Set([...categoryNames].map((n) => String(n || '').trim()).filter(Boolean))];
  const filtered = names.filter((n) => resolveMacroId(n) === macroId);
  return filtered.sort((a, b) => {
    const ai = subSortIndex(macroId, a);
    const bi = subSortIndex(macroId, b);
    if (ai !== bi) return ai - bi;
    return a.localeCompare(b, 'es');
  });
}
