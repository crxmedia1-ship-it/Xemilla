# XEMILLA — ESTADO ACTUAL DEL PROYECTO

> **Última Actualización:** 2026-08-10 00:05 -04  
> **Brand / Parent:** CRX  
> **Stack:** Astro 7 · Tailwind CSS 4 · Supabase · Cloudinary · Vercel (`@astrojs/vercel`)  
> **Runtime:** Node `>=22.12.0` · SSR (`output: 'server'`)

---

## 1. Resumen ejecutivo + roles

**Xemilla** es el producto vertical gastronómico de **CRX**: SaaS multi-tenant. Cada restaurante tiene una **WebApp pública por slug** (linktree / menú digital) y un **panel Admin** para operar menú e identidad.

| Rol | Cómo se determina | Superficie | Responsabilidad |
|-----|-------------------|------------|-----------------|
| **SuperAdmin** | `isSuperAdminUser` / `getUserAdminRole`: email allowlist (`SUPERADMIN_EMAIL`) **o** `role === 'superadmin'` en metadata | Hub `/admin/super/*` → gestiona locales; Identidad en `/admin/dashboard` | Alta de restaurantes, métricas de red, motor de diseño, **crear credenciales operativas** |
| **Admin Operativo** | `app_metadata` / `user_metadata`: `role: 'admin_operativo'` + `restaurante_id` → `isSuperAdmin === false` | `/admin/dashboard` **Menú** + **Métricas** + **Perfil** (SSR oculta Identidad / + Nuevo Restaurante / Guardar marca) | CRUD platos del local asignado; perfil (contacto/horario/redes) vía `POST /api/update-operativo-contacto` (`whatsapp_url` + `horarios` + `instagram_url` + `redes_sociales`); query `?restaurante=` ajeno se ignora |
| **Cliente final** | — | `RestaurantApp.astro` vía `[slug].astro` | Home temático + paneles Menú / Nosotros / Ubicación + gadgets |

**Redirect post-login** (`getAdminPostLoginPath`): SuperAdmin → `/admin/super/dashboard` · Operativo → `/admin/dashboard?restaurante=<assigned>` (SSR fuerza metadata `restaurante_id`, id|slug → fallback `user_id`). Middleware bloquea `/admin/super/*` si no es SuperAdmin.

**Alta operativa:** SuperAdmin Hub → card local → “Credenciales operativas” → `POST /api/create-admin-user` (service role `createUser` + link `restaurantes.user_id`; `/api/admin/create-operativo` es proxy).

### Mapa rápido de archivos

| Área | Ruta |
|------|------|
| Admin Identidad (Power Studio) | `src/pages/admin/dashboard.astro` |
| Hub SuperAdmin | `src/pages/admin/super/dashboard.astro` |
| Shell WebApp | `src/components/app/RestaurantApp.astro` |
| Homes | `themes/home/HomeEditorial\|HeroCards\|BentoGrid\|Minimal.astro` |
| Atmósfera | `src/components/app/SectionAtmosphere.astro` |
| Tokens UI | `src/lib/secciones-ui.js` |
| Themes Home/Ubicación | `src/lib/layout-themes.js` |
| API marca | `src/pages/api/update-marca.js` |
| API ops contacto | `src/pages/api/update-operativo-contacto.js` (`whatsapp_url` + `horarios` + `instagram_url` + `redes_sociales`; nunca `ui_estilo`) |
| Tipografías | `src/config/typography-combos.js` |
| Layout + VT | `src/layouts/Layout.astro` (`ClientRouter`) |
| Temas admin CSS | `src/styles/admin-themes.css` · key `xemilla-admin-theme` |
| Schema | `supabase_schema.sql` |

---

## 2. WebApp pública

### Plantillas Home (`restaurantes.home_theme`)

Normalizadas en `layout-themes.js` → enrutadas en `RestaurantApp.astro` (try/catch + `resolveSafeHomeProps`):

| ID | Componente | Notas |
|----|------------|--------|
| `editorial` | `HomeEditorial.astro` | Índice tipográfico; las 3 navs |
| `hero` | `HomeHeroCards.astro` | Cards glass; nav central solo en `frontal` |
| `bento` | `HomeBentoGrid.astro` | Grid asimétrico |
| `minimal` | `HomeMinimal.astro` | Stories / 100vh |

