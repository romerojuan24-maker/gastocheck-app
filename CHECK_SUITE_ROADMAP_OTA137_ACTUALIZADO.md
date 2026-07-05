# 🚀 ROADMAP ACTUALIZADO — POST OTA 137

**Base**: OTA 137 implementó UI 50% (TopBar, TabBar, ProfileTab)  
**Pendiente**: Lógica, BD, API, Integraciones (340 horas vs 483)  
**Timeline**: 9-10 semanas (optimizado)

---

## 📊 TIMELINE PARALELO ACTUALIZADO

```
Semana   1   2   3   4   5   6   7   8   9  10
─────────────────────────────────────────────
FlujoCheck    [─────────────────────────]
  DB/API      [──]
  Algoritmos     [──]
  Features          [──]
  Polish             [─]

BancoCheck    [──────────────────]
  DB/API      [──]
  OCR/Match      [──]
  OAuth          [──]
  Polish          [─]

FacturaCheck  [─────────────────]
  DB/API      [──]
  CFDI/PAC       [──]
  Webhooks       [──]
  Polish          [─]

Integraciones                    [───────]
QA (Daniel)                         [─────]
Release v2.0                             [✓]
```

---

## 🎯 SEMANA 1: FOUNDATION (Post-OTA137)

### **Hito**: Supabase + API Endpoints Base

#### **FlujoCheck**
```
DURACIÓN: 3 días (24h)

☐ Supabase Migrations (14 tablas)
  • cash_flow_periods
  • payables, receivables, credits
  • payment_schedule, weekly_payment_plan
  • bank_accounts_multi, credit_amortization_rules
  • recurring_payments, transactions
  • multi_account_recommendations
  • payment_collection_confidence
  • annual_projection, economic_indicators
  • ├─ Índices optimizados
  • ├─ RLS policies
  • └─ Seed data

☐ API Endpoints (6 endpoints, estructura base)
  • POST /api/flujo/periods
  • GET /api/flujo/dashboard
  • POST /api/flujo/credit-scan
  • GET /api/flujo/projection/annual
  • POST /api/flujo/simulate-payment
  • GET /api/flujo/receivables/{id}/confidence

☐ Tipos TypeScript (expandir desde OTA137)
  • CashFlowPeriod, Payable, Receivable, Credit
  • PaymentSchedule, AmortizationPayment
  • BankAccountMulti, MultiAccountRecommendation
  • AnnualProjection, PaymentCollectionConfidence

☐ Hooks (expandir)
  • useFlujoBalance() → conexión real a DB
  • useFlujoItems() → conexión real a DB
  • useFlujoMutations() → operaciones CRUD

Deliverable: Dashboard conectado a DB, puede guardar/cargar datos
```

#### **BancoCheck**
```
DURACIÓN: 2 días (16h)

☐ Supabase Migrations (8 tablas)
  • bank_accounts_manual, bank_statement_imports
  • bank_statement_ocr_config
  • bank_accounts_automated
  • bank_transactions (union)
  • transaction_matching_log
  • reconciliation_status
  • unsupported_bank_requests

☐ API Endpoints (6 endpoints)
  • POST /api/banco/import-statement
  • GET /api/banco/accounts
  • POST /api/banco/oauth-callback
  • GET /api/banco/transactions
  • POST /api/banco/manual-match
  • GET /admin/unsupported-banks

☐ Tipos + Hooks (crear estructura)

Deliverable: Cuentas conectadas page, listado transacciones conectada a DB
```

#### **FacturaCheck**
```
DURACIÓN: 2 días (16h)

☐ Supabase Migrations (8 tablas)
  • cfdi_documents, cfdi_credits
  • cfdi_credit_transactions
  • cfdi_distributions
  • cfdi_cobracheck_links
  • pac_configuration
  • email_templates, whatsapp_templates
  • audit_log_facturacheck

☐ API Endpoints (7 endpoints)
  • POST /api/factura/generate-cfdi
  • POST /api/factura/distribute
  • GET /api/factura/cfdis
  • GET /api/factura/cfdis/{id}
  • POST /api/factura/cancel
  • GET/POST /api/factura/credits
  • GET /api/factura/reports

☐ Tipos + Hooks (crear estructura)

Deliverable: CFDIs page, listado conectado a DB
```

---

## 🎯 SEMANA 2: ALGORITMOS CORE (24h)

