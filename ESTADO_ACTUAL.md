# XEMILLA — ESTADO ACTUAL DEL PROYECTO

> **Última Actualización:** 2026-09-05 20:42 -04  
> **Brand / Parent:** CRX  
> **Stack:** Astro 7 · Tailwind CSS 4 · Supabase · Cloudinary · Vercel (`@astrojs/vercel`)  
> **Runtime:** Node `>=22.12.0` · SSR (`output: 'server'`)

---

## 1. Resumen ejecutivo + roles

**Xemilla** es el producto vertical gastronómico de **CRX**: SaaS multi-tenant. Cada restaurante tiene una **WebApp pública por slug** (linktree / menú digital) y un **panel Admin** para operar menú e identidad.


| Rol                 | Cómo se determina                                                                                                       | Superficie                                                                                                                         | Responsabilidad                                                                                                                                                                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **SuperAdmin**      | `isSuperAdminUser` / `getUserAdminRole`: email allowlist (`SUPERADMIN_EMAIL`) **o** `role === 'superadmin'` en metadata | Hub `/admin/super/`* → gestiona locales; Identidad en `/admin/dashboard`                                                           | Alta de restaurantes, métricas de red, motor de diseño, **crear credenciales operativas**                                                                                                                                                              |
| **Admin Operativo** | `app_metadata` / `user_metadata`: `role: 'admin_operativo'` + `restaurante_id` → `isSuperAdmin === false`               | `/admin/dashboard` **Menú** + **Métricas** + **Operación & Anuncios** (SSR oculta Identidad / + Nuevo Restaurante / Guardar marca) | CRUD platos; ops (horario/contacto/mapa/flyer) vía `POST /api/update-operativo-contacto` (`whatsapp_url` + `horarios` + `instagram_url` + `redes_sociales` + `direccion` + `coordenadas_maps` + `popup_banner`); query `?restaurante=` ajeno se ignora |
| **Cliente final**   | —                                                                                                                       | `RestaurantApp.astro` vía `[slug].astro`                                                                                           | Home temático + paneles Menú / Nosotros / Ubicación + gadgets + **flyer de bienvenida** (`WelcomePopup`)                                                                                                                                               |


**Redirect post-login** (`getAdminPostLoginPath`): SuperAdmin → `/admin/super/dashboard` · Operativo → `/admin/dashboard?restaurante=<assigned>` (SSR fuerza metadata `restaurante_id`, id|slug → fallback `user_id`). Middleware bloquea `/admin/super/`* si no es SuperAdmin.

**Alta operativa:** SuperAdmin Hub → card local → “Credenciales operativas” → `POST /api/create-admin-user` (service role `createUser` + link `restaurantes.user_id`; `/api/admin/create-operativo` es proxy).

### Mapa rápido de archivos


