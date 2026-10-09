import QRCode from 'qrcode';
import {
  moverPuntos,
  nuevoCodigoFidelidad,
  readFidelidadCodigo,
  nivelDeTarjeta,
  reglasDeTarjeta,
  readFidelidadDiseno,
  readFidelidadNombre,
  readFidelidadReglas,
  readFidelidadTelefono,
  tarjetaPublica,
} from './fidelidad.js';
import { leerSerialWallet, nuevoWalletToken } from './wallet.js';
import { avisarWallet } from './wallet-push.js';

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} slug
 */
async function localActivo(client, slug) {
  const { data, error } = await client
    .from('restaurantes')
    .select('id, slug, nombre_comercial, gadget_fidelidad, fidelidad_puntos, fidelidad_meta, fidelidad_premio, fidelidad_diseno')
    .eq('slug', slug)
    .maybeSingle();
  if (error || !data) return { error: 'No encontramos ese local.' };
  if (!data.gadget_fidelidad) return { error: 'La tarjeta de fidelidad está apagada en este local.' };
  return { local: data, reglas: readFidelidadReglas(data), diseno: readFidelidadDiseno(data.fidelidad_diseno) };
}

/**
 * @param {Record<string, unknown>} tarjeta
 * @param {{ puntos: number, meta: number, premio: string }} reglas
 */
/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} tarjetaId
 */
