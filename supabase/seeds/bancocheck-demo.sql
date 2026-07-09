-- BancoCheck Demo Data (2026-07-09)

INSERT INTO bank_accounts (id, tenant_id, name, bank_name, account_number_last4, currency, type, imported_balance, created_by_id)
VALUES
  ('acc_bbva_1', 'demo_tenant', 'BBVA Nóminas', 'BBVA', '1234', 'MXN', 'corriente', '50000', 'user_admin'),
  ('acc_banorte_1', 'demo_tenant', 'Banorte Operativo', 'Banorte', '5678', 'MXN', 'corriente', '25000', 'user_admin'),
  ('acc_santander_1', 'demo_tenant', 'Santander Ahorros', 'Santander', '9012', 'MXN', 'ahorros', '10000', 'user_admin');

INSERT INTO bank_import_batches (id, tenant_id, bank_account_id, file_name, file_hash, total_rows, imported_rows, duplicate_rows, error_rows, status, created_by_id)
VALUES
  ('batch_1', 'demo_tenant', 'acc_bbva_1', 'extracto_julio_2026.csv', 'hash_demo_1', 50, 50, 0, 0, 'completed', 'user_admin');

INSERT INTO bank_transactions (id, tenant_id, bank_account_id, date, description, reference, debit, credit, balance_after, currency, import_batch_id, unique_hash, status, category, is_personal)
VALUES
  ('trans_1', 'demo_tenant', 'acc_bbva_1', '2026-07-01'::date, 'PAGO CON TARJETA ACME SAC', 'REF001', '1500.00', '0', '48500.00', 'MXN', 'batch_1', 'hash_trans_1', 'EXPLAINED', 'gasto_negocio', false),
  ('trans_2', 'demo_tenant', 'acc_bbva_1', '2026-07-02'::date, 'TRANSFERENCIA CLIENTE XYZ', 'REF002', '0', '5000.00', '53500.00', 'MXN', 'batch_1', 'hash_trans_2', 'EXPLAINED', 'pago_cliente', false),
  ('trans_3', 'demo_tenant', 'acc_bbva_1', '2026-07-03'::date, 'RETIRO CAJERO', '', '2000.00', '0', '51500.00', 'MXN', 'batch_1', 'hash_trans_3', 'NEW', null, false),
  ('trans_4', 'demo_tenant', 'acc_bbva_1', '2026-07-04'::date, 'TRANSFERENCIA PROVEEDORES UNIDAS', 'REF004', '3500.00', '0', '48000.00', 'MXN', 'batch_1', 'hash_trans_4', 'NEW', null, false),
  ('trans_5', 'demo_tenant', 'acc_bbva_1', '2026-07-05'::date, 'DEPOSITO CHEQUE CLIENTE', '', '0', '8000.00', '56000.00', 'MXN', 'batch_1', 'hash_trans_5', 'NEEDS_INVOICE', null, false),
  ('trans_6', 'demo_tenant', 'acc_bbva_1', '2026-07-06'::date, 'COMISION BANCARIA', '', '50.00', '0', '55950.00', 'MXN', 'batch_1', 'hash_trans_6', 'EXPLAINED', 'comision_bancaria', false),
  ('trans_7', 'demo_tenant', 'acc_bbva_1', '2026-07-07'::date, 'TRANSFERENCIA PERSONAL', '', '1000.00', '0', '54950.00', 'MXN', 'batch_1', 'hash_trans_7', 'PERSONAL', null, true),
  ('trans_8', 'demo_tenant', 'acc_banorte_1', '2026-07-01'::date, 'PAGO ENERGIA CFE', 'PAGO_001', '2500.00', '0', '22500.00', 'MXN', 'batch_1', 'hash_trans_8', 'EXPLAINED', 'gasto_negocio', false),
  ('trans_9', 'demo_tenant', 'acc_banorte_1', '2026-07-02'::date, 'INGRESO DEPOSITO', '', '0', '3000.00', '25500.00', 'MXN', 'batch_1', 'hash_trans_9', 'NEW', null, false),
  ('trans_10', 'demo_tenant', 'acc_santander_1', '2026-07-01'::date, 'INTERES PAGADO', '', '0', '150.00', '10150.00', 'MXN', 'batch_1', 'hash_trans_10', 'EXPLAINED', 'ingreso_no_facturado', false);

INSERT INTO bank_match_suggestions (id, tenant_id, bank_transaction_id, entity_type, entity_id, confidence, reason)
VALUES
  ('sugg_1', 'demo_tenant', 'trans_3', 'expense', 'exp_456', 85, 'amount_matches'),
  ('sugg_2', 'demo_tenant', 'trans_4', 'invoice', 'inv_789', 75, 'supplier_in_description'),
  ('sugg_3', 'demo_tenant', 'trans_5', 'collection', 'col_321', 90, 'amount_matches_invoice'),
  ('sugg_4', 'demo_tenant', 'trans_9', 'payment', 'pay_654', 70, 'date_proximity');
