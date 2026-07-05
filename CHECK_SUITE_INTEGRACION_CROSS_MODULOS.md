# CHECK SUITE — Documento de Integración Cross-Módulos

**Versión:** 1.0  
**Fecha:** 2026-07-05  
**Autor:** Juan (Diseño Lógica)  
**Estado:** Especificación de Integración  

---

## I. VISIÓN GENERAL

CHECK SUITE es una plataforma integrada de 5 módulos (GastoCheck, CobraCheck, BancoCheck, FacturaCheck, FlujoCheck) que convergen en un único flujo de datos fiscal y financiero. Este documento define:

1. **Flujos de datos** entre módulos (6 integraciones críticas)
2. **Eventos y triggers** que disparan acciones en módulos dependientes
3. **Esquema de notificaciones** (real-time, digest, críticas)
4. **Reconciliación y consistencia** de datos
5. **Permisos y visibilidad** por rol (Comprador/Cobrador/Admin)

---

## II. ARQUITECTURA DE INTEGRACIÓN

### 2.1 Datos Compartidos (Single Source of Truth)

Todos los módulos leen/escriben en las mismas tablas Supabase:

```
Supabase PostgreSQL (Unified Schema)
├── auth_users (JWT, roles)
├── organizations (empresa)
├── org_settings (configuración global)
│
├── [GastoCheck]
│   ├── expenses
│   ├── expense_items
│   ├── policies
│   ├── policy_accounts
│   └── expense_attachments
│
├── [CobraCheck]
│   ├── credits
│   ├── daily_routes
│   ├── route_stops
│   ├── collection_logs
│   ├── payment_confidence (confiabilidad)
│   └── customer_history
│
├── [BancoCheck]
│   ├── bank_accounts
│   ├── bank_transactions
│   ├── bank_reconciliation
│   └── transaction_anomalies
│
├── [FacturaCheck]
│   ├── invoices (CFDI)
│   ├── invoice_items
│   ├── invoice_payments
│   ├── invoice_attachments
│   └── pac_logs (FACTUROO)
│
├── [FlujoCheck]
│   ├── cash_flow_projections
│   ├── flow_scenarios
│   ├── flow_alerts
│   └── confidence_weights
│
├── [Global]
│   ├── audit_logs (eventos sistema)
│   ├── notifications (inbox usuario)
│   ├── notification_preferences (suscripción)
│   └── alerts_rules (reglas dinámicas)
```

**Principio Clave:** No hay replicación de datos. Las integraciones usan triggers Postgres + Edge Functions + Realtime Listeners.

---

## III. FLUJOS DE INTEGRACIÓN

### 3.1 FLUJO 1: GastoCheck ↔ FlujoCheck (Egresos)

**Descripción:** Cada gasto registrado automáticamente se proyecta en el flujo de caja.

#### 3.1.1 Trigger

```sql
-- Tabla: expenses
-- Evento: INSERT / UPDATE (cuando state = 'approved')

CREATE OR REPLACE FUNCTION sync_expense_to_cashflow()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo procesa gastos aprobados
  IF NEW.state = 'approved' AND NEW.state != OLD.state THEN
    -- 1. Inserta en cash_flow_projections
    INSERT INTO cash_flow_projections (
      org_id,
      module,
      amount,
      date,
      type,
      description,
      source_id,
      status
    ) VALUES (
      NEW.org_id,
      'gastocheck',
      -ABS(NEW.amount),  -- Egreso (negativo)
      NEW.payment_date,
      'expense',
      NEW.description,
      NEW.id,
      'projected'
    );

    -- 2. Valida déficit de flujo
    PERFORM check_cashflow_deficit(NEW.org_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_expense_approved
  AFTER INSERT OR UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION sync_expense_to_cashflow();
```

#### 3.1.2 Flow Detallado

```
┌─────────────────────────────────────────────────────────────┐
│ COMPRADOR registra Gasto en GastoCheck                      │
│ • Monto: $5,000 MXN                                          │
│ • Fecha Pago: 2026-07-10                                     │
│ • Estado: DRAFT → SUBMITTED → APPROVED (por Supervisor)      │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
        ┌─────────────────┐
        │  Trigger Fires  │
        │ on_approved     │
        └────────┬────────┘
                 │
         ┌───────┴───────┐
         ▼               ▼
   ┌──────────┐   ┌──────────────────────┐
   │ Inserta  │   │ Valida Déficit       │
   │ en Flow  │   │ cash_flow_deficit()  │
   │ Proyect. │   │                      │
   └──────────┘   └──────────────────────┘
         │               │
         ▼               ▼
   FlujoCheck      Alert: Deficit
   actualiza       > 10% de flujo
   semanal         semanal


RESULTADO EN FLUJOCHECK:
├─ Lunes 2026-07-07: Inicio $100,000
├─ Miércoles 2026-07-09: -$5,000 (Gasto STATIX aprobado)
├─ Viernes 2026-07-11: $95,000 (proyectado)
└─ [ALERTA] Si Déficit > umbral: notifica Admin
```

#### 3.1.3 Validación de Capacidad de Pago

```typescript
// Edge Function: check_cashflow_deficit()
async function checkCashflowDeficit(orgId: string): Promise<void> {
  const { data: projections } = await supabase
    .from('cash_flow_projections')
    .select('*')
    .eq('org_id', orgId)
    .order('date', { ascending: true });

  const nextWeek = projections.filter(p => 
    p.date >= today && p.date <= today + 7
  );

  const balance = nextWeek.reduce((sum, p) => sum + p.amount, 0);

  // Alerta si flujo < $10,000 MXN (umbral configurable)
  if (balance < 10000) {
    await notifyAdmin(orgId, {
      type: 'CASHFLOW_DEFICIT',
      message: `Flujo semanal: $${balance}. Posible déficit.`,
      severity: 'HIGH',
      module: 'flujocheck'
    });
  }
}
```

#### 3.1.4 Datos de Ejemplo

| Módulo | Evento | Campo | Valor |
|--------|--------|-------|-------|
| GastoCheck | Gasto Aprobado | ID | exp_12345 |
| | | Monto | -5,000 MXN |
| | | Fecha | 2026-07-10 |
| | | Póliza | POL_JUNIO |
| FlujoCheck | Proyección Creada | ID | flow_proj_456 |
| | | Tipo | expense |
| | | Estado | projected |
| Notificaciones | Alerta Déficit | Severidad | HIGH |
| | | Destinatario | Admin (contador_general) |