| Área                               | Ruta                                                                                                 |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Admin Identidad (Power Studio)     | `src/pages/admin/dashboard.astro`                                                                    |
| Métricas Studio                    | `src/components/admin/AdminMetricsPanel.astro` + `src/lib/metrics.js`                                 |
| Trim logos Cloudinary              | `src/lib/plato-media-url.js` → `cloudinaryTrimUrl` (`e_trim`) — header + píldora pie                 |
| Hub SuperAdmin                     | `src/pages/admin/super/dashboard.astro`                                                              |
| Ops UI — horario / contacto / mapa | `src/components/admin/PerfilLocalCard.astro`                                                         |
| Ops UI — flyer de bienvenida       | `src/components/admin/WelcomePopupCard.astro`                                                        |
| Flyer público (WebApp)             | `src/components/app/WelcomePopup.astro`                                                              |
| Parse / serialize popup            | `src/lib/popup-banner.js`                                                                            |
| Shell WebApp                       | `src/components/app/RestaurantApp.astro`                                                             |
| Homes                              | `themes/home/HomeEditorial                                                                           |
| Atmósfera                          | `src/components/app/SectionAtmosphere.astro`                                                         |
| Tokens UI                          | `src/lib/secciones-ui.js`                                                                            |
| Themes Home/Ubicación              | `src/lib/layout-themes.js`                                                                           |
| API marca                          | `src/pages/api/update-marca.js`                                                                      |
| API ops contacto                   | `src/pages/api/update-operativo-contacto.js` (whitelist ops + `popup_banner`; **nunca** `ui_estilo`) |
| Tipografías                        | `src/config/typography-combos.js`                                                                    |
| Layout + VT                        | `src/layouts/Layout.astro` (`ClientRouter`)                                                          |
| Temas admin CSS                    | `src/styles/admin-themes.css` · key `xemilla-admin-theme`                                            |
| Schema                             | `supabase_schema.sql`                                                                                |


---



## 2. WebApp pública



### Plantillas Home (`restaurantes.home_theme`)

Normalizadas en `layout-themes.js` → enrutadas en `RestaurantApp.astro` (try/catch + `resolveSafeHomeProps`):


| ID          | Componente            | Notas                                      |
| ----------- | --------------------- | ------------------------------------------ |
| `editorial` | `HomeEditorial.astro` | Índice tipográfico; las 3 navs             |
| `hero`      | `HomeHeroCards.astro` | Cards glass; nav central solo en `frontal` |
| `bento`     | `HomeBentoGrid.astro` | Grid asimétrico                            |
| `minimal`   | `HomeMinimal.astro`   | Stories / 100vh                            |


> **Desacoplamiento (2026-07-27):** los 4 themes son **solo estructura** (logo / títulos / slogans / nav). Contenedores `bg-transparent`. **No** renderizan `secciones_fondo`, `SectionAtmosphere`, imágenes/videos de fondo ni overlays de atmósfera. Atmósfera centralizada en `RestaurantApp` → `[data-home-shell]`: `SectionAtmosphere` con `fixed inset-0 z-0 pointer-events-none` + theme wrapper `relative z-10 pointer-events-auto`. Shell `bg-transparent`.

> **Escalas only (2026-07-27):** Admin Identidad ya **no** expone controles X/Y. Solo sliders de tamaño (`logo_size`, `titulo_size`, `eslogan_size`, `menu_size`) en card **Escalas de Tipografía y Logo**. WebApp pública usa flex/grid (ignora offsets legacy). Backend puede normalizar offsets ausentes a 0; keys viejas en DB no se borran.

> **Nota:** `DEFAULT_HOME_THEME` en código = `'bento'`; schema / Admin default = `'editorial'`. Unificar está en backlog.



### Flyer de bienvenida (`popup_banner`)

- **Admin:** tab **Operación & Anuncios** → `WelcomePopupCard` (toggle, dropzone póster 4:5, «Siempre visible» / «Programar límite» → `expires_at`).
- **Persistencia:** JSONB `restaurantes.popup_banner` vía `POST /api/update-operativo-contacto` (`buildPopupBannerFromBody` / `serializePopupBanner` en `popup-banner.js`).
- **Público:** `RestaurantApp` monta `WelcomePopup.astro` si `popupBannerIsRenderable` (enabled + `image_url` + no vencido). Una vez por sesión (`sessionStorage`).
- **Presets:** `indefinite` | `schedule` (fecha+hora → ISO `expires_at`). Legacy `custom`/`today`/`weekend` se normalizan al parsear.



### Navegación (`ui_estilo.home.estilo_navegacion`)

Chrome compartido en `RestaurantApp` (hamburguesa + app_tabs aplican a **todos** los themes). Themes solo renderizan lista central si `estiloNavegacion === 'frontal'`.


| Valor               | Comportamiento                                                                                                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `frontal` (default) | Logo + títulos + lista central Linktree (Menú, Reservas, Nosotros, Ubicación + gadgets)                                                                                                                            |
| `hamburguesa`       | Solo logo centrado + ☰ top-right; overlay Alchemist `fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl` · links `text-3xl/4xl font-light tracking-widest text-white/70` → `hover:text-white hover:tracking-[0.3em]` |
| `app_tabs`          | Sin opciones centrales; `fixed bottom-0 w-full` tab bar (Menú, Nosotros, Ubicación)                                                                                                                                |


**Legacy DB:** `fijo` → `frontal` · `oculto` → `hamburguesa` (vía `normalizeEstiloNavegacion` en `secciones-ui.js`).

### Fondos (`secciones_fondo.home` + `SectionAtmosphere`)

**Dueño único:** `RestaurantApp.astro` dentro de `[data-home-shell]` (no los themes). Props: `tipo`/`valor` desde `secciones_fondo.home`; `fondoAnimacion`, `overlayEstilo`, `overlayOpacity` desde `ui_estilo.home`.


| Tipo       | Valor                         | Render                                                              |
| ---------- | ----------------------------- | ------------------------------------------------------------------- |
| `color`    | HEX                           | Capa sólida                                                         |
| `image`    | URL                           | `bg-cover` + Ken Burns                                              |
| `carrusel` | URLs `,` / `;` / newline      | Crossfade cada **4s**                                               |
| `video`    | `.mp4` / `.webm` / Cloudinary | `<video autoplay loop muted playsinline>` + clase `fondo_animacion` |


**Stacking Home:** atmósfera `fixed inset-0 z-0` (`pointer-events-none`, prop `fixed` en `SectionAtmosphere`) · theme `relative z-10` (`pointer-events-auto`) · shell `bg-transparent`. Overlay panels siguen usando atmósfera `absolute inset-0 z-0`. **No usar** `z-[-1]` (puede quedar detrás del background del `body`).

### Ken Burns / `fondo_animacion`


| Valor          | Clase                    | Efecto                          |
| -------------- | ------------------------ | ------------------------------- |
| `in` (default) | `animate-ken-burns`      | scale 1.0 → 1.15, 30s alternate |
| `out`          | `animate-ken-burns-out`  | scale 1.15 → 1.0                |
| `pan`          | `animate-pan-horizontal` | translateX ±4% + scale(1.08)    |
| `float`        | `animate-float-vertical` | translateY ±3% + scale(1.06)    |
| `glow`         | `animate-pulse-glow`     | scale + brightness              |
| `ninguna`      | —                        | Fijo (video / multi-carrusel)   |


**Premium default (imagen):** tipo `image` o carrusel de 1 slide con `ninguna`/vacío → **siempre** `animate-ken-burns` (fotos nunca estáticas). Video respeta el mapa canónico (`in` → ken-burns).

Aplica a **imagen, video y carrusel** (single + slides). Tokens en `global.css` `@theme`.  
Persistencia canónica: `ui_estilo.home.fondo_animacion` (no en `secciones_fondo`).

### Overlays (`overlay_estilo`)

`puro` · `gradiente` · `vineta` · `oscuro` (default, opacity 0–90%, default **40**) · `cinematico` (gradiente `from-black/80 via-black/40 to-black/80` + `.bg-film-grain` SVG noise, opacity ~0.12, `mix-blend-mode: overlay`).

### Efectos de entrada (`efecto_entrada`)

Shared CSS `home-anim-*` / `home-enter` / `home-reveal-inner` (~800–1200ms, stagger Logo→Título→Eslogan→Botones). Aplica en los **4** homes.


| Valor               | Animación                          |
| ------------------- | ---------------------------------- |
| `reveal`            | Máscara + translateY               |
| `rise`              | Fade + translateY                  |
| `blur`              | Blur → nitidez                     |
| `zoom`              | scale ~1.1→1                       |
| `tracking`          | letter-spacing → `--home-tracking` |
| `ninguno` (default) | Sin animación                      |




### White-label

La WebApp pública (**no** muestra “Powered by CRX”). Branding CRX solo en `index.astro` / `admin/login`. Landing `/` = fullscreen Alchemist (video + grain + CTA WhatsApp placeholder).

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
Form Admin: **nombres cortos** (`logo_size`, `titulo_color`, …); API también acepta `home_`*.

### CSS vars (cortas + aliases)

`uiEstiloToCssVars()` emite cortas canónicas y aliases `--home-*`:


| Corta                                                                | Alias                                              | Uso público Home                                  |
| -------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------- |
| `--logo-size` / `--logo-x` / `--logo-y`                              | `--home-logo-*`                                    | **size sí** · **x/y ignorados** (layout centrado) |
| `--titulo-size` / `--titulo-x` / `--titulo-y` / `--titulo-color`     | `--home-titulo-*`                                  | size + color sí · **offsets no**                  |
| `--eslogan-size` / `--eslogan-x` / `--eslogan-y` / `--eslogan-color` | `--home-eslogan-*`                                 | size + color sí · **offsets no**                  |
| `--menu-size` / `--menu-x` / `--menu-y` / `--menu-color`             | `--home-menu-*`                                    | size + color sí · **offsets no**                  |
| `--subtexto-color` / `--borde-destacado`                             | `--home-subtexto-color` / `--home-borde-destacado` | sí                                                |


Más: `--home-overlay-opacity` · `--home-overlay-estilo` · `--home-fondo-animacion` · `--home-estilo-navegacion` · `--home-efecto-entrada` · `--home-tracking`.

### Logo / tipografía (Admin: solo escalas)


| Campo                   | Default            | Rango                |
| ----------------------- | ------------------ | -------------------- |
| `logo_size`             | **160** px         | **10–400**           |
| `titulo_size`           | 28 px              | 12–72                |
| `eslogan_size`          | 14 px              | 10–36                |
| `menu_size`             | 16 px              | 12–36                |
| `titulo_color`          | `#ffffff`          | HEX                  |
| `eslogan_color`         | `#e5e7eb`          | HEX                  |
| `menu_color`            | `#ffffff`          | HEX                  |
| `subtexto_color`        | `#9f1239`          | HEX                  |
| `borde_destacado_color` | `#9f1239`          | HEX                  |
| `tracking`              | `tracking-[0.3em]` | set `HOME_TRACKINGS` |