> **Desacoplamiento (2026-07-27):** los 4 themes son **solo estructura** (logo / títulos / slogans / nav). Contenedores `bg-transparent`. **No** renderizan `secciones_fondo`, `SectionAtmosphere`, imágenes/videos de fondo ni overlays de atmósfera. Atmósfera centralizada en `RestaurantApp` → `[data-home-shell]`: `SectionAtmosphere` con `fixed inset-0 z-0 pointer-events-none` + theme wrapper `relative z-10 pointer-events-auto`. Shell `bg-transparent`.

> **Escalas only (2026-07-27):** Admin Identidad ya **no** expone controles X/Y. Solo sliders de tamaño (`logo_size`, `titulo_size`, `eslogan_size`, `menu_size`) en card **Escalas de Tipografía y Logo**. WebApp pública usa flex/grid (ignora offsets legacy). Backend puede normalizar offsets ausentes a 0; keys viejas en DB no se borran.

> **Nota:** `DEFAULT_HOME_THEME` en código = `'bento'`; schema / Admin default = `'editorial'`. Unificar está en backlog.

### Navegación (`ui_estilo.home.estilo_navegacion`)

Chrome compartido en `RestaurantApp` (hamburguesa + app_tabs aplican a **todos** los themes). Themes solo renderizan lista central si `estiloNavegacion === 'frontal'`.

| Valor | Comportamiento |
|-------|----------------|
| `frontal` (default) | Logo + títulos + lista central Linktree (Menú, Reservas, Nosotros, Ubicación + gadgets) |
| `hamburguesa` | Solo logo centrado + ☰ top-right; overlay Alchemist `fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl` · links `text-3xl/4xl font-light tracking-widest text-white/70` → `hover:text-white hover:tracking-[0.3em]` |
| `app_tabs` | Sin opciones centrales; `fixed bottom-0 w-full` tab bar (Menú, Nosotros, Ubicación) |

**Legacy DB:** `fijo` → `frontal` · `oculto` → `hamburguesa` (vía `normalizeEstiloNavegacion` en `secciones-ui.js`).

### Fondos (`secciones_fondo.home` + `SectionAtmosphere`)

**Dueño único:** `RestaurantApp.astro` dentro de `[data-home-shell]` (no los themes). Props: `tipo`/`valor` desde `secciones_fondo.home`; `fondoAnimacion`, `overlayEstilo`, `overlayOpacity` desde `ui_estilo.home`.

| Tipo | Valor | Render |
|------|-------|--------|
| `color` | HEX | Capa sólida |
| `image` | URL | `bg-cover` + Ken Burns |
| `carrusel` | URLs `,` / `;` / newline | Crossfade cada **4s** |
| `video` | `.mp4` / `.webm` / Cloudinary | `<video autoplay loop muted playsinline>` + clase `fondo_animacion` |

**Stacking Home:** atmósfera `fixed inset-0 z-0` (`pointer-events-none`, prop `fixed` en `SectionAtmosphere`) · theme `relative z-10` (`pointer-events-auto`) · shell `bg-transparent`. Overlay panels siguen usando atmósfera `absolute inset-0 z-0`. **No usar `z-[-1]`** (puede quedar detrás del background del `body`).

### Ken Burns / `fondo_animacion`

| Valor | Clase | Efecto |
|-------|-------|--------|
| `in` (default) | `animate-ken-burns` | scale 1.0 → 1.15, 30s alternate |
| `out` | `animate-ken-burns-out` | scale 1.15 → 1.0 |
| `pan` | `animate-pan-horizontal` | translateX ±4% + scale(1.08) |
| `float` | `animate-float-vertical` | translateY ±3% + scale(1.06) |
| `glow` | `animate-pulse-glow` | scale + brightness |
| `ninguna` | — | Fijo (video / multi-carrusel) |

**Premium default (imagen):** tipo `image` o carrusel de 1 slide con `ninguna`/vacío → **siempre** `animate-ken-burns` (fotos nunca estáticas). Video respeta el mapa canónico (`in` → ken-burns).

