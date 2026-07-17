import { isSuperAdminUser } from '../../config/superadmin.js';
import { createSupabaseServerClient } from '../../lib/supabase/server.js';
import { getSuperAdminWriteClient } from '../../lib/superadmin.js';
import { buildSeccionesFondoFromBody, buildNosotrosBloquesFromBody, buildRedesSocialesFromBody, buildUiEstiloFromBody } from '../../lib/secciones-ui.js';
import { buildBoutiqueConfig } from '../../lib/boutique.js';

export const prerender = false;

const DNA_ALLOWED = new Set(['elegant', 'modern', 'retro']);

/**
 * @param {unknown} value
 */
function sanitizeCustomCss(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<\/style/gi, '/* blocked */')
    .replace(/<script/gi, '/* blocked */')
    .trim();
}

/**
 * Actualiza identidad de marca unificada (sub-tabs atómicas).
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

  /** @type {Record<string, unknown>} */
  let raw = {};
  try {
    raw = await request.json();
  } catch {
    return json({ error: 'Cuerpo de petición inválido' }, 400);
  }

  const isSuper = isSuperAdminUser(user);
  const writeClient = getSuperAdminWriteClient(supabase, user);

  // Identidad de Marca es exclusiva del dueño del SaaS (SuperAdmin).
  if (!isSuper) {
    return json(
      { error: 'Identidad de Marca solo disponible para SuperAdmin' },
      403,
    );
  }

  const restauranteId = String(raw.restaurante_id ?? '').trim();
  if (!restauranteId) {
    return json({ error: 'restaurante_id requerido' }, 400);
  }

  /** @type {Record<string, unknown>} */
  const patch = {};

  // Home / Core
  patch.logo_url = normalizeUrlOrText(raw.logo_url);
  patch.eslogan = normalizeText(raw.eslogan);
  patch.color_primario = normalizeColor(raw.color_primario);
  patch.color_fondo = normalizeColor(raw.color_fondo) || normalizeColor(raw.fondo_home_valor);
  patch.color_texto = normalizeColor(raw.color_texto);
  patch.custom_css = sanitizeCustomCss(raw.custom_css) || null;

  const dna = String(raw.estilo_adn ?? '')
    .trim()
    .toLowerCase();
  if (dna && !DNA_ALLOWED.has(dna)) {
    return json({ error: 'estilo_adn inválido (elegant | modern | retro)' }, 400);
  }
  patch.estilo_adn = dna || null;

  // Tipografía global (override del stack ADN)
  const tipoLetraRaw = normalizeText(raw.tipo_letra);
  patch.tipo_letra = tipoLetraRaw;

  // Tipografía del menú (títulos + precios)
  const menuFont = String(raw.menu_font ?? '')
    .trim()
    .toLowerCase();
  const MENU_FONT_OK = new Set(['elegant', 'modern', 'urban']);
  if (menuFont && !MENU_FONT_OK.has(menuFont)) {
    return json({ error: 'menu_font inválido (elegant | modern | urban)' }, 400);
  }
  patch.menu_font = menuFont || null;

  // Metadatos de compartido / PWA
  patch.share_image_url = normalizeUrlOrText(raw.share_image_url);
  patch.app_icon_url = normalizeUrlOrText(raw.app_icon_url);

  // Tokens tipográficos Home + colores por sección
  patch.ui_estilo = buildUiEstiloFromBody(raw);

  // Fondos por sección (JSONB) + legacy imagen_fondo si home es image
  const seccionesFondo = buildSeccionesFondoFromBody(raw);
  patch.secciones_fondo = seccionesFondo;

  const homeFondo = seccionesFondo.home;
  if (homeFondo.tipo === 'image' || homeFondo.tipo === 'video') {
    patch.imagen_fondo = homeFondo.valor || null;
  } else if (homeFondo.tipo === 'color' && homeFondo.valor) {
    patch.color_fondo = normalizeColor(homeFondo.valor) || patch.color_fondo;
    patch.imagen_fondo = null;
  }

  // Nosotros (bloques JSONB + legacy sync del primer bloque)
  const nosotrosBloques = buildNosotrosBloquesFromBody(raw);
  patch.nosotros_bloques = nosotrosBloques;
  if (nosotrosBloques.length > 0) {
    const first = nosotrosBloques[0];
    patch.nosotros_titulo = first.titulo || null;
    patch.nosotros_texto = first.texto || null;
    patch.nosotros_imagen = first.media_url || null;
    patch.nosotros_subtitulo = null;
  } else {
    patch.nosotros_subtitulo = normalizeText(raw.nosotros_subtitulo);
    patch.nosotros_titulo = normalizeText(raw.nosotros_titulo);
    patch.nosotros_imagen = normalizeUrlOrText(raw.nosotros_imagen);
    patch.nosotros_texto = normalizeText(raw.nosotros_texto, { keepNewlines: true });
  }

  // Ubicación + redes
  patch.direccion = normalizeText(raw.direccion);
  patch.coordenadas_maps = normalizeUrlOrText(raw.coordenadas_maps);
  patch.horarios = normalizeText(raw.horarios, { keepNewlines: true });

  const redes = buildRedesSocialesFromBody(raw);
  patch.redes_sociales = redes;
  const ig = redes.find((r) => r.red === 'instagram');
  patch.instagram_url = ig?.url || normalizeUrlOrText(raw.instagram_url);

  const whatsapp = normalizeWhatsapp(raw.whatsapp_url);
  patch.whatsapp_url = whatsapp;
  if (whatsapp) {
    const digits = whatsapp.replace(/\D/g, '');
    patch.whatsapp_num = digits ? `+${digits}` : whatsapp;
  } else if (raw.whatsapp_url === '' || raw.whatsapp_url === null) {
    patch.whatsapp_num = null;
  }

  // Reservas
  patch.gadget_reservas = toBool(raw.gadget_reservas);
  const reservasLabel =
    normalizeText(raw.reservas_label) || normalizeText(raw.reservas_boton) || 'PEDIR / RESERVAR';
  const destinoTipo = String(raw.reservas_destino_tipo || 'enlace')
    .trim()
    .toLowerCase();
  const destinoValor =
    normalizeText(raw.reservas_destino_valor) ||
    normalizeUrlOrText(raw.reservas_url) ||
    '';
  patch.config_reservas = {
    label: reservasLabel,
    destino_tipo: destinoTipo === 'whatsapp' ? 'whatsapp' : 'enlace',
    destino_valor: destinoValor,
    url: destinoValor,
  };

  // Gadgets mesa (columnas canónicas + sync legacy)
  const gadgetWifi = toBool(raw.gadget_wifi);
  const gadgetMesero = toBool(
    raw.gadget_mesero !== undefined ? raw.gadget_mesero : raw.gadget_llamar_mesero,
  );
  const gadgetCuenta = toBool(
    raw.gadget_cuenta !== undefined ? raw.gadget_cuenta : raw.gadget_dividir_cuenta,
  );

  patch.gadget_wifi = gadgetWifi;
  patch.gadget_mesero = gadgetMesero;
  patch.gadget_cuenta = gadgetCuenta;
  // Aliases legacy (compatibilidad con filas / clientes previos)
  patch.gadget_llamar_mesero = gadgetMesero;
  patch.gadget_dividir_cuenta = gadgetCuenta;

  const wifiSsid =
    normalizeText(raw.gadget_wifi_ssid) ||
    normalizeText(raw.wifi_ssid) ||
    '';
  const wifiClave =
    normalizeText(raw.gadget_wifi_clave) ||
    normalizeText(raw.wifi_password) ||
    normalizeText(raw.wifi_clave) ||
    '';
  patch.gadget_wifi_ssid = wifiSsid || null;
  patch.gadget_wifi_clave = wifiClave || null;
  patch.config_wifi = { ssid: wifiSsid, password: wifiClave };

  // Boutique / merch
  patch.gadget_boutique = toBool(raw.gadget_boutique);
  let boutiqueProductos = null;
  if (Array.isArray(raw.boutique_productos)) {
    boutiqueProductos = raw.boutique_productos;
  } else if (
    raw.config_boutique &&
    typeof raw.config_boutique === 'object' &&
    Array.isArray(/** @type {any} */ (raw.config_boutique).productos)
  ) {
    boutiqueProductos = /** @type {any} */ (raw.config_boutique).productos;
  }
  patch.config_boutique = buildBoutiqueConfig(boutiqueProductos);

  const { data, error } = await writeClient
    .from('restaurantes')
    .update(patch)
    .eq('id', restauranteId)
    .select(
      [
        'id',
        'logo_url',
        'eslogan',
        'color_primario',
        'color_fondo',
        'color_texto',
        'estilo_adn',
        'menu_font',
        'tipo_letra',
        'share_image_url',
        'app_icon_url',
        'ui_estilo',
        'imagen_fondo',
        'custom_css',
        'secciones_fondo',
        'nosotros_bloques',
        'redes_sociales',
        'direccion',
        'horarios',
        'instagram_url',
        'whatsapp_url',
        'coordenadas_maps',
        'nosotros_subtitulo',
        'nosotros_titulo',
        'nosotros_imagen',
        'nosotros_texto',
        'whatsapp_num',
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
      ].join(', '),
    )
    .maybeSingle();

  if (error) {
    // Si faltan columnas nuevas en Supabase, reintentar sin ellas (legacy)
    const missingNew =
      /gadget_wifi_ssid|gadget_wifi_clave|gadget_mesero|gadget_cuenta|gadget_boutique|config_boutique|column|schema cache/i.test(
        error.message || '',
      );
    if (missingNew) {
      console.warn(
        '[api/update-marca] columnas planas de gadgets no disponibles; fallback legacy.',
        error.message,
      );
      const legacyPatch = { ...patch };
      delete legacyPatch.gadget_wifi_ssid;
      delete legacyPatch.gadget_wifi_clave;
      delete legacyPatch.gadget_mesero;
      delete legacyPatch.gadget_cuenta;
      delete legacyPatch.gadget_boutique;
      delete legacyPatch.config_boutique;
      const retry = await writeClient
        .from('restaurantes')
        .update(legacyPatch)
        .eq('id', restauranteId)
        .select(
          [
            'id',
            'logo_url',
            'eslogan',
            'color_primario',
            'color_fondo',
            'color_texto',
            'estilo_adn',
            'menu_font',
            'tipo_letra',
            'share_image_url',
            'app_icon_url',
            'ui_estilo',
            'imagen_fondo',
            'custom_css',
            'secciones_fondo',
            'nosotros_bloques',
            'redes_sociales',
            'direccion',
            'horarios',
            'instagram_url',
            'whatsapp_url',
            'coordenadas_maps',
            'nosotros_subtitulo',
            'nosotros_titulo',
            'nosotros_imagen',
            'nosotros_texto',
            'whatsapp_num',
            'gadget_wifi',
            'gadget_dividir_cuenta',
            'gadget_reservas',
            'gadget_llamar_mesero',
            'config_wifi',
            'config_reservas',
          ].join(', '),
        )
        .maybeSingle();
      if (retry.error) {
        console.error('[api/update-marca]', retry.error.message);
        return json({ error: retry.error.message }, 400);
      }
      if (!retry.data) {
        return json(
          {
            error: isSuper
              ? 'Restaurante no encontrado. Revisá RLS / service role.'
              : 'Restaurante no encontrado o sin permiso',
          },
          404,
        );
      }
      return afterMarcaUpdate(writeClient, restauranteId, raw, retry.data);
    }
    console.error('[api/update-marca]', error.message);
    return json({ error: error.message }, 400);
  }

  if (!data) {
    return json(
      {
        error: isSuper
          ? 'Restaurante no encontrado. Revisá RLS / service role.'
          : 'Restaurante no encontrado o sin permiso',
      },
      404,
    );
  }

  return afterMarcaUpdate(writeClient, restauranteId, raw, data);
}

