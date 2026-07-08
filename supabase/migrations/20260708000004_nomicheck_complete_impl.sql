-- NomiCheck — Implementación COMPLETA (Nómina + retenciones + pago)
-- 2026-07-08

-- ============================================================================
-- 1. EMPLOYEES (Empleados con datos de nómina)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.nomi_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),

  -- Datos personales
  user_id UUID REFERENCES auth.users(id),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  rfc VARCHAR(13) UNIQUE,
  nss VARCHAR(11), -- IMSS

  -- Datos de nómina
  salary_base DECIMAL(15, 2) NOT NULL,
  salary_frequency VARCHAR(50) NOT NULL CHECK (salary_frequency IN ('semanal', 'quincenal', 'mensual')),
  salary_currency VARCHAR(3) DEFAULT 'MXN',

  -- Datos bancarios (para depositar)
  bank_name VARCHAR(100),
  bank_account VARCHAR(50),
  clabe VARCHAR(18),

  -- Departamento/Puesto
  department VARCHAR(100),
  position VARCHAR(100),

  -- Régimen fiscal
  tax_regime VARCHAR(50) DEFAULT 'asalariado' CHECK (tax_regime IN ('asalariado', 'honorarios', 'independiente')),

  -- Estado
  is_active BOOLEAN DEFAULT TRUE,
  hire_date DATE,
  termination_date DATE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nomi_employees_company ON public.nomi_employees(company_id);
CREATE INDEX IF NOT EXISTS idx_nomi_employees_user ON public.nomi_employees(user_id);

-- ============================================================================
-- 2. PAYROLL (Nómina calculada)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.nomi_payroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  employee_id UUID NOT NULL REFERENCES public.nomi_employees(id),

  -- Período
  payroll_month INTEGER NOT NULL CHECK (payroll_month BETWEEN 1 AND 12),
  payroll_year INTEGER NOT NULL CHECK (payroll_year >= 2000),
  payroll_date DATE NOT NULL,

  -- Cálculo
  salary_base DECIMAL(15, 2),
  days_worked INTEGER,
  daily_rate DECIMAL(15, 2),

  -- Ingresos
  gross_income DECIMAL(15, 2), -- Sueldo base + bonificaciones
  bonus_amount DECIMAL(15, 2),
  attendance_bonus DECIMAL(15, 2),

  -- Retenciones
  isr_amount DECIMAL(15, 2),        -- Impuesto Sobre la Renta
  imss_employee DECIMAL(15, 2),     -- IMSS del empleado
  tax_refund DECIMAL(15, 2),        -- Devolución de impuestos

  -- Descuentos
  discount_amount DECIMAL(15, 2),
  advance_amount DECIMAL(15, 2),    -- Anticipos

  -- Total
  net_amount DECIMAL(15, 2), -- Lo que realmente recibe

  -- Generación de asiento
  suggested_account_debit VARCHAR(10),  -- 6210 (Gasto de nómina)
  suggested_account_credit VARCHAR(10), -- 2110 (Nómina por pagar)

  -- Estado
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'paid', 'cancelled')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP,
  paid_at TIMESTAMP,
  paid_via_bank_transaction_id UUID,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(company_id, employee_id, payroll_month, payroll_year)
);

CREATE INDEX IF NOT EXISTS idx_nomi_payroll_company ON public.nomi_payroll(company_id);
CREATE INDEX IF NOT EXISTS idx_nomi_payroll_employee ON public.nomi_payroll(employee_id);
CREATE INDEX IF NOT EXISTS idx_nomi_payroll_period ON public.nomi_payroll(payroll_year, payroll_month);
CREATE INDEX IF NOT EXISTS idx_nomi_payroll_status ON public.nomi_payroll(status);

-- ============================================================================
-- 3. TAX WITHHOLDINGS (Retenciones detalladas)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.nomi_tax_withholdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  payroll_id UUID NOT NULL REFERENCES public.nomi_payroll(id),

  -- Tipo de retención
  withholding_type VARCHAR(50) NOT NULL CHECK (withholding_type IN ('ISR', 'IMSS', 'INFONAVIT', 'cuota_sindical', 'otro')),
  description VARCHAR(255),

  -- Monto
  amount DECIMAL(15, 2) NOT NULL,
  rate DECIMAL(5, 2), -- % si aplica

  -- Para contabilidad
  account_code VARCHAR(10),

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withholdings_company ON public.nomi_tax_withholdings(company_id);
CREATE INDEX IF NOT EXISTS idx_withholdings_payroll ON public.nomi_tax_withholdings(payroll_id);

-- ============================================================================
-- 4. ATTENDANCE (Asistencia para cálculo de nómina)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.nomi_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  employee_id UUID NOT NULL REFERENCES public.nomi_employees(id),

  -- Fecha
  attendance_date DATE NOT NULL,

  -- Estado
  status VARCHAR(50) NOT NULL CHECK (status IN ('presente', 'ausente', 'permiso', 'enfermedad', 'vacaciones')),

  -- Horas
  hours_worked DECIMAL(4, 2),
  hours_overtime DECIMAL(4, 2),

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(company_id, employee_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_company ON public.nomi_attendance(company_id);
CREATE INDEX IF NOT EXISTS idx_attendance_employee ON public.nomi_attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.nomi_attendance(attendance_date);

-- ============================================================================
-- 5. RLS POLICIES
-- ============================================================================

ALTER TABLE public.nomi_employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nomi_employees_access" ON public.nomi_employees;
CREATE POLICY "nomi_employees_access" ON public.nomi_employees FOR ALL USING (
  company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
);

ALTER TABLE public.nomi_payroll ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nomi_payroll_access" ON public.nomi_payroll;
CREATE POLICY "nomi_payroll_access" ON public.nomi_payroll FOR ALL USING (
  company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
);

ALTER TABLE public.nomi_tax_withholdings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "withholdings_access" ON public.nomi_tax_withholdings;
CREATE POLICY "withholdings_access" ON public.nomi_tax_withholdings FOR ALL USING (
  company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
);

ALTER TABLE public.nomi_attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "attendance_access" ON public.nomi_attendance;
CREATE POLICY "attendance_access" ON public.nomi_attendance FOR ALL USING (
  company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active')
);

-- ============================================================================
-- 6. GRANTS
-- ============================================================================

GRANT ALL ON public.nomi_employees TO authenticated;
GRANT ALL ON public.nomi_payroll TO authenticated;
GRANT ALL ON public.nomi_tax_withholdings TO authenticated;
GRANT ALL ON public.nomi_attendance TO authenticated;