---

### 3.2 FLUJO 2: CobraCheck ↔ FlujoCheck (Ingresos + Confiabilidad)

**Descripción:** Cada cobro registrado se proyecta como ingreso y actualiza la confiabilidad del cliente.

#### 3.2.1 Trigger

```sql
-- Tabla: collection_logs
-- Evento: INSERT (cuando status = 'collected')

CREATE OR REPLACE FUNCTION sync_collection_to_cashflow()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo procesa cobros exitosos
  IF NEW.status = 'collected' THEN
    -- 1. Inserta ingreso en cash_flow_projections
    INSERT INTO cash_flow_projections (
      org_id,
      module,
      amount,
      date,
      type,
      description,
      source_id,
      status
    ) VALUES (
      NEW.org_id,
      'cobracheck',
      ABS(NEW.amount),  -- Ingreso (positivo)
      CURRENT_DATE,
      'income',
      'Cobro de ' || NEW.customer_name,
      NEW.id,
      'actual'  -- Ingreso registrado, no proyectado
    );

    -- 2. Actualiza confiabilidad del cliente
    UPDATE payment_confidence SET
      total_collections = total_collections + 1,
      total_amount_collected = total_amount_collected + NEW.amount,
      confidence_score = calculate_confidence(
        total_collections + 1,
        missed_payments,
        total_amount_collected + NEW.amount
      ),
      last_payment_date = CURRENT_DATE
    WHERE customer_id = NEW.customer_id;

    -- 3. Notifica FlujoCheck si hay cambio en confiabilidad
    PERFORM notify_flow_confidence_update(
      NEW.org_id,
      NEW.customer_id,
      NEW.amount
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_collection_completed
  AFTER INSERT ON collection_logs
  FOR EACH ROW
  EXECUTE FUNCTION sync_collection_to_cashflow();
```

#### 3.2.2 Flow Detallado

```
┌──────────────────────────────────────────┐
│ COBRADOR registra Cobro en CobraCheck    │
│ • Cliente: ABC Corp                       │
│ • Monto: $12,000 MXN                      │
│ • Método: Transferencia                   │
│ • Estado: COLLECTED                       │
└──────────────┬──────────────────────────┘
               │
               ▼
       ┌─────────────────┐
       │  Trigger Fires  │
       │ on_collected    │
       └────────┬────────┘
               │
         ┌─────┴──────────┬────────────────┐
         ▼                ▼                ▼
   ┌──────────┐   ┌─────────────┐   ┌──────────────┐
   │ Inserta  │   │ Actualiza   │   │ Notifica     │
   │ Ingreso  │   │ Confiab.    │   │ FlujoCheck   │
   │ en Flow  │   │ Cliente     │   │ (cambio%)    │
   └──────────┘   └─────────────┘   └──────────────┘
         │                │               │
         ▼                ▼               ▼
   FlujoCheck      Payment          Flow Ajusta
   +$12,000        Confidence       ponderación
   actual          78% → 85%        cliente ABC


CONFIABILIDAD EN TIEMPO REAL:
┌─────────────────────────────────────────────────┐
│ Cliente: ABC Corp                               │
│ Cobros Totales: 24                              │
│ Monto Acumulado: $288,000 MXN                   │
│ Pagos Fallidos: 2 (últimos 6 meses)             │
│ Confiabilidad Score: 85% → 87% (post-cobro)    │
│ Última Pago: 2026-07-05                         │
│                                                 │
│ FlujoCheck ajusta peso:                         │
│ • Cobros futuros de ABC = +3% confianza        │
│ • Si score > 90%: descuento en línea crédito   │
└─────────────────────────────────────────────────┘
```

#### 3.2.3 Confidence Score Formula

```typescript
function calculateConfidenceScore(
  totalCollections: number,
  missedPayments: number,
  totalAmountCollected: number,
  avgPaymentDays: number
): number {
  // Base: porcentaje de pagos exitosos
  const successRate = (totalCollections - missedPayments) / totalCollections;
  
  // Ajuste: promedio de días para pagar
  const timelinessFactor = avgPaymentDays <= 15 ? 1.1 : 
                          avgPaymentDays <= 30 ? 1.0 : 0.9;
  
  // Ajuste: volumen (cliente grande = más confiable)
  const volumeFactor = totalAmountCollected >= 100000 ? 1.05 : 1.0;
  
  const score = Math.min(100, successRate * 100 * timelinessFactor * volumeFactor);
  
  return Math.round(score);
}
```

#### 3.2.4 Datos de Ejemplo

| Módulo | Evento | Campo | Valor |
|--------|--------|-------|-------|
| CobraCheck | Cobro Registrado | ID | col_98765 |
| | | Monto | +12,000 MXN |
| | | Cliente | ABC Corp |
| | | Fecha | 2026-07-05 |
| Payment Confidence | Actualización | Score Previo | 78% |
| | | Score Nuevo | 85% |
| | | Cambio | +7% |
| FlujoCheck | Actualización Confianza | Ponderación | +3% |

---

### 3.3 FLUJO 3: BancoCheck ↔ FlujoCheck (Reconciliación Real-time)

**Descripción:** Saldos reales de banco validan proyecciones de flujo. Alertas si desvío > 10%.

#### 3.3.1 Arquitectura

```
BancoCheck Connector (Belvo/BBVA API)
          │
          ▼
┌─────────────────────────────┐
│ bank_transactions           │
│ (Sync automático c/5 min)   │
└──────────┬──────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│ Edge Function:                       │
│ reconcile_bank_vs_projection()       │
│                                      │
│ • Lee cash_flow_projections         │
│ • Compara vs bank_balance actual    │
│ • Calcula desviación %              │
│ • Si > 10%: genera alerta           │
└──────────┬───────────────────────────┘
           │
      ┌────┴────┐
      ▼         ▼
  ✓ OK    ⚠️ ALERTA
  Sync    Desvío
  Real    > 10%
```

#### 3.3.2 Trigger de Reconciliación

