-- ── Adjuntar CFDI / ZIP a un comprobante existente ──────────────────────────
ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS cfdi_url text;          -- ruta en expense-attachments o URL pública

-- ── Tipo de comprobante: pagado directamente vs a crédito ───────────────────
-- Si is_credit = true, el monto NO descuenta saldo del comprador
ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS is_credit boolean NOT NULL DEFAULT false;

-- Recargar caché de PostgREST
NOTIFY pgrst, 'reload schema';
