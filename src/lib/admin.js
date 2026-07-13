import { isSuperAdminUser } from '../config/superadmin.js';
import { createSupabaseServerClient } from './supabase/server.js';
import { getSuperAdminWriteClient } from './superadmin.js';

/**
 * Valida la sesión y carga restaurante + platos del dashboard.
 * SuperAdmin puede pasar `restauranteId` para gestionar cualquier local.
 *
 * @param {{ request: Request, cookies: import('astro').AstroCookies }} ctx
 * @param {{ restauranteId?: string | null }} [opts]
 * @returns {Promise<{
 *   user: object,
 *   restaurante: object | null,
 *   platos: object[],
 *   isSuperAdmin: boolean,
 *   managingAsSuperAdmin: boolean,
 * } | null>}
 */
export async function getAdminDashboardData(ctx, opts = {}) {
  const supabase = createSupabaseServerClient(ctx);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return null;

  const isSuper = isSuperAdminUser(user);
  const restauranteId = opts.restauranteId?.trim() || null;

  /** @type {object | null} */
  let restaurante = null;

  if (isSuper && restauranteId) {
    const { data, error } = await supabase
      .from('restaurantes')
      .select('id, nombre_comercial, slug')
      .eq('id', restauranteId)
      .maybeSingle();

    if (error) {
      console.error('[admin] restaurante (super):', error.message);
    }
    restaurante = data ?? null;
  } else {
    const { data, error: restError } = await supabase
      .from('restaurantes')
      .select('id, nombre_comercial, slug')
      .eq('user_id', user.id)
      .maybeSingle();

    if (restError) {
      console.error('[admin] restaurante:', restError.message);
    }
    restaurante = data ?? null;
  }

  if (!restaurante) {
    return {
      user,
      restaurante: null,
      platos: [],
      isSuperAdmin: isSuper,
      managingAsSuperAdmin: Boolean(isSuper && restauranteId),
    };
  }

  const readClient = isSuper ? getSuperAdminWriteClient(supabase, user) : supabase;

  const { data: platos, error: platosError } = await readClient
    .from('platos')
    .select('id, nombre, descripcion, precio, disponible, categoria_id')
    .eq('restaurante_id', restaurante.id)
    .order('categoria_id', { ascending: true })
    .order('id', { ascending: true });

  if (platosError) {
    console.error('[admin] platos:', platosError.message);
    return {
      user,
      restaurante,
      platos: [],
      isSuperAdmin: isSuper,
      managingAsSuperAdmin: Boolean(isSuper && restauranteId),
    };
  }

  return {
    user,
    restaurante,
    platos: (platos ?? []).map((p) => ({
      ...p,
      precio: Number(p.precio),
    })),
    isSuperAdmin: isSuper,
    managingAsSuperAdmin: Boolean(isSuper && restauranteId),
  };
}

/**
 * Cierra la sesión del administrador.
 * @param {{ request: Request, cookies: import('astro').AstroCookies }} ctx
 */
export async function signOutAdmin(ctx) {
  const supabase = createSupabaseServerClient(ctx);
  await supabase.auth.signOut();
}
