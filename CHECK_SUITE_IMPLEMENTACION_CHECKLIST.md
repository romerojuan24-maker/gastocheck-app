# CHECK SUITE — Checklist de Implementación Cross-Módulos

**Versión:** 1.0  
**Fecha:** 2026-07-05  
**Proyecto:** Integración 6 flujos críticos  
**Duración Estimada:** 6 semanas  
**Responsable:** Juan (Arquitectura) + Daniel (Implementación)  

---

## FASE 1: GastoCheck ↔ FlujoCheck (Egresos)
**Duración:** 1 semana  
**Hito:** Gastos aprobados → aparecen en proyección flujo  

### 1.1 Backend (Supabase)

#### SQL Triggers
- [ ] Crear tabla `cash_flow_projections` (si no existe)
  ```sql
  CREATE TABLE cash_flow_projections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    module VARCHAR(50),  -- 'gastocheck', 'cobracheck', etc.
    amount NUMERIC(15,2) NOT NULL,
    date DATE NOT NULL,
    type VARCHAR(20),  -- 'expense', 'income'
    description TEXT,
    source_id UUID,  -- FK a expenses.id o collection_logs.id
    status VARCHAR(20),  -- 'projected', 'actual', 'reconciled'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  ```

- [ ] Crear índices
  ```sql
  CREATE INDEX idx_cash_flow_org_date 
    ON cash_flow_projections(org_id, date);
  CREATE INDEX idx_cash_flow_source 
    ON cash_flow_projections(source_id);
  ```

- [ ] Crear función `sync_expense_to_cashflow()`
  ```sql
  CREATE OR REPLACE FUNCTION sync_expense_to_cashflow()
  RETURNS TRIGGER AS $$
  BEGIN
    IF NEW.state = 'approved' AND OLD.state != 'approved' THEN
      INSERT INTO cash_flow_projections (
        org_id, module, amount, date, type, description, source_id, status
      ) VALUES (
        NEW.org_id,
        'gastocheck',
        -ABS(NEW.amount),
        NEW.payment_date,
        'expense',
        NEW.description,
        NEW.id,
        'projected'
      );
      PERFORM check_cashflow_deficit(NEW.org_id);
    END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
  ```

- [ ] Crear trigger `on_expense_approved`
  ```sql
  CREATE TRIGGER on_expense_approved
    AFTER UPDATE ON expenses
    FOR EACH ROW
    EXECUTE FUNCTION sync_expense_to_cashflow();
  ```

- [ ] Crear función `check_cashflow_deficit()`
  ```sql
  CREATE OR REPLACE FUNCTION check_cashflow_deficit(v_org_id UUID)
  RETURNS VOID AS $$
  DECLARE
    v_balance NUMERIC;
  BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO v_balance
    FROM cash_flow_projections
    WHERE org_id = v_org_id
      AND date >= CURRENT_DATE
      AND date < CURRENT_DATE + INTERVAL '7 days'
      AND status IN ('projected', 'actual');
    
    IF v_balance < 10000 THEN
      INSERT INTO alerts_rules (
        org_id, type, severity, module, message, recipient_role
      ) VALUES (
        v_org_id, 'CASHFLOW_DEFICIT', 'HIGH', 'flujocheck',
        'Flujo semanal: $' || v_balance || '. Posible déficit.',
        'admin'
      );
    END IF;
  END;
  $$ LANGUAGE plpgsql;
  ```

- [ ] Validar sintaxis SQL (error check en dev)
- [ ] Testear con INSERT/UPDATE expenses en tabla

#### Edge Functions
- [ ] Crear function `notify_flow_updated`
  - [ ] Lee cambios en cash_flow_projections
  - [ ] Emite evento Realtime a org
  - [ ] Archivo: `functions/notify_flow_updated.ts`

- [ ] Crear function `export_flow_data`
  - [ ] Exporta proyecciones para BI (opcional P1)
  - [ ] Archivo: `functions/export_flow_data.ts`

#### RLS Policies
- [ ] Crear policy: contador_general ve todas cash_flow_projections
  ```sql
  CREATE POLICY "contador_view_cashflow" ON cash_flow_projections
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM org_members
        WHERE org_id = cash_flow_projections.org_id
          AND user_id = auth.uid()
          AND role = 'contador_general'
      )
    );
  ```

- [ ] Crear policy: admin ve todas
- [ ] Verificar no-write policies (INSERT/UPDATE/DELETE denied)

### 1.2 Frontend (Next.js - FlujoCheck Web)

#### Components
- [ ] `components/FlujoChart.tsx` (gráfica semanal)
  - [ ] Input: cash_flow_projections[]
  - [ ] Renderiza: línea balance diario
  - [ ] Marca: alertas > umbral

