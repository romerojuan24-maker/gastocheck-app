-- Módulo de Viáticos (gastos de viaje controlados y no controlados)
CREATE TABLE viaticos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),

  -- Concepto del viático
  concept TEXT NOT NULL,
    -- 'car_rental', 'presentation', 'meals', 'accommodation', 'transport', 'other'

  -- Tipo: controlado (con límite) o sin controlar
  type TEXT NOT NULL CHECK (type IN ('controlled', 'uncontrolled')),

  -- Montos
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MXN',

  -- Comprobante (fiscal o no-fiscal)
  receipt_url TEXT,
  receipt_type TEXT CHECK (receipt_type IN ('cfdi', 'non_fiscal', 'none')),
  fiscal_uuid TEXT,

  -- Descripción y notas
  description TEXT,
  notes TEXT,

  -- Geolocalización
  city TEXT,
  trip_date DATE,

  -- Flota (opcional)
  vehicle_id UUID REFERENCES fleet_vehicles(id) ON DELETE SET NULL,
  operator_id UUID REFERENCES fleet_operators(id) ON DELETE SET NULL,

  -- Aprobación
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX viaticos_company_id ON viaticos(company_id);
CREATE INDEX viaticos_user_id ON viaticos(company_id, user_id);
CREATE INDEX viaticos_status ON viaticos(company_id, status);
CREATE INDEX viaticos_date ON viaticos(company_id, trip_date);
CREATE INDEX viaticos_vehicle_id ON viaticos(vehicle_id) WHERE vehicle_id IS NOT NULL;

-- RLS: usuarios ven sus viáticos, supervisores ven todos
ALTER TABLE viaticos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own viaticos" ON viaticos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Supervisors see all viaticos" ON viaticos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.user_id = auth.uid()
      AND company_members.company_id = viaticos.company_id
      AND company_members.role IN ('admin', 'supervisor')
    )
  );

CREATE POLICY "Users can insert own viaticos" ON viaticos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Supervisors can approve viaticos" ON viaticos
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.user_id = auth.uid()
      AND company_members.company_id = viaticos.company_id
      AND company_members.role IN ('admin', 'supervisor')
    )
  );

-- Tabla de límites de viáticos controlados por empresa
CREATE TABLE viatico_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,

  -- Límites diarios por concepto (controlados)
  car_rental_limit NUMERIC(14,2),        -- límite diario
  presentation_limit NUMERIC(14,2),
  meals_limit NUMERIC(14,2),
  accommodation_limit NUMERIC(14,2),
  transport_limit NUMERIC(14,2),

  -- Período de cálculo
  calculation_period TEXT NOT NULL DEFAULT 'daily'
    CHECK (calculation_period IN ('daily', 'weekly', 'monthly')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX viatico_limits_company_id ON viatico_limits(company_id);

-- RLS para límites
ALTER TABLE viatico_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage viatico limits" ON viatico_limits
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.user_id = auth.uid()
      AND company_members.company_id = viatico_limits.company_id
      AND company_members.role IN ('admin', 'owner')
    )
  );
