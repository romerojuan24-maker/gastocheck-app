-- ContaCheck C3B · 00_preflight — PRECHECKS BLOQUEANTES (aborta antes de cualquier cambio)
-- Ejecutar con:  psql "<conn>" -v ON_ERROR_STOP=1 -v approved=YES -v backup_confirmed=YES -f 00_preflight.sql
-- NO aplica cambios. Solo lee y aborta (\quit / raise exception) si alguna condición no se cumple.

\echo '== ContaCheck C3B preflight =='
select current_database() as database, current_user as role, now() as inspected_at_utc;

-- (1) Aprobación explícita del despliegue (paso manual del runbook; NO es secreto).
\if :{?approved}
\else
  \echo 'ABORT: falta -v approved=YES (aprobación explícita del despliegue).'
  \quit
\endif
\if :{?backup_confirmed}
\else
  \echo 'ABORT: falta -v backup_confirmed=YES (respaldo reciente confirmado).'
  \quit
\endif

do $$
declare missing text; extra text;
begin
  -- (2) Tablas base requeridas por C2B deben existir.
  select string_agg(t,', ') into missing from unnest(array[
    'accounting_accounts','accounting_vouchers','companies','company_members','audit_logs','cost_centers']) t
  where to_regclass('public.'||t) is null;
  if missing is not null then raise exception 'PREFLIGHT ABORT: faltan tablas base: %', missing; end if;

  -- (3) auth helpers reutilizados por C2B deben existir.
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname in ('auth_is_member','auth_role','auth_can_view_all','auth_can_authorize')) < 4
  then raise exception 'PREFLIGHT ABORT: faltan auth helpers (auth_is_member/auth_role/...).'; end if;

  -- (4) Roles que C2B mapea deben existir en el enum member_role.
  if (select count(*) from pg_enum e join pg_type ty on ty.oid=e.enumtypid
        where ty.typname='member_role' and e.enumlabel in ('owner','contador_general','accountant','admin')) < 4
  then raise exception 'PREFLIGHT ABORT: member_role no tiene owner/contador_general/accountant/admin.'; end if;

  -- (5) NO debe existir C2B parcialmente aplicado: ninguna de las 18 tablas nuevas.
  select string_agg(t,', ') into extra from unnest(array[
    'accounting_voucher_lines','accounting_source_links','accounting_periods','accounting_fiscal_years',
    'accounting_rules','accounting_rule_versions','accounting_rule_conditions','accounting_rule_outputs',
    'accounting_line_dimensions','accounting_idempotency_requests','accounting_voucher_sequences',
    'parties','party_links','company_tax_profiles','accounting_feature_flags',
    'accounting_capabilities','accounting_role_capabilities','accounting_user_capabilities']) t
  where to_regclass('public.'||t) is not null;
  if extra is not null then raise exception 'PREFLIGHT ABORT: C2B parcialmente aplicado, ya existen: %', extra; end if;

  -- (6) accounting_vouchers NO debe tener columnas C2B (partial apply).
  if exists (select 1 from information_schema.columns
      where table_schema='public' and table_name='accounting_vouchers' and column_name in ('accounting_date','idempotency_key','party_id'))
  then raise exception 'PREFLIGHT ABORT: accounting_vouchers ya tiene columnas C2B.'; end if;

  -- (7) accounting_accounts_v2 debe seguir VACÍO (si tiene filas, el backfill difiere → revisar).
  if to_regclass('public.accounting_accounts_v2') is not null
     and (select count(*) from public.accounting_accounts_v2) > 0
  then raise exception 'PREFLIGHT ABORT: accounting_accounts_v2 dejó de estar vacío; revisar backfill.'; end if;

  -- (8) accounting_vouchers: datos incompatibles con las nuevas constraints (desbalanceadas).
  if exists (select 1 from public.accounting_vouchers where total_debit <> total_credit)
  then raise exception 'PREFLIGHT ABORT: existen pólizas desbalanceadas (total_debit<>total_credit).'; end if;

  -- (9) Colisión de nombres de función con las que C2B crea (firma distinta rompería CREATE OR REPLACE).
  --     Informativo fuerte: si ya existen funciones accounting_* NO creadas por C2B, abortar para revisión.
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in ('accounting_can','accounting_generate_voucher','accounting_post_voucher'))
  then raise exception 'PREFLIGHT ABORT: ya existen funciones accounting_* en prod (posible colisión). Revisar 06.';
  end if;

  raise notice 'PREFLIGHT OK: producción lista para aplicar los 16 bloques C2B.';
end $$;