Aplica a **imagen, video y carrusel** (single + slides). Tokens en `global.css` `@theme`.  
Persistencia canónica: `ui_estilo.home.fondo_animacion` (no en `secciones_fondo`).

### Overlays (`overlay_estilo`)

`puro` · `gradiente` · `vineta` · `oscuro` (default, opacity 0–90%, default **40**) · `cinematico` (gradiente `from-black/80 via-black/40 to-black/80` + `.bg-film-grain` SVG noise, opacity ~0.12, `mix-blend-mode: overlay`).

### Efectos de entrada (`efecto_entrada`)

Shared CSS `home-anim-*` / `home-enter` / `home-reveal-inner` (~800–1200ms, stagger Logo→Título→Eslogan→Botones). Aplica en los **4** homes.

| Valor | Animación |
|-------|-----------|
| `reveal` | Máscara + translateY |
| `rise` | Fade + translateY |
| `blur` | Blur → nitidez |
| `zoom` | scale ~1.1→1 |
| `tracking` | letter-spacing → `--home-tracking` |
| `ninguno` (default) | Sin animación |

### White-label

La WebApp pública (**no** muestra “Powered by CRX”). Branding CRX solo en `index.astro` / `admin/login`.

### Tipografías (`typography-combos.js`)

`luxe-editorial` · `modern-gastrobar` · `classic-bistro` · `minimal-stark` → CSS vars `--font-heading` / `--font-body`.

### CSS avanzado + View Transitions

- Canónico: `ui_estilo.css_avanzado` (alias columna `custom_css`)
- Scoped bajo `.restaurant-app` vía `scopeCssAvanzado()`
- `ClientRouter` (`astro:transitions`) en `Layout.astro`

---

## 3. Parámetros `ui_estilo.home`

Fuente: `src/lib/secciones-ui.js` → `HOME_PX_DEFAULTS` / `HOME_PX_RANGES`.  
Persistencia: `restaurantes.ui_estilo` JSONB → clave `home`.  
Form Admin: **nombres cortos** (`logo_size`, `titulo_color`, …); API también acepta `home_*`.

### CSS vars (cortas + aliases)

`uiEstiloToCssVars()` emite cortas canónicas y aliases `--home-*`:

| Corta | Alias | Uso público Home |
|-------|-------|------------------|
| `--logo-size` / `--logo-x` / `--logo-y` | `--home-logo-*` | **size sí** · **x/y ignorados** (layout centrado) |
| `--titulo-size` / `--titulo-x` / `--titulo-y` / `--titulo-color` | `--home-titulo-*` | size + color sí · **offsets no** |
| `--eslogan-size` / `--eslogan-x` / `--eslogan-y` / `--eslogan-color` | `--home-eslogan-*` | size + color sí · **offsets no** |
| `--menu-size` / `--menu-x` / `--menu-y` / `--menu-color` | `--home-menu-*` | size + color sí · **offsets no** |
| `--subtexto-color` / `--borde-destacado` | `--home-subtexto-color` / `--home-borde-destacado` | sí |

Más: `--home-overlay-opacity` · `--home-overlay-estilo` · `--home-fondo-animacion` · `--home-estilo-navegacion` · `--home-efecto-entrada` · `--home-tracking`.

### Logo / tipografía (Admin: solo escalas)

| Campo | Default | Rango |
|-------|---------|-------|
| `logo_size` | **160** px | **10–400** |
| `titulo_size` | 28 px | 12–72 |
| `eslogan_size` | 14 px | 10–36 |
| `menu_size` | 16 px | 12–36 |
| `titulo_color` | `#ffffff` | HEX |
| `eslogan_color` | `#e5e7eb` | HEX |
| `menu_color` | `#ffffff` | HEX |
| `subtexto_color` | `#9f1239` | HEX |
| `borde_destacado_color` | `#9f1239` | HEX |
| `tracking` | `tracking-[0.3em]` | set `HOME_TRACKINGS` |

Offsets X/Y: **retirados del Admin UI**. Legacy en DB / `buildUiEstiloFromBody` defaults a 0; themes públicos no los usan.

### Atmósfera / nav / entrada

