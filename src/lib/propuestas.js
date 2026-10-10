const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MUNDOS = new Set(['barra', 'espacio', 'estudio']);
const TIPOS = new Set(['vista', 'ar', 'nutri', 'qr', 'ia', 'whatsapp']);

/** Adicionales de «Solo para degustadores». El precio vive en la propuesta, no en el plan. */
export const PROPUESTA_ADICIONALES = [
  { id: 'ar', label: 'Realidad aumentada' },
  { id: 'nutri', label: 'Ficha nutricional' },
  { id: 'qr', label: 'QR & NFC' },
  { id: 'ia', label: 'Klientiq' },
  { id: 'shop', label: 'Tienda' },
  { id: 'loyalty', label: 'Tarjeta de fidelidad' },
];

/** Formatos físicos de QR & NFC. Cada uno puede tener su precio. */
export const PROPUESTA_QR_PIEZAS = [
  { id: 'tent', label: 'Acrílico' },
  { id: 'nfc', label: 'Tag NFC' },
  { id: 'plate', label: 'Placa' },
];

const ADICIONAL_IDS = new Set(PROPUESTA_ADICIONALES.map((item) => item.id));
const QR_PIEZA_IDS = new Set(PROPUESTA_QR_PIEZAS.map((item) => item.id));
/** Ids de paquetes de realidad aumentada: «1», «2»… */
const AR_PAQUETE_ID = /^[1-9]\d{0,2}$/;
const PROPUESTA_COLUMNS =
  'id, nombre, logo_url, setup, anual, sin_precio, dominio, mundo, adicionales';
const PROPUESTA_LIST_COLUMNS = `${PROPUESTA_COLUMNS}, vistas, ultima_vista, vio_ar, vio_nutri, vio_qr, vio_ia, vio_whatsapp, created_at`;

/**
 * @param {unknown} value
 */
export function isPropuestaId(value) {
  return UUID_RE.test(String(value || '').trim());
}

/**
 * @param {unknown} value
 */
export function readPropuestaNombre(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

/**
 * @param {unknown} value
 */
export function readPropuestaSetup(value) {
  const clean = String(value || '').trim().replace(/[^\d.,]/g, '').slice(0, 12);
  return clean || '600';
}

/**
 * @param {unknown} value
 */
export function readPropuestaAnual(value) {
  const clean = String(value || '').trim().replace(/[^\d.,]/g, '').slice(0, 12);
  return clean || '200';
}

/**
 * @param {unknown} value
 */
export function readPropuestaLogo(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    return url.href.slice(0, 500);
  } catch {
    return '';
  }
}

/**
 * @param {unknown} value
 */
export function readPropuestaDominio(value) {
  const clean = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .slice(0, 80);
  if (!clean) return '';
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(clean) ? clean : '';
}

/**
 * @param {unknown} value
 */
export function readPropuestaMundo(value) {
  const mundo = String(value || '').trim();
  return MUNDOS.has(mundo) ? mundo : 'estudio';
}

/**
 * @param {unknown} value
 */
export function readPropuestaTipo(value) {
  const tipo = String(value || '').trim();
  return TIPOS.has(tipo) ? tipo : '';
}

/**
 * Precio opcional de un adicional. Vacío = se muestra «A consultar».
 * @param {unknown} value
 */
export function readPropuestaMonto(value) {
  return String(value || '').trim().replace(/[^\d.,]/g, '').slice(0, 12);
}

/**
 * Mantenimiento mensual de Klientiq. Vacío = no se cobra mes a mes.
 * @param {unknown} value
 */
export function readPropuestaIaMensual(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return readPropuestaMonto(source.iaMensual);
}

/**
 * @param {unknown} value
 * @returns {Record<string, string>}
 */
export function readPropuestaAdicionales(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  /** @type {Record<string, string>} */
  const out = {};
  for (const id of ADICIONAL_IDS) {
    const amount = readPropuestaMonto(source[id]);
    if (amount) out[id] = amount;
  }
  return out;
}