- [ ] `components/FlujoDailyBreakdown.tsx` (desglose por módulo)
  - [ ] Tabla: Fecha | Gastos | Cobros | Balance
  - [ ] Colores: rojo (deficit) | verde (superávit)

- [ ] `components/CashflowAlert.tsx` (banner de alerta)
  - [ ] Severity HIGH → rojo
  - [ ] Mensaje: "Déficit $X"

#### Pages/Views
- [ ] Crear página `pages/flujocheck/index.tsx`
  - [ ] Layout: gráfica + breakdown + alertas
  - [ ] Realtime listener: supabase.on() cash_flow_projections
  - [ ] Auto-refresh c/5 segundos

- [ ] Query builder: `queries/getCashflowData.ts`
  - [ ] SELECT cash_flow_projections WHERE org_id = X
  - [ ] ORDER BY date ASC
  - [ ] Hook: `useCashflow()`

#### Testing
- [ ] Test unitario: cálculo balance
- [ ] Test integración: expense INSERT → flow UPDATE
- [ ] E2E: Comprador crea gasto → aparece en flujo

### 1.3 Notificaciones (Supabase + Edge)

#### Database
- [ ] Tabla `notifications` (si no existe)
- [ ] Tabla `notification_preferences`

#### Edge Function: route_alert()
- [ ] Leer alerts_rules INSERT
- [ ] Determinar canales (push/email/in-app)
- [ ] Enviar por cada canal
- [ ] Log audit

#### Canales
- [ ] In-app: INSERT notifications
- [ ] Push: Integración Expo PushNotifications (si móvil)
- [ ] Email: Integración Resend (opcional P1)

### 1.4 Testing y QA

#### Unit Tests
```typescript
// test/cashflow.test.ts
describe('Cashflow Projection', () => {
  test('should create projection on expense approved', () => {
    // Mock expenses table
    // Trigger sync_expense_to_cashflow
    // Assert cash_flow_projections INSERT
  });

  test('should alert on deficit', () => {
    // Sum projections < 10000
    // Assert alerts_rules INSERT
  });
});
```

#### Integration Tests
```typescript
// test/integration/gastocheck-flujocheck.test.ts
describe('GastoCheck ↔ FlujoCheck Integration', () => {
  test('end-to-end: gasto aprobado → aparece en flujo', async () => {
    // 1. Create organization + user
    // 2. INSERT expense (DRAFT)
    // 3. UPDATE expense (APPROVED)
    // 4. Wait 500ms (trigger latency)
    // 5. SELECT cash_flow_projections
    // 6. Assert amount = -expense.amount
  });

  test('should display in FlujoCheck UI', async () => {
    // Render <FlujoChart />
    // Check proyección actualizada
  });
});
```

#### E2E Tests (Expo/Next.js)
```gherkin
Feature: Gasto → Flujo
  Scenario: Comprador aprueba gasto, aparece en flujo semanal
    Given Comprador registra $5000 gasto
    When Supervisor aprueba
    Then FlujoCheck semanal muestra -$5000
    And balance semanal disminuye
    And si balance < $10k: alerta visible
```

### 1.5 Deployment

- [ ] Migration SQL deploy (Supabase CLI)
  ```bash
  supabase migration new sync_expense_to_cashflow
  supabase migration up
  ```

- [ ] Deploy Edge Functions
  ```bash
  supabase functions deploy notify_flow_updated
  ```

- [ ] Deploy FlujoCheck Next.js
  ```bash
  npm run build --workspace=apps/web
  npm run deploy --workspace=apps/web
  ```

- [ ] Verificar en staging antes de producción

### 1.6 Rollback Plan

- [ ] Mantener `expenses` sin cambios (no DELETE cash_flow si DELETE expense)
- [ ] Si trigger error: disable trigger, restore manual
- [ ] Backup cash_flow_projections antes de deploy

### 1.7 Documentación

- [ ] Actualizar `CLAUDE.md` con nuevo flujo
- [ ] Documentar schema cambios
- [ ] Agregar screenshots en memoria

---

## FASE 2: CobraCheck ↔ FlujoCheck (Ingresos + Confiabilidad)
**Duración:** 1 semana  
**Hito:** Cobros → ingresos en flujo + actualización confianza  

### 2.1 Backend (Supabase)

#### Tablas
- [ ] Crear tabla `payment_confidence` (si no existe)
  ```sql
  CREATE TABLE payment_confidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    customer_id VARCHAR(100) NOT NULL,
    total_collections INT DEFAULT 0,
    total_amount_collected NUMERIC(15,2) DEFAULT 0,
    missed_payments INT DEFAULT 0,
    confidence_score INT DEFAULT 50,  -- 0-100
    last_payment_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(org_id, customer_id)
  );
  ```