```sql
-- Tabla: bank_transactions
-- Evento: INSERT (nueva transacción sincronizada)

CREATE OR REPLACE FUNCTION reconcile_on_bank_sync()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id UUID;
  v_projected_balance NUMERIC;
  v_actual_balance NUMERIC;
  v_deviation_pct NUMERIC;
BEGIN
  -- 1. Obtiene organización desde bank_account
  SELECT org_id INTO v_org_id
  FROM bank_accounts
  WHERE id = NEW.account_id;

  -- 2. Calcula balance proyectado (FlujoCheck)
  SELECT COALESCE(SUM(amount), 0) INTO v_projected_balance
  FROM cash_flow_projections
  WHERE org_id = v_org_id
    AND date <= CURRENT_DATE
    AND status IN ('projected', 'actual');

  -- 3. Obtiene balance actual de banco
  SELECT COALESCE(SUM(amount), 0) INTO v_actual_balance
  FROM bank_transactions
  WHERE account_id = NEW.account_id
    AND transaction_date <= CURRENT_DATE;

  -- 4. Calcula desviación
  v_deviation_pct := ABS(v_actual_balance - v_projected_balance) / 
                     NULLIF(v_projected_balance, 0) * 100;

  -- 5. Crea registro de reconciliación
  INSERT INTO bank_reconciliation (
    org_id,
    account_id,
    bank_balance,
    projected_balance,
    deviation_pct,
    status,
    checked_at
  ) VALUES (
    v_org_id,
    NEW.account_id,
    v_actual_balance,
    v_projected_balance,
    v_deviation_pct,
    CASE WHEN v_deviation_pct > 10 THEN 'ALERT' ELSE 'OK' END,
    CURRENT_TIMESTAMP
  );

  -- 6. Si desviación > 10%: alerta
  IF v_deviation_pct > 10 THEN
    INSERT INTO alerts_rules (
      org_id,
      type,
      severity,
      module,
      message,
      data
    ) VALUES (
      v_org_id,
      'BANK_DEVIATION',
      'HIGH',
      'bancocheck',
      'Desviación flujo vs banco: ' || ROUND(v_deviation_pct, 2) || '%',
      jsonb_build_object(
        'bank_balance', v_actual_balance,
        'projected_balance', v_projected_balance,
        'deviation_pct', v_deviation_pct,
        'account_id', NEW.account_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_bank_transaction_synced
  AFTER INSERT ON bank_transactions
  FOR EACH ROW
  EXECUTE FUNCTION reconcile_on_bank_sync();
```

#### 3.3.3 Flow Detallado

```
Belvo API (Sync c/5 min)
    │
    ▼
┌─────────────────────────────┐
│ BancoCheck                  │
│ Transacción: -$3,000        │
│ Tipo: Compra tarjeta        │
│ Fecha: 2026-07-05 14:35     │
└──────────┬──────────────────┘
           │ INSERT bank_transactions
           ▼
    Trigger Fires
           │
      ┌────┴───────┬──────────┐
      │            │          │
      ▼            ▼          ▼
 Inserta    Reconcilia  ¿Alerta?
 en tabla   vs Flujo


COMPARACIÓN:
┌─────────────────────────────────────────────┐
│ FlujoCheck (Proyectado)                      │
│ • Inicio semana: $100,000                    │
│ • Gastos registrados: -$8,000                │
│ • Cobros registrados: +$12,000               │
│ • Proyectado: $104,000                       │
│                                              │
│ BancoCheck (Real)                            │
│ • Saldo cuenta actual: $101,200              │
│                                              │
│ Desviación: |$104,000 - $101,200| = $2,800  │
│ Porcentaje: 2.7% (< 10%) → OK ✓             │
│                                              │
│ [Si 2.7% > 10%]:                             │
│ ALERTA: "Flujo real diverge de proyectado"  │
│ Posibles causas:                             │
│ • Gastos no registrados en GastoCheck       │
│ • Cobros pendientes no conciliados          │
│ • Transacciones intermedias banco           │
└─────────────────────────────────────────────┘
```

#### 3.3.4 Datos de Ejemplo

| Módulo | Campo | Valor |
|--------|-------|-------|
| BancoCheck | Saldo Actual | $101,200 MXN |
| FlujoCheck | Proyectado | $104,000 MXN |
| Reconciliación | Desviación | 2.7% |
| | Status | OK |
| | Última Sync | 2026-07-05 14:35 |

---

### 3.4 FLUJO 4: FacturaCheck ↔ BancoCheck (Matching CFDI ↔ Transacción)

**Descripción:** CFDI pagada genera transacción en BancoCheck. Matching automático y reconciliación.

#### 3.4.1 Trigger

```sql
-- Tabla: invoice_payments
-- Evento: INSERT (pago registrado en CFDI)

CREATE OR REPLACE FUNCTION sync_invoice_payment_to_bank()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id UUID;
  v_invoice_record RECORD;
BEGIN
  -- 1. Obtiene detalles de la factura
  SELECT 
    org_id, 
    rfc_receiver, 
    amount,
    payment_due_date
  INTO v_invoice_record
  FROM invoices
  WHERE id = NEW.invoice_id;

  -- 2. Crea entrada "esperada" en bank_reconciliation
  -- (será matcheada cuando banco reporte transacción)
  INSERT INTO bank_reconciliation (
    org_id,
    invoice_id,
    rfc_receiver,
    expected_amount,
    expected_date,
    status,
    description
  ) VALUES (
    v_invoice_record.org_id,
    NEW.invoice_id,
    v_invoice_record.rfc_receiver,
    NEW.amount,
    CURRENT_DATE,
    'PENDING_BANK_MATCH',
    'Esperando transacción banco - CFDI: ' || NEW.invoice_id
  );

  -- 3. Notifica BancoCheck de transacción esperada
  INSERT INTO notifications (
    org_id,
    type,
    module,
    message,
    recipient_role,
    data
  ) VALUES (
    v_invoice_record.org_id,
    'INVOICE_PAID',
    'bancocheck',
    'Pago de CFDI registrado. Esperando reconciliación bancaria.',
    'admin',
    jsonb_build_object(
      'invoice_id', NEW.invoice_id,
      'amount', NEW.amount,
      'payment_method', NEW.payment_method
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_invoice_payment_recorded
  AFTER INSERT ON invoice_payments
  FOR EACH ROW
  EXECUTE FUNCTION sync_invoice_payment_to_bank();
```

#### 3.4.2 Matching Automático

