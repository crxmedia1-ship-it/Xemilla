import { isSuperAdminUser, getAssignedRestauranteId } from '../../../config/superadmin.js';
import { createSupabaseServerClient } from '../../../lib/supabase/server.js';
import { createSupabaseServiceClient } from '../../../lib/supabase/service.js';

export const prerender = false;

const ESTADOS = new Set(['pendiente', 'preparando', 'listo', 'cancelado']);

/**
 * Actualiza el estado de un pedido (cocina / barra).
 * POST { restaurante_id, pedido_id, estado }
 */
export async function POST({ request, cookies }) {
  const supabase = createSupabaseServerClient({ request, cookies });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: 'No autenticado' }, 401);

  let raw = {};
  try { raw = await request.json(); } catch { return json({ error: 'Body inválido' }, 400); }

  const restauranteId = String(raw.restaurante_id ?? '').trim();
  const pedidoId = String(raw.pedido_id ?? '').trim();
  const estado = String(raw.estado ?? '').trim().toLowerCase();

  if (!restauranteId || !pedidoId) return json({ error: 'restaurante_id y pedido_id requeridos' }, 400);
  if (!ESTADOS.has(estado)) return json({ error: 'estado inválido' }, 400);

  const isSuper = isSuperAdminUser(user);
  if (!isSuper) {
    const assigned = getAssignedRestauranteId(user);
    if (!assigned || assigned !== restauranteId) return json({ error: 'Sin permiso' }, 403);
  }

  const service = createSupabaseServiceClient() ?? supabase;

  const { error } = await service
    .from('pedidos_live')
    .update({ estado })
    .eq('id', pedidoId)
    .eq('restaurante_id', restauranteId);

  if (error) return json({ error: error.message }, 400);

  return json({ ok: true });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