/**
 * Ids que arrancan ya sumados en la factura.
 * Si la propuesta no guardó el switch, entran los que tienen precio.
 * @param {unknown} value
 * @returns {string[]}
 */
export function readPropuestaFactura(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  if (Array.isArray(source.factura)) {
    return source.factura.map((id) => String(id)).filter((id) => ADICIONAL_IDS.has(id));
  }
  return [...ADICIONAL_IDS].filter((id) => readPropuestaMonto(source[id]));
}

/**
 * Precio de cada formato de QR & NFC. Vacío = usa el precio general, o «A consultar».
 * @param {unknown} value
 * @returns {Record<string, string>}
 */
export function readPropuestaPiezas(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const raw = source.piezas && typeof source.piezas === 'object' && !Array.isArray(source.piezas) ? source.piezas : {};
  /** @type {Record<string, string>} */
  const out = {};
  for (const id of QR_PIEZA_IDS) {
    const amount = readPropuestaMonto(raw[id]);
    if (amount) out[id] = amount;
  }
  return out;
}

/**
 * Formatos que arrancan ya sumados. Si no se guardó la lista, no hay ninguno.
 * @param {unknown} value
 * @returns {string[]}
 */
export function readPropuestaPiezasFactura(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  if (!Array.isArray(source.piezasFactura)) return [];
  return source.piezasFactura.map((id) => String(id)).filter((id) => QR_PIEZA_IDS.has(id));
}

/**
 * Hay paquetes guardados. Sin esa lista, realidad aumentada queda a consultar.
 * @param {unknown} value
 */
export function propuestaTienePaquetes(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  if (Array.isArray(source.paquetesOrden) && source.paquetesOrden.some((id) => AR_PAQUETE_ID.test(String(id)))) return true;
  if (Object.keys(readPropuestaPaquetes(source)).length) return true;
  if (readPropuestaPaquetesFactura(source).length) return true;
  if (Object.keys(readPropuestaPaquetesPlatos(source)).length) return true;
  return false;
}

/**
 * Web de Xemilla que la propuesta usa como carta de ejemplo.
 * @param {unknown} value
 */
export function readPropuestaCartaDemo(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const slug = String(source.cartaDemo || '').trim().toLowerCase();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : '';
}

/**
 * Precio de cada paquete de realidad aumentada. Vacío = «A consultar».
 * @param {unknown} value
 * @returns {Record<string, string>}
 */
export function readPropuestaPaquetes(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const raw = source.paquetes && typeof source.paquetes === 'object' && !Array.isArray(source.paquetes) ? source.paquetes : {};
  /** @type {Record<string, string>} */
  const out = {};
  for (const [id, amount] of Object.entries(raw)) {
    if (!AR_PAQUETE_ID.test(id)) continue;
    const clean = readPropuestaMonto(amount);
    if (clean) out[id] = clean;
  }
  return out;
}

/**
 * Orden de los paquetes. Sin lista guardada, queda el primero.
 * @param {unknown} value
 * @returns {string[]}
 */
export function readPropuestaPaquetesOrden(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const listed = Array.isArray(source.paquetesOrden)
    ? [...new Set(source.paquetesOrden.map((id) => String(id)).filter((id) => AR_PAQUETE_ID.test(id)))]
    : [];
  if (listed.length) return listed;
  const known = [
    ...Object.keys(readPropuestaPaquetes(source)),
    ...readPropuestaPaquetesFactura(source),
  ];
  const ids = [...new Set(known)].sort((a, b) => Number(a) - Number(b));
  return ids.length ? ids : ['1'];
}

/**
 * Paquetes que arrancan ya sumados. Si no se guardó la lista, no hay ninguno.
 * @param {unknown} value
 * @returns {string[]}
 */
export function readPropuestaPaquetesFactura(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  if (!Array.isArray(source.paquetesFactura)) return [];
  return source.paquetesFactura.map((id) => String(id)).filter((id) => AR_PAQUETE_ID.test(id));
}

/**
 * Cantidad de platos de cada paquete. Vacío = 1.
 * @param {unknown} value
 * @returns {Record<string, string>}
 */
