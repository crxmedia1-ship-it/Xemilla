import { supabase } from '../config/db.js';
import { getBrandProfile } from '../config/brand.js';

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
 * Lista de slugs publicados (build / getStaticPaths).
 * @returns {Promise<string[]>}
 */
export async function listRestauranteSlugs() {
  const { data, error } = await supabase.from('restaurantes').select('slug').order('slug');

  if (error) {
    console.error('[supabase] listRestauranteSlugs:', error.message);
    return [];
  }

  return (data ?? []).map((row) => row.slug);
}

/**
 * Carga restaurante + categorías ordenadas + platos disponibles.
 * Combina datos de Supabase con el perfil de marca (tema / copy UI).
 *
 * @param {string} slug
 * @returns {Promise<object | null>}
 */
export async function getRestauranteBySlug(slug) {
  if (!slug) return null;

  const { data: row, error: restError } = await supabase
    .from('restaurantes')
    .select(
      'id, slug, nombre_comercial, whatsapp_num, gadget_wifi, gadget_dividir_cuenta',
    )
    .eq('slug', slug)
    .maybeSingle();

  if (restError) {
    console.error('[supabase] restaurantes:', restError.message);
    return null;
  }
  if (!row) return null;

  const [{ data: categorias, error: catError }, { data: platos, error: platosError }] =
    await Promise.all([
      supabase
        .from('categorias')
        .select('id, nombre, orden')
        .eq('restaurante_id', row.id)
        .order('orden', { ascending: true }),
      supabase
        .from('platos')
        .select('id, categoria_id, nombre, descripcion, precio, imagen_url, disponible')
        .eq('restaurante_id', row.id)
        .eq('disponible', true)
        .order('id', { ascending: true }),
    ]);

  if (catError) {
    console.error('[supabase] categorias:', catError.message);
    return null;
  }
  if (platosError) {
    console.error('[supabase] platos:', platosError.message);
    return null;
  }

  const platosByCategoria = new Map();
  for (const plato of platos ?? []) {
    const key = plato.categoria_id;
    if (!platosByCategoria.has(key)) platosByCategoria.set(key, []);
    platosByCategoria.get(key).push({
      id: plato.id,
      nombre: plato.nombre,
      descripcion: plato.descripcion ?? '',
      precio: formatPrecio(plato.precio),
      imagenUrl: plato.imagen_url,
    });
  }

  const menuCategorias = (categorias ?? []).map((cat) => ({
    id: String(cat.id),
    nombre: cat.nombre,
    platos: platosByCategoria.get(cat.id) ?? [],
  }));

  const brand = getBrandProfile(row.slug);
  const telefono = row.whatsapp_num || brand.ubicacion.telefono;

  return {
    ...brand,
    id: row.id,
    slug: row.slug,
    nombre: row.nombre_comercial,
    whatsapp: row.whatsapp_num,
    gadgets: {
      wifi: Boolean(row.gadget_wifi),
      dividirCuenta: Boolean(row.gadget_dividir_cuenta),
    },
    ubicacion: {
      ...brand.ubicacion,
      telefono,
    },
    menu: {
      categorias: menuCategorias,
    },
  };
}
