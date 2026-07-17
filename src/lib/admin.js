import { isSuperAdminUser } from '../config/superadmin.js';
import { createSupabaseServerClient } from './supabase/server.js';
import { getSuperAdminWriteClient } from './superadmin.js';

const RESTAURANTE_ADMIN_SELECT = [
  'id',
  'nombre_comercial',
  'slug',
  'whatsapp_num',
  'color_primario',
  'color_fondo',
  'color_texto',
  'tipo_letra',
  'estilo_adn',
  'menu_font',
  'imagen_fondo',
  'custom_css',
  'direccion',
  'horarios',
  'instagram_url',
  'whatsapp_url',
  'coordenadas_maps',
  'nosotros_subtitulo',
  'nosotros_titulo',
  'nosotros_imagen',
  'nosotros_texto',
  'gadget_wifi',
  'gadget_wifi_ssid',
  'gadget_wifi_clave',
  'gadget_mesero',
  'gadget_cuenta',
  'gadget_dividir_cuenta',
  'gadget_reservas',
  'gadget_llamar_mesero',
  'gadget_boutique',
  'config_wifi',
  'config_reservas',
  'config_boutique',
  'logo_url',
  'eslogan',
  'secciones_fondo',
  'nosotros_bloques',
  'redes_sociales',
  'share_image_url',
  'app_icon_url',
  'ui_estilo',
].join(', ');

/** SELECT mínimo si faltan columnas nuevas en Supabase. */
const RESTAURANTE_ADMIN_SELECT_BASE = [
  'id',
  'nombre_comercial',
  'slug',
  'whatsapp_num',
  'color_primario',
  'color_fondo',
  'color_texto',
  'tipo_letra',
  'estilo_adn',
  'imagen_fondo',
  'custom_css',
  'direccion',
  'horarios',
  'instagram_url',
  'whatsapp_url',
  'coordenadas_maps',
  'nosotros_subtitulo',
  'nosotros_titulo',
  'nosotros_imagen',
  'nosotros_texto',
  'gadget_wifi',
  'gadget_dividir_cuenta',
  'gadget_reservas',
  'gadget_llamar_mesero',
  'config_wifi',
  'config_reservas',
  'logo_url',
  'eslogan',
  'secciones_fondo',
].join(', ');

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {{ id?: string | null, slug?: string | null, userId?: string | null }} filter
 */
async function fetchRestauranteAdmin(client, filter) {
  const run = async (columns) => {
    let q = client.from('restaurantes').select(columns);
    if (filter.id) q = q.eq('id', filter.id);
    else if (filter.slug) q = q.eq('slug', filter.slug);
    else if (filter.userId) q = q.eq('user_id', filter.userId);
    else return { data: null, error: { message: 'Filtro de restaurante vacío' } };
    return q.maybeSingle();
  };

  const full = await run(RESTAURANTE_ADMIN_SELECT);
  if (!full.error) return full.data ?? null;

  const missingColumn = /column|does not exist|schema cache/i.test(full.error.message || '');
  if (!missingColumn) {
    console.error('[admin] restaurante:', full.error.message);
    return null;
  }

  console.warn('[admin] columnas nuevas no disponibles; SELECT base.', full.error.message);
  const base = await run(RESTAURANTE_ADMIN_SELECT_BASE);
  if (base.error) {
    console.error('[admin] restaurante (base):', base.error.message);
    return null;
  }
  return base.data ?? null;
}

/**
 * Valida la sesión y carga restaurante + platos del dashboard.
 * SuperAdmin puede pasar `restauranteId` o `slug` para gestionar cualquier local.
 *
 * @param {{ request: Request, cookies: import('astro').AstroCookies }} ctx
 * @param {{ restauranteId?: string | null, slug?: string | null }} [opts]
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
  const slug = opts.slug?.trim() || null;
  const writeClient = isSuper ? getSuperAdminWriteClient(supabase, user) : supabase;

  /** @type {object | null} */
  let restaurante = null;

  if (isSuper && (restauranteId || slug)) {
    // Service role (si existe) evita fallos RLS al gestionar locales ajenos
    restaurante = await fetchRestauranteAdmin(writeClient, {
      id: restauranteId,
      slug: restauranteId ? null : slug,
    });
  } else if (!isSuper) {
    restaurante = await fetchRestauranteAdmin(supabase, { userId: user.id });
  }

  if (!restaurante) {
    return {
      user,
      restaurante: null,
      platos: [],
      categorias: [],
      isSuperAdmin: isSuper,
      managingAsSuperAdmin: Boolean(isSuper && (restauranteId || slug)),
    };
  }

  const readClient = writeClient;

  const [{ data: platos, error: platosError }, catResult] = await Promise.all([
    readClient
      .from('platos')
      .select(
        'id, nombre, descripcion, precio, imagen_url, disponible, destacado, categoria_id, categorias(nombre)',
      )
      .eq('restaurante_id', restaurante.id)
      .order('categoria_id', { ascending: true })
      .order('id', { ascending: true }),
    readClient
      .from('categorias')
      .select('id, nombre, orden, bg_type, bg_valor')
      .eq('restaurante_id', restaurante.id)
      .order('orden', { ascending: true }),
  ]);

  let categorias = catResult.data;
  if (catResult.error) {
    const missingBg = /bg_type|bg_valor|column|schema cache/i.test(catResult.error.message || '');
    if (missingBg) {
      const fallback = await readClient
        .from('categorias')
        .select('id, nombre, orden')
        .eq('restaurante_id', restaurante.id)
        .order('orden', { ascending: true });
      categorias = fallback.data;
    } else {
      console.error('[admin] categorias:', catResult.error.message);
      categorias = [];
    }
  }

  if (platosError) {
    console.error('[admin] platos:', platosError.message);
    return {
      user,
      restaurante,
      platos: [],
      categorias: [],
      isSuperAdmin: isSuper,
      managingAsSuperAdmin: Boolean(isSuper && (restauranteId || slug)),
    };
  }

  return {
    user,
    restaurante,
    platos: (platos ?? []).map((p) => ({
      id: p.id,
      nombre: p.nombre,
      descripcion: p.descripcion,
      precio: Number(p.precio),
      imagen_url: p.imagen_url,
      disponible: p.disponible,
      destacado: Boolean(p.destacado),
      categoria_id: p.categoria_id,
      categoria_nombre: p.categorias?.nombre ?? 'Sin categoría',
    })),
    categorias: (categorias ?? []).map((c) => ({
      id: c.id,
      nombre: c.nombre,
      orden: c.orden,
      bg_type: c.bg_type || 'color',
      bg_valor: c.bg_valor || '',
    })),
    isSuperAdmin: isSuper,
    managingAsSuperAdmin: Boolean(isSuper && (restauranteId || slug)),
  };
}