export function readPropuestaPaquetesPlatos(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const raw =
    source.paquetesPlatos && typeof source.paquetesPlatos === 'object' && !Array.isArray(source.paquetesPlatos)
      ? source.paquetesPlatos
      : {};
  /** @type {Record<string, string>} */
  const out = {};
  for (const [id, amount] of Object.entries(raw)) {
    if (!AR_PAQUETE_ID.test(id)) continue;
    const n = Math.round(Number(String(amount).replace(/[^\d]/g, '')));
    if (n >= 1 && n <= 40) out[id] = String(n);
  }
  return out;
}

/**
 * Precios más el switch de factura, listo para guardar.
 * @param {unknown} value
 */
export function packPropuestaAdicionales(value) {
  const prices = readPropuestaAdicionales(value);
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const factura = Array.isArray(source.factura)
    ? readPropuestaFactura({ factura: source.factura })
    : readPropuestaFactura(prices);
  const piezas = readPropuestaPiezas(source);
  const piezasFactura = Array.isArray(source.piezasFactura) ? readPropuestaPiezasFactura(source) : null;
  const paquetes = readPropuestaPaquetes(source);
  const paquetesOrden = Array.isArray(source.paquetesOrden) ? readPropuestaPaquetesOrden(source) : null;
  const paquetesFactura = Array.isArray(source.paquetesFactura) ? readPropuestaPaquetesFactura(source) : null;
  const paquetesPlatos = readPropuestaPaquetesPlatos(source);
  const moneda = source.moneda === 'bs' || source.moneda === 'eur' ? source.moneda : 'usd';
  const cartaDemo = readPropuestaCartaDemo(source);
  const iaMensual = readPropuestaIaMensual(source);
  return {
    ...prices,
    factura,
    moneda,
    ...(iaMensual ? { iaMensual } : {}),
    ...(cartaDemo ? { cartaDemo } : {}),
    ...(Object.keys(piezas).length ? { piezas } : {}),
    ...(piezasFactura ? { piezasFactura } : {}),
    ...(Object.keys(paquetes).length ? { paquetes } : {}),
    ...(paquetesOrden ? { paquetesOrden } : {}),
    ...(paquetesFactura ? { paquetesFactura } : {}),
    ...(Object.keys(paquetesPlatos).length ? { paquetesPlatos } : {}),
  };
}

/**
 * @param {unknown} error
 */