| Campo | Default |
|-------|---------|
| `overlay_estilo` | `oscuro` |
| `overlay_opacity` | `40` (%) · rango 0–90 |
| `fondo_animacion` | `in` |
| `estilo_navegacion` | `frontal` |
| `efecto_entrada` | `ninguno` |

Tamaños `0` / `null` / vacío → fallback (`normalizeHomePx`).

---

## 4. SuperAdmin UI

### Hub SuperAdmin — `admin/super/dashboard.astro`

- Lista de locales (cards `glass-panel solid-obstacle`) + CTA **Gestionar Restaurante** → `/admin/dashboard?restaurante=…`
- Badge Acceso Activo / Sin Acceso: SSR cruza Auth `listUsers` (metadata `restaurante_id`) — **no** `Boolean(user_id)` (ese campo suele ser el SuperAdmin)
- Tabs: **Locales** · **Métricas** (red, 30 días)
- Theme switcher + **Nuevo restaurante** + logout
- **Sin** Live Preview

### Panel restaurante — Top Nav unificado (`admin/dashboard.astro`)

- **Sin sidebar.** Sticky Top Navbar (`sticky top-0 z-50 … bg-zinc-950/80 backdrop-blur-xl`).
- **Izquierda:** wordmark **Xemilla** + badge Studio Online (emerald + `animate-ping`).
- **Centro:** pills `data-tab-target` — **Menú** · **Métricas** · **Perfil** · **Identidad** (`{isSuperAdmin && …}` SSR; operativo no renderiza tab ni `#panel-identidad`). Perfil (`#panel-perfil` / `data-tab-panel="perfil"`) visible para operativo y SuperAdmin con local.
- **Derecha:** **+ Nuevo Restaurante** · **💾 Guardar** (`#marca-save` / `form="marca-form"`) — ambos solo SuperAdmin · ☀️/🌙 · avatar + logout.
- Contenido: `relative z-10 max-w-6xl …`. Cards densas `studio-card` / `p-4 rounded-2xl`.
- Identidad: sub-nav `data-marca-subtab` — Home / Nosotros / Menú / Ubicación / Reservas / Gadgets.

### Power Studio Identidad (Home / Core)

Rediseño denso (**sin Live Preview**, sin copy largo). Grid `md:2` / `lg:3` `gap-4`. Persistencia: `POST /api/update-marca`.

| Card | Campos |
|------|--------|
| **Arquitectura & Nav** | `home_theme`, `home_estilo_navegacion`, `home_efecto_entrada`, `home_fondo_animacion` |
| **Identidad & Marca** | logo preview + colores (`titulo`/`eslogan`/`menu`/`borde_destacado`) + `logo_url`, `tagline_superior`, `nombre_comercial`, `eslogan`, `tipografia_combo`, `home_tracking` |
| **Atmósfera & Overlays** | `fondo_home_tipo/valor`, `home_overlay_estilo`, `home_overlay_opacity` |
| **Colores** (slim) | `subtexto_color`, `color_primario` (+ hidden `color_texto`) |
| **Escalas de Tipografía y Logo** (visible) | solo `logo_size` · `titulo_size` · `eslogan_size` · `menu_size` (sin X/Y) |
| **Share & CSS** | `share_image_url`, `app_icon_url`, `css_avanzado` |

**Live Preview: REMOVIDO** — no hay iframe, phone chrome, sticky split-screen ni sync de CSS vars hacia preview. “Abrir WebApp ↗” abre `/{slug}` en pestaña nueva.

### Temas admin (dark / light)

| Key | Valor | Nombre | Visual |
|-----|-------|--------|--------|
| `localStorage` `xemilla-admin-theme` | `dark` (default) | **Observatorio Cósmico** | `admin-deep-space` (orbs, nebula, stars, amber) |
| | `light` | **La Habitación del Tiempo** | Radial void `from-white via-slate-50 to-slate-200` en `Layout.astro` — **sin palacio, sin grid texture** |

Scoped: `html.admin-panel` + `data-theme` / `.dark`|`.light`. Toggle: `AdminThemeSwitcher.astro`. CSS: `admin-themes.css`.

---

