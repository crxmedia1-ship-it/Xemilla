/**
 * Gadget Pedidos: opciones por plato, configuración del checkout y mensaje de WhatsApp.
 * Puro (sin DOM ni Supabase): lo comparten la carta, el admin y /api/pedidos.
 */
import { normalizeMesa } from './mesa-session.js';

export const PEDIDO_MODOS = /** @type {const} */ (['mesa', 'delivery', 'pickup']);

export const PEDIDO_MODO_LABELS = {
  mesa: 'En mesa',
  delivery: 'Delivery',
  pickup: 'Pickup',
};

export const CEDULA_MODOS = /** @type {const} */ (['no', 'opcional', 'obligatoria']);

export const METODO_PAGO_TIPOS = [
  { id: 'pago_movil', label: 'Pago Móvil', referencia: true, bs: true },
  { id: 'transferencia', label: 'Transferencia', referencia: true, bs: true },
  { id: 'zelle', label: 'Zelle', referencia: true, bs: false },
  { id: 'binance', label: 'Binance Pay', referencia: true, bs: false },
  { id: 'efectivo_usd', label: 'Efectivo (divisas)', referencia: false, bs: false },
  { id: 'efectivo_bs', label: 'Efectivo (Bs)', referencia: false, bs: true },
  { id: 'punto', label: 'Punto de venta', referencia: false, bs: true },
  { id: 'otro', label: 'Otro', referencia: true, bs: false },
];

const METODO_POR_TIPO = new Map(METODO_PAGO_TIPOS.map((m) => [m.id, m]));

export const PEDIDO_LIMITES = {
  grupos: 12,
  opcionesPorGrupo: 30,
  metodosPago: 8,
  items: 60,
  cantidad: 99,
};

const PRECIO_MAX = 100000;