- [ ] Crear índices
  ```sql
  CREATE INDEX idx_confidence_score 
    ON payment_confidence(org_id, confidence_score DESC);
  ```

#### SQL Functions
- [ ] Función `calculate_confidence_score()`
  ```sql
  CREATE OR REPLACE FUNCTION calculate_confidence_score(
    p_total_collections INT,
    p_missed_payments INT,
    p_total_amount NUMERIC,
    p_avg_days INT
  ) RETURNS INT AS $$
  DECLARE
    v_success_rate NUMERIC;
    v_timeliness_factor NUMERIC;
    v_volume_factor NUMERIC;
    v_score INT;
  BEGIN
    v_success_rate := CASE 
      WHEN p_total_collections = 0 THEN 0.5
      ELSE (p_total_collections - p_missed_payments)::NUMERIC / p_total_collections
    END;
    
    v_timeliness_factor := CASE
      WHEN p_avg_days <= 15 THEN 1.1
      WHEN p_avg_days <= 30 THEN 1.0
      ELSE 0.9
    END;
    
    v_volume_factor := CASE
      WHEN p_total_amount >= 100000 THEN 1.05
      ELSE 1.0
    END;
    
    v_score := LEAST(100, 
      FLOOR(v_success_rate * 100 * v_timeliness_factor * v_volume_factor)
    );
    
    RETURN GREATEST(0, v_score);
  END;
  $$ LANGUAGE plpgsql IMMUTABLE;
  ```

- [ ] Función `sync_collection_to_cashflow()`
  - [ ] INSERT cash_flow_projections (ingreso actual)
  - [ ] UPDATE payment_confidence
  - [ ] CALL check_confidence_change()

- [ ] Trigger `on_collection_completed`
  ```sql
  CREATE TRIGGER on_collection_completed
    AFTER INSERT ON collection_logs
    FOR EACH ROW
    WHEN (NEW.status = 'collected')
    EXECUTE FUNCTION sync_collection_to_cashflow();
  ```

- [ ] Función `notify_flow_confidence_update()`
  - [ ] Emite evento: customer_id + score_old + score_new

#### Edge Functions
- [ ] `adjust_payment_weights()`: recalcula ponderaciones en FlujoCheck

### 2.2 Frontend (Next.js - FlujoCheck + CobraCheck Web)

#### Components
- [ ] `components/CustomerConfidenceCard.tsx`
  - [ ] Muestra: nombre | score % | cobros totales | trend

- [ ] `components/FlujoCobrosSegmento.tsx` (en FlujoCheck)
  - [ ] Desglose: Cobros Confiables (score > 80%) vs Risky (< 60%)
  - [ ] Ponderación ajusta proyección

#### Pages
- [ ] Actualizar `pages/flujocheck/index.tsx`
  - [ ] Agregar sección "Confiabilidad Clientes"
  - [ ] Listar top 10 por score
  - [ ] Gráfica: score distribution (histogram)

- [ ] Crear `pages/cobracheck/admin/confidence.tsx` (admin view)
  - [ ] Tabla todos los clientes + scores
  - [ ] Filtros: score range, last payment range
  - [ ] Export CSV

#### Realtime
- [ ] Listener: `payment_confidence` changes
- [ ] Update UI in real-time

### 2.3 Testing

#### Unit Tests
```typescript
describe('calculate_confidence_score', () => {
  test('success_rate 80% + timely + large volume = high score', () => {
    const score = calculateConfidenceScore(20, 4, 250000, 25);
    expect(score).toBeGreaterThan(80);
  });
});
```

#### E2E
```gherkin
Feature: Cobro → Confiabilidad
  Scenario: Cobrador registra cobro, score actualiza
    Given Cliente ABC confidence = 78%
    When Cobrador registra cobro exitoso
    Then Score actualiza a 85%
    And FlujoCheck refleja peso +3%
```

### 2.4 Deployment
- [ ] Deploy SQL migrations
- [ ] Deploy Edge Functions
- [ ] Deploy frontend updates

---

## FASE 3: BancoCheck ↔ FlujoCheck (Reconciliación Real-time)
**Duración:** 1.5 semanas  
**Hito:** Banco sincroniza c/5 min, FlujoCheck valida vs proyectado  

### 3.1 Backend (Supabase)

#### Tablas
- [ ] Crear tabla `bank_accounts`
- [ ] Crear tabla `bank_transactions`
- [ ] Crear tabla `bank_reconciliation`
- [ ] Crear tabla `transaction_anomalies`

