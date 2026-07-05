# 🎯 FLUJOCHECK — LEE ESTO PRIMERO

**Si tienes 5 minutos**: Lee esto  
**Si tienes 30 minutos**: Lee FLUJOCHECK_QUICK_START.md  
**Si tienes 2 horas**: Lee FLUJOCHECK_IMPLEMENTATION_GUIDE.md  
**Mientras codificas**: Abre FLUJOCHECK_ALGORITHMS_CHEATSHEET.md en otra ventana  

---

## ¿QUÉ ES FLUJOCHECK?

**FlujoCheck** = Control total de cash flow semanal

```
Empresa tiene:
  • Dinero en banco (múltiples cuentas)
  • Pagos que debe hacer (proveedores, salarios, impuestos)
  • Dinero que va a recibir (clientes, ventas)
  • Créditos (de banco, proveedores)
  • Dinero en exceso (¿pagar deuda? ¿invertir?)

FlujoCheck responde:
  ✅ ¿Cuánto dinero tengo REALMENTE disponible?
  ✅ ¿Puedo pagar todo esto esta semana?
  ✅ ¿Cuánto AHORRO si pago deuda hoy?
  ✅ ¿Dónde está el riesgo en los próximos 12 meses?
  ✅ ¿Qué recomendaciones me das?
```

**Audiencia**: Admin + Contador (no es para compradores como GastoCheck)

---

## ESTRUCTURA RÁPIDA

**5 Tabs** (como GastoCheck):
1. **📊 Flujo** — Dashboard semanal (Lunes-Domingo)
2. **💳 Créditos** — Gestionar créditos + amortización
3. **📈 Proyección** — 12 meses predichos + health score
4. **⚙️ Configuración** — Cuentas bancarias, reglas
5. **👤 Perfil** — Info usuario + logout

