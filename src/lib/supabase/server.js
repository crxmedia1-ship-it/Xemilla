import { createServerClient, parseCookieHeader } from '@supabase/ssr';

/**
 * Cliente Supabase para el servidor (páginas SSR, API, middleware).
 * Lee/escribe la sesión en cookies HTTP para validar auth sin localStorage.
 *
 * @param {{ request: Request, cookies: import('astro').AstroCookies }} ctx
 */
export function createSupabaseServerClient({ request, cookies }) {
  return createServerClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
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
