-- ─────────────────────────────────────────────────────────────────────────────
-- GRANTs faltantes para tablas creadas después de grant_all_tables (20260615)
-- Tablas afectadas: flujocheck, bancocheck, inventariocheck, facturacheck
-- Sin estos GRANTs el INSERT/UPDATE/DELETE fallaba silenciosamente via RLS
-- ─────────────────────────────────────────────────────────────────────────────

-- FlujoCheck
GRANT SELECT, INSERT, UPDATE, DELETE ON cash_flow_items     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON cash_flow_scenarios TO authenticated;

-- BancoCheck
GRANT SELECT, INSERT, UPDATE, DELETE ON bank_accounts       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON bank_transactions   TO authenticated;

-- InventarioCheck
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_products  TO authenticated;

-- FacturaCheck
GRANT SELECT, INSERT, UPDATE, DELETE ON cfdi_documents      TO authenticated;

NOTIFY pgrst, 'reload schema';
