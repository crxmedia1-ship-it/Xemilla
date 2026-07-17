/**
 * Tokens de marca blanca (white-label) para la WebApp pública.
 * Prioridad: columnas Supabase (no vacías) → brand.js (solo huecos) → defaults.
 */

import { getBrandProfile } from '../config/brand.js';
import {
  resolveDesignDna,
  designDnaToCssVars,
  DEFAULT_DESIGN_DNA,
} from '../config/themes.js';
import { resolveMenuFont, mergeGoogleFontHrefs } from '../config/menu-fonts.js';

export const DEFAULT_THEME = Object.freeze({
  colorPrimario: '#9f1239',
  colorFondo: '#0a0a0a',
  colorTexto: '#ffffff',
  tipoLetra: null,
  imagenFondo: null,
  designDnaId: DEFAULT_DESIGN_DNA,
});

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function nonEmptyText(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  return v ? v : null;
}

/**
 * @param {unknown} value
 * @param {string} fallback
 */
function pickColor(value, fallback) {
  const v = nonEmptyText(value);
  if (!v) return fallback;
  if (
    /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v) ||
    /^(rgb|hsl)a?\(/i.test(v)
  ) {
    return v;
  }
  return fallback;
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function pickCustomFont(value) {
  const v = nonEmptyText(value)?.replace(/["']/g, '') ?? null;
  if (!v || /[;{}]|url\(/i.test(v)) return null;
  return v.includes(',') ? v : `${v}, ui-sans-serif, system-ui, sans-serif`;
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function pickImageUrl(value) {
  const v = nonEmptyText(value);
  if (!v) return null;
  if (!/^https?:\/\//i.test(v) && !v.startsWith('/')) return null;
  return v;
}

/**
 * True si la fila trae al menos un token estético desde Supabase.
 * @param {Record<string, unknown> | null | undefined} row
 */
function rowHasThemeColumns(row) {
  if (!row) return false;
  return [
    row.color_primario,
    row.color_fondo,
    row.color_texto,
    row.tipo_letra,
    row.imagen_fondo,
    row.estilo_adn,
    row.menu_font,
  ].some((v) => nonEmptyText(v) != null);
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 * @param {string} slug
 */
function mergeThemeSources(row, slug) {
  const fromDb = rowHasThemeColumns(row);

  // Si Supabase ya tiene tokens, NO mezclar brand.js
  if (fromDb) {
    return {
      color_primario: nonEmptyText(row?.color_primario),
      color_fondo: nonEmptyText(row?.color_fondo),
      color_texto: nonEmptyText(row?.color_texto),
      tipo_letra: nonEmptyText(row?.tipo_letra),
      imagen_fondo: nonEmptyText(row?.imagen_fondo),
      estilo_adn: nonEmptyText(row?.estilo_adn),
      menu_font: nonEmptyText(row?.menu_font),
    };
  }

  const brand = getBrandProfile(slug || String(row?.slug || ''));
  const tema = brand.tema && typeof brand.tema === 'object' ? brand.tema : {};

  return {
    color_primario: nonEmptyText(tema.color_primario),
    color_fondo: nonEmptyText(tema.color_fondo),
    color_texto: nonEmptyText(tema.color_texto),
    tipo_letra: nonEmptyText(tema.tipo_letra),
    imagen_fondo: nonEmptyText(tema.imagen_fondo),
    estilo_adn: nonEmptyText(tema.estilo_adn),
    menu_font: nonEmptyText(tema.menu_font),
  };
}

/**
 * Resuelve el tema del restaurante (Supabase → brand → defaults).
 * @param {Record<string, unknown> | null | undefined} row
 * @param {string} [slug]
 */
export function resolveRestaurantTheme(row, slug = '') {
  const resolvedSlug = slug || String(row?.slug || '');
  const effective = mergeThemeSources(row, resolvedSlug);
  const dna = resolveDesignDna(effective, resolvedSlug);
  const customFont = pickCustomFont(effective.tipo_letra);
  const imagenFondo = pickImageUrl(effective.imagen_fondo);
  const menuFont = resolveMenuFont(effective.menu_font);

  return {
    colorPrimario: pickColor(effective.color_primario, DEFAULT_THEME.colorPrimario),
    colorFondo: pickColor(effective.color_fondo, DEFAULT_THEME.colorFondo),
    colorTexto: pickColor(effective.color_texto, DEFAULT_THEME.colorTexto),
    tipoLetra: customFont || dna.fonts.stack,
    imagenFondo,
    designDnaId: dna.id,
    design: dna,
    menuFontId: menuFont.id,
    menuFontStack: menuFont.stack,
    googleFontsHref: mergeGoogleFontHrefs(dna.fonts.googleHref, menuFont.googleHref),
  };
}

/**
 * Serializa colores + ADN a variables CSS del contenedor.
 * @param {ReturnType<typeof resolveRestaurantTheme>} theme
 */
export function themeToCssVars(theme) {
  const img =
    theme.imagenFondo != null
      ? `url("${String(theme.imagenFondo).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}")`
      : 'none';

  const dnaVars = theme.design
    ? designDnaToCssVars(theme.design)
    : designDnaToCssVars(resolveDesignDna(null));

  return [
    dnaVars,
    `--color-primario: ${theme.colorPrimario}`,
    `--color-fondo: ${theme.colorFondo}`,
    `--color-texto: ${theme.colorTexto}`,
    `--fuente-principal: ${theme.tipoLetra}`,
    `--fuente-menu: ${theme.menuFontStack || theme.design?.fonts?.display || theme.tipoLetra}`,
    `--imagen-fondo: ${img}`,
  ].join('; ');
}