Offsets X/Y: **retirados del Admin UI**. Legacy en DB / `buildUiEstiloFromBody` defaults a 0; themes públicos no los usan.

### Atmósfera / nav / entrada


| Campo               | Default               |
| ------------------- | --------------------- |
| `overlay_estilo`    | `oscuro`              |
| `overlay_opacity`   | `40` (%) · rango 0–90 |
| `fondo_animacion`   | `in`                  |
| `estilo_navegacion` | `frontal`             |
| `efecto_entrada`    | `ninguno`             |


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

- **Sin sidebar.** Sticky Top Navbar fijo a **64px** (`h-16`): `sticky top-0 z-50 w-full px-4 sm:px-8 flex items-center justify-between border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl`. CSS en `admin-themes.css` bloquea `height/min/max: 4rem` (el chip SuperAdmin **no** estira el header).
- **Izquierda — lockup de logos** (sin texto “Xemilla Studio”, sin cápsula, sin nombre, sin ping):
  1. Wordmark Xemilla (`Photoroom_20260810_004814_islrgw.png`) · `h-9`/`sm:h-10` · silueta `brightness(0)` Light / `invert(1)` Dark.
  2. Separador `/`.
  3. Logo del restaurante (`logo_url` vía `cloudinaryTrimUrl` / `e_trim` para recortar canvas transparente) · `h-10` · `ml-2.5` para igualar la distancia óptica al `/` (el wordmark trae padding Photoroom). Fallback: `nombre_comercial` si no hay logo.
  4. Link del wordmark: SuperAdmin → `/admin/super/dashboard`; operativo → `/admin/dashboard`.
