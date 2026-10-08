import { finDelDiaOperativo } from '../../lib/sucursales.js';
import { createSupabaseServerClient } from '../../lib/supabase/server.js';
import { getSuperAdminWriteClient } from '../../lib/superadmin.js';

export const prerender = false;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Agotado de un plato en una sede concreta (el resto de sedes no cambia).
 *
 * JSON: { sucursal_id, plato_id, agotado: boolean, hasta?: 'hoy' | 'siempre' }
 * - agotado + 'hoy' (por defecto): vuelve solo al reinicio del día operativo de la sede.
 * - agotado + 'siempre': queda agotado hasta reactivarlo.
 * - agotado false: vuelve a estar disponible en la sede.
 */
export async function POST({ request, cookies }) {
  const supabase = createSupabaseServerClient({ request, cookies });
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: 'No autenticado' }, 401);

  let raw;
  try {
    raw = await request.json();
  } catch {
    return json({ error: 'Cuerpo de petición inválido' }, 400);
  }

  const sucursalId = String(raw?.sucursal_id ?? '').trim();
  const platoId = Number(raw?.plato_id);
  if (!UUID_RE.test(sucursalId)) return json({ error: 'sucursal_id inválido' }, 400);
  if (!Number.isFinite(platoId) || platoId <= 0) return json({ error: 'plato_id inválido' }, 400);
  if (typeof raw?.agotado !== 'boolean') return json({ error: 'agotado debe ser boolean' }, 400);

  const writeClient = getSuperAdminWriteClient(supabase, user);

  if (!raw.agotado) {
    const { error } = await writeClient
      .from('plato_sucursal')
      .delete()
      .eq('sucursal_id', sucursalId)
      .eq('plato_id', platoId);
    if (error) {
      console.error('[api/plato-sucursal]', error.message);
      return json({ error: error.message }, 400);
    }
    return json({ ok: true, agotado: false, agotado_hasta: null });
  }

  const { data: sucursal, error: sucError } = await writeClient
    .from('sucursales')
    .select('id, zona_horaria')
    .eq('id', sucursalId)
    .maybeSingle();
  if (sucError || !sucursal) return json({ error: 'Sucursal no encontrada' }, 404);

  const agotadoHasta =
    raw.hasta === 'siempre' ? null : finDelDiaOperativo(new Date(), sucursal.zona_horaria).toISOString();

  const { data, error } = await writeClient
    .from('plato_sucursal')
    .upsert(
      { sucursal_id: sucursalId, plato_id: platoId, agotado: true, agotado_hasta: agotadoHasta },
      { onConflict: 'sucursal_id,plato_id' },
    )
    .select('agotado, agotado_hasta')
    .maybeSingle();

  if (error) {
    console.error('[api/plato-sucursal]', error.message);
    const forbidden = /row-level security|permission/i.test(error.message || '');
    return json({ error: forbidden ? 'Sin permiso sobre esta sucursal' : error.message }, forbidden ? 403 : 400);
  }

  return json({ ok: true, agotado: true, agotado_hasta: data?.agotado_hasta ?? agotadoHasta });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