```sql
-- Busca transacciones del banco que coincidan con pagos esperados
CREATE OR REPLACE FUNCTION auto_match_bank_transactions()
RETURNS TABLE(matched_count INT, unmatched_count INT) AS $$
DECLARE
  v_matched INT := 0;
  v_unmatched INT := 0;
BEGIN
  -- Matching por:
  -- 1. RFC del receptor
  -- 2. Monto exacto
  -- 3. Fecha dentro de 2 días

  UPDATE bank_reconciliation AS br
  SET 
    actual_bank_transaction_id = bt.id,
    actual_amount = bt.amount,
    actual_date = bt.transaction_date,
    status = 'MATCHED',
    matched_at = CURRENT_TIMESTAMP
  FROM bank_transactions bt
  WHERE br.status = 'PENDING_BANK_MATCH'
    AND br.rfc_receiver = bt.rfc_receiver  -- RFC coincide
    AND ABS(br.expected_amount - bt.amount) < 1  -- Monto exacto (cent)
    AND ABS(bt.transaction_date - br.expected_date) <= 2  -- Fecha ±2 días
  RETURNING 1 INTO v_matched;

  v_matched := COALESCE(v_matched, 0);

  -- Cuenta no coincididas
  SELECT COUNT(*) INTO v_unmatched
  FROM bank_reconciliation
  WHERE status = 'PENDING_BANK_MATCH'
    AND expected_date + INTERVAL '3 days' < CURRENT_DATE;

  RETURN QUERY SELECT v_matched, v_unmatched;
END;
$$ LANGUAGE plpgsql;
```

#### 3.4.3 Flow Detallado

```
┌────────────────────────────────┐
│ FacturaCheck                   │
│ Factura: FAC_001               │
│ RFC Cliente: AAA123456XYZ      │
│ Monto: $15,000 MXN             │
│ Emitida: 2026-07-01            │
│ Estado: PAID (pago registrado)  │
└────────────┬────────────────────┘
             │
             ▼
      ┌──────────────┐
      │ Trigger Fire │
      │ on_payment   │
      └──────┬───────┘
             │
         ┌───┴──────────┬──────────────┐
         ▼              ▼              ▼
   Inserta        Notifica       Bandera
   en banco_      BancoCheck    "Esperando
   reconciliation "Nueva pago"   Transacción"
   (PENDING)


4 DÍAS DESPUÉS...
Belvo API Sync (c/5 min)
         │
         ▼
┌───────────────────────────────┐
│ BancoCheck                    │
│ Transacción Nueva             │
│ Origen: AAA123456XYZ (RFC)    │
│ Monto: $15,000                │
│ Fecha: 2026-07-04             │
│ Tipo: Transferencia enviada   │
└───────────┬───────────────────┘
            │
            ▼
      Matching Automático
            │
      ┌─────┴──────┐
      ▼            ▼
   ✓ MATCH      ✗ NO MATCH
   RFC +       (diferente RFC
   Monto +     o monto)
   Fecha OK
            │
            ▼
   UPDATE bank_reconciliation
   status = 'MATCHED'
            │
            ▼
   Notif: "CFDI FAC_001 reconciliada"
   FlujoCheck: Marca ingreso como
   'actual' (no proyectado)


RESULTADO EN FLUJOCHECK:
┌─────────────────────────────────────────┐
│ Transacción FAC_001                     │
│ Tipo: Ingreso (CFDI pagada)             │
│ Monto: +$15,000 MXN                     │
│ Fecha: 2026-07-04                       │
│ Estado: 'actual' (matching bancario ✓)  │
│ Confianza: 100% (reconciliada)          │
└─────────────────────────────────────────┘
```

#### 3.4.4 Datos de Ejemplo

| Módulo | Evento | Campo | Valor |
|--------|--------|-------|-------|
| FacturaCheck | CFDI Pagada | ID | FAC_001 |
| | | RFC Cliente | AAA123456XYZ |
| | | Monto | $15,000 MXN |
| | | Fecha Emisión | 2026-07-01 |
| Bank Reconciliation | Esperado | Status | PENDING_BANK_MATCH |
| | | Expected Amount | $15,000 |
| BancoCheck | Transacción Real | RFC | AAA123456XYZ |
| | | Monto | $15,000 |
| | | Fecha | 2026-07-04 |
| Bank Reconciliation | Matched | Status | MATCHED |
| | | Matched At | 2026-07-04 10:15 |

---

### 3.5 FLUJO 5: FacturaCheck ↔ GastoCheck (Trazabilidad SAT)

**Descripción:** Facturas emitidas = pólizas contables. Exportación CONTPAQi automática.

#### 3.5.1 Relación Bidireccional

```
┌───────────────────────┬───────────────────────┐
│   FacturaCheck        │    GastoCheck         │
├───────────────────────┼───────────────────────┤
│ Facturas EMITIDAS     │ Pólizas CONTABLES     │
│ (Salida de dinero)    │ (Registro contable)   │
├───────────────────────┼───────────────────────┤
│ • RFC Emisor = Org    │ • Póliza = Factura    │
│ • RFC Receptor = Cli  │ • Concepto = Línea    │
│ • CFDI XML registr.   │ • Monto = Total       │
│ • SAT validado        │ • Ref SAT = Folio     │
│ • Forma pago SAT      │ • Cuenta bancaria     │
└───────────────────────┴───────────────────────┘

FLUJO DE DATOS:
FacturaCheck (Emisión)
       │
       ├─ RFC + Monto + Concepto
       │
       ▼
GastoCheck (Póliza Contable)
       │
       ├─ Poliza: POL_JULIO_001
       ├─ Concepto: Por venta de [producto]
       ├─ Monto: $15,000 MXN
       ├─ Referencia SAT: UUID CFDI
       └─ Cuenta: 4100 (Ventas)
       │
       ▼
Exportación CONTPAQi
       │
       └─ Archivo .txt importable
```

#### 3.5.2 Tabla de Mapeo