#### Integración Belvo
- [ ] Configurar Belvo API key en env
- [ ] Crear Edge Function `sync_belvo_transactions`
  - [ ] Llamar Belvo c/5 min (Cloud Scheduler)
  - [ ] Fetch transacciones de últimas 2h
  - [ ] INSERT en bank_transactions
  - [ ] Log sync status

#### SQL Triggers
- [ ] Función `reconcile_on_bank_sync()`
  ```sql
  CREATE OR REPLACE FUNCTION reconcile_on_bank_sync()
  RETURNS TRIGGER AS $$
  DECLARE
    v_org_id UUID;
    v_projected_balance NUMERIC;
    v_actual_balance NUMERIC;
    v_deviation_pct NUMERIC;
  BEGIN
    -- 1. Obtiene org_id
    SELECT org_id INTO v_org_id
    FROM bank_accounts WHERE id = NEW.account_id;
    
    -- 2. Suma proyecciones
    SELECT COALESCE(SUM(amount), 0) INTO v_projected_balance
    FROM cash_flow_projections
    WHERE org_id = v_org_id
      AND date <= CURRENT_DATE
      AND status IN ('projected', 'actual');
    
    -- 3. Suma transacciones reales
    SELECT COALESCE(SUM(amount), 0) INTO v_actual_balance
    FROM bank_transactions
    WHERE account_id = NEW.account_id
      AND transaction_date <= CURRENT_DATE;
    
    -- 4. Calcula desviación
    v_deviation_pct := CASE
      WHEN v_projected_balance = 0 THEN 0
      ELSE ABS(v_actual_balance - v_projected_balance) / 
           ABS(v_projected_balance) * 100
    END;
    
    -- 5. Inserta reconciliación
    INSERT INTO bank_reconciliation (
      org_id, account_id, bank_balance, projected_balance,
      deviation_pct, status, checked_at
    ) VALUES (
      v_org_id, NEW.account_id, v_actual_balance, v_projected_balance,
      v_deviation_pct,
      CASE WHEN v_deviation_pct > 10 THEN 'ALERT' ELSE 'OK' END,
      CURRENT_TIMESTAMP
    );
    
    -- 6. Si desviación > 10%: alerta
    IF v_deviation_pct > 10 THEN
      INSERT INTO alerts_rules (
        org_id, type, severity, module, message, recipient_role
      ) VALUES (
        v_org_id, 'BANK_DEVIATION', 'HIGH', 'bancocheck',
        'Desviación flujo vs banco: ' || ROUND(v_deviation_pct, 2) || '%',
        'admin'
      );
    END IF;
    
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
  ```

- [ ] Trigger `on_bank_transaction_synced`
- [ ] Función `detect_anomalies()` (optional P2)

### 3.2 Frontend (Next.js - BancoCheck Web)

#### Components
- [ ] `components/BankReconciliationStatus.tsx`
  - [ ] Status: OK vs ALERT
  - [ ] Números: saldo banco | saldo proyectado | desviación %

- [ ] `components/BankTransactionList.tsx`
  - [ ] Tabla: Fecha | RFC | Monto | Tipo

#### Pages
- [ ] Crear `pages/bancocheck/index.tsx`
  - [ ] Conectar banco (Belvo OAuth)
  - [ ] Ver últimas transacciones
  - [ ] Ver reconciliación status

- [ ] Crear `pages/bancocheck/reconciliation.tsx` (admin)
  - [ ] Gráfica: proyectado vs real (timeline)
  - [ ] Alertas desvíos históricos

#### Realtime
- [ ] Listener: bank_reconciliation changes
- [ ] Update status badge in real-time

### 3.3 Edge Functions

#### sync_belvo_transactions.ts
```typescript
export async function syncBelvoTransactions(orgId: string) {
  // 1. Obtiene bank_accounts para org
  // 2. Para cada cuenta: llamar Belvo
  // 3. Fetch transacciones últimas 2h
  // 4. INSERT en bank_transactions
  // 5. Log result
}
```

#### Deployment
```bash
supabase functions deploy sync_belvo_transactions
# Agregar Cloud Scheduler trigger c/5 min
```

### 3.4 Testing

#### Unit Tests
- [ ] Reconciliation logic (desviación calc)
- [ ] Anomaly detection algo

#### E2E
```gherkin
Feature: Banco Sync & Reconciliación
  Scenario: Belvo sincroniza, desvío calculado
    Given cash_flow_projections = $104k
    And bank_balance = $101.2k
    When sync_belvo() ejecuta
    Then bank_reconciliation.deviation_pct = 2.7%
    And status = 'OK' (< 10%)
    
  Scenario: Desvío > 10% dispara alerta
    Given deviation > 10%
    When reconcile_on_bank_sync() ejecuta
    Then INSERT alerts_rules (BANK_DEVIATION, HIGH)
```