/** @param {unknown} v @param {number} max */
function cleanText(v, max) {
  return String(v ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** @param {unknown} v @param {number} max */
function cleanMultiline(v, max) {
  return String(v ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

/** @param {unknown} v @param {string} fallback */
function cleanId(v, fallback) {
  const raw = String(v ?? '').trim();
  return /^[A-Za-z0-9_-]{1,40}$/.test(raw) ? raw : fallback;
}

/** @param {number} n */
export function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** @param {unknown} v */
function money(v) {
  const n = Number(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return 0;
  return round2(Math.min(n, PRECIO_MAX));
}

/** @param {unknown} v */
function toBool(v) {
  return v === true || v === 'true' || v === 1 || v === '1' || v === 'on';
}

/** @param {unknown} raw */
function parseJson(raw) {
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * @typedef {{ id: string, nombre: string, precio: number }} OpcionPlato
 * @typedef {{ id: string, nombre: string, requerido: boolean, max: number, opciones: OpcionPlato[] }} GrupoOpciones
 */

/**
 * @param {unknown} raw JSON de platos.opciones
 * @returns {GrupoOpciones[]}
 */
export function normalizePlatoOpciones(raw) {
  const arr = parseJson(raw);
  if (!Array.isArray(arr)) return [];

  /** @type {GrupoOpciones[]} */
  const grupos = [];
  const grupoIds = new Set();

  arr.slice(0, PEDIDO_LIMITES.grupos).forEach((g, gi) => {
    if (!g || typeof g !== 'object') return;
    const nombre = cleanText(g.nombre, 60);
    if (!nombre) return;

    /** @type {OpcionPlato[]} */
    const opciones = [];
    const opIds = new Set();
    const rawOps = Array.isArray(g.opciones) ? g.opciones : [];
    rawOps.slice(0, PEDIDO_LIMITES.opcionesPorGrupo).forEach((o, oi) => {
      if (!o || typeof o !== 'object') return;
      const opNombre = cleanText(o.nombre, 60);
      if (!opNombre) return;
      let id = cleanId(o.id, `o${oi + 1}`);
      while (opIds.has(id)) id = `${id}x`;
      opIds.add(id);
      opciones.push({ id, nombre: opNombre, precio: money(o.precio) });
    });
    if (!opciones.length) return;

    let id = cleanId(g.id, `g${gi + 1}`);
    while (grupoIds.has(id)) id = `${id}x`;
    grupoIds.add(id);

    const maxRaw = Math.round(Number(g.max));
    const max = Number.isFinite(maxRaw) ? Math.min(Math.max(maxRaw, 1), opciones.length) : 1;

    grupos.push({ id, nombre, requerido: toBool(g.requerido), max, opciones });
  });

  return grupos;
}

export const OPCIONES_PREVIEW_VACIO = 'Sin opciones · clic para agregar';

/**
 * Resumen corto para el botón del admin.
 * @param {unknown} raw
 */
export function formatOpcionesPreview(raw) {
  const grupos = normalizePlatoOpciones(raw);
  if (!grupos.length) return OPCIONES_PREVIEW_VACIO;
  const nombres = grupos.slice(0, 2).map((g) => g.nombre).join(', ');
  return `${grupos.length} grupo${grupos.length === 1 ? '' : 's'} · ${nombres}${grupos.length > 2 ? '…' : ''}`;
}

/**
 * @typedef {{ id: string, tipo: string, nombre: string, datos: string }} MetodoPago
 * @typedef {{
 *   modos: { mesa: boolean, delivery: boolean, pickup: boolean },
 *   cedula: 'no' | 'opcional' | 'obligatoria',
 *   nota: string,
 *   metodos_pago: MetodoPago[],
 * }} ConfigPedidos
 */

/**
 * @param {unknown} raw JSON de restaurantes.config_pedidos
 * @returns {ConfigPedidos}
 */
export function normalizeConfigPedidos(raw) {
  const obj = parseJson(raw);
  const src = obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
  const modosRaw = src.modos && typeof src.modos === 'object' ? src.modos : null;

  const modos = modosRaw
    ? {
        mesa: toBool(modosRaw.mesa),
        delivery: toBool(modosRaw.delivery),
        pickup: toBool(modosRaw.pickup),
      }
    : { mesa: true, delivery: true, pickup: true };
  if (!modos.mesa && !modos.delivery && !modos.pickup) modos.mesa = true;

  const cedulaRaw = String(src.cedula ?? '').trim().toLowerCase();
  const cedula = /** @type {ConfigPedidos['cedula']} */ (
    CEDULA_MODOS.includes(/** @type {any} */ (cedulaRaw)) ? cedulaRaw : 'opcional'
  );

  /** @type {MetodoPago[]} */
  const metodos_pago = [];
  const ids = new Set();
  const rawMetodos = Array.isArray(src.metodos_pago) ? src.metodos_pago : [];
  rawMetodos.slice(0, PEDIDO_LIMITES.metodosPago).forEach((m, i) => {
    if (!m || typeof m !== 'object') return;
    const tipo = METODO_POR_TIPO.has(String(m.tipo)) ? String(m.tipo) : 'otro';
    const nombre = cleanText(m.nombre, 40) || METODO_POR_TIPO.get(tipo)?.label || 'Pago';
    let id = cleanId(m.id, `m${i + 1}`);
    while (ids.has(id)) id = `${id}x`;
    ids.add(id);
    metodos_pago.push({ id, tipo, nombre, datos: cleanMultiline(m.datos, 400) });
  });

  return { modos, cedula, nota: cleanMultiline(src.nota, 300), metodos_pago };
}

/** @param {string} tipo */
export function metodoPideReferencia(tipo) {
  return METODO_POR_TIPO.get(tipo)?.referencia ?? true;
}

/** @param {string} tipo */
export function metodoCobraEnBs(tipo) {
  return METODO_POR_TIPO.get(tipo)?.bs ?? false;
}

/** @param {ConfigPedidos} config */
export function modosActivos(config) {
  return PEDIDO_MODOS.filter((m) => config.modos[m]);
}

/**
 * Valida la selección del cliente contra los grupos del plato.
 * @param {GrupoOpciones[]} grupos
 * @param {unknown} seleccion { [grupoId]: opcionId | opcionId[] }
 * @returns {{ ok: true, extra: number, seleccion: Record<string, string[]>, detalle: Array<{ grupo: string, opciones: string[] }> } | { ok: false, error: string }}
 */
export function resolverSeleccion(grupos, seleccion) {
  const sel = seleccion && typeof seleccion === 'object' ? /** @type {Record<string, unknown>} */ (seleccion) : {};
  let extra = 0;
  /** @type {Record<string, string[]>} */
  const limpia = {};
  /** @type {Array<{ grupo: string, opciones: string[] }>} */
  const detalle = [];

  for (const g of grupos) {
    const raw = sel[g.id];
    const ids = [...new Set((Array.isArray(raw) ? raw : raw != null ? [raw] : []).map(String))];
    const elegidas = ids.map((id) => g.opciones.find((o) => o.id === id));
    if (elegidas.some((o) => !o)) return { ok: false, error: `Opción no válida en «${g.nombre}»` };
    if (elegidas.length > g.max) {
      return { ok: false, error: `En «${g.nombre}» puedes elegir máximo ${g.max}` };
    }
    if (g.requerido && elegidas.length === 0) return { ok: false, error: `Elige ${g.nombre}` };
    if (!elegidas.length) continue;

    const ops = /** @type {OpcionPlato[]} */ (elegidas);
    limpia[g.id] = ops.map((o) => o.id);
    detalle.push({ grupo: g.nombre, opciones: ops.map((o) => o.nombre) });
    extra += ops.reduce((acc, o) => acc + o.precio, 0);
  }

  return { ok: true, extra: round2(extra), seleccion: limpia, detalle };
}

/**
 * @param {unknown} cantidad
 * @returns {number} 1..99
 */
export function normalizeCantidad(cantidad) {
  const n = Math.round(Number(cantidad));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, PEDIDO_LIMITES.cantidad);
}

/**
 * Número de WhatsApp en formato wa.me (solo dígitos, con código de país).
 * Acepta E.164, número local venezolano (0414…) o URL wa.me / api.whatsapp.com.
 * @param {unknown} value
 * @returns {string}
 */
export function waNumero(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  let candidate = raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      candidate = url.searchParams.get('phone') || url.pathname.replace(/^\/+/, '');
    } catch {
      return '';
    }
  }
  let digits = candidate.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) digits = `58${digits.slice(1)}`;
  else if (digits.length === 10 && /^4(12|14|16|22|24|26)/.test(digits)) digits = `58${digits}`;
  return digits.length >= 8 && digits.length <= 15 ? digits : '';
}

/** @param {number} amount */
export function formatUsd(amount) {
  const [int, dec] = round2(amount).toFixed(2).split('.');
  return `$${int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${dec}`;
}

/** @param {number} amount */
export function formatBs(amount) {
  const [int, dec] = round2(amount).toFixed(2).split('.');
  return `Bs. ${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`;
}

const CODIGO_ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Código corto legible para identificar el pedido por WhatsApp (ej. «K7P2»). */
export function generarCodigoPedido() {
  const bytes = new Uint8Array(4);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODIGO_ALFABETO[b % CODIGO_ALFABETO.length]).join('');
}

/** @param {unknown} v */
function normalizeTelefono(v) {
  const raw = String(v ?? '').trim();
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return '';
  return raw.startsWith('+') ? `+${digits}` : digits;
}

/** @param {unknown} v */
function normalizeCedula(v) {
  const raw = String(v ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s.]/g, '');
  const m = raw.match(/^([VEJPG])?-?(\d{5,10})$/);
  if (!m) return '';
  return `${m[1] || 'V'}-${m[2]}`;
}