```sql
-- Nueva tabla de relación: invoice_to_policy
CREATE TABLE invoice_to_policy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  policy_id UUID NOT NULL REFERENCES policies(id),
  
  -- Datos de sincronización
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  synced_at TIMESTAMP,
  
  -- Estado de reconciliación SAT
  sat_status VARCHAR(20) DEFAULT 'PENDING',  -- PENDING, VALIDATED, ERROR
  sat_validation_response JSONB,
  
  -- Exportación CONTPAQi
  contpaq_exported BOOLEAN DEFAULT FALSE,
  contpaq_export_date TIMESTAMP,
  contpaq_reference VARCHAR(100),
  
  UNIQUE(invoice_id, policy_id)
);

-- Trigger: Crear póliza contable automáticamente
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
      org_id,
      date,
      status,
      total_amount,
      description,
      reference
    ) VALUES (
      v_org_id,
      CURRENT_DATE,
      'DRAFT',
      NEW.amount,
      'Factura emitida: ' || NEW.folio_number,
      'CFDI_' || NEW.uuid
    ) RETURNING id INTO v_policy_id;

    -- Inserta línea de póliza
    INSERT INTO policy_accounts (
      policy_id,
      account_number,
      account_name,
      debit,
      credit,
      description
    ) VALUES
      (v_policy_id, '1000', 'Banco', NEW.amount, 0, 'Ingreso por venta'),
      (v_policy_id, '4100', 'Ventas', 0, NEW.amount, 'Por ' || NEW.concept);

    -- Registra relación
    INSERT INTO invoice_to_policy (
      org_id,
      invoice_id,
      policy_id,
      sat_status
    ) VALUES (v_org_id, NEW.id, v_policy_id, 'VALIDATED');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_invoice_validated_and_paid
  AFTER UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION create_policy_from_invoice();
```

#### 3.5.3 Exportación CONTPAQi

```typescript
// Edge Function: export_policies_to_contpaq()
async function exportPoliciesToContpaq(
  orgId: string,
  dateFrom: Date,
  dateTo: Date
): Promise<string> {
  // 1. Obtiene todas las pólizas de facturas en rango
  const { data: invoicePolicies } = await supabase
    .from('invoice_to_policy')
    .select(`
      invoice_id,
      policy_id,
      invoices(folio_number, amount, concept, rfc_receiver),
      policies(id, date, policy_accounts(*))
    `)
    .eq('org_id', orgId)
    .gte('created_at', dateFrom.toISOString())
    .lte('created_at', dateTo.toISOString())
    .eq('sat_status', 'VALIDATED');

  // 2. Formatea para CONTPAQi (.txt tab-separated)
  let contpaqContent = `POLIZA\tFECHA\tCONCEPTO\tCUENTA\tDEBE\tHABER\tREFERENCIA_SAT\n`;

  invoicePolicies.forEach(rel => {
    const invoice = rel.invoices;
    const policy = rel.policies;

    policy.policy_accounts.forEach(line => {
      contpaqContent += [
        `POL_${invoice.folio_number}`,
        policy.date,
        invoice.concept,
        line.account_number,
        line.debit || '',
        line.credit || '',
        invoice.rfc_receiver
      ].join('\t') + '\n';
    });
  });

  // 3. Marca como exportado
  for (const rel of invoicePolicies) {
    await supabase
      .from('invoice_to_policy')
      .update({
        contpaq_exported: true,
        contpaq_export_date: new Date()
      })
      .eq('id', rel.id);
  }

  return contpaqContent;
}
```

#### 3.5.4 Datos de Ejemplo

| Módulo | Campo | Valor |
|--------|-------|-------|
| FacturaCheck | Factura ID | FAC_001 |
| | Folio | FAC_2026_001 |
| | RFC Receptor | AAA123456XYZ |
| | Monto | $15,000 MXN |
| | Concepto | Venta de servicios |
| | SAT Status | VALID |
| GastoCheck | Póliza ID | POL_JULIO_001 |
| | Fecha | 2026-07-04 |
| | Descripción | Factura emitida: FAC_2026_001 |
| | Referencia | CFDI_[UUID] |
| | Línea 1 | Banco (D: 15,000) |
| | Línea 2 | Ventas (H: 15,000) |
| CONTPAQi Export | Formato | .txt tab-separated |
| | Generada | 2026-07-05 |

---

### 3.6 FLUJO 6: Alertas Globales (CHECK SUITE)

**Descripción:** Sistema centralizado de notificaciones críticas, digests y real-time listeners.

#### 3.6.1 Tipos de Alertas

```sql
CREATE TYPE alert_type AS ENUM (
  -- GastoCheck
  'EXPENSE_APPROVED',
  'EXPENSE_REJECTED',
  'POLICY_SUBMITTED',
  
  -- CobraCheck
  'COLLECTION_RECORDED',
  'CUSTOMER_CONFIDENCE_CHANGE',
  'PAYMENT_FAILED',
  
  -- BancoCheck
  'BANK_SYNC_SUCCESS',
  'BANK_SYNC_ERROR',
  'BANK_DEVIATION',
  'ANOMALY_DETECTED',
  
  -- FacturaCheck
  'INVOICE_CREATED',
  'INVOICE_PAID',
  'CFDI_VALIDATED',
  'CFDI_ERROR',
  
  -- FlujoCheck
  'CASHFLOW_DEFICIT',
  'CASHFLOW_SURPLUS',
  
  -- Cross-Module
  'RECONCILIATION_MATCHED',
  'RECONCILIATION_MISMATCH'
);

CREATE TYPE alert_severity AS ENUM ('INFO', 'WARNING', 'HIGH', 'CRITICAL');

CREATE TABLE alerts_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  
  type alert_type NOT NULL,
  severity alert_severity NOT NULL,
  module VARCHAR(20),  -- gastocheck, cobracheck, bancocheck, etc.
  
  message TEXT NOT NULL,
  description TEXT,
  
  data JSONB,  -- Contexto adicional
  
  recipient_role VARCHAR(50),  -- admin, contador_general, cobrador, etc.
  
  -- Preferencias de notificación
  send_realtime BOOLEAN DEFAULT TRUE,
  send_daily_digest BOOLEAN DEFAULT TRUE,
  send_push BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  triggered_at TIMESTAMP
);
```

#### 3.6.2 Tabla de Notificaciones

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  
  user_id UUID REFERENCES auth_users(id),
  
  type alert_type NOT NULL,
  module VARCHAR(20),
  
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  
  data JSONB,
  
  -- Estado
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  
  -- Canal
  channel VARCHAR(20),  -- 'in_app', 'email', 'push', 'whatsapp'
  sent_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 3.6.3 Routing de Alertas

