-- CobraCheck Field Movements — Track collection activities in real-time (mi-ruta workflow)
-- Vincula cada movimiento de cobranza con un punto de ruta GPS para auditoría completa

-- ============================================================================
-- COBRA_MOVEMENTS — Field collection tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS cobra_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Route point linkage
  route_point_ts TIMESTAMP NOT NULL,  -- ISO timestamp del punto de ruta correspondiente

  -- Client & Invoice
  client_id UUID NOT NULL REFERENCES cobra_clients(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES cobra_invoices(id) ON DELETE SET NULL,

  -- Invoice metadata (denormalized para reports sin joins)
  amount_original NUMERIC(15,2) NOT NULL,
  folio TEXT,

  -- Movement type & details
  movement_type TEXT NOT NULL CHECK (movement_type IN ('collected', 'promise', 'not_paid')),

  -- Collected: monto cobrado
  collected_amount NUMERIC(15,2),

  -- Promise: fecha comprometida
  promise_date DATE,

  -- Not paid: motivo
  reason_not_paid TEXT,

  -- Evidence & notes
  photo_uri TEXT,  -- URL en storage si existe
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- ============================================================================
-- INDEXES — Optimizar queries de reporte y sincronización
-- ============================================================================
CREATE INDEX idx_cobra_movements_company_id ON cobra_movements(company_id);
CREATE INDEX idx_cobra_movements_user_id ON cobra_movements(user_id);
CREATE INDEX idx_cobra_movements_client_id ON cobra_movements(client_id);
CREATE INDEX idx_cobra_movements_invoice_id ON cobra_movements(invoice_id);
CREATE INDEX idx_cobra_movements_type ON cobra_movements(movement_type);
CREATE INDEX idx_cobra_movements_route_point_ts ON cobra_movements(route_point_ts);
CREATE INDEX idx_cobra_movements_created_at ON cobra_movements(created_at);

-- Composite index para reportes diarios: {company, user, date}
CREATE INDEX idx_cobra_movements_daily_report
  ON cobra_movements(company_id, user_id, DATE(created_at));

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Habilitar RLS
ALTER TABLE cobra_movements ENABLE ROW LEVEL SECURITY;

-- Leer: usuario propietario O supervisor del cobrador
CREATE POLICY "cobra_movements_read"
  ON cobra_movements
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR auth.uid() IN (
      SELECT cm.user_id
      FROM company_members cm
      WHERE cm.company_id = cobra_movements.company_id
      AND cm.member_role IN ('admin', 'supervisor')
      AND cm.status = 'active'
    )
  );

-- Escribir: usuario propietario del movimiento (cobrador en campo)
CREATE POLICY "cobra_movements_insert"
  ON cobra_movements
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND auth.uid() IN (
      SELECT user_id
      FROM company_members
      WHERE company_id = cobra_movements.company_id
      AND member_role IN ('collector', 'admin', 'supervisor')
      AND status = 'active'
    )
  );

-- Actualizar: usuario propietario O supervisor
CREATE POLICY "cobra_movements_update"
  ON cobra_movements
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR auth.uid() IN (
      SELECT cm.user_id
      FROM company_members cm
      WHERE cm.company_id = cobra_movements.company_id
      AND cm.member_role IN ('admin', 'supervisor')
      AND cm.status = 'active'
    )
  );

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Actualizar cobra_movements.updated_at
CREATE TRIGGER cobra_movements_updated_at
  BEFORE UPDATE ON cobra_movements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-crear cobra_payment si movement_type = 'collected'
CREATE OR REPLACE FUNCTION create_payment_from_movement()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.movement_type = 'collected' AND NEW.invoice_id IS NOT NULL THEN
    INSERT INTO cobra_payments (
      company_id, invoice_id, client_id, amount,
      payment_date, method, reference, created_by
    )
    VALUES (
      NEW.company_id,
      NEW.invoice_id,
      NEW.client_id,
      NEW.collected_amount,
      CURRENT_DATE,
      'cash',  -- Default: asumimos cobro en efectivo (cobrador en campo)
      'Field collection via mi-ruta',
      NEW.user_id
    )
    ON CONFLICT DO NOTHING;
  END IF;

  IF NEW.movement_type = 'promise' AND NEW.invoice_id IS NOT NULL THEN
    INSERT INTO cobra_promises (
      company_id, client_id,
      amount, promise_date, status, notes
    )
    VALUES (
      NEW.company_id,
      NEW.client_id,
      NEW.amount_original,
      NEW.promise_date,
      'pending',
      NEW.notes
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cobra_movements_auto_create_payment
  AFTER INSERT ON cobra_movements
  FOR EACH ROW
  EXECUTE FUNCTION create_payment_from_movement();

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON cobra_movements TO authenticated;
