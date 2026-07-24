-- ContaCheck C3A · 06 — Funciones y triggers (SOLO LECTURA)
-- Funciones contables existentes + firma/definer/search_path/owner
select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       pg_get_userbyid(p.proowner)               as owner,
       p.prosecdef                               as security_definer,
       (select array_agg(s) from unnest(coalesce(p.proconfig,'{}')) s where s like 'search_path%') as search_path
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and (p.proname like 'accounting_%' or p.proname like 'nomi_%'
       or p.proname in ('generate_accounting_entries','export_policy_json','export_policy_contpaqui','validate_cfdi_with_sat'))
order by p.proname;

-- COLISIÓN: ¿existe ya en prod alguna función con los nombres que crea C2B?
select nombre,
       (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
         where n.nspname='public' and p.proname=nombre) as ya_existe_en_prod
from unnest(array['accounting_can','accounting_generate_voucher','accounting_validate_voucher',
  'accounting_approve_voucher','accounting_post_voucher','accounting_reverse_voucher',
  'accounting_next_voucher_number','accounting_resolve_rules','accounting_link_bank_transaction',
  'accounting_get_voucher_by_source','accounting_log_audit','accounting_open_fiscal_year',
  'accounting_close_period','accounting_reopen_period','accounting_period_for_date','accounting_upsert_party',
  'accounting_merge_party','accounting_publish_rule','accounting_payload_hash','accounting_tax_profile_for_date',
  'accounting_flag_mode','accounting_set_flag','accounting_norm_rfc']) as nombre
order by nombre;

-- EXECUTE grants de funciones accounting_*/nomi_* (esperado: sin public/anon en las sensibles)
select p.proname, r.grantee, r.privilege_type
from information_schema.routine_privileges r
join pg_proc p on p.proname = r.routine_name
join pg_namespace n on n.oid=p.pronamespace and n.nspname='public'
where r.routine_schema='public' and (p.proname like 'accounting_%' or p.proname like 'nomi_%')
order by p.proname, r.grantee;

-- Triggers sobre tablas afectadas por C2B
select c.relname as table_name, t.tgname, t.tgenabled, pg_get_triggerdef(t.oid) as definition
from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and not t.tgisinternal
  and c.relname in ('accounting_vouchers','accounting_accounts','accounting_accounts_v2','expenses','bank_transactions')
order by c.relname, t.tgname;
