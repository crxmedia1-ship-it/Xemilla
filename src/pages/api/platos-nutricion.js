import { isSuperAdminUser } from '../../config/superadmin.js';
import { normalizeAlergias } from '../../config/nutricion.js';
import { createSupabaseServerClient } from '../../lib/supabase/server.js';
import { createSupabaseServiceClient } from '../../lib/supabase/service.js';
import { getSuperAdminWriteClient } from '../../lib/superadmin.js';

export const prerender = false;

const NUT_COLS =
  'id, nombre, calorias, proteinas, carbs, grasas, alergias, ingredientes_detalle, disponible';

/**
 * GET ?id=123  o  GET ?restaurante_id=uuid
 * Público: solo platos disponibles (ficha de la WebApp).
 * SuperAdmin autenticado: todos los platos del restaurante.
 */
export async function GET({ request, cookies, url }) {
  const supabase = createSupabaseServerClient({ request, cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isSuper = Boolean(user && isSuperAdminUser(user));
  const service = createSupabaseServiceClient();
  const client = isSuper
    ? getSuperAdminWriteClient(supabase, user)
    : service || supabase;

  const platoId = Number(url.searchParams.get('id') || '');
  const restauranteId = String(url.searchParams.get('restaurante_id') || '').trim();

  if (Number.isFinite(platoId) && platoId > 0) {
    let query = client.from('platos').select(NUT_COLS).eq('id', platoId);
    if (!isSuper) query = query.eq('disponible', true);
    const { data, error } = await query.maybeSingle();
    if (error) return json({ error: error.message }, 400);
    if (!data) return json({ error: 'Plato no encontrado' }, 404);
    return json({ ok: true, plato: mapPlato(data) });
  }

  if (!restauranteId) {
    return json({ error: 'id o restaurante_id requerido' }, 400);
  }

  let listQuery = client.from('platos').select(NUT_COLS).eq('restaurante_id', restauranteId);
  if (!isSuper) listQuery = listQuery.eq('disponible', true);
  const { data, error } = await listQuery;
  if (error) return json({ error: error.message }, 400);

  return json({
    ok: true,
    platos: (data ?? []).map(mapPlato),
  });
}

function mapPlato(p) {
  return {
    id: p.id,
    nombre: p.nombre,
    calorias: p.calorias == null ? null : Number(p.calorias),
    proteinas: p.proteinas == null ? null : Number(p.proteinas),
    carbs: p.carbs == null ? null : Number(p.carbs),
    grasas: p.grasas == null ? null : Number(p.grasas),
    alergias: normalizeAlergias(p.alergias),
    ingredientes_detalle: p.ingredientes_detalle ?? '',
  };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
