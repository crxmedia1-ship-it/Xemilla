import {
  getAssignedRestauranteId,
  isSuperAdminUser,
} from '../../config/superadmin.js';
import { createSupabaseServerClient } from '../../lib/supabase/server.js';
import { getSuperAdminWriteClient } from '../../lib/superadmin.js';

export const prerender = false;

/**
 * Batch-update visual order for menu categories or dishes.
 *
 * Body JSON: {
 *   tipo: 'categorias' | 'platos',
 *   restaurante_id: string,
 *   items: Array<{ id: number|string, orden: number }>
 * }
 */
export async function POST({ request, cookies }) {
  const supabase = createSupabaseServerClient({ request, cookies });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return json({ error: 'No autenticado' }, 401);
  }

  /** @type {Record<string, unknown>} */
  let raw = {};
  try {
    raw = await request.json();
  } catch {
    return json({ error: 'Cuerpo de petición inválido' }, 400);
  }

  const tipo = String(raw.tipo ?? '').trim().toLowerCase();
  if (tipo !== 'categorias' && tipo !== 'platos') {
    return json({ error: 'tipo debe ser "categorias" o "platos"' }, 400);
  }

  const restauranteId = String(raw.restaurante_id ?? '').trim();
  if (!restauranteId) {
    return json({ error: 'restaurante_id requerido' }, 400);
  }

  const isSuper = isSuperAdminUser(user);
  if (!isSuper) {
    const assigned = getAssignedRestauranteId(user);
    if (!assigned || assigned !== restauranteId) {
      return json({ error: 'Sin permiso para este restaurante' }, 403);
    }
  }

  const itemsRaw = Array.isArray(raw.items) ? raw.items : [];
  /** @type {Array<{ id: number, orden: number }>} */
  const items = [];
  for (const entry of itemsRaw) {
    if (!entry || typeof entry !== 'object') continue;
    const id = Number(/** @type {{ id?: unknown }} */ (entry).id);
    const orden = Number(/** @type {{ orden?: unknown }} */ (entry).orden);
    if (!Number.isFinite(id) || id <= 0) continue;
    if (!Number.isFinite(orden) || orden < 0) continue;
    items.push({ id: Math.trunc(id), orden: Math.trunc(orden) });
  }

  if (items.length === 0) {
    return json({ error: 'items vacío o inválido' }, 400);
  }

  const writeClient = getSuperAdminWriteClient(supabase, user);
  const table = tipo === 'categorias' ? 'categorias' : 'platos';

  const results = await Promise.all(
    items.map(async ({ id, orden }) => {
      const { data, error } = await writeClient
        .from(table)
        .update({ orden })
        .eq('id', id)
        .eq('restaurante_id', restauranteId)
        .select('id, orden')
        .maybeSingle();

      if (error) {
        return { id, error: error.message };
      }
      if (!data) {
        return { id, error: 'No encontrado o sin permiso' };
      }
      return { id: data.id, orden: data.orden };
    }),
  );

  const failures = results.filter((r) => r.error);
  if (failures.length > 0) {
    const first = failures[0];
    console.error('[api/update-menu-orden]', tipo, first?.error, {
      failed: failures.length,
      total: items.length,
    });
    return json(
      {
        error: first?.error || 'Error al guardar orden',
        failed: failures.length,
        updated: results.length - failures.length,
      },
      400,
    );
  }

  return json({
    ok: true,
    tipo,
    updated: results.length,
  });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
