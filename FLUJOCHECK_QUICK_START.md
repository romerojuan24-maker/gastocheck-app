# 🚀 FLUJOCHECK — QUICK START PARA DANIEL

**Documento**: Resumen ejecutivo de implementación  
**Tiempo estimado**: 15 días de codificación  
**Complejidad**: ALTA (3 pantallas complejas, 6 servicios API, múltiples algoritmos)

---

## 📋 VERSIÓN CORTA

1. **Leer primero**: `FLUJOCHECK_IMPLEMENTATION_GUIDE.md` (completo, +1000 líneas)
2. **Seguir orden**: Estructura → Componentes → Screens → API → Tests
3. **Base visual**: DESIGN_SYSTEM_CHECK_SUITE_NAVIGATION.md (reutilizar TopBar + BottomTabBar)
4. **Color**: BRAND.blue (#3498DB)
5. **Tablas**: 14 tablas SQL + RLS + índices

---

## 🎯 HITOS POR DÍA

### Semana 1: Fundación
**Lunes (Día 1-2)**: Estructura + TopBar + BottomTabBar + tipos TS  
**Martes (Día 3)**: Componentes visuales (HealthIndicator, PaymentConfidenceBar, Cards)  
**Miércoles (Día 4)**: FlujoDashboard screen + hook useWeeklyData  
**Jueves (Día 5)**: CreditosPanel screen + OCR scaffold  
**Viernes (Día 6)**: ProyeccionAnual screen + gráfica health score  

### Semana 2: Conectar
**Lunes (Día 7)**: API endpoints (6 endpoints POST/GET)  
**Martes (Día 8)**: Supabase migrations SQL + RLS policies  
**Miércoles (Día 9)**: Implementar algoritmos amortización (4 tipos)  
**Jueves (Día 10)**: Integración multi-cuenta + recommendations  
**Viernes (Día 11)**: Unit tests + fixes bugs  

### Semana 3: Pulido
**Lunes (Día 12)**: Integration tests + E2E  
**Martes (Día 13)**: Performance review + accesibilidad  
**Miércoles (Día 14)**: Testing roles (admin/supervisor/accountant)  
**Jueves (Día 15)**: Documentación + release candidate  

---

## 🗂️ TREE RÁPIDA (Qué criar dónde)

```
apps/mobile/app/flujocheck/
├── components/
│   ├── TopBar.tsx                    ← REUTILIZAR de GastoCheck, cambiar accent
│   ├── BottomTabBar.tsx              ← REUTILIZAR de GastoCheck, 5 tabs
│   ├── DashboardWidget.tsx           ← Card base (título, valor, trend)
│   ├── HealthIndicator.tsx           ← Semáforo 0-100
│   └── PaymentConfidenceBar.tsx      ← AI/ML color bar
├── screens/
│   ├── FlujoDashboard/               ← Tab 0: Semanal (payables + receivables)
│   ├── CreditosPanel/                ← Tab 1: Gestión créditos + OCR
│   ├── ProyeccionAnual/              ← Tab 2: 12 meses + health chart
│   ├── Configuracion/                ← Tab 3: Bank setup + rules
│   └── Profile/                      ← Tab 4: Standard (reutilizable)
├── services/
│   ├── api.ts                        ← Cliente HTTP con interceptor JWT
│   ├── flujoService.ts               ← GET/POST periods, dashboard
│   ├── creditService.ts              ← OCR + CRUD créditos
│   └── projectionService.ts          ← Cálculos 12 meses
├── hooks/
│   ├── useFlujoContext.ts            ← Estado global (período, créditos)
│   ├── usePaymentCapacity.ts         ← Cálculo capacidad
│   └── useHealthScore.ts             ← Scoring lógica
├── types/
│   └── index.ts                      ← 20+ interfaces (EN LA GUÍA)
├── utils/
│   ├── algorithms.ts                 ← 6 algoritmos clave (EN LA GUÍA)
│   └── formatting.ts                 ← Formateo MXN, fechas
├── __tests__/
│   ├── algorithms.test.ts            ← Tests amortización + proyección
│   └── ...
└── index.tsx                         ← Entrada (FlujoCheckHome con 5 tabs)

apps/web/app/api/flujo/
├── periods.ts                        ← POST create period
├── dashboard.ts                      ← GET dashboard
├── credit-scan.ts                    ← POST OCR
├── projection.ts                     ← GET annual projection
├── simulate-payment.ts               ← POST "qué pasa si"
└── [...]

packages/shared/
├── types/flujo.ts                    ← Interfaces compartidas API
└── supabase/migrations/
    └── 20260705_001_flujocheck.sql  ← 14 tables + RLS + seed
```

---

## 🔑 CONCEPTOS CLAVE (Memorizar)

### 1. HEALTH SCORE (0-100)
- **70+**: HEALTHY (verde) — Cash flow positivo, sin deudas vencidas
- **40-69**: CAUTION (amarillo) — Algún riesgo, monitorear
- **0-39**: CRITICAL (rojo) — Riesgo alto, acción inmediata

**Factores**:
```
+30 pts: Net cash flow positivo
+20 pts: Debt ratio < 40%
+20 pts: Sin obligaciones vencidas
+20 pts: Buffer > 50k MXN
+10 pts: Proyección estable
```

### 2. AMORTIZACIÓN (4 tipos)
- **Fixed**: Cuota igual 60 meses — Predictible, común en bancos
- **Graduated**: Cuota aumenta 5% anual — Pedir préstamos cuando joven
- **Balloon**: Cuota baja + pago final grande — Refinanciar al final
- **Interest Only**: Solo interés, principal al final — Especial

### 3. PAYMENT CONFIDENCE (AI/ML)
Probabilidad de cobro por debtor:
- **High (75-100%)**: Esperar, cobro probable
- **Medium (50-74%)**: Seguimiento, confirmación
- **Low (25-49%)**: Seguimiento agresivo
- **Unknown (<25%)**: Datos insuficientes

### 4. WEEKLY PAYMENT PLAN
Qué pagar **cada día de la semana** (Lunes-Domingo):
- Prioridad 1 (Crítico): Salarios, impuestos
- Prioridad 2 (Alto): Proveedores clave
- Prioridad 3 (Medio): Servicios, gastos operacionales
- Prioridad 4 (Bajo): Opcional, si hay excedentes

---

## 📊 COMPONENTES VISUALES

### TopBar (Reutilizar de GastoCheck)
```
┌─────────────────────────────────┐
│ ‹ CHECK SUITE    FlujoCheck  👁️  ⚙️ │
└─────────────────────────────────┘
```
- Cambiar "Gasto" → "Flujo", accent a BRAND.blue
- Guardar en `components/TopBar.tsx`

### BottomTabBar (Reutilizar, solo cambiar tabs)
```
┌─────────────────────────────────┐
│ 📊        💳        📈        ⚙️        👤 │
│ Flujo    Créditos   Proyec.   Config   Perfil  │
│          (badge: 2)                           │
└─────────────────────────────────┘
```

### Dashboard Widgets
```
┌──────────────────────────┐
│ 💰 CASH AVAILABLE        │
│ $150,000                 │
│ +$12,500 este mes        │
└──────────────────────────┘
```

### Health Indicator
```
    ●
   🟢 85
   Saludable
```

---

## 📈 ALGORITMOS A IMPLEMENTAR

### 1. `calculatePaymentCapacity()`
```
Entrada: cash_available, buffer, obligaciones
Salida: cuánto SÍ puedo pagar esta semana

cash = 150k
buffer = 50k (para operaciones)
obligaciones críticas = 80k (salarios)
→ Puedo pagar = 150k - 50k - 80k = 20k
```

### 2. `generateAmortizationSchedule()`
- **Fixed**: Fórmula PMT estándar
- **Graduated**: PMT base + aumento anual
- **Balloon**: Pagos bajos + pago grande mes 60
- **Interest Only**: Solo interés, luego principal

Validar: `principal + interest = total_payment` para cada mes

### 3. `generateAnnualProjection()`
```
Para cada mes (12):
  income = SUM(receivables ese mes)
  expenses = SUM(payables + recurring + créditos ese mes)
  net = income - expenses
  health_score = calculateHealthScore(net, debt_ratio, ...)
  confidence = decrece por mes (más lejano = menos seguro)
```

### 4. `recommendExcessFundsStrategy()`
Decidir si pagar deuda anticipadamente vs invertir:
- Si interés deuda > 2x rendimiento inversión → PAY
- Si rendimiento > 1.5x interés → INVEST
- Si similar → SPLIT 50/50

### 5. `recommendAccountTransfers()`
Mover dinero entre cuentas:
- Si cuenta A < 20k y B > 100k → Transferir 50k
- Si pagos vencen en 3 días → Preposicionar en cuenta pagos

### 6. `calculatePaymentConfidence()`
Probabilidad cobro por debtor:
- Historia pagos on-time: +40 pts
- Monto vs industria: +30 pts
- Días desde emisión: ±20 pts
- Condiciones mercado: ±10 pts

---

## 🔗 API ENDPOINTS (6 principales)

### POST /api/flujo/periods
Crear período semanal (Lunes-Domingo)
```json
Request:  { "week_start": "2026-07-07" }
Response: { "id": "uuid", "week_end": "2026-07-13", ... }
```

### GET /api/flujo/dashboard?period_id=X
Dashboard completo: payables, receivables, credits, recommendations
```json
Response: {
  "period": {...},
  "weeklyMetrics": { "cash_available": 150000, ... },
  "payables": [...],
  "receivables": [...],
  "credits": [...],
  "healthScore": { "score": 85, "status": "healthy" },
  ...
}
```

### POST /api/flujo/credit-scan
OCR documento (crédito/promesa)
```json
Request:  { "image_uri": "data:...", "document_type": "loan_agreement" }
Response: { "extracted_data": { "credit_name": "...", "amount": 100000 }, "confidence": 87 }
```

### GET /api/flujo/projection/annual?scenario=realistic
12 meses proyectados con health score
```json
Response: {
  "months": [
    { "month_date": "2026-07-01", "projected_net": 150000, "health_score": 85 },
    ...
  ],
  "risks": { "critical_months": ["2026-10-01"], ... }
}
```

### POST /api/flujo/simulate-payment
"¿Qué pasa si pago X en Y?"
```json
Request:  { "payable_id": "uuid", "payment_date": "2026-07-10", "from_account_id": "uuid" }
Response: {
  "before": { "balance": 150000 },
  "after": { "balance": 100000 },
  "feasible": true
}
```

### GET /api/flujo/receivables/{id}/confidence
AI/ML confianza de cobro
```json
Response: {
  "confidence_level": "high",
  "confidence_percentage": 92,
  "recommendation": "Esperar, alta probabilidad de cobro"
}
```

---

## 🗄️ SCHEMA SQL (14 tablas, resumido)

```sql
1. cash_flow_periods       ← Período semanal (Lunes-Domingo)
2. payables                ← Deudas (proveedores, impuestos)
3. payment_schedule        ← Plan de pago individual
4. receivables             ← Ingresos esperados
5. weekly_payment_plan     ← Qué pagar cada día
6. credit_projection       ← Créditos (banco, proveedor)
7. credit_amortization_rules ← Cómo pagar (fixed/graduated/balloon)
8. recurring_payments      ← Automáticos (nómina, suscripciones)
9. cash_flow_transactions  ← Registro de TODO
10. bank_accounts_multi    ← Múltiples cuentas empresa
11. multi_account_recommendations ← Recomendaciones transferencias
12. payment_collection_confidence ← AI/ML confianza cobro
13. annual_projection      ← 12 meses proyectado
14. economic_indicators    ← TIIE, UDI, inflación (pública)
```

Índices: ~12 en columnas críticas (org_id, due_date, etc)  
RLS: Todos filtran por organization_id (usuarios solo ven su org)

---

## ✅ ANTES DE EMPEZAR (Setup)

```bash
# 1. Instalar deps (si no están)
cd apps/mobile
npm install expo-barcode-scanner      # Para OCR
npm install @react-native-firebase/ml # ML Kit OCR

# 2. Crear archivos base
mkdir -p app/flujocheck/{components,screens,services,hooks,types,utils,__tests__}

# 3. Copiar TypeScript interfaces (de FLUJOCHECK_IMPLEMENTATION_GUIDE.md)
cat >> types/index.ts  # Pegar tipos

# 4. Setup migrations
mkdir -p ../../supabase/migrations
cp MIGRATION_TEMPLATE.sql supabase/migrations/20260705_001_flujocheck.sql

# 5. Tests setup
npm install --save-dev @testing-library/react-native

# 6. Listo para codificar
```

---

## 🎬 EJECUCIÓN FASE 1 (Estructura)

```typescript
// apps/mobile/app/flujocheck/index.tsx

import React, { useState } from 'react';
import { View } from 'react-native';
import { TopBar } from './components/TopBar';
import { BottomTabBar } from './components/BottomTabBar';
import { FlujoDashboard } from './screens/FlujoDashboard';
import { CreditosPanel } from './screens/CreditosPanel';
import { ProyeccionAnual } from './screens/ProyeccionAnual';
import { Configuracion } from './screens/Configuracion';
import { ProfileTab } from './screens/Profile';
import { BRAND } from './constants/BRAND';
import { MODULE_COLORS } from './constants/MODULE_COLORS';

const FLUJO_TABS = [
  { icon: '📊', label: 'Flujo', badge: 0 },
  { icon: '💳', label: 'Créditos', badge: 0 }, // TODO: contar vencidos
  { icon: '📈', label: 'Proyección', badge: 0 },
  { icon: '⚙️', label: 'Ajustes', badge: 0 },
  { icon: '👤', label: 'Perfil', badge: 0 },
];

export default function FlujoCheckHome() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <View style={{ flex: 1, backgroundColor: MODULE_COLORS.flujocheck.background }}>
      <TopBar 
        accent={BRAND.blue}
        onSwitcher={() => console.log('TODO: admin switcher')}
      />

      <View style={{ flex: 1 }}>
        {activeTab === 0 && <FlujoDashboard />}
        {activeTab === 1 && <CreditosPanel />}
        {activeTab === 2 && <ProyeccionAnual />}
        {activeTab === 3 && <Configuracion />}
        {activeTab === 4 && <ProfileTab accent={BRAND.blue} />}
      </View>

      <BottomTabBar
        tabs={FLUJO_TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        accentColor={BRAND.blue}
      />
    </View>
  );
}
```

---

## 📚 REFERENCIAS

| Archivo | Propósito |
|---------|-----------|
| `FLUJOCHECK_IMPLEMENTATION_GUIDE.md` | GUÍA COMPLETA (leer primero) |
| `DESIGN_SYSTEM_CHECK_SUITE_NAVIGATION.md` | Patrón visual (TopBar, TabBar) |
| `types/index.ts` en guía | 20+ interfaces TypeScript |
| `utils/algorithms.ts` en guía | 6 algoritmos clave (pseudocódigo) |
| Migration SQL en guía | 14 CREATE TABLE + RLS |

---

## 🆘 DUDAS FRECUENTES

**P: ¿Empiezo por API o por UI?**  
R: UI primero (días 1-6), luego API (días 7-8). De abajo hacia arriba es más rápido.

**P: ¿Cómo integro con GastoCheck?**  
R: Tablas compartidas (bank_accounts_multi, organization). RLS solo filtra por org_id.

**P: ¿Qué es el "buffer crítico" de 50k?**  
R: Dinero mínimo para no detener operaciones (nómina, servicios). Configurable por org.

**P: ¿OCR es obligatorio?**  
R: MVP sin OCR (captura manual). OCR es mejora Fase 2.

**P: ¿Puedo saltar algunos algoritmos?**  
R: No. Amortización + proyección + confidence son CORE. Sin ellos FlujoCheck no tiene valor.

---

## 🏁 CHECKLIST FINAL

Antes de "listo para producción":

```
☐ Todos 5 screens renderizando
☐ TopBar + BottomTabBar funcionan
☐ Cada algoritmo tiene 1+ unit test con >80% coverage
☐ API endpoints responden sin errores
☐ RLS policies impiden que vea datos de otra org
☐ Performance: <100ms GET dashboard
☐ Accesibilidad: colores contrastan (WCAG AA)
☐ Documentación inline en código
☐ README en app/flujocheck/README.md
☐ Migration SQL ejecuta sin errores
☐ E2E: flujo completo usuario (Flujo → Créditos → Proyección)
```

---

**SIGUIENTE PASO**: 
1. Leer `FLUJOCHECK_IMPLEMENTATION_GUIDE.md` (1-2 horas)
2. Crear carpeta estructura
3. Implementar TopBar + BottomTabBar
4. Empezar FlujoDashboard screen

¡Adelante! 🚀