/**
 * @typedef {{
 *   modo: 'mesa' | 'delivery' | 'pickup',
 *   mesa: string,
 *   cliente: { nombre: string, telefono: string, cedula: string, direccion: string },
 *   metodo: MetodoPago | null,
 *   referencia: string,
 *   notas: string,
 * }} DatosPedido
 */

/**
 * Valida los datos del checkout (no los ítems) según la configuración del restaurante.
 * @param {Record<string, any>} input
 * @param {ConfigPedidos} config
 * @returns {{ ok: true, datos: DatosPedido } | { ok: false, error: string }}
 */
export function validarDatosPedido(input, config) {
  const modo = String(input?.modo ?? '');
  if (!PEDIDO_MODOS.includes(/** @type {any} */ (modo)) || !config.modos[/** @type {'mesa'} */ (modo)]) {
    return { ok: false, error: 'Elige cómo quieres recibir tu pedido' };
  }
  const enMesa = modo === 'mesa';
  const cliente = input?.cliente && typeof input.cliente === 'object' ? input.cliente : {};

  const mesa = enMesa ? normalizeMesa(input?.mesa) : '';
  if (enMesa && !mesa) return { ok: false, error: 'Indica el número de tu mesa' };

  const nombre = cleanText(cliente.nombre, 60);
  if (!enMesa && !nombre) return { ok: false, error: 'Escribe tu nombre' };

  const telefonoRaw = cleanText(cliente.telefono, 24);
  const telefono = normalizeTelefono(telefonoRaw);
  if (!enMesa && !telefono) return { ok: false, error: 'Escribe un teléfono válido' };
  if (enMesa && telefonoRaw && !telefono) return { ok: false, error: 'Escribe un teléfono válido' };

  let cedula = '';
  if (config.cedula !== 'no') {
    const cedulaRaw = cleanText(cliente.cedula, 16);
    cedula = normalizeCedula(cedulaRaw);
    if (cedulaRaw && !cedula) return { ok: false, error: 'La cédula no es válida (ej. V-12345678)' };
    if (!cedula && config.cedula === 'obligatoria' && !enMesa) {
      return { ok: false, error: 'Escribe tu cédula' };
    }
  }

  const direccion = modo === 'delivery' ? cleanMultiline(cliente.direccion, 300) : '';
  if (modo === 'delivery' && !direccion) return { ok: false, error: 'Escribe la dirección de entrega' };

  let metodo = null;
  const metodoId = String(input?.metodo_pago ?? '').trim();
  if (metodoId) {
    metodo = config.metodos_pago.find((m) => m.id === metodoId) ?? null;
    if (!metodo) return { ok: false, error: 'Método de pago no válido' };
  } else if (!enMesa && config.metodos_pago.length) {
    return { ok: false, error: 'Elige un método de pago' };
  }

  const referencia = metodo ? cleanText(input?.referencia, 40) : '';

  return {
    ok: true,
    datos: {
      modo: /** @type {DatosPedido['modo']} */ (modo),
      mesa,
      cliente: { nombre, telefono, cedula, direccion },
      metodo,
      referencia,
      notas: cleanMultiline(input?.notas, 300),
    },
  };
}