- **Centro:** pills `data-tab-target` — **Menú** · **Operación & Anuncios** (solo operativo, `{!isSuperAdmin}`) · **Métricas** · **Identidad** (`{isSuperAdmin && …}` SSR; operativo no renderiza tab ni `#panel-identidad`). Dock inferior replica el mismo orden. Panel ops: `#panel-perfil` / `data-tab-panel="perfil"` / `#ops-contacto-card.ops-studio`.
- **Derecha:** **WebApp ↗** · **Guardar** (`#guardar-cambios` operativo dirty-state · `#marca-save` SuperAdmin) · ☀️/🌙 (`AdminThemeSwitcher`) · avatar + logout. Chip **← SuperAdmin** va en este cluster (`sm:inline-flex`), no debajo del header.
- **Contenido:** `main` + paneles a **ancho completo** (`w-full max-w-none`, sin `max-w-6xl`). Identidad: sub-nav `data-marca-subtab` — Home / Nosotros / Menú / Ubicación / Reservas / Gadgets / QR.
- **Métricas (`#panel-metricas` → `AdminMetricsPanel`):** título **Métricas & Rendimiento** (sin subtítulo) + selector **General / Este Mes / Mes a mes** (meses desde `restaurante.created_at`). Bento `xl:grid-cols-12`: **Vistas Totales** (`col-span-5`, número light + barras Lun–Dom) · **Origen del Tráfico** (`col-span-3`, dona 65/35 + totales QR Mesa / Enlace Directo) · **Acciones de Comensales** (`col-span-4`: Nosotros, Pedir/Reservar 🔔, Maps). Ranking simétrico Lista/Fotos: **Top Rendimiento (Más Vistos)** (rosa `#01`) · **Oportunidades (Menos Vistos)** (cielo `#01`). Modo Fotos: `.studio-photo-card` `aspect-[16/10]` cristal negro (vence remap `text-white` / `bg-zinc-950`). `plato_vistas` live = eventos (`created_at`); filtro mensual agrega por mes; barras semanales desde weekday series. QR / enlace / nosotros / reservas / maps = **0** hasta tracking.
- **Pie — píldora de marca:** `#dashboard-root` footer `.admin-studio-foot-brand`. Cápsula cristal (solo logo, sin nombre comercial). `src` = `cloudinaryTrimUrl(resolveMediaUrl(logo_url))` (`e_trim` recorta canvas Photoroom). Fallback: `AdminXemillaMark`. CSS `.admin-studio-foot-brand__pill` / `__logo` en `admin-themes.css` (vencer remap `bg-white`).