async function canjesDe(client, tarjetaId) {
  const { count, error } = await client
    .from('fidelidad_movimientos')
    .select('id', { count: 'exact', head: true })
    .eq('tarjeta_id', tarjetaId)
    .eq('motivo', 'canje');
  if (error) return 0;
  return count || 0;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {Record<string, unknown>} tarjeta
 * @param {{ puntos: number, meta: number, premio: string }} reglas
 * @param {ReturnType<typeof readFidelidadDiseno>} diseno
 */
async function presentar(client, tarjeta, reglas, diseno) {
  const canjes = tarjeta.id ? await canjesDe(client, String(tarjeta.id)) : 0;
  const card = tarjetaPublica(tarjeta, reglasDeTarjeta(diseno, canjes, reglas));
  const qr = await QRCode.toDataURL(`XEMILLA:FIDELIDAD:${card.codigo}`, {
    margin: 1,
    width: 280,
    errorCorrectionLevel: 'M',
  });
  const nivel = nivelDeTarjeta(diseno, canjes);
  return { ...card, qr, canjes, nivel };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} slug
 * @param {unknown} telefono
 * @param {unknown} nombre
 */
export async function entrarFidelidad(client, slug, telefono, nombre) {
  const gate = await localActivo(client, slug);
  if (gate.error || !gate.local || !gate.reglas) return { error: gate.error || 'No se pudo abrir la tarjeta.' };
  const tel = readFidelidadTelefono(telefono);
  if (!tel) return { error: 'Escribe un teléfono de al menos 8 dígitos.' };
  const person = readFidelidadNombre(nombre);

  const { data: existing, error: readError } = await client
    .from('fidelidad_tarjetas')
    .select('id, codigo, nombre, puntos')
    .eq('restaurante_id', gate.local.id)
    .eq('telefono', tel)
    .maybeSingle();
  if (readError) return { error: 'No se pudo abrir la tarjeta.' };
  if (existing) {
    if (person && person !== existing.nombre) {
      await client.from('fidelidad_tarjetas').update({ nombre: person }).eq('id', existing.id);
      existing.nombre = person;
    }
    return { card: await presentar(client, existing, gate.reglas, gate.diseno), local: gate.local.nombre_comercial };
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const codigo = nuevoCodigoFidelidad();
    const { data, error } = await client
      .from('fidelidad_tarjetas')
      .insert({
        restaurante_id: gate.local.id,
        codigo,
        nombre: person,
        telefono: tel,
        puntos: 0,
      })
      .select('id, codigo, nombre, puntos')
      .maybeSingle();
    if (!error && data) return { card: await presentar(client, data, gate.reglas, gate.diseno), local: gate.local.nombre_comercial };
    if (!/duplicate|unique/i.test(error?.message || '')) return { error: 'No se pudo crear la tarjeta.' };
  }
  return { error: 'No se pudo crear la tarjeta.' };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} restauranteId
 * @param {{ puntos: number, meta: number, premio: string }} reglas
 * @param {unknown} codigo
 */
async function buscarTarjeta(client, restauranteId, reglas, codigo) {
  const code = readFidelidadCodigo(codigo);
  if (!code) return { error: 'El código no es válido.' };
  const { data, error } = await client
    .from('fidelidad_tarjetas')
    .select('id, codigo, nombre, puntos')
    .eq('restaurante_id', restauranteId)
    .eq('codigo', code)
    .maybeSingle();
  if (error || !data) return { error: 'No hay una tarjeta con ese código.' };
  return { tarjeta: data, reglas };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} slug
 * @param {unknown} codigo
 */
export async function verFidelidad(client, slug, codigo) {
  const gate = await localActivo(client, slug);
  if (gate.error || !gate.local || !gate.reglas) return { error: gate.error || 'No se pudo ver la tarjeta.' };
  const found = await buscarTarjeta(client, gate.local.id, gate.reglas, codigo);
  if (found.error || !found.tarjeta) return { error: found.error || 'No hay una tarjeta con ese código.' };
  const card = await presentar(client, found.tarjeta, gate.reglas, gate.diseno);
  return {
    card,
    local: gate.local.nombre_comercial,
    diseno: {
      ...gate.diseno,
      fondo: card.nivel.fondo,
      tinta: card.nivel.tinta,
      acento: card.nivel.acento,
    },
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {{ id: string, gadget_fidelidad?: boolean, fidelidad_puntos?: number, fidelidad_meta?: number, fidelidad_premio?: string, fidelidad_diseno?: unknown, nombre_comercial?: string }} restaurante
 * @param {unknown} codigo
 * @param {'visita' | 'canje'} motivo
 */
export async function escanearFidelidad(client, restaurante, codigo, motivo) {
  if (!restaurante?.gadget_fidelidad) return { error: 'La tarjeta de fidelidad está apagada en este local.' };
  const reglas = readFidelidadReglas(restaurante);
  const diseno = readFidelidadDiseno(restaurante.fidelidad_diseno);
  const found = await buscarTarjeta(client, restaurante.id, reglas, codigo);
  if (found.error || !found.tarjeta) return { error: found.error || 'No hay una tarjeta con ese código.' };

  const canjes = await canjesDe(client, found.tarjeta.id);
  const reglasNivel = reglasDeTarjeta(diseno, canjes, reglas);
  const move = moverPuntos(found.tarjeta.puntos, reglasNivel, motivo);
  if (move.error || move.delta == null || move.puntos == null) return { error: move.error || 'No se pudo registrar.' };

  const { data, error } = await client
    .from('fidelidad_tarjetas')
    .update({ puntos: move.puntos, updated_at: new Date().toISOString() })
    .eq('id', found.tarjeta.id)
    .eq('puntos', found.tarjeta.puntos)
    .select('id, codigo, nombre, puntos')
    .maybeSingle();
  if (error || !data) return { error: 'Otro escaneo acaba de mover esta tarjeta. Inténtalo de nuevo.' };

  const { error: logError } = await client.from('fidelidad_movimientos').insert({
    tarjeta_id: data.id,
    restaurante_id: restaurante.id,
    delta: move.delta,
    motivo,
  });
  if (logError) console.error('[fidelidad] movimiento:', logError.message);

  const aviso = motivo === 'visita' ? `Sumó ${move.delta} puntos.` : `Canjeó ${reglasNivel.premio}.`;
  await avisarWallet(client, data.id, aviso).catch((error) => {
    console.error('[wallet] aviso:', error instanceof Error ? error.message : error);
  });

  return {
    card: await presentar(client, data, reglas, diseno),
    local: restaurante.nombre_comercial || '',
    mensaje: aviso,
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} slug
 * @param {unknown} codigo
 */
export async function tokenDeTarjeta(client, slug, codigo) {
  const gate = await localActivo(client, slug);
  if (gate.error || !gate.local) return { error: gate.error || 'No se pudo abrir la tarjeta.' };
  const code = readFidelidadCodigo(codigo);
  if (!code) return { error: 'El código no es válido.' };
  const { data, error } = await client
    .from('fidelidad_tarjetas')
    .select('id, wallet_token')
    .eq('restaurante_id', gate.local.id)
    .eq('codigo', code)
    .maybeSingle();
  if (error || !data) return { error: 'No hay una tarjeta con ese código.' };
  if (data.wallet_token) return { token: data.wallet_token, tarjetaId: data.id, local: gate.local };
  const token = nuevoWalletToken();
  const { data: saved } = await client
    .from('fidelidad_tarjetas')
    .update({ wallet_token: token })
    .eq('id', data.id)
    .is('wallet_token', null)
    .select('wallet_token')
    .maybeSingle();
  return { token: saved?.wallet_token || token, tarjetaId: data.id, local: gate.local };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {{ plataforma: 'apple' | 'google', deviceId: string, pushToken?: string, serial: string, token: string }} registro
 */
export async function registrarWallet(client, registro) {
  const serial = leerSerialWallet(registro.serial);
  if (!serial) return { error: 'Pase desconocido.', status: 404 };
  const acceso = await tokenDeTarjeta(client, serial.slug, serial.codigo);
  if (acceso.error || acceso.token !== registro.token) return { error: 'No autorizado.', status: 401 };
  const { data: existing } = await client
    .from('fidelidad_wallet_dispositivos')
    .select('id')
    .eq('tarjeta_id', acceso.tarjetaId)
    .eq('plataforma', registro.plataforma)
    .eq('device_id', registro.deviceId)
    .maybeSingle();
  const row = {
    tarjeta_id: acceso.tarjetaId,
    plataforma: registro.plataforma,
    device_id: registro.deviceId,
    push_token: registro.pushToken || '',
    updated_at: new Date().toISOString(),
  };
  const { error } = existing
    ? await client.from('fidelidad_wallet_dispositivos').update(row).eq('id', existing.id)
    : await client.from('fidelidad_wallet_dispositivos').insert(row);
  if (error) return { error: 'No se pudo registrar el teléfono.', status: 500 };
  return { ok: true, created: !existing, status: existing ? 200 : 201 };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {{ deviceId: string, serial: string, token: string }} registro
 */
export async function retirarWallet(client, registro) {
  const serial = leerSerialWallet(registro.serial);
  if (!serial) return { status: 200 };
  const acceso = await tokenDeTarjeta(client, serial.slug, serial.codigo);
  if (acceso.error || acceso.token !== registro.token) return { status: 401 };
  await client
    .from('fidelidad_wallet_dispositivos')
    .delete()
    .eq('tarjeta_id', acceso.tarjetaId)
    .eq('plataforma', 'apple')
    .eq('device_id', registro.deviceId);
  return { status: 200 };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} deviceId
 * @param {string} [since]
 */
export async function serialesWallet(client, deviceId, since) {
  const { data: devices, error } = await client
    .from('fidelidad_wallet_dispositivos')
    .select('tarjeta_id')
    .eq('plataforma', 'apple')
    .eq('device_id', deviceId);
  if (error || !devices?.length) return { serialNumbers: [], lastUpdated: since || '' };
  const ids = devices.map((row) => row.tarjeta_id);
  const { data: cards } = await client
    .from('fidelidad_tarjetas')
    .select('id, codigo, updated_at, restaurante_id')
    .in('id', ids);
  if (!cards?.length) return { serialNumbers: [], lastUpdated: since || '' };
  const localIds = [...new Set(cards.map((card) => card.restaurante_id))];
  const { data: locals } = await client.from('restaurantes').select('id, slug').in('id', localIds);
  const slugs = new Map((locals || []).map((local) => [local.id, local.slug]));
  const desde = since ? Date.parse(since) : 0;
  const serialNumbers = (cards || []).flatMap((card) => {
    const slug = slugs.get(card.restaurante_id);
    const updated = Date.parse(card.updated_at || '');
    if (!slug || !card.codigo) return [];
    if (desde && Number.isFinite(updated) && updated <= desde) return [];
    return [`${slug}:${card.codigo}`];
  });
  return { serialNumbers, lastUpdated: new Date().toISOString() };
}
