-- Check Advisor Wave 8 — Signal Publication Triggers
--
-- Postgres triggers that publish signals to business_signals table and
-- queue correlation jobs when module events occur.
--
-- Triggered tables:
-- - expenses (GastoCheck)
-- - cobra_invoices (CobraCheck)
-- - cobra_payments (CobraCheck)
-- - bank_transactions (BancoCheck)
-- - cfdi_documents (FacturaCheck)
-- - inventory_movements (InventarioCheck)

-- ─────────────────────────────────────────────────────────────────────────────
-- GastoCheck: Expense Created/Updated → Publish EXPENSE_CREATED signal
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function trg_gastocheck_expense_created()
returns trigger language plpgsql as $$
declare
  v_company_id uuid;
begin
  -- Infer company_id from expenses row
  select company_id into v_company_id from expenses where id = new.id;

  -- Only publish on INSERT (new records only)
  if (tg_op = 'INSERT') then
    -- Publish signal to business_signals
    insert into business_signals (
      company_id, source_module, signal_type, severity, entity_type, entity_id,
      title, value_decimal, currency, deduplication_key, status
    ) values (
      v_company_id, 'gastocheck', 'EXPENSE_CREATED', 'INFO', 'expense', new.id,
      'Gasto registrado: ' || coalesce(new.provider_name, '(sin proveedor)'),
      new.total, 'MXN', 'expense:' || new.id::text, 'ACTIVE'
    )
    on conflict (company_id, deduplication_key) where deduplication_key is not null and status = 'ACTIVE'
    do update set
      title = excluded.title,
      value_decimal = excluded.value_decimal,
      updated_at = now();

    -- Queue correlation job
    insert into advisor_signal_queue (company_id, event_type, status)
    values (v_company_id, 'EXPENSE_CREATED', 'PENDING');
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_expense_created on expenses;
create trigger trg_expense_created
after insert on expenses
for each row execute function trg_gastocheck_expense_created();

-- ─────────────────────────────────────────────────────────────────────────────
-- CobraCheck: Invoice Created → Publish INVOICE_CREATED signal
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function trg_cobracheck_invoice_created()
returns trigger language plpgsql as $$
declare
  v_company_id uuid;
begin
  select company_id into v_company_id from cobra_invoices where id = new.id;

  if (tg_op = 'INSERT') then
    insert into business_signals (
      company_id, source_module, signal_type, severity, entity_type, entity_id,
      title, value_decimal, currency, deduplication_key, status
    ) values (
      v_company_id, 'cobracheck', 'INVOICE_CREATED', 'INFO', 'cobra_invoice', new.id,
      'Factura por cobrar: ' || coalesce(new.invoice_number, '(sin número)'),
      new.amount, 'MXN', 'invoice:' || new.id::text, 'ACTIVE'
    )
    on conflict (company_id, deduplication_key) where deduplication_key is not null and status = 'ACTIVE'
    do update set updated_at = now();

    insert into advisor_signal_queue (company_id, event_type, status)
    values (v_company_id, 'INVOICE_CREATED', 'PENDING');
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_invoice_created on cobra_invoices;
create trigger trg_invoice_created
after insert on cobra_invoices
for each row execute function trg_cobracheck_invoice_created();

-- ─────────────────────────────────────────────────────────────────────────────
-- CobraCheck: Invoice Status Changed (overdue/paid) → Update signals
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function trg_cobracheck_invoice_status_changed()
returns trigger language plpgsql as $$
declare
  v_company_id uuid;
