import { isSuperAdminUser } from '../../config/superadmin.js';
import { createSupabaseServerClient } from '../../lib/supabase/server.js';
import { getSuperAdminWriteClient } from '../../lib/superadmin.js';
import {
  formatVentaMonto,
  isVentaMoneda,
  isVentaProducto,
  readVentaMonto,
  ventaProductoLabel,
} from '../../lib/ventas.js';

export const prerender = false;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * SuperAdmin: lo que un restaurante ya pagó.
 * POST { restauranteId, producto, monto, moneda }
 * DELETE { id }
 */
export async function POST({ request, cookies }) {
  const gate = await requireGate(request, cookies);
  if (gate.error) return gate.error;

  /** @type {Record<string, unknown>} */
  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const restauranteId = String(body.restauranteId || '').trim();
  const producto = String(body.producto || '').trim();
  const moneda = String(body.moneda || '').trim();
  const monto = readVentaMonto(body.monto);
  if (!UUID_RE.test(restauranteId)) return json({ error: 'Restaurante inválido' }, 400);
  if (!isVentaProducto(producto)) return json({ error: 'Elegí un producto' }, 400);
  if (!isVentaMoneda(moneda)) return json({ error: 'Elegí USD o Bs' }, 400);
  if (!monto) return json({ error: 'El monto tiene que ser mayor que cero' }, 400);

  const { data, error } = await gate.client
    .from('restaurante_ventas')
    .insert({
      restaurante_id: restauranteId,
      producto,
      monto,
      moneda,
    })
    .select('id, restaurante_id, producto, monto, moneda, created_at')
    .maybeSingle();

  if (error) {
    console.error('[api/restaurante-ventas]', error.message);
    return json({ error: 'No se pudo guardar la venta' }, 400);
  }
  if (!data) return json({ error: 'No se pudo guardar la venta' }, 400);

  return json({
    ok: true,
    venta: {
      ...data,
      label: ventaProductoLabel(data.producto),
      texto: formatVentaMonto(data.monto, data.moneda),
    },
  });
}

export async function DELETE({ request, cookies }) {
  const gate = await requireGate(request, cookies);
  if (gate.error) return gate.error;

  /** @type {Record<string, unknown>} */
  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const id = String(body.id || '').trim();
  if (!UUID_RE.test(id)) return json({ error: 'Venta inválida' }, 400);

  const { error } = await gate.client.from('restaurante_ventas').delete().eq('id', id);
  if (error) {
    console.error('[api/restaurante-ventas]', error.message);
    return json({ error: 'No se pudo quitar la venta' }, 400);
  }

  return json({ ok: true });
}

/**
 * @param {Request} request
 * @param {import('astro').AstroCookies} cookies
 */
async function requireGate(request, cookies) {
  const supabase = createSupabaseServerClient({ request, cookies });
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: json({ error: 'No autenticado' }, 401) };
  if (!isSuperAdminUser(user)) return { error: json({ error: 'Solo SuperAdmin' }, 403) };
  return { client: getSuperAdminWriteClient(supabase, user) };
}

/**
 * @param {unknown} body
 * @param {number} [status]
 */
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
