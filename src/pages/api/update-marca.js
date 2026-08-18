import { isSuperAdminUser } from '../../config/superadmin.js';
import { createSupabaseServerClient } from '../../lib/supabase/server.js';
import { getSuperAdminWriteClient } from '../../lib/superadmin.js';
import {
  buildSeccionesFondoFromBody,
  buildNosotrosBloquesFromBody,
  buildRedesSocialesFromBody,
  buildUiEstiloFromBody,
  sanitizeCssAvanzado,
  normalizeMenuUi,
} from '../../lib/secciones-ui.js';
import { buildBoutiqueConfig } from '../../lib/boutique.js';
import { normalizeMapsStorage } from '../../lib/maps-preview.js';
import {
  normalizeHomeTheme,
  normalizeNosotrosTheme,
  normalizeUbicacionTheme,
} from '../../lib/layout-themes.js';
import {
  normalizeTypographyComboId,
  resolveTypographyCombo,
} from '../../config/typography-combos.js';
import { sanitizeMenuFontFamily, resolveMenuFont } from '../../config/menu-fonts.js';

export const prerender = false;

const DNA_ALLOWED = new Set(['elegant', 'modern', 'retro']);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
  'Access-Control-Max-Age': '86400',
};

/**
 * Preflight CORS (evita NetworkError en algunos proxies / extensiones).
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

/**
 * Actualiza identidad de marca unificada (sub-tabs atómicas).
 * Todo el cuerpo va en try/catch para siempre devolver JSON válido.
 */
export async function POST({ request, cookies }) {
  try {
    return await handleUpdateMarca({ request, cookies });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/update-marca] uncaught:', message, err);
    return json(
      { error: message || 'Error interno al guardar Identidad de Marca' },
      500,
    );
  }
}

/**
 * @param {{ request: Request, cookies: import('astro').AstroCookies }} ctx
 */
