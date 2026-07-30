/**
 * Props blindadas para temas Home (editorial / hero / minimal / bento).
 * Evita TypeError por undefined → flash/crash y fallback silencioso.
 */
import { resolveMediaUrl } from './cloudinary.js';

/** Fallback local (evita importar restaurantes.js → supabase en cada Home). */
const DEFAULT_ESTILOS = Object.freeze({
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

/**
 * @param {unknown} value
 * @param {string} [fallback='']
 */
function str(value, fallback = '') {
  if (value == null) return fallback;
  const s = String(value).trim();
  return s || fallback;
}

/**
 * @param {Record<string, unknown> | null | undefined} raw
 */
export function resolveSafeEstilos(raw) {
  const base = { ...DEFAULT_ESTILOS };
  if (!raw || typeof raw !== 'object') return base;
  for (const [key, value] of Object.entries(raw)) {
    if (value != null && String(value).trim() !== '') {
      base[key] = value;
    }
  }
  return base;
}

/**
 * Normaliza props de un tema Home (desde RestaurantApp o props sueltas).
 * Acepta también un objeto `restaurante` anidado.
 *
 * @param {Record<string, any>} [props={}]
 * @returns {{
 *   nombre: string,
 *   logoText: string,
 *   logoLetter: string,
 *   logoUrl: string | null,
 *   tagline: string,
 *   menuLink: string,
 *   estilos: Record<string, string>,
 *   showWifi: boolean,
 *   showDividir: boolean,
 *   showLlamarMesero: boolean,
 *   showBoutique: boolean,
 *   wifiSsid: string,
 *   wifiClave: string,
 *   reservasCta: { label: string, href: string } | null,
 *   homeUi: Record<string, unknown>,
 *   onOpenUbicacion: (() => void) | null,
 *   onOpenNosotros: (() => void) | null,
 *   onOpenMenu: (() => void) | null,
 * }}
 */
export function resolveSafeHomeProps(props = {}) {
  const r =
    props?.restaurante && typeof props.restaurante === 'object'
      ? props.restaurante
      : props;

  const slug = str(r?.slug || props?.slug);
  const nombre = str(
    r?.nombre || r?.nombre_comercial || props?.nombre,
    'Restaurante',
  );
  const tagline = str(
    props?.tagline || r?.tagline || r?.eslogan || props?.eslogan,
    '',
  );
  const logoText = str(props?.logoText || r?.logoText || nombre, nombre);
  const logoLetter = str(
    props?.logoLetter || r?.logoLetter || nombre.charAt(0) || 'R',
    'R',
  )
    .slice(0, 1)
    .toUpperCase();

  let logoUrl = null;
  try {
    logoUrl = resolveMediaUrl(
      props?.logoUrl ||
        props?.logo_url ||
        r?.logo_url ||
        r?.logoUrl ||
        r?.logo ||
        '',
    );
  } catch (e) {
    console.error('Error resolviendo logo Home:', e);
    logoUrl = null;
  }

  const menuLink = str(
    props?.menuLink ||
      props?.menu_link ||
      r?.menu_link ||
      r?.menuLink ||
      (slug ? `/${slug}/menu` : ''),
    slug ? `/${slug}/menu` : '/menu',
  );

  const reservasRaw = props?.reservasCta ?? r?.reservasCta ?? null;
  const reservasCta =
    reservasRaw && typeof reservasRaw === 'object' && (str(reservasRaw.href) || reservasRaw.activo)
      ? {
          label: str(reservasRaw.label, 'PEDIR / RESERVAR'),
          href: str(reservasRaw.href, '#'),
          subtitulo: str(reservasRaw.subtitulo, 'EXPERIENCIA PREMIUM'),
          activo: reservasRaw.activo !== false,
        }
      : null;

  const safeHandler = (fn) => (typeof fn === 'function' ? fn : null);

  return {
    nombre,
    logoText,
    logoLetter,
    logoUrl: logoUrl || null,
    tagline,
    menuLink,
    estilos: resolveSafeEstilos(props?.estilos || r?.estilos),
    showWifi: Boolean(props?.showWifi),
    showDividir: Boolean(props?.showDividir),
    showLlamarMesero: Boolean(props?.showLlamarMesero),
    showBoutique: Boolean(props?.showBoutique),
    wifiSsid: str(props?.wifiSsid || r?.wifi?.ssid, ''),
    wifiClave: str(props?.wifiClave || r?.wifi?.password || r?.wifi?.clave, ''),
    reservasCta,
    homeUi:
      props?.homeUi && typeof props.homeUi === 'object' ? props.homeUi : {},
    onOpenUbicacion: safeHandler(props?.onOpenUbicacion),
    onOpenNosotros: safeHandler(props?.onOpenNosotros),
    onOpenMenu: safeHandler(props?.onOpenMenu),
  };
}

/**
 * Invoca un callback solo si es función (handlers de modales / overlays).
 * @param {(() => void) | null | undefined} fn
 */
export function callSafe(fn) {
  if (typeof fn === 'function') {
    try {
      fn();
    } catch (e) {
      console.error('Error en handler Home:', e);
    }
  }
}
