/** Productos que Xemilla cobra a un restaurante. */
export const VENTA_PRODUCTOS = [
  { id: 'setup', label: 'Pago único' },
  { id: 'anual', label: 'Licencia anual' },
  { id: 'ar', label: 'Realidad aumentada' },
  { id: 'nutri', label: 'Ficha nutricional' },
  { id: 'tent', label: 'Acrílico' },
  { id: 'nfc', label: 'Tag NFC' },
  { id: 'plate', label: 'Placa' },
  { id: 'ia', label: 'Klientiq instalación' },
  { id: 'ia-mensual', label: 'Klientiq mensual' },
  { id: 'shop', label: 'Tienda' },
  { id: 'loyalty', label: 'Tarjeta de fidelidad' },
];

const VENTA_IDS = new Set(VENTA_PRODUCTOS.map((item) => item.id));
const VENTA_MONEDAS = new Set(['usd', 'bs']);

/**
 * @param {unknown} value
 */
export function ventaProductoLabel(value) {
  const id = String(value || '').trim();
  return VENTA_PRODUCTOS.find((item) => item.id === id)?.label || '';
}

/**
 * @param {unknown} value
 */
export function isVentaProducto(value) {
  return VENTA_IDS.has(String(value || '').trim());
}

/**
 * @param {unknown} value
 */
export function isVentaMoneda(value) {
  return VENTA_MONEDAS.has(String(value || '').trim());
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function readVentaMonto(value) {
  const raw = String(value ?? '')
    .trim()
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.');
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) return '';
  return amount.toFixed(2);
}

/**
 * @param {unknown} value
 * @param {unknown} moneda
 */
export function formatVentaMonto(value, moneda) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '';
  const [ints, decs] = amount.toFixed(2).split('.');
  const grouped = ints.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const body = decs === '00' ? grouped : `${grouped},${decs}`;
  return String(moneda) === 'bs' ? `${body} Bs` : `${body} USD`;
}

/**
 * @param {Array<{ monto?: unknown, moneda?: unknown }>} rows
 */
export function resumenVentas(rows) {
  const sums = { usd: 0, bs: 0 };
  for (const row of rows) {
    const moneda = String(row.moneda || '') === 'bs' ? 'bs' : 'usd';
    const amount = Number(row.monto);
    if (Number.isFinite(amount)) sums[moneda] += amount;
  }
  const parts = [];
  if (sums.usd > 0) parts.push(formatVentaMonto(sums.usd, 'usd'));
  if (sums.bs > 0) parts.push(formatVentaMonto(sums.bs, 'bs'));
  return parts.join(' · ');
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 */
export async function listRestauranteVentas(client) {
  const { data, error } = await client
    .from('restaurante_ventas')
    .select('id, restaurante_id, producto, monto, moneda, created_at')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[ventas]', error.message);
    return [];
  }
  return Array.isArray(data) ? data : [];
}
