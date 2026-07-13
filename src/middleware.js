import { defineMiddleware } from 'astro:middleware';
import { createSupabaseServerClient } from './lib/supabase/server.js';

/**
 * Solo refresca sesión en rutas on-demand del panel.
 * Las páginas públicas siguen prerenderizadas y no necesitan cookies.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  const needsAuth =
    pathname.startsWith('/admin') || pathname.startsWith('/api/');

  if (!needsAuth) {
    return next();
  }

  const supabase = createSupabaseServerClient({
    request: context.request,
    cookies: context.cookies,
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  context.locals.user = user ?? null;
  context.locals.supabase = supabase;

  return next();
});
