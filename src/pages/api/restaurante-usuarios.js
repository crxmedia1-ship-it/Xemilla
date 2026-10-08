import {
  getAssignedRestauranteId,
  isGerenteSedeUser,
  isSuperAdminUser,
} from '../../config/superadmin.js';
import { createSupabaseServerClient } from '../../lib/supabase/server.js';
import { createSupabaseServiceClient } from '../../lib/supabase/service.js';

export const prerender = false;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Suspensión = baneo largo de GoTrue (~100 años); 'none' lo levanta. */
const BAN_SUSPENDIDO = '876000h';

/**
 * SuperAdmin: usuarios con acceso a un restaurante (admins del local y gerentes de sede).
 * GET  ?restaurante_id=…
 * POST { restaurante_id, user_id, action: 'suspend' | 'activate' | 'password' | 'delete', password? }
 */
export async function GET({ request, cookies, url }) {
  const ctx = await authorize({ request, cookies });
  if (ctx.error) return ctx.error;

  const rest = await loadRestaurante(ctx.service, url.searchParams.get('restaurante_id'));
  if (!rest) return json({ error: 'Restaurante no encontrado' }, 404);

  const [usuarios, { data: sedes }] = await Promise.all([
    listUsuarios(ctx.service, rest),
    ctx.service
      .from('sucursales')
      .select('id, nombre, es_principal')
      .eq('restaurante_id', rest.id)
      .eq('activo', true)
      .order('es_principal', { ascending: false })
      .order('orden', { ascending: true }),
  ]);
  return json({
    ok: true,
    usuarios,
    gadget_sucursales: rest.gadget_sucursales === true,
    sedes: sedes ?? [],
  });
}

export async function POST({ request, cookies }) {
  const ctx = await authorize({ request, cookies });
  if (ctx.error) return ctx.error;

  let raw;
  try {
    raw = await request.json();
  } catch {
    return json({ error: 'Cuerpo de petición inválido' }, 400);
  }

  const rest = await loadRestaurante(ctx.service, raw?.restaurante_id);
  if (!rest) return json({ error: 'Restaurante no encontrado' }, 404);
  const userId = String(raw?.user_id ?? '').trim();
  if (!UUID_RE.test(userId)) return json({ error: 'user_id inválido' }, 400);

  // Solo se actúa sobre cuentas que pertenecen a este restaurante.
  const usuario = (await listUsuarios(ctx.service, rest)).find((u) => u.id === userId);
  if (!usuario) return json({ error: 'Ese usuario no pertenece a este restaurante' }, 404);

  const action = String(raw?.action || '');
  const { auth } = ctx.service;

  if (action === 'suspend' || action === 'activate') {
    const { error } = await auth.admin.updateUserById(userId, {
      ban_duration: action === 'suspend' ? BAN_SUSPENDIDO : 'none',
    });
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true, suspendido: action === 'suspend' });
  }

  if (action === 'password') {
    const password = String(raw?.password ?? '');
    if (password.length < 8) return json({ error: 'La contraseña debe tener al menos 8 caracteres' }, 400);
    const { error } = await auth.admin.updateUserById(userId, { password });
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  if (action === 'delete') {
    if (rest.user_id === userId) {
      const { error: unlinkErr } = await ctx.service
        .from('restaurantes')
        .update({ user_id: ctx.user.id })
        .eq('id', rest.id);
      if (unlinkErr) return json({ error: `No se pudo desvincular: ${unlinkErr.message}` }, 500);
    }
    const { error } = await auth.admin.deleteUser(userId);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  return json({ error: 'Acción desconocida' }, 400);
}

async function authorize({ request, cookies }) {
  const supabase = createSupabaseServerClient({ request, cookies });
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: json({ error: 'No autenticado' }, 401) };
  if (!isSuperAdminUser(user)) return { error: json({ error: 'Solo Xemilla puede gestionar usuarios' }, 403) };
  const service = createSupabaseServiceClient();
  if (!service) return { error: json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurada' }, 503) };
  return { user, service };
}

async function loadRestaurante(service, rawId) {
  const id = String(rawId ?? '').trim();
  if (!UUID_RE.test(id)) return null;
  const { data } = await service.from('restaurantes').select('id, slug, user_id, gadget_sucursales').eq('id', id).maybeSingle();
  return data ?? null;
}

async function listUsuarios(service, rest) {
  const [users, { data: gerentes }] = await Promise.all([
    listAllUsers(service),
    service
      .from('sucursal_gerentes')
      .select('user_id, sucursales(nombre)')
      .eq('restaurante_id', rest.id),
  ]);
  const sedePorGerente = new Map((gerentes ?? []).map((g) => [g.user_id, g.sucursales?.nombre ?? 'Sede']));
  const claves = new Set([String(rest.id), String(rest.slug || '')].filter(Boolean));
  const now = Date.now();

  return users
    .filter((u) => !isSuperAdminUser(u))
    .filter((u) => sedePorGerente.has(u.id) || u.id === rest.user_id || claves.has(String(getAssignedRestauranteId(u) || '')))
    .map((u) => {
      const gerente = sedePorGerente.has(u.id) || isGerenteSedeUser(u);
      return {
        id: u.id,
        email: u.email ?? '',
        rol: gerente ? 'gerente' : 'admin',
        sede: sedePorGerente.get(u.id) ?? null,
        suspendido: Boolean(u.banned_until && new Date(u.banned_until).getTime() > now),
        ultimo_ingreso: u.last_sign_in_at ?? null,
        creado: u.created_at ?? null,
      };
    })
    .sort((a, b) => (a.rol === b.rol ? a.email.localeCompare(b.email) : a.rol === 'admin' ? -1 : 1));
}

async function listAllUsers(service) {
  const all = [];
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    const batch = data?.users ?? [];
    all.push(...batch);
    if (batch.length < 200) break;
  }
  return all;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