```typescript
// Edge Function: route_alert()
interface AlertPayload {
  orgId: string;
  type: string;
  severity: string;
  module: string;
  message: string;
  recipientRole: string;
  data: Record<string, any>;
}

async function routeAlert(payload: AlertPayload): Promise<void> {
  // 1. Obtiene preferencias de usuario
  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('org_id', payload.orgId)
    .eq('role', payload.recipientRole)
    .single();

  // 2. Determina canales basado en severidad + preferencias
  const channels: string[] = [];

  if (payload.severity === 'CRITICAL') {
    channels.push('push');  // Siempre push para crítico
    channels.push('in_app');
  } else if (payload.severity === 'HIGH') {
    if (prefs?.high_severity_push) channels.push('push');
    channels.push('in_app');
  } else {
    channels.push('in_app');  // INFO/WARNING solo in-app
  }

  // 3. Envía por cada canal
  for (const channel of channels) {
    await sendNotification({
      ...payload,
      channel
    });
  }

  // 4. Registra en tabla alerts_rules
  await supabase
    .from('alerts_rules')
    .insert({
      org_id: payload.orgId,
      type: payload.type,
      severity: payload.severity,
      module: payload.module,
      message: payload.message,
      recipient_role: payload.recipientRole,
      data: payload.data,
      triggered_at: new Date()
    });
}

// Envío real por canal
async function sendNotification(payload: AlertPayload & { channel: string }): Promise<void> {
  switch (payload.channel) {
    case 'in_app':
      await supabase.from('notifications').insert({
        org_id: payload.orgId,
        type: payload.type,
        module: payload.module,
        title: generateTitle(payload),
        message: payload.message,
        data: payload.data,
        channel: 'in_app',
        sent_at: new Date()
      });
      break;

    case 'push':
      // Integrate con Expo PushNotifications o OneSignal
      await sendPushNotification({
        title: generateTitle(payload),
        body: payload.message,
        data: payload.data
      });
      break;

    case 'email':
      // Envía via Resend o SendGrid
      await sendEmailNotification({
        to: payload.recipientEmail,
        subject: generateTitle(payload),
        body: payload.message
      });
      break;

    case 'whatsapp':
      // Integrate con Twilio o WhatsApp Business API
      await sendWhatsAppNotification({
        phone: payload.recipientPhone,
        message: payload.message
      });
      break;
  }
}
```

#### 3.6.4 Daily Digest

```sql
-- Scheduled Job (ejecuta 8am todos los días)
CREATE OR REPLACE FUNCTION generate_daily_digest()
RETURNS TABLE(org_id UUID, digest_html TEXT) AS $$
DECLARE
  v_org_id UUID;
  v_digest TEXT;
BEGIN
  -- Itera por cada organización
  FOR v_org_id IN SELECT DISTINCT org_id FROM alerts_rules WHERE triggered_at >= NOW() - INTERVAL '1 day'
  LOOP
    -- Agrupa alertas por módulo
    v_digest := '<html><body>';
    v_digest := v_digest || '<h1>CHECK SUITE - Resumen Diario</h1>';
    v_digest := v_digest || '<p>Fecha: ' || CURRENT_DATE || '</p>';

    -- GastoCheck
    v_digest := v_digest || '<h2>GastoCheck</h2><ul>';
    FOR r IN 
      SELECT type, message, COUNT(*) as count 
      FROM alerts_rules 
      WHERE org_id = v_org_id 
        AND module = 'gastocheck'
        AND triggered_at >= NOW() - INTERVAL '1 day'
      GROUP BY type, message
    LOOP
      v_digest := v_digest || '<li>' || r.type || ': ' || r.message || ' (' || r.count || ')</li>';
    END LOOP;
    v_digest := v_digest || '</ul>';

    -- CobraCheck
    v_digest := v_digest || '<h2>CobraCheck</h2><ul>';
    FOR r IN 
      SELECT type, message, COUNT(*) as count 
      FROM alerts_rules 
      WHERE org_id = v_org_id 
        AND module = 'cobracheck'
        AND triggered_at >= NOW() - INTERVAL '1 day'
      GROUP BY type, message
    LOOP
      v_digest := v_digest || '<li>' || r.type || ': ' || r.message || ' (' || r.count || ')</li>';
    END LOOP;
    v_digest := v_digest || '</ul>';

    -- ... (repetir para BancoCheck, FacturaCheck, FlujoCheck)

    v_digest := v_digest || '</body></html>';

    RETURN QUERY SELECT v_org_id, v_digest;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
```

#### 3.6.5 Real-time Listeners (Supabase Realtime)

```typescript
// En cada módulo (móvil y web)
import { RealtimePostgresChangesPayload } from '@supabase/realtime-js';

// Escucha alertas en tiempo real
const subscription = supabase
  .channel('org_alerts')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'alerts_rules',
      filter: `org_id=eq.${orgId}`
    },
    (payload: RealtimePostgresChangesPayload<AlertRule>) => {
      const alert = payload.new as AlertRule;

      // Maneja por severidad
      if (alert.severity === 'CRITICAL') {
        // Toast + Sound + Vibration (móvil)
        showCriticalAlert(alert);
        playSound('critical.mp3');
        triggerVibration();
      } else if (alert.severity === 'HIGH') {
        // Toast + Notificación in-app
        showHighAlert(alert);
      } else {
        // Solo badge counter
        incrementUnreadCount();
      }

      // Guarda en local state para UI
      setAlerts(prev => [alert, ...prev]);
    }
  )
  .subscribe();
```

#### 3.6.6 Matriz de Alertas

| Tipo | Módulo | Severidad | Canales | Rol | Descripción |
|------|--------|-----------|---------|-----|-------------|
| EXPENSE_APPROVED | GastoCheck | INFO | in_app | Supervisor | Gasto aprobado |
| POLICY_SUBMITTED | GastoCheck | WARNING | in_app | Admin | Póliza enviada a contador |
| CASHFLOW_DEFICIT | FlujoCheck | HIGH | push + email | Admin | Flujo < umbral |
| PAYMENT_FAILED | CobraCheck | HIGH | push | Cobrador | Cobro fallido |
| BANK_DEVIATION | BancoCheck | HIGH | in_app + email | Admin | Desvío flujo vs banco > 10% |
| CFDI_ERROR | FacturaCheck | CRITICAL | push + email | Admin | Error SAT en CFDI |
| RECONCILIATION_MATCHED | FlujoCheck | INFO | in_app | Admin | CFDI ↔ Banco matched |
| ANOMALY_DETECTED | BancoCheck | CRITICAL | push | Admin | Transacción anómala banco |

---

## IV. ARQUITECTURA TÉCNICA DE INTEGRACIÓN