begin
  if (tg_op = 'UPDATE' and new.status != old.status) then
    select company_id into v_company_id from cobra_invoices where id = new.id;

    -- Signal when invoice becomes overdue
    if new.status = 'overdue' then
      insert into business_signals (
        company_id, source_module, signal_type, severity, entity_type, entity_id,
        title, value_decimal, currency, deduplication_key, status
      ) values (
        v_company_id, 'cobracheck', 'INVOICE_OVERDUE', 'HIGH', 'cobra_invoice', new.id,
        'Factura vencida: ' || coalesce(new.invoice_number, '(sin número)'),
        new.amount, 'MXN', 'invoice_overdue:' || new.id::text, 'ACTIVE'
      )
      on conflict (company_id, deduplication_key) where deduplication_key is not null and status = 'ACTIVE'
      do update set updated_at = now();

      insert into advisor_signal_queue (company_id, event_type, status)
      values (v_company_id, 'INVOICE_STATUS_CHANGED', 'PENDING');
    end if;

    -- Signal when invoice is paid
    if new.status = 'paid' then
      insert into business_signals (
        company_id, source_module, signal_type, severity, entity_type, entity_id,
        title, value_decimal, currency, deduplication_key, status
      ) values (
        v_company_id, 'cobracheck', 'INVOICE_PAID', 'INFO', 'cobra_invoice', new.id,
        'Factura pagada: ' || coalesce(new.invoice_number, '(sin número)'),
        new.amount, 'MXN', 'invoice_paid:' || new.id::text, 'ACTIVE'
      )
      on conflict (company_id, deduplication_key) where deduplication_key is not null and status = 'ACTIVE'
      do update set updated_at = now();

      insert into advisor_signal_queue (company_id, event_type, status)
      values (v_company_id, 'INVOICE_STATUS_CHANGED', 'PENDING');
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_invoice_status_changed on cobra_invoices;
create trigger trg_invoice_status_changed
after update on cobra_invoices
for each row execute function trg_cobracheck_invoice_status_changed();

-- ─────────────────────────────────────────────────────────────────────────────
-- CobraCheck: Payment Received → Publish PAYMENT_RECEIVED signal
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function trg_cobracheck_payment_received()
returns trigger language plpgsql as $$
declare
  v_company_id uuid;
begin
  select company_id into v_company_id from cobra_payments where id = new.id;

  if (tg_op = 'INSERT') then
    insert into business_signals (
      company_id, source_module, signal_type, severity, entity_type, entity_id,
      title, value_decimal, currency, deduplication_key, status
    ) values (
      v_company_id, 'cobracheck', 'PAYMENT_RECEIVED', 'INFO', 'cobra_payment', new.id,
      'Pago recibido: $' || coalesce(new.amount::text, '0'),
      new.amount, 'MXN', 'payment:' || new.id::text, 'ACTIVE'
    )
    on conflict (company_id, deduplication_key) where deduplication_key is not null and status = 'ACTIVE'
    do update set updated_at = now();

    insert into advisor_signal_queue (company_id, event_type, status)
    values (v_company_id, 'PAYMENT_RECEIVED', 'PENDING');
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_payment_received on cobra_payments;
create trigger trg_payment_received
after insert on cobra_payments
for each row execute function trg_cobracheck_payment_received();

-- ─────────────────────────────────────────────────────────────────────────────
-- BancoCheck: Bank Transaction → Publish TRANSACTION_DETECTED signal
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function trg_bancocheck_transaction_detected()
returns trigger language plpgsql as $$
declare
  v_company_id uuid;
begin
  select company_id into v_company_id from bank_transactions where id = new.id;

  if (tg_op = 'INSERT') then
    insert into business_signals (
      company_id, source_module, signal_type, severity, entity_type, entity_id,
      title, value_decimal, currency, deduplication_key, status
    ) values (
      v_company_id, 'bancocheck', 'TRANSACTION_DETECTED', 'INFO', 'bank_transaction', new.id,
      (case when new.transaction_type = 'deposit' then 'Depósito' else 'Retiro' end) ||
        ': $' || abs(new.amount)::text,
      new.amount, 'MXN', 'transaction:' || new.id::text, 'ACTIVE'
    )
    on conflict (company_id, deduplication_key) where deduplication_key is not null and status = 'ACTIVE'
    do update set updated_at = now();

    insert into advisor_signal_queue (company_id, event_type, status)
    values (v_company_id, 'TRANSACTION_DETECTED', 'PENDING');
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_transaction_detected on bank_transactions;
create trigger trg_transaction_detected
after insert on bank_transactions
for each row execute function trg_bancocheck_transaction_detected();

