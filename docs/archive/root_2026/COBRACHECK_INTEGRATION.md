# CobraCheck — Integración Completa en Check Suite

**Estado:** MVP Implementado (11 de 11 componentes) ✅

## Resumen

CobraCheck es el módulo de **gestión de cobranza** integrado en `gastocheck-app`. Incluye:

- ✅ **7 pantallas web** (dashboard, clientes, cliente-detail, facturas, promesas, bitácora, scoring)
- ✅ **4 pantallas mobile** (dashboard, tareas-diarias, clientes, historial)
- ✅ **5 tablas Supabase** (cobra_clients, cobra_invoices, cobra_promises, cobra_calls, cobra_payments)
- ✅ **3 Edge Functions** (risk-scoring, whatsapp-webhook, sat-validator)
- ✅ **Tipos TypeScript** compartidos en `@gastocheck/shared`
- ✅ **RLS Policies** por rol (owner, admin, supervisor, collector, operator)

---

## Integraciones con Otros Módulos

### 1. **BancoCheck ↔ CobraCheck** (Depósitos → Invoices)

**Flujo:**
```
Deposito en BancoCheck
  ↓
Edge Function: bancocheck-auto-match
  - Busca invoice en cobra_invoices por monto similar
  - Si encuentra → crea cobra_payment
  - Guarda relación: cobra_payments.bank_transaction_id = bank_transaction.id
  ↓
cobra_invoices.status → 'paid' o 'partial'
```

**Implementación:**
```sql
-- Agregar a cobra_payments:
ALTER TABLE cobra_payments ADD COLUMN bank_transaction_id UUID REFERENCES bank_transactions(id);

-- Edge Function: bancocheck-auto-match
POST /supabase/functions/bancocheck-auto-match
{
  "company_id": "...",
  "amount": 5000,
  "bank_transaction_id": "...",
  "reference": "DESC DEPOSITO"
}
```

**Resultado:**
- Pago registrado automáticamente
- Invoice marcada como pagada
- Link directo banco ↔ cobro

---

### 2. **FacturaCheck ↔ CobraCheck** (CFDI → Invoice)

**Flujo:**
```
CFDI emitida en FacturaCheck
  ↓
Trigger: after insert on facturas_emitidas
  - Crea cobra_invoice con uuid_sat vinculado
  - company_id, client_id desde el CFDI
  ↓
cobra_invoices.folio = cfdi.folio
cobra_invoices.uuid_sat = cfdi.uuid
cobra_invoices.due_date = cfdi.fecha_vencimiento
```

**Implementación:**
```sql
-- Trigger en FacturaCheck:
CREATE TRIGGER auto_cobra_invoice
AFTER INSERT ON facturas_emitidas
FOR EACH ROW
EXECUTE FUNCTION create_cobra_invoice_from_cfdi();

-- PDF compartible:
-- GET /supabase/storage/facturacheck/{id}.pdf
-- → Available en CobraCheck share buttons
```

**Resultado:**
- Factura → Cobra automáticamente
- UUID_SAT pre-validado
- PDF descargable desde CobraCheck

---

### 3. **FlujoCheck ↔ CobraCheck** (Cash Flow Projection)

**Flujo:**
```
cobra_invoices (pendientes + vencidas)
  ↓
View: cobra_cash_flow_items
  - Muestra ingresos esperados (si se pagan a tiempo)
  - Agrupa por due_date
  - Filtra por company_id
  ↓
FlujoCheck carga desde cobra_cash_flow_items
  - Proyecta cash inflows
  - Permite forecast de tesorería
  ↓
Comparación: real vs. proyectado
  - Si pago llega tarde → actualiza FlujoCheck
```

**Implementación:**
```sql
-- View para FlujoCheck:
CREATE OR REPLACE VIEW cobra_cash_flow_items AS
SELECT
  id,
  company_id,
  client_id,
  amount,
  due_date,
  status,
  CASE WHEN status IN ('pending', 'overdue') THEN 'cobro_esperado' ELSE 'cobro_realizado' END as item_type
FROM cobra_invoices
WHERE status != 'cancelled';

-- En FlujoCheck:
SELECT * FROM cobra_cash_flow_items WHERE company_id = :company_id
```

**Resultado:**
- Proyección de cobros en cash flow
- Sincronización real vs. esperado
- Toma de decisiones tesorera

---

### 4. **Advisor IA ↔ CobraCheck** (Insights)

**Tipos de Insight:**

