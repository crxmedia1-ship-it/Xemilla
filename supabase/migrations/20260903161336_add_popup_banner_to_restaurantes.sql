ALTER TABLE public.restaurantes
  ADD COLUMN IF NOT EXISTS popup_banner JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.restaurantes.popup_banner IS
  'Anuncio / pop-up de bienvenida: { enabled, image_url, title, description, button_text, action_type, action_url }.';
