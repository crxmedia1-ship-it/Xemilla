import { isSuperAdminUser } from '../../config/superadmin.js';
import { normalizeAlergias, parseMacroInt } from '../../config/nutricion.js';
import { createSupabaseServerClient } from '../../lib/supabase/server.js';
import { getSuperAdminWriteClient } from '../../lib/superadmin.js';

export const prerender = false;

/**
 * SuperAdmin: sincroniza ficha nutricional por nombre de plato.
 * Body: { restaurante_id, text } — JSON array o líneas:
 *   Nombre | calorias | proteinas | carbs | grasas | alergias | ingredientes
 *   o JSON: [{ "nombre", "calorias", "proteinas", "carbs", "grasas", "alergias", "ingredientes_detalle" }]
 */
export async function POST({ request, cookies }) {
  const supabase = createSupabaseServerClient({ request, cookies });
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return json({ error: 'No autenticado' }, 401);
  if (!isSuperAdminUser(user)) {
    return json({ error: 'Importador nutricional solo disponible para SuperAdmin' }, 403);
  }

  /** @type {Record<string, unknown>} */
  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Cuerpo inválido' }, 400);
  }

  const restauranteId = String(body.restaurante_id || '').trim();
  const text = String(body.text || '').trim();
  if (!restauranteId) return json({ error: 'restaurante_id requerido' }, 400);
  if (!text) return json({ error: 'Pegá el JSON o la lista nutricional' }, 400);

  const { rows, errors } = parseNutricionBulkText(text);
  if (rows.length === 0) {
    return json({ error: errors[0] || 'Sin filas válidas', errors }, 400);
  }

  const writeClient = getSuperAdminWriteClient(supabase, user);
  const { data: existing, error: listError } = await writeClient
    .from('platos')
    .select('id, nombre')
    .eq('restaurante_id', restauranteId);

  if (listError) return json({ error: listError.message }, 400);

  /** @type {Map<string, number[]>} */
  const byName = new Map();
  for (const p of existing ?? []) {
    const key = normalizeName(p.nombre);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)?.push(Number(p.id));
  }

  let updated = 0;
  /** @type {string[]} */
  const unmatched = [];
  /** @type {string[]} */
  const updateErrors = [...errors];

  for (const row of rows) {
    const ids = byName.get(normalizeName(row.nombre)) || [];
    if (ids.length === 0) {
      unmatched.push(row.nombre);
      continue;
    }
    const patch = {
      calorias: row.calorias,
      proteinas: row.proteinas,
      carbs: row.carbs,
      grasas: row.grasas,
      alergias: row.alergias,
      ingredientes_detalle: row.ingredientes_detalle,
    };
    const { error } = await writeClient.from('platos').update(patch).in('id', ids);
    if (error) {
      updateErrors.push(`${row.nombre}: ${error.message}`);
      continue;
    }
    updated += ids.length;
  }

  return json({
    ok: true,
    updated,
    unmatched,
    errors: updateErrors,
    count: rows.length,
  });
}

/**
 * @param {string} text
 */
function parseNutricionBulkText(text) {
  /** @type {string[]} */
  const errors = [];
  /** @type {Array<{
   *   nombre: string,
   *   calorias: number | null,
   *   proteinas: number | null,
   *   carbs: number | null,
   *   grasas: number | null,
   *   alergias: string[],
   *   ingredientes_detalle: string | null,
   * }>} */
  const rows = [];

  const trimmed = String(text || '').trim();
  if (!trimmed) return { rows, errors: ['Texto vacío'] };

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of list) {
        if (!item || typeof item !== 'object') continue;
        const nombre = String(item.nombre || item.name || '').trim();
        if (!nombre) {
          errors.push('Fila JSON sin nombre — omitida.');
          continue;
        }
        rows.push({
          nombre,
          calorias: parseMacroInt(item.calorias ?? item.kcal),
          proteinas: parseMacroInt(item.proteinas ?? item.protein),
          carbs: parseMacroInt(item.carbs ?? item.carbohidratos),
          grasas: parseMacroInt(item.grasas ?? item.fat),
          alergias: normalizeAlergias(item.alergias ?? item.allergens),
          ingredientes_detalle:
            String(item.ingredientes_detalle ?? item.ingredientes ?? '').trim() || null,
        });
      }
      return { rows, errors };
    } catch (err) {
      return {
        rows: [],
        errors: [`JSON inválido: ${err instanceof Error ? err.message : 'parse error'}`],
      };
    }
  }

  const lines = trimmed.replace(/\r\n/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean);
  let start = 0;
  if (/nombre|calor|protein|alerg/i.test(lines[0] || '')) start = 1;

  for (let i = start; i < lines.length; i++) {
    const cells = splitRow(lines[i]);
    const nombre = String(cells[0] || '').trim();
    if (!nombre) {
      errors.push(`Línea ${i + 1}: sin nombre — omitida.`);
      continue;
    }
    rows.push({
      nombre,
      calorias: parseMacroInt(cells[1]),
      proteinas: parseMacroInt(cells[2]),
      carbs: parseMacroInt(cells[3]),
      grasas: parseMacroInt(cells[4]),
      alergias: normalizeAlergias(cells[5]),
      ingredientes_detalle: String(cells[6] || '').trim() || null,
    });
  }

  return { rows, errors };
}

/** @param {string} line */
function splitRow(line) {
  if (line.includes('\t')) return line.split('\t').map((c) => c.trim());
  if (line.includes('|')) return line.split('|').map((c) => c.trim());
  return line.split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
}

/** @param {unknown} value */
function normalizeName(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
