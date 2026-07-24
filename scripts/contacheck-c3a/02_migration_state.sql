-- ContaCheck C3A · 02 — Estado de migraciones + drift de ledger (SOLO LECTURA)
-- Nota: el ledger NO es fuente de verdad (hay objetos aplicados a mano). Comparar SIEMPRE contra el esquema real.

-- ¿Existe el mecanismo de control de migraciones?
select to_regclass('supabase_migrations.schema_migrations') as schema_migrations_table;

-- Historial aplicado (versión + nombre + fecha si existe).
select version, name, coalesce(to_char(inserted_at,'YYYY-MM-DD HH24:MI'),'(sin fecha)') as inserted_at
from supabase_migrations.schema_migrations
order by version;

-- Total aplicadas y rango.
select count(*) as applied_count, min(version) as first, max(version) as last
from supabase_migrations.schema_migrations;

-- DRIFT: objetos que existen en el esquema pero cuya migración podría NO estar registrada.
-- (Ej.: bank_transactions.accounting_account_id existe aunque 20260721100000 no figure aplicada.)
select 'bank_transactions.accounting_account_id' as object,
       (select count(*) from information_schema.columns
         where table_schema='public' and table_name='bank_transactions' and column_name='accounting_account_id') as exists_col,
       (select count(*) from supabase_migrations.schema_migrations where version='20260721100000') as migration_registered;
