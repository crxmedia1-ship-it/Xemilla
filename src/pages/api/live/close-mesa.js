import { isSuperAdminUser, getAssignedRestauranteId } from '../../../config/superadmin.js';
import { createSupabaseServerClient } from '../../../lib/supabase/server.js';
import { createSupabaseServiceClient } from '../../../lib/supabase/service.js';

export const prerender = false;

/**
 * Cierra una sesión de mesa activa.
 * POST { restaurante_id, sesion_id }
 * → { ok }
 */
export async function POST({ request, cookies }) {
  const supabase = createSupabaseServerClient({ request, cookies });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: 'No autenticado' }, 401);

  let raw = {};
  try { raw = await request.json(); } catch { return json({ error: 'Body inválido' }, 400); }

  const restauranteId = String(raw.restaurante_id ?? '').trim();
  const sesionId = String(raw.sesion_id ?? '').trim();

  if (!restauranteId || !sesionId) return json({ error: 'restaurante_id y sesion_id requeridos' }, 400);

  const isSuper = isSuperAdminUser(user);
  if (!isSuper) {
    const assigned = getAssignedRestauranteId(user);
    if (!assigned || assigned !== restauranteId) return json({ error: 'Sin permiso' }, 403);
  }

  const service = createSupabaseServiceClient() ?? supabase;

  const { error } = await service
    .from('sesiones_mesa')
    .update({ estado: 'finalizada', closed_at: new Date().toISOString() })
    .eq('id', sesionId)
    .eq('restaurante_id', restauranteId)
    .eq('estado', 'activa');

  if (error) return json({ error: error.message }, 400);

  return json({ ok: true });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
