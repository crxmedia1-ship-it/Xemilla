import { defineMiddleware } from 'astro:middleware';
import { isSuperAdminUser } from './config/superadmin.js';
import { createSupabaseServerClient } from './lib/supabase/server.js';

/**
 * Solo refresca sesión en rutas on-demand del panel.
 * Las páginas públicas (incl. /[slug] SSR) no necesitan cookies.
 * Endurece: Admin Operativo no puede entrar a /admin/super/*.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  const needsAuth =
    pathname.startsWith('/admin') || pathname.startsWith('/api/');

  if (!needsAuth) {
    const response = await next();
    // Menús públicos SSR: no cachear plantillas home_theme / ubicacion_theme
    response.headers.set(
      'Cache-Control',
      'private, no-store, no-cache, must-revalidate, max-age=0',
    );
    response.headers.set('CDN-Cache-Control', 'no-store');
    response.headers.set('Vercel-CDN-Cache-Control', 'no-store');
    return response;
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

  if (pathname.startsWith('/admin/super')) {
    if (!user) {
      return context.redirect('/admin/login');
    }
    if (!isSuperAdminUser(user)) {
      return context.redirect('/admin/dashboard');
    }
  }

  return next();
});