### 3.5 Integration Config

#### .env
```env
BELVO_API_KEY=sk_live_[key]
BELVO_ORG_LINK=[link]
BANK_SYNC_INTERVAL=300  # segundos
BANK_DEVIATION_THRESHOLD=10  # %
```

---

## FASE 4: FacturaCheck ↔ BancoCheck (CFDI ↔ Transacción Matching)
**Duración:** 1.5 semanas  
**Hito:** CFDI pagada → banco reconoce transacción automáticamente  

### 4.1 Backend (Supabase)

#### Tablas
- [ ] Verificar `invoices` existe (FacturaCheck)
- [ ] Verificar `invoice_payments` existe
- [ ] Crear relación en `bank_reconciliation`: invoice_id FK

#### SQL Functions
- [ ] Función `sync_invoice_payment_to_bank()`
  ```sql
  CREATE OR REPLACE FUNCTION sync_invoice_payment_to_bank()
  RETURNS TRIGGER AS $$
  DECLARE
    v_org_id UUID;
  BEGIN
    SELECT org_id INTO v_org_id FROM invoices WHERE id = NEW.invoice_id;
    
    -- Inserta en bank_reconciliation con status PENDING
    INSERT INTO bank_reconciliation (
      org_id, invoice_id, rfc_receiver, expected_amount, expected_date, status
    ) VALUES (
      v_org_id, NEW.invoice_id, 
      (SELECT rfc_receiver FROM invoices WHERE id = NEW.invoice_id),
      NEW.amount, CURRENT_DATE,
      'PENDING_BANK_MATCH'
    );
    
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
  ```

- [ ] Trigger `on_invoice_payment_recorded`
- [ ] Función `auto_match_bank_transactions()`
  ```sql
  CREATE OR REPLACE FUNCTION auto_match_bank_transactions()
  RETURNS TABLE(matched_count INT) AS $$
  DECLARE
    v_count INT;
  BEGIN
    -- Busca transacciones bancarias que coincidan:
    -- 1. RFC receptora
    -- 2. Monto exacto
    -- 3. Fecha ±2 días
    
    UPDATE bank_reconciliation br
    SET 
      actual_bank_transaction_id = bt.id,
      actual_amount = bt.amount,
      actual_date = bt.transaction_date,
      status = 'MATCHED',
      matched_at = CURRENT_TIMESTAMP
    FROM bank_transactions bt
    WHERE br.status = 'PENDING_BANK_MATCH'
      AND br.rfc_receiver = bt.rfc_receiver
      AND ABS(br.expected_amount - bt.amount) < 1
      AND ABS(bt.transaction_date - br.expected_date) <= 2;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN QUERY SELECT v_count;
  END;
  $$ LANGUAGE plpgsql;
  ```

- [ ] Scheduled Job: `auto_match_bank_transactions()` (diario 6pm)

### 4.2 Frontend (Next.js - BancoCheck Admin)

#### Components
- [ ] `components/InvoiceMatchingStatus.tsx`
  - [ ] Tabla: CFDI | RFC | Monto | Banco Match | Status
  - [ ] Status: PENDING | MATCHED | MISMATCH

#### Pages
- [ ] Crear `pages/bancocheck/reconciliation/invoices.tsx`
  - [ ] Lista CFDI pendientes de matching
  - [ ] Filtros: date range, status
  - [ ] Manual override (si matching falla)

### 4.3 Edge Functions

#### match_invoice_to_bank.ts
```typescript
// Ejecuta diariamente 6pm para matching
export async function matchInvoiceToBank(orgId: string) {
  const { count } = await supabase.rpc('auto_match_bank_transactions', { org_id: orgId });
  
  // Log result
  console.log(`Matched ${count} invoices`);
}
```

### 4.4 Testing

#### E2E
```gherkin
Feature: CFDI ↔ Banco Matching
  Scenario: CFDI emitida + pagada → banco reconoce
    Given CFDI FAC_001 emitida: $15k a AAA123456XYZ
    When Admin registra pago en FacturaCheck
    Then bank_reconciliation INSERT (PENDING)
    
    And 4 días después: Belvo sincroniza transacción
    And transacción: RFC=AAA123456XYZ, monto=$15k, fecha±2d
    
    When auto_match_bank_transactions() cron ejecuta
    Then bank_reconciliation.status = 'MATCHED'
    And matched_at registrada
    And Notif: "CFDI FAC_001 reconciliada"
```

---

## FASE 5: FacturaCheck ↔ GastoCheck (Pólizas Contables + Exportación)
**Duración:** 1 semana  
**Hito:** CFDI emitida → póliza contable automática + export CONTPAQi  

### 5.1 Backend (Supabase)

