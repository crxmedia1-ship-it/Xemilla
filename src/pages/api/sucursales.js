import { isSuperAdminUser } from '../../config/superadmin.js';
import {
  SUCURSAL_SLUG_RE,
  SUCURSAL_SLUGS_RESERVADOS,
  slugifySucursal,
} from '../../lib/sucursales.js';
import { createSupabaseServerClient } from '../../lib/supabase/server.js';
import { getSuperAdminWriteClient } from '../../lib/superadmin.js';

export const prerender = false;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SELECT =
  'id, restaurante_id, slug, nombre, direccion, horarios, whatsapp_num, coordenadas_maps, es_principal, activo, orden';
const TEXT_FIELDS = ['direccion', 'horarios', 'whatsapp_num', 'coordenadas_maps'];

/**
 * Gestión de sedes.
 * JSON: { action: 'create' | 'update' | 'delete', ... }
 * - create (SuperAdmin): { restaurante_id, nombre, slug?, direccion?, horarios?, whatsapp_num?, coordenadas_maps? }
 * - update (gestor):     { id, nombre?, slug?, activo?, direccion?, horarios?, whatsapp_num?, coordenadas_maps? }
 * - delete (SuperAdmin): { id } — la sede principal no se puede borrar.
 * Campos de texto vacíos = heredar del restaurante.
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

  const isSuper = isSuperAdminUser(user);
  const writeClient = getSuperAdminWriteClient(supabase, user);
  const action = String(raw?.action || '');

  if (action === 'create') {
    if (!isSuper) return json({ error: 'Solo Xemilla puede crear sucursales' }, 403);
    const restauranteId = String(raw.restaurante_id ?? '').trim();
    if (!UUID_RE.test(restauranteId)) return json({ error: 'restaurante_id inválido' }, 400);
    const nombre = String(raw.nombre ?? '').trim();
    if (!nombre) return json({ error: 'El nombre es obligatorio' }, 400);
    const slug = slugifySucursal(raw.slug || nombre);
    const slugError = validateSlug(slug);
    if (slugError) return json({ error: slugError }, 400);

    const [{ data: rest }, { data: existentes }] = await Promise.all([
      writeClient
        .from('restaurantes')
        .select('gadget_sucursales, sucursales_cupo')
        .eq('id', restauranteId)
        .maybeSingle(),
      writeClient.from('sucursales').select('orden').eq('restaurante_id', restauranteId),
    ]);
    if (!rest?.gadget_sucursales) {
      return json({ error: 'Activa el gadget Sucursales en Identidad › Gadgets' }, 400);
    }
    const total = existentes?.length ?? 0;
    const cupo = Number(rest.sucursales_cupo) || 1;
    if (total >= cupo) {
      return json({ error: `Cupo completo (${total} de ${cupo} sedes). Súbelo en Identidad › Gadgets.` }, 400);
    }
    const maxOrden = Math.max(0, ...(existentes ?? []).map((s) => Number(s.orden) || 0));

    const row = { restaurante_id: restauranteId, nombre, slug, orden: maxOrden + 1 };
    Object.assign(row, readTextFields(raw));

    const { data, error } = await writeClient.from('sucursales').insert(row).select(SELECT).single();
    if (error) return dbError(error);
    return json({ ok: true, sucursal: data });
  }

  const id = String(raw?.id ?? '').trim();
  if (!UUID_RE.test(id)) return json({ error: 'id de sucursal inválido' }, 400);

  const { data: current, error: currentError } = await writeClient
    .from('sucursales')
    .select('id, es_principal')
    .eq('id', id)
    .maybeSingle();
  if (currentError || !current) return json({ error: 'Sucursal no encontrada' }, 404);

  if (action === 'delete') {
    if (!isSuper) return json({ error: 'Solo Xemilla puede eliminar sucursales' }, 403);
    if (current.es_principal) return json({ error: 'La sede principal no se puede eliminar' }, 400);
    const { error } = await writeClient.from('sucursales').delete().eq('id', id);
    if (error) return dbError(error);
    return json({ ok: true });
  }

  if (action !== 'update') return json({ error: 'Acción no soportada' }, 400);

  /** @type {Record<string, unknown>} */
  const patch = readTextFields(raw);
  if (typeof raw.nombre === 'string') {
    const nombre = raw.nombre.trim();
    if (!nombre) return json({ error: 'El nombre no puede estar vacío' }, 400);
    patch.nombre = nombre;
  }
  if (typeof raw.slug === 'string') {
    const slug = slugifySucursal(raw.slug);
    const slugError = validateSlug(slug);
    if (slugError) return json({ error: slugError }, 400);
    patch.slug = slug;
  }
  if (typeof raw.activo === 'boolean') {
    if (current.es_principal && !raw.activo) {
      return json({ error: 'La sede principal no se puede desactivar' }, 400);
    }
    patch.activo = raw.activo;
  }
  if (Object.keys(patch).length === 0) return json({ error: 'No hay campos para actualizar' }, 400);

  const { data, error } = await writeClient
    .from('sucursales')
    .update(patch)
    .eq('id', id)
    .select(SELECT)
    .maybeSingle();
  if (error) return dbError(error);
  if (!data) return json({ error: 'Sin permiso sobre esta sucursal' }, 403);
  return json({ ok: true, sucursal: data });
}

/** @param {Record<string, unknown>} raw */
function readTextFields(raw) {
  /** @type {Record<string, string | null>} */
  const out = {};
  for (const key of TEXT_FIELDS) {
    if (typeof raw[key] === 'string') out[key] = raw[key].trim() || null;
  }
  return out;
}

/** @param {string} slug */
function validateSlug(slug) {
  if (!slug || !SUCURSAL_SLUG_RE.test(slug)) return 'El enlace de la sede no es válido';
  if (SUCURSAL_SLUGS_RESERVADOS.has(slug)) return 'Ese enlace está reservado, elegí otro';
  return null;
}

/** @param {{ message?: string, code?: string }} error */
function dbError(error) {
  console.error('[api/sucursales]', error.message);
  if (error.code === '23505') return json({ error: 'Ya existe una sede con ese enlace' }, 409);
  if (/row-level security|permission/i.test(error.message || '')) {
    return json({ error: 'Sin permiso sobre esta sucursal' }, 403);
  }
  return json({ error: error.message }, 400);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