/**
 * Fondos por categoría + respuesta OK (extraído para reutilizar en fallback).
 * @param {import('@supabase/supabase-js').SupabaseClient} writeClient
 * @param {string} restauranteId
 * @param {Record<string, unknown>} raw
 * @param {Record<string, unknown>} data
 */
async function afterMarcaUpdate(writeClient, restauranteId, raw, data) {
  // Fondos por categoría (tabla categorias)
  /** @type {Array<{ id: number|string, bg_type?: string, bg_valor?: string }>} */
  let categoriasFondos = [];
  if (Array.isArray(raw.categorias_fondos)) {
    categoriasFondos = raw.categorias_fondos;
  } else if (typeof raw.categorias_fondos === 'string') {
    try {
      categoriasFondos = JSON.parse(raw.categorias_fondos);
    } catch {
      categoriasFondos = [];
    }
  }

  for (const cat of categoriasFondos) {
    const catId = Number(cat?.id);
    if (!Number.isFinite(catId) || catId <= 0) continue;
    const bgType = String(cat.bg_type || cat.bgType || 'color')
      .trim()
      .toLowerCase();
    const bgValor = String(cat.bg_valor || cat.bgValor || '').trim();
    const { error: catErr } = await writeClient
      .from('categorias')
      .update({
        bg_type: ['color', 'image', 'video'].includes(bgType) ? bgType : 'color',
        bg_valor: bgValor || null,
      })
      .eq('id', catId)
      .eq('restaurante_id', restauranteId);
    if (catErr) {
      console.error('[api/update-marca] categoria', catId, catErr.message);
    }
  }

  return json({
    ok: true,
    message: '¡Identidad de marca actualizada con éxito!',
    restaurante: data,
  });
}

function toBool(value) {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1' || value === 1) return true;
  if (value === 'false' || value === '0' || value === 0) return false;
  return Boolean(value);
}

function normalizeColor(value) {
  if (value == null) return null;
  const v = String(value).trim();
  if (!v) return null;
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) return v.toLowerCase();
  if (/^(rgb|hsl)a?\(/i.test(v)) return v;
  return null;
}

function normalizeText(value, opts = {}) {
  if (value == null) return null;
  let v = String(value);
  if (opts.keepNewlines) {
    v = v.replace(/\r\n/g, '\n').trim();
  } else {
    v = v.trim();
  }
  return v || null;
}

function normalizeUrlOrText(value) {
  const v = normalizeText(value);
  if (!v) return null;
  return v;
}

function normalizeWhatsapp(value) {
  const v = normalizeText(value);
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  const digits = v.replace(/\D/g, '');
  return digits ? `+${digits}` : v;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
