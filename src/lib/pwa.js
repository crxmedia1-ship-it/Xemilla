import { squareAppIconUrl } from './cloudinary.js';

const BRAND_ICON = {
  apple: '/icons/apple-touch-icon.png',
  icon192: '/icons/icon-192.png',
  icon512: '/icons/icon-512.png',
};

/**
 * Plato del ícono. Un negro o un blanco plano tapa el logo;
 * un color de marca real se queda.
 * @param {unknown} color
 */
function iconPlate(color) {
  const hex = String(color || '')
    .trim()
    .match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
  if (!hex) return '#f4efe6';
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (lum < 0.2) return '#f4efe6';
  if (lum > 0.9) return '#171717';
  return `#${full.toLowerCase()}`;
}

/**
 * Nombre corto para el ícono de inicio (iOS recorta cerca de 12 caracteres).
 * @param {unknown} name
 */
export function pwaShortName(name) {
  const label = String(name || 'Menú').replace(/\s+/g, ' ').trim() || 'Menú';
  if (label.length <= 12) return label;
  return label.slice(0, 12).trim();
}

/**
 * Manifiesto e íconos cuadrados de la webapp de un restaurante.
 * @param {{ slug?: string, nombre?: string, tagline?: string, theme?: { colorFondo?: string }, appIconUrl?: string, logoUrl?: string }} restaurante
 */
export function buildRestaurantPwa(restaurante) {
  const slug = String(restaurante?.slug || '').trim();
  const name = String(restaurante?.nombre || 'Menú').replace(/\s+/g, ' ').trim() || 'Menú';
  const shortName = pwaShortName(name);
  const background = iconPlate(restaurante?.theme?.colorFondo);
  const source = String(restaurante?.appIconUrl || restaurante?.logoUrl || '').trim();
  const appleIcon = source
    ? squareAppIconUrl(source, { size: 180, background, padding: 0.18 })
    : BRAND_ICON.apple;
  const icon192 = source
    ? squareAppIconUrl(source, { size: 192, background, padding: 0.18 })
    : BRAND_ICON.icon192;
  const icon512 = source
    ? squareAppIconUrl(source, { size: 512, background, padding: 0.18 })
    : BRAND_ICON.icon512;
  const iconMaskable = source
    ? squareAppIconUrl(source, { size: 512, background, padding: 0.28 })
    : BRAND_ICON.icon512;
  const description =
    String(restaurante?.tagline || '').trim() || `${name} · menú y experiencia`;
  const sucursalSlug = restaurante?.multiSucursal ? String(restaurante?.sucursal?.slug || '') : '';
  const scopePath = `/${slug}/`;
  const startPath = sucursalSlug ? `/${slug}/${sucursalSlug}/` : scopePath;

  return {
    slug,
    name,
    shortName,
    themeColor: background,
    appleIcon,
    swScope: scopePath,
    manifestHref: `/${slug}/manifest.webmanifest${sucursalSlug ? `?sucursal=${sucursalSlug}` : ''}`,
    manifest: {
      id: scopePath,
      name,
      short_name: shortName,
      description,
      start_url: startPath,
      scope: scopePath,
      display: 'standalone',
      background_color: background,
      theme_color: background,
      lang: 'es',
      icons: [
        { src: icon192, sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: icon512, sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: iconMaskable, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
  };
}
