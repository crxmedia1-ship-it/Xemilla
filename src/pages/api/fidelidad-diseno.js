import { getAdminDashboardData } from '../../lib/admin.js';
import { readFidelidadDiseno, readFidelidadReglas } from '../../lib/fidelidad.js';
import { createSupabaseServiceClient } from '../../lib/supabase/service.js';

export const prerender = false;

/**
 * El local guarda el diseño y las reglas de su tarjeta.
 * PUT { restaurante, titulo, fondo, tinta, acento, puntos, meta, premio, activo? }
 */
export async function PUT({ request, cookies }) {
  /** @type {Record<string, unknown>} */
  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const token = String(body.restaurante || '').trim();
  const session = await getAdminDashboardData(
    { request, cookies },
    { restauranteId: token, slug: token },
  );
  if (!session?.restaurante?.id) return json({ error: 'No autenticado' }, 401);

  const client = createSupabaseServiceClient();
  if (!client) return json({ error: 'No se pudo guardar el diseño.' }, 500);

  const diseno = readFidelidadDiseno(body);
  const reglas = readFidelidadReglas({
    fidelidad_puntos: body.puntos,
    fidelidad_meta: body.meta,
    fidelidad_premio: body.premio,
  });

  /** @type {Record<string, unknown>} */
  const patch = {
    fidelidad_diseno: diseno,
    fidelidad_puntos: reglas.puntos,
    fidelidad_meta: reglas.meta,
    fidelidad_premio: reglas.premio,
  };
  if (body.activo !== undefined && session.isSuperAdmin) {
    patch.gadget_fidelidad = body.activo === true;
  }

  const { data, error } = await client
    .from('restaurantes')
    .update(patch)
    .eq('id', session.restaurante.id)
    .select('gadget_fidelidad, fidelidad_diseno, fidelidad_puntos, fidelidad_meta, fidelidad_premio')
    .maybeSingle();

  if (error || !data) {
    console.error('[fidelidad] diseño:', error?.message);
    return json({ error: 'No se pudo guardar el diseño.' }, 400);
  }

  return json({
    ok: true,
    activo: Boolean(data.gadget_fidelidad),
    diseno: readFidelidadDiseno(data.fidelidad_diseno),
    reglas: readFidelidadReglas(data),
  });
}

/**
 * @param {unknown} body
 * @param {number} [status]
 */
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
