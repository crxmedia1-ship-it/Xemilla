import { isSuperAdminUser, ADMIN_ROLE_OPERATIVO } from '../../../config/superadmin.js';
import { createSupabaseServerClient } from '../../../lib/supabase/server.js';
import { createSupabaseServiceClient } from '../../../lib/supabase/service.js';

export const prerender = false;

/**
 * SuperAdmin: crea (o reasigna) un Auth user como Admin Operativo
 * de un restaurante concreto.
 *
 * Body JSON: { email, password, restaurante_id }
 */
export async function POST({ request, cookies }) {
  const supabase = createSupabaseServerClient({ request, cookies });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return json({ error: 'No autenticado' }, 401);
  }

  if (!isSuperAdminUser(user)) {
    return json({ error: 'Solo SuperAdmin puede crear credenciales operativas' }, 403);
  }

  /** @type {Record<string, unknown>} */
  let raw = {};
  try {
    raw = await request.json();
  } catch {
    return json({ error: 'Cuerpo inválido' }, 400);
  }

  const email = String(raw.email ?? '')
    .trim()
    .toLowerCase();
  const password = String(raw.password ?? '');
  const restauranteId = String(raw.restaurante_id ?? '').trim();

  if (!email || !email.includes('@')) {
    return json({ error: 'Email inválido' }, 400);
  }
  if (password.length < 8) {
    return json({ error: 'La contraseña debe tener al menos 8 caracteres' }, 400);
  }
  if (!restauranteId) {
    return json({ error: 'restaurante_id requerido' }, 400);
  }

  const service = createSupabaseServiceClient();
  if (!service) {
    return json(
      {
        error:
          'SUPABASE_SERVICE_ROLE_KEY no configurada. No se pueden crear usuarios Auth.',
      },
      503,
    );
  }

  const { data: restRow, error: restErr } = await service
    .from('restaurantes')
    .select('id, nombre_comercial')
    .eq('id', restauranteId)
    .maybeSingle();

  if (restErr || !restRow) {
    return json({ error: 'Restaurante no encontrado' }, 404);
  }

  // Canonical UUID from DB — must match keys read by getAssignedRestauranteId
  const canonicalRestId = String(restRow.id);
  const meta = {
    role: ADMIN_ROLE_OPERATIVO,
    restaurante_id: canonicalRestId,
  };

  const { data: created, error: createErr } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: meta,
    app_metadata: meta,
  });

  let operativoUser = created?.user ?? null;
  let reused = false;

  if (createErr) {
    const alreadyExists =
      /already.*(registered|been)|exists|duplicate/i.test(createErr.message || '') ||
      createErr.status === 422;

    if (!alreadyExists) {
      console.error('[api/create-operativo] createUser:', createErr.message);
      return json({ error: createErr.message || 'No se pudo crear el usuario' }, 400);
    }

    reused = true;
    // Usuario existente: buscar y actualizar metadata + password
    const listed = await findUserByEmail(service, email);
    if (!listed) {
      return json(
        {
          error:
            'Ese email ya existe pero no se pudo localizar para reasignar. Probá otro email.',
        },
        409,
      );
    }

    const { data: updated, error: updErr } = await service.auth.admin.updateUserById(
      listed.id,
      {
        password,
        user_metadata: { ...listed.user_metadata, ...meta },
        app_metadata: { ...listed.app_metadata, ...meta },
      },
    );

    if (updErr || !updated?.user) {
      console.error('[api/create-operativo] updateUser:', updErr?.message);
      return json(
        { error: updErr?.message || 'No se pudo actualizar el usuario existente' },
        400,
      );
    }
    operativoUser = updated.user;
  } else if (operativoUser?.id) {
    // Refuerzo: algunos GoTrue omiten app_metadata en createUser; forzar ambas capas
    const { data: reinforced, error: reinErr } =
      await service.auth.admin.updateUserById(operativoUser.id, {
        user_metadata: { ...operativoUser.user_metadata, ...meta },
        app_metadata: { ...operativoUser.app_metadata, ...meta },
      });
    if (reinErr) {
      console.warn('[api/create-operativo] reinforce metadata:', reinErr.message);
    } else if (reinforced?.user) {
      operativoUser = reinforced.user;
    }
  }

  if (!operativoUser?.id) {
    return json({ error: 'Usuario Auth no disponible tras el alta' }, 500);
  }

  // Vincula dueño RLS (operativo escribe menú; SuperAdmin sigue vía service role)
  const { error: linkErr } = await service
    .from('restaurantes')
    .update({ user_id: operativoUser.id })
    .eq('id', canonicalRestId);

  if (linkErr) {
    console.error('[api/create-operativo] link user_id:', linkErr.message);
    return json(
      {
        error: `Usuario creado pero no se pudo vincular al restaurante: ${linkErr.message}`,
        user_id: operativoUser.id,
      },
      500,
    );
  }

  return json({
    ok: true,
    user_id: operativoUser.id,
    email: operativoUser.email,
    restaurante_id: canonicalRestId,
    restaurante: restRow.nombre_comercial,
    role: ADMIN_ROLE_OPERATIVO,
    reused,
  });
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} service
 * @param {string} email
 */
async function findUserByEmail(service, email) {
  const target = email.toLowerCase();
  // listUsers es paginado; buscamos las primeras páginas (hubs pequeños)
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await service.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) {
      console.error('[api/create-operativo] listUsers:', error.message);
      return null;
    }
    const found = (data?.users ?? []).find(
      (u) => String(u.email || '').toLowerCase() === target,
    );
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