## 5. Admin decoración (aquarium / drift) — REMOVIDO

**2026-08-03:** Eliminado del Admin el aquarium / gastronomic drift.

| Removido | Dónde estaba |
|----------|--------------|
| `#gastronomic-drift-layer` + 8 `<img>` Cloudinary flotantes | `Layout.astro` (`adminPanel`) |
| Script `requestAnimationFrame` (física de bordes, setup/teardown View Transitions) | `Layout.astro` inline script |
| Reglas `#gastronomic-drift-layer` / `.floating-item` / theme visibility | `admin-themes.css` |
| `@keyframes floating` + `--animate-floating` | `global.css` (solo Admin drift) |

**Conservado:** fondos temáticos Admin (`admin-deep-space` / Habitación del Tiempo void radial); wrapper slot `relative z-10 pointer-events-auto`. **No tocado:** WebApp pública `SectionAtmosphere` / Ken Burns.

Clases residuales `.solid-obstacle` en dashboard cards son inocuas (ya no hay física).

---

## 6. Backend `/api/update-marca` + schema

### `POST /api/update-marca` (`src/pages/api/update-marca.js`)

- Auth SuperAdmin / write client; CORS + `OPTIONS`
- Construye:
  - `ui_estilo` ← `buildUiEstiloFromBody` (nav / animación / entrada normalizados)
  - `secciones_fondo` ← `buildSeccionesFondoFromBody`
  - columnas marca, tipografía, gadgets, `nosotros_bloques`, redes, reservas…
  - `home_theme` / `ubicacion_theme` vía `normalizeHomeTheme` / `normalizeUbicacionTheme`
- Persiste en Supabase `restaurantes` (fallback legacy si faltan columnas gadgets)

### Lectura pública (`restaurantes.js`)

`parseUiEstilo` · `parseSeccionesFondo` · `resolveMediaUrl` · `uiEstiloToCssVars` · alias `custom_css` → `css_avanzado`.

**Mapa Admin → WebApp (canónico, 2026-07-30):**

| Studio / save | Columna / JSONB | Consumo público |
|---------------|-----------------|-----------------|
| Fondo Home tipo/URL | `secciones_fondo.home.{tipo,valor}` (+ legacy `imagen_fondo`) | `RestaurantApp` → `SectionAtmosphere` (`tipo`/`valor`, `resolveMediaUrl`) |
| Plantilla Home | `home_theme` (`minimal` \| `editorial` \| `hero` \| `bento`) | `sanitizeTheme` → monta `HomeMinimal` etc. |
| Tagline superior | `ui_estilo.home.tagline_superior` | eyebrow en Homes (`taglineSuperior`) |
| Nombre / eslogan | `nombre_comercial` / `eslogan` | `logoText` + `tagline` (Supabase gana; `brand.js` solo huecos) |
| Overlay / anim / nav | `ui_estilo.home.*` | props atmósfera + `estiloNavegacion` |

**Fixes 2026-07-30:** `buildIdentity` ya no fuerza textos de `brand.js` sobre DB; atmósfera Home usa `z-0` (no `z-[-1]`); eliminado fallback demo `SAVOR ASIAN DELIGHTS`; `tagline_superior` cableado a Homes.

### Schema (`supabase_schema.sql`) — notas

| Columna | Notas |
|---------|-------|
| `ui_estilo` JSONB | tokens `home` / secciones / `css_avanzado` |
| `secciones_fondo` JSONB | `{ home, nosotros, menu, ubicacion: { tipo, valor } }` |
| `home_theme` TEXT | DEFAULT `'editorial'` |
| `ubicacion_theme` TEXT | DEFAULT `'modal'` (`modal` \| `split`) |
| `custom_css` TEXT | legacy ↔ `ui_estilo.css_avanzado` |
| + | `tipo_letra`, colores, logos, share/PWA, gadgets… |

---

## 7. Backlog

### Hecho