async function handleUpdateMarca({ request, cookies }) {
  console.info('[api/update-marca] POST recibido');
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
  const nombreComercial = normalizeText(raw.nombre_comercial);
  if (nombreComercial) {
    patch.nombre_comercial = nombreComercial;
  }
  patch.color_primario = normalizeColor(raw.color_primario);
  patch.color_fondo =
    normalizeColor(raw.color_fondo) || normalizeColor(raw.fondo_home_valor);
  patch.color_texto = normalizeColor(raw.color_texto);
  // css_avanzado (canónico en ui_estilo) ↔ columna legacy custom_css
  patch.custom_css =
    sanitizeCssAvanzado(raw.css_avanzado ?? raw.custom_css) || null;

  const dna = String(raw.estilo_adn ?? '')
    .trim()
    .toLowerCase();
  // ADN legacy opcional (radios/motion); tipografía vive en combo
  if (dna && !DNA_ALLOWED.has(dna)) {
    return json({ error: 'estilo_adn inválido (elegant | modern | retro)' }, 400);
  }
  patch.estilo_adn = dna && DNA_ALLOWED.has(dna) ? dna : 'elegant';

  // Combinación tipográfica Pro → se guarda como id en tipo_letra
  const tipografiaCombo = normalizeTypographyComboId(
    raw.tipografia_combo ?? raw.tipo_letra ?? raw.estilo_adn,
  );
  const combo = resolveTypographyCombo(tipografiaCombo);
  patch.tipo_letra = combo.id;

  // Tipografía del menú (títulos + precios): familia Google o preset legacy
  const menuFontResolved = resolveMenuFont(raw.menu_font);
  const menuFontSafe = sanitizeMenuFontFamily(menuFontResolved.family);
  patch.menu_font = menuFontSafe || menuFontResolved.id || null;

  // Metadatos de compartido / PWA
  patch.share_image_url = normalizeUrlOrText(raw.share_image_url);
  patch.app_icon_url = normalizeUrlOrText(raw.app_icon_url);

  // Tokens tipográficos Home + colores por sección (merge: no borrar hub ni claves previas)
  const uiEstiloBuilt = buildUiEstiloFromBody(raw);
  const nosotrosTheme = normalizeNosotrosTheme(raw.nosotros_theme);

  const { data: existingRow } = await writeClient
    .from('restaurantes')
    .select('ui_estilo')
    .eq('id', restauranteId)
    .maybeSingle();

  const prevUi =
    existingRow?.ui_estilo &&
    typeof existingRow.ui_estilo === 'object' &&
    !Array.isArray(existingRow.ui_estilo)
      ? /** @type {Record<string, any>} */ (existingRow.ui_estilo)
      : {};

  const uiEstilo = {
    ...prevUi,
    ...uiEstiloBuilt,
    hub: prevUi.hub ?? uiEstiloBuilt.hub,
    home: { ...(prevUi.home || {}), ...(uiEstiloBuilt.home || {}) },
    menu: normalizeMenuUi({ ...(prevUi.menu || {}), ...(uiEstiloBuilt.menu || {}) }),
    nosotros: {
      ...(prevUi.nosotros || {}),
      ...(uiEstiloBuilt.nosotros || {}),
      theme: nosotrosTheme,
    },
    ubicacion: { ...(prevUi.ubicacion || {}), ...(uiEstiloBuilt.ubicacion || {}) },
  };
  patch.ui_estilo = uiEstilo;

  // Plantillas de estructura (Layout Themes)
  patch.home_theme = normalizeHomeTheme(raw.home_theme);
  patch.nosotros_theme = nosotrosTheme;
  patch.ubicacion_theme = normalizeUbicacionTheme(raw.ubicacion_theme);

  // Fondos por sección (JSONB) + legacy imagen_fondo si home es image
  const seccionesFondo = buildSeccionesFondoFromBody(raw);
  patch.secciones_fondo = seccionesFondo;

  const homeFondo = seccionesFondo?.home ?? { tipo: 'color', valor: '' };
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
    patch.nosotros_texto = normalizeText(raw.nosotros_texto, {
      keepNewlines: true,
    });
  }

  // Ubicación + redes (dirección ya no se edita aquí; no borrar si no viene)
  if (raw.direccion !== undefined) {
    patch.direccion = normalizeText(raw.direccion);
  }
  patch.coordenadas_maps = normalizeMapsStorage(normalizeUrlOrText(raw.coordenadas_maps));
  patch.horarios = normalizeText(raw.horarios, { keepNewlines: true });

  const { data: redesRow } = await writeClient
    .from('restaurantes')
    .select('redes_sociales')
    .eq('id', restauranteId)
    .maybeSingle();

  const redes = buildRedesSocialesFromBody(raw, redesRow?.redes_sociales);
  patch.redes_sociales = redes;
  const igPublica = redes.find((r) => r.red === 'instagram' && r.activo !== false);
  patch.instagram_url = igPublica?.url || null;

  const waRed = redes.find((r) => r.red === 'whatsapp');
  const whatsapp =
    waRed?.activo !== false && waRed?.url
      ? normalizeWhatsapp(waRed.url)
      : normalizeWhatsapp(raw.whatsapp_url);
  patch.whatsapp_url = whatsapp || null;
  if (whatsapp) {
    const digits = whatsapp.replace(/\D/g, '');
    patch.whatsapp_num = digits ? `+${digits}` : whatsapp;
  } else {
    patch.whatsapp_num = null;
  }

  // Reservas
  if (raw.gadget_reservas !== undefined) {
    patch.gadget_reservas = toBool(raw.gadget_reservas);
  }
  const reservasLabel =
    normalizeText(raw.reservas_label) ||
    normalizeText(raw.reservas_boton) ||
    'PEDIR / RESERVAR';
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
  if (raw.gadget_wifi !== undefined) {
    patch.gadget_wifi = toBool(raw.gadget_wifi);
  }
  if (raw.gadget_mesero !== undefined || raw.gadget_llamar_mesero !== undefined) {
    const gadgetMesero = toBool(
      raw.gadget_mesero !== undefined ? raw.gadget_mesero : raw.gadget_llamar_mesero,
    );
    patch.gadget_mesero = gadgetMesero;
    patch.gadget_llamar_mesero = gadgetMesero;
  }
  if (raw.gadget_cuenta !== undefined || raw.gadget_dividir_cuenta !== undefined) {
    const gadgetCuenta = toBool(
      raw.gadget_cuenta !== undefined
        ? raw.gadget_cuenta
        : raw.gadget_dividir_cuenta,
    );
    patch.gadget_cuenta = gadgetCuenta;
    patch.gadget_dividir_cuenta = gadgetCuenta;
  }
  if (raw.gadget_boutique !== undefined) {
    patch.gadget_boutique = toBool(raw.gadget_boutique);
  }
  if (raw.gadget_nutricion !== undefined) {
    patch.gadget_nutricion = toBool(raw.gadget_nutricion);
  }
  if (raw.gadget_ar !== undefined) {
    patch.gadget_ar = toBool(raw.gadget_ar);
  }
  if (raw.gadget_live_module !== undefined) {
    patch.gadget_live_module = toBool(raw.gadget_live_module);
  }

  const wifiTouched =
    raw.gadget_wifi !== undefined ||
    raw.gadget_wifi_ssid !== undefined ||
    raw.wifi_ssid !== undefined ||
    raw.gadget_wifi_clave !== undefined ||
    raw.wifi_password !== undefined;

  if (wifiTouched) {
    const wifiOn = raw.gadget_wifi !== undefined ? toBool(raw.gadget_wifi) : undefined;
    const wifiSsid =
      normalizeText(raw.gadget_wifi_ssid) || normalizeText(raw.wifi_ssid) || '';
    const wifiClave =
      normalizeText(raw.gadget_wifi_clave) ||
      normalizeText(raw.wifi_password) ||
      normalizeText(raw.wifi_clave) ||
      '';
    if (wifiOn !== undefined) patch.gadget_wifi = wifiOn;
    patch.gadget_wifi_ssid = wifiSsid || null;
    patch.gadget_wifi_clave = wifiClave || null;
    patch.config_wifi = { ssid: wifiSsid, password: wifiClave };
  }

  // Boutique / merch
  patch.gadget_boutique = toBool(raw.gadget_boutique);
  patch.gadget_nutricion = toBool(raw.gadget_nutricion);
  patch.gadget_ar = toBool(raw.gadget_ar);
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

  const { data, error } = await updateRestauranteMarca(writeClient, restauranteId, patch);

  if (error) {
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
 * Update con reintento: quita solo la columna que PostgREST reporta como ausente.
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} restauranteId
 * @param {Record<string, unknown>} patch
 */
