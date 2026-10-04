ALTER TABLE restaurantes
  ADD COLUMN IF NOT EXISTS live_theme TEXT DEFAULT 'dark',
  ADD COLUMN IF NOT EXISTS live_accent_color TEXT,
  ADD COLUMN IF NOT EXISTS live_ad_banner TEXT,
  ADD COLUMN IF NOT EXISTS live_ad_banner_on BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS live_staff_pin TEXT;

DO $$ BEGIN
  ALTER TABLE restaurantes
    ADD CONSTRAINT restaurantes_live_theme_check
    CHECK (live_theme IN ('dark', 'neon', 'minimal'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
