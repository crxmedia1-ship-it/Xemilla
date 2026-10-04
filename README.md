# Xemilla

SaaS multi-tenant de CRX para restaurantes: cada local tiene una WebApp pública por slug (`/<slug>`: menú digital, nosotros, ubicación, gadgets) y un panel de administración (`/admin`).

Estado detallado, roles y decisiones de diseño: [`ESTADO_ACTUAL.md`](./ESTADO_ACTUAL.md).

## Stack

Astro 7 (SSR) · Tailwind CSS 4 · Supabase (Postgres + Auth) · Cloudinary (media) · Vercel.

## Puesta en marcha

Requiere Node `>=22.12.0`.

```sh
npm install
npm run dev        # o: npx astro dev --background
```

### Variables de entorno (`.env`, nunca en git)

| Variable                       | Uso                                                        |
| :----------------------------- | :--------------------------------------------------------- |
| `PUBLIC_SUPABASE_URL`          | URL del proyecto Supabase                                  |
| `PUBLIC_SUPABASE_ANON_KEY`     | Clave pública de Supabase                                  |
| `SUPABASE_SERVICE_ROLE_KEY`    | Solo servidor; operaciones de SuperAdmin                   |
| `SUPERADMIN_EMAIL`             | Correo del SuperAdmin (igual que en `public.is_superadmin()`) |
| `PUBLIC_CLOUDINARY_CLOUD_NAME` | Cloud de Cloudinary                                        |
| `CLOUDINARY_API_KEY`           | Solo servidor; subidas                                     |
| `CLOUDINARY_API_SECRET`        | Solo servidor; subidas                                     |

Las mismas variables deben estar configuradas en Vercel.

## Comandos

| Comando           | Acción                                          |
| :---------------- | :---------------------------------------------- |
| `npm run dev`     | Servidor local en `localhost:4321`              |
| `npm run build`   | Build de producción                             |
| `npm run preview` | Previsualiza el build                           |
| `npm run check`   | Verificación de tipos (`astro check`)           |
| `npm run lint`    | ESLint                                          |

## Estructura

```text
src/
  pages/            rutas: /[slug], /admin/*, /api/*
  components/       app pública, temas (home/nosotros/ubicación), admin, gadgets
  scripts/          JS de cliente de las páginas grandes (dashboards, menú, app)
  lib/ config/      lógica compartida, Supabase, Cloudinary, temas
  middleware.js     sesión del panel, guardas de SuperAdmin y caché pública
supabase/
  schema.sql        esquema base + RLS
  migrations/       migraciones aplicadas en el proyecto remoto
  scripts/          scripts SQL puntuales
```

## Roles y seguridad

- El rol (`superadmin`, `admin_operativo`) y el `restaurante_id` se leen **solo de `app_metadata`**, que únicamente el servidor (service role) puede modificar. Nunca de `user_metadata`.
- Las credenciales se leen solo de variables de entorno; no hay valores de respaldo en el código.
