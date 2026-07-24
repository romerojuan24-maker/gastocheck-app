-- ============================================================================
-- NÓMINACHECK — Prenómina: generación server-side + listado
-- ----------------------------------------------------------------------------
-- Complementa 20260722210000_nomicheck_secure_schema.sql. Aporta el cálculo
-- fiscal 2026 EN SQL (misma tarifa que packages/shared/src/nomina.ts) para que
-- la generación de borradores respete el modelo de capacidades: quien tiene
-- payroll.calculate puede generar la prenómina SIN necesitar leer los salarios
-- crudos (payroll.view_identity_sensitive). Los importes quedan en nomi_payroll
-- en estado 'draft' → luego se aprueban con nomi_approve_payroll (segregación).
--
-- Valores fiscales 2026 verificados DOF/SAT (2026-07-24):
--   · ISR mensual  → Anexo 8 RMF 2026 (DOF 28-12-2025), art. 96 LISR.
--   · Subsidio     → Decreto 2026: $536.22/mes (15.02% UMA), tope $11,492.66.
--   · UMA 2026     → $117.31 diaria (DOF 09-01-2026).
-- ============================================================================

-- ── 1. Cálculo fiscal (funciones puras, IMMUTABLE) ──────────────────────────

-- ISR mensual bruto (antes de subsidio) — tarifa art. 96 LISR 2026.
CREATE OR REPLACE FUNCTION public.nomi_isr_mensual(base numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
  WITH tarifa(li, cuota, tasa) AS (VALUES
    (0.01::numeric,      0.00::numeric,       0.0192::numeric),
    (746.05,             14.32,               0.0640),
    (6332.06,            371.83,              0.1088),
    (11128.02,           893.63,              0.1600),
    (12935.83,           1182.88,             0.1792),
    (15487.72,           1639.32,             0.2136),
    (31236.50,           4005.46,             0.2352),
    (49233.01,           8237.45,             0.3000),
    (93993.91,           21665.72,            0.3200),
    (125325.21,          31691.85,            0.3400),
    (375975.62,          116912.87,           0.3500)
  )
  SELECT CASE WHEN base <= 0 THEN 0 ELSE round(
    (SELECT t.cuota + (base - t.li) * t.tasa
       FROM tarifa t WHERE base >= t.li ORDER BY t.li DESC LIMIT 1), 2) END;
$$;

-- Subsidio al empleo mensual 2026 (monto fijo con tope de ingreso).
CREATE OR REPLACE FUNCTION public.nomi_subsidio_mensual(ingreso numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
  SELECT CASE WHEN ingreso <= 11492.66 THEN 536.22::numeric ELSE 0::numeric END;
$$;

-- Cuota obrero-IMSS mensual sobre el SBC mensual (UMA 2026 = 117.31 diaria).
CREATE OR REPLACE FUNCTION public.nomi_imss_obrero_mensual(sbc_mensual numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
  WITH v AS (SELECT (sbc_mensual / 30.4) AS sbc_diario, 30.4::numeric AS dias, 117.31::numeric AS uma)
  SELECT round(
    greatest(0, v.sbc_diario - 3 * v.uma) * 0.0040 * v.dias           -- enf/mat excedente 3 UMA
    + v.sbc_diario * (0.0025 + 0.00375 + 0.00625 + 0.01125) * v.dias, -- prest.dinero+GMP+IV+CV
    2) FROM v;
$$;

REVOKE EXECUTE ON FUNCTION public.nomi_isr_mensual(numeric)         FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.nomi_subsidio_mensual(numeric)    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.nomi_imss_obrero_mensual(numeric) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.nomi_isr_mensual(numeric)         TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.nomi_subsidio_mensual(numeric)    TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.nomi_imss_obrero_mensual(numeric) TO authenticated, service_role;

-- ── 2. Generar prenómina (borradores) para el periodo ───────────────────────
-- Requiere payroll.calculate. Ingreso mensual = salary_base normalizado por
-- frecuencia. Idempotente: omite empleados que ya tienen nómina en el periodo.
CREATE OR REPLACE FUNCTION public.nomi_generate_prenomina(
  p_company uuid, p_year integer, p_month integer, p_days integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_created int := 0; v_skipped int := 0;
  v_date date := (make_date(p_year, p_month, 1) + interval '1 month' - interval '1 day')::date;
  e record; v_gross numeric; v_isr numeric; v_sub numeric; v_imss numeric; v_net numeric;
BEGIN
  IF NOT public.nomi_can(p_company, 'payroll.calculate') THEN
    RAISE EXCEPTION 'Sin capacidad payroll.calculate' USING ERRCODE='42501';
  END IF;
  IF p_month NOT BETWEEN 1 AND 12 OR p_year < 2000 THEN
    RAISE EXCEPTION 'Periodo inválido';
  END IF;

  FOR e IN
    SELECT id, salary_base, salary_frequency FROM public.nomi_employees
    WHERE company_id = p_company AND is_active
  LOOP
    -- ¿ya existe nómina de este empleado en el periodo?
    IF EXISTS (SELECT 1 FROM public.nomi_payroll
                WHERE company_id = p_company AND employee_id = e.id
                  AND payroll_year = p_year AND payroll_month = p_month) THEN
      v_skipped := v_skipped + 1; CONTINUE;
    END IF;

    -- Ingreso mensual gravable equivalente según frecuencia del salario base
    v_gross := round(e.salary_base * CASE e.salary_frequency
                 WHEN 'mensual'   THEN 1
                 WHEN 'quincenal' THEN 2
                 WHEN 'semanal'   THEN 30.4/7.0
                 ELSE 1 END, 2);
    v_sub  := public.nomi_subsidio_mensual(v_gross);
    v_isr  := greatest(0, public.nomi_isr_mensual(v_gross) - v_sub);
    v_imss := public.nomi_imss_obrero_mensual(v_gross);
    v_net  := round(v_gross - v_isr - v_imss, 2);

    INSERT INTO public.nomi_payroll(
      company_id, employee_id, payroll_month, payroll_year, payroll_date,
      salary_base, days_worked, daily_rate, gross_income,
      isr_amount, imss_employee, tax_refund, net_amount,
      suggested_account_debit, suggested_account_credit,
      status, calculated_by)
    VALUES (
      p_company, e.id, p_month, p_year, v_date,
      e.salary_base, p_days, round(v_gross / 30.4, 2), v_gross,
      v_isr, v_imss, v_sub, v_net,
      '60100000', '11000000',        -- sugerencia: Gastos sueldos / Bancos (ajustable)
      'draft', auth.uid());
    v_created := v_created + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'created', v_created, 'skipped', v_skipped,
                            'period', to_char(v_date, 'YYYY-MM'));
END; $$;
REVOKE EXECUTE ON FUNCTION public.nomi_generate_prenomina(uuid, integer, integer, integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.nomi_generate_prenomina(uuid, integer, integer, integer) TO authenticated;

-- ── 3. Listar nómina del periodo (con nombre de empleado) ───────────────────
-- Requiere payroll.view_payroll_detail. Devuelve importes + nombre para la UI.
CREATE OR REPLACE FUNCTION public.nomi_list_payroll(
  p_company uuid, p_year integer, p_month integer)
RETURNS TABLE (
  id uuid, employee_id uuid, employee_name varchar, department varchar,
  gross_income numeric, isr_amount numeric, imss_employee numeric,
  tax_refund numeric, net_amount numeric, status varchar, version integer,
  payroll_date date)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = pg_catalog, public AS $$
BEGIN
  IF NOT public.nomi_can(p_company, 'payroll.view_payroll_detail') THEN
    RAISE EXCEPTION 'Sin capacidad payroll.view_payroll_detail' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
    SELECT p.id, p.employee_id, e.name, e.department,
           p.gross_income, p.isr_amount, p.imss_employee, p.tax_refund, p.net_amount,
           p.status, p.version, p.payroll_date
    FROM public.nomi_payroll p
    JOIN public.nomi_employees e ON e.id = p.employee_id
    WHERE p.company_id = p_company AND p.payroll_year = p_year AND p.payroll_month = p_month
    ORDER BY e.name;
END; $$;
REVOKE EXECUTE ON FUNCTION public.nomi_list_payroll(uuid, integer, integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.nomi_list_payroll(uuid, integer, integer) TO authenticated;

-- ── 4. Recibo individual (detalle para PDF/pantalla) ────────────────────────
-- El empleado puede ver el suyo (view_own_payroll); nómina/contable ven todos.
CREATE OR REPLACE FUNCTION public.nomi_get_recibo(p_payroll_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = pg_catalog, public AS $$
DECLARE r public.nomi_payroll; v_emp public.nomi_employees; v_ok boolean;
BEGIN
  SELECT * INTO r FROM public.nomi_payroll WHERE id = p_payroll_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nómina no encontrada'; END IF;
  v_ok := public.nomi_can(r.company_id, 'payroll.view_payroll_detail')
       OR (public.nomi_can(r.company_id, 'payroll.view_own_payroll')
           AND public.nomi_is_self_payroll(r.employee_id));
  IF NOT v_ok THEN RAISE EXCEPTION 'Sin permiso para ver este recibo' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_emp FROM public.nomi_employees WHERE id = r.employee_id;
  RETURN jsonb_build_object(
    'id', r.id, 'employee_name', v_emp.name, 'department', v_emp.department,
    'position', v_emp.position, 'rfc_last4', v_emp.rfc_last4,
    'period', to_char(r.payroll_date, 'YYYY-MM'), 'payroll_date', r.payroll_date,
    'days_worked', r.days_worked, 'gross_income', r.gross_income,
    'isr_amount', r.isr_amount, 'imss_employee', r.imss_employee,
    'tax_refund', r.tax_refund, 'net_amount', r.net_amount,
    'status', r.status);
END; $$;
REVOKE EXECUTE ON FUNCTION public.nomi_get_recibo(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.nomi_get_recibo(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
