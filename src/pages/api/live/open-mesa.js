import { isSuperAdminUser, getAssignedRestauranteId } from '../../../config/superadmin.js';
import { createSupabaseServerClient } from '../../../lib/supabase/server.js';
import { createSupabaseServiceClient } from '../../../lib/supabase/service.js';

export const prerender = false;

/**
 * Abre una sesión de mesa generando un PIN dinámico de 4 dígitos.
 * POST { restaurante_id, mesa_numero }
 * → { ok, sesion_id, pin, mesa_numero }
 */
export async function POST({ request, cookies }) {
  const supabase = createSupabaseServerClient({ request, cookies });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: 'No autenticado' }, 401);

  let raw = {};
  try { raw = await request.json(); } catch { return json({ error: 'Body inválido' }, 400); }

  const restauranteId = String(raw.restaurante_id ?? '').trim();
  const mesaNumero = parseInt(String(raw.mesa_numero ?? '0'), 10);

  if (!restauranteId) return json({ error: 'restaurante_id requerido' }, 400);
  if (!mesaNumero || mesaNumero < 1) return json({ error: 'mesa_numero inválido' }, 400);

  const isSuper = isSuperAdminUser(user);
  if (!isSuper) {
    const assigned = getAssignedRestauranteId(user);
    if (!assigned || assigned !== restauranteId) return json({ error: 'Sin permiso' }, 403);
  }

  const service = createSupabaseServiceClient() ?? supabase;

  // Cerrar cualquier sesión activa previa de esta mesa
  await service
    .from('sesiones_mesa')
    .update({ estado: 'finalizada', closed_at: new Date().toISOString() })
    .eq('restaurante_id', restauranteId)
    .eq('mesa_numero', mesaNumero)
    .eq('estado', 'activa');

  const pin = String(Math.floor(Math.random() * 9000) + 1000);

  const { data, error } = await service
    .from('sesiones_mesa')
    .insert({ restaurante_id: restauranteId, mesa_numero: mesaNumero, pin, estado: 'activa' })
    .select('id, pin, mesa_numero')
    .maybeSingle();

  if (error) return json({ error: error.message }, 400);

  return json({ ok: true, sesion_id: data.id, pin: data.pin, mesa_numero: data.mesa_numero });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