async function updateRestauranteMarca(client, restauranteId, patch) {
  /** @type {string[]} */
  let selectCols = [
    'id',
    'nombre_comercial',
    'logo_url',
    'eslogan',
    'ui_estilo',
    'home_theme',
    'nosotros_theme',
    'ubicacion_theme',
    'secciones_fondo',
    'nosotros_bloques',
    'nosotros_titulo',
    'nosotros_texto',
    'nosotros_imagen',
  ];

  /** @type {Record<string, unknown>} */
  let current = { ...patch };

  for (let attempt = 0; attempt < 10; attempt++) {
    const { data, error } = await client
      .from('restaurantes')
      .update(current)
      .eq('id', restauranteId)
      .select(selectCols.join(', '))
      .maybeSingle();

    if (!error) return { data, error: null };

    const msg = error.message || '';
    const colMatch =
      msg.match(/Could not find the ['"]([\w_]+)['"] column/i) ||
      msg.match(/column [\w.]+\.([\w_]+) does not exist/i) ||
      msg.match(/['"]([\w_]+)['"] column of ['"]restaurantes['"]/i);

    const badCol = colMatch?.[1];
    if (badCol && Object.prototype.hasOwnProperty.call(current, badCol)) {
      console.warn('[api/update-marca] omitiendo columna ausente:', badCol, msg);
      delete current[badCol];
      // Si falla nosotros_theme plano, ya va en ui_estilo.nosotros.theme
      continue;
    }

    if (badCol && selectCols.includes(badCol)) {
      console.warn('[api/update-marca] omitiendo columna del SELECT:', badCol, msg);
      selectCols = selectCols.filter((c) => c !== badCol);
      continue;
    }

    // Fallback amplio solo si el mensaje es genérico de schema cache
    if (/schema cache|column|does not exist/i.test(msg) && attempt < 6) {
      const optional = [
        'gadget_live_module',
        'gadget_ar',
        'gadget_nutricion',
        'gadget_boutique',
        'gadget_wifi_ssid',
        'gadget_wifi_clave',
        'gadget_mesero',
        'gadget_cuenta',
        'config_boutique',
        'nosotros_theme',
        'home_theme',
        'ubicacion_theme',
        'menu_font',
      ];
      const next = optional.find((k) => Object.prototype.hasOwnProperty.call(current, k));
      if (next) {
        console.warn('[api/update-marca] fallback omit:', next, msg);
        delete current[next];
        continue;
      }
    }

    return { data: null, error };
  }

  return {
    data: null,
    error: { message: 'No se pudo guardar tras reintentos de columnas' },
  };
}

/**
 * Fondos por categoría + respuesta OK (extraído para reutilizar en fallback).
 * @param {import('@supabase/supabase-js').SupabaseClient} writeClient
 * @param {string} restauranteId
 * @param {Record<string, unknown>} raw
 * @param {Record<string, unknown>} data
 */
async function afterMarcaUpdate(writeClient, restauranteId, raw, data) {
  // Fondos por categoría (tabla categorias) — nunca abortan el save de restaurantes
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

  /** @type {string[]} */
  const categoriaWarnings = [];

  for (const cat of categoriasFondos) {
    try {
      const catId = Number(cat?.id);
      if (!Number.isFinite(catId) || catId <= 0) continue;

      const bgType = String(cat.bg_type || cat.bgType || 'color')
        .trim()
        .toLowerCase();
      const bgValorRaw = cat.bg_valor ?? cat.bgValor;
      const bgValor =
        bgValorRaw == null || bgValorRaw === ''
          ? ''
          : String(bgValorRaw).trim();

      /** @type {Record<string, unknown>} */
      const catPatch = {
        bg_type: ['color', 'image', 'video'].includes(bgType) ? bgType : 'color',
      };
      // No incluir bg_valor si es null/vacío (columna puede no existir o no mapearse)
      if (bgValor) {
        catPatch.bg_valor = bgValor;
      }

      const { error: catErr } = await writeClient
        .from('categorias')
        .update(catPatch)
        .eq('id', catId)
        .eq('restaurante_id', restauranteId);

      if (catErr) {
        console.error('[api/update-marca] categoria', catId, catErr.message);
        categoriaWarnings.push(`categoria ${catId}: ${catErr.message}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[api/update-marca] categoria update non-fatal:', msg);
      categoriaWarnings.push(msg);
    }
  }

  const savedFields = Object.keys(data || {}).filter((k) => k !== 'id');
  const bloquesSaved = Array.isArray(data?.nosotros_bloques)
    ? data.nosotros_bloques.length
    : Array.isArray(raw.nosotros_bloques)
      ? raw.nosotros_bloques.length
      : 0;
  const themeSaved =
    data?.nosotros_theme ||
    /** @type {any} */ (data?.ui_estilo)?.nosotros?.theme ||
    raw.nosotros_theme ||
    'editorial';

  return json({
    ok: true,
    message: `Identidad guardada · Nosotros: ${themeSaved} · ${bloquesSaved} bloque${bloquesSaved === 1 ? '' : 's'}`,
    restaurante: data,
    nosotros_theme: themeSaved,
    nosotros_bloques_count: bloquesSaved,
    saved_fields: savedFields,
    ...(categoriaWarnings.length > 0
      ? { categoria_warnings: categoriaWarnings }
      : {}),
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

/**
 * Respuesta JSON siempre válida + headers CORS.
 * @param {Record<string, unknown>} body
 * @param {number} [status=200]
 */
function json(body, status = 200) {
  return new Response(JSON.stringify(body ?? { error: 'Respuesta vacía' }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS_HEADERS,
    },
  });
}
