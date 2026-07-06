-- ============================================================================
-- Enmascarar CLABE completa (Nivel 7 del checklist de seguridad): antes
-- company_bank_accounts.clabe (18 dígitos completos) viajaba entera hasta
-- el cliente aunque la UI solo mostraba los últimos 4. Se agrega columna
-- generada clabe_last4 y se restringe el SELECT del cliente para que ya
-- no pueda leer la columna clabe cruda (sigue siendo escribible al
-- registrar una cuenta — el valor real solo se necesita al capturarlo).
-- ============================================================================

ALTER TABLE company_bank_accounts
  ADD COLUMN IF NOT EXISTS clabe_last4 text GENERATED ALWAYS AS (right(clabe, 4)) STORED;

REVOKE SELECT ON company_bank_accounts FROM authenticated;
GRANT SELECT (id, company_id, bank_name, account_last4, clabe_last4, account_holder, account_type, currency, active, created_at)
  ON company_bank_accounts TO authenticated;