### Operación & Anuncios (2026-09-04)

Tab operativo (y SuperAdmin con local). Light = Clean White; Dark = cards `zinc-900/80` bajo `html.admin-panel.dark #ops-contacto-card.ops-studio` (el remap `html.admin-panel .bg-white` sigue existiendo: no usar `bg-white` en tabs del flyer).

**Layout:** fila superior `lg:grid-cols-3` (Horarios · Flyer · Mapa) + fila inferior Canales de contacto a ancho completo (`socialWide`).

**Horarios:** 7 días siempre en grid horizontal `grid-cols-[75px_1fr_auto]` (nombre · horas · switch). **Sin** interruptor maestro “Cerrado temporalmente”. Pill Abierto/Cerrado vive en el header de la card. Persistencia: `data-hours-open` / `data-hours-close` / `data-hours-toggle` / `data-horario-hidden`.

**Persistencia (importante):**

- Estado **solo en cliente** al interactuar (toggles, inputs, schedule del flyer). **Sin autosave**, sin `location.reload()`, sin submits implícitos.
- Un único save explícito: botón `#guardar-cambios` (aparece dirty / rose + pulse) → `saveOpsContacto()` → `POST /api/update-operativo-contacto`.
- Upload de imagen del flyer (`/api/upload` → Cloudinary) puede ocurrir al elegir archivo; el vínculo en `popup_banner` se persiste al guardar.
- `localOps('perfil')` resuelve `#ops-contacto-card` cuando `nestInParent` (sin `data-local-ops` en wrapper `contents`).
- `PerfilLocalCard` `variant="studio"` también se usa en Identidad SuperAdmin: **no** filtrar layout ops-only hacia Identidad.

**Flyer UI:** cápsula segmentada `popup-seg-tab` / `popup-seg-tab--on` (no usar clase Tailwind `bg-white` en tabs). Slot de fecha/hora con `min-h` + clase `hidden` para no empujar el grid.

### Power Studio Identidad (Home / Core)

Rediseño denso (**sin Live Preview**, sin copy largo). Grid modular. Persistencia: `POST /api/update-marca`.


| Card                                       | Campos                                                                                                                                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Arquitectura & Nav**                     | `home_theme`, `home_estilo_navegacion`, `home_efecto_entrada`, `home_fondo_animacion`                                                                                     |
| **Identidad & Marca**                      | logo preview + colores (`titulo`/`eslogan`/`menu`/`borde_destacado`) + `logo_url`, `tagline_superior`, `nombre_comercial`, `eslogan`, `tipografia_combo`, `home_tracking` |
| **Atmósfera & Overlays**                   | `fondo_home_tipo/valor`, `home_overlay_estilo`, `home_overlay_opacity`                                                                                                    |
| **Colores** (slim)                         | `subtexto_color`, `color_primario` (+ hidden `color_texto`)                                                                                                               |
| **Escalas de Tipografía y Logo** (visible) | solo `logo_size` · `titulo_size` · `eslogan_size` · `menu_size` (sin X/Y)                                                                                                 |
| **Share & CSS**                            | `share_image_url`, `app_icon_url`, `css_avanzado`                                                                                                                         |
| **Gadgets / QR**                           | paneles blancos modulares (selección verde fija)                                                                                                                          |


**Live Preview: REMOVIDO** — no hay iframe, phone chrome, sticky split-screen ni sync de CSS vars hacia preview. “Abrir WebApp ↗” abre `/{slug}` en pestaña nueva.

### Temas admin (dark / light)


