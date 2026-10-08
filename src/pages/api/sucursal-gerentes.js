import {
  ADMIN_ROLE_GERENTE,
  getAssignedRestauranteId,
  isGerenteSedeUser,
  isSuperAdminUser,
} from '../../config/superadmin.js';
import { createSupabaseServerClient } from '../../lib/supabase/server.js';
import { createSupabaseServiceClient } from '../../lib/supabase/service.js';

export const prerender = false;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * SuperAdmin: gerentes de sede (solo agotan platos en su sucursal).
 * JSON:
 * - { action: 'create', sucursal_id, email, password } — crea la cuenta o reasigna un gerente existente.
 * - { action: 'delete', user_id } — borra la cuenta del gerente.
 */
export async function POST({ request, cookies }) {
  const supabase = createSupabaseServerClient({ request, cookies });
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: 'No autenticado' }, 401);
  if (!isSuperAdminUser(user)) return json({ error: 'Solo Xemilla puede gestionar gerentes' }, 403);

  const service = createSupabaseServiceClient();
  if (!service) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurada' }, 503);

  let raw;
  try {
    raw = await request.json();
  } catch {
    return json({ error: 'Cuerpo de petición inválido' }, 400);
  }

  const action = String(raw?.action || '');
  if (action === 'create') return createGerente(service, raw);
  if (action === 'delete') return deleteGerente(service, raw);
  return json({ error: 'Acción desconocida' }, 400);
}

async function createGerente(service, raw) {
  const sucursalId = String(raw.sucursal_id ?? '').trim();
  const email = String(raw.email ?? '').trim().toLowerCase();
  const password = String(raw.password ?? '');
  if (!UUID_RE.test(sucursalId)) return json({ error: 'sucursal_id inválido' }, 400);
  if (!email.includes('@')) return json({ error: 'Email inválido' }, 400);
  if (password.length < 8) return json({ error: 'La contraseña debe tener al menos 8 caracteres' }, 400);

  const { data: sucursal } = await service
    .from('sucursales')
    .select('id, nombre, restaurante_id, restaurantes(gadget_sucursales)')
    .eq('id', sucursalId)
    .maybeSingle();
  if (!sucursal) return json({ error: 'Sucursal no encontrada' }, 404);
  if (!sucursal.restaurantes?.gadget_sucursales) {
    return json({ error: 'Activa el gadget Sucursales en Identidad › Gadgets' }, 400);
  }

  const meta = { role: ADMIN_ROLE_GERENTE, sucursal_id: sucursalId };
  let gerente = null;

  const { data: created, error: createErr } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: meta,
    user_metadata: meta,
  });

  if (created?.user) {
    gerente = created.user;
  } else {
    const exists = /already.*(registered|been)|exists|duplicate/i.test(createErr?.message || '') || createErr?.status === 422;
    if (!exists) return json({ error: createErr?.message || 'No se pudo crear el usuario' }, 400);

    const listed = await findUserByEmail(service, email);
    if (!listed) return json({ error: 'Ese email ya existe pero no se pudo localizar. Prueba otro.' }, 409);
    // Solo se reasignan cuentas que ya son gerentes: un admin con restaurante_id perdería su acceso.
    if (!isGerenteSedeUser(listed) || getAssignedRestauranteId(listed)) {
      return json({ error: `${email} ya tiene otra cuenta en Xemilla. Usa un email distinto para el gerente.` }, 409);
    }
    const { data: updated, error: updErr } = await service.auth.admin.updateUserById(listed.id, {
      password,
      app_metadata: { ...listed.app_metadata, ...meta },
      user_metadata: { ...listed.user_metadata, ...meta },
    });
    if (updErr || !updated?.user) return json({ error: updErr?.message || 'No se pudo actualizar la cuenta' }, 400);
    gerente = updated.user;
  }

  const row = {
    user_id: gerente.id,
    sucursal_id: sucursalId,
    restaurante_id: sucursal.restaurante_id,
    email,
  };
  const { error: linkErr } = await service.from('sucursal_gerentes').upsert(row, { onConflict: 'user_id' });
  if (linkErr) {
    console.error('[api/sucursal-gerentes] link:', linkErr.message);
    return json({ error: `Cuenta creada pero no se pudo asignar a la sede: ${linkErr.message}` }, 500);
  }

  return json({ ok: true, gerente: { user_id: row.user_id, email, sucursal_id: sucursalId } });
}

async function deleteGerente(service, raw) {
  const userId = String(raw.user_id ?? '').trim();
  if (!UUID_RE.test(userId)) return json({ error: 'user_id inválido' }, 400);

  const { data: target } = await service.auth.admin.getUserById(userId);
  if (target?.user && !isGerenteSedeUser(target.user)) {
    return json({ error: 'Esa cuenta no es de un gerente de sede' }, 400);
  }

  await service.from('sucursal_gerentes').delete().eq('user_id', userId);
  if (target?.user) {
    const { error } = await service.auth.admin.deleteUser(userId);
    if (error) console.error('[api/sucursal-gerentes] deleteUser:', error.message);
  }
  return json({ ok: true });
}

async function findUserByEmail(service, email) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return null;
    const found = (data?.users ?? []).find((u) => String(u.email || '').toLowerCase() === email);
    if (found) return found;
    if ((data?.users?.length ?? 0) < 200) break;
  }
  return null;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
