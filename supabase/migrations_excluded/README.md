# Migraciones excluidas — 2026-07-05

Estos 4 archivos se movieron fuera de `supabase/migrations/` durante el push de migraciones
de CHECK SUITE v2.0. **No se aplicaron a producción.** Requieren decisión antes de reintegrarse.

## 20260629_DIAGNOSTICO.sql
Solo `SELECT` de diagnóstico (sin efecto en esquema). Se excluyó porque su nombre corto
(`20260629`, sin sufijo) causaba conflictos de bookkeeping en `supabase_migrations.schema_migrations`
al chocar con los otros 4 archivos `20260629_*.sql` (ya renombrados con timestamp completo).
No es necesario re-aplicarlo — no cambia nada en la base de datos.

## 20260704000001_seed_cobracheck_test_data.sql
**NO es una migración de esquema — inserta datos de prueba** (`INSERT INTO companies VALUES
('CobraCheck Demo', ...)`, clientes, facturas falsas). Excluido porque insertar datos demo
en la base de producción real mezclaría datos falsos con datos reales de clientes.
**Decisión pendiente**: ¿correr esto en un ambiente de staging separado, o descartarlo?

## 20260704000002_bancocheck_complete_schema.sql (Chat 1, 4 julio)
## 20260705120001_bancocheck_schema.sql (este chat, 5 julio)
**Ambos definen un `bank_transactions` incompatible con la tabla real ya existente en
producción.** La tabla real (`bank_transactions`) tiene este esquema:

```
id, company_id, bank_account_id, transaction_date, description, reference, amount,
balance_after, status, category, notes, related_receipt_id, related_invoice_id,
related_advance_id, imported_from, import_batch_id, created_at, updated_at
```

Ninguno de los 2 archivos coincide con esto — ambos asumen columnas que no existen
(`source_module`, `commission`, `ocr_data` en uno; `manual_account_id`, `matching_status`
en el otro). Esto significa que **el código de `apps/mobile/app/bancocheck/` construido
en OTA 137-138 (types.ts, hooks) tampoco coincide con la tabla real** — usa campos que
no existen en producción (ej. `source_module`, `commission`).

**Decisión pendiente**: reconciliar un solo diseño de `bank_transactions` que:
1. Preserve las columnas reales ya en uso (`related_receipt_id/invoice_id/advance_id`,
   `imported_from`, `import_batch_id` — probablemente usadas por integración GastoCheck/CobraCheck)
2. Agregue (no reemplace) las columnas nuevas necesarias para OCR/matching/reconciliación
   vía `ALTER TABLE ADD COLUMN IF NOT EXISTS`
3. Actualice `types.ts` y los hooks de BancoCheck para usar los nombres de columna reales

Las OTRAS tablas nuevas de BancoCheck (`bank_accounts_manual`, `bank_accounts_automated`,
`bank_statement_imports`, `transaction_matching_log`, `reconciliation_status`,
`unsupported_bank_requests`) SÍ son nuevas y no conflictan — se pueden aplicar por separado
extrayendo esos bloques del archivo `20260705120001_bancocheck_schema.sql`.