-- ─────────────────────────────────────────────────────────────────────────────
-- BancoCheck: Transaction Status Changed (matched/unmatched)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function trg_bancocheck_transaction_matched()
returns trigger language plpgsql as $$
declare
  v_company_id uuid;
begin
  if (tg_op = 'UPDATE' and new.matched_status != old.matched_status) then
    select company_id into v_company_id from bank_transactions where id = new.id;

    if new.matched_status = 'matched' then
      insert into business_signals (
        company_id, source_module, signal_type, severity, entity_type, entity_id,
        title, value_decimal, currency, deduplication_key, status
      ) values (
        v_company_id, 'bancocheck', 'TRANSACTION_MATCHED', 'INFO', 'bank_transaction', new.id,
        'Movimiento bancario conciliado',
        new.amount, 'MXN', 'transaction_matched:' || new.id::text, 'ACTIVE'
      )
      on conflict (company_id, deduplication_key) where deduplication_key is not null and status = 'ACTIVE'
      do update set updated_at = now();

      insert into advisor_signal_queue (company_id, event_type, status)
      values (v_company_id, 'TRANSACTION_MATCHED', 'PENDING');
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_transaction_matched on bank_transactions;
create trigger trg_transaction_matched
after update on bank_transactions
for each row execute function trg_bancocheck_transaction_matched();

-- ─────────────────────────────────────────────────────────────────────────────
-- FacturaCheck: CFDI Created → Publish CFDI_RECEIVED signal
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function trg_facturacheck_cfdi_received()
returns trigger language plpgsql as $$
declare
  v_company_id uuid;
begin
  select company_id into v_company_id from cfdi_documents where id = new.id;

  if (tg_op = 'INSERT') then
    insert into business_signals (
      company_id, source_module, signal_type, severity, entity_type, entity_id,
      title, value_decimal, currency, deduplication_key, status
    ) values (
      v_company_id, 'facturacheck', 'CFDI_RECEIVED', 'INFO', 'cfdi_document', new.id,
      'CFDI recibido: ' || coalesce(new.folio, '(sin folio)'),
      new.total, 'MXN', 'cfdi:' || new.id::text, 'ACTIVE'
    )
    on conflict (company_id, deduplication_key) where deduplication_key is not null and status = 'ACTIVE'
    do update set updated_at = now();

    insert into advisor_signal_queue (company_id, event_type, status)
    values (v_company_id, 'CFDI_RECEIVED', 'PENDING');
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_cfdi_received on cfdi_documents;
create trigger trg_cfdi_received
after insert on cfdi_documents
for each row execute function trg_facturacheck_cfdi_received();

-- ─────────────────────────────────────────────────────────────────────────────
-- InventarioCheck: Inventory Movement → Publish INVENTORY_MOVEMENT signal
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function trg_inventariocheck_movement()
returns trigger language plpgsql as $$
declare
  v_company_id uuid;
begin
  select company_id into v_company_id from inventory_movements where id = new.id;

  if (tg_op = 'INSERT') then
    insert into business_signals (
      company_id, source_module, signal_type, severity, entity_type, entity_id,
      title, value_decimal, deduplication_key, status
    ) values (
      v_company_id, 'inventariocheck', 'INVENTORY_MOVEMENT', 'INFO', 'inventory_movement', new.id,
      'Movimiento de inventario: ' || new.movement_type,
      new.quantity, 'inventory:' || new.id::text, 'ACTIVE'
    )
    on conflict (company_id, deduplication_key) where deduplication_key is not null and status = 'ACTIVE'
    do update set updated_at = now();

    insert into advisor_signal_queue (company_id, event_type, status)
    values (v_company_id, 'INVENTORY_MOVEMENT', 'PENDING');
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_inventory_movement on inventory_movements;
create trigger trg_inventory_movement
after insert on inventory_movements
for each row execute function trg_inventariocheck_movement();