### 4.1 Flujo de Datos Completo (End-to-End)

```
┌─────────────────────────────────────────────────────────────────┐
│                    CHECK SUITE DATA FLOW                         │
└─────────────────────────────────────────────────────────────────┘

                    Supabase PostgreSQL
                    ┌──────────────────┐
                    │                  │
        ┌───────────┼─ SINGLE SOURCE  ─┼───────────┐
        │           │    OF TRUTH      │           │
        │           └──────────────────┘           │
        │                  ▲                        │
        │                  │                        │
        │           Postgres Triggers              │
        │           + RLS Policies                 │
        │                  │                        │
    ┌───▼────┐    ┌────────┴────────┐   ┌──────────▼───┐
    │GASTOCHECK│   │  COBRACHECK    │   │ BANCOCHECK   │
    │(Egresos) │   │ (Ingresos+Conf)│   │ (Real-time)  │
    └──────────┘   └────────────────┘   └──────────────┘
         │                │                    │
         │                └────────┬───────────┘
         │                         │
         └────────────────┬────────┘
                          │
                    ┌─────▼──────┐
                    │ FLUJOCHECK │
                    │ (Proyect.) │
                    └─────┬──────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
    ┌─────▼──────┐  ┌─────▼──────┐  ┌────▼──────┐
    │Alertas     │  │Validación  │  │Exportación│
    │(Routing)   │  │(Matching)  │  │ (CONTPAQ) │
    └────────────┘  └────────────┘  └───────────┘
          │               │
    ┌─────▼──────────────▼────┐
    │ FACTURACHECK             │
    │ (CFDI + Trazabilidad)    │
    └──────────────────────────┘

VELOCIDAD DE PROPAGACIÓN:
• Triggers SQL: < 100ms
• Edge Functions: 100-500ms
• Realtime Listeners: < 1s (móvil/web)
• Daily Digest: 8am UTC-6
```

### 4.2 Tabla de Responsabilidades

| Componente | Responsabilidad | Tecnología | SLA |
|------------|-----------------|-----------|-----|
| GastoCheck | Registra egresos | Expo (móvil) + Next.js (web) | 99.9% |
| CobraCheck | Registra ingresos + confiabilidad | Expo (móvil) | 99.9% |
| BancoCheck | Sincroniza bancos | Belvo API + Edge Functions | 99% |
| FacturaCheck | Emite CFDI + reconciliación | Next.js (web) + FACTUROO | 99.5% |
| FlujoCheck | Proyecciones + alertas | Next.js (web) + Postgres | 99.9% |
| Notificaciones | Routing + entrega | Expo Push, Email, WhatsApp | 95% |

### 4.3 Permisos por Rol

```typescript
// RLS Policies en Supabase

// COMPRADOR: Solo ve sus gastos
CREATE POLICY "comprador_own_expenses" ON expenses
  FOR SELECT USING (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_id = expenses.org_id
        AND user_id = auth.uid()
        AND role = 'buyer'
    )
  );

// SUPERVISOR (CONTADOR_GENERAL): Ve todas las pólizas + ingresos
CREATE POLICY "supervisor_all_policies" ON policies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_id = policies.org_id
        AND user_id = auth.uid()
        AND role = 'contador_general'
    )
  );

// COBRADOR: Solo ve sus cobros asignados
CREATE POLICY "cobrador_assigned_collections" ON collection_logs
  FOR SELECT USING (
    cobrador_id = auth.uid()
  );

// ADMIN: Ve todo
CREATE POLICY "admin_all_data" ON public_tables
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_id = public_tables.org_id
        AND user_id = auth.uid()
        AND role = 'admin'
    )
  );
```

---

## V. CASOS DE USO INTEGRADOS

### 5.1 Caso 1: Ciclo Completo Facturación

```
DÍA 1: Admin emite CFDI en FacturaCheck
├─ Factura: FAC_001 por $15,000 a cliente ABC
├─ Trigger: Inserta en bank_reconciliation (PENDING)
└─ Notif: "Nueva factura FAC_001"

DÍA 3: Belvo sincroniza banco
├─ Transacción: -$15,000 desde RFC cliente ABC
├─ Trigger: Busca matching en bank_reconciliation
├─ Resultado: MATCHED ✓
└─ Notif: "CFDI FAC_001 reconciliada"

DÍA 3 (Paralelo): Trigger crea póliza en GastoCheck
├─ Póliza: POL_JULIO_001
├─ Líneas:
│  ├─ Banco (D): $15,000
│  └─ Ventas (H): $15,000
└─ Notif: "Póliza contable POL_JULIO_001 creada"

DÍA 5: Supervisor exporta a CONTPAQi
├─ Descarga: Archivo .txt con todas las pólizas
└─ Marca: invoice_to_policy.contpaq_exported = TRUE

FLUJOCHECK EN TIEMPO REAL:
Lunes:     $100,000
Martes:    $100,000
Miércoles: $115,000 (+FAC_001 ingreso esperado)
Jueves:    $115,000
Viernes:   $115,000 (BancoCheck confirma: $115,012)
├─ Desviación: 0.01% (< 10%) ✓
└─ Status: RECONCILED
```

### 5.2 Caso 2: Alerta de Déficit con Acciones

```
VIERNES 8am: Admin revisa FlujoCheck
├─ Proyección semanal: $8,500 (< $10,000 umbral)
├─ Eventos:
│  ├─ Gastos aprobados: $22,000
│  ├─ Cobros confirmados: $18,000
│  └─ Diferencia: -$4,000
└─ ALERTA CRÍTICA: "Posible déficit"

ACCIONES DISPONIBLES:
1. Aplazo de pagos (reschedule expenses)
2. Acelerar cobros (notify collection team)
3. Crédito de emergencia (link a BancoCheck)
4. Escenarios "qué pasa si"

NOTIFICACIONES:
├─ Admin: Push notification (severidad CRITICAL)
├─ Supervisor (Contador): Email digest
└─ Cobrador: In-app "Priorizar cobro cliente XYZ"

RESOLUCIÓN:
├─ Cobrador registra +$5,000 cobro extra
├─ FlujoCheck recalcula: $13,500 (> umbral ✓)
└─ Alerta se resuelve automáticamente
```

---

## VI. IMPLEMENTACIÓN Y ROLLOUT

### 6.1 Fases

