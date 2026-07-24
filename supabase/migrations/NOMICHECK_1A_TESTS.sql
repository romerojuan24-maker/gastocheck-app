-- ============================================================================
-- NÓMINACHECK — SUITE DE PRUEBAS RLS (modelo endurecido)  ·  NO es migración
-- ----------------------------------------------------------------------------
-- Valida 20260722210000_nomicheck_secure_schema.sql. Cubre los escenarios del
-- Prompt 1 §3 que son verificables SOLO con SQL/RLS. Los que dependen de las
-- Edge Functions (doble envío bancario, concurrencia real, HMAC con llave de
-- env, cifrado) se marcan como pruebas de integración (ver nota al final).
--
-- Correr en LOCAL/STAGING (NUNCA producción), como superusuario/owner:
--   supabase db reset
--   psql "$DATABASE_URL" -f supabase/migrations/NOMICHECK_1A_TESTS.sql
-- Impersona vía request.jwt.claims + SET ROLE authenticated (RLS real).
-- Todo dentro de una transacción con ROLLBACK final (no deja datos).
-- Nota: insertar en auth.users puede requerir columnas extra según versión.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.t_assert(cond boolean, label text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond THEN RAISE NOTICE 'PASS  %', label;
  ELSE RAISE EXCEPTION 'FAIL  %', label; END IF;
END; $$;
-- Setea AMBOS GUCs para portabilidad: request.jwt.claims (Supabase actual,
-- auth.uid() lee el JSON) y request.jwt.claim.sub (imágenes previas).
CREATE OR REPLACE FUNCTION pg_temp.act_as(p_uid uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role','authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_uid::text, true);
END; $$;

\set coA  '11111111-1111-1111-1111-111111111111'
\set coB  '22222222-2222-2222-2222-222222222222'
\set uOwn '10000000-0000-0000-0000-000000000001'
\set uAdm '10000000-0000-0000-0000-000000000002'
\set uAcc '10000000-0000-0000-0000-000000000003'
\set uSup '10000000-0000-0000-0000-000000000004'
\set uSp2 '10000000-0000-0000-0000-000000000005'
\set uSpe '10000000-0000-0000-0000-000000000006'
\set uCob '10000000-0000-0000-0000-000000000007'
\set uOut '10000000-0000-0000-0000-000000000008'
\set uEmp '10000000-0000-0000-0000-000000000009'
\set uApr '10000000-0000-0000-0000-00000000000a'
\set e1   '30000000-0000-0000-0000-000000000001'
\set e2   '30000000-0000-0000-0000-000000000002'
\set eSelf '30000000-0000-0000-0000-000000000003'
\set pay1 '40000000-0000-0000-0000-000000000001'
\set payS '40000000-0000-0000-0000-000000000002'
\set payX '40000000-0000-0000-0000-000000000003'

-- ── Fixtures ────────────────────────────────────────────────────────────────
-- auth.users primero (companies.created_by referencia auth.users)
INSERT INTO auth.users(id, email) VALUES
  (:'uOwn','own@t.mx'),(:'uAdm','adm@t.mx'),(:'uAcc','acc@t.mx'),(:'uSup','sup@t.mx'),
  (:'uSp2','sp2@t.mx'),(:'uSpe','spe@t.mx'),(:'uCob','cob@t.mx'),(:'uOut','out@t.mx'),
  (:'uEmp','emp@t.mx'),(:'uApr','apr@t.mx');
INSERT INTO public.companies(id, name, created_by) VALUES
  (:'coA','A Test', :'uOwn'), (:'coB','B Test', :'uOwn');
INSERT INTO public.company_members(company_id, user_id, role, status) VALUES
  (:'coA',:'uOwn','owner','active'),
  (:'coA',:'uAdm','admin','active'),
  (:'coA',:'uAcc','accountant','active'),
  (:'coA',:'uSup','supervisor','active'),
  (:'coA',:'uSp2','supervisor','active'),
  (:'coA',:'uSpe','spender','active'),
  (:'coA',:'uCob','cobrador','active'),
  (:'coA',:'uEmp','viewer','active'),
  (:'coA',:'uApr','accountant','active'),
  (:'coB',:'uOwn','owner','active');   -- owner también en B (aislamiento)
-- uOut: sin membresía

INSERT INTO public.nomi_employees(id, company_id, user_id, name, department, branch, salary_base, salary_frequency)
VALUES
  (:'e1',   :'coA', NULL,     'Ana Ventas',   'Ventas',   'CDMX', 15000, 'quincenal'),
  (:'e2',   :'coA', NULL,     'Beto Sistemas','Sistemas', 'GDL',  18000, 'quincenal'),
  (:'eSelf',:'coA', :'uEmp',  'Propio',       'Ventas',   'CDMX', 12000, 'quincenal');
INSERT INTO public.nomi_payroll(id, company_id, employee_id, payroll_month, payroll_year, payroll_date, net_amount, status, calculated_by)
VALUES
  (:'pay1', :'coA', :'e1',    7, 2026, '2026-07-30', 13000, 'approved', :'uAcc'),
  (:'payS', :'coA', :'eSelf', 7, 2026, '2026-07-30', 11000, 'draft',    :'uAcc'),
  (:'payX', :'coA', :'e2',    8, 2026, '2026-08-30', 16000, 'draft',    :'uApr');
-- pay1 aprobada+no pagada → compromiso de flujo
UPDATE public.nomi_payroll SET paid_at = NULL WHERE id = :'pay1';

-- Alcance del supervisor uSup: solo departamento 'Ventas'
INSERT INTO public.nomi_user_scopes(company_id, user_id, scope_type, scope_value, granted_by)
VALUES (:'coA', :'uSup', 'department', 'Ventas', :'uOwn');
-- uSp2: SIN alcance

-- Excepciones: admin allow detalle; deny sobre allow; allow expirado; self payroll
INSERT INTO public.nomi_user_capabilities(company_id, user_id, capability, effect, granted_by) VALUES
  (:'coA', :'uAdm', 'payroll.view_payroll_detail', 'allow', :'uOwn'),
  (:'coA', :'uEmp', 'payroll.view_own_payroll',    'allow', :'uOwn'),
  (:'coA', :'uApr', 'payroll.approve',             'allow', :'uOwn'),   -- para test de segregación
  (:'coA', :'uAcc', 'payroll.export_accounting',   'allow', :'uOwn'),
  (:'coA', :'uAcc', 'payroll.export_accounting',   'deny',  :'uOwn');   -- deny debe ganar
INSERT INTO public.nomi_user_capabilities(company_id, user_id, capability, effect, granted_by, valid_until) VALUES
  (:'coA', :'uSpe', 'payroll.view_payroll_detail', 'allow', :'uOwn', now() - interval '1 day'); -- expirado

SET ROLE authenticated;

-- ════════════════════════════ A. nomi_can / capacidades ════════════════════
SELECT pg_temp.act_as(:'uOwn');
SELECT pg_temp.t_assert(public.nomi_can(:'coA','payroll.approve'),                 '01 owner: approve');
SELECT pg_temp.t_assert(public.nomi_can(:'coA','payroll.view_identity_sensitive'), '01 owner: identity');

SELECT pg_temp.act_as(:'uAdm');
SELECT pg_temp.t_assert(public.nomi_can(:'coA','payroll.manage_employees'),          '02 admin: manage_employees');
SELECT pg_temp.t_assert(NOT public.nomi_can(:'coA','payroll.view_identity_sensitive'),'02 admin: SIN identity');
SELECT pg_temp.t_assert(NOT public.nomi_can(:'coA','payroll.approve'),               '02 admin: SIN approve');
SELECT pg_temp.t_assert(public.nomi_can(:'coA','payroll.view_payroll_detail'),       '03 admin: detalle por excepción allow');

SELECT pg_temp.act_as(:'uAcc');
SELECT pg_temp.t_assert(public.nomi_can(:'coA','payroll.view_payroll_detail'),        '04 contador: detalle');
SELECT pg_temp.t_assert(public.nomi_can(:'coA','payroll.calculate'),                  '04 contador: calcular');
SELECT pg_temp.t_assert(NOT public.nomi_can(:'coA','payroll.view_identity_sensitive'),'04 contador: SIN identity');
SELECT pg_temp.t_assert(NOT public.nomi_can(:'coA','payroll.approve'),                '04 contador: SIN approve');
SELECT pg_temp.t_assert(NOT public.nomi_can(:'coA','payroll.export_accounting'),      '20 deny vence a allow (export)');

SELECT pg_temp.act_as(:'uSpe');
SELECT pg_temp.t_assert(NOT public.nomi_can(:'coA','payroll.view_payroll_detail'), '07 spender: nada (allow expirado)');
SELECT pg_temp.act_as(:'uCob');
SELECT pg_temp.t_assert(NOT public.nomi_can(:'coA','payroll.view_employee_directory'), '08 cobrador: nada');
SELECT pg_temp.act_as(:'uOut');
SELECT pg_temp.t_assert(NOT public.nomi_can(:'coA','payroll.view_aggregate'), '09 no-miembro: false');
-- aislamiento: owner de A no tiene nada en B salvo lo suyo (es owner en B)
SELECT pg_temp.act_as(:'uAcc');
SELECT pg_temp.t_assert(NOT public.nomi_can(:'coB','payroll.view_payroll_detail'), '10 contador de A: nada en B');

-- ════════════════════════════ B. RLS en tablas ═════════════════════════════
-- owner (identity) ve empleados; admin/contador NO (raw)
SELECT pg_temp.act_as(:'uOwn');
SELECT pg_temp.t_assert((SELECT count(*) FROM public.nomi_employees WHERE company_id=:'coA')=3, '11 owner VE nomi_employees');
SELECT pg_temp.act_as(:'uAdm');
SELECT pg_temp.t_assert((SELECT count(*) FROM public.nomi_employees WHERE company_id=:'coA')=0, '12 admin NO VE nomi_employees crudo');
SELECT pg_temp.act_as(:'uSup');
SELECT pg_temp.t_assert((SELECT count(*) FROM public.nomi_employees WHERE company_id=:'coA')=0, '13 supervisor NO VE nomi_employees crudo');

-- detalle de nómina: contador sí; cobrador no
SELECT pg_temp.act_as(:'uAcc');
SELECT pg_temp.t_assert((SELECT count(*) FROM public.nomi_payroll WHERE company_id=:'coA')=3, '14 contador VE detalle nómina');
SELECT pg_temp.act_as(:'uCob');
SELECT pg_temp.t_assert((SELECT count(*) FROM public.nomi_payroll WHERE company_id=:'coA')=0, '15 cobrador NO VE nómina');

-- empleado ve SOLO su propia nómina (view_own_payroll)
SELECT pg_temp.act_as(:'uEmp');
SELECT pg_temp.t_assert((SELECT count(*) FROM public.nomi_payroll WHERE company_id=:'coA')=1, '16 empleado VE solo su nómina');
SELECT pg_temp.t_assert((SELECT count(*) FROM public.nomi_payroll WHERE id=:'payS')=1,        '16 empleado: su registro');
SELECT pg_temp.t_assert((SELECT count(*) FROM public.nomi_payroll WHERE id=:'pay1')=0,        '17 empleado NO VE nómina ajena');

-- ════════════════════════════ C. Directorio (RPC) + alcance ════════════════
SELECT pg_temp.act_as(:'uSup');  -- alcance depto Ventas → e1 + eSelf (Ventas), NO e2 (Sistemas)
SELECT pg_temp.t_assert((SELECT count(*) FROM public.nomi_get_employee_directory(:'coA'))=2, '18 supervisor con alcance: 2 de Ventas');
SELECT pg_temp.act_as(:'uSp2'); -- sin alcance → 0
SELECT pg_temp.t_assert((SELECT count(*) FROM public.nomi_get_employee_directory(:'coA'))=0, '19 supervisor SIN alcance: 0');
SELECT pg_temp.act_as(:'uOwn'); -- identity → ve todos por directorio
SELECT pg_temp.t_assert((SELECT count(*) FROM public.nomi_get_employee_directory(:'coA'))=3, '18b owner: directorio completo');
-- cobrador sin capacidad → excepción
SELECT pg_temp.act_as(:'uCob');
DO $$ BEGIN
  BEGIN PERFORM public.nomi_get_employee_directory('11111111-1111-1111-1111-111111111111');
    RAISE EXCEPTION 'FAIL 19b cobrador no debió leer directorio';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS  19b cobrador bloqueado en directorio'; END;
END $$;

-- ════════════════════════════ D. Incidencias acotadas ══════════════════════
-- supervisor con alcance Ventas: puede crear incidencia de e1 (Ventas), NO de e2
SELECT pg_temp.act_as(:'uSup');
INSERT INTO public.nomi_attendance(company_id, employee_id, attendance_date, status)
  VALUES (:'coA', :'e1', '2026-07-15', 'ausente') ON CONFLICT DO NOTHING;
SELECT pg_temp.t_assert(true, '21a supervisor registra incidencia en su alcance');
DO $$ BEGIN
  BEGIN
    INSERT INTO public.nomi_attendance(company_id, employee_id, attendance_date, status)
      VALUES ('11111111-1111-1111-1111-111111111111','30000000-0000-0000-0000-000000000002','2026-07-15','ausente');
    RAISE EXCEPTION 'FAIL 21b supervisor no debió tocar empleado fuera de alcance';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN RAISE NOTICE 'PASS  21b incidencia fuera de alcance bloqueada'; END;
END $$;

-- ════════════════════════════ E. Escrituras prohibidas ═════════════════════
-- modificar salario sin permiso (spender): RLS filtra la fila (USING falso) →
-- 0 filas afectadas, sin excepción. Se verifica que el salario NO cambió.
SELECT pg_temp.act_as(:'uSpe');
UPDATE public.nomi_employees SET salary_base=1 WHERE id=:'e1';
SELECT pg_temp.act_as(:'uOwn');
SELECT pg_temp.t_assert((SELECT salary_base FROM public.nomi_employees WHERE id=:'e1')=15000,
  '22 spender NO cambió salario (RLS 0 filas)');
-- escribir banca directamente (sin grant) — cualquiera
SELECT pg_temp.act_as(:'uOwn');
DO $$ BEGIN
  BEGIN INSERT INTO public.nomi_employee_bank_accounts(company_id, employee_id, encrypted_clabe)
        VALUES ('11111111-1111-1111-1111-111111111111','30000000-0000-0000-0000-000000000001','x');
    RAISE EXCEPTION 'FAIL 23 no debió escribir banca directo';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS  23 escritura bancaria directa bloqueada'; END;
END $$;
-- escribir columnas PII cifradas directamente (sin grant de columna)
SELECT pg_temp.act_as(:'uOwn');
DO $$ BEGIN
  BEGIN UPDATE public.nomi_employees SET encrypted_rfc='x' WHERE id='30000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'FAIL 24 no debió escribir encrypted_rfc';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS  24 columna PII cifrada no escribible'; END;
END $$;
-- DELETE físico bloqueado
DO $$ BEGIN
  BEGIN DELETE FROM public.nomi_employees WHERE id='30000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'FAIL 25 DELETE no debió permitirse';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS  25 DELETE físico bloqueado'; END;
END $$;

-- ════════════════════════════ F. Aprobación (RPC + trigger + segregación) ══
-- contador sin approve: RPC rechaza
SELECT pg_temp.act_as(:'uAcc');
DO $$ BEGIN
  BEGIN PERFORM public.nomi_approve_payroll('40000000-0000-0000-0000-000000000003', 1, 'x');
    RAISE EXCEPTION 'FAIL 26 contador sin approve no debió aprobar';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS  26 aprobación sin capacidad bloqueada'; END;
END $$;
-- trigger: UPDATE directo a approved sin capacidad también bloquea
SELECT pg_temp.act_as(:'uAcc');
DO $$ BEGIN
  BEGIN UPDATE public.nomi_payroll SET status='approved' WHERE id='40000000-0000-0000-0000-000000000003';
    RAISE EXCEPTION 'FAIL 27 trigger no bloqueó approve directo';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS  27 trigger bloquea approve directo sin capacidad'; END;
END $$;
-- segregación: uApr calculó payX y tiene approve pero NO admin → no puede autoaprobar
SELECT pg_temp.act_as(:'uApr');
DO $$ BEGIN
  BEGIN PERFORM public.nomi_approve_payroll('40000000-0000-0000-0000-000000000003', 1, 'x');
    RAISE EXCEPTION 'FAIL 28 autoaprobación no debió permitirse (segregación)';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS  28 segregación: quien calculó no aprueba'; END;
END $$;
-- owner aprueba payX correctamente (bloqueo optimista version=1)
SELECT pg_temp.act_as(:'uOwn');
SELECT pg_temp.t_assert((public.nomi_approve_payroll(:'payX', 1, 'ok')->>'ok')::boolean, '29 owner aprueba con RPC + version');
SELECT pg_temp.t_assert((SELECT status FROM public.nomi_payroll WHERE id=:'payX')='approved', '29 estado approved');
SELECT pg_temp.t_assert((SELECT approved_by FROM public.nomi_payroll WHERE id=:'payX')=:'uOwn', '29 approved_by sellado');

-- ════════════════════════════ G. Vistas / agregado / índice ciego ══════════
SELECT pg_temp.act_as(:'uAcc');  -- detalle → ve compromisos (view_payroll_detail)
SELECT pg_temp.t_assert((SELECT count(*) FROM public.nomi_cashflow_commitments WHERE company_id=:'coA')>=1, '30 vista compromisos (aprobado+no pagado)');
SELECT pg_temp.t_assert((public.nomi_payroll_summary(:'coA',2026,7)->>'employees') IS NOT NULL, '31 RPC resumen agregado responde');
-- índice ciego: dos empleados con mismo rfc_hash en la empresa → viola único
RESET ROLE;
DO $$ BEGIN
  BEGIN
    UPDATE public.nomi_employees SET rfc_hash='HASHDUP' WHERE id='30000000-0000-0000-0000-000000000001';
    UPDATE public.nomi_employees SET rfc_hash='HASHDUP' WHERE id='30000000-0000-0000-0000-000000000002';
    RAISE EXCEPTION 'FAIL 32 rfc_hash duplicado no debió permitirse';
  EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'PASS  32 índice ciego rfc_hash único por empresa'; END;
END $$;

-- ════════════════════════════ H. Casos adicionales (§10 ampliado) ══════════
INSERT INTO auth.users(id,email) VALUES
  ('10000000-0000-0000-0000-00000000000b','sad@t.mx'),
  ('10000000-0000-0000-0000-00000000000c','dis@t.mx'),
  ('10000000-0000-0000-0000-00000000000d','inv@t.mx'),
  ('10000000-0000-0000-0000-00000000000e','sux@t.mx'),
  ('10000000-0000-0000-0000-00000000000f','suy@t.mx');
INSERT INTO public.company_members(company_id,user_id,role,status) VALUES
  (:'coA','10000000-0000-0000-0000-00000000000b','superadmin','active'),
  (:'coA','10000000-0000-0000-0000-00000000000c','admin','disabled'),
  (:'coA','10000000-0000-0000-0000-00000000000d','admin','invited'),
  (:'coA','10000000-0000-0000-0000-00000000000e','supervisor','active'),
  (:'coA','10000000-0000-0000-0000-00000000000f','supervisor','active');
-- uSuX: scope de departamento VENCIDO; uSuY: scope en OTRA empresa (coB)
INSERT INTO public.nomi_user_scopes(company_id,user_id,scope_type,scope_value,granted_by,valid_until)
  VALUES (:'coA','10000000-0000-0000-0000-00000000000e','department','Ventas',:'uOwn', now()-interval '1 day');
INSERT INTO public.nomi_user_scopes(company_id,user_id,scope_type,scope_value,granted_by)
  VALUES (:'coB','10000000-0000-0000-0000-00000000000f','department','Ventas',:'uOwn');

SET ROLE authenticated;
SELECT pg_temp.act_as('10000000-0000-0000-0000-00000000000b');
SELECT pg_temp.t_assert(NOT public.nomi_can(:'coA','payroll.view_aggregate'),      '33 superadmin: 0 capacidades por nombre');
SELECT pg_temp.act_as('10000000-0000-0000-0000-00000000000c');
SELECT pg_temp.t_assert(NOT public.nomi_can(:'coA','payroll.manage_employees'),    '34 miembro disabled: sin acceso');
SELECT pg_temp.act_as('10000000-0000-0000-0000-00000000000d');
SELECT pg_temp.t_assert(NOT public.nomi_can(:'coA','payroll.manage_employees'),    '35 miembro invited: sin acceso');
SELECT pg_temp.act_as('10000000-0000-0000-0000-00000000000e');
SELECT pg_temp.t_assert((SELECT count(*) FROM public.nomi_get_employee_directory(:'coA'))=0, '36 scope vencido: 0');
SELECT pg_temp.act_as('10000000-0000-0000-0000-00000000000f');
SELECT pg_temp.t_assert((SELECT count(*) FROM public.nomi_get_employee_directory(:'coA'))=0, '37 scope de otra empresa no aplica');
-- 38 WITH CHECK: admin (manage_employees en A, no en B) no puede mover empleado a B
SELECT pg_temp.act_as(:'uAdm');
DO $$ BEGIN
  BEGIN UPDATE public.nomi_employees SET company_id='22222222-2222-2222-2222-222222222222'
        WHERE id='30000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'FAIL 38 no debió mover empleado a otra empresa';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS  38 WITH CHECK bloquea cambio de empresa'; END;
END $$;

-- ════════════════════════════ I. Concurrencia / cifrado (§11, §6) ══════════
-- Bloqueo optimista + estado: dos aprobaciones no pueden ganar ambas.
SELECT pg_temp.act_as(:'uOwn');
DO $$ BEGIN
  BEGIN PERFORM public.nomi_approve_payroll('40000000-0000-0000-0000-000000000002', 999, 'x');
    RAISE EXCEPTION 'FAIL 39 version incorrecta no debió aprobar';
  EXCEPTION WHEN raise_exception THEN RAISE NOTICE 'PASS  39 bloqueo optimista rechaza version stale'; END;
END $$;
DO $$ BEGIN
  BEGIN PERFORM public.nomi_approve_payroll('40000000-0000-0000-0000-000000000003', 2, 'x'); -- payX ya aprobada (caso 29)
    RAISE EXCEPTION 'FAIL 40 no debió re-aprobar nómina ya aprobada';
  EXCEPTION WHEN raise_exception THEN RAISE NOTICE 'PASS  40 no re-aprueba (estado != draft)'; END;
END $$;

RESET ROLE;
-- Doble cuenta bancaria primaria activa por empleado → índice único
DO $$ BEGIN
  BEGIN
    INSERT INTO public.nomi_employee_bank_accounts(company_id,employee_id,is_primary,status)
      VALUES ('11111111-1111-1111-1111-111111111111','30000000-0000-0000-0000-000000000001',true,'active');
    INSERT INTO public.nomi_employee_bank_accounts(company_id,employee_id,is_primary,status)
      VALUES ('11111111-1111-1111-1111-111111111111','30000000-0000-0000-0000-000000000001',true,'active');
    RAISE EXCEPTION 'FAIL 41 dos primarias activas no debieron permitirse';
  EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'PASS  41 una sola cuenta primaria activa por empleado'; END;
END $$;
-- Cifrado round-trip (§6): encrypt→decrypt recupera el valor
SELECT pg_temp.t_assert(
  public.pgp_decrypt_secret(public.pgp_encrypt_secret('ABCD010101XYZ','testkey'),'testkey') = 'ABCD010101XYZ',
  '42 cifrado RFC round-trip (encrypt→decrypt)');
-- HMAC ciego: normaliza (upper/trim) y depende de la llave (no SHA simple)
SELECT pg_temp.t_assert(
  public.nomi_blind_hash('abcd010101xyz','k1') = public.nomi_blind_hash('  ABCD010101XYZ  ','k1')
  AND public.nomi_blind_hash('ABCD010101XYZ','k1') <> public.nomi_blind_hash('ABCD010101XYZ','k2'),
  '43 HMAC ciego: normaliza y depende de NOMI_HMAC_KEY');

RESET ROLE;
ROLLBACK;

-- ============================================================================
-- PENDIENTE (pruebas de INTEGRACIÓN, no SQL puro — requieren las Edge Functions
-- corriendo con JWT real y llaves de env):
--  - doble envío bancario (idempotencia de nomi-bank-account)
--  - concurrencia real de aprobación (dos requests simultáneos)
--  - cifrado real + hash HMAC (nomi-employee-pii / nomi-bank-account)
--  - acceso cruzado al endpoint web /api/flujocheck/dashboard con company_id ajeno
-- ============================================================================
