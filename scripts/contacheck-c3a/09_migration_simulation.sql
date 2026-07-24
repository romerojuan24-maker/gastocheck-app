-- ContaCheck C3A · 09 — Simulación de migración: colisiones y constraints incompatibles (SOLO LECTURA)
-- No aplica cambios. Detecta condiciones que harían fallar o volverse costosa una migración C2B.

-- (a) Nombres de TABLA que C2B crearía y que ya existan (colisión):
select t as new_table, (to_regclass('public.'||t) is not null) as collision
from unnest(array['accounting_voucher_lines','accounting_source_links','accounting_periods',
  'accounting_fiscal_years','accounting_rules','accounting_rule_versions','accounting_rule_conditions',
  'accounting_rule_outputs','accounting_line_dimensions','accounting_idempotency_requests',
  'accounting_voucher_sequences','parties','party_links','company_tax_profiles',
  'accounting_feature_flags','accounting_capabilities','accounting_role_capabilities','accounting_user_capabilities']) t;

-- (b) Columnas que C2B AGREGA a accounting_vouchers y que ya existan (ADD COLUMN IF NOT EXISTS = no-op, informativo):
select col, (exists (select 1 from information_schema.columns
   where table_schema='public' and table_name='accounting_vouchers' and column_name=col)) as ya_existe
from unnest(array['accounting_date','party_id','idempotency_key','fiscal_period_id','posted_at','version',
  'metadata','reversal_of_voucher_id','fiscal_year','exchange_rate']) col;

-- (c) voucher_number: nulabilidad y unicidad actuales (C2B lo hace nullable y cambia la unicidad).
select is_nullable from information_schema.columns
where table_schema='public' and table_name='accounting_vouchers' and column_name='voucher_number';
select conname, pg_get_constraintdef(oid)
from pg_constraint where conrelid='public.accounting_vouchers'::regclass and contype='u';

-- (d) Filas que violarían las nuevas constraints (0 filas ⇒ seguro):
--     - voucher_number duplicado global (C2B lo permite por empresa; informativo)
select count(*) - count(distinct voucher_number) as dup_global_voucher_number,
       count(*) filter (where total_debit <> total_credit) as desbalanceadas
from public.accounting_vouchers;

-- (e) member_role enum tiene los roles que C2B mapea (owner/contador_general/accountant/admin)
select e.enumlabel
from pg_enum e join pg_type t on t.oid=e.enumtypid
where t.typname='member_role' and e.enumlabel in ('owner','contador_general','accountant','admin')
order by e.enumsortorder;

-- (f) auth helpers que C2B reutiliza deben existir
select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and proname in ('auth_is_member','auth_role','auth_can_view_all','auth_can_authorize');