- [x] Ken Burns (`fondo_animacion`: in/out/pan/float/glow/ninguna) en imagen + video + carrusel  
- [x] Overlay cinemático + Film Grain  
- [x] Audit 2026-07-26: Admin→`ui_estilo.home`→`SectionAtmosphere` OK; fix anim en carrusel; `cinematic`→`cinematico`; `HOME_FONDO_ANIMACIONES` completo  
- [x] Efectos entrada (reveal/rise/blur/zoom/tracking) en Admin + 4 homes  
- [x] White-label público (sin “Powered by CRX” en WebApp)  
- [x] Removido preset “Cargar Preset de Diseño”  
- [x] **Removido Live Preview** (iframe / phone chrome / sync preview)  
- [x] Top Nav unificado + Power Studio denso  
- [x] Temas Observatorio / Void radial (sin aquarium / drift)  
- [x] **Themes Home = estructura only**; atmósfera centralizada en `RestaurantApp` / `SectionAtmosphere` (2026-07-27) 
- [x] **Admin menú VT fix (2026-07-29):** `dashboard.astro` re-bind en `astro:page-load` + AbortController teardown (`astro:before-preparation`); valida `restaurante_id`; Nuevo Plato auto-categoría `General` si no hay categorías; try/catch + toast/`console.error('Error en menú:')`
- [x] **Operativo SSR restaurant load (2026-07-30):** metadata `restaurante_id` (app|user) → id|slug → fallback `user_id`; login `?restaurante=`; create-operativo refuerza metadata
- [x] **Studio→WebApp identity sync (2026-07-30):** DB texts/fondo/`home_theme`/`tagline_superior` reflejan en `[slug]`; atmósfera `z-0`; sin demo hardcodes

### Pendiente

- [ ] Vista expandida / transición al abrir secciones del Menú desde Home  
- [ ] Unificar `DEFAULT_HOME_THEME` (`bento` en `layout-themes.js` vs default Admin/schema `editorial`)  
- [ ] Tests de humo: Admin save → `ui_estilo.home` → render público (3 nav styles)  
- [x] **Admin aquarium/drift removido (2026-08-03):** sin `#gastronomic-drift-layer`, sin rAF, sin CSS `.floating-item`; UI Admin limpia (search/botones libres)
- [x] **Admin operativo UX (2026-08-09):** thumbnails media 40×40; pills filtro categoría; grip prep visual; card Contacto/horario → `POST /api/update-operativo-contacto` (aislado de Identidad/`ui_estilo`)
- [x] **Admin tab Perfil (2026-08-10):** pill Perfil junto a Menú/Métricas; card «Perfil del Restaurante» migrada desde Menú; Instagram + TikTok/Facebook (`instagram_url` + `redes_sociales`); save aislado vía `update-operativo-contacto`

---

## 8. Guía rápida para chat IA nuevo

1. **Leer este archivo primero** (SSOT).  
2. Defaults / rangos / normalize: `src/lib/secciones-ui.js`.  
3. SuperAdmin hub: `admin/super/dashboard.astro`. Identidad / Power Studio: `admin/dashboard.astro` (`marca-form`, tab Identidad). **No existe Live Preview.**  
4. Temas admin: `xemilla-admin-theme` → dark = Observatorio Cósmico · light = Habitación del Tiempo (void radial, no palace). CSS: `admin-themes.css`. **Sin aquarium/drift flotante.**  
5. Admin layout: fondos temáticos `z-[-1]` + slot `relative z-10 pointer-events-auto`. Sin imágenes decorativas flotantes.  
6. Render público: `RestaurantApp.astro` → `[data-home-shell]`: `SectionAtmosphere` (`fixed z-0`) + Home theme estructura (`z-10`) + chrome nav. Themes **no** pintan fondos. No usar `z-[-1]` (queda bajo el bg del `body`).  
7. Persistencia Identidad: `POST /api/update-marca` → Supabase. Perfil operativo (contacto/horario/redes): `POST /api/update-operativo-contacto` (whitelist `whatsapp_url` + `horarios` + `instagram_url` + `redes_sociales`; nunca `ui_estilo`).  
8. **No inventar** `IdentidadMarca.astro`: vive en `dashboard.astro`.  
9. `logo_size` = **10–400** (default 160). CSS vars cortas + aliases `--home-*`.

---

*Single Source of Truth del estado real del repo Xemilla a la fecha indicada. No commitear este archivo salvo petición explícita.*
