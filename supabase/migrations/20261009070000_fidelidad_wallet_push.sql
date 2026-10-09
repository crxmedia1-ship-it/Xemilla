-- Registro de teléfonos que guardaron la tarjeta, para avisar por Wallet.

ALTER TABLE public.fidelidad_tarjetas
  ADD COLUMN IF NOT EXISTS wallet_token text;

CREATE UNIQUE INDEX IF NOT EXISTS fidelidad_tarjetas_wallet_token_idx
  ON public.fidelidad_tarjetas (wallet_token)
  WHERE wallet_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.fidelidad_wallet_dispositivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarjeta_id uuid NOT NULL REFERENCES public.fidelidad_tarjetas (id) ON DELETE CASCADE,
  plataforma text NOT NULL CHECK (plataforma IN ('apple', 'google')),
  device_id text NOT NULL CHECK (char_length(device_id) BETWEEN 8 AND 200),
  push_token text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fidelidad_wallet_dispositivo_unico UNIQUE (tarjeta_id, plataforma, device_id)
);

CREATE INDEX IF NOT EXISTS fidelidad_wallet_dispositivos_tarjeta_idx
  ON public.fidelidad_wallet_dispositivos (tarjeta_id);

ALTER TABLE public.fidelidad_wallet_dispositivos ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.fidelidad_wallet_dispositivos FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.fidelidad_wallet_dispositivos TO service_role;

COMMENT ON TABLE public.fidelidad_wallet_dispositivos IS
  'Teléfonos que guardaron la tarjeta. Apple deja el push token; Google deja el id del pase.';
