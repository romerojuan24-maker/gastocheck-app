-- ============================================================================
-- NÓMINACHECK — Esquema SEGURO desde cero (consolidado, endurecido)
-- ----------------------------------------------------------------------------
-- Reemplaza al stub inseguro 20260708000004 (nunca aplicado a prod). Como no
-- hay tablas ni datos, se crea el modelo YA blindado y granular. Incorpora la
-- revisión externa: capacidades finas (agregado ≠ detalle ≠ identidad ≠ banca),
-- alcances por supervisor, cifrado de RFC/NSS/CURP con hash ciego HMAC, RPCs de
-- aprobación/directorio/agregado, y hardening de EXECUTE/grants/default privs.
--
-- Requisitos ya en prod: touch_updated_at(), pgp_encrypt_secret/decrypt,
-- audit_logs, companies, company_members, member_role, extensión pgcrypto.
-- ENV requeridos por las Edge Functions: CFDI_ENC_KEY (cifrado), NOMI_HMAC_KEY
-- (hash ciego). Las llaves NUNCA viven en la base.
-- ============================================================================

-- ════════════════════════════════════════════════════════════════════════
-- 0. HELPERS DE CIFRADO/HASH (solo service_role; llave por parámetro)
-- ════════════════════════════════════════════════════════════════════════
-- Hash ciego HMAC-SHA256 para búsqueda/dedup sin descifrar (RFC/NSS/CURP).
-- HMAC (no SHA simple) porque el espacio de estos identificadores es
-- enumerable; sin llave secreta un SHA sería reversible por fuerza bruta.
-- Nota: hmac() sin calificar (pgcrypto), igual que pgp_sym_encrypt en el resto
-- del proyecto. Se normaliza (upper/trim) para que el hash sea estable.
CREATE OR REPLACE FUNCTION public.nomi_blind_hash(plain text, hmac_key text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
  SELECT CASE
    WHEN plain IS NULL OR plain = '' THEN NULL
    ELSE encode(extensions.hmac(upper(trim(plain)), hmac_key, 'sha256'), 'hex')
  END;
$$;
REVOKE EXECUTE ON FUNCTION public.nomi_blind_hash(text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.nomi_blind_hash(text, text) TO service_role;

-- ════════════════════════════════════════════════════════════════════════
-- 1. TABLAS BASE (labor data: FK RESTRICT; PII cifrada; sin plano)
-- ════════════════════════════════════════════════════════════════════════

-- 1.1 Empleados — identidad fiscal CIFRADA (RFC/NSS/CURP); nada de banco aquí.
CREATE TABLE IF NOT EXISTS public.nomi_employees (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  user_id          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  supervisor_employee_id uuid REFERENCES public.nomi_employees(id) ON DELETE SET NULL,
  name             varchar(255) NOT NULL,
  email            varchar(255),
  phone            varchar(20),
  -- Identidad fiscal: solo cifrado + hash ciego (búsqueda/dedup) + últimos 4.
  -- Escritas SOLO por Edge Function service_role (columnas revocadas al cliente).
  encrypted_rfc    text,
  rfc_hash         text,
  rfc_last4        varchar(4),
  encrypted_nss    text,
  nss_hash         text,
  nss_last4        varchar(4),
  encrypted_curp   text,
  curp_hash        text,
  curp_last4       varchar(4),
  -- Versión de llave para rotación (CFDI_ENC_KEY y NOMI_HMAC_KEY). Permite
  -- re-cifrado/re-hash por lotes con doble lectura durante la transición.
  enc_key_version  smallint NOT NULL DEFAULT 1,
  hmac_key_version smallint NOT NULL DEFAULT 1,
  -- Nómina
  salary_base      decimal(15,2) NOT NULL,
  salary_frequency varchar(50) NOT NULL CHECK (salary_frequency IN ('semanal','quincenal','mensual')),
  salary_currency  varchar(3) DEFAULT 'MXN',
  department       varchar(100),
  branch           varchar(100),   -- sucursal (texto libre; entidad formal en Fase 1B)
  position         varchar(100),
  tax_regime       varchar(50) DEFAULT 'asalariado' CHECK (tax_regime IN ('asalariado','honorarios','independiente')),
  is_active        boolean DEFAULT true,
  hire_date        date,
  termination_date date,
  created_by       uuid REFERENCES auth.users(id),
  updated_by       uuid REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nomi_employees_company ON public.nomi_employees(company_id);
CREATE INDEX IF NOT EXISTS idx_nomi_employees_user    ON public.nomi_employees(user_id);
CREATE INDEX IF NOT EXISTS idx_nomi_employees_dept    ON public.nomi_employees(company_id, department);
-- Unicidad por hash ciego (RFC único por empresa, sin exponerlo en claro)
CREATE UNIQUE INDEX IF NOT EXISTS uq_nomi_employees_company_rfc_hash
  ON public.nomi_employees(company_id, rfc_hash) WHERE rfc_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_nomi_employees_company_user
  ON public.nomi_employees(company_id, user_id) WHERE user_id IS NOT NULL;

-- 1.2 Nómina calculada
CREATE TABLE IF NOT EXISTS public.nomi_payroll (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  employee_id    uuid NOT NULL REFERENCES public.nomi_employees(id) ON DELETE RESTRICT,
  payroll_month  integer NOT NULL CHECK (payroll_month BETWEEN 1 AND 12),
  payroll_year   integer NOT NULL CHECK (payroll_year >= 2000),
  payroll_date   date NOT NULL,
  salary_base    decimal(15,2),
  days_worked    integer,
  daily_rate     decimal(15,2),
  gross_income   decimal(15,2),
  bonus_amount   decimal(15,2),
  attendance_bonus decimal(15,2),
  isr_amount     decimal(15,2),
  imss_employee  decimal(15,2),
  tax_refund     decimal(15,2),
  discount_amount decimal(15,2),
  advance_amount decimal(15,2),
  net_amount     decimal(15,2),
  suggested_account_debit  varchar(10),
  suggested_account_credit varchar(10),
  status         varchar(50) DEFAULT 'draft' CHECK (status IN ('draft','approved','paid','cancelled')),
  version        integer NOT NULL DEFAULT 1,      -- bloqueo optimista para aprobación
  calculated_by  uuid REFERENCES auth.users(id),  -- segregación de funciones
  approved_by    uuid REFERENCES auth.users(id),
  approved_at    timestamptz,
  paid_at        timestamptz,
  paid_via_bank_transaction_id uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, employee_id, payroll_month, payroll_year)
);
CREATE INDEX IF NOT EXISTS idx_nomi_payroll_company  ON public.nomi_payroll(company_id);
CREATE INDEX IF NOT EXISTS idx_nomi_payroll_employee ON public.nomi_payroll(employee_id);
CREATE INDEX IF NOT EXISTS idx_nomi_payroll_status   ON public.nomi_payroll(status);

-- 1.3 Retenciones
CREATE TABLE IF NOT EXISTS public.nomi_tax_withholdings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  payroll_id      uuid NOT NULL REFERENCES public.nomi_payroll(id) ON DELETE RESTRICT,
  withholding_type varchar(50) NOT NULL CHECK (withholding_type IN ('ISR','IMSS','INFONAVIT','cuota_sindical','otro')),
  description     varchar(255),
  amount          decimal(15,2) NOT NULL,
  rate            decimal(5,2),
  account_code    varchar(10),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_withholdings_company ON public.nomi_tax_withholdings(company_id);
CREATE INDEX IF NOT EXISTS idx_withholdings_payroll ON public.nomi_tax_withholdings(payroll_id);

-- 1.4 Asistencia / incidencias
CREATE TABLE IF NOT EXISTS public.nomi_attendance (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  employee_id     uuid NOT NULL REFERENCES public.nomi_employees(id) ON DELETE RESTRICT,
  attendance_date date NOT NULL,
  status          varchar(50) NOT NULL CHECK (status IN ('presente','ausente','permiso','enfermedad','vacaciones')),
  hours_worked    decimal(4,2),
  hours_overtime  decimal(4,2),
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, employee_id, attendance_date)
);
CREATE INDEX IF NOT EXISTS idx_attendance_company  ON public.nomi_attendance(company_id);
CREATE INDEX IF NOT EXISTS idx_attendance_employee ON public.nomi_attendance(employee_id);

-- 1.5 Datos bancarios CIFRADOS
CREATE TABLE IF NOT EXISTS public.nomi_employee_bank_accounts (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id               uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  employee_id              uuid NOT NULL REFERENCES public.nomi_employees(id) ON DELETE RESTRICT,
  bank_name                text,
  encrypted_account_number text,
  encrypted_clabe          text,
  account_last4            varchar(4),
  clabe_last4              varchar(4),
  enc_key_version          smallint NOT NULL DEFAULT 1,   -- versión de CFDI_ENC_KEY (rotación)
  is_primary               boolean NOT NULL DEFAULT true,
  status                   text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  verified_at              timestamptz,
  created_by               uuid REFERENCES auth.users(id),
  updated_by               uuid REFERENCES auth.users(id),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nomi_bank_company  ON public.nomi_employee_bank_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_nomi_bank_employee ON public.nomi_employee_bank_accounts(employee_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_nomi_bank_primary
  ON public.nomi_employee_bank_accounts(employee_id) WHERE is_primary AND status = 'active';

-- ════════════════════════════════════════════════════════════════════════
-- 2. CAPACIDADES (granular) + ALCANCES + nomi_can / nomi_in_scope
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.nomi_capabilities (capability text PRIMARY KEY, description text);
INSERT INTO public.nomi_capabilities(capability, description) VALUES
  ('payroll.view_aggregate',          'Totales/agregados sin PII individual'),
  ('payroll.view_employee_directory', 'Directorio: nombre/puesto/depto (con alcance)'),
  ('payroll.view_payroll_detail',     'Importes de nómina por empleado'),
  ('payroll.view_own_payroll',        'El empleado ve su propia nómina'),
  ('payroll.view_identity_sensitive', 'RFC/CURP/NSS descifrados'),
  ('payroll.view_bank_masked',        'Últimos 4 de cuenta/CLABE'),
  ('payroll.view_bank_full',          'Descifrado bancario (solo backend)'),
  ('payroll.manage_employees',        'Alta/edición de ficha de empleado'),
  ('payroll.manage_incidents',        'Asistencia/incidencias (con alcance)'),
  ('payroll.calculate',               'Crear/editar cálculo de nómina'),
  ('payroll.approve',                 'Aprobar nómina'),
  ('payroll.manage_bank_data',        'Escribir datos bancarios'),
  ('payroll.export_accounting',       'Exportar pólizas/contable (agregado)'),
  ('payroll.export_personal_data',    'Exportar con datos personales'),
  ('payroll.audit',                   'Ver bitácora de auditoría'),
  ('payroll.admin',                   'Gestionar capacidades y alcances')
ON CONFLICT (capability) DO NOTHING;

-- Fuente ÚNICA de verdad rol→capacidad (defaults conservadores)
CREATE TABLE IF NOT EXISTS public.nomi_role_capabilities (
  role       member_role NOT NULL,
  capability text NOT NULL REFERENCES public.nomi_capabilities(capability),
  PRIMARY KEY (role, capability)
);
-- owner => TODAS
INSERT INTO public.nomi_role_capabilities(role, capability)
  SELECT 'owner'::member_role, capability FROM public.nomi_capabilities
ON CONFLICT DO NOTHING;
-- admin => solo gestión operativa; lo sensible se otorga explícitamente
INSERT INTO public.nomi_role_capabilities(role, capability)
  SELECT 'admin'::member_role, cap FROM (VALUES
    ('payroll.view_aggregate'), ('payroll.view_employee_directory'),
    ('payroll.manage_employees'), ('payroll.manage_incidents')
  ) c(cap)
ON CONFLICT DO NOTHING;
-- superadmin => NINGUNA por default (staff Check Suite: acceso solo por
-- excepción temporal y auditada vía nomi_user_capabilities).
-- accountant / contador_general => contable, sin identidad completa ni banca full
INSERT INTO public.nomi_role_capabilities(role, capability)
  SELECT r.role, c.cap FROM (VALUES ('accountant'::member_role),('contador_general'::member_role)) r(role)
  CROSS JOIN (VALUES
    ('payroll.view_aggregate'), ('payroll.view_payroll_detail'),
    ('payroll.view_employee_directory'), ('payroll.view_bank_masked'),
    ('payroll.calculate'), ('payroll.export_accounting'), ('payroll.audit')
  ) c(cap)
ON CONFLICT DO NOTHING;
-- supervisor => directorio + incidencias, SIEMPRE acotado por alcance
INSERT INTO public.nomi_role_capabilities(role, capability)
  SELECT 'supervisor'::member_role, cap FROM (VALUES
    ('payroll.view_employee_directory'), ('payroll.manage_incidents')
  ) c(cap)
ON CONFLICT DO NOTHING;
-- resto de roles => 0 capacidades

-- Excepciones por usuario (allow/deny, vigencia)
CREATE TABLE IF NOT EXISTS public.nomi_user_capabilities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  capability  text NOT NULL REFERENCES public.nomi_capabilities(capability),
  effect      text NOT NULL CHECK (effect IN ('allow','deny')),
  granted_by  uuid REFERENCES auth.users(id),
  reason      text,
  valid_from  timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_nomi_user_cap_active
  ON public.nomi_user_capabilities(company_id, user_id, capability, effect) WHERE valid_until IS NULL;
CREATE INDEX IF NOT EXISTS idx_nomi_user_cap_lookup
  ON public.nomi_user_capabilities(company_id, user_id, capability);

-- Alcances (obligatorio para acotar supervisor). Un scope puede aplicar a una
-- capacidad específica (capability) o a todas (NULL). scope_value = texto para
-- department/branch; scope_id = uuid para employee/team.
-- Nota: 'cost_center' y 'self' quedan en el catálogo para Fase 4/portal; hoy se
-- resuelven company/department/branch/employee (los campos que ya existen).
CREATE TABLE IF NOT EXISTS public.nomi_user_scopes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  capability  text REFERENCES public.nomi_capabilities(capability),  -- NULL = todas
  scope_type  text NOT NULL CHECK (scope_type IN ('company','branch','department','cost_center','team','employee','self')),
  scope_id    uuid,     -- para employee/branch/team/cost_center
  scope_value text,     -- para department/branch (texto libre)
  granted_by  uuid REFERENCES auth.users(id),
  reason      text,
  valid_from  timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nomi_scopes_lookup ON public.nomi_user_scopes(company_id, user_id);

-- 2.1 nomi_can(company, capability) → boolean (autorización de capacidad)
CREATE OR REPLACE FUNCTION public.nomi_can(p_company uuid, p_capability text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = pg_catalog, public
AS $$
DECLARE v_role member_role;
BEGIN
  IF auth.uid() IS NULL OR p_company IS NULL THEN RETURN false; END IF;
  -- capacidad debe existir en el catálogo (rechaza arbitrarias)
  IF NOT EXISTS (SELECT 1 FROM public.nomi_capabilities WHERE capability = p_capability) THEN
    RETURN false;
  END IF;
  SELECT role INTO v_role FROM public.company_members
   WHERE company_id = p_company AND user_id = auth.uid() AND status = 'active' LIMIT 1;
  IF v_role IS NULL THEN RETURN false; END IF;
  -- deny vigente PREVALECE sobre cualquier allow (incluido owner)
  IF EXISTS (SELECT 1 FROM public.nomi_user_capabilities
      WHERE company_id = p_company AND user_id = auth.uid() AND capability = p_capability
        AND effect = 'deny' AND valid_from <= now() AND (valid_until IS NULL OR valid_until > now()))
  THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.nomi_role_capabilities WHERE role = v_role AND capability = p_capability)
  THEN RETURN true; END IF;
  IF EXISTS (SELECT 1 FROM public.nomi_user_capabilities
      WHERE company_id = p_company AND user_id = auth.uid() AND capability = p_capability
        AND effect = 'allow' AND valid_from <= now() AND (valid_until IS NULL OR valid_until > now()))
  THEN RETURN true; END IF;
  RETURN false;
END;
$$;

-- 2.2 nomi_in_scope(company, employee_id) → boolean (¿empleado dentro del alcance?)
-- Acceso pleno (view_identity_sensitive) ve todo. Directorio/incidencias se
-- acotan: company scope = todo; si no, solo depto/empleado en sus alcances.
CREATE OR REPLACE FUNCTION public.nomi_in_scope(p_company uuid, p_employee_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = pg_catalog, public
AS $$
DECLARE v_dept text; v_branch text;
BEGIN
  IF auth.uid() IS NULL OR p_company IS NULL OR p_employee_id IS NULL THEN RETURN false; END IF;
  IF public.nomi_can(p_company, 'payroll.view_identity_sensitive') THEN RETURN true; END IF;
  -- company scope (todo)
  IF EXISTS (SELECT 1 FROM public.nomi_user_scopes
      WHERE company_id = p_company AND user_id = auth.uid() AND status = 'active'
        AND scope_type = 'company' AND valid_from <= now() AND (valid_until IS NULL OR valid_until > now()))
  THEN RETURN true; END IF;
  SELECT department, branch INTO v_dept, v_branch
    FROM public.nomi_employees WHERE id = p_employee_id AND company_id = p_company;
  -- department / branch (texto) o employee (uuid)
  IF EXISTS (SELECT 1 FROM public.nomi_user_scopes
      WHERE company_id = p_company AND user_id = auth.uid() AND status = 'active'
        AND valid_from <= now() AND (valid_until IS NULL OR valid_until > now())
        AND ( (scope_type = 'department' AND scope_value IS NOT DISTINCT FROM v_dept)
           OR (scope_type = 'branch'     AND scope_value IS NOT DISTINCT FROM v_branch)
           OR (scope_type = 'employee'   AND scope_id = p_employee_id) ))
  THEN RETURN true; END IF;
  RETURN false;
END;
$$;

-- ¿Es la nómina del propio usuario? (para view_own_payroll)
CREATE OR REPLACE FUNCTION public.nomi_is_self_payroll(p_employee_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.nomi_employees
    WHERE id = p_employee_id AND user_id = auth.uid());
$$;

-- EXECUTE: revocar de public/anon; conceder solo a authenticated
REVOKE EXECUTE ON FUNCTION public.nomi_can(uuid, text)               FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.nomi_in_scope(uuid, uuid)          FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.nomi_is_self_payroll(uuid)         FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.nomi_can(uuid, text)               TO authenticated;
GRANT  EXECUTE ON FUNCTION public.nomi_in_scope(uuid, uuid)          TO authenticated;
GRANT  EXECUTE ON FUNCTION public.nomi_is_self_payroll(uuid)         TO authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 3. IDEMPOTENCIA: limpiar policies/triggers nomi_* previos
-- ════════════════════════════════════════════════════════════════════════
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies
           WHERE schemaname='public' AND tablename LIKE 'nomi\_%' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
  FOR r IN SELECT t.tgname, c.relname FROM pg_trigger t
           JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname='public' AND c.relname LIKE 'nomi\_%' AND NOT t.tgisinternal LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', r.tgname, r.relname);
  END LOOP;
END $$;

-- ════════════════════════════════════════════════════════════════════════
-- 4. RLS POR OPERACIÓN (nunca FOR ALL; DELETE físico prohibido)
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE public.nomi_employees              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nomi_payroll                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nomi_tax_withholdings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nomi_attendance             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nomi_employee_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nomi_capabilities           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nomi_role_capabilities      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nomi_user_capabilities      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nomi_user_scopes            ENABLE ROW LEVEL SECURITY;

-- nomi_employees: SELECT directo = identidad sensible (acceso pleno). El
-- directorio acotado de supervisores va por RPC (no toca esta tabla cruda).
CREATE POLICY nomi_employees_select ON public.nomi_employees
  FOR SELECT USING (public.nomi_can(company_id, 'payroll.view_identity_sensitive'));
CREATE POLICY nomi_employees_insert ON public.nomi_employees
  FOR INSERT WITH CHECK (public.nomi_can(company_id, 'payroll.manage_employees'));
CREATE POLICY nomi_employees_update ON public.nomi_employees
  FOR UPDATE USING (public.nomi_can(company_id, 'payroll.manage_employees'))
             WITH CHECK (public.nomi_can(company_id, 'payroll.manage_employees'));

-- nomi_payroll: SELECT = detalle por empleado, o la propia nómina.
CREATE POLICY nomi_payroll_select ON public.nomi_payroll
  FOR SELECT USING (
    public.nomi_can(company_id, 'payroll.view_payroll_detail')
    OR (public.nomi_can(company_id, 'payroll.view_own_payroll') AND public.nomi_is_self_payroll(employee_id))
  );
CREATE POLICY nomi_payroll_insert ON public.nomi_payroll
  FOR INSERT WITH CHECK (public.nomi_can(company_id, 'payroll.calculate'));
CREATE POLICY nomi_payroll_update ON public.nomi_payroll
  FOR UPDATE USING (public.nomi_can(company_id, 'payroll.calculate'))
             WITH CHECK (public.nomi_can(company_id, 'payroll.calculate'));

-- nomi_tax_withholdings: detalle contable
CREATE POLICY nomi_tax_select ON public.nomi_tax_withholdings
  FOR SELECT USING (public.nomi_can(company_id, 'payroll.view_payroll_detail'));
CREATE POLICY nomi_tax_insert ON public.nomi_tax_withholdings
  FOR INSERT WITH CHECK (public.nomi_can(company_id, 'payroll.calculate'));
CREATE POLICY nomi_tax_update ON public.nomi_tax_withholdings
  FOR UPDATE USING (public.nomi_can(company_id, 'payroll.calculate'))
             WITH CHECK (public.nomi_can(company_id, 'payroll.calculate'));

-- nomi_attendance: incidencias, ACOTADAS por alcance del supervisor
CREATE POLICY nomi_attendance_select ON public.nomi_attendance
  FOR SELECT USING (public.nomi_can(company_id, 'payroll.manage_incidents') AND public.nomi_in_scope(company_id, employee_id));
CREATE POLICY nomi_attendance_insert ON public.nomi_attendance
  FOR INSERT WITH CHECK (public.nomi_can(company_id, 'payroll.manage_incidents') AND public.nomi_in_scope(company_id, employee_id));
CREATE POLICY nomi_attendance_update ON public.nomi_attendance
  FOR UPDATE USING (public.nomi_can(company_id, 'payroll.manage_incidents') AND public.nomi_in_scope(company_id, employee_id))
             WITH CHECK (public.nomi_can(company_id, 'payroll.manage_incidents') AND public.nomi_in_scope(company_id, employee_id));

-- bank: lectura enmascarada; escritura solo Edge Function
CREATE POLICY nomi_bank_select ON public.nomi_employee_bank_accounts
  FOR SELECT USING (public.nomi_can(company_id, 'payroll.view_bank_masked'));

-- catálogos legibles por miembros; excepciones/alcances solo payroll.admin
CREATE POLICY nomi_capabilities_read ON public.nomi_capabilities FOR SELECT USING (true);
CREATE POLICY nomi_role_capabilities_read ON public.nomi_role_capabilities FOR SELECT USING (true);
CREATE POLICY nomi_user_cap_select ON public.nomi_user_capabilities
  FOR SELECT USING (public.nomi_can(company_id, 'payroll.admin'));
CREATE POLICY nomi_user_cap_insert ON public.nomi_user_capabilities
  FOR INSERT WITH CHECK (public.nomi_can(company_id, 'payroll.admin') AND granted_by = auth.uid());
CREATE POLICY nomi_user_cap_update ON public.nomi_user_capabilities
  FOR UPDATE USING (public.nomi_can(company_id, 'payroll.admin'))
             WITH CHECK (public.nomi_can(company_id, 'payroll.admin'));
CREATE POLICY nomi_scopes_select ON public.nomi_user_scopes
  FOR SELECT USING (public.nomi_can(company_id, 'payroll.admin'));
CREATE POLICY nomi_scopes_insert ON public.nomi_user_scopes
  FOR INSERT WITH CHECK (public.nomi_can(company_id, 'payroll.admin') AND granted_by = auth.uid());
CREATE POLICY nomi_scopes_update ON public.nomi_user_scopes
  FOR UPDATE USING (public.nomi_can(company_id, 'payroll.admin'))
             WITH CHECK (public.nomi_can(company_id, 'payroll.admin'));

-- ════════════════════════════════════════════════════════════════════════
-- 5. GRANTS PRECISOS (REVOKE ALL primero → inmune a DEFAULT PRIVILEGES;
--    columnas PII/cifradas nunca escribibles por el cliente; DELETE nunca)
-- ════════════════════════════════════════════════════════════════════════
REVOKE ALL ON public.nomi_employees, public.nomi_payroll, public.nomi_tax_withholdings,
              public.nomi_attendance, public.nomi_employee_bank_accounts,
              public.nomi_capabilities, public.nomi_role_capabilities,
              public.nomi_user_capabilities, public.nomi_user_scopes
  FROM PUBLIC, anon, authenticated;

-- nomi_employees: leer SOLO columnas no cifradas (RLS filtra filas); las
-- columnas encrypted_*/*_hash nunca llegan al cliente. El valor descifrado de
-- RFC/NSS/CURP (para quien tenga view_identity_sensitive) se servirá por una
-- Edge Function de descifrado gated — pendiente hasta que haya pantalla (1B).
GRANT SELECT (id, company_id, user_id, supervisor_employee_id, name, email, phone,
              rfc_last4, nss_last4, curp_last4, salary_base, salary_frequency,
              salary_currency, department, branch, position, tax_regime, is_active,
              hire_date, termination_date, created_by, updated_by, created_at, updated_at)
  ON public.nomi_employees TO authenticated;
GRANT INSERT (company_id, user_id, supervisor_employee_id, name, email, phone,
              salary_base, salary_frequency, salary_currency, department, branch, position,
              tax_regime, is_active, hire_date, termination_date, created_by, updated_by)
  ON public.nomi_employees TO authenticated;
GRANT UPDATE (user_id, supervisor_employee_id, name, email, phone,
              salary_base, salary_frequency, salary_currency, department, branch, position,
              tax_regime, is_active, hire_date, termination_date, updated_by)
  ON public.nomi_employees TO authenticated;
-- (encrypted_rfc/nss/curp, *_hash, *_last4 → NO otorgadas: solo service_role/Edge)

GRANT SELECT, INSERT, UPDATE ON public.nomi_payroll          TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.nomi_tax_withholdings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.nomi_attendance       TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.nomi_user_capabilities TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.nomi_user_scopes      TO authenticated;
GRANT SELECT ON public.nomi_capabilities      TO authenticated;
GRANT SELECT ON public.nomi_role_capabilities TO authenticated;
-- banca: solo columnas enmascaradas
GRANT SELECT (id, company_id, employee_id, bank_name, account_last4, clabe_last4,
              is_primary, status, verified_at, created_at, updated_at)
  ON public.nomi_employee_bank_accounts TO authenticated;

GRANT ALL ON public.nomi_employees, public.nomi_payroll, public.nomi_tax_withholdings,
             public.nomi_attendance, public.nomi_employee_bank_accounts,
             public.nomi_capabilities, public.nomi_role_capabilities,
             public.nomi_user_capabilities, public.nomi_user_scopes TO service_role;

-- Las Edge Functions (service_role) auditan sus operaciones vía PostgREST. La
-- tabla compartida audit_logs no concedía INSERT a service_role → las
-- auditorías de banca/PII fallaban en silencio. Se concede aquí (idempotente).
GRANT INSERT ON public.audit_logs TO service_role;

-- La capa de auth de los routes web (requireCompanyMember / auth inline de
-- FlujoCheck) verifica membresía leyendo company_members con service_role vía
-- PostgREST. service_role no tenía SELECT en company_members → TODAS las
-- verificaciones devolvían 403 (a miembros legítimos incluidos). Detectado por
-- pruebas HTTP reales. Se concede aquí (idempotente).
GRANT SELECT ON public.company_members TO service_role;

-- ════════════════════════════════════════════════════════════════════════
-- 6. TRIGGERS: updated_at, compuerta de aprobación (invariante), auditoría
-- ════════════════════════════════════════════════════════════════════════
CREATE TRIGGER trg_nomi_employees_touch BEFORE UPDATE ON public.nomi_employees
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_nomi_payroll_touch BEFORE UPDATE ON public.nomi_payroll
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_nomi_bank_touch BEFORE UPDATE ON public.nomi_employee_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_nomi_user_cap_touch BEFORE UPDATE ON public.nomi_user_capabilities
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_nomi_scopes_touch BEFORE UPDATE ON public.nomi_user_scopes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Compuerta de aprobación: INVARIANTE de última barrera. Pasar a 'approved'
-- exige payroll.approve. NO hay excepción para service_role sin validar (la
-- aprobación legítima usa la RPC de abajo, que corre como el usuario). Aplica
-- también segregación: quien calculó no puede aprobar (salvo owner).
CREATE OR REPLACE FUNCTION public.nomi_payroll_approval_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.status = 'approved' AND COALESCE(OLD.status,'') <> 'approved' THEN
    IF auth.uid() IS NULL OR NOT public.nomi_can(NEW.company_id, 'payroll.approve') THEN
      RAISE EXCEPTION 'Se requiere la capacidad payroll.approve para aprobar la nómina' USING ERRCODE='42501';
    END IF;
    IF OLD.calculated_by IS NOT NULL AND OLD.calculated_by = auth.uid()
       AND NOT public.nomi_can(NEW.company_id, 'payroll.admin') THEN
      RAISE EXCEPTION 'Segregación de funciones: quien calculó no puede aprobar' USING ERRCODE='42501';
    END IF;
    NEW.approved_by := auth.uid();
    NEW.approved_at := now();
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_nomi_payroll_approval BEFORE UPDATE ON public.nomi_payroll
  FOR EACH ROW EXECUTE FUNCTION public.nomi_payroll_approval_guard();

-- Auditoría (snapshot seguro; nunca PII cifrada, CLABE, cuenta ni hashes)
CREATE OR REPLACE FUNCTION public.nomi_safe_employee_snapshot(e public.nomi_employees)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object('name',e.name,'salary_base',e.salary_base,
    'salary_frequency',e.salary_frequency,'is_active',e.is_active,'department',e.department,
    'position',e.position,'tax_regime',e.tax_regime,'hire_date',e.hire_date,
    'termination_date',e.termination_date,'rfc_last4',e.rfc_last4);
$$;
CREATE OR REPLACE FUNCTION public.nomi_audit_employee()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_action text;
BEGIN
  IF TG_OP='INSERT' THEN
    INSERT INTO public.audit_logs(company_id,user_id,entity_type,entity_id,action,new_values)
    VALUES (NEW.company_id, auth.uid(), 'nomi_employee', NEW.id, 'employee_created',
            public.nomi_safe_employee_snapshot(NEW));
    RETURN NEW;
  END IF;
  IF NEW.salary_base IS DISTINCT FROM OLD.salary_base THEN v_action := 'employee_salary_changed';
  ELSIF NEW.is_active IS DISTINCT FROM OLD.is_active OR NEW.termination_date IS DISTINCT FROM OLD.termination_date
    THEN v_action := 'employee_status_changed';
  ELSE v_action := 'employee_updated'; END IF;
  INSERT INTO public.audit_logs(company_id,user_id,entity_type,entity_id,action,old_values,new_values)
  VALUES (NEW.company_id, auth.uid(), 'nomi_employee', NEW.id, v_action,
          public.nomi_safe_employee_snapshot(OLD), public.nomi_safe_employee_snapshot(NEW));
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_nomi_audit_employee AFTER INSERT OR UPDATE ON public.nomi_employees
  FOR EACH ROW EXECUTE FUNCTION public.nomi_audit_employee();

CREATE OR REPLACE FUNCTION public.nomi_audit_payroll_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.audit_logs(company_id,user_id,entity_type,entity_id,action,old_values,new_values)
    VALUES (NEW.company_id, auth.uid(), 'nomi_payroll', NEW.id,
      CASE WHEN NEW.status='approved' THEN 'payroll_approved' ELSE 'payroll_status_changed' END,
      jsonb_build_object('status',OLD.status),
      jsonb_build_object('status',NEW.status,'net_amount',NEW.net_amount,'approved_by',NEW.approved_by));
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_nomi_audit_payroll AFTER UPDATE ON public.nomi_payroll
  FOR EACH ROW EXECUTE FUNCTION public.nomi_audit_payroll_status();

CREATE OR REPLACE FUNCTION public.nomi_audit_capability()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    INSERT INTO public.audit_logs(company_id,user_id,entity_type,entity_id,action,new_values,reason)
    VALUES (NEW.company_id, auth.uid(), 'nomi_user_capability', NEW.id, 'capability_granted',
      jsonb_build_object('target_user',NEW.user_id,'capability',NEW.capability,'effect',NEW.effect,
                         'valid_until',NEW.valid_until), NEW.reason);
  ELSE
    INSERT INTO public.audit_logs(company_id,user_id,entity_type,entity_id,action,old_values,new_values,reason)
    VALUES (NEW.company_id, auth.uid(), 'nomi_user_capability', NEW.id,
      CASE WHEN NEW.valid_until IS NOT NULL AND OLD.valid_until IS NULL THEN 'capability_revoked'
           ELSE 'capability_updated' END,
      jsonb_build_object('effect',OLD.effect,'valid_until',OLD.valid_until),
      jsonb_build_object('effect',NEW.effect,'valid_until',NEW.valid_until), NEW.reason);
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_nomi_audit_capability AFTER INSERT OR UPDATE ON public.nomi_user_capabilities
  FOR EACH ROW EXECUTE FUNCTION public.nomi_audit_capability();

-- Higiene: las funciones de trigger (SECURITY DEFINER) no necesitan EXECUTE
-- para nadie — las invoca el trigger, no se pueden llamar directamente. Revocar.
REVOKE EXECUTE ON FUNCTION public.nomi_payroll_approval_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.nomi_audit_employee()         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.nomi_audit_payroll_status()   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.nomi_audit_capability()       FROM PUBLIC, anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 7. RPCs: aprobación (flujo + bloqueo optimista), directorio, agregado
-- ════════════════════════════════════════════════════════════════════════
-- 7.1 Aprobación: flujo autorizado; el trigger sigue siendo el invariante.
CREATE OR REPLACE FUNCTION public.nomi_approve_payroll(
  p_payroll_id uuid, p_expected_version integer, p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE r public.nomi_payroll;
BEGIN
  SELECT * INTO r FROM public.nomi_payroll WHERE id = p_payroll_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nómina no encontrada'; END IF;
  IF NOT public.nomi_can(r.company_id, 'payroll.approve') THEN
    RAISE EXCEPTION 'Sin capacidad payroll.approve' USING ERRCODE='42501';
  END IF;
  IF r.status <> 'draft' THEN RAISE EXCEPTION 'Solo se aprueban nóminas en borrador (estado actual: %)', r.status; END IF;
  IF r.version <> p_expected_version THEN RAISE EXCEPTION 'Conflicto de versión (esperada %, actual %)', p_expected_version, r.version; END IF;
  -- El trigger aplica segregación de funciones y sella approved_by/at.
  UPDATE public.nomi_payroll
    SET status = 'approved', version = version + 1
    WHERE id = p_payroll_id;
  IF p_reason IS NOT NULL THEN
    INSERT INTO public.audit_logs(company_id,user_id,entity_type,entity_id,action,reason)
    VALUES (r.company_id, auth.uid(), 'nomi_payroll', p_payroll_id, 'payroll_approved_reason', p_reason);
  END IF;
  RETURN jsonb_build_object('ok', true, 'id', p_payroll_id, 'status', 'approved');
END; $$;
REVOKE EXECUTE ON FUNCTION public.nomi_approve_payroll(uuid, integer, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.nomi_approve_payroll(uuid, integer, text) TO authenticated;

-- 7.2 Directorio acotado (reemplaza la vista definer): SOLO columnas no
-- sensibles, filtrado por alcance. No expone salario/RFC/NSS/CURP/banco.
CREATE OR REPLACE FUNCTION public.nomi_get_employee_directory(p_company uuid)
RETURNS TABLE (id uuid, company_id uuid, name varchar, "position" varchar,
               department varchar, branch varchar, supervisor_employee_id uuid, is_active boolean)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = pg_catalog, public AS $$
BEGIN
  IF NOT public.nomi_can(p_company, 'payroll.view_employee_directory') THEN
    RAISE EXCEPTION 'Sin capacidad payroll.view_employee_directory' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
    SELECT e.id, e.company_id, e.name, e.position, e.department, e.branch,
           e.supervisor_employee_id, e.is_active
    FROM public.nomi_employees e
    WHERE e.company_id = p_company
      AND public.nomi_in_scope(p_company, e.id);
END; $$;
REVOKE EXECUTE ON FUNCTION public.nomi_get_employee_directory(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.nomi_get_employee_directory(uuid) TO authenticated;

-- 7.3 Resumen agregado (sin PII individual): totales del periodo.
CREATE OR REPLACE FUNCTION public.nomi_payroll_summary(p_company uuid, p_year integer, p_month integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = pg_catalog, public AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.nomi_can(p_company, 'payroll.view_aggregate') THEN
    RAISE EXCEPTION 'Sin capacidad payroll.view_aggregate' USING ERRCODE='42501';
  END IF;
  SELECT jsonb_build_object(
    'employees',   count(*),
    'gross_total', coalesce(sum(gross_income),0),
    'net_total',   coalesce(sum(net_amount),0),
    'isr_total',   coalesce(sum(isr_amount),0),
    'imss_total',  coalesce(sum(imss_employee),0),
    'by_department', coalesce((
      SELECT jsonb_object_agg(dept, tot) FROM (
        SELECT coalesce(e.department,'(sin depto)') dept, sum(p2.net_amount) tot
        FROM public.nomi_payroll p2 JOIN public.nomi_employees e ON e.id = p2.employee_id
        WHERE p2.company_id = p_company AND p2.payroll_year = p_year AND p2.payroll_month = p_month
        GROUP BY 1) d
    ), '{}'::jsonb)
  ) INTO result
  FROM public.nomi_payroll p
  WHERE p.company_id = p_company AND p.payroll_year = p_year AND p.payroll_month = p_month;
  RETURN result;
END; $$;
REVOKE EXECUTE ON FUNCTION public.nomi_payroll_summary(uuid, integer, integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.nomi_payroll_summary(uuid, integer, integer) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 8. CAPA ESTABLE FLUJOCHECK — compromisos de nómina (hereda RLS de payroll)
-- ════════════════════════════════════════════════════════════════════════
DROP VIEW IF EXISTS public.nomi_employees_directory;  -- reemplazada por RPC 7.2
CREATE OR REPLACE VIEW public.nomi_cashflow_commitments
WITH (security_invoker = on) AS
  SELECT id, company_id, net_amount AS amount, payroll_date AS due_date, status
  FROM public.nomi_payroll
  WHERE status = 'approved' AND paid_at IS NULL;
GRANT SELECT ON public.nomi_cashflow_commitments TO authenticated;

NOTIFY pgrst, 'reload schema';
