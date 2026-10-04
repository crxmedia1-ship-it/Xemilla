ALTER TABLE platos ADD COLUMN IF NOT EXISTS modelo_3d_url text;
ALTER TABLE restaurantes ADD COLUMN IF NOT EXISTS gadget_ar boolean NOT NULL DEFAULT false;
