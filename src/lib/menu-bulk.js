/**
 * Parser e inserción masiva de menú (bulk) — tolerante.
 * Formato esperado por fila (TSV, CSV o pipe `|`):
 * Categoría | Nombre | Descripción | Precio | Destacado | ImagenURL
 *
 * Campos faltantes / inválidos se rellenan con defaults (no bloquean el lote).
 * La columna Categoría es la fuente de verdad; aliases conocidos se canonicizan
 * vía menu-macros (ej. Guarniciones → Contornos).
 */

import {
  canonicalizeCategoryName,
  getMacroById,
  MENU_MACROS,
  resolveMacroId,
} from '../config/menu-macros.js';


/**
 * Destacado: SI/sí/true/1 → true; NO/vacío/resto → false.
 * @param {string} raw
 */
function parseDestacado(raw) {
  const v = String(raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (!v || v === 'no' || v === 'n' || v === 'false' || v === '0') return false;
  return v === 'si' || v === 'true' || v === '1' || v === 'yes' || v === 'y';
}

/**
 * Precio inválido / vacío → 0.
 * @param {string} raw
 */
function parsePrecio(raw) {
  const cleaned = String(raw ?? '')
    .trim()
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '');

  if (!cleaned) return 0;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

/**
 * Solo conserva URLs http(s). "NO", vacío u otro texto → null.
 * @param {string} raw
 * @returns {string | null}
 */
function parseImagenUrl(raw) {
  const v = String(raw ?? '').trim();
  if (!v) return null;

  const lower = v.toLowerCase();
  if (lower === 'no' || lower === 'n' || lower === 'null' || lower === '-' || lower === 'ninguna') {
    return null;
  }

  if (/^https?:\/\//i.test(v)) return v;
  return null;
}

/**
 * @param {string} line
 * @returns {string[]}
 */
function splitRow(line) {
  if (line.includes('\t')) return line.split('\t').map((c) => c.trim());
  if (line.includes('|')) return line.split('|').map((c) => c.trim());
  return line.split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
}

/**
 * Rellena hasta 6 columnas con strings vacíos.
 * @param {string[]} cells
 * @returns {[string, string, string, string, string, string]}
 */
function padCells(cells) {
  const padded = [...cells.map((c) => String(c ?? '').trim())];
  while (padded.length < 6) padded.push('');
  return /** @type {[string, string, string, string, string, string]} */ (
    padded.slice(0, 6)
  );
}

/**
 * @param {string[]} cells
 */
function looksLikeHeader(cells) {
  const joined = cells.join(' ').toLowerCase();
  return (
    joined.includes('categor') ||
    (joined.includes('nombre') && joined.includes('precio')) ||
    joined.includes('imagen') ||
    joined.includes('destacado')
  );
}

/**
 * @typedef {{
 *   categoria: string,
 *   nombre: string,
 *   descripcion: string,
 *   precio: number,
 *   destacado: boolean,
 *   imagen_url: string | null,
 *   line: number,
 * }} ParsedPlatoRow
 */

/**
 * Parsea texto pegado a filas de platos (modo tolerante).
 * @param {string} text
 * @returns {{ rows: ParsedPlatoRow[], errors: string[] }}
 */
export function parseMenuBulkText(text) {
  /** @type {string[]} */
  const errors = [];
  /** @type {ParsedPlatoRow[]} */
  const rows = [];

  const lines = String(text ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { rows: [], errors: ['Pegá al menos una fila de menú.'] };
  }

  let start = 0;
  if (looksLikeHeader(splitRow(lines[0]))) start = 1;

  for (let i = start; i < lines.length; i++) {
    const lineNo = i + 1;
    const rawCells = splitRow(lines[i]);

    // 1 sola celda → se interpreta como nombre; categoría = General
    let cells = rawCells;
    if (rawCells.length === 1) {
      cells = ['General', rawCells[0]];
    }

    const [catRaw, nameRaw, descRaw, precioRaw, destacadoRaw, imagenRaw] = padCells(cells);

    const nombre = nameRaw.trim();
    if (!nombre) {
      // Sin nombre no se puede insertar (NOT NULL). Omitimos solo esta fila.
      errors.push(`Línea ${lineNo}: sin nombre — fila omitida.`);
      continue;
    }

    const categoria = canonicalizeCategoryName(catRaw.trim() || 'General');
    const descripcion = descRaw.trim();
    const precio = parsePrecio(precioRaw);
    const destacado = parseDestacado(destacadoRaw);
    const imagen_url = parseImagenUrl(imagenRaw);

    rows.push({
      categoria,
      nombre,
      descripcion,
      precio,
      destacado,
      imagen_url,
      line: lineNo,
    });
  }

  return { rows, errors };
}

/**
 * Preview client/server: filas parseadas + macro UI donde caerá cada una.
 * @param {string} text
 * @returns {{
 *   rows: Array<ParsedPlatoRow & { macroId: string, macroLabel: string }>,
 *   errors: string[],
 *   summary: Array<{ id: string, label: string, count: number }>,
 * }}
 */
export function previewMenuBulkText(text) {
  const { rows, errors } = parseMenuBulkText(text);
  /** @type {Map<string, number>} */
  const counts = new Map();

  const enriched = rows.map((row) => {
    const macroId = resolveMacroId(row.categoria);
    const macro = getMacroById(macroId);
    const macroLabel = macro?.label || (macroId === 'otros' ? 'Otros' : macroId);
    counts.set(macroId, (counts.get(macroId) || 0) + 1);
    return { ...row, macroId, macroLabel };
  });

  const order = [...MENU_MACROS.map((m) => m.id), 'otros'];
  const summary = order
    .filter((id) => counts.has(id))
    .map((id) => {
      const macro = getMacroById(id);
      return {
        id,
        label: macro?.label || (id === 'otros' ? 'Otros' : id),
        count: counts.get(id) || 0,
      };
    });

  return { rows: enriched, errors, summary };
}

/**
 * Resuelve mapa nombreCategoría → id (crea las faltantes).
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} restauranteId
 * @param {string[]} nombres
 * @returns {Promise<{ map: Map<string, number>, error?: string }>}
 */
export async function ensureCategoriasMap(client, restauranteId, nombres) {
  const unique = [...new Set(nombres.map((n) => n.trim()).filter(Boolean))];
  /** @type {Map<string, number>} */
  const map = new Map();

  const { data: existing, error: selectError } = await client
    .from('categorias')
    .select('id, nombre')
    .eq('restaurante_id', restauranteId);

  if (selectError) {
    return { map, error: selectError.message };
  }

  for (const cat of existing ?? []) {
    map.set(String(cat.nombre).trim().toLowerCase(), cat.id);
  }

  const missing = unique.filter((n) => !map.has(n.toLowerCase()));
  if (missing.length === 0) return { map };

  const { data: maxOrdenRow } = await client
    .from('categorias')
    .select('orden')
    .eq('restaurante_id', restauranteId)
    .order('orden', { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextOrden = Number(maxOrdenRow?.orden ?? -1) + 1;

  const toInsert = missing.map((nombre) => ({
    restaurante_id: restauranteId,
    nombre,
    orden: nextOrden++,
  }));

  const { data: created, error: insertError } = await client
    .from('categorias')
    .insert(toInsert)
    .select('id, nombre');

  if (insertError) {
    return { map, error: insertError.message };
  }

  for (const cat of created ?? []) {
    map.set(String(cat.nombre).trim().toLowerCase(), cat.id);
  }

  return { map };
}

/**
 * Inserta platos en lote.
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} restauranteId
 * @param {ParsedPlatoRow[]} rows
 */
export async function bulkInsertPlatos(client, restauranteId, rows) {
  const { map, error: catError } = await ensureCategoriasMap(
    client,
    restauranteId,
    rows.map((r) => r.categoria),
  );

  if (catError) return { error: catError, inserted: [] };

  const payload = rows.map((r) => {
    const categoria_id = map.get(r.categoria.toLowerCase());
    if (!categoria_id) {
      throw new Error(`Categoría no resuelta: ${r.categoria}`);
    }
    return {
      restaurante_id: restauranteId,
      categoria_id,
      nombre: r.nombre,
      descripcion: r.descripcion || null,
      precio: r.precio,
      destacado: r.destacado,
      imagen_url: r.imagen_url,
      disponible: true,
    };
  });

  const { data, error } = await client
    .from('platos')
    .insert(payload)
    .select(
      'id, nombre, descripcion, precio, imagen_url, disponible, destacado, categoria_id, categorias(nombre)',
    );

  if (error) {
    return { error: error.message, inserted: [] };
  }

  return {
    inserted: (data ?? []).map((p) => ({
      ...p,
      precio: Number(p.precio),
      categoria_nombre: p.categorias?.nombre ?? null,
      categorias: undefined,
    })),
  };
}