1. **"Los 3 clientes que más te deben"**
```sql
SELECT client_id, SUM(current_balance) as total
FROM cobra_clients
WHERE company_id = :company_id
ORDER BY current_balance DESC
LIMIT 3
```

2. **"X facturas vencidas hace >30 días"**
```sql
SELECT COUNT(*) as count
FROM cobra_invoices
WHERE company_id = :company_id
  AND days_overdue > 30
  AND status IN ('pending', 'partial', 'overdue')
```

3. **"Recomendaciones de acción"**
```sql
SELECT
  c.id, c.name, c.risk_score,
  CASE
    WHEN c.risk_score >= 80 THEN 'LLAMAR URGENTEMENTE'
    WHEN c.risk_score >= 60 THEN 'Contactar pronto'
    ELSE 'Mantener vigilancia'
  END as recommendation
FROM cobra_clients c
WHERE company_id = :company_id
ORDER BY c.risk_score DESC
```

**Implementación:**
- Queries en tiempo real desde Advisor
- Cron job diario para insights programados
- Dashboard Advisor muestra top 5

**Resultado:**
- Automatización de decisiones
- Alertas prioritarias
- Visibilidad ejecutiva

---

## Roles & Permisos

| Rol | Acciones |
|-----|----------|
| **OWNER** | Todo, ver KPIs globales, cambiar configuración |
| **ADMIN** | Crear/editar clientes, aprobar pagos, ver bitácora completa |
| **SUPERVISOR** | Crear clientes, ver todas las llamadas, supervisar cobradores |
| **COLLECTOR** | Solo ver clientes asignados, registrar llamadas/promesas/pagos |
| **OPERATOR** | Registrar pagos, crear llamadas |

---

## Risk Score Algorithm

**Fórmula:**
```
score = (days_overdue_max / 180) * 40 
      + (credit_utilization / 100) * 30 
      + ((100 - payment_history) / 100) * 30
```

**Factores:**
- **40% — Antigüedad**: Días más vencidos de cualquier factura (máx 180d = 100 pts)
- **30% — Utilización**: % del límite usado (utilización ≥ 100% = riesgo alto)
- **30% — Historial**: % de facturas pagadas on-time

**Niveles:**
- 🟢 **0-40**: Verde (bajo riesgo)
- 🟡 **40-60**: Amarillo (riesgo moderado)
- 🟠 **60-80**: Naranja (riesgo alto)
- 🔴 **80-100**: Rojo (crítico → llamar urgentemente)

---

## Data Flow

```
┌─────────────┐
│ FacturaCheck │ ─→ cobra_invoices (auto-create)
└─────────────┘
       ↓
┌─────────────────┐
│ CobraCheck Web  │ ─→ Supervisor gestiona clientes
│ + Mobile App    │    Collector registra pagos/llamadas
└─────────────────┘
       ↓
┌──────────────────┐
│ cobra_payments   │ ─→ BancoCheck auto-match
└──────────────────┘
       ↓
┌──────────────────┐
│ cobra_risk_score │ ─→ Edge Function (recalc diario)
└──────────────────┘
       ↓
┌──────────────────┐
│ FlujoCheck View  │ ─→ Cash flow projection
└──────────────────┘
       ↓
┌──────────────────┐
│ Advisor Insights │ ─→ "Top 3 deudores", "Llamar hoy"
└──────────────────┘
```

---

## Setup Checklist

- [ ] Ejecutar migración: `20260618210000_cobra_check_complete.sql`
- [ ] Verificar RLS policies activas en todas las tablas
- [ ] Deploy Edge Functions: `cobra-risk-scoring`, `cobra-whatsapp-webhook`, `cobra-sat-validator`
- [ ] Agregar CobraCheck al sidebar de apps/web
- [ ] Agregar CobraCheck al nav de apps/mobile
- [ ] Registrar en `organization_modules` table para billing
- [ ] Test: crear cliente, emitir CFDI → debe aparecer en CobraCheck

---

## Próximos Pasos

1. **Soft launch**: Prueba interna con 1 cliente piloto
2. **WhatsApp Business API**: Conectar webhook real
3. **SAT API**: Integrar consulta real de CFDI
4. **Offline sync**: AsyncStorage en mobile
5. **Notificaciones**: Push alerts para promesas vencidas
6. **Mobile app**: Build APK/IPA

---

**Última actualización:** 2026-06-18  
**Versión:** 1.0.0 (MVP)  
**Mantenedor:** Juan (romero.juan24@gmail.com)
