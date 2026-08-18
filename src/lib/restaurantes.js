import { supabase } from '../config/db.js';
import {
  getBrandProfile,
  hasLocalBrandProfile,
  normalizeBrandSlug,
  normalizeHorarios,
} from '../config/brand.js';
import { resolveRestaurantTheme } from './theme.js';
import {
  parseSeccionesFondo,
  parseReservasConfig,
  resolveSectionFondo,
  parseNosotrosBloques,
  parseRedesSociales,
  parseUiEstilo,
  uiEstiloToCssVars,
} from './secciones-ui.js';
import { parseBoutiqueConfig } from './boutique.js';
import {
  normalizeHomeTheme,
  normalizeNosotrosTheme,
  normalizeUbicacionTheme,
} from './layout-themes.js';
import { resolveMediaUrl } from './cloudinary.js';
import { platoFillUrl } from './plato-media-url.js';
import { createSupabaseServiceClient } from './supabase/service.js';
import { normalizeAlergias } from '../config/nutricion.js';

/**
 * Formatea el precio NUMERIC de Postgres para la UI móvil.
 * @param {string | number} value
 */
function formatPrecio(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return String(value ?? '');
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function asText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * True si el valor de columna tiene contenido usable.
 * @param {unknown} value
 */
function hasContent(value) {
  if (typeof value === 'string') return value.trim().length > 0;
  return value != null && value !== '';
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function parseJsonConfig(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) {
    return /** @type {Record<string, unknown>} */ (value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return {};
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Sanitiza CSS custom (bloquea cierre de style / scripts).
 * @param {unknown} value
 * @returns {string}
 */
export function sanitizeCustomCss(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<\/style/gi, '/* blocked */')
    .replace(/<script/gi, '/* blocked */')
    .trim();
}

/**
 * Candidatos de slug a probar en Supabase (URL con guion ↔ sin guion).
 * @param {string} slug
 * @returns {string[]}
 */
function slugLookupCandidates(slug) {
  const raw = String(slug || '').trim();
  const normalized = normalizeBrandSlug(raw);
  const candidates = [raw, normalized];
  if (normalized === 'blacksushi') {
    candidates.push('black-sushi');
  }
  return [...new Set(candidates.filter(Boolean))];
}

/** Estilos genéricos white-label (CSS vars) para restaurantes sin brand.js. */
export const DEFAULT_ESTILOS = Object.freeze({
  primaryColor: 'bg-[var(--color-fondo)]',
  surfaceColor: 'bg-[var(--color-fondo)]',
  panelColor: 'bg-[var(--color-fondo)]',
  accentColor: 'bg-[var(--color-primario)]',
  accentText: 'text-[color:var(--color-texto)]',
  textColor: 'text-[color:var(--color-texto)]',
  mutedColor: 'text-[color:color-mix(in_srgb,var(--color-texto)_58%,transparent)]',
  softColor: 'text-[color:color-mix(in_srgb,var(--color-texto)_42%,transparent)]',
  cardColor: 'bg-black/25',
  borderColor: 'border-white/12',
  buttonClass: 'btn-premium',
  buttonGhost:
    'border border-white/15 bg-white/5 text-[color:var(--color-texto)] shadow-inner backdrop-blur-md hover:bg-white/10 active:scale-95',
  chipIdle:
    'border border-white/15 text-[color:color-mix(in_srgb,var(--color-texto)_70%,transparent)] bg-white/5 backdrop-blur-md',
  chipActive:
    'border border-[color:var(--color-primario)] bg-[var(--color-primario)] text-white shadow-inner',
  priceColor: 'text-[color:var(--color-texto)]',
  fontClass: '',
  displayClass: '',
  logoClass: 'tracking-[0.35em] uppercase',
});

const RESTAURANTE_SELECT_BASE = [
  'id',
  'slug',
  'nombre_comercial',
  'whatsapp_num',
  'gadget_wifi',
  'gadget_dividir_cuenta',
  'gadget_reservas',
  'gadget_llamar_mesero',
].join(', ');

const RESTAURANTE_SELECT_FULL = [
  RESTAURANTE_SELECT_BASE,
  'gadget_wifi_ssid',
  'gadget_wifi_clave',
  'gadget_mesero',
  'gadget_cuenta',
  'gadget_boutique',
  'gadget_nutricion',
  'gadget_ar',
  'color_primario',
  'color_fondo',
  'color_texto',
  'tipo_letra',
  'imagen_fondo',
  'estilo_adn',
  'menu_font',
  'direccion',
  'horarios',
  'instagram_url',
  'whatsapp_url',
  'coordenadas_maps',
  'nosotros_subtitulo',
  'nosotros_titulo',
  'nosotros_imagen',
  'nosotros_texto',
  'config_reservas',
  'config_wifi',
  'config_boutique',
  'custom_css',
  'logo_url',
  'eslogan',
  'secciones_fondo',
  'nosotros_bloques',
  'redes_sociales',
  'share_image_url',
  'app_icon_url',
  'ui_estilo',
  'home_theme',
  'nosotros_theme',
  'ubicacion_theme',
].join(', ');

/**
 * Lista de slugs publicados (build / getStaticPaths).
 * @returns {Promise<string[]>}
 */
export async function listRestauranteSlugs() {
  if (!supabase) return [];
  const { data, error } = await supabase.from('restaurantes').select('slug').order('slug');

  if (error) {
    console.error('[supabase] listRestauranteSlugs:', error.message);
    return [];
  }

  return (data ?? []).map((row) => row.slug);
}

/**
 * Si la fila pública no trae identidad visual, reintenta con service role.
 * Cubre plantillas + JSONB de marca (ui_estilo / secciones_fondo) + textos.
 * @param {Record<string, unknown>} row
 * @returns {Promise<Record<string, unknown>>}
 */
async function enrichThemesWithServiceRole(row) {
  const hasHome =
    row.home_theme != null && String(row.home_theme).trim() !== '';
  const hasNosotros =
    row.nosotros_theme != null && String(row.nosotros_theme).trim() !== '';
  const hasUbicacion =
    row.ubicacion_theme != null && String(row.ubicacion_theme).trim() !== '';
  const hasUiEstilo = row.ui_estilo != null && row.ui_estilo !== '';
  const hasSeccionesFondo =
    row.secciones_fondo != null && row.secciones_fondo !== '';

  if (hasHome && hasNosotros && hasUbicacion && hasUiEstilo && hasSeccionesFondo) {
    return row;
  }

  const service = createSupabaseServiceClient();
  if (!service || !row.id) {
    console.warn(
      '[supabase] identidad visual incompleta y no hay SUPABASE_SERVICE_ROLE_KEY para reintento.',
    );
    return row;
  }

  const { data, error } = await service
    .from('restaurantes')
    .select(
      'home_theme, nosotros_theme, ubicacion_theme, logo_url, ui_estilo, secciones_fondo, eslogan, nombre_comercial',
    )
    .eq('id', row.id)
    .maybeSingle();

  if (error) {
    console.warn('[supabase] reintento service role (identidad):', error.message);
    return row;
  }

  if (!data) return row;

  console.log('[supabase] identidad visual via service role:', {
    home_theme: data.home_theme,
    nosotros_theme: data.nosotros_theme,
    ubicacion_theme: data.ubicacion_theme,
    has_ui_estilo: data.ui_estilo != null,
    has_secciones_fondo: data.secciones_fondo != null,
  });

  return {
    ...row,
    home_theme: hasHome ? row.home_theme : data.home_theme,
    nosotros_theme: hasNosotros ? row.nosotros_theme : data.nosotros_theme,
    ubicacion_theme: hasUbicacion ? row.ubicacion_theme : data.ubicacion_theme,
    logo_url: asText(row.logo_url) || asText(data.logo_url) || row.logo_url,
    ui_estilo: hasUiEstilo ? row.ui_estilo : data.ui_estilo,
    secciones_fondo: hasSeccionesFondo
      ? row.secciones_fondo
      : data.secciones_fondo,
    eslogan: asText(row.eslogan) || data.eslogan || row.eslogan,
    nombre_comercial:
      asText(row.nombre_comercial) ||
      data.nombre_comercial ||
      row.nombre_comercial,
  };
}

/**
 * Carga fila de restaurante; incluye siempre home_theme / ubicacion_theme.
 * Preferimos select('*') para no omitir columnas de plantilla.
 * @param {string} slug
 */
async function fetchRestauranteRow(slug) {
  if (!supabase) {
    return { data: null, error: { message: 'Supabase client unavailable' } };
  }
  try {
  const withFull = await supabase
    .from('restaurantes')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (!withFull.error && withFull.data) {
    const enriched = await enrichThemesWithServiceRole(withFull.data);
    return { data: enriched, error: null };
  }

  if (!withFull.error) return withFull;

  const missingColumn = /column|does not exist|schema cache/i.test(
    withFull.error.message || '',
  );
  if (!missingColumn) return withFull;

  console.warn(
    '[supabase] select(*) falló por columna; usando SELECT base + themes.',
    withFull.error.message,
  );

  const base = await supabase
    .from('restaurantes')
    .select(RESTAURANTE_SELECT_BASE)
    .eq('slug', slug)
    .maybeSingle();

  if (base.error || !base.data) return base;

  const themes = await supabase
    .from('restaurantes')
    .select('id, home_theme, nosotros_theme, ubicacion_theme, logo_url')
    .eq('slug', slug)
    .maybeSingle();

  let merged = { ...base.data };
  if (!themes.error && themes.data) {
    merged = {
      ...merged,
      home_theme: themes.data.home_theme,
      nosotros_theme: themes.data.nosotros_theme,
      ubicacion_theme: themes.data.ubicacion_theme,
      logo_url: asText(merged.logo_url) || themes.data.logo_url,
    };
  }

  merged = await enrichThemesWithServiceRole(merged);
  return { data: merged, error: null };
  } catch (err) {
    console.error('[restaurantes] fetchRestauranteRow:', err);
    return {
      data: null,
      error: { message: err instanceof Error ? err.message : String(err) },
    };
  }
}

/**
 * Extrae dígitos / URL usable de whatsapp_url o número.
 * @param {unknown} value
 */
function resolveWhatsapp(value) {
  const raw = asText(value);
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  const digits = raw.replace(/\D/g, '');
  return digits ? `+${digits}` : raw;
}

/**
 * Sección Nosotros: Supabase gana por completo si hay algún campo.
 * @param {Record<string, unknown>} row
 * @param {ReturnType<typeof getBrandProfile>} brand
 */
function buildNosotros(row, brand) {
  const bloquesJson = parseNosotrosBloques(row.nosotros_bloques);
  if (bloquesJson.length > 0) {
    return {
      titulo: 'NOSOTROS',
      bloques: bloquesJson.map((b, i) => {
        const media = Array.isArray(b.media) && b.media.length
          ? b.media
          : b.media_url
            ? [b.media_url]
            : [];
        const primary = media[0] || null;
        return {
          titulo: b.titulo || `Bloque ${i + 1}`,
          texto: b.texto,
          contenido: b.texto,
          imagen: primary,
          media_url: primary,
          media,
          alineacion: b.alineacion,
          acentos: [],
        };
      }),
      texto: bloquesJson[0]?.texto || '',
      highlights: [],
    };
  }

  const fromDb = [
    row.nosotros_subtitulo,
    row.nosotros_titulo,
    row.nosotros_imagen,
    row.nosotros_texto,
  ].some(hasContent);

  if (fromDb) {
    return {
      titulo: 'NOSOTROS',
      bloques: [
        {
          subtitulo: asText(row.nosotros_subtitulo),
          titulo: asText(row.nosotros_titulo) || 'Nosotros',
          imagen: asText(row.nosotros_imagen) || null,
          media_url: asText(row.nosotros_imagen) || null,
          texto: asText(row.nosotros_texto),
          contenido: asText(row.nosotros_texto),
          alineacion: 'alternada',
          acentos: [],
        },
      ],
      texto: asText(row.nosotros_texto),
      highlights: [],
    };
  }

  return brand.nosotros;
}

/**
 * Ubicación / horarios: Supabase gana por completo si hay algún campo.
 * @param {Record<string, unknown>} row
 * @param {ReturnType<typeof getBrandProfile>} brand
 */
function buildUbicacion(row, brand) {
  const redes = parseRedesSociales(row.redes_sociales);
  const fromDb = [
    row.direccion,
    row.horarios,
    row.instagram_url,
    row.whatsapp_url,
    row.whatsapp_num,
    row.coordenadas_maps,
    redes.length > 0,
  ].some((v) => (typeof v === 'boolean' ? v : hasContent(v)));

  if (fromDb) {
    const horariosRaw = asText(row.horarios);
    const legacyWa = resolveWhatsapp(row.whatsapp_url) || asText(row.whatsapp_num);
    const legacyIg = asText(row.instagram_url);
    let redesFinal = redes.length > 0 ? [...redes] : [];
    if (legacyWa && !redesFinal.some((r) => r.red === 'whatsapp')) {
      redesFinal.unshift({ red: 'whatsapp', url: legacyWa, activo: true });
    }
    if (!redesFinal.some((r) => r.red === 'instagram') && legacyIg) {
      redesFinal.push({ red: 'instagram', url: legacyIg, activo: true });
    }
    const redesPublicas = redesFinal.filter((r) => r.activo !== false);
    const igPublica =
      redesPublicas.find((r) => r.red === 'instagram')?.url || '';
    const waPublica =
      redesPublicas.find((r) => r.red === 'whatsapp')?.url || legacyWa;

    return {
      titulo: 'UBICACIÓN Y HORARIOS',
      direccion: asText(row.direccion),
      ciudad: '',
      mapaLabel: 'Abrir Google Maps',
      mapaUrl: asText(row.coordenadas_maps) || 'https://maps.google.com',
      horarios: horariosRaw,
      horariosRows: normalizeHorarios(horariosRaw),
      telefono: waPublica,
      email: '',
      instagram: igPublica,
      whatsapp: waPublica,
      redes: redesPublicas,
    };
  }

  const brandUbic = brand.ubicacion;
  return {
    ...brandUbic,
    horarios:
      typeof brandUbic.horarios === 'string'
        ? brandUbic.horarios
        : Array.isArray(brandUbic.horarios)
          ? brandUbic.horarios
          : [],
    horariosRows: normalizeHorarios(brandUbic.horarios),
    redes: brandUbic.instagram
      ? [{ red: 'instagram', url: brandUbic.instagram }]
      : [],
  };
}

/**
 * Logo / tagline: prioridad absoluta Supabase; brand.js solo rellena huecos.
 * @param {Record<string, unknown>} row
 * @param {ReturnType<typeof getBrandProfile>} brand
 * @param {boolean} hasBrandProfile
 */
function buildIdentity(row, brand, hasBrandProfile) {
  const nombre = asText(row.nombre_comercial) || 'Restaurante';
  const esloganDb = asText(row.eslogan);
  const letter = nombre.charAt(0).toUpperCase() || 'R';

  if (hasBrandProfile) {
    return {
      tagline: esloganDb || asText(brand.tagline) || '',
      logoText: nombre.toUpperCase() || asText(brand.logoText) || nombre,
      logoLetter: letter || asText(brand.logoLetter) || 'R',
      estilos: brand.estilos,
      wifi: brand.wifi,
    };
  }

  return {
    tagline: esloganDb || '',
    logoText: nombre.toUpperCase(),
    logoLetter: letter,
    estilos: DEFAULT_ESTILOS,
    wifi: { ssid: '', password: '' },
  };
}

/**
 * Carga restaurante + menú. Contenido/tema: prioridad absoluta Supabase.
 *
 * @param {string} slug
 * @returns {Promise<object | null>}
 */
export async function getRestauranteBySlug(slug) {
  try {
    return await loadRestauranteBySlug(slug);
  } catch (err) {
    console.error('[getRestauranteBySlug] crash:', err);
    return null;
  }
}

/**
 * @param {string} slug
 * @returns {Promise<object | null>}
 */
async function loadRestauranteBySlug(slug) {
  if (!slug) return null;
  if (!supabase) {
    console.error('[getRestauranteBySlug] cliente Supabase no disponible');
    return null;
  }

  let row = null;
  let restError = null;

  for (const candidate of slugLookupCandidates(slug)) {
    const result = await fetchRestauranteRow(candidate);
    if (result.error) {
      restError = result.error;
      continue;
    }
    if (result.data) {
      row = result.data;
      restError = null;
      break;
    }
  }

  if (restError) {
    console.error('[supabase] restaurantes:', restError.message);
    return null;
  }
  if (!row) return null;

  // Local desactivado (impago / pausa): no exponer WebApp pública
  if (row.activo === false) return null;

  console.log('[getRestauranteBySlug] fila Supabase (completa):', row);
  console.log(
    '[getRestauranteBySlug] raw home_theme:',
    row.home_theme,
    'ubicacion_theme:',
    row.ubicacion_theme,
  );

  let categoriasRaw = [];
  let catError = null;
  let platosResult = { data: [], error: null };
  try {
    const [catRes, platosRes] = await Promise.all([
      supabase
        .from('categorias')
        .select('id, nombre, orden, bg_type, bg_valor')
        .eq('restaurante_id', row.id)
        .order('orden', { ascending: true }),
      (createSupabaseServiceClient() || supabase)
        .from('platos')
        .select(
          'id, categoria_id, nombre, descripcion, precio, imagen_url, disponible, destacado, calorias, proteinas, carbs, grasas, alergias, ingredientes_detalle, modelo_3d_url',
        )
        .eq('restaurante_id', row.id)
        .eq('disponible', true)
        .order('id', { ascending: true }),
    ]);
    categoriasRaw = catRes.data;
    catError = catRes.error;
    platosResult = platosRes;
  } catch (err) {
    console.error('[supabase] categorias/platos crash:', err);
    categoriasRaw = [];
    platosResult = { data: [], error: null };
  }

  let platos = platosResult.data;
  let platosError = platosResult.error;
  if (platosError) {
    const msg = platosError.message || '';
    console.warn('[supabase] platos SELECT fallback.', msg);
    const platosClient = createSupabaseServiceClient() || supabase;
    const missingOrden = /\borden\b/i.test(msg);
    const nutSelect = missingOrden
      ? 'id, categoria_id, nombre, descripcion, precio, imagen_url, disponible, destacado, calorias, proteinas, carbs, grasas, alergias, ingredientes_detalle, modelo_3d_url'
      : 'id, categoria_id, nombre, descripcion, precio, imagen_url, disponible, destacado, orden, calorias, proteinas, carbs, grasas, alergias, ingredientes_detalle, modelo_3d_url';
    const nutRetry = await platosClient
      .from('platos')
      .select(nutSelect)
      .eq('restaurante_id', row.id)
      .eq('disponible', true)
      .order(nutSelect.includes('orden') ? 'orden' : 'id', { ascending: true })
      .order('id', { ascending: true });
    if (!nutRetry.error) {
      platos = nutRetry.data;
      platosError = null;
    } else {
      const select = missingOrden
        ? 'id, categoria_id, nombre, descripcion, precio, imagen_url, disponible, destacado, modelo_3d_url'
        : 'id, categoria_id, nombre, descripcion, precio, imagen_url, disponible, destacado, orden, modelo_3d_url';
      const fallback = await platosClient
        .from('platos')
        .select(select)
        .eq('restaurante_id', row.id)
        .eq('disponible', true)
        .order(select.includes('orden') ? 'orden' : 'id', { ascending: true })
        .order('id', { ascending: true });
      platos = fallback.data;
      platosError = fallback.error;
    }
  }

  let categorias = categoriasRaw;
  if (catError) {
    const missingBg = /bg_type|bg_valor|column|schema cache/i.test(catError.message || '');
    if (missingBg) {
      console.warn('[supabase] categorias bg_* no disponibles; SELECT sin fondos.', catError.message);
      const fallback = await supabase
        .from('categorias')
        .select('id, nombre, orden')
        .eq('restaurante_id', row.id)
        .order('orden', { ascending: true });
      if (fallback.error) {
        console.error('[supabase] categorias:', fallback.error.message);
        return null;
      }
      categorias = fallback.data;
    } else {
      console.error('[supabase] categorias:', catError.message);
      return null;
    }
  }
  if (platosError) {
    console.error('[supabase] platos:', platosError.message);
    return null;
  }

  const platosByCategoria = new Map();
  /** @type {Array<{ id: number, nombre: string, descripcion: string, precio: string, imagenUrl: string | null, destacado: boolean, categoriaId: string, categoriaNombre: string }>} */
  const destacados = [];

  const catNombreById = new Map((categorias ?? []).map((c) => [c.id, c.nombre]));

  for (const plato of platos ?? []) {
    const key = plato.categoria_id;
    if (!platosByCategoria.has(key)) platosByCategoria.set(key, []);
    const imagenUrl =
      typeof plato.imagen_url === 'string' && plato.imagen_url.trim()
        ? platoFillUrl(plato.imagen_url.trim(), { w: 1200, h: 900 })
        : null;

    const mapped = {
      id: plato.id,
      nombre: plato.nombre,
      descripcion: plato.descripcion ?? '',
      precio: formatPrecio(plato.precio),
      imagenUrl,
      destacado: Boolean(plato.destacado),
      categoriaId: String(plato.categoria_id),
      categoriaNombre: catNombreById.get(plato.categoria_id) ?? 'Menú',
      calorias: plato.calorias == null ? null : Number(plato.calorias),
      proteinas: plato.proteinas == null ? null : Number(plato.proteinas),
      carbs: plato.carbs == null ? null : Number(plato.carbs),
      grasas: plato.grasas == null ? null : Number(plato.grasas),
      alergias: normalizeAlergias(plato.alergias),
      ingredientesDetalle: plato.ingredientes_detalle ?? '',
      modelo3dUrl: asText(plato.modelo_3d_url),
    };

    platosByCategoria.get(key).push(mapped);
    if (mapped.destacado) destacados.push(mapped);
  }

  const menuCategorias = (categorias ?? []).map((cat) => ({
    id: String(cat.id),
    nombre: cat.nombre,
    bgType: asText(cat.bg_type) || 'color',
    bgValor: asText(cat.bg_valor),
    platos: platosByCategoria.get(cat.id) ?? [],
  }));

  const resolvedSlug = slug || row.slug;
  const brand = getBrandProfile(resolvedSlug);
  const hasBrandProfile = hasLocalBrandProfile(resolvedSlug);

  const identity = buildIdentity(row, brand, hasBrandProfile);
  const nosotros = buildNosotros(row, brand);
  const ubicacion = buildUbicacion(row, brand);

  // WhatsApp operativo: columna dedicada → whatsapp_num → brand
  const whatsapp =
    resolveWhatsapp(row.whatsapp_url) ||
    asText(row.whatsapp_num) ||
    asText(ubicacion.whatsapp);

  if (!ubicacion.whatsapp && whatsapp) {
    ubicacion.whatsapp = whatsapp;
  }
  if (!ubicacion.telefono && whatsapp) {
    ubicacion.telefono = whatsapp;
  }

  // Tema: fila Supabase primero (theme.js); brand.tema solo si faltan columnas
  const theme = resolveRestaurantTheme(row, resolvedSlug);

  const configWifi = parseJsonConfig(row.config_wifi);
  const reservas = parseReservasConfig(row.config_reservas);
  const boutique = parseBoutiqueConfig(row.config_boutique);
  const seccionesFondo = parseSeccionesFondo(row.secciones_fondo);
  const uiEstilo = parseUiEstilo(row.ui_estilo);
  // Alias legacy: columna custom_css → ui_estilo.css_avanzado
  if (!uiEstilo.css_avanzado) {
    const legacyCss = sanitizeCustomCss(row.custom_css);
    if (legacyCss) uiEstilo.css_avanzado = legacyCss;
  }

  const wifiSsid =
    asText(row.gadget_wifi_ssid) ||
    asText(configWifi.ssid) ||
    asText(identity.wifi?.ssid) ||
    '';
  const wifiPassword =
    asText(row.gadget_wifi_clave) ||
    asText(configWifi.password) ||
    asText(identity.wifi?.password) ||
    '';

  const logoUrl = resolveMediaUrl(row.logo_url) || '';
  const shareImageUrl = resolveMediaUrl(row.share_image_url) || logoUrl;
  const appIconUrl = resolveMediaUrl(row.app_icon_url) || logoUrl;
  const eslogan =
    asText(row.eslogan) || asText(identity.tagline) || '';
  const taglineSuperior = String(
    uiEstilo?.home?.tagline_superior || '',
  ).trim();
  const logoText =
    asText(row.nombre_comercial).toUpperCase() ||
    identity.logoText ||
    'RESTAURANTE';

  const fondoHomeRaw = resolveSectionFondo(seccionesFondo, 'home', {
    tipo: asText(row.imagen_fondo) ? 'image' : 'color',
    valor: asText(row.imagen_fondo) || asText(row.color_fondo) || theme.colorFondo,
  });
  let fondoHome = fondoHomeRaw;
  if (fondoHomeRaw.tipo === 'image' || fondoHomeRaw.tipo === 'video') {
    fondoHome = {
      ...fondoHomeRaw,
      valor: resolveMediaUrl(fondoHomeRaw.valor) || fondoHomeRaw.valor,
    };
  } else if (fondoHomeRaw.tipo === 'carrusel') {
    const urls = String(fondoHomeRaw.valor || '')
      .split(/[\n,;]+/)
      .map((u) => u.trim())
      .filter(Boolean)
      .map((u) => resolveMediaUrl(u) || u);
    fondoHome = {
      ...fondoHomeRaw,
      valor: urls.join('\n'),
    };
  }
  const fondoNosotros = resolveSectionFondo(seccionesFondo, 'nosotros');
  const fondoMenu = resolveSectionFondo(seccionesFondo, 'menu');
  const fondoUbicacion = resolveSectionFondo(seccionesFondo, 'ubicacion');

  const uiCssVars = uiEstiloToCssVars(uiEstilo, theme.colorPrimario);

  // Preservar valor RAW de Supabase (sanitize solo en [slug] / RestaurantApp)
  const homeThemeRaw = row.home_theme ?? /** @type {any} */ (uiEstilo).home_theme ?? null;
  const nosotrosThemeRaw =
    row.nosotros_theme ??
    /** @type {any} */ (uiEstilo)?.nosotros?.theme ??
    /** @type {any} */ (uiEstilo).nosotros_theme ??
    null;
  const ubicacionThemeRaw =
    row.ubicacion_theme ?? /** @type {any} */ (uiEstilo).ubicacion_theme ?? null;
  const homeTheme = normalizeHomeTheme(homeThemeRaw);
  const nosotrosTheme = normalizeNosotrosTheme(nosotrosThemeRaw);
  const ubicacionTheme = normalizeUbicacionTheme(ubicacionThemeRaw);

  return {
    ...identity,
    tagline: eslogan || identity.tagline,
    eslogan,
    taglineSuperior,
    logoUrl,
    logo_url: logoUrl,
    logo: logoUrl,
    shareImageUrl,
    appIconUrl,
    logoText,
    logoLetter: identity.logoLetter,
    id: row.id,
    slug: row.slug,
    nombre: row.nombre_comercial,
    whatsapp,
    theme,
    uiEstilo,
    uiCssVars,
    homeTheme,
    nosotrosTheme,
    ubicacionTheme,
    /** RAW desde public.restaurantes — no sobrescribir con sanitize */
    home_theme: homeThemeRaw,
    nosotros_theme: nosotrosThemeRaw,
    ubicacion_theme: ubicacionThemeRaw,
    customCss: sanitizeCustomCss(row.custom_css),
    seccionesFondo: {
      home: fondoHome,
      nosotros: fondoNosotros,
      menu: fondoMenu,
      ubicacion: fondoUbicacion,
    },
    gadgets: {
      wifi: Boolean(row.gadget_wifi),
      dividirCuenta:
        Boolean(row.gadget_cuenta) || Boolean(row.gadget_dividir_cuenta),
      reservas: Boolean(row.gadget_reservas),
      llamarMesero:
        Boolean(row.gadget_mesero) || Boolean(row.gadget_llamar_mesero),
      boutique: Boolean(row.gadget_boutique),
      nutricion: Boolean(row.gadget_nutricion),
      ar: Boolean(row.gadget_ar),
    },
    wifi: {
      ssid: wifiSsid,
      password: wifiPassword,
    },
    reservas,
    boutique: {
      productos: Array.isArray(boutique?.productos)
        ? boutique.productos.filter((p) => p?.activo)
        : [],
      catalogo: Array.isArray(boutique?.productos) ? boutique.productos : [],
    },
    nosotros,
    ubicacion,
    menu: {
      categorias: menuCategorias,
      destacados,
    },
  };
}