| Key                                  | Valor            | Nombre                       | Visual                                                                                                   |
| ------------------------------------ | ---------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| `localStorage` `xemilla-admin-theme` | `dark` (default) | **Observatorio Cósmico**     | `admin-deep-space` (orbs, nebula, stars, amber)                                                          |
|                                      | `light`          | **La Habitación del Tiempo** | Radial void `from-white via-slate-50 to-slate-200` en `Layout.astro` — **sin palacio, sin grid texture** |


Scoped: `html.admin-panel` + `data-theme` / `.dark`|`.light`. Toggle: `AdminThemeSwitcher.astro`. CSS: `admin-themes.css`.  
**Ops:** Light = Clean White (`#ops-contacto-card.ops-studio`). Dark = override zinc (`html.admin-panel.dark #ops-contacto-card.ops-studio`). **Cuidado:** `html.admin-panel .bg-white` remapea a botón primario — no usar `bg-white` en tabs del flyer (`popup-seg-tab--on`).

---



## 5. Admin decoración (aquarium / drift) — REMOVIDO

**2026-08-03:** Eliminado del Admin el aquarium / gastronomic drift.


| Removido                                                                           | Dónde estaba                    |
| ---------------------------------------------------------------------------------- | ------------------------------- |
| `#gastronomic-drift-layer` + 8 `<img>` Cloudinary flotantes                        | `Layout.astro` (`adminPanel`)   |
| Script `requestAnimationFrame` (física de bordes, setup/teardown View Transitions) | `Layout.astro` inline script    |
| Reglas `#gastronomic-drift-layer` / `.floating-item` / theme visibility            | `admin-themes.css`              |
| `@keyframes floating` + `--animate-floating`                                       | `global.css` (solo Admin drift) |


**Conservado:** fondos temáticos Admin (`admin-deep-space` / Habitación del Tiempo void radial); wrapper slot `relative z-10 pointer-events-auto`. **No tocado:** WebApp pública `SectionAtmosphere` / Ken Burns.

Clases residuales `.solid-obstacle` en dashboard cards son inocuas (ya no hay física).

---



## 6. Backend APIs + schema



### `POST /api/update-marca` (`src/pages/api/update-marca.js`)

- Auth SuperAdmin / write client; CORS + `OPTIONS`
- Construye:
  - `ui_estilo` ← `buildUiEstiloFromBody` (nav / animación / entrada normalizados)
  - `secciones_fondo` ← `buildSeccionesFondoFromBody`
  - columnas marca, tipografía, gadgets, `nosotros_bloques`, redes, reservas…
  - `home_theme` / `ubicacion_theme` vía `normalizeHomeTheme` / `normalizeUbicacionTheme`
- Persiste en Supabase `restaurantes` (fallback legacy si faltan columnas gadgets)



### `POST /api/update-operativo-contacto` (`src/pages/api/update-operativo-contacto.js`)

Whitelist aislada de Identidad. Parches tipicos:

- `whatsapp_url`, `horarios`, `eslogan`, `direccion`, `coordenadas_maps`
- `instagram_url` + `redes_sociales` (+ flags `*_activo`)
- `popup_banner` ← `buildPopupBannerFromBody` / `serializePopupBanner`

**Nunca** escribe `ui_estilo` / design tokens.

### Lectura pública (`restaurantes.js`)

`parseUiEstilo` · `parseSeccionesFondo` · `resolveMediaUrl` · `uiEstiloToCssVars` · alias `custom_css` → `css_avanzado` · `parsePopupBanner`.

**Mapa Admin → WebApp (canónico):**


| Studio / save              | Columna / JSONB                                               | Consumo público                       |
| -------------------------- | ------------------------------------------------------------- | ------------------------------------- |
| Fondo Home tipo/URL        | `secciones_fondo.home.{tipo,valor}` (+ legacy `imagen_fondo`) | `RestaurantApp` → `SectionAtmosphere` |
| Plantilla Home             | `home_theme`                                                  | Homes                                 |
| Tagline / nombre / eslogan | columnas + `ui_estilo.home.tagline_superior`                  | Homes                                 |
| Overlay / anim / nav       | `ui_estilo.home.*`                                            | atmósfera + nav                       |
| Flyer bienvenida           | `popup_banner`                                                | `WelcomePopup` si renderable          |




### Schema (`supabase_schema.sql`) — notas


