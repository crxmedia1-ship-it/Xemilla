/**
 * Boutique / merch: defaults + normalización de config_boutique.
 */

/** @typedef {{ id: string, nombre: string, precio: number, imagen_url: string, activo: boolean }} BoutiqueProducto */

/** @type {BoutiqueProducto[]} */
export const DEFAULT_BOUTIQUE_PRODUCTOS = [
  {
    id: 'gorra',
    nombre: 'Gorra',
    precio: 18,
    imagen_url: '',
    activo: true,
  },
  {
    id: 'camisa',
    nombre: 'Camisa',
    precio: 35,
    imagen_url: '',
    activo: true,
  },
  {
    id: 'termo',
    nombre: 'Termo',
    precio: 22,
    imagen_url: '',
    activo: true,
  },
  {
    id: 'tote',
    nombre: 'Tote bag',
    precio: 15,
    imagen_url: '',
    activo: false,
  },
];

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function asObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return /** @type {Record<string, unknown>} */ (value);
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      /* ignore */
    }
  }
  return {};
}

/**
 * @param {unknown} raw
 * @returns {BoutiqueProducto}
 */
function normalizeProducto(raw, index = 0) {
  const row =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? /** @type {Record<string, unknown>} */ (raw)
      : {};
  const id =
    String(row.id || row.slug || `item-${index + 1}`)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .slice(0, 40) || `item-${index + 1}`;
  const nombre = String(row.nombre || row.name || 'Producto').trim().slice(0, 80) || 'Producto';
  const precioRaw = Number(row.precio ?? row.price ?? 0);
  const precio = Number.isFinite(precioRaw) && precioRaw >= 0 ? precioRaw : 0;
  const imagen_url = String(row.imagen_url || row.imagen || row.image || '')
    .trim()
    .slice(0, 500);
  const activo =
    row.activo === undefined && row.enabled === undefined
      ? true
      : Boolean(row.activo ?? row.enabled);

  return { id, nombre, precio, imagen_url, activo };
}

/**
 * @param {unknown} configRaw
 * @returns {{ productos: BoutiqueProducto[], titulo: string, catalogo_url: string }}
 */
export function parseBoutiqueConfig(configRaw) {
  const cfg = asObject(configRaw);
  const list = Array.isArray(cfg.productos)
    ? cfg.productos
    : Array.isArray(cfg.products)
      ? cfg.products
      : null;

  const titulo = String(cfg.titulo || cfg.title || cfg.nombre || 'Boutique').trim().slice(0, 80);
  const catalogo_url = String(
    cfg.catalogo_url || cfg.catalogo || cfg.url || cfg.href || '',
  )
    .trim()
    .slice(0, 500);

  if (!list || list.length === 0) {
    return {
      productos: DEFAULT_BOUTIQUE_PRODUCTOS.map((p) => ({ ...p })),
      titulo: titulo || 'Boutique',
      catalogo_url,
    };
  }

  return {
    productos: list.slice(0, 12).map((item, i) => normalizeProducto(item, i)),
    titulo: titulo || 'Boutique',
    catalogo_url,
  };
}

/**
 * Productos activos para la WebApp pública.
 * @param {unknown} configRaw
 * @returns {BoutiqueProducto[]}
 */
export function getBoutiqueProductosActivos(configRaw) {
  return parseBoutiqueConfig(configRaw).productos.filter((p) => p.activo);
}

/**
 * Normaliza payload de API / form a JSON persistible.
 * @param {unknown} rawProductos
 * @param {{ titulo?: string, catalogo_url?: string }} [meta]
 * @returns {{ productos: BoutiqueProducto[], titulo: string, catalogo_url: string }}
 */
export function buildBoutiqueConfig(rawProductos, meta = {}) {
  const list = Array.isArray(rawProductos) ? rawProductos : [];
  const titulo = String(meta.titulo || 'Boutique').trim().slice(0, 80) || 'Boutique';
  const catalogo_url = String(meta.catalogo_url || '')
    .trim()
    .slice(0, 500);
  if (list.length === 0) {
    return {
      productos: DEFAULT_BOUTIQUE_PRODUCTOS.map((p) => ({ ...p })),
      titulo,
      catalogo_url,
    };
  }
  return {
    productos: list.slice(0, 12).map((item, i) => normalizeProducto(item, i)),
    titulo,
    catalogo_url,
  };
}