### **Hito**: Lógica de Negocio Principal

#### **FlujoCheck**
```
DURACIÓN: 2.5 días (20h)

☐ 6 Algoritmos Principales
  1. calculatePaymentCapacity()
     • Input: saldo actual, transacciones pendientes, buffer
     • Output: cuánto puedo pagar esta semana
  
  2. generateFixedAmortization()
     • Input: monto, tasa, plazo
     • Output: tabla amortización con cuota fija
  
  3. generateGraduatedAmortization()
     • Input: monto, tasa, plazo
     • Output: tabla amortización con cuota creciente
  
  4. generateBalloonAmortization()
     • Input: monto, tasa, plazo, pago final
     • Output: tabla con pago grande al final
  
  5. generateInterestOnlyAmortization()
     • Input: monto, tasa, plazo
     • Output: tabla solo interés (+ pago principal al final)
  
  6. generateAnnualProjection()
     • Input: estado actual + cobros estimados
     • Output: 12 meses proyectados + health score

☐ Update Endpoints (hacer llamadas funcionales)
  • POST /api/flujo/periods → calcula capacity
  • GET /api/flujo/dashboard → proyección semanal
  • POST /api/flujo/simulate-payment → ejecuta amortización

☐ Update Screens
  • FlujoTab: Mostrar datos reales
  • CreditosTab (placeholder): Mostrar lista vacía (ready para semana 3)

Deliverable: Dashboard muestra saldo real, puede simular pago
```

#### **BancoCheck**
```
DURACIÓN: 1.5 días (12h)

☐ 2 Algoritmos Principales
  1. OCR Parser
     • Input: PDF/JPG banco
     • Output: transacciones extraídas
     • Incluye: confidence scoring, bank format detection
  
  2. Transaction Matching
     • Input: 2 transacciones (OCR vs OAuth o ambas)
     • Output: ¿son la misma? (fecha ±2 días, monto exacto)
     • Incluye: deduplication logic

☐ Update Endpoints
  • POST /api/banco/import-statement → parsea PDF/JPG
  • GET /api/banco/transactions → lista con status
  • POST /api/banco/manual-match → relaciona manuales

☐ Update Screens
  • Importar Tab: Upload PDF/JPG (UI lista, lógica OCR)
  • Transacciones Tab: Lista con matching status

Deliverable: Puede importar PDF, ve transacciones, puede emparejar
```

#### **FacturaCheck**
```
DURACIÓN: 1.5 días (12h)

☐ 2 Funciones Principales
  1. CFDI Generator
     • Input: datos invoice (RFC, items, totales)
     • Output: XML válido v4.0
     • Incluye: validación campos SAT
  
  2. PAC Adapter
     • Input: XML, credenciales PAC
     • Output: respuesta timbrado (folio, certificado)
     • Agnóstico: Interface IPACAdapter + FacturamaAdapter

☐ Update Endpoints
  • POST /api/factura/generate-cfdi → genera + timbre
  • GET /api/factura/cfdis → lista CFDIs
  • POST /api/factura/cancel → revoca

☐ Update Screens
  • CFDIs Tab: Formulario básico, genera invoice
  • Reportes Tab: Listado básico

Deliverable: Puede generar + timbrar CFDI, ve listado
```

---

## 🎯 SEMANA 3: FEATURES AVANZADAS (32h)

#### **FlujoCheck**
```
☐ CreditosTab funcional
  • OCR documento crédito → extrae términos
  • Tabla amortización automática
  • Simulación pagos anticipados
  • Alertas vencidos

☐ ProyeccionTab funcional
  • 12-month dashboard
  • Health indicators (green/yellow/red)
  • Tendencia sana/negativa
  • Economic indicators (TIIE, UDI)

☐ AjustesTab funcional
  • Buffer operativo (configurable)
  • Targets de reserva
  • Umbrales de alerta
```

#### **BancoCheck**
```
☐ OAuth flows (BBVA, Santander)
  • Conectar cuenta via OAuth
  • Sync automático transacciones
  • Token refresh + encryption

☐ ReconciliacionTab
  • Estado matched/unmatched
  • Discrepancias > 10%
  • Logs de cambios
```

