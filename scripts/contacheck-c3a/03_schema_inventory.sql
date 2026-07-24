-- ContaCheck C3A · 03 — Inventario de columnas de tablas contables/afectadas (SOLO LECTURA)
select table_name, ordinal_position, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema='public'
  and table_name in (
    'accounting_accounts','accounting_accounts_v2','accounting_vouchers','accounting_entries',
    'expenses','receipts','bank_transactions','company_bank_accounts','bank_reconciliations',
    'cobra_invoices','cobra_payments','accounts_payable','cfdi_provider_configs','cfdi_documents',
    'companies','company_members','cost_centers','nomi_payroll')
order by table_name, ordinal_position;

-- Presencia/ausencia de las tablas nuevas de C2B (esperado: ausentes).
select t as expected_new_table,
       (to_regclass('public.'||t) is not null) as exists_in_prod
from unnest(array['accounting_voucher_lines','accounting_source_links','accounting_periods',
  'accounting_fiscal_years','accounting_rules','accounting_rule_versions','accounting_rule_conditions',
  'accounting_rule_outputs','accounting_line_dimensions','accounting_idempotency_requests',
  'accounting_voucher_sequences','parties','party_links','company_tax_profiles',
  'accounting_feature_flags','accounting_capabilities','accounting_role_capabilities','accounting_user_capabilities']) as t
order by t;
