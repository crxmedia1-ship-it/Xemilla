-- Drop Live / Autopedido operational tables (order respects FKs)
DROP TABLE IF EXISTS public.pedidos_live CASCADE;
DROP TABLE IF EXISTS public.sesiones_mesa CASCADE;
DROP TABLE IF EXISTS public.live_socios CASCADE;
DROP TABLE IF EXISTS public.alertas_mesas CASCADE;

-- Remove Live / mesonero / dividir-cuenta columns from restaurantes
ALTER TABLE public.restaurantes
  DROP COLUMN IF EXISTS gadget_live_module,
  DROP COLUMN IF EXISTS gadget_live_session_type,
  DROP COLUMN IF EXISTS live_theme,
  DROP COLUMN IF EXISTS live_accent_color,
  DROP COLUMN IF EXISTS live_ad_banner,
  DROP COLUMN IF EXISTS live_ad_banner_on,
  DROP COLUMN IF EXISTS live_staff_pin,
  DROP COLUMN IF EXISTS num_mesas,
  DROP COLUMN IF EXISTS mesas_config,
  DROP COLUMN IF EXISTS gadget_mesero,
  DROP COLUMN IF EXISTS gadget_llamar_mesero,
  DROP COLUMN IF EXISTS gadget_cuenta,
  DROP COLUMN IF EXISTS gadget_dividir_cuenta;
