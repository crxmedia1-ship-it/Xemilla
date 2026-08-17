import {
  getUserAdminRole,
  getAssignedRestauranteId,
  ADMIN_ROLE_OPERATIVO,
  ADMIN_ROLE_SUPER,
} from '../config/superadmin.js';
import { createSupabaseServerClient } from './supabase/server.js';
import { createSupabaseServiceClient } from './supabase/service.js';
import { getSuperAdminWriteClient } from './superadmin.js';
import { normalizeAlergias } from '../config/nutricion.js';

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
  'gadget_nutricion',
  'gadget_ar',
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
  // hub_cover_url / hub_logo_bg: no están en todos los proyectos;
  // resolveHubCoverUrl / resolveHubLogoBg leen ui_estilo.hub.
  'ui_estilo',
  'home_theme',
  'ubicacion_theme',
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
  'gadget_nutricion',
  'gadget_ar',
  'config_wifi',
  'config_reservas',
  'logo_url',
  'eslogan',
  'secciones_fondo',
  'ui_estilo',
].join(', ');

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  const msg = full.error.message || '';
  const missingColumn = /column|does not exist|schema cache/i.test(msg);
  if (!missingColumn) {
    // UUID inválido / filtro malo: no ensuciar logs como fallo duro
    if (!/invalid input syntax|uuid/i.test(msg)) {
      console.error('[admin] restaurante:', msg);
    }
    return null;
  }

  console.warn('[admin] columnas nuevas no disponibles; SELECT base.', msg);
  const base = await run(RESTAURANTE_ADMIN_SELECT_BASE);
  if (!base.error) return base.data ?? null;

  // Último recurso: base sin nutrición/AR si esas columnas tampoco existen
  const msgBase = base.error.message || '';
  if (!/gadget_nutricion|gadget_ar|column|does not exist|schema cache/i.test(msgBase)) {
    console.error('[admin] restaurante (base):', msgBase);
    return null;
  }
  const bare = await run(
    RESTAURANTE_ADMIN_SELECT_BASE.replace(', gadget_nutricion, gadget_ar', ''),
  );
  if (bare.error) {
    console.error('[admin] restaurante (bare):', bare.error.message);
    return null;
  }
  return bare.data ?? null;
}

/**
 * Resuelve el local del operativo: metadata (id o slug) → fallback `user_id`.
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {{ id: string }} user
 * @param {string | null} assigned
 */
async function resolveOperativoRestaurante(client, user, assigned) {
  const token = String(assigned || '').trim();
  if (token) {
    if (UUID_RE.test(token)) {
      const byId = await fetchRestauranteAdmin(client, { id: token });
      if (byId) return byId;
    }
    const bySlug = await fetchRestauranteAdmin(client, { slug: token });
    if (bySlug) return bySlug;
    // Token no-UUID: ya intentamos slug; si parecía UUID pero no hubo fila, no reintentar id
  }
  return fetchRestauranteAdmin(client, { userId: user.id });
}

