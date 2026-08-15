import { createClient } from '@supabase/supabase-js';

/**
 * Cliente público de Supabase (anon key).
 * Usar solo para lectura del menú / ficha del restaurante.
 *
 * Auth del Dashboard: `src/lib/supabase/server.js` (SSR) y
 * `src/lib/supabase/browser.js` (login en el cliente).
 *
 * Nunca lanzar en import: si faltan env vars devolvemos null y la
 * WebApp pública responde 404 controlado en vez de 500.
 */
function createPublicSupabaseClient() {
  const url = String(import.meta.env.PUBLIC_SUPABASE_URL || '').trim();
  const key = String(import.meta.env.PUBLIC_SUPABASE_ANON_KEY || '').trim();
  if (!url || !key) {
    console.error(
      '[supabase] Faltan PUBLIC_SUPABASE_URL o PUBLIC_SUPABASE_ANON_KEY',
    );
    return null;
  }
  try {
    return createClient(url, key, {
      global: {
        fetch: (input, init = {}) =>
          fetch(input, {
            ...init,
            cache: 'no-store',
          }),
      },
    });
  } catch (err) {
    console.error('[supabase] no se pudo crear el cliente público:', err);
    return null;
  }
}

export const supabase = createPublicSupabaseClient();
