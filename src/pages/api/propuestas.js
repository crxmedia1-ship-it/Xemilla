import { isSuperAdminUser } from '../../config/superadmin.js';
import {
  createPropuesta,
  deletePropuesta,
  isPropuestaId,
} from '../../lib/propuestas.js';
import { createSupabaseServerClient } from '../../lib/supabase/server.js';
import { getSuperAdminWriteClient } from '../../lib/superadmin.js';

export const prerender = false;

/**
 * SuperAdmin: crea o borra un enlace de propuesta.
 * POST { nombre, logoUrl, setup, anual, sinPrecio, mundo }
 * DELETE { id }
 */
export async function POST({ request, cookies }) {
  const gate = await gateSuperAdmin({ request, cookies });
  if (gate.error) return json({ error: gate.error }, gate.status);

  /** @type {Record<string, unknown>} */
  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const result = await createPropuesta(gate.client, {
    nombre: String(body.nombre || ''),
    logoUrl: String(body.logoUrl || ''),
    setup: String(body.setup || ''),
    anual: String(body.anual || ''),
    sinPrecio: body.sinPrecio === true,
    mundo: String(body.mundo || ''),
  });

  if (result.error || !result.data) return json({ error: result.error || 'No se pudo crear' }, 400);

  return json({
    ok: true,
    id: result.data.id,
    href: `/propuesta?p=${result.data.id}`,
  });
}

export async function DELETE({ request, cookies }) {
  const gate = await gateSuperAdmin({ request, cookies });
  if (gate.error) return json({ error: gate.error }, gate.status);

  /** @type {Record<string, unknown>} */
  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const id = String(body.id || '').trim();
  if (!isPropuestaId(id)) return json({ error: 'Propuesta inválida' }, 400);

  const result = await deletePropuesta(gate.client, id);
  if (result.error) return json({ error: result.error }, 400);
  return json({ ok: true });
}

/**
 * @param {{ request: Request, cookies: import('astro').AstroCookies }} ctx
 */
async function gateSuperAdmin(ctx) {
  const supabase = createSupabaseServerClient(ctx);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return { error: 'No autenticado', status: 401 };
  if (!isSuperAdminUser(user)) return { error: 'Solo SuperAdmin', status: 403 };

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
