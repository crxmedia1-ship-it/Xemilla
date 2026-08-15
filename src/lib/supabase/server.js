import { createServerClient, parseCookieHeader } from '@supabase/ssr';

/**
 * Cliente Supabase para el servidor (páginas SSR, API, middleware).
 * Lee/escribe la sesión en cookies HTTP para validar auth sin localStorage.
 *
 * @param {{ request: Request, cookies: import('astro').AstroCookies }} ctx
 */
export function createSupabaseServerClient({ request, cookies }) {
  const url = String(import.meta.env.PUBLIC_SUPABASE_URL || '').trim();
  const key = String(import.meta.env.PUBLIC_SUPABASE_ANON_KEY || '').trim();
  if (!url || !key) {
    throw new Error(
      '[supabase] Faltan PUBLIC_SUPABASE_URL o PUBLIC_SUPABASE_ANON_KEY',
    );
  }
  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return parseCookieHeader(request.headers.get('Cookie') ?? '').map(
            ({ name, value }) => ({ name, value: value ?? '' }),
          );
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookies.set(name, value, options);
          });
        },
      },
    },
  );
}
