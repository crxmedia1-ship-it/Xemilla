import { defineMiddleware } from 'astro:middleware';
import { isGerenteSedeUser, isSuperAdminUser } from './config/superadmin.js';
import { createSupabaseServerClient } from './lib/supabase/server.js';

/**
 * Menús públicos: el navegador siempre revalida; el CDN de Vercel sirve una copia
 * de hasta 10 s y la renueva en segundo plano, así los cambios del Admin
 * aparecen en segundos sin consultar Supabase en cada visita.
 * Errores (404 de slug nuevo, 500) nunca se cachean.
 */
const PUBLIC_CDN_CACHE = 's-maxage=10, stale-while-revalidate=60';

/**
 * Solo refresca sesión en rutas on-demand del panel.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  const needsAuth =
    pathname.startsWith('/admin') || pathname.startsWith('/api/');

  if (!needsAuth) {
    const response = await next();
    if (response.headers.has('Cache-Control')) return response;
    const cacheable = response.status === 200 && !response.headers.has('Set-Cookie');
    response.headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
    response.headers.set(
      'Vercel-CDN-Cache-Control',
      cacheable ? PUBLIC_CDN_CACHE : 'no-store',
    );
    return response;
  }

  const supabase = createSupabaseServerClient({
    request: context.request,
    cookies: context.cookies,
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.banned_until && new Date(user.banned_until).getTime() > Date.now()) {
    await supabase.auth.signOut();
    if (pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Acceso suspendido' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!pathname.startsWith('/admin/login')) return context.redirect('/admin/login?suspendido=1');
    context.locals.user = null;
    context.locals.supabase = supabase;
    return next();
  }

  context.locals.user = user ?? null;
  context.locals.supabase = supabase;

  if (
    isGerenteSedeUser(user) &&
    pathname.startsWith('/admin') &&
    !pathname.startsWith('/admin/sede') &&
    !pathname.startsWith('/admin/login')
  ) {
    return context.redirect('/admin/sede');
  }

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