| Columna                 | Notas                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `ui_estilo` JSONB       | tokens `home` / secciones / `css_avanzado`                                         |
| `secciones_fondo` JSONB | `{ home, nosotros, menu, ubicacion: { tipo, valor } }`                             |
| `popup_banner` JSONB    | DEFAULT `'{}'`; `{ enabled, image_url, duration_preset, expires_at, … }`           |
| `home_theme` TEXT       | DEFAULT `'editorial'`                                                              |
| `ubicacion_theme` TEXT  | DEFAULT `'modal'` (`modal`                                                         |
| `custom_css` TEXT       | legacy ↔ `ui_estilo.css_avanzado`                                                  |
| +                       | `tipo_letra`, colores, logos, share/PWA, gadgets, `direccion`, `coordenadas_maps`… |


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
- [x] **Admin aquarium/drift removido (2026-08-03)**
- [x] **Admin operativo UX (2026-08-09):** thumbnails media; pills filtro; grip; card Contacto → `update-operativo-contacto`
- [x] **Admin tab Perfil (2026-08-10):** pill + card Perfil; Instagram + TikTok/Facebook; save aislado
- [x] **Flyer + Operación & Anuncios (2026-09-03):** grid inicial 2×2; `popup_banner` JSONB; `WelcomePopupCard` + `WelcomePopup` público; save solo `#guardar-cambios` (sin autosave); commit `ee3a135`
- [x] **Ops layout + dark (2026-09-04):** fila 3 col (Horarios / Flyer / Mapa) + social full-width; horarios siempre 3-col horizontal; Dark Observatorio en ops (`zinc-900/80`); `#guardar-cambios` dirty rose+pulse
- [x] **Métricas Studio bento (2026-09-05):** `AdminMetricsPanel` 12-col (Vistas + barras Lun–Dom · Origen dona · Acciones 🔔); ranking Top / Oportunidades Lista+Fotos; filtro General / Este Mes / mes desde `created_at`; `plato_vistas` event-mode; píldora pie solo logo (`e_trim`)



### Pendiente

- [ ] Vista expandida / transición al abrir secciones del Menú desde Home  
- [ ] Unificar `DEFAULT_HOME_THEME` (`bento` en `layout-themes.js` vs default Admin/schema `editorial`)  
- [ ] Tests de humo: Admin save → `ui_estilo.home` → render público (3 nav styles)  
- [ ] Tests de humo: ops save → `popup_banner` / horarios / mapas → flyer público + vencimiento `expires_at`  
- [ ] Commitear refinamientos locales post-`ee3a135` (WelcomePopupCard segmentado, sin autosave, pulido visual) si se desea en remote

---



## 8. Guía rápida para chat IA nuevo

1. **Leer este archivo primero** (SSOT).
2. Defaults / rangos / normalize: `src/lib/secciones-ui.js`. Popup flyer: `src/lib/popup-banner.js`.
3. SuperAdmin hub: `admin/super/dashboard.astro`. Identidad: `admin/dashboard.astro` (`marca-form`). Ops: `#ops-contacto-card` + `PerfilLocalCard` + `WelcomePopupCard`. **No existe Live Preview.**
4. Temas admin: `xemilla-admin-theme` → dark = Observatorio · light = Habitación del Tiempo. Ops Light = Clean White; Ops Dark = `html.admin-panel.dark #ops-contacto-card.ops-studio`. **Cuidado:** `html.admin-panel .bg-white` remapea a botón primario — en tabs del flyer usar `popup-seg-tab--on`, no `bg-white`. Header: lockup logos (Xemilla PNG + `/` + `cloudinaryTrimUrl(logo_url)`), altura 64px.
5. Persistencia Identidad: `POST /api/update-marca`. Ops: `POST /api/update-operativo-contacto` **solo** al clic en `#guardar-cambios` (sin autosave).
6. Render público: `RestaurantApp.astro` → atmósfera + Home + chrome + `WelcomePopup` si `popupBannerIsRenderable`. Themes **no** pintan fondos.
7. **No inventar** `IdentidadMarca.astro`: vive en `dashboard.astro`.
8. `logo_size` = **10–400** (default 160). CSS vars cortas + aliases `--home-`*.

---

*Single Source of Truth del estado real del repo Xemilla a la fecha indicada. No commitear este archivo salvo petición explícita.*