| Fase | Módulos | Duración | Hitos |
|------|---------|----------|-------|
| 1 | GastoCheck ↔ FlujoCheck | 1 semana | Triggers SQL + Notifs básicas |
| 2 | CobraCheck ↔ FlujoCheck | 1 semana | Confidence score + Payment weighting |
| 3 | BancoCheck ↔ FlujoCheck | 1.5 semanas | Belvo sync + Reconciliación real-time |
| 4 | FacturaCheck ↔ BancoCheck | 1.5 semanas | Matching automático + Reconciliación |
| 5 | FacturaCheck ↔ GastoCheck | 1 semana | Export CONTPAQi + Trazabilidad SAT |
| 6 | Alertas Globales | 1 semana | Routing, Digest, Push notifications |
| **TOTAL** | **5 Módulos** | **6 semanas** | **MVP Integrado** |

### 6.2 Testing Strategy

```
UNIT TESTS:
├─ Triggers SQL (mocks)
├─ Edge Functions
├─ Reconciliation logic
└─ Alert routing

INTEGRATION TESTS:
├─ GastoCheck + FlujoCheck
├─ CobraCheck + FlujoCheck
├─ BancoCheck + FlujoCheck
├─ FacturaCheck + BancoCheck
├─ FacturaCheck + GastoCheck
└─ All alerts

E2E TESTS (Expo + Next.js):
├─ Comprador crea gasto → aparece en Flujo
├─ Cobrador registra cobro → actualiza confianza
├─ Admin conecta banco → alertas en tiempo real
├─ Admin emite CFDI → genera póliza + exporta
└─ Dashboard FlujoCheck actualiza en tiempo real

PERFORMANCE:
├─ Trigger response < 100ms
├─ Realtime listener < 1s
├─ Edge Function < 500ms
└─ Daily digest generate < 5s
```

---

## VII. CONFIGURACIÓN Y PERMISOS

### 7.1 Variables de Entorno

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...

# Integraciones Externas
BELVO_API_KEY=sk_live_[key]
FACTUROO_API_KEY=[key]
RESEND_API_KEY=[key]

# Notificaciones
EXPO_PUSH_NOTIFICATION_CHANNEL=check-suite-alerts
TWILIO_WHATSAPP_SID=[sid]
TWILIO_WHATSAPP_AUTH_TOKEN=[token]

# Umbrales de Alertas (customizables por org)
CASHFLOW_DEFICIT_THRESHOLD=10000  # MXN
BANK_DEVIATION_THRESHOLD=0.10  # 10%
BANK_SYNC_INTERVAL=300  # segundos
```

### 7.2 Edge Function Deployment

```bash
# Supabase CLI
supabase functions deploy sync_expense_to_cashflow --region us-east-1
supabase functions deploy sync_collection_to_cashflow --region us-east-1
supabase functions deploy reconcile_on_bank_sync --region us-east-1
supabase functions deploy sync_invoice_payment_to_bank --region us-east-1
supabase functions deploy auto_match_bank_transactions --region us-east-1
supabase functions deploy create_policy_from_invoice --region us-east-1
supabase functions deploy export_policies_to_contpaq --region us-east-1
supabase functions deploy route_alert --region us-east-1
supabase functions deploy generate_daily_digest --region us-east-1
```

---

## VIII. MÉTRICAS Y MONITORING

### 8.1 Dashboards de Monitoreo

```
Real-time Dashboard (FlujoCheck):
├─ Flujo semanal vs actual (gráfica)
├─ Alertas activas (count)
├─ Últimas transacciones (feed)
└─ Confiabilidad clientes top 10

Admin Dashboard (CHECK SUITE):
├─ Health check: Todos los módulos
├─ Sync status: GastoCheck, CobraCheck, BancoCheck, FacturaCheck
├─ Alertas pendientes (by severity)
├─ Export status: Últimas facturas emitidas
└─ Audit log: Últimas 50 eventos

Contador Dashboard (GastoCheck):
├─ Pólizas por estado
├─ Reconciliación SAT
├─ Exportaciones CONTPAQi
└─ Trazabilidad por factura
```

### 8.2 KPIs

| Métrica | Objetivo | Monitoreo |
|---------|----------|-----------|
| Trigger Latency | < 100ms | CloudWatch |
| Realtime Listener | < 1s | Client-side |
| Bank Sync Success | > 99% | Daily log |
| Matching Rate | > 95% | Weekly report |
| Alert Accuracy | > 90% | Monthly audit |
| Reconciliation Time | < 3 días | Manual check |

---

## IX. ROADMAP FUTURO

### 9.1 Mejoras Post-MVP

```
FASE 7: Machine Learning
├─ Predicción de cash flow (Prophet/LSTM)
├─ Anomaly detection (Isolation Forest)
└─ Recomendaciones de crédito automático

FASE 8: Automatización Avanzada
├─ Pagos automáticos (ACH)
├─ Facturas recurrentes (subscriptions)
└─ Reconciliación contable automática (OCR)

FASE 9: Integraciones Externas
├─ SAP/Oracle para empresas grandes
├─ Shopify para e-commerce
└─ WooCommerce para tiendas online

FASE 10: Internacionalización
├─ Soporte multi-moneda
├─ Legislación fiscal por país
└─ Bancos en LATAM
```

---

## X. APÉNDICES

### A. Glossario

| Término | Definición |
|---------|-----------|
| **CFDI** | Comprobante Fiscal Digital por Internet (México) |
| **RFC** | Registro Federal del Contribuyente (México) |
| **SAT** | Servicio de Administración Tributaria (México) |
| **CONTPAQi** | Software contable mexicano (estándar) |
| **Reconciliación** | Validación de que dos fuentes coinciden |
| **RLS** | Row-Level Security (seguridad nivel fila en Supabase) |
| **Edge Function** | Función serverless en Supabase (ejecución edge) |
| **Realtime Listener** | WebSocket que escucha cambios en BD |
| **Trigger SQL** | Acción automática en BD cuando ocurre evento |

### B. Referencias Técnicas

- [Supabase Triggers](https://supabase.com/docs/guides/database/postgres/triggers)
- [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime/overview)
- [Belvo API](https://developers.belvo.com/)
- [FACTUROO (PAC)](https://facturoo.com/)
- [CONTPAQi Integration](https://www.contpaqisa.com/)

---

**Documento Clasificado:** CHECK SUITE Team  
**Última Actualización:** 2026-07-05  
**Próxima Revisión:** 2026-07-12  