#### Tablas
- [ ] Crear tabla `invoice_to_policy`
  ```sql
  CREATE TABLE invoice_to_policy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    invoice_id UUID NOT NULL REFERENCES invoices(id),
    policy_id UUID NOT NULL REFERENCES policies(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sat_status VARCHAR(20) DEFAULT 'PENDING',
    sat_validation_response JSONB,
    contpaq_exported BOOLEAN DEFAULT FALSE,
    contpaq_export_date TIMESTAMP,
    contpaq_reference VARCHAR(100),
    UNIQUE(invoice_id, policy_id)
  );
  ```

- [ ] Crear índices

#### SQL Functions
- [ ] Función `create_policy_from_invoice()`
  ```sql
  CREATE OR REPLACE FUNCTION create_policy_from_invoice()
  RETURNS TRIGGER AS $$
  DECLARE
    v_policy_id UUID;
    v_org_id UUID;
  BEGIN
    -- Solo para facturas validadas y pagadas
    IF NEW.sat_status = 'VALID' AND NEW.state = 'paid' THEN
      SELECT org_id INTO v_org_id FROM invoices WHERE id = NEW.id;

      -- Crea póliza contable
      INSERT INTO policies (
        org_id, date, status, total_amount, description, reference
      ) VALUES (
        v_org_id, CURRENT_DATE, 'DRAFT', NEW.amount,
        'Factura emitida: ' || NEW.folio_number,
        'CFDI_' || NEW.uuid
      ) RETURNING id INTO v_policy_id;

      -- Inserta líneas contables
      INSERT INTO policy_accounts (
        policy_id, account_number, account_name, debit, credit, description
      ) VALUES
        (v_policy_id, '1000', 'Banco', NEW.amount, 0, 'Ingreso por venta'),
        (v_policy_id, '4100', 'Ventas', 0, NEW.amount, 'Por ' || NEW.concept);

      -- Registra relación
      INSERT INTO invoice_to_policy (
        org_id, invoice_id, policy_id, sat_status
      ) VALUES (v_org_id, NEW.id, v_policy_id, 'VALIDATED');
    END IF;

    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
  ```

- [ ] Trigger `on_invoice_validated_and_paid`

#### Edge Functions
- [ ] `export_policies_to_contpaq.ts`
  ```typescript
  export async function exportPoliciesToContpaq(
    orgId: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<string> {
    // 1. SELECT invoice_to_policy donde sat_status = VALIDATED
    // 2. Formato CONTPAQi (.txt tab-separated)
    // 3. Retorna string
    // 4. UPDATE contpaq_exported = TRUE
  }
  ```

### 5.2 Frontend (Next.js - GastoCheck Admin + FacturaCheck)

#### Components
- [ ] `components/PolicyFromInvoiceIndicator.tsx`
  - [ ] Badge: "Póliza Automática (from FAC_001)"

#### Pages
- [ ] Actualizar `pages/gastocheck/admin/policies.tsx`
  - [ ] Nueva columna: "Origen" (manual | automático/CFDI)
  - [ ] Filtro: "Solo de CFDI"

- [ ] Crear `pages/facturacheck/admin/export.tsx`
  - [ ] Botón: "Exportar a CONTPAQi"
  - [ ] Date range picker
  - [ ] Download .txt file
  - [ ] Log export

#### Realtime
- [ ] Listener: policies creadas automáticamente
- [ ] Update UI cuando aparezca póliza nueva

### 5.3 Testing

#### E2E
```gherkin
Feature: CFDI → Póliza Contable
  Scenario: CFDI emitida + validada → póliza automática
    Given CFDI FAC_001: $15k, concepto "Venta de servicios"
    And sat_status = 'VALID', state = 'paid'
    
    When create_policy_from_invoice() dispara
    Then INSERT policies (description = "Factura emitida: FAC_001")
    And INSERT policy_accounts (2 líneas: Banco + Ventas)
    And INSERT invoice_to_policy (relación)
    
  Scenario: Exportar a CONTPAQi
    Given Pólizas del mes junio (10 de facturas)
    When Admin hace click "Exportar CONTPAQi"
    Then Descarga .txt con formato CONTPAQi
    And Estructura: POLIZA\tFECHA\tCONCEPTO\tCUENTA\tDEBE\tHABER
```

---

## FASE 6: Alertas Globales (CHECK SUITE)
**Duración:** 1 semana  
**Hito:** Sistema unificado de notificaciones con routing inteligente  

### 6.1 Backend (Supabase)

#### Tablas (verificar existencia)
- [ ] `alerts_rules` (INSERT de triggers + Edge Functions)
- [ ] `notifications` (para envío a usuarios)
- [ ] `notification_preferences` (configuración por rol)