**Color**: BRAND.blue (#3498DB)

**Componentes que REUTILIZAS de GastoCheck:**
- TopBar (cambiar "Gasto" → "Flujo")
- BottomTabBar (solo cambiar tabs)
- ProfileTab (igual)

---

## LAS 14 TABLAS SQL

```
1. cash_flow_periods       ← Período semanal
2. payables                ← Deudas (qué pagar)
3. receivables             ← Ingresos (qué cobrar)
4. payment_schedule        ← Plan de pago
5. weekly_payment_plan     ← Qué pagar cada día
6. credit_projection       ← Mis créditos
7. credit_amortization_rules ← Cómo pagar
8. recurring_payments      ← Automáticos (nómina)
9. cash_flow_transactions  ← Historial TODO
10. bank_accounts_multi    ← Mis cuentas
11. multi_account_recommendations ← Recomendaciones
12. payment_collection_confidence ← AI: ¿cobro?
13. annual_projection      ← 12 meses proyectados
14. economic_indicators    ← TIIE/UDI/inflación
```

Listo: Copiar migration SQL de la guía y ejecutar.

---

## LOS 6 ENDPOINTS API

```typescript
// POST: Crear período semanal
POST /api/flujo/periods
Input:  { week_start: "2026-07-07" }
Output: { id, week_end, health_score, ... }

// GET: Dashboard completo
GET /api/flujo/dashboard?period_id=X
Output: {
  period, weeklyMetrics, payables[], receivables[], 
  credits[], recommendations, healthScore
}

// POST: OCR documento crédito
POST /api/flujo/credit-scan
Input:  { image_uri: "data:...", document_type: "loan_agreement" }
Output: { credit_id, extracted_data, confidence: 87 }

// GET: 12 meses proyectados
GET /api/flujo/projection/annual?scenario=realistic
Output: {
  months: [
    { month: "2026-07", income: 500k, expenses: 350k, health: 85 },
    ...
  ],
  risks: { critical_months, debt_spike_months }
}

// POST: Simular pago ("¿Qué pasa si...?")
POST /api/flujo/simulate-payment
Input:  { payable_id, payment_date, from_account_id }
Output: { before, after, feasible, recommendations }

// GET: Confianza de cobro (AI/ML)
GET /api/flujo/receivables/{id}/confidence
Output: { confidence_level, confidence_percentage, recommendation }
```

Copiar endpoints en `/apps/web/app/api/flujo/[...].ts`

---

## LOS 6 ALGORITMOS CLAVE

### 1. Payment Capacity
```
¿Cuánto PUEDO pagar?
cash - buffer - critical_obligations = capacity
Ej: 150k - 50k - 80k = 20k
```

### 2-5. Amortización (4 tipos)
```
Fixed:      Cuota igual 60 meses (banco estándar)
Graduated:  Cuota sube 5% cada año
Balloon:    Cuota baja + pago final GRANDE
Interest:   Solo interés, principal al final
```

### 6. Annual Projection
```
Para cada mes (próximos 12):
  income = SUM(receivables)
  expenses = SUM(payables + recurring + credit_payments)
  net = income - expenses
  health_score = calculateHealthScore(net, debt_ratio)
```

### Bonus: Health Score
```
Base: 50
+30 si net > 0
+20 si debt_ratio < 40%
+20 si no hay vencidas
+20 si buffer > 50k
Result: 0-100 (red/yellow/green)
```

**Ver FLUJOCHECK_ALGORITHMS_CHEATSHEET.md para detalles completos**

---

## HITOS DÍA A DÍA

```
SEMANA 1: FOUNDATION
  Lunes-Martes:    Estructura + TopBar + BottomTabBar
  Miércoles:       FlujoDashboard screen + API GET dashboard
  Jueves:          CreditosPanel screen + OCR scaffold
  Viernes:         ProyeccionAnual screen

SEMANA 2: CONNECT
  Lunes-Martes:    Implementar 6 endpoints API
  Miércoles:       Supabase migrations + RLS
  Jueves:          Amortización + algoritmos core
  Viernes:         Multi-account transfers + Unit tests

SEMANA 3: SHIP
  Lunes:           Integration tests + fixes
  Martes:          Performance review
  Miércoles:       Testing en todos los roles
  Jueves:          Documentación + Release
```

---

## ANTES DE EMPEZAR: CHECKLIST

```
☐ Instalar dependencies:
  npm install expo-barcode-scanner
  npm install @testing-library/react-native

☐ Crear carpeta estructura:
  mkdir -p apps/mobile/app/flujocheck/{components,screens,services,hooks,types,utils,__tests__}

☐ Copiar DESIGN_SYSTEM_CHECK_SUITE_NAVIGATION.md
  → Leer TopBar + BottomTabBar pattern

☐ Tener abierto en split-screen:
  - Este archivo (README_FIRST)
  - FLUJOCHECK_QUICK_START.md (referencia rápida)
  - FLUJOCHECK_ALGORITHMS_CHEATSHEET.md (pseudocódigo)

☐ Supabase:
  - Acceso a proyecto gastocheck-app
  - Poder ejecutar migrations
  - Supabase CLI instalado: npm install -g supabase
```

---

## DECISION TREE: ¿CÓMO EMPIEZO?

```
¿Entiendo el concepto (cash flow semanal)?
├─ SÍ → Ve a "EMPIEZA AQUÍ"
└─ NO → Lee 10 minutos: "¿QUÉ ES FLUJOCHECK?" arriba

¿Sé cómo hacer React Native + TypeScript?
├─ SÍ → Ve a "EMPIEZA AQUÍ"
└─ NO → Primero aprende Expo/React Native basics

¿Necesito entender TODOS los algoritmos antes de empezar?
├─ NO (correcto) → Empieza UI, luego APIs
└─ SÍ → Dedica 1 hora a FLUJOCHECK_ALGORITHMS_CHEATSHEET.md

¿Por dónde empiezo el código?
├─ apps/mobile/app/flujocheck/index.tsx
│  └─ Copiar estructura de GastoCheck home
│
├─ apps/mobile/app/flujocheck/components/TopBar.tsx
│  └─ Reutilizar de GastoCheck, cambiar accent a BRAND.blue
│
├─ apps/mobile/app/flujocheck/types/index.ts
│  └─ Pegar todas las interfaces TypeScript de la guía
│
└─ apps/mobile/app/flujocheck/screens/FlujoDashboard/index.tsx
   └─ Renderizar widgets, conectar API GET /dashboard
```

---

## EMPIEZA AQUÍ

### Paso 1: Crear estructura (30 min)
```bash
cd apps/mobile/app
mkdir flujocheck
cd flujocheck
mkdir components screens services hooks types utils __tests__
```

### Paso 2: Implementar TopBar (1 hora)
Archivo: `components/TopBar.tsx`
Copiar de GastoCheck, cambiar:
```typescript
<Text style={styles.topBarWordA}>Flujo</Text>  // "Gasto" → "Flujo"
const accent = BRAND.blue;  // BRAND.green → BRAND.blue
```

### Paso 3: Implementar BottomTabBar (1 hora)
Archivo: `components/BottomTabBar.tsx`
Copiar de GastoCheck, cambiar tabs:
```typescript
const FLUJO_TABS = [
  { icon: '📊', label: 'Flujo', badge: 0 },
  { icon: '💳', label: 'Créditos', badge: 0 },
  { icon: '📈', label: 'Proyección', badge: 0 },
  { icon: '⚙️', label: 'Ajustes', badge: 0 },
  { icon: '👤', label: 'Perfil', badge: 0 },
];
```

### Paso 4: Archivo index.tsx (1.5 horas)
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

export default function FlujoCheckHome() {
  const [activeTab, setActiveTab] = useState(0);

  const TABS = [
    { icon: '📊', label: 'Flujo', badge: 0 },
    { icon: '💳', label: 'Créditos', badge: 0 },
    { icon: '📈', label: 'Proyección', badge: 0 },
    { icon: '⚙️', label: 'Ajustes', badge: 0 },
    { icon: '👤', label: 'Perfil', badge: 0 },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F7FA' }}>
      <TopBar accent={BRAND.blue} />
      
      <View style={{ flex: 1 }}>
        {activeTab === 0 && <FlujoDashboard />}
        {activeTab === 1 && <CreditosPanel />}
        {activeTab === 2 && <ProyeccionAnual />}
        {activeTab === 3 && <Configuracion />}
        {activeTab === 4 && <ProfileTab accent={BRAND.blue} />}
      </View>
      
      <BottomTabBar
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        accentColor={BRAND.blue}
      />
    </View>
  );
}
```

### Paso 5: Tipos TypeScript (1.5 horas)
Archivo: `types/index.ts`
Pegar las 20+ interfaces de FLUJOCHECK_IMPLEMENTATION_GUIDE.md

Ejemplo:
```typescript
export interface CashFlowPeriod {
  id: string;
  week_start: string;
  week_end: string;
  health_score: number;
  // ... resto aquí
}
```

### Paso 6: Constantes (30 min)
Archivo: `constants/BRAND.ts`
```typescript
export const BRAND = {
  blue: '#3498DB',
  green: '#26A65B',
  red: '#E74C3C',
};
```

Archivo: `constants/SPACING.ts`
```typescript
export const SPACING = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24,
};
```

### Paso 7: FlujoDashboard Screen (3 horas)
Archivo: `screens/FlujoDashboard/index.tsx`
Crear 4-5 DashboardWidget con datos mockados

---

## SIGUIENTES PASOS (Días 2+)

**Día 2**: CreditosPanel + OCR scaffold  
**Día 3**: ProyeccionAnual + chart  
**Día 4**: Conectar APIs (GET /dashboard)  
**Día 5**: Implementar algoritmos  
**Día 6+**: Tests, Supabase migrations, deploy  

---

## REFERENCIAS RÁPIDAS

| Archivo | Qué tiene |
|---------|-----------|
| `FLUJOCHECK_IMPLEMENTATION_GUIDE.md` | TODO: componentes, schema, APIs, algoritmos, tipos |
| `FLUJOCHECK_QUICK_START.md` | Resumen + hitos + conceptos |
| `FLUJOCHECK_ALGORITHMS_CHEATSHEET.md` | Pseudocódigo + ejemplos numéricos |
| `FLUJOCHECK_ARCHITECTURE_DIAGRAM.md` | Data flows + schema diagram |
| `DESIGN_SYSTEM_CHECK_SUITE_NAVIGATION.md` | Patrón TopBar + TabBar (REUTILIZAR) |

---

## 🆘 DUDAS COMUNES

**P: ¿Cuántas líneas de código?**  
R: ~4,000 líneas (UI 2,000 + API 1,000 + algoritmos 800 + tests 200)

**P: ¿Necesito OCR día 1?**  
R: No. MVP sin OCR (captura manual). OCR es mejora Fase 2.

**P: ¿Los algoritmos son complicados?**  
R: No. Son fórmulas simples. Ver CHEATSHEET para pseudocódigo.

**P: ¿Cuándo conectar a Supabase?**  
R: Día 4+. Primero UI con datos mockados.

**P: ¿Puedo probar sin API lista?**  
R: Sí. Mock datos en hooks hasta que endpoints estén listos.

---

## FINAL CHECKLIST

Antes de decir "terminé":

```
☐ 5 screens renderizando sin errores
☐ TopBar + BottomTabBar funcionan
☐ Cada algoritmo tiene 1+ test (>80% coverage)
☐ API endpoints responden sin 500
☐ RLS policies impiden ver datos de otra org
☐ Performance: dashboard carga en <500ms
☐ Documentación inline en código
☐ E2E: flujo completo usuario (Flujo → Créditos → Proyección)
```

---

**YOU GOT THIS!** 🚀

Cualquier pregunta: Ve a FLUJOCHECK_QUICK_START.md o FLUJOCHECK_IMPLEMENTATION_GUIDE.md

---

**Última actualización**: 2026-07-05  
**Para quién**: Daniel (implementación mobile + API)  
**Tiempo estimado**: 15 días