#### **FacturaCheck**
```
☐ Webhooks (HMAC + idempotency)
  • Recibir callbacks PAC
  • Retry logic exponencial
  • Status tracking

☐ Distribution (email + WhatsApp)
  • Enviar CFDIs via email
  • Enviar links via WhatsApp
  • Status delivery tracking
```

---

## 🎯 SEMANA 4: REFINAMIENTO (20h)

#### **FlujoCheck**
```
☐ Health score refinado (algoritmo de scoring)
☐ Recomendaciones PAY/INVEST/SPLIT
☐ Multi-account transfers recommendation
```

#### **BancoCheck**
```
☐ Admin Alerts System (bancos nuevos)
☐ Priority scoring (demanda clientes)
☐ Dashboard cuentas conectadas
```

#### **FacturaCheck**
```
☐ SAT Compliance
  • RFC validation contra padrón
  • XSD validation XML
  • Withholdings automáticos
  • Audit trail
  
☐ Cancelación workflow
☐ Reportes (período, cliente, impuestos)
```

---

## 🎯 SEMANA 5-6: INTEGRACIONES (40h)

### **Hito**: Cross-Module Workflows

```
☐ GastoCheck → FlujoCheck
  • Egresos aparecen en proyección
  • Alertas déficit
  • Trigger: nuevo gasto en GastoCheck

☐ CobraCheck → FlujoCheck
  • Ingresos en proyección
  • Payment confidence (AI coloring)
  • Trigger: nuevo cobro registrado

☐ BancoCheck → FlujoCheck
  • Saldos reales actualizados
  • Validación vs proyectado
  • Alertas reconciliación

☐ FacturaCheck → BancoCheck
  • Auto-genera transacción cuando CFDI pagada
  • Matching automático
  • Reconciliación

☐ FacturaCheck → GastoCheck
  • CFDIs emitidas = pólizas contables
  • Export CONTPAQi
  • Trazabilidad SAT

☐ Alertas Globales
  • Routing por rol
  • Prioridad por severidad
  • Canales (push/email/in-app)
```

---

## 🎯 SEMANA 7-8: QA + POLISH (30h)

```
☐ Unit tests (jest)
☐ Integration tests (e2e)
☐ Performance tunning (< 2s load)
☐ Security audit
☐ Documentation
☐ Deployment playbook
```

---

## 📊 HORAS ESTIMADAS (ACTUALIZADO)

| Semana | FlujoCheck | BancoCheck | FacturaCheck | Testing | Total |
|--------|-----------|-----------|--------------|---------|-------|
| 1      | 24h       | 16h       | 16h          | -       | 56h   |
| 2      | 20h       | 12h       | 12h          | -       | 44h   |
| 3      | 28h       | 20h       | 20h          | -       | 68h   |
| 4      | 16h       | 12h       | 12h          | -       | 40h   |
| 5-6    | 40h       | 35h       | 35h          | -       | 110h  |
| 7-8    | -         | -         | -            | 30h     | 30h   |
| **TOTAL** | **128h**  | **95h**   | **95h**      | **30h** | **348h** |

**Tiempo total**: 8-9 semanas (vs 12 semanas original)  
**Tiempo ahorrado**: 143 horas por OTA 137 ✅

---

## 🎯 HITOS GO/NO-GO

### **Hito 1 — Fin Semana 1**
```
✓ FlujoCheck dashboard conectado DB
✓ BancoCheck cuentas + importar funcionando
✓ FacturaCheck genera CFDI
```

### **Hito 2 — Fin Semana 2**
```
✓ Algoritmos core funcionan
✓ Endpoints devuelven datos reales
✓ Todos los tabs tienen contenido (no ComingSoon)
```

### **Hito 3 — Fin Semana 4**
```
✓ Features avanzadas completas
✓ Integraciones mapeadas
✓ Performance OK
```

### **Hito 4 — Fin Semana 8**
```
✓ Integraciones 100% funcionando
✓ QA pass
✓ Ready for v2.0 launch
```

---

## 👥 DISTRIBUCIÓN TRABAJO

- **Yo (Chat 2)**: Desarrollo código FlujoCheck + BancoCheck + FacturaCheck (340h)
- **Chat 1 (Daniel OTA)**: OTA 138+ paralelo + QA semana 7-8
- **Ambos**: Code review antes de merge

---

**Estado**: 🟢 LISTO PARA COMENZAR  
**Próximo**: SEMANA 1 FlujoCheck DB + Endpoints
