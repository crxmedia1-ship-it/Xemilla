const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MUNDOS = new Set(['barra', 'espacio', 'estudio']);
const TIPOS = new Set(['vista', 'ar', 'nutri', 'qr', 'whatsapp']);

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
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 */
export async function listPropuestas(client) {
  const { data, error } = await client
    .from('propuestas')
    .select(
      'id, nombre, logo_url, setup, dominio, mundo, vistas, ultima_vista, vio_ar, vio_nutri, vio_qr, vio_whatsapp, created_at',
    )
    .order('created_at', { ascending: false });

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
  const { data, error } = await client
    .from('propuestas')
    .select('id, nombre, logo_url, setup, dominio, mundo')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[propuestas] get:', error.message);
    return null;
  }
  return data;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {{ nombre: string, logoUrl?: string, setup?: string, dominio?: string, mundo?: string }} input
 */
export async function createPropuesta(client, input) {
  const nombre = readPropuestaNombre(input.nombre);
  if (!nombre) return { error: 'El nombre del restaurante es obligatorio.' };

  const row = {
    nombre,
    logo_url: readPropuestaLogo(input.logoUrl) || null,
    setup: readPropuestaSetup(input.setup),
    dominio: readPropuestaDominio(input.dominio) || null,
    mundo: readPropuestaMundo(input.mundo),
  };

  const { data, error } = await client
    .from('propuestas')
    .insert(row)
    .select('id, nombre, logo_url, setup, dominio, mundo')
    .single();

  if (error || !data) {
    console.error('[propuestas] create:', error?.message);
    return { error: 'No se pudo crear la propuesta.' };
  }
  return { data };
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
