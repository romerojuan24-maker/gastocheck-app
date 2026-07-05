# 📘 FLUJOCHECK — GUÍA COMPLETA DE IMPLEMENTACIÓN

**Versión**: 1.0  
**Fecha**: 2026-07-05  
**Status**: Listo para Daniel — SIN preguntas, listo para codificar  
**Base**: DESIGN_SYSTEM_CHECK_SUITE_NAVIGATION.md + FlujoCheck v1.0 arquitectura  

---

## 📑 TABLA DE CONTENIDOS

1. [Estructura de Carpetas](#estructura-de-carpetas)
2. [Componentes Reutilizables](#componentes-reutilizables)
3. [Schema SQL Completo](#schema-sql-completo)
4. [API Endpoints](#api-endpoints)
5. [Algoritmos Clave](#algoritmos-clave)
6. [Tipos TypeScript](#tipos-typescript)
7. [Test Stubs Iniciales](#test-stubs-iniciales)
8. [Migration SQL Template](#migration-sql-template)

---

## 🗂️ ESTRUCTURA DE CARPETAS

```
apps/mobile/app/flujocheck/
├── index.tsx                          # Entrada principal (FlujoCheckHome)
├── components/
│   ├── TopBar.tsx                     # Reutilizable (BRAND.blue accent)
│   ├── BottomTabBar.tsx               # Reutilizable (5 tabs)
│   ├── PillBar.tsx                    # Alertas dinámicas
│   ├── DashboardWidget.tsx            # Card semanal base
│   ├── HealthIndicator.tsx            # Semáforo salud cash flow
│   ├── RecommendationCard.tsx         # Card recomendaciones de pago
│   ├── PaymentConfidenceBar.tsx       # AI/ML color scoring
│   └── ProfileTab.tsx                 # Perfil usuario (reutilizable)
├── screens/
│   ├── FlujoDashboard/
│   │   ├── index.tsx                  # Tab 0: Vista semanal
│   │   ├── useWeeklyData.ts           # Hook: cargar datos período
│   │   └── styles.ts
│   ├── CreditosPanel/
│   │   ├── index.tsx                  # Tab 1: Gestión créditos
│   │   ├── CreditListItem.tsx
│   │   ├── useCredits.ts              # Hook: CRUD créditos
│   │   ├── OCRScanner.tsx             # Captura documento
│   │   ├── AmortizationModal.tsx      # Configurar pago variable
│   │   └── styles.ts
│   ├── ProyeccionAnual/
│   │   ├── index.tsx                  # Tab 2: 12 meses + health score
│   │   ├── useAnnualProjection.ts     # Hook: cálculos proyección
│   │   ├── MonthCard.tsx
│   │   ├── HealthChart.tsx            # Gráfica histórica salud
│   │   └── styles.ts
│   ├── Configuracion/
│   │   ├── index.tsx                  # Tab 3: Ajustes módulo
│   │   ├── BankAccountsSetup.tsx      # Conectar cuentas multi
│   │   ├── PaymentRulesEditor.tsx     # Editar amortización
│   │   └── styles.ts
│   └── Profile/
│       ├── index.tsx                  # Tab 4: Perfil usuario
│       └── styles.ts
├── services/
│   ├── api.ts                         # Cliente HTTP (todos endpoints)
│   ├── flujoService.ts                # GET/POST flujo periods
│   ├── creditService.ts               # CRUD créditos + OCR
│   ├── projectionService.ts           # Cálculos 12 meses
│   ├── recommendationService.ts       # Transfer + payment recommendations
│   └── ocrService.ts                  # OCR documento (backend)
├── hooks/
│   ├── useFlujoContext.ts             # Global state (período actual, créditos)
│   ├── usePaymentCapacity.ts          # Cálculo capacidad pago
│   ├── useHealthScore.ts              # Scoring salud cash flow
│   └── useMultiAccount.ts             # Recomendaciones multi-cuenta
├── types/
│   ├── index.ts                       # Todas las interfaces TypeScript
│   └── enums.ts                       # Enums (amortization types, etc)
├── utils/
│   ├── formatting.ts                  # Formateo moneda/fechas
│   ├── algorithms.ts                  # Algoritmos clave (pseudocódigo)
│   ├── dateHelpers.ts                 # Utilidades semanas/meses
│   └── validators.ts                  # Validaciones input
├── constants/
│   ├── BRAND.ts                       # BRAND.blue + colores FLUJO
│   ├── MODULE_COLORS.ts               # Paleta flujocheck
│   ├── SPACING.ts                     # Constantes layout
│   └── AMORTIZATION_RULES.ts          # 4 tipos fijos
├── __tests__/
│   ├── algorithms.test.ts             # Payment capacity, amortization
│   ├── projection.test.ts             # 12-month accuracy
│   ├── healthScore.test.ts            # Scoring logic
│   └── recommendations.test.ts        # Transfer/payment logic
└── README.md                          # Instrucciones rápidas implementación

packages/shared/src/
├── types/
│   ├── flujo.ts                       # Shared interfaces (para API)
│   └── supabase.ts                    # RLS schemas
└── supabase/
    └── migrations/
        └── YYYYMMDD_001_flujocheck.sql  # Migration SQL completa
```

---

## 🧩 COMPONENTES REUTILIZABLES

### 1. TopBar — FlujoCheck

```typescript
// apps/mobile/app/flujocheck/components/TopBar.tsx

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BRAND } from '../constants/BRAND';
import { SPACING, SIZES } from '../constants/SPACING';

interface TopBarProps {
  accent?: string;
  rightIcon?: string;
  onBack?: () => void;
  onRightPress?: () => void;
  onSwitcher?: () => void;
  isAdmin?: boolean;
}

export function TopBar({
  accent = BRAND.blue,
  rightIcon = '⚙️',
  onBack,
  onRightPress,
  onSwitcher,
  isAdmin = false,
}: TopBarProps) {
  return (
    <View style={[styles.topBar, { borderBottomColor: accent + '20' }]}>
      <TouchableOpacity 
        onPress={onBack} 
        style={styles.topBarBack}
        activeOpacity={0.7}
      >
        <Text style={styles.topBarBackText}>‹ CHECK SUITE</Text>
      </TouchableOpacity>

      <View style={styles.topBarCenter}>
        <Text style={styles.topBarWordA}>Flujo</Text>
        <Text style={[styles.topBarWordB, { color: accent }]}>Check</Text>
      </View>

      <View style={styles.topBarRightGroup}>
        {isAdmin && (
          <TouchableOpacity 
            onPress={onSwitcher} 
            style={styles.topBarIcon}
            activeOpacity={0.7}
          >
            <Text style={styles.iconText}>👁️</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity 
          onPress={onRightPress} 
          style={styles.topBarIcon}
          activeOpacity={0.7}
        >
          <Text style={styles.iconText}>{rightIcon}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    height: SIZES.topBarHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  topBarBack: {
    flex: 0.3,
    padding: SPACING.sm,
  },
  topBarBackText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#37474F',
  },
  topBarCenter: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarWordA: {
    fontSize: 18,
    fontWeight: '700',
    color: '#37474F',
  },
  topBarWordB: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: SPACING.xs,
  },
  topBarRightGroup: {
    flex: 0.3,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: SPACING.md,
  },
  topBarIcon: {
    padding: SPACING.sm,
  },
  iconText: {
    fontSize: 20,
  },
});
```

### 2. BottomTabBar — FlujoCheck

```typescript
// apps/mobile/app/flujocheck/components/BottomTabBar.tsx

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BRAND } from '../constants/BRAND';
import { SPACING, SIZES } from '../constants/SPACING';

interface Tab {
  icon: string;
  label: string;
  badge?: number;
}

interface BottomTabBarProps {
  tabs: Tab[];
  activeTab: number;
  onTabChange: (index: number) => void;
  accentColor?: string;
}

export function BottomTabBar({
  tabs,
  activeTab,
  onTabChange,
  accentColor = BRAND.blue,
}: BottomTabBarProps) {
  return (
    <View style={[styles.tabBar, { borderTopColor: accentColor + '30' }]}>
      {tabs.map((tab, index) => (
        <TouchableOpacity
          key={`tab-${index}`}
          style={[
            styles.tabItem,
            activeTab === index && [
              styles.tabItemActive,
              { backgroundColor: accentColor + '10' },
            ],
          ]}
          onPress={() => onTabChange(index)}
          activeOpacity={0.8}
        >
          <Text style={styles.tabIcon}>{tab.icon}</Text>

          {tab.badge !== undefined && tab.badge > 0 && (
            <View style={[styles.badge, { backgroundColor: BRAND.red }]}>
              <Text style={styles.badgeText}>
                {tab.badge > 99 ? '99+' : tab.badge}
              </Text>
            </View>
          )}

          <Text
            style={[
              styles.tabLabel,
              activeTab === index
                ? { color: accentColor, fontWeight: '700' }
                : { color: '#90A4AE' },
            ]}
          >
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingBottom: 8,
    paddingTop: 4,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.md,
    position: 'relative',
  },
  tabItemActive: {
    borderRadius: SIZES.borderRadius,
    marginHorizontal: SPACING.sm,
  },
  tabIcon: {
    fontSize: SIZES.tabIconSize,
    marginBottom: SPACING.xs,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BRAND.red,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  tabLabel: {
    fontSize: SIZES.tabLabelSize,
    fontWeight: '600',
    marginTop: SPACING.xs,
  },
});
```

### 3. DashboardWidget — Card Base Semanal

```typescript
// apps/mobile/app/flujocheck/components/DashboardWidget.tsx

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BRAND } from '../constants/BRAND';
import { SPACING, SIZES } from '../constants/SPACING';

interface DashboardWidgetProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  accent?: string;
  trend?: 'up' | 'down' | 'neutral';
  onPress?: () => void;
}

export function DashboardWidget({
  title,
  value,
  subtitle,
  icon,
  accent = BRAND.blue,
  trend = 'neutral',
  onPress,
}: DashboardWidgetProps) {
  const trendColor =
    trend === 'up' ? BRAND.green : trend === 'down' ? BRAND.red : '#90A4AE';

  return (
    <TouchableOpacity
      style={[styles.widget, { borderLeftColor: accent }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        {icon && <Text style={styles.icon}>{icon}</Text>}
        <Text style={styles.title}>{title}</Text>
      </View>

      <Text style={[styles.value, { color: accent }]}>{value}</Text>

      {subtitle && (
        <Text style={[styles.subtitle, { color: trendColor }]}>
          {trend === 'up' && '↑ '}
          {trend === 'down' && '↓ '}
          {subtitle}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  widget: {
    backgroundColor: '#fff',
    borderRadius: SIZES.borderRadius,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderLeftWidth: 4,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  icon: {
    fontSize: 20,
    marginRight: SPACING.sm,
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    color: '#90A4AE',
  },
  value: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
});
```

### 4. HealthIndicator — Semáforo Salud

```typescript
// apps/mobile/app/flujocheck/components/HealthIndicator.tsx

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BRAND } from '../constants/BRAND';
import { SPACING } from '../constants/SPACING';

type HealthStatus = 'healthy' | 'caution' | 'critical';

interface HealthIndicatorProps {
  status: HealthStatus;
  score: number; // 0-100
  label?: string;
}

const statusConfig: Record<HealthStatus, { color: string; label: string }> = {
  healthy: { color: BRAND.green, label: 'Saludable' },
  caution: { color: '#F39C12', label: 'Precaución' },
  critical: { color: BRAND.red, label: 'Crítico' },
};

export function HealthIndicator({
  status,
  score,
  label,
}: HealthIndicatorProps) {
  const config = statusConfig[status];

  return (
    <View style={styles.container}>
      <View
        style={[styles.circle, { borderColor: config.color, borderWidth: 3 }]}
      >
        <Text style={[styles.score, { color: config.color }]}>{score}</Text>
      </View>
      <Text style={styles.statusLabel}>{label || config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: SPACING.sm,
  },
  circle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
  },
  score: {
    fontSize: 28,
    fontWeight: '700',
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#37474F',
  },
});
```

### 5. PaymentConfidenceBar — Color Scoring AI/ML

```typescript
// apps/mobile/app/flujocheck/components/PaymentConfidenceBar.tsx

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BRAND } from '../constants/BRAND';
import { SPACING } from '../constants/SPACING';

type ConfidenceLevel = 'high' | 'medium' | 'low' | 'unknown';

interface PaymentConfidenceBarProps {
  confidence: ConfidenceLevel;
  percentage: number; // 0-100
  reason?: string;
}

const confidenceConfig: Record<
  ConfidenceLevel,
  { color: string; label: string }
> = {
  high: { color: BRAND.green, label: 'Confianza Alta' },
  medium: { color: '#F39C12', label: 'Confianza Media' },
  low: { color: BRAND.red, label: 'Confianza Baja' },
  unknown: { color: '#BDC3C7', label: 'Sin Datos' },
};

export function PaymentConfidenceBar({
  confidence,
  percentage,
  reason,
}: PaymentConfidenceBarProps) {
  const config = confidenceConfig[confidence];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{config.label}</Text>
        <Text style={[styles.percentage, { color: config.color }]}>
          {percentage}%
        </Text>
      </View>

      <View style={styles.barBackground}>
        <View
          style={[
            styles.barFill,
            { backgroundColor: config.color, width: `${percentage}%` },
          ]}
        />
      </View>

      {reason && <Text style={styles.reason}>{reason}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: SPACING.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#37474F',
  },
  percentage: {
    fontSize: 14,
    fontWeight: '700',
  },
  barBackground: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  reason: {
    fontSize: 11,
    color: '#90A4AE',
    fontStyle: 'italic',
  },
});
```

---

## 🗄️ SCHEMA SQL COMPLETO

```sql
-- FLUJOCHECK: 14 tablas + índices + RLS policies
-- Migration file: apps/mobile/supabase/migrations/20260705_001_flujocheck.sql

-- 1. CASH FLOW PERIODS (Período semanal: Lunes-Domingo)
CREATE TABLE IF NOT EXISTS cash_flow_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  period_status TEXT NOT NULL DEFAULT 'open', -- 'open', 'closed', 'archived'
  cash_available DECIMAL(15,2) NOT NULL DEFAULT 0,
  cash_committed DECIMAL(15,2) NOT NULL DEFAULT 0,
  cash_buffer DECIMAL(15,2) NOT NULL DEFAULT 0,
  health_score INT DEFAULT 100, -- 0-100 (saludable, precaución, crítico)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT period_unique UNIQUE(organization_id, week_start),
  CHECK (week_end > week_start)
);

CREATE INDEX idx_cash_flow_periods_org_week 
  ON cash_flow_periods(organization_id, week_start DESC);

-- 2. PAYABLES (Deudas de empresa: proveedores, impuestos, préstamos)
CREATE TABLE IF NOT EXISTS payables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_flow_period_id UUID NOT NULL REFERENCES cash_flow_periods(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  description TEXT NOT NULL,
  creditor_name TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  due_date DATE NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'partial', 'paid', 'overdue'
  
  recurring BOOLEAN DEFAULT FALSE,
  recurring_type TEXT, -- 'weekly', 'biweekly', 'monthly', 'quarterly', 'annual'
  
  document_url TEXT, -- URL a recibo/factura
  notes TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payables_org_due 
  ON payables(organization_id, due_date ASC);
CREATE INDEX idx_payables_period 
  ON payables(cash_flow_period_id);

-- 3. PAYMENT SCHEDULE (Plan de pago para cada payable)
CREATE TABLE IF NOT EXISTS payment_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payable_id UUID NOT NULL REFERENCES payables(id) ON DELETE CASCADE,
  
  scheduled_date DATE NOT NULL,
  scheduled_amount DECIMAL(15,2) NOT NULL,
  paid_amount DECIMAL(15,2) DEFAULT 0,
  payment_status TEXT DEFAULT 'pending', -- 'pending', 'partial', 'paid'
  
  payment_method TEXT, -- 'bank_transfer', 'cash', 'check', 'credit_card'
  confirmed BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payment_schedule_payable 
  ON payment_schedule(payable_id);
CREATE INDEX idx_payment_schedule_date 
  ON payment_schedule(scheduled_date);

-- 4. RECEIVABLES (Ingresos empresa: ventas, servicios, préstamos cobrados)
CREATE TABLE IF NOT EXISTS receivables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_flow_period_id UUID NOT NULL REFERENCES cash_flow_periods(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  description TEXT NOT NULL,
  debtor_name TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  expected_date DATE NOT NULL,
  collection_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'partial', 'collected', 'overdue'
  
  invoice_number TEXT,
  document_url TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_receivables_org_date 
  ON receivables(organization_id, expected_date ASC);

-- 5. WEEKLY PAYMENT PLAN (Plan semanal: qué pagar esta semana)
CREATE TABLE IF NOT EXISTS weekly_payment_plan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_flow_period_id UUID NOT NULL REFERENCES cash_flow_periods(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7), -- 1=Lunes, 7=Domingo
  payment_priority INT NOT NULL, -- 1=crítico, 2=alto, 3=medio, 4=bajo
  
  total_planned DECIMAL(15,2) DEFAULT 0,
  total_executed DECIMAL(15,2) DEFAULT 0,
  execution_status TEXT DEFAULT 'pending', -- 'pending', 'partial', 'completed'
  
  notes TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_weekly_payment_plan_period 
  ON weekly_payment_plan(cash_flow_period_id, day_of_week);

-- 6. CREDIT PROJECTION (Proyección de créditos: cuándo se vence, amortización)
CREATE TABLE IF NOT EXISTS credit_projection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  credit_name TEXT NOT NULL, -- "Crédito Banco X", "Crédito Proveedor Y"
  original_amount DECIMAL(15,2) NOT NULL,
  remaining_balance DECIMAL(15,2) NOT NULL,
  interest_rate DECIMAL(5,3) NOT NULL, -- Ej: 2.500 = 2.5%
  term_months INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  amortization_type TEXT NOT NULL, -- 'fixed', 'graduated', 'balloon', 'interest_only'
  
  next_payment_date DATE,
  next_payment_amount DECIMAL(15,2),
  
  total_paid DECIMAL(15,2) DEFAULT 0,
  total_interest_paid DECIMAL(15,2) DEFAULT 0,
  
  credit_status TEXT DEFAULT 'active', -- 'active', 'paid_off', 'default'
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_credit_projection_org 
  ON credit_projection(organization_id, end_date ASC);

-- 7. CREDIT AMORTIZATION RULES (Reglas fijas: cómo amortizar cada crédito)
CREATE TABLE IF NOT EXISTS credit_amortization_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_projection_id UUID NOT NULL REFERENCES credit_projection(id) ON DELETE CASCADE,
  
  amortization_type TEXT NOT NULL, -- 'fixed', 'graduated', 'balloon', 'interest_only'
  
  -- Para 'fixed': cuota igual cada período
  fixed_payment DECIMAL(15,2),
  
  -- Para 'graduated': incremento anual
  initial_payment DECIMAL(15,2),
  annual_increase_percent DECIMAL(5,3),
  
  -- Para 'balloon': pago final grande
  balloon_amount DECIMAL(15,2),
  regular_payment DECIMAL(15,2),
  
  -- Para 'interest_only': solo interés
  interest_payment DECIMAL(15,2),
  principal_payment_frequency TEXT, -- 'monthly', 'quarterly', 'at_end'
  
  extra_payment_strategy TEXT DEFAULT 'none', -- 'none', 'aggressive', 'balanced'
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_credit_amortization_rules_credit 
  ON credit_amortization_rules(credit_projection_id);

-- 8. RECURRING PAYMENTS (Pagos automáticos: nómina, suscripciones, etc)
CREATE TABLE IF NOT EXISTS recurring_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  description TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  frequency TEXT NOT NULL, -- 'weekly', 'biweekly', 'monthly', 'quarterly', 'annual'
  next_due DATE NOT NULL,
  
  automated BOOLEAN DEFAULT TRUE,
  payment_method TEXT, -- 'bank_transfer', 'cash', 'check'
  
  active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_recurring_payments_org_next_due 
  ON recurring_payments(organization_id, next_due ASC);

-- 9. CASH FLOW TRANSACTIONS (Registro de TODOS los movimientos)
CREATE TABLE IF NOT EXISTS cash_flow_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_flow_period_id UUID NOT NULL REFERENCES cash_flow_periods(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  transaction_type TEXT NOT NULL, -- 'payment', 'collection', 'transfer', 'adjustment'
  category TEXT NOT NULL, -- 'payable', 'receivable', 'recurring', 'reserve'
  
  description TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  transaction_date DATE NOT NULL,
  
  related_payable_id UUID REFERENCES payables(id),
  related_receivable_id UUID REFERENCES receivables(id),
  related_credit_id UUID REFERENCES credit_projection(id),
  
  from_account_id UUID REFERENCES bank_accounts_multi(id),
  to_account_id UUID REFERENCES bank_accounts_multi(id),
  
  status TEXT DEFAULT 'completed', -- 'pending', 'in_progress', 'completed', 'failed'
  notes TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cash_flow_transactions_period 
  ON cash_flow_transactions(cash_flow_period_id);
CREATE INDEX idx_cash_flow_transactions_date 
  ON cash_flow_transactions(transaction_date DESC);

-- 10. BANK ACCOUNTS MULTI (Cuentas bancarias: múltiples por empresa)
CREATE TABLE IF NOT EXISTS bank_accounts_multi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  account_name TEXT NOT NULL, -- "Cuenta Operativa", "Cuenta Reserva", etc
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  currency TEXT DEFAULT 'MXN',
  
  available_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  
  account_type TEXT DEFAULT 'checking', -- 'checking', 'savings', 'credit_card'
  is_primary BOOLEAN DEFAULT FALSE,
  
  connected BOOLEAN DEFAULT FALSE,
  last_sync TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT account_unique UNIQUE(organization_id, account_number)
);

CREATE INDEX idx_bank_accounts_multi_org 
  ON bank_accounts_multi(organization_id);

-- 11. MULTI ACCOUNT RECOMMENDATIONS (Recomendaciones: dónde transferir dinero)
CREATE TABLE IF NOT EXISTS multi_account_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  from_account_id UUID NOT NULL REFERENCES bank_accounts_multi(id) ON DELETE CASCADE,
  to_account_id UUID NOT NULL REFERENCES bank_accounts_multi(id) ON DELETE CASCADE,
  
  recommended_amount DECIMAL(15,2) NOT NULL,
  reason TEXT NOT NULL, -- "Optimizar excedentes", "Cubrir déficit", "Equilibrar"
  
  urgency TEXT DEFAULT 'medium', -- 'low', 'medium', 'high'
  confidence_score INT DEFAULT 50, -- 0-100
  
  status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'executed', 'rejected'
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_multi_account_recommendations_org 
  ON multi_account_recommendations(organization_id);

-- 12. PAYMENT COLLECTION CONFIDENCE (AI/ML: probabilidad cobro)
CREATE TABLE IF NOT EXISTS payment_collection_confidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receivable_id UUID NOT NULL REFERENCES receivables(id) ON DELETE CASCADE,
  
  confidence_level TEXT NOT NULL, -- 'high', 'medium', 'low', 'unknown'
  confidence_percentage INT NOT NULL CHECK (confidence_percentage BETWEEN 0 AND 100),
  
  ml_features JSONB, -- Features usadas por ML model
  
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payment_collection_confidence_receivable 
  ON payment_collection_confidence(receivable_id);

-- 13. ANNUAL PROJECTION (Proyección 12 meses)
CREATE TABLE IF NOT EXISTS annual_projection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  month_date DATE NOT NULL, -- Primer día del mes
  
  projected_income DECIMAL(15,2) DEFAULT 0,
  projected_expenses DECIMAL(15,2) DEFAULT 0,
  projected_net DECIMAL(15,2) DEFAULT 0,
  
  confidence_score INT DEFAULT 50, -- 0-100
  scenario TEXT DEFAULT 'realistic', -- 'pessimistic', 'realistic', 'optimistic'
  
  health_indicator TEXT DEFAULT 'caution', -- 'healthy', 'caution', 'critical'
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT annual_projection_unique UNIQUE(organization_id, month_date, scenario)
);

CREATE INDEX idx_annual_projection_org_month 
  ON annual_projection(organization_id, month_date ASC);

-- 14. ECONOMIC INDICATORS (Indicadores externos: TIIE, UDI, inflación)
CREATE TABLE IF NOT EXISTS economic_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  indicator_type TEXT NOT NULL, -- 'TIIE', 'UDI', 'inflation_rate', 'exchange_rate'
  indicator_value DECIMAL(10,6) NOT NULL,
  measurement_date DATE NOT NULL,
  
  source TEXT, -- 'Banxico', 'INEGI', 'external_api'
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT economic_indicators_unique UNIQUE(indicator_type, measurement_date)
);

CREATE INDEX idx_economic_indicators_type_date 
  ON economic_indicators(indicator_type, measurement_date DESC);

---
--- ROW LEVEL SECURITY (RLS) POLICIES
---

-- cash_flow_periods: usuarios solo ven su org
ALTER TABLE cash_flow_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cash_flow_periods_select" ON cash_flow_periods FOR SELECT
  USING (auth.uid() IN (
    SELECT user_id FROM user_roles ur 
    WHERE ur.organization_id = cash_flow_periods.organization_id
  ));

-- Aplicar política similar a TODAS las tablas con organization_id
ALTER TABLE payables ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_payment_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_projection ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_amortization_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_flow_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts_multi ENABLE ROW LEVEL SECURITY;
ALTER TABLE multi_account_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_collection_confidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE annual_projection ENABLE ROW LEVEL SECURITY;

-- economic_indicators: pública (sin RLS)
ALTER TABLE economic_indicators DISABLE ROW LEVEL SECURITY;
```

---

## 🔌 API ENDPOINTS

Todos los endpoints viven en `/apps/web/app/api/flujo/[...].ts` (Next.js)

### BASE URL
```
POST/GET https://app.checksuite.mx/api/flujo/*
Authorization: Bearer {JWT_TOKEN}
```

### 1. CREATE WEEKLY PERIOD

```typescript
// POST /api/flujo/periods

interface CreatePeriodRequest {
  week_start: string; // ISO Date: "2026-07-07"
}

interface CreatePeriodResponse {
  id: string;
  week_start: string;
  week_end: string;
  period_status: 'open';
  cash_available: 0;
  cash_committed: 0;
  cash_buffer: 0;
  health_score: 100;
  created_at: string;
}

// Ejemplo:
const response = await fetch('/api/flujo/periods', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({ week_start: '2026-07-07' }),
});
const period = await response.json();
// { id: 'uuid', week_start: '2026-07-07', week_end: '2026-07-13', ... }
```

### 2. GET DASHBOARD COMPLETO

```typescript
// GET /api/flujo/dashboard?period_id=<uuid>

interface DashboardResponse {
  period: CashFlowPeriod;
  
  weeklyMetrics: {
    cash_available: number;
    cash_committed: number;
    cash_buffer: number;
    payment_capacity: number; // capacidad pago = cash_available - obligations
  };
  
  payables: Payable[]; // Todos los pagos esta semana
  receivables: Receivable[]; // Todos los cobros esta semana
  
  credits: CreditProjection[]; // Créditos activos
  
  weeklyPlan: WeeklyPaymentPlan[]; // Plan lunes-domingo
  
  recommendations: {
    transfers: MultiAccountRecommendation[]; // Mover dinero entre cuentas
    payments: PaymentRecommendation[]; // Cuándo/cómo pagar
  };
  
  healthScore: {
    score: number; // 0-100
    status: 'healthy' | 'caution' | 'critical';
    factors: HealthFactor[];
  };
  
  accounts: BankAccountMulti[];
  
  created_at: string;
}

// Ejemplo:
const dashboard = await fetch(
  `/api/flujo/dashboard?period_id=550e8400-e29b-41d4-a716-446655440000`,
  { headers: { 'Authorization': `Bearer ${token}` } }
).then(r => r.json());

console.log(dashboard.weeklyMetrics.cash_available); // 150000
console.log(dashboard.payables[0]); // { id, description, amount, due_date, ... }
```

### 3. OCR DOCUMENT SCANNING (Crédito)

```typescript
// POST /api/flujo/credit-scan

interface CreditScanRequest {
  image_uri: string; // Data URI o URL
  document_type: 'loan_agreement' | 'promissory_note' | 'invoice';
}

interface CreditScanResponse {
  id: string; // credit_projection ID
  
  extracted_data: {
    credit_name: string;
    original_amount: number;
    interest_rate: number;
    term_months: number;
    start_date: string;
    end_date: string;
    next_payment_date?: string;
    next_payment_amount?: number;
  };
  
  confidence: number; // 0-100
  warnings?: string[]; // "Interés variable detectado", etc
  
  status: 'extracted' | 'needs_review';
  
  created_at: string;
}

// Ejemplo:
const scanResult = await fetch('/api/flujo/credit-scan', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    image_uri: 'data:image/png;base64,...',
    document_type: 'loan_agreement',
  }),
});
const credit = await scanResult.json();
// { id, extracted_data: { credit_name, original_amount, ... }, confidence: 87 }
```

### 4. ANNUAL 12-MONTH PROJECTION

```typescript
// GET /api/flujo/projection/annual?scenario=realistic

interface AnnualProjectionResponse {
  scenario: 'pessimistic' | 'realistic' | 'optimistic';
  
  months: Array<{
    month_date: string; // "2026-07-01"
    projected_income: number;
    projected_expenses: number;
    projected_net: number;
    
    health_indicator: 'healthy' | 'caution' | 'critical';
    health_score: number; // 0-100
    
    confidence_score: number; // 0-100
  }>;
  
  totals: {
    total_income: number;
    total_expenses: number;
    total_net: number;
    average_monthly_health: number;
  };
  
  risks: {
    critical_months: string[]; // Meses con cash flow negativo
    debt_spike_months: string[]; // Meses con altos pagos
  };
  
  created_at: string;
}

// Ejemplo:
const projection = await fetch(
  '/api/flujo/projection/annual?scenario=realistic',
  { headers: { 'Authorization': `Bearer ${token}` } }
).then(r => r.json());

console.log(projection.months[0]); // Julio 2026
// { month_date: "2026-07-01", projected_income: 500000, projected_expenses: 350000, ... }
```

### 5. SIMULATE PAYMENT (Escenarios "¿Qué pasa si?")

```typescript
// POST /api/flujo/simulate-payment

interface SimulatePaymentRequest {
  payable_id?: string; // Pagar este payable
  amount?: number; // O cantidad custom
  payment_date: string; // "2026-07-10"
  from_account_id: string;
}

interface SimulatePaymentResponse {
  simulation_id: string;
  
  before: {
    account_balance: number;
    cash_available: number;
    health_score: number;
  };
  
  after: {
    account_balance: number;
    cash_available: number;
    health_score: number;
  };
  
  impact: {
    balance_change: number; // Negative = outflow
    health_score_change: number; // Can be +/- 
    affected_obligations: string[];
  };
  
  feasible: boolean; // True si hay saldo suficiente
  recommendations: string[];
  
  created_at: string;
}

// Ejemplo:
const simulation = await fetch('/api/flujo/simulate-payment', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    payable_id: 'payable-uuid',
    payment_date: '2026-07-10',
    from_account_id: 'account-uuid',
  }),
});
const result = await simulation.json();
// { before: { balance: 150000 }, after: { balance: 100000 }, feasible: true, ... }
```

### 6. GET CREDIT DETAILS

```typescript
// GET /api/flujo/credits/{credit_id}

interface CreditDetailResponse {
  id: string;
  credit_name: string;
  original_amount: number;
  remaining_balance: number;
  interest_rate: number;
  term_months: number;
  start_date: string;
  end_date: string;
  
  amortization_type: 'fixed' | 'graduated' | 'balloon' | 'interest_only';
  amortization_schedule: Array<{
    payment_date: string;
    principal: number;
    interest: number;
    total_payment: number;
    remaining_balance: number;
  }>;
  
  next_payment: {
    date: string;
    principal: number;
    interest: number;
    total: number;
  };
  
  credit_status: 'active' | 'paid_off' | 'default';
  
  total_paid: number;
  total_interest_paid: number;
  
  created_at: string;
}

// Ejemplo:
const creditDetail = await fetch(
  '/api/flujo/credits/credit-uuid',
  { headers: { 'Authorization': `Bearer ${token}` } }
).then(r => r.json());

console.log(creditDetail.amortization_schedule); // Array de 60 pagos (5 años)
```

### 7. POST CREATE PAYABLE

```typescript
// POST /api/flujo/payables

interface CreatePayableRequest {
  cash_flow_period_id: string;
  description: string;
  creditor_name: string;
  amount: number;
  due_date: string; // "2026-07-15"
  recurring?: boolean;
  recurring_type?: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual';
  document_url?: string;
}

interface PayableResponse {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  payment_status: 'pending';
  created_at: string;
}
```

### 8. GET PAYMENT CONFIDENCE

```typescript
// GET /api/flujo/receivables/{receivable_id}/confidence

interface PaymentConfidenceResponse {
  receivable_id: string;
  confidence_level: 'high' | 'medium' | 'low' | 'unknown';
  confidence_percentage: number; // 0-100
  
  factors: {
    debtor_history: number; // -20 a +20
    amount_vs_industry: number;
    days_overdue: number;
    market_conditions: number;
  };
  
  recommendation: string; // "Cobrar de inmediato", "Esperar 3 días", etc
  
  created_at: string;
}

// Ejemplo:
const confidence = await fetch(
  '/api/flujo/receivables/receivable-uuid/confidence',
  { headers: { 'Authorization': `Bearer ${token}` } }
).then(r => r.json());
// { confidence_level: 'high', confidence_percentage: 92, ... }
```

---

## 🧮 ALGORITMOS CLAVE

### 1. Cálculo Capacidad Pago Semanal

```typescript
// utils/algorithms.ts

/**
 * Calcula cuánto dinero la empresa PUEDE pagar esta semana
 * sin comprometer operaciones críticas
 */
function calculatePaymentCapacity(
  cashAvailable: number,        // Dinero disponible (todas cuentas)
  criticalBuffer: number,       // Mínimo para operaciones (default: 50000 MXN)
  obligations: Obligation[]     // Pagos comprometidos
): number {
  // 1. Restar buffer crítico
  const operationalCash = Math.max(0, cashAvailable - criticalBuffer);

  // 2. Sumar obligaciones que DEBEN ejecutarse (salarios, impuestos)
  const criticalObligations = obligations
    .filter(o => o.priority === 'critical')
    .reduce((sum, o) => sum + o.amount, 0);

  // 3. Capacidad = disponible - críticas
  const capacity = operationalCash - criticalObligations;

  return Math.max(0, capacity);
}

interface Obligation {
  id: string;
  amount: number;
  priority: 'critical' | 'high' | 'medium' | 'low'; // Salario=critical, proveedor=high
  dueDate: Date;
}

// Ejemplo:
const capacity = calculatePaymentCapacity(
  150000, // cash
  50000,  // buffer
  [
    { id: '1', amount: 80000, priority: 'critical', dueDate: new Date() }, // Salario
    { id: '2', amount: 30000, priority: 'high', dueDate: new Date() },     // Proveedor
  ]
);
// Resultado: 150000 - 50000 - 80000 = 20000 MXN
```

### 2. Amortización Variable (4 Tipos)

```typescript
/**
 * Calcula el plan de amortización según tipo
 */
function generateAmortizationSchedule(
  credit: Credit,
  rules: AmortizationRules
): AmortizationPayment[] {
  switch (credit.amortization_type) {
    case 'fixed':
      return generateFixedAmortization(credit, rules);
    case 'graduated':
      return generateGraduatedAmortization(credit, rules);
    case 'balloon':
      return generateBalloonAmortization(credit, rules);
    case 'interest_only':
      return generateInterestOnlyAmortization(credit, rules);
  }
}

// FIXED: Cuota igual todos los meses
function generateFixedAmortization(
  credit: Credit,
  rules: AmortizationRules
): AmortizationPayment[] {
  const monthlyRate = credit.interest_rate / 100 / 12;
  const payments: AmortizationPayment[] = [];
  
  // Fórmula: PMT = P * [r(1+r)^n] / [(1+r)^n - 1]
  const monthlyPayment = calculateMonthlyPayment(
    credit.remaining_balance,
    monthlyRate,
    credit.term_months
  );

  let remainingBalance = credit.remaining_balance;

  for (let i = 0; i < credit.term_months; i++) {
    const interestPayment = remainingBalance * monthlyRate;
    const principalPayment = monthlyPayment - interestPayment;

    payments.push({
      payment_number: i + 1,
      payment_date: addMonths(credit.start_date, i + 1),
      principal: principalPayment,
      interest: interestPayment,
      total_payment: monthlyPayment,
      remaining_balance: remainingBalance - principalPayment,
    });

    remainingBalance -= principalPayment;
  }

  return payments;
}

// GRADUATED: Aumenta cada año
function generateGraduatedAmortization(
  credit: Credit,
  rules: AmortizationRules
): AmortizationPayment[] {
  const payments: AmortizationPayment[] = [];
  const monthlyRate = credit.interest_rate / 100 / 12;
  let remainingBalance = credit.remaining_balance;

  let monthlyPayment = rules.initial_payment;
  const annualIncreasePercent = (rules.annual_increase_percent || 0) / 100;

  for (let i = 0; i < credit.term_months; i++) {
    // Cada año (mes 12, 24, etc), aumentar pago
    if (i > 0 && i % 12 === 0) {
      monthlyPayment *= 1 + annualIncreasePercent;
    }

    const interestPayment = remainingBalance * monthlyRate;
    const principalPayment = monthlyPayment - interestPayment;

    payments.push({
      payment_number: i + 1,
      payment_date: addMonths(credit.start_date, i + 1),
      principal: Math.max(0, principalPayment),
      interest: interestPayment,
      total_payment: monthlyPayment,
      remaining_balance: Math.max(0, remainingBalance - principalPayment),
    });

    remainingBalance -= principalPayment;
  }

  return payments;
}

// BALLOON: Cuota baja, pago grande al final
function generateBalloonAmortization(
  credit: Credit,
  rules: AmortizationRules
): AmortizationPayment[] {
  const payments: AmortizationPayment[] = [];
  const monthlyRate = credit.interest_rate / 100 / 12;
  const balloonAmount = rules.balloon_amount || 0;
  const regularPayment = rules.regular_payment || 0;

  let remainingBalance = credit.remaining_balance - balloonAmount;

  for (let i = 0; i < credit.term_months; i++) {
    const isLastPayment = i === credit.term_months - 1;

    const interestPayment = remainingBalance * monthlyRate;
    const principalPayment = isLastPayment
      ? remainingBalance + balloonAmount
      : regularPayment - interestPayment;

    payments.push({
      payment_number: i + 1,
      payment_date: addMonths(credit.start_date, i + 1),
      principal: principalPayment,
      interest: interestPayment,
      total_payment: isLastPayment
        ? principalPayment + interestPayment
        : regularPayment,
      remaining_balance: isLastPayment ? 0 : remainingBalance - principalPayment,
    });

    remainingBalance -= principalPayment;
  }

  return payments;
}

// INTEREST ONLY: Solo interés mensual, principal al final
function generateInterestOnlyAmortization(
  credit: Credit,
  rules: AmortizationRules
): AmortizationPayment[] {
  const payments: AmortizationPayment[] = [];
  const monthlyRate = credit.interest_rate / 100 / 12;

  for (let i = 0; i < credit.term_months; i++) {
    const interestPayment = credit.remaining_balance * monthlyRate;
    const principalPayment = i === credit.term_months - 1
      ? credit.remaining_balance
      : 0;

    payments.push({
      payment_number: i + 1,
      payment_date: addMonths(credit.start_date, i + 1),
      principal: principalPayment,
      interest: interestPayment,
      total_payment: interestPayment + principalPayment,
      remaining_balance: i === credit.term_months - 1
        ? 0
        : credit.remaining_balance,
    });
  }

  return payments;
}

// Helper
function calculateMonthlyPayment(
  principal: number,
  monthlyRate: number,
  months: number
): number {
  if (monthlyRate === 0) return principal / months;
  return (principal * (monthlyRate * Math.pow(1 + monthlyRate, months))) /
         (Math.pow(1 + monthlyRate, months) - 1);
}
```

### 3. Optimización Excedentes (PAY / INVEST / SPLIT)

```typescript
/**
 * Recomienda qué hacer con dinero excedente
 * 1. PAY: Pagar deuda anticipadamente
 * 2. INVEST: Guardar en cuenta de alto rendimiento
 * 3. SPLIT: Dividir entre ambas opciones
 */
function recommendExcessFundsStrategy(
  excessAmount: number,
  credits: CreditProjection[],
  bankAccounts: BankAccountMulti[]
): ExcessFundsRecommendation {
  // 1. Identificar crédito con mayor interés
  const highestInterestCredit = credits.reduce((max, c) =>
    c.interest_rate > max.interest_rate ? c : max
  );

  // 2. Calcular ahorro de interés si pagamos ahora
  const interestSavings = excessAmount *
    (highestInterestCredit.interest_rate / 100) *
    (highestInterestCredit.remaining_months / 12);

  // 3. Encontrar cuenta de ahorro de alto rendimiento
  const savingsAccount = bankAccounts.find(a =>
    a.account_type === 'savings'
  );
  const savingsRate = savingsAccount ? 0.045 : 0; // Asumir 4.5% APY

  // 4. Comparar retorno
  const investmentReturns = excessAmount * savingsRate;

  // LÓGICA DE RECOMENDACIÓN
  if (interestSavings > investmentReturns * 1.5) {
    // Pagar deuda es mucho mejor
    return {
      strategy: 'PAY',
      reason: `Ahorrar ${formatMoney(interestSavings)} en intereses`,
      action: {
        type: 'pay_credit',
        credit_id: highestInterestCredit.id,
        amount: excessAmount,
      },
      expected_savings: interestSavings,
    };
  } else if (investmentReturns > interestSavings * 1.2) {
    // Invertir es mejor
    return {
      strategy: 'INVEST',
      reason: `Ganar ${formatMoney(investmentReturns)} en rendimiento`,
      action: {
        type: 'transfer_to_savings',
        account_id: savingsAccount!.id,
        amount: excessAmount,
      },
      expected_earnings: investmentReturns,
    };
  } else {
    // Similar, dividir
    const splitAmount = excessAmount / 2;
    return {
      strategy: 'SPLIT',
      reason: 'Balancear riesgo y rendimiento',
      action: {
        type: 'split',
        pay_amount: splitAmount,
        credit_id: highestInterestCredit.id,
        invest_amount: splitAmount,
        account_id: savingsAccount?.id,
      },
      expected_benefit: interestSavings / 2 + investmentReturns / 2,
    };
  }
}

interface ExcessFundsRecommendation {
  strategy: 'PAY' | 'INVEST' | 'SPLIT';
  reason: string;
  action: any;
  expected_savings?: number;
  expected_earnings?: number;
  expected_benefit?: number;
}
```

### 4. Proyección 12 Meses con Health Scoring

```typescript
/**
 * Genera proyección 12 meses + health score
 */
function generateAnnualProjection(
  organization_id: string,
  payables: Payable[],
  receivables: Receivable[],
  recurring: RecurringPayment[],
  credits: CreditProjection[],
  scenario: 'pessimistic' | 'realistic' | 'optimistic' = 'realistic'
): AnnualProjectionMonth[] {
  const months: AnnualProjectionMonth[] = [];
  const today = new Date();

  for (let m = 0; m < 12; m++) {
    const monthDate = addMonths(today, m);
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);

    // 1. Proyectar INGRESOS
    const projectedIncome = receivables
      .filter(r => r.expected_date >= monthStart && r.expected_date <= monthEnd)
      .reduce((sum, r) => {
        // Ajustar por escenario
        const adjustmentFactor = scenario === 'pessimistic' ? 0.7
                                : scenario === 'optimistic' ? 1.3
                                : 1.0;
        return sum + r.amount * adjustmentFactor;
      }, 0);

    // 2. Proyectar GASTOS
    const projectedExpenses = payables
      .filter(p => p.due_date >= monthStart && p.due_date <= monthEnd)
      .reduce((sum, p) => sum + p.amount, 0) +
      recurring
      .filter(r => isInMonth(r.next_due, monthStart, monthEnd))
      .reduce((sum, r) => sum + r.amount, 0) +
      credits
      .filter(c => c.active)
      .reduce((sum, c) => {
        // Pagos de crédito este mes
        return sum + (c.next_payment_amount || 0);
      }, 0);

    const projectedNet = projectedIncome - projectedExpenses;

    // 3. Calcular HEALTH SCORE
    const healthScore = calculateHealthScore({
      projected_net: projectedNet,
      current_balance: getCurrentBalance(monthStart),
      obligations_overdue: getOverdueObligations(monthStart),
      debt_ratio: calculateDebtRatio(credits),
    });

    months.push({
      month_date: formatISO(monthStart),
      projected_income: projectedIncome,
      projected_expenses: projectedExpenses,
      projected_net: projectedNet,
      health_score: healthScore,
      health_indicator: healthScore >= 70 ? 'healthy'
                       : healthScore >= 40 ? 'caution'
                       : 'critical',
      confidence_score: calculateProjectionConfidence(m), // Más lejano = menos confianza
    });
  }

  return months;
}

/**
 * Health Score: 0-100
 * Factores:
 * - Net cash flow positivo: +30 pts
 * - Debt ratio < 40%: +20 pts
 * - Sin obligaciones vencidas: +20 pts
 * - Buffer de caja > 50k: +20 pts
 * - Proyección estable (varianza baja): +10 pts
 */
function calculateHealthScore(factors: {
  projected_net: number;
  current_balance: number;
  obligations_overdue: number;
  debt_ratio: number;
}): number {
  let score = 50; // Base

  if (factors.projected_net > 0) score += 30;
  if (factors.debt_ratio < 0.4) score += 20;
  if (factors.obligations_overdue === 0) score += 20;
  if (factors.current_balance > 50000) score += 20;

  return Math.min(100, Math.max(0, score));
}
```

### 5. Transfer Recommendations Multi-Cuenta

```typescript
/**
 * Recomienda transferencias entre cuentas
 * Objetivo: optimizar saldos, aprovechar tasas, gestionar riesgo
 */
function recommendAccountTransfers(
  accounts: BankAccountMulti[],
  upcomingPayments: Payment[],
  receivedFunds: Receivable[]
): MultiAccountRecommendation[] {
  const recommendations: MultiAccountRecommendation[] = [];

  // 1. EQUILIBRAR: Si una cuenta está muy baja, transferir desde otra
  const lowBalanceAccount = accounts.find(a => a.available_balance < 20000);
  const highBalanceAccount = accounts.find(
    a => a.available_balance > 100000 && a.id !== lowBalanceAccount?.id
  );

  if (lowBalanceAccount && highBalanceAccount) {
    const transferAmount = Math.min(
      50000,
      highBalanceAccount.available_balance - 50000
    );

    if (transferAmount > 0) {
      recommendations.push({
        from_account_id: highBalanceAccount.id,
        to_account_id: lowBalanceAccount.id,
        recommended_amount: transferAmount,
        reason: 'Equilibrar saldos',
        urgency: 'medium',
        confidence_score: 85,
      });
    }
  }

  // 2. PREPOSICIONAR: Mover dinero a cuenta de pagos antes de vencimiento
  const paymentAccount = accounts.find(a => a.account_name.includes('Pagos'));
  if (paymentAccount) {
    const totalDueThisWeek = upcomingPayments
      .filter(p => daysUntil(p.due_date) <= 7)
      .reduce((sum, p) => sum + p.amount, 0);

    const shortfall = Math.max(
      0,
      totalDueThisWeek - paymentAccount.available_balance
    );

    if (shortfall > 0) {
      const sourceAccount = accounts
        .filter(a => a.id !== paymentAccount.id)
        .sort((a, b) => b.available_balance - a.available_balance)[0];

      if (sourceAccount && sourceAccount.available_balance > shortfall) {
        recommendations.push({
          from_account_id: sourceAccount.id,
          to_account_id: paymentAccount.id,
          recommended_amount: shortfall + 10000, // +10k buffer
          reason: `Fondear pagos de la semana (${formatMoney(totalDueThisWeek)})`,
          urgency: 'high',
          confidence_score: 95,
        });
      }
    }
  }

  return recommendations;
}
```

### 6. Payment Confidence (AI/ML Color Coding)

```typescript
/**
 * Predice probabilidad de cobro usando factores históricos
 */
function calculatePaymentConfidence(
  receivable: Receivable,
  historicalData?: DebtorHistory
): PaymentConfidenceResult {
  let confidence = 50; // Base neutral

  // Factor 1: Historia del deudor (-20 a +20)
  if (historicalData) {
    const onTimeRate = historicalData.payments_on_time /
                       historicalData.total_payments;
    const historyScore = (onTimeRate - 0.5) * 40; // -20 a +20
    confidence += historyScore;
  }

  // Factor 2: Cantidad vs industria (-15 a +15)
  const industryAverage = 50000; // Asumido
  const amountFactor = Math.min(1, receivable.amount / industryAverage);
  confidence += (amountFactor - 0.5) * 30;

  // Factor 3: Días desde emisión (si está cerca, más probable)
  const daysSinceInvoice = daysUntil(receivable.expected_date);
  if (daysSinceInvoice <= 7) confidence += 15;
  if (daysSinceInvoice > 60) confidence -= 20;

  // Factor 4: Condiciones de mercado (TIIE, indicadores económicos)
  const marketFactor = getMarketConditionsFactor(); // -10 a +10
  confidence += marketFactor;

  // Clamp a 0-100
  confidence = Math.max(0, Math.min(100, confidence));

  // Categorizar
  const level: 'high' | 'medium' | 'low' | 'unknown' =
    confidence >= 75 ? 'high'
    : confidence >= 50 ? 'medium'
    : confidence >= 25 ? 'low'
    : 'unknown';

  return {
    confidence_level: level,
    confidence_percentage: confidence,
    factors: {
      debtor_history: historicalData ? (onTimeRate - 0.5) * 40 : 0,
      amount_vs_industry: amountFactor - 0.5,
      days_overdue: daysSinceInvoice,
      market_conditions: marketFactor,
    },
    recommendation: getConfidenceRecommendation(level, confidence),
  };
}

function getConfidenceRecommendation(
  level: string,
  percentage: number
): string {
  if (level === 'high') return 'Esperar, alta probabilidad de cobro';
  if (level === 'medium') {
    if (percentage > 60)
      return 'Seguimiento suave, probable cobro en 5 días';
    return 'Contactar para confirmar pago';
  }
  if (level === 'low') return 'Seguimiento agresivo, riesgo de mora';
  return 'Datos insuficientes, recolectar información';
}
```

---

## 📘 TIPOS TYPESCRIPT

```typescript
// apps/mobile/app/flujocheck/types/index.ts

/**
 * CORE ENTITIES
 */

export interface CashFlowPeriod {
  id: string;
  organization_id: string;
  week_start: string; // ISO date
  week_end: string;
  period_status: 'open' | 'closed' | 'archived';
  cash_available: number;
  cash_committed: number;
  cash_buffer: number;
  health_score: number; // 0-100
  created_at: string;
  updated_at: string;
}

export interface Payable {
  id: string;
  cash_flow_period_id: string;
  organization_id: string;
  description: string;
  creditor_name: string;
  amount: number;
  due_date: string; // ISO date
  payment_status: 'pending' | 'partial' | 'paid' | 'overdue';
  recurring: boolean;
  recurring_type?: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual';
  document_url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Receivable {
  id: string;
  cash_flow_period_id: string;
  organization_id: string;
  description: string;
  debtor_name: string;
  amount: number;
  expected_date: string; // ISO date
  collection_status: 'pending' | 'partial' | 'collected' | 'overdue';
  invoice_number?: string;
  document_url?: string;
  created_at: string;
  updated_at: string;
}

export interface CreditProjection {
  id: string;
  organization_id: string;
  credit_name: string;
  original_amount: number;
  remaining_balance: number;
  interest_rate: number; // Porcentaje: 2.5 = 2.5%
  term_months: number;
  start_date: string;
  end_date: string;
  amortization_type: AmortizationType;
  next_payment_date?: string;
  next_payment_amount?: number;
  total_paid: number;
  total_interest_paid: number;
  credit_status: 'active' | 'paid_off' | 'default';
  created_at: string;
  updated_at: string;
}

export type AmortizationType = 'fixed' | 'graduated' | 'balloon' | 'interest_only';

export interface PaymentSchedule {
  id: string;
  payable_id: string;
  scheduled_date: string;
  scheduled_amount: number;
  paid_amount: number;
  payment_status: 'pending' | 'partial' | 'paid';
  payment_method?: 'bank_transfer' | 'cash' | 'check' | 'credit_card';
  confirmed: boolean;
  created_at: string;
  updated_at: string;
}

export interface WeeklyPaymentPlan {
  id: string;
  cash_flow_period_id: string;
  organization_id: string;
  day_of_week: number; // 1-7 (Lunes-Domingo)
  payment_priority: number; // 1=crítico, 4=bajo
  total_planned: number;
  total_executed: number;
  execution_status: 'pending' | 'partial' | 'completed';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CreditAmortizationRules {
  id: string;
  credit_projection_id: string;
  amortization_type: AmortizationType;
  fixed_payment?: number;
  initial_payment?: number;
  annual_increase_percent?: number;
  balloon_amount?: number;
  regular_payment?: number;
  interest_payment?: number;
  principal_payment_frequency?: string;
  extra_payment_strategy?: 'none' | 'aggressive' | 'balanced';
  created_at: string;
  updated_at: string;
}

export interface RecurringPayment {
  id: string;
  organization_id: string;
  description: string;
  amount: number;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual';
  next_due: string;
  automated: boolean;
  payment_method?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CashFlowTransaction {
  id: string;
  cash_flow_period_id: string;
  organization_id: string;
  transaction_type: 'payment' | 'collection' | 'transfer' | 'adjustment';
  category: 'payable' | 'receivable' | 'recurring' | 'reserve';
  description: string;
  amount: number;
  transaction_date: string;
  related_payable_id?: string;
  related_receivable_id?: string;
  related_credit_id?: string;
  from_account_id?: string;
  to_account_id?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface BankAccountMulti {
  id: string;
  organization_id: string;
  account_name: string;
  bank_name: string;
  account_number: string;
  currency: string;
  available_balance: number;
  total_balance: number;
  account_type: 'checking' | 'savings' | 'credit_card';
  is_primary: boolean;
  connected: boolean;
  last_sync?: string;
  created_at: string;
  updated_at: string;
}

export interface MultiAccountRecommendation {
  id: string;
  organization_id: string;
  from_account_id: string;
  to_account_id: string;
  recommended_amount: number;
  reason: string;
  urgency: 'low' | 'medium' | 'high';
  confidence_score: number; // 0-100
  status: 'pending' | 'accepted' | 'executed' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface PaymentCollectionConfidence {
  id: string;
  receivable_id: string;
  confidence_level: 'high' | 'medium' | 'low' | 'unknown';
  confidence_percentage: number;
  ml_features?: Record<string, any>;
  created_at: string;
  last_updated: string;
}

export interface AnnualProjection {
  id: string;
  organization_id: string;
  month_date: string;
  projected_income: number;
  projected_expenses: number;
  projected_net: number;
  confidence_score: number;
  scenario: 'pessimistic' | 'realistic' | 'optimistic';
  health_indicator: 'healthy' | 'caution' | 'critical';
  created_at: string;
  updated_at: string;
}

export interface EconomicIndicator {
  id: string;
  indicator_type: 'TIIE' | 'UDI' | 'inflation_rate' | 'exchange_rate';
  indicator_value: number;
  measurement_date: string;
  source: string;
  created_at: string;
}

/**
 * VIEW MODELS (para componentes)
 */

export interface DashboardViewModel {
  period: CashFlowPeriod;
  weeklyMetrics: WeeklyMetrics;
  payables: Payable[];
  receivables: Receivable[];
  credits: CreditProjection[];
  weeklyPlan: WeeklyPaymentPlan[];
  recommendations: Recommendations;
  healthScore: HealthScoreView;
  accounts: BankAccountMulti[];
}

export interface WeeklyMetrics {
  cash_available: number;
  cash_committed: number;
  cash_buffer: number;
  payment_capacity: number;
}

export interface Recommendations {
  transfers: MultiAccountRecommendation[];
  payments: PaymentRecommendation[];
}

export interface PaymentRecommendation {
  payable_id: string;
  reason: string;
  suggested_amount: number;
  suggested_date: string;
  urgency: 'low' | 'medium' | 'high';
}

export interface HealthScoreView {
  score: number; // 0-100
  status: 'healthy' | 'caution' | 'critical';
  factors: HealthFactor[];
}

export interface HealthFactor {
  name: string;
  impact: number; // -30 a +30
  description: string;
}

export interface AmortizationPayment {
  payment_number: number;
  payment_date: string;
  principal: number;
  interest: number;
  total_payment: number;
  remaining_balance: number;
}

export interface AmortizationSchedule {
  credit_id: string;
  amortization_type: AmortizationType;
  total_payments: number;
  total_interest: number;
  payments: AmortizationPayment[];
}

export interface PaymentConfidenceResult {
  confidence_level: 'high' | 'medium' | 'low' | 'unknown';
  confidence_percentage: number;
  factors: {
    debtor_history: number;
    amount_vs_industry: number;
    days_overdue: number;
    market_conditions: number;
  };
  recommendation: string;
}

export interface CreditScanResult {
  credit_id: string;
  extracted_data: {
    credit_name: string;
    original_amount: number;
    interest_rate: number;
    term_months: number;
    start_date: string;
    end_date: string;
    next_payment_date?: string;
    next_payment_amount?: number;
  };
  confidence: number; // 0-100
  warnings?: string[];
}
```

---

## 🧪 TEST STUBS INICIALES

```typescript
// apps/mobile/app/flujocheck/__tests__/algorithms.test.ts

import {
  calculatePaymentCapacity,
  generateAmortizationSchedule,
  generateFixedAmortization,
  generateGraduatedAmortization,
  generateBalloonAmortization,
} from '../utils/algorithms';

describe('Payment Capacity', () => {
  test('Calcula capacidad correctamente sin obligaciones', () => {
    const capacity = calculatePaymentCapacity(
      150000, // cash
      50000,  // buffer
      []      // obligaciones
    );
    expect(capacity).toBe(100000);
  });

  test('Resta obligaciones críticas', () => {
    const capacity = calculatePaymentCapacity(
      150000,
      50000,
      [
        { id: '1', amount: 80000, priority: 'critical', dueDate: new Date() },
        { id: '2', amount: 30000, priority: 'high', dueDate: new Date() },
      ]
    );
    // 150000 - 50000 (buffer) - 80000 (crítica) = 20000
    expect(capacity).toBe(20000);
  });

  test('No permite capacidad negativa', () => {
    const capacity = calculatePaymentCapacity(
      100000,
      50000,
      [{ id: '1', amount: 100000, priority: 'critical', dueDate: new Date() }]
    );
    expect(capacity).toBeGreaterThanOrEqual(0);
  });
});

describe('Fixed Amortization', () => {
  test('Genera 60 cuotas iguales para crédito de 5 años', () => {
    const credit = {
      remaining_balance: 100000,
      interest_rate: 12, // 12% anual
      term_months: 60,
      start_date: new Date('2026-07-01'),
    };

    const schedule = generateFixedAmortization(credit, {});
    
    expect(schedule.length).toBe(60);
    expect(schedule[0].total_payment).toBeCloseTo(schedule[59].total_payment, 2);
  });

  test('Principal + Interés = Total Payment', () => {
    const credit = {
      remaining_balance: 50000,
      interest_rate: 10,
      term_months: 24,
      start_date: new Date('2026-07-01'),
    };

    const schedule = generateFixedAmortization(credit, {});
    
    schedule.forEach(payment => {
      expect(payment.principal + payment.interest)
        .toBeCloseTo(payment.total_payment, 2);
    });
  });

  test('Saldo final es cero', () => {
    const credit = {
      remaining_balance: 30000,
      interest_rate: 8,
      term_months: 36,
      start_date: new Date('2026-07-01'),
    };

    const schedule = generateFixedAmortization(credit, {});
    
    expect(schedule[schedule.length - 1].remaining_balance)
      .toBeCloseTo(0, 2);
  });
});

describe('Graduated Amortization', () => {
  test('Cuota aumenta cada año', () => {
    const credit = {
      remaining_balance: 100000,
      interest_rate: 12,
      term_months: 60,
      start_date: new Date('2026-07-01'),
    };

    const rules = {
      initial_payment: 2000,
      annual_increase_percent: 5, // Aumenta 5% cada año
    };

    const schedule = generateGraduatedAmortization(credit, rules);
    
    // Mes 12: cuota original
    // Mes 13: cuota aumentada 5%
    expect(schedule[12].total_payment)
      .toBeLessThan(schedule[13].total_payment);
  });
});

describe('Balloon Amortization', () => {
  test('Última cuota es mucho mayor', () => {
    const credit = {
      remaining_balance: 100000,
      interest_rate: 10,
      term_months: 60,
      start_date: new Date('2026-07-01'),
    };

    const rules = {
      balloon_amount: 40000,
      regular_payment: 1500,
    };

    const schedule = generateBalloonAmortization(credit, rules);
    
    const firstPayment = schedule[0].total_payment;
    const lastPayment = schedule[59].total_payment;
    
    expect(lastPayment).toBeGreaterThan(firstPayment * 2);
  });
});

describe('Annual Projection', () => {
  test('Proyecta 12 meses correctamente', () => {
    const projection = generateAnnualProjection(
      'org-123',
      [],
      [],
      [],
      [],
      'realistic'
    );

    expect(projection.length).toBe(12);
    projection.forEach((month, i) => {
      expect(month.health_score).toBeGreaterThanOrEqual(0);
      expect(month.health_score).toBeLessThanOrEqual(100);
    });
  });

  test('Mes crítico (proyección negativa) reduce health score', () => {
    // Crear proyección con mes crítico
    const payables = [
      {
        id: '1',
        due_date: new Date('2026-08-15'),
        amount: 500000, // Gasto muy alto
      },
    ];

    const projection = generateAnnualProjection(
      'org-123',
      payables,
      [],
      [],
      [],
      'realistic'
    );

    const augustMonth = projection.find(m => m.month_date.includes('2026-08'));
    expect(augustMonth?.health_indicator).toBe('caution' || 'critical');
  });
});
```

---

## 📝 MIGRATION SQL TEMPLATE

```sql
-- FILE: apps/mobile/supabase/migrations/20260705_001_flujocheck.sql

-- Ejecutar con:
-- npx supabase migration up --project-ref <PROJECT_ID>

BEGIN;

-- 1. Crear todas las tablas (ver SCHEMA SQL COMPLETO arriba)

-- 2. Crear índices para optimización de queries
CREATE INDEX idx_cash_flow_periods_org_week 
  ON cash_flow_periods(organization_id, week_start DESC);
CREATE INDEX idx_payables_org_due 
  ON payables(organization_id, due_date ASC);
-- ... (rest de índices en SCHEMA SQL COMPLETO)

-- 3. Crear vistas útiles para dashboard
CREATE OR REPLACE VIEW v_weekly_summary AS
SELECT 
  cfp.id,
  cfp.organization_id,
  cfp.week_start,
  cfp.week_end,
  COALESCE(SUM(CASE WHEN p.payment_status != 'paid' THEN p.amount ELSE 0 END), 0) as total_payables,
  COALESCE(SUM(CASE WHEN r.collection_status != 'collected' THEN r.amount ELSE 0 END), 0) as total_receivables,
  cfp.health_score
FROM cash_flow_periods cfp
LEFT JOIN payables p ON p.cash_flow_period_id = cfp.id
LEFT JOIN receivables r ON r.cash_flow_period_id = cfp.id
GROUP BY cfp.id, cfp.organization_id, cfp.week_start, cfp.week_end, cfp.health_score;

-- 4. Seed data para testing (OPCIONAL)
INSERT INTO cash_flow_periods (organization_id, week_start, week_end, cash_available, health_score)
VALUES (
  'org-test-123',
  '2026-07-07'::DATE,
  '2026-07-13'::DATE,
  150000,
  85
) ON CONFLICT DO NOTHING;

COMMIT;
```

---

## ✅ CHECKLIST IMPLEMENTACIÓN PARA DANIEL

```
## FASE 1: ESTRUCTURA BÁSICA (Día 1)
☐ Crear carpeta estructura (apps/mobile/app/flujocheck/*)
☐ Implementar TopBar (reutilizable, accent BRAND.blue)
☐ Implementar BottomTabBar (5 tabs, badges)
☐ Implementar DashboardWidget (tarjeta base)
☐ Setup de constantes (BRAND, SPACING, MODULE_COLORS)
☐ Setup tipos TypeScript (types/index.ts)

## FASE 2: COMPONENTES VISUALES (Día 2-3)
☐ HealthIndicator (semáforo 0-100)
☐ PaymentConfidenceBar (color scoring AI/ML)
☐ RecommendationCard (para transfers/pagos)
☐ Estilos CSS consistentes

## FASE 3: PANTALLA FLUJO DASHBOARD (Día 4-5)
☐ Screen: FlujoDashboard/index.tsx
☐ Hook: useWeeklyData (cargar período actual)
☐ Renderizar widgets: cash_available, cash_committed, capacity
☐ Renderizar payables/receivables lista
☐ Conectar API GET /flujo/dashboard

## FASE 4: PANTALLA CRÉDITOS (Día 6-7)
☐ Screen: CreditosPanel/index.tsx
☐ Listar créditos activos
☐ OCRScanner (captura documento)
☐ Modal amortización (editar reglas)
☐ Conectar API POST /flujo/credit-scan

## FASE 5: PANTALLA PROYECCIÓN (Día 8-9)
☐ Screen: ProyeccionAnual/index.tsx
☐ Renderizar 12 meses con health scoring
☐ Gráfica evolución health score
☐ Conectar API GET /flujo/projection/annual

## FASE 6: INTEGRACIÓN API (Día 10-11)
☐ Implementar todos endpoints en /api/flujo/*
☐ RLS policies en Supabase
☐ Migrations SQL
☐ Manejo de errores/estados

## FASE 7: TESTING (Día 12-13)
☐ Unit tests: algoritmos amortización
☐ Unit tests: proyección 12 meses
☐ Integration tests: API endpoints
☐ E2E: flujo completo usuario

## FASE 8: PULIDO (Día 14-15)
☐ Revisar performance (re-renders innecesarios)
☐ Revisar accesibilidad (colores, contraste)
☐ Testing en todos los roles (admin, supervisor, accountant)
☐ Documentación inline código
```

---

## 📌 REFERENCIAS RÁPIDAS

**Constantes BRAND:**
```typescript
const BRAND = {
  blue: '#3498DB',       // FlujoCheck accent
  green: '#26A65B',      // GastoCheck
  cobra: '#2ECC71',      // CobraCheck
  red: '#E74C3C',        // Alertas/errors
  gray: '#F5F7FA',       // Background
};
```

**Rutas archivos clave:**
- `apps/mobile/app/flujocheck/types/index.ts` → Todas las interfaces
- `apps/mobile/app/flujocheck/utils/algorithms.ts` → Lógica cálculos
- `apps/mobile/app/flujocheck/services/api.ts` → Cliente HTTP
- `packages/shared/supabase/migrations/` → SQL migrations

**Endpoints base:**
```
POST   /api/flujo/periods
GET    /api/flujo/dashboard
POST   /api/flujo/credit-scan
GET    /api/flujo/projection/annual
POST   /api/flujo/simulate-payment
GET    /api/flujo/receivables/{id}/confidence
```

---

**STATUS**: Listo 100% para Daniel. Sin preguntas, código listo para escribir.

**Próximos pasos después de implementar:**
1. Ejecutar migrations SQL en Supabase
2. Testing en todos los roles
3. Integración con GastoCheck (datos cuentas, pagos)
4. Publicar en EAS Testing
5. Feedback usuarios → OTA cycle