/**
 * @typedef {{ nombre: string, cantidad: number, unitario: number, total: number, detalle: Array<{ grupo: string, opciones: string[] }>, nota: string }} LineaPedido
 */

/**
 * Texto que llega al WhatsApp del restaurante.
 * @param {{
 *   codigo: string,
 *   restaurante: string,
 *   sucursal?: string,
 *   datos: DatosPedido,
 *   lineas: LineaPedido[],
 *   totalUsd: number,
 *   tasaBcv?: number | null,
 * }} p
 */
export function buildMensajePedido(p) {
  const { datos } = p;
  const out = [];
  const lugar = [p.restaurante, p.sucursal].filter(Boolean).join(' · ');
  out.push(`*Pedido #${p.codigo}* — ${lugar}`);
  out.push(
    datos.modo === 'mesa'
      ? `🍽️ *Mesa ${datos.mesa}*`
      : datos.modo === 'delivery'
        ? '🛵 *Delivery*'
        : '🛍️ *Pickup* (paso a retirar)',
  );
  out.push('');

  for (const l of p.lineas) {
    out.push(`${l.cantidad}× ${l.nombre} — ${formatUsd(l.total)}`);
    for (const d of l.detalle) out.push(`   • ${d.grupo}: ${d.opciones.join(', ')}`);
    if (l.nota) out.push(`   📝 ${l.nota}`);
  }

  out.push('');
  out.push(`*Total: ${formatUsd(p.totalUsd)}*`);
  const tasa = Number(p.tasaBcv);
  if (Number.isFinite(tasa) && tasa > 0) {
    out.push(`${formatBs(p.totalUsd * tasa)} (tasa BCV ${formatBs(tasa).replace('Bs. ', '')})`);
  }
  if (datos.modo === 'delivery') out.push('_El costo del delivery se confirma por aquí._');

  const c = datos.cliente;
  const info = [];
  if (c.nombre) info.push(`👤 ${c.nombre}`);
  if (c.telefono) info.push(`📱 ${c.telefono}`);
  if (c.cedula) info.push(`🪪 ${c.cedula}`);
  if (c.direccion) info.push(`📍 ${c.direccion}`);
  if (datos.metodo) info.push(`💳 ${datos.metodo.nombre}`);
  if (datos.referencia) info.push(`🔖 Ref. ${datos.referencia}`);
  if (datos.notas) info.push(`🗒️ ${datos.notas}`);
  if (info.length) {
    out.push('');
    out.push(...info);
  }

  return out.join('\n');
}
