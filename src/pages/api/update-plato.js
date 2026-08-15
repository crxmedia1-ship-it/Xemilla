import { isSuperAdminUser } from '../../config/superadmin.js';
import { uploadPlatoImage } from '../../lib/platos-admin.js';
import { applyNutricionPatch } from '../../lib/platos-nutricion.js';
import { createSupabaseServerClient } from '../../lib/supabase/server.js';
import { getSuperAdminWriteClient } from '../../lib/superadmin.js';

export const prerender = false;

/**
 * Actualiza campos de un plato.
 * Acepta JSON o multipart/form-data (para subir imagen).
 *
 * JSON: { id, nombre?, descripcion?, precio?, disponible?, destacado?, imagen_url? }
 * FormData: id + imagen (File) y/o mismos campos de texto
 */
export async function POST({ request, cookies }) {
  const supabase = createSupabaseServerClient({ request, cookies });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return json({ error: 'No autenticado' }, 401);
  }

  const contentType = request.headers.get('content-type') || '';
  /** @type {Record<string, unknown>} */
  let raw = {};
  /** @type {File | null} */
  let imagenFile = null;

  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      raw = {
        id: form.get('id'),
        nombre: form.get('nombre'),
        descripcion: form.get('descripcion'),
        precio: form.get('precio'),
        disponible: form.get('disponible'),
        destacado: form.get('destacado'),
        imagen_url: form.get('imagen_url'),
        restaurante_id: form.get('restaurante_id'),
        calorias: form.get('calorias'),
        proteinas: form.get('proteinas'),
        carbs: form.get('carbs'),
        grasas: form.get('grasas'),
        alergias: form.get('alergias'),
        ingredientes_detalle: form.get('ingredientes_detalle'),
      };
      const file = form.get('imagen');
      if (file instanceof File && file.size > 0) imagenFile = file;
    } else {
      raw = await request.json();
    }
  } catch {
    return json({ error: 'Cuerpo de petición inválido' }, 400);
  }

  const id = Number(raw.id);
  if (!Number.isFinite(id) || id <= 0) {
    return json({ error: 'id de plato requerido' }, 400);
  }

  const writeClient = getSuperAdminWriteClient(supabase, user);

  /** @type {Record<string, unknown>} */
  const patch = {};

  if (typeof raw.nombre === 'string') {
    const nombre = raw.nombre.trim();
    if (!nombre) return json({ error: 'El nombre no puede estar vacío' }, 400);
    patch.nombre = nombre;
  }

  if (typeof raw.descripcion === 'string') {
    patch.descripcion = raw.descripcion.trim() || null;
  }

  if (raw.precio !== undefined && raw.precio !== null && raw.precio !== '') {
    const precio = Number(String(raw.precio).replace(',', '.'));
    if (!Number.isFinite(precio) || precio < 0) {
      return json({ error: 'precio inválido' }, 400);
    }
    patch.precio = precio;
  }

  if (typeof raw.disponible === 'boolean') {
    patch.disponible = raw.disponible;
  } else if (raw.disponible === 'true' || raw.disponible === 'false') {
    patch.disponible = raw.disponible === 'true';
  }

  if (typeof raw.destacado === 'boolean') {
    patch.destacado = raw.destacado;
  } else if (raw.destacado === 'true' || raw.destacado === 'false') {
    patch.destacado = raw.destacado === 'true';
  }

  if (typeof raw.imagen_url === 'string') {
    const url = raw.imagen_url.trim();
    if (!url || url.toLowerCase() === 'no') {
      patch.imagen_url = null;
    } else if (/^https?:\/\//i.test(url)) {
      patch.imagen_url = url;
    } else {
      return json({ error: 'URL de imagen inválida' }, 400);
    }
  }

  if ('modelo_3d_url' in raw) {
    const url3d = raw.modelo_3d_url;
    if (url3d === null || url3d === '' || url3d === undefined) {
      patch.modelo_3d_url = null;
    } else if (typeof url3d === 'string' && /^https?:\/\//i.test(url3d.trim())) {
      patch.modelo_3d_url = url3d.trim();
    } else {
      return json({ error: 'URL de modelo 3D inválida' }, 400);
    }
  }

  applyNutricionPatch(raw, patch);

  if (imagenFile) {
    let restauranteId = String(raw.restaurante_id ?? '').trim();
    if (!restauranteId) {
      const { data: platoRow } = await writeClient
        .from('platos')
        .select('restaurante_id')
        .eq('id', id)
        .maybeSingle();
      restauranteId = platoRow?.restaurante_id ?? '';
    }
    if (!restauranteId) {
      return json({ error: 'No se pudo resolver restaurante_id para la imagen' }, 400);
    }

    const uploaded = await uploadPlatoImage(writeClient, restauranteId, imagenFile);
    if (uploaded.error && !uploaded.url) {
      return json({ error: uploaded.error }, 400);
    }
    if (uploaded.url) patch.imagen_url = uploaded.url;
  }

  if (Object.keys(patch).length === 0) {
    return json({ error: 'No hay campos para actualizar' }, 400);
  }

  const { data, error } = await writeClient
    .from('platos')
    .update(patch)
    .eq('id', id)
    .select(
      'id, nombre, descripcion, precio, disponible, destacado, imagen_url, calorias, proteinas, carbs, grasas, alergias, ingredientes_detalle, modelo_3d_url',
    )
    .maybeSingle();

  if (
    error &&
    /calorias|proteinas|carbs|grasas|alergias|ingredientes_detalle|modelo_3d_url|column|schema cache/i.test(
      error.message || '',
    )
  ) {
    console.warn('[api/update-plato] nutrición no disponible; patch sin macros.', error.message);
    const legacy = { ...patch };
    delete legacy.calorias;
    delete legacy.proteinas;
    delete legacy.carbs;
    delete legacy.grasas;
    delete legacy.alergias;
    delete legacy.ingredientes_detalle;
    delete legacy.modelo_3d_url;
    if (Object.keys(legacy).length === 0) {
      return json({
        error:
          'Columnas de nutrición no existen aún en Supabase. Ejecutá supabase_nutricion.sql.',
      }, 400);
    }
    const retry = await writeClient
      .from('platos')
      .update(legacy)
      .eq('id', id)
      .select('id, nombre, descripcion, precio, disponible, destacado, imagen_url')
      .maybeSingle();
    if (retry.error) {
      console.error('[api/update-plato]', retry.error.message);
      return json({ error: retry.error.message }, 400);
    }
    if (!retry.data) {
      return json(
        {
          error: isSuperAdminUser(user)
            ? 'Plato no encontrado. Revisá RLS / service role.'
            : 'Plato no encontrado o sin permiso',
        },
        404,
      );
    }
    return json({
      ok: true,
      plato: { ...retry.data, precio: Number(retry.data.precio) },
    });
  }

  if (error) {
    console.error('[api/update-plato]', error.message);
    return json({ error: error.message }, 400);
  }

  if (!data) {
    return json(
      {
        error: isSuperAdminUser(user)
          ? 'Plato no encontrado. Revisá RLS / service role.'
          : 'Plato no encontrado o sin permiso',
      },
      404,
    );
  }

  return json({
    ok: true,
    plato: { ...data, precio: Number(data.precio) },
  });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