/**
 * Valida la sesión y carga restaurante + platos del dashboard.
 * SuperAdmin puede pasar `restauranteId` o `slug` para gestionar cualquier local.
 * Admin Operativo: ignora query URL y fuerza el `restaurante_id` de su metadata
 * (o, si falta, el local con `user_id` = auth.uid()).
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

  const role = getUserAdminRole(user);
  /** Strict SSR flag: false for Admin Operativo; true only for allowlist / role=superadmin. */
  const isSuper = role === ADMIN_ROLE_SUPER;
  const assignedRestauranteId = getAssignedRestauranteId(user);
  const restauranteId = opts.restauranteId?.trim() || null;
  const slug = opts.slug?.trim() || null;
  const writeClient = isSuper ? getSuperAdminWriteClient(supabase, user) : supabase;
  /** Lectura operativa: service role si existe (metadata / user_id pueden no alinear con RLS). */
  const operativoReadClient = !isSuper
    ? createSupabaseServiceClient() ?? supabase
    : supabase;

  /** @type {object | null} */
  let restaurante = null;

  if (isSuper && (restauranteId || slug)) {
    // Service role (si existe) evita fallos RLS al gestionar locales ajenos.
    // `?restaurante=` puede ser UUID o slug (mismo param que usa el hub).
    if (restauranteId && UUID_RE.test(restauranteId)) {
      restaurante = await fetchRestauranteAdmin(writeClient, { id: restauranteId });
    }
    if (!restaurante) {
      const slugToken =
        slug ||
        (restauranteId && !UUID_RE.test(restauranteId) ? restauranteId : null);
      if (slugToken) {
        restaurante = await fetchRestauranteAdmin(writeClient, { slug: slugToken });
      }
    }
  } else if (!isSuper) {
    // Operativo: ignorar ?restaurante= / ?slug=; siempre metadata (id|slug) → user_id
    restaurante = await resolveOperativoRestaurante(
      operativoReadClient,
      user,
      assignedRestauranteId,
    );
  }

  const managingAsSuperAdmin = Boolean(isSuper && (restauranteId || slug));

  if (!restaurante) {
    return {
      user,
      restaurante: null,
      platos: [],
      categorias: [],
      isSuperAdmin: isSuper,
      role,
      assignedRestauranteId,
      managingAsSuperAdmin,
    };
  }

  const readClient = isSuper ? writeClient : operativoReadClient;

  const platosSelectWithNutricion =
    'id, nombre, descripcion, precio, imagen_url, disponible, destacado, categoria_id, orden, calorias, proteinas, carbs, grasas, alergias, ingredientes_detalle, modelo_3d_url, categorias(nombre)';
  const platosSelectNutNoOrden =
    'id, nombre, descripcion, precio, imagen_url, disponible, destacado, categoria_id, calorias, proteinas, carbs, grasas, alergias, ingredientes_detalle, modelo_3d_url, categorias(nombre)';
  const platosSelectNutNoJoin =
    'id, nombre, descripcion, precio, imagen_url, disponible, destacado, categoria_id, calorias, proteinas, carbs, grasas, alergias, ingredientes_detalle, modelo_3d_url';
  const platosSelectWithOrden =
    'id, nombre, descripcion, precio, imagen_url, disponible, destacado, categoria_id, orden, categorias(nombre)';
  const platosSelectBase =
    'id, nombre, descripcion, precio, imagen_url, disponible, destacado, categoria_id, categorias(nombre)';

  const loadPlatos = (select) =>
    readClient
      .from('platos')
      .select(select)
      .eq('restaurante_id', restaurante.id)
      .order(select.includes('orden') ? 'orden' : 'categoria_id', { ascending: true })
      .order('id', { ascending: true });

  const [{ data: platosRaw, error: platosError }, catResult] = await Promise.all([
    loadPlatos(platosSelectWithNutricion),
    readClient
      .from('categorias')
      .select('id, nombre, orden, bg_type, bg_valor')
      .eq('restaurante_id', restaurante.id)
      .order('orden', { ascending: true }),
  ]);

  let platos = platosRaw;
  let platosLoadError = platosError;
  if (platosLoadError) {
    const msg = platosLoadError.message || '';
    console.warn('[admin] platos SELECT fallback.', msg);
    const missingOrden = /\borden\b/i.test(msg);
    const nutRetry = await loadPlatos(
      missingOrden ? platosSelectNutNoOrden : platosSelectNutNoJoin,
    );
    if (!nutRetry.error) {
      platos = nutRetry.data;
      platosLoadError = null;
    } else {
      const nutNoJoin = await loadPlatos(platosSelectNutNoJoin);
      if (!nutNoJoin.error) {
        platos = nutNoJoin.data;
        platosLoadError = null;
      } else {
        const fallback = await loadPlatos(
          missingOrden ? platosSelectBase : platosSelectWithOrden,
        );
        if (fallback.error && !missingOrden) {
          const baseFallback = await loadPlatos(platosSelectBase);
          platos = baseFallback.data;
          platosLoadError = baseFallback.error;
        } else {
          platos = fallback.data;
          platosLoadError = fallback.error;
        }
      }
    }
  }

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

  if (platosLoadError) {
    console.error('[admin] platos:', platosLoadError.message);
    return {
      user,
      restaurante,
      platos: [],
      categorias: [],
      isSuperAdmin: isSuper,
      role,
      assignedRestauranteId,
      managingAsSuperAdmin,
    };
  }

  const categoriasMapped = (categorias ?? []).map((c) => ({
    id: c.id,
    nombre: c.nombre,
    orden: Number.isFinite(Number(c.orden)) ? Number(c.orden) : 0,
    bg_type: c.bg_type || 'color',
    bg_valor: c.bg_valor || '',
  }));

  /** Category display order → dish order within category (reload-stable). */
  const categoriaOrdenById = new Map(
    categoriasMapped.map((c) => [c.id, c.orden]),
  );

  const platosMapped = (platos ?? []).map((p, index) => ({
    id: p.id,
    nombre: p.nombre,
    descripcion: p.descripcion,
    precio: Number(p.precio),
    imagen_url: p.imagen_url,
    disponible: p.disponible,
    destacado: Boolean(p.destacado),
    categoria_id: p.categoria_id,
    orden: Number.isFinite(Number(p.orden)) ? Number(p.orden) : index + 1,
    categoria_nombre:
      p.categorias?.nombre ??
      categoriasMapped.find((c) => String(c.id) === String(p.categoria_id))?.nombre ??
      'Sin categoría',
    calorias: p.calorias == null ? null : Number(p.calorias),
    proteinas: p.proteinas == null ? null : Number(p.proteinas),
    carbs: p.carbs == null ? null : Number(p.carbs),
    grasas: p.grasas == null ? null : Number(p.grasas),
    alergias: normalizeAlergias(p.alergias),
    ingredientes_detalle: p.ingredientes_detalle ?? '',
    modelo_3d_url: typeof p.modelo_3d_url === 'string' ? p.modelo_3d_url.trim() : '',
  }));

  platosMapped.sort((a, b) => {
    const aCat = categoriaOrdenById.get(a.categoria_id) ?? Number.MAX_SAFE_INTEGER;
    const bCat = categoriaOrdenById.get(b.categoria_id) ?? Number.MAX_SAFE_INTEGER;
    if (aCat !== bCat) return aCat - bCat;
    if (a.orden !== b.orden) return a.orden - b.orden;
    return Number(a.id) - Number(b.id);
  });

  return {
    user,
    restaurante,
    platos: platosMapped,
    categorias: categoriasMapped,
    isSuperAdmin: isSuper,
    role: role || ADMIN_ROLE_OPERATIVO,
    assignedRestauranteId,
    managingAsSuperAdmin,
  };
}
