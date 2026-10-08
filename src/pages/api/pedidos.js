import { getRestauranteBySlug } from '../../lib/restaurantes.js';
import { createSupabaseServiceClient } from '../../lib/supabase/service.js';
import { fetchTasasCambio } from '../../lib/tasas-cambio.js';
import {
  PEDIDO_LIMITES,
  buildMensajePedido,
  generarCodigoPedido,
  normalizeCantidad,
  resolverSeleccion,
  round2,
  validarDatosPedido,
  waNumero,
} from '../../lib/pedidos.js';

export const prerender = false;

const THROTTLE_MS = 60_000;
/**
 * Best-effort por instancia serverless, por IP y minuto: 30 intentos
 * (incluye errores de formulario) y 6 pedidos válidos.
 * @type {Map<string, number[]>}
 */
const recentAttempts = new Map();
/** @type {Map<string, number[]>} */
const recentOrders = new Map();

/**
 * @param {Map<string, number[]>} store
 * @param {string} key
 * @param {number} max
 */
function isThrottled(store, key, max) {
  const now = Date.now();
  const hits = (store.get(key) || []).filter((t) => now - t < THROTTLE_MS);
  if (hits.length >= max) return true;
  hits.push(now);
  if (store.size > 5_000) store.clear();
  store.set(key, hits);
  return false;
}

/** @param {{ clientAddress: string }} ctx */
function clientIp(ctx) {
  try {
    return ctx.clientAddress || 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Recibe el carrito de la carta pública, recalcula precios contra la BD,
 * guarda el pedido y devuelve el mensaje listo para WhatsApp.
 * POST { slug, sucursal?, modo, mesa?, cliente, metodo_pago?, referencia?, notas?, items: [{ plato_id, cantidad, opciones, nota? }] }
 */
export async function POST(ctx) {
  /** @type {Record<string, any>} */
  let raw = {};
  try {
    raw = await ctx.request.json();
  } catch {
    return json({ error: 'Cuerpo inválido' }, 400);
  }

  const slug = String(raw.slug || '').trim().toLowerCase();
  if (!slug) return json({ error: 'Restaurante requerido' }, 400);

  const ip = clientIp(ctx);
  if (isThrottled(recentAttempts, ip, 30)) {
    return json({ error: 'Demasiados intentos seguidos. Espera un minuto.' }, 429);
  }

  const restaurante = await getRestauranteBySlug(slug, { sucursal: raw.sucursal || null });
  if (!restaurante || restaurante.requiereSucursal) {
    return json({ error: 'Restaurante no disponible' }, 404);
  }
  if (!restaurante.gadgets?.pedidos) {
    return json({ error: 'Este restaurante no recibe pedidos en línea' }, 403);
  }

  const whatsapp = waNumero(restaurante.whatsapp);
  if (!whatsapp) {
    return json({ error: 'El restaurante no tiene WhatsApp configurado' }, 409);
  }

  const validacion = validarDatosPedido(raw, restaurante.pedidos);
  if (!validacion.ok) return json({ error: validacion.error }, 400);
  const { datos } = validacion;

  const itemsIn = Array.isArray(raw.items) ? raw.items : [];
  if (!itemsIn.length) return json({ error: 'Tu pedido está vacío' }, 400);
  if (itemsIn.length > PEDIDO_LIMITES.items) return json({ error: 'Pedido demasiado grande' }, 400);

  /** @type {Map<number, any>} */
  const platos = new Map();
  for (const cat of restaurante.menu?.categorias || []) {
    for (const p of cat.platos || []) platos.set(Number(p.id), p);
  }

  const lineas = [];
  for (const item of itemsIn) {
    const plato = platos.get(Number(item?.plato_id));
    if (!plato) {
      return json({ error: 'Un plato de tu pedido ya no está disponible. Revisa el carrito.' }, 409);
    }
    const sel = resolverSeleccion(plato.opciones || [], item?.opciones);
    if (!sel.ok) return json({ error: `${plato.nombre}: ${sel.error}` }, 400);
    const cantidad = normalizeCantidad(item?.cantidad);
    const unitario = round2(plato.precioUsd + sel.extra);
    lineas.push({
      plato_id: Number(plato.id),
      nombre: plato.nombre,
      cantidad,
      unitario,
      total: round2(unitario * cantidad),
      opciones: sel.seleccion,
      detalle: sel.detalle,
      nota: String(item?.nota ?? '').replace(/\s+/g, ' ').trim().slice(0, 140),
    });
  }

  if (isThrottled(recentOrders, ip, 6)) {
    return json({ error: 'Demasiados pedidos seguidos. Espera un minuto.' }, 429);
  }

  const totalUsd = round2(lineas.reduce((acc, l) => acc + l.total, 0));
  let tasaBcv = null;
  try {
    const tasas = await fetchTasasCambio();
    tasaBcv = Number(tasas?.usdVes) > 0 ? Number(tasas.usdVes) : null;
  } catch {
    tasaBcv = null;
  }

  const codigo = generarCodigoPedido();
  const mensaje = buildMensajePedido({
    codigo,
    restaurante: restaurante.nombre || 'Restaurante',
    sucursal: restaurante.multiSucursal ? restaurante.sucursal?.nombre : '',
    datos,
    lineas,
    totalUsd,
    tasaBcv,
  });

  const service = createSupabaseServiceClient();
  if (service) {
    const { error } = await service.from('pedidos').insert({
      codigo,
      restaurante_id: restaurante.id,
      sucursal_id: restaurante.sucursal?.id ?? null,
      modo: datos.modo,
      mesa: datos.mesa || null,
      cliente: datos.cliente,
      items: lineas,
      total_usd: totalUsd,
      tasa_bcv: tasaBcv,
      total_bs: tasaBcv ? round2(totalUsd * tasaBcv) : null,
      metodo_pago: datos.metodo?.nombre ?? null,
      referencia_pago: datos.referencia || null,
      notas: datos.notas || null,
    });
    // El pedido igual sale por WhatsApp aunque no se pueda guardar.
    if (error) console.error('[api/pedidos] insert:', error.message);
  }

  return json({
    ok: true,
    codigo,
    whatsapp,
    mensaje,
    total_usd: totalUsd,
    tasa_bcv: tasaBcv,
  });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