#### SQL Enums
- [ ] Crear ENUM `alert_type`
  ```sql
  CREATE TYPE alert_type AS ENUM (
    'EXPENSE_APPROVED', 'EXPENSE_REJECTED',
    'COLLECTION_RECORDED', 'PAYMENT_FAILED',
    'BANK_SYNC_SUCCESS', 'BANK_SYNC_ERROR', 'BANK_DEVIATION',
    'INVOICE_CREATED', 'CFDI_VALIDATED', 'CFDI_ERROR',
    'CASHFLOW_DEFICIT', 'CASHFLOW_SURPLUS',
    'RECONCILIATION_MATCHED', 'RECONCILIATION_MISMATCH'
  );
  ```

- [ ] Crear ENUM `alert_severity`
  ```sql
  CREATE TYPE alert_severity AS ENUM ('INFO', 'WARNING', 'HIGH', 'CRITICAL');
  ```

#### Edge Function: route_alert.ts
```typescript
interface AlertPayload {
  orgId: string;
  type: string;
  severity: string;
  module: string;
  message: string;
  recipientRole: string;
  data: Record<string, any>;
}

export async function routeAlert(payload: AlertPayload) {
  // 1. Obtiene preferencias de notification_preferences
  // 2. Determina canales (push, email, in-app)
  // 3. Envía por cada canal
  // 4. Registra en alerts_rules
}
```

#### Edge Function: generate_daily_digest.ts
```typescript
// Ejecuta 8am UTC-6 (Cloud Scheduler)
// Agrega alertas últimas 24h
// Genera email HTML
// Envía a admins/supervisores
```

### 6.2 Frontend (Next.js - FlujoCheck + GastoCheck + BancoCheck)

#### Components
- [ ] `components/NotificationBell.tsx`
  - [ ] Badge count (unread alerts)
  - [ ] Dropdown: últimas 5 alertas
  - [ ] Click → página alertas completa

- [ ] `components/AlertsList.tsx`
  - [ ] Tabla: Tiempo | Severidad | Módulo | Mensaje
  - [ ] Colores: CRITICAL (rojo) | HIGH (naranja) | etc.
  - [ ] Filtros: module, severity, date range

- [ ] `components/NotificationPreferences.tsx`
  - [ ] Checkboxes: push notifications, email digest
  - [ ] Hora daily digest
  - [ ] Severidad threshold

#### Pages
- [ ] Crear `pages/alerts/index.tsx`
  - [ ] Todos los alerts con paginación
  - [ ] Mark as read
  - [ ] Filtros avanzados

- [ ] Crear `pages/settings/notifications.tsx`
  - [ ] Preferences UI

#### Realtime
- [ ] Listener: alerts_rules (nuevas alertas)
  ```typescript
  supabase
    .channel('alerts')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'alerts_rules',
      filter: `org_id=eq.${orgId}`
    }, handleNewAlert)
    .subscribe();
  ```

### 6.3 Notificaciones por Canal

#### In-app (Supabase INSERT)
- [ ] Automático vía INSERT notifications

#### Push Notifications (Expo/OneSignal)
- [ ] Integración Expo PushNotifications
- [ ] O integración OneSignal
- [ ] Solo CRITICAL + HIGH (configurable)

#### Email (Resend)
- [ ] Integración Resend
- [ ] Template: daily digest
- [ ] Scheduled: 8am UTC-6

#### SMS/WhatsApp (Twilio)
- [ ] Optional P2
- [ ] Solo CRITICAL (configurar)

### 6.4 Testing

#### Unit Tests
```typescript
describe('routeAlert', () => {
  test('CRITICAL severity → push + email', async () => {
    // Mock alert CRITICAL
    // Assert push sent
    // Assert email sent
  });

  test('INFO severity → in-app only', async () => {
    // Mock alert INFO
    // Assert only INSERT notifications
  });
});
```

#### E2E
```gherkin
Feature: Alertas Globales
  Scenario: Cashflow deficit alert
    Given flujo semanal < $10k
    When check_cashflow_deficit() ejecuta
    Then INSERT alerts_rules (CASHFLOW_DEFICIT, HIGH)
    And route_alert() envía push
    And Admin recibe notificación mobile
    
  Scenario: Daily digest email
    When cron 8am ejecuta
    Then generate_daily_digest()
    And Envía email con resumen 24h
```

---

## FASE 7: Testing Integrado (Todas las fases)
**Duración:** 2 días (paralelo con Phase 6 final)  
**Hito:** E2E testing completo  

### 7.1 Escenarios E2E

