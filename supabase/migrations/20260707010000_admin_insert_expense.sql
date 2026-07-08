-- El Panel Contador ahora permite registrar un comprobante directo contra un
-- anticipo (Registros > Anticipo > Tomar foto de comprobante), lo que inserta
-- una fila en expenses. La policy "office insert expense" nunca incluyo 'admin'
-- (mismo hueco que ya se habia corregido en advances/policies en
-- 20260614600000_advances_deposit_fields.sql) — sin este fix, el INSERT
-- truena por RLS para cualquier contador con rol admin.

DROP POLICY IF EXISTS "office insert expense" ON expenses;
CREATE POLICY "office insert expense" ON expenses FOR INSERT
  WITH CHECK (auth_role(company_id) IN ('owner','admin','superadmin','supervisor','office'));
