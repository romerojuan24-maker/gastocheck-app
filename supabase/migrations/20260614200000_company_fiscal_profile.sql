-- GastoCheck — Datos fiscales y perfil de empresa
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS nombre_comercial  text,
  ADD COLUMN IF NOT EXISTS direccion         text,
  ADD COLUMN IF NOT EXISTS ciudad            text,
  ADD COLUMN IF NOT EXISTS cp                text,
  ADD COLUMN IF NOT EXISTS telefono          text,
  ADD COLUMN IF NOT EXISTS moneda            text NOT NULL DEFAULT 'MXN'
    CHECK (moneda IN ('MXN','USD')),
  ADD COLUMN IF NOT EXISTS idioma            text NOT NULL DEFAULT 'es'
    CHECK (idioma IN ('es','en')),
  ADD COLUMN IF NOT EXISTS tiene_flotilla    boolean NOT NULL DEFAULT false;