function missingAdicionalesColumn(error) {
  return /adicionales|schema cache|does not exist/i.test(String(error?.message || ''));
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 */
export async function listPropuestas(client) {
  let { data, error } = await client
    .from('propuestas')
    .select(PROPUESTA_LIST_COLUMNS)
    .order('created_at', { ascending: false });

  if (error && missingAdicionalesColumn(error)) {
    ({ data, error } = await client
      .from('propuestas')
      .select(PROPUESTA_LIST_COLUMNS.replace(', adicionales', ''))
      .order('created_at', { ascending: false }));
  }

  if (error) {
    console.error('[propuestas] list:', error.message);
    return [];
  }
  return data ?? [];
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {number} [limit]
 */
export async function listPropuestaEventos(client, limit = 12) {
  const { data, error } = await client
    .from('propuesta_eventos')
    .select('id, propuesta_id, tipo, created_at')
    .order('id', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[propuestas] eventos:', error.message);
    return [];
  }
  return data ?? [];
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} id
 */
export async function getPropuesta(client, id) {
  if (!isPropuestaId(id)) return null;
  let { data, error } = await client
    .from('propuestas')
    .select(PROPUESTA_COLUMNS)
    .eq('id', id)
    .maybeSingle();

  if (error && missingAdicionalesColumn(error)) {
    ({ data, error } = await client
      .from('propuestas')
      .select(PROPUESTA_COLUMNS.replace(', adicionales', ''))
      .eq('id', id)
      .maybeSingle());
  }

  if (error) {
    console.error('[propuestas] get:', error.message);
    return null;
  }
  return data;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {{ nombre: string, logoUrl?: string, setup?: string, anual?: string, sinPrecio?: boolean, dominio?: string, mundo?: string, adicionales?: unknown }} input
 */
export async function createPropuesta(client, input) {
  const nombre = readPropuestaNombre(input.nombre);
  if (!nombre) return { error: 'El nombre del restaurante es obligatorio.' };

  const row = {
    nombre,
    logo_url: readPropuestaLogo(input.logoUrl) || null,
    setup: readPropuestaSetup(input.setup),
    anual: readPropuestaAnual(input.anual),
    sin_precio: input.sinPrecio === true,
    dominio: readPropuestaDominio(input.dominio) || null,
    mundo: readPropuestaMundo(input.mundo),
    adicionales: packPropuestaAdicionales(input.adicionales),
  };

  const { data, error } = await client
    .from('propuestas')
    .insert(row)
    .select(PROPUESTA_COLUMNS)
    .single();

  if (error || !data) {
    console.error('[propuestas] create:', error?.message);
    if (missingAdicionalesColumn(error)) {
      return { error: 'Falta aplicar la migración de precios de degustadores en Supabase.' };
    }
    return { error: 'No se pudo crear la propuesta.' };
  }
  return { data };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} id
 * @param {unknown} adicionales
 */
export async function updatePropuestaAdicionales(client, id, adicionales) {
  if (!isPropuestaId(id)) return { error: 'Propuesta inválida.' };
  const next = packPropuestaAdicionales(adicionales);
  const { data, error } = await client
    .from('propuestas')
    .update({ adicionales: next, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, adicionales')
    .maybeSingle();

  if (error || !data) {
    console.error('[propuestas] adicionales:', error?.message);
    if (missingAdicionalesColumn(error)) {
      return { error: 'Falta aplicar la migración de precios de degustadores en Supabase.' };
    }
    return { error: 'No se pudieron guardar los precios.' };
  }
  return { data: { id: data.id, adicionales: data.adicionales } };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} id
 */
/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 */
export async function getPropuestaDefaults(client) {
  const { data, error } = await client
    .from('propuesta_precios_default')
    .select('adicionales')
    .eq('id', 'default')
    .maybeSingle();

  if (error) {
    if (missingAdicionalesColumn(error) || /propuesta_precios_default|schema cache|does not exist/i.test(error.message)) {
      return {};
    }
    console.error('[propuestas] defaults:', error.message);
    return {};
  }
  return packPropuestaAdicionales(data?.adicionales);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {unknown} adicionales
 */
export async function savePropuestaDefaults(client, adicionales) {
  const next = packPropuestaAdicionales(adicionales);
  const { data, error } = await client
    .from('propuesta_precios_default')
    .upsert({ id: 'default', adicionales: next, updated_at: new Date().toISOString() })
    .select('adicionales')
    .single();

  if (error || !data) {
    console.error('[propuestas] save defaults:', error?.message);
    if (/propuesta_precios_default|schema cache|does not exist/i.test(String(error?.message || ''))) {
      return { error: 'Falta aplicar la tabla de precios predeterminados en Supabase.' };
    }
    return { error: 'No se pudo guardar el predeterminado.' };
  }
  return { data: readPropuestaAdicionales(data.adicionales) };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} id
 */
export async function deletePropuesta(client, id) {
  if (!isPropuestaId(id)) return { error: 'Propuesta inválida.' };
  const { error } = await client.from('propuestas').delete().eq('id', id);
  if (error) {
    console.error('[propuestas] delete:', error.message);
    return { error: 'No se pudo borrar la propuesta.' };
  }
  return { ok: true };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} id
 * @param {string} tipo
 */
export async function touchPropuesta(client, id, tipo) {
  if (!isPropuestaId(id) || !readPropuestaTipo(tipo)) return false;
  const { error } = await client.rpc('touch_propuesta', { pid: id, kind: tipo });
  if (error) {
    console.error('[propuestas] touch:', error.message);
    return false;
  }
  return true;
}