```gherkin
Feature: Ciclo Completo GastoCheck → FlujoCheck → BancoCheck → Alertas
  Scenario: Gasto aprobado dispara alertas en flujo
    Given Organización con $100k flujo semanal
    And Umbral alerta: $10k
    
    When Comprador crea gasto $95k
    And Supervisor aprueba
    
    Then FlujoCheck: balance proyectado = $5k
    And ALERTA: CASHFLOW_DEFICIT (HIGH)
    And Admin recibe push notification
    And In-app badge updated
    
  Scenario: Cobro registrado actualiza confianza + flujo
    Given Cliente ABC: confidence = 70%, $288k acumulado
    
    When Cobrador registra cobro $12k
    Then payment_confidence actualizado: 85%
    And cash_flow_projections: +$12k ingreso
    And FlujoCheck: ponderación cliente = +3%
    
  Scenario: CFDI → Póliza → BancoCheck → Reconciliación
    Given CFDI: $15k a AAA123456XYZ
    And Banco saldo actual: $100k
    
    When Admin emite CFDI
    Then CREATE policy automática
    And cash_flow_projections: esperado $115k
    
    And 4 días: Belvo sincroniza $15k
    Then auto_match_bank_transactions()
    And bank_reconciliation: MATCHED
    And Notif: "CFDI FAC_001 reconciliada"
    
    And Admin exporta CONTPAQi
    Then Descarga .txt con pólizas
```

### 7.2 Performance Testing
- [ ] Latencia trigger < 100ms
- [ ] Realtime listener < 1s
- [ ] Edge Function < 500ms
- [ ] Daily digest < 5s

### 7.3 Load Testing
- [ ] 1000 gastos aprobados en 1 min
- [ ] 500 cobros registrados en 1 min
- [ ] 100 banco transactions sync

---

## RESUMEN FINAL (Checklist Master)

### Pre-Implementation
- [ ] Clonar repositorio + setup local
- [ ] Supabase project configurado
- [ ] Environment variables .env
- [ ] Belvo credentials configurados
- [ ] FACTUROO credentials configurados
- [ ] Resend API key (email)

### Phase 1 ✓ GastoCheck ↔ FlujoCheck
- [ ] SQL migrations deploy
- [ ] Edge Functions deploy
- [ ] Frontend components + pages
- [ ] RLS policies
- [ ] Unit + E2E tests
- [ ] Documentación actualizada

### Phase 2 ✓ CobraCheck ↔ FlujoCheck
- [ ] payment_confidence table + functions
- [ ] Confianza score formula
- [ ] Frontend UI components
- [ ] Realtime listeners
- [ ] Tests
- [ ] Docs

### Phase 3 ✓ BancoCheck ↔ FlujoCheck
- [ ] Belvo API integration
- [ ] Bank sync Edge Function
- [ ] Reconciliation logic
- [ ] Alerts on deviation > 10%
- [ ] Frontend BancoCheck module
- [ ] Tests

### Phase 4 ✓ FacturaCheck ↔ BancoCheck
- [ ] Invoice payment → bank_reconciliation
- [ ] Auto-matching RFC + monto + fecha
- [ ] Scheduled job (6pm daily)
- [ ] Frontend matching UI
- [ ] Tests

### Phase 5 ✓ FacturaCheck ↔ GastoCheck
- [ ] invoice_to_policy table
- [ ] Póliza automática creation
- [ ] CONTPAQi export function
- [ ] Frontend export UI
- [ ] Tests

### Phase 6 ✓ Alertas Globales
- [ ] alert_type + alert_severity enums
- [ ] route_alert Edge Function
- [ ] daily_digest generator
- [ ] Push notifications integration
- [ ] Email integration (Resend)
- [ ] NotificationBell + AlertsList components
- [ ] notification_preferences UI
- [ ] Tests

### Phase 7 ✓ Testing Integrado
- [ ] E2E scenarios todos
- [ ] Performance benchmarks
- [ ] Load testing
- [ ] Staging deployment

### Post-Implementation
- [ ] Producción deployment
- [ ] Monitoring setup (CloudWatch)
- [ ] Rollback procedures documentados
- [ ] User training videos
- [ ] Incident response procedures
- [ ] SLA documentation

---

## NOTAS IMPORTANTES

1. **Parallelización:** Fases 1-2 pueden correr paralelo con fase 3.
2. **Rollback:** Cada fase tiene plan de rollback independiente.
3. **Testing:** NO saltarse E2E, son críticos para integración.
4. **Performance:** Triggers SQL < 100ms es requisito.
5. **Monitoring:** Desde Day 1 en staging.
6. **Comunicación:** Daily standup Juan + Daniel.

---

**Documento:** CHECK SUITE Implementation Checklist  
**Última Actualización:** 2026-07-05  
**Próxima Revisión:** 2026-07-12 (Post Phase 1)  
