#!/usr/bin/env node
/**
 * Verificación rápida tras cada deploy.
 *   npm run smoke                      → contra http://localhost:4321
 *   npm run smoke -- https://midominio → contra producción
 * Usa solo PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY (lo mismo que ve un visitante).
 */
import { createClient } from '@supabase/supabase-js';

const BASE = (process.argv[2] || 'http://localhost:4321').replace(/\/$/, '');
const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.PUBLIC_SUPABASE_ANON_KEY;

let failures = 0;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => {
  failures += 1;
  console.log(`  ✗ ${msg}`);
};
const check = (cond, msg, detail = '') => (cond ? ok(msg) : fail(detail ? `${msg} (${detail})` : msg));

async function get(path, init = {}) {
  return fetch(`${BASE}${path}`, { redirect: 'manual', ...init });
}

async function main() {
  if (!SUPABASE_URL || !ANON_KEY) {
    console.error('Faltan PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY (.env)');
    process.exit(2);
  }
  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });

  console.log(`\nSmoke test → ${BASE}\n`);

  console.log('Menús públicos');
  const { data: locales, error } = await anon
    .from('restaurantes')
    .select('id, slug, eslogan, activo');
  if (error) {
    fail(`leer restaurantes: ${error.message}`);
    return;
  }
  for (const r of locales.filter((l) => l.activo !== false)) {
    const res = await get(`/${r.slug}`);
    const html = res.status === 200 ? await res.text() : '';
    check(res.status === 200 && html.length > 10_000, `/${r.slug}`, `HTTP ${res.status}`);
  }
  for (const r of locales.filter((l) => l.activo === false)) {
    const res = await get(`/${r.slug}`);
    check(res.status === 404, `/${r.slug} desactivado → 404`, `HTTP ${res.status}`);
  }
  const missing = await get('/__no-existe-smoke__');
  check(missing.status === 404, 'slug inexistente → 404', `HTTP ${missing.status}`);

  console.log('\nPanel admin');
  const login = await get('/admin/login');
  check(login.status === 200, '/admin/login carga', `HTTP ${login.status}`);
  for (const path of ['/admin/dashboard', '/admin/super/dashboard']) {
    const res = await get(path);
    const loc = res.headers.get('location') || '';
    check(res.status >= 300 && res.status < 400 && loc.includes('/admin/login'), `${path} sin sesión → login`, `HTTP ${res.status}`);
  }

  console.log('\nAPIs sin sesión');
  const jsonApis = [
    'create-admin-user',
    'update-marca',
    'update-plato',
    'delete-plato',
    'delete-restaurante',
    'update-restaurante-estado',
    'update-hub-datos',
    'update-operativo-contacto',
    'update-menu-orden',
    'bulk-insert-platos',
  ];
  for (const api of jsonApis) {
    const res = await get(`/api/${api}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: BASE },
      body: '{}',
    });
    check(res.status === 401 || res.status === 403, `/api/${api} → rechazada`, `HTTP ${res.status}`);
  }
  const upload = await get('/api/upload', {
    method: 'POST',
    headers: { Origin: BASE },
    body: new FormData(),
  });
  check(upload.status === 401 || upload.status === 403, '/api/upload → rechazada', `HTTP ${upload.status}`);

  console.log('\nBase de datos (visitante anónimo)');
  const target = locales[0];
  if (target) {
    const upd = await anon
      .from('restaurantes')
      .update({ eslogan: target.eslogan })
      .eq('id', target.id)
      .select('id');
    check(!upd.data?.length, 'no puede editar restaurantes', upd.data?.length ? 'EDITÓ' : '');

    const ins = await anon
      .from('platos')
      .insert({ restaurante_id: target.id, nombre: '__smoke__', precio: 0 })
      .select('id');
    check(Boolean(ins.error), 'no puede crear platos', ins.error ? '' : 'CREÓ');
    if (ins.data?.length) {
      await anon.from('platos').delete().eq('id', ins.data[0].id);
    }

    const del = await anon.from('categorias').delete().eq('id', -1).select('id');
    check(!del.data?.length, 'no puede borrar categorías');

    const vistas = await anon.from('plato_vistas').select('id').limit(1);
    check(!vistas.data?.length, 'no puede leer métricas de vistas');
  }
}

main()
  .catch((err) => fail(`error inesperado: ${err?.message || err}`))
  .finally(() => {
    console.log(failures ? `\n✗ ${failures} fallo(s)\n` : '\n✓ Todo OK\n');
    process.exit(failures ? 1 : 0);
  });
