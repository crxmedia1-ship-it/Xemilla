/**
 * Obtiene o crea la categoría "General" del restaurante (necesaria para platos).
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} restauranteId
 * @returns {Promise<{ id: number } | { error: string }>}
 */
export async function getOrCreateDefaultCategoria(client, restauranteId) {
  return getOrCreateCategoriaByName(client, restauranteId, 'General', 0);
}

/**
 * Busca categoría por nombre o la crea.
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} restauranteId
 * @param {string} nombre
 * @param {number} [orden]
 * @returns {Promise<{ id: number, nombre: string } | { error: string }>}
 */
export async function getOrCreateCategoriaByName(
  client,
  restauranteId,
  nombre,
  orden = 0,
) {
  const label = String(nombre || '').trim() || 'General';

  const { data: existing, error: selectError } = await client
    .from('categorias')
    .select('id, nombre')
    .eq('restaurante_id', restauranteId)
    .ilike('nombre', label)
    .limit(1)
    .maybeSingle();

  if (selectError) {
    console.error('[admin] categorias select:', selectError.message);
    return { error: selectError.message };
  }

  if (existing?.id) return { id: existing.id, nombre: existing.nombre };

  const { data: created, error: insertError } = await client
    .from('categorias')
    .insert({
      restaurante_id: restauranteId,
      nombre: label,
      orden,
    })
    .select('id, nombre')
    .maybeSingle();

  if (insertError || !created) {
    console.error('[admin] categorias insert:', insertError?.message);
    return { error: insertError?.message ?? 'No se pudo crear la categoría' };
  }

  return { id: created.id, nombre: created.nombre };
}

/**
 * Sube imagen de plato a Storage (bucket público `platos`).
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} restauranteId
 * @param {File} file
 * @returns {Promise<{ url: string | null, error?: string }>}
 */
export async function uploadPlatoImage(client, restauranteId, file) {
  if (!file || !file.size) return { url: null };

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowed.includes(file.type)) {
    return { url: null, error: 'Formato de imagen no soportado (JPG, PNG, WEBP).' };
  }

  if (file.size > 4 * 1024 * 1024) {
    return { url: null, error: 'La imagen no puede superar 4 MB.' };
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${restauranteId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

  const { error: uploadError } = await client.storage.from('platos').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  });

  if (uploadError) {
    console.error('[admin] storage upload:', uploadError.message);
    return {
      url: null,
      error:
        uploadError.message.includes('Bucket not found')
          ? 'Creá el bucket público "platos" en Supabase Storage.'
          : uploadError.message,
    };
  }

  const { data } = client.storage.from('platos').getPublicUrl(path);
  return { url: data?.publicUrl ?? null };
}
