import { isSuperAdminUser } from '../../config/superadmin.js';
import {
  getOrCreateCategoriaByName,
  getOrCreateDefaultCategoria,
  uploadPlatoImage,
} from '../../lib/platos-admin.js';
import { pickNutricionInsert } from '../../lib/platos-nutricion.js';
import { createSupabaseServerClient } from '../../lib/supabase/server.js';
import { getSuperAdminWriteClient } from '../../lib/superadmin.js';

export const prerender = false;

/**
 * Crea un plato.
 * Acepta JSON o multipart/form-data.
 *
 * JSON: {
 *   restaurante_id, nombre, descripcion?, precio,
 *   destacado?, categoria_id?, categoria?, imagen_url?
 * }
 * FormData: mismos campos + imagen? (file)
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
    if (contentType.includes('application/json')) {
      raw = await request.json();
    } else {
      const form = await request.formData();
      raw = {
        restaurante_id: form.get('restaurante_id'),
        nombre: form.get('nombre'),
        descripcion: form.get('descripcion'),
        precio: form.get('precio'),
        destacado: form.get('destacado'),
        categoria_id: form.get('categoria_id'),
        categoria: form.get('categoria'),
        imagen_url: form.get('imagen_url'),
        calorias: form.get('calorias'),
        proteinas: form.get('proteinas'),
        carbs: form.get('carbs'),
        grasas: form.get('grasas'),
        alergias: form.get('alergias'),
        ingredientes_detalle: form.get('ingredientes_detalle'),
      };
      const file = form.get('imagen');
      if (file instanceof File && file.size > 0) imagenFile = file;
    }
  } catch {
    return json({ error: 'Cuerpo inválido' }, 400);
  }

  const restauranteId = String(raw.restaurante_id ?? '').trim();
  const nombre = String(raw.nombre ?? '').trim();
  const descripcion = String(raw.descripcion ?? '').trim() || null;
  const precio = Number(String(raw.precio ?? '').replace(',', '.'));
  const destacado = parseBool(raw.destacado);
  const categoriaIdRaw = Number(raw.categoria_id);
  const categoriaNombre = String(raw.categoria ?? '').trim();
  let imagenUrl =
    typeof raw.imagen_url === 'string' && raw.imagen_url.trim()
      ? raw.imagen_url.trim()
      : null;

  if (!restauranteId) return json({ error: 'restaurante_id requerido' }, 400);
  if (!nombre) return json({ error: 'El nombre del plato es obligatorio' }, 400);
  if (!Number.isFinite(precio) || precio < 0) {
    return json({ error: 'Precio inválido' }, 400);
  }

  // Alta de platos vía modal: exclusivo SuperAdmin (alineado con la UI)
  if (!isSuperAdminUser(user)) {
    return json(
      { error: 'Crear platos solo disponible para SuperAdmin' },
      403,
    );
  }

  const writeClient = getSuperAdminWriteClient(supabase, user);

  /** @type {number} */
  let categoriaId;
  /** @type {string} */
  let categoriaLabel = 'Sin categoría';

  if (Number.isFinite(categoriaIdRaw) && categoriaIdRaw > 0) {
    const { data: catRow, error: catErr } = await writeClient
      .from('categorias')
      .select('id, nombre')
      .eq('id', categoriaIdRaw)
      .eq('restaurante_id', restauranteId)
      .maybeSingle();

    if (catErr || !catRow) {
      return json({ error: 'Categoría no válida para este restaurante' }, 400);
    }
    categoriaId = catRow.id;
    categoriaLabel = catRow.nombre;
  } else if (categoriaNombre) {
    const cat = await getOrCreateCategoriaByName(
      writeClient,
      restauranteId,
      categoriaNombre,
    );
    if ('error' in cat) return json({ error: cat.error }, 400);
    categoriaId = cat.id;
    categoriaLabel = cat.nombre;
  } else {
    const cat = await getOrCreateDefaultCategoria(writeClient, restauranteId);
    if ('error' in cat) return json({ error: cat.error }, 400);
    categoriaId = cat.id;
    const { data: named } = await writeClient
      .from('categorias')
      .select('nombre')
      .eq('id', cat.id)
      .maybeSingle();
    categoriaLabel = named?.nombre ?? 'General';
  }

  if (imagenFile) {
    const uploaded = await uploadPlatoImage(writeClient, restauranteId, imagenFile);
    if (uploaded.error && !uploaded.url) {
      return json({ error: uploaded.error }, 400);
    }
    if (uploaded.url) imagenUrl = uploaded.url;
  }

  const nutricion = pickNutricionInsert(raw);

  const baseRow = {
    restaurante_id: restauranteId,
    categoria_id: categoriaId,
    nombre,
    descripcion,
    precio,
    imagen_url: imagenUrl,
    disponible: true,
    destacado,
  };

  let { data, error } = await writeClient
    .from('platos')
    .insert({ ...baseRow, ...nutricion })
    .select(
      'id, nombre, descripcion, precio, imagen_url, disponible, destacado, categoria_id, calorias, proteinas, carbs, grasas, alergias, ingredientes_detalle',
    )
    .maybeSingle();

  if (
    error &&
    /calorias|proteinas|carbs|grasas|alergias|ingredientes_detalle|column|schema cache/i.test(
      error.message || '',
    )
  ) {
    console.warn('[api/create-plato] nutrición no disponible; insert sin macros.', error.message);
    const retry = await writeClient
      .from('platos')
      .insert(baseRow)
      .select(
        'id, nombre, descripcion, precio, imagen_url, disponible, destacado, categoria_id',
      )
      .maybeSingle();
    data = retry.data;
    error = retry.error;
  }

  if (error || !data) {
    console.error('[api/create-plato]', error?.message);
    return json({ error: error?.message ?? 'No se pudo crear el plato' }, 400);
  }

  return json({
    ok: true,
    plato: {
      ...data,
      precio: Number(data.precio),
      destacado: Boolean(data.destacado),
      categoria_nombre: categoriaLabel,
    },
  });
}

/**
 * @param {unknown} value
 */
function parseBool(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'si' || v === 'sí' || v === 'on';
  }
  return false;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
