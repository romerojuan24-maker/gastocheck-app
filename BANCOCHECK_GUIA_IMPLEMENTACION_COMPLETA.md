# 🏦 BancoCheck — Guía Completa de Implementación

**Versión**: 1.0  
**Autor**: Juan Romero  
**Fecha**: 2026-07-05  
**Destinatario**: Daniel (Implementación)  
**Estado**: Ready for Development  

---

## 📋 TABLA DE CONTENIDOS

1. [Visión General](#1-visión-general)
2. [Estructura de Carpetas](#2-estructura-de-carpetas)
3. [Componentes Reutilizables](#3-componentes-reutilizables)
4. [Schema SQL Completo](#4-schema-sql-completo)
5. [API Endpoints](#5-api-endpoints)
6. [Algoritmos OCR](#6-algoritmos-ocr)
7. [Algoritmo Matching](#7-algoritmo-matching)
8. [OAuth Flows](#8-oauth-flows)
9. [Sistema de Alertas Admin](#9-sistema-de-alertas-admin)
10. [Tipos TypeScript](#10-tipos-typescript)
11. [Test Stubs](#11-test-stubs)
12. [Migration SQL Template](#12-migration-sql-template)

---

## 1. VISIÓN GENERAL

**BancoCheck** es el módulo de CHECK SUITE para reconciliación y análisis de movimientos bancarios.

### Alcance MVP
- ✅ Importar estados de cuenta (PDF/JPG) vía OCR
- ✅ Conectar cuentas bancarias automáticas (OAuth BBVA, Santander)
- ✅ Unificar transacciones manual + automática
- ✅ Matching automático (fecha ± 2 días, monto exacto)
- ✅ Reconciliación visual (matched, unmatched, disputed)
- ✅ Admin alerts para bancos nuevos (feature request)

### Usuarios Objetivo
- **Contador General**: Reconciliación, reportes, análisis
- **Admin**: Configuración, integración bancos, alertas clientes
- **Supervisor**: Consulta transacciones (read-only)

### Color Módulo
- **Accent**: `#FF6B35` (Naranja)
- **Background**: `#F5F7FA` (Gray CHECK SUITE)
- **Surface**: `#FFFFFF`

---

## 2. ESTRUCTURA DE CARPETAS

```
apps/mobile/app/bancocheck/
├── index.tsx                    # Entry point (TabBar + Router)
├── hooks/
│   ├── useBankAccounts.ts       # Query: GET /banco/accounts
│   ├── useBankTransactions.ts   # Query: GET /banco/transactions
│   ├── useOCRImport.ts          # Mutation: POST /banco/import-statement
│   ├── useOAuthBanks.ts         # Mutation: POST /banco/oauth-callback
│   └── useReconciliation.ts     # Query/Mutation: reconciliation status
├── screens/
│   ├── CuentasScreen.tsx        # Tab 0: Conectadas + status
│   ├── TransaccionesScreen.tsx  # Tab 1: Lista con matching status
│   ├── ReconciliacionScreen.tsx # Tab 2: Dashboard reconciliación
│   ├── ImportarScreen.tsx       # Tab 3: Upload PDF/JPG + OCR
│   └── PerfilScreen.tsx         # Tab 4: Profile (shared component)
├── components/
│   ├── TopBar.tsx               # Shared (ver DESIGN_SYSTEM)
│   ├── BottomTabBar.tsx         # Shared
│   ├── BankAccountCard.tsx      # Tarjeta cuenta (saldo, estado)
│   ├── TransactionListItem.tsx  # Fila transacción (icon, monto, estado)
│   ├── OCRUploadZone.tsx        # Drag & drop PDF/JPG
│   ├── MatchingBadge.tsx        # ✅ Matched / ⚠️ Unmatched / ❌ Disputed
│   ├── ReconciliationChart.tsx  # SVG: porcentaje matched
│   └── OAuthButton.tsx          # "Conectar BBVA" / "Conectar Santander"
├── utils/
│   ├── ocrExtraction.ts         # OCR field extraction logic
│   ├── transactionMatching.ts   # Matching algorithm
│   ├── deduplication.ts         # Evitar duplicados
│   └── bankFormatDetection.ts   # Identificar banco (BBVA/Santander/etc)
├── styles/
│   ├── colors.ts                # BRAND.colors + MODULE_COLORS.bancocheck
│   ├── spacing.ts               # SPACING constants
│   └── common.ts                # Shared StyleSheet
└── constants/
    ├── bankNames.ts             # Enum: BBVA, Santander, Banamex, etc.
    └── ocrConfig.ts             # Tesseract config, field patterns

apps/web/app/api/banco/
├── import-statement.ts          # POST handler (file upload)
├── accounts.ts                  # GET/POST handlers
├── oauth-callback.ts            # OAuth redirect handler
├── transactions.ts              # GET (con matching status)
├── manual-match.ts              # POST (relacionar transacciones)
└── admin/
    └── unsupported-banks.ts     # GET admin tracking

packages/shared/src/types/banco/
├── index.ts                     # Exports
├── BankAccount.ts               # Interface
├── BankTransaction.ts           # Interface
├── OCRConfig.ts                 # Interface
├── MatchingResult.ts            # Interface
└── UnsupportedBankRequest.ts    # Interface
```

---

## 3. COMPONENTES REUTILIZABLES

### 3.1 TopBar

```typescript
// apps/mobile/app/bancocheck/components/TopBar.tsx
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { BRAND } from '@/constants/brand';

const ACCENT = '#FF6B35'; // BancoCheck naranja

interface TopBarProps {
  moduleTitle?: string;      // Default: "BancoCheck"
  rightIcon?: string;        // Default: ⚙️
  onRight?: () => void;
  onSwitcher?: () => void;   // Admin only
  showSwitcher?: boolean;
}

export function TopBar({
  moduleTitle = 'BancoCheck',
  rightIcon = '⚙️',
  onRight,
  onSwitcher,
  showSwitcher = false,
}: TopBarProps) {
  const router = useRouter();

  return (
    <View style={styles.topBar}>
      <TouchableOpacity 
        onPress={() => router.back()} 
        style={styles.topBarBack} 
        activeOpacity={0.7}
      >
        <Text style={styles.topBarBackText}>‹ CHECK SUITE</Text>
      </TouchableOpacity>

      <View style={styles.topBarCenter}>
        <Text style={styles.topBarWordA}>Banco</Text>
        <Text style={[styles.topBarWordB, { color: ACCENT }]}>Check</Text>
      </View>

      <View style={styles.topBarRightGroup}>
        {showSwitcher && (
          <TouchableOpacity 
            onPress={onSwitcher} 
            style={styles.topBarIcon} 
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 20 }}>👁</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity 
          onPress={onRight} 
          style={styles.topBarIcon} 
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 20 }}>{rightIcon}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E6ED',
  },
  topBarBack: {
    padding: 8,
  },
  topBarBackText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  topBarCenter: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  topBarWordA: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  topBarWordB: {
    fontSize: 16,
    fontWeight: '700',
  },
  topBarRightGroup: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  topBarIcon: {
    padding: 8,
  },
});
```

### 3.2 BottomTabBar

```typescript
// apps/mobile/app/bancocheck/components/BottomTabBar.tsx
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

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
  accentColor = '#FF6B35',
}: BottomTabBarProps) {
  return (
    <View style={[styles.tabBar, { borderTopColor: accentColor + '30' }]}>
      {tabs.map((tab, i) => (
        <TouchableOpacity
          key={i}
          style={[
            styles.tabItem,
            activeTab === i && [
              styles.tabItemActive,
              { backgroundColor: accentColor + '10' },
            ],
          ]}
          onPress={() => onTabChange(i)}
          activeOpacity={0.8}
        >
          <Text style={styles.tabIcon}>{tab.icon}</Text>

          {tab.badge && tab.badge > 0 && (
            <View style={[styles.badge, { backgroundColor: BRAND.red }]}>
              <Text style={styles.badgeText}>{tab.badge}</Text>
            </View>
          )}

          <Text
            style={[
              styles.tabLabel,
              activeTab === i
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
    paddingVertical: 8,
    position: 'relative',
  },
  tabItemActive: {
    borderRadius: 12,
    marginHorizontal: 4,
  },
  tabIcon: {
    fontSize: 22,
    marginBottom: 4,
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
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
```

### 3.3 BankAccountCard

```typescript
// apps/mobile/app/bancocheck/components/BankAccountCard.tsx
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BankAccount } from '@packages/shared/types/banco';

interface BankAccountCardProps {
  account: BankAccount;
  onPress?: () => void;
}

export function BankAccountCard({ account, onPress }: BankAccountCardProps) {
  const getStatusBadge = (status: 'active' | 'expired' | 'error') => {
    const badges = {
      active: { bg: '#D1FAE5', text: '#065F46', label: '✅ Activa' },
      expired: { bg: '#FEE2E2', text: '#7F1D1D', label: '⚠️ Expirada' },
      error: { bg: '#FEE2E2', text: '#7F1D1D', label: '❌ Error' },
    };
    return badges[status];
  };

  const badge = getStatusBadge(account.status);

  return (
    <TouchableOpacity 
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.bankName}>{account.bankName}</Text>
          <Text style={styles.accountNumber}>
            {account.accountType} • {account.accountNumber?.slice(-4)}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.statusText, { color: badge.text }]}>
            {badge.label}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.details}>
        <View>
          <Text style={styles.label}>Saldo</Text>
          <Text style={styles.balance}>
            ${account.currentBalance?.toLocaleString('es-MX')}
          </Text>
        </View>

        <View>
          <Text style={styles.label}>Tipo</Text>
          <Text style={styles.type}>
            {account.connectionType === 'oauth' ? '🔌 OAuth' : '📄 Manual'}
          </Text>
        </View>

        {account.lastSyncAt && (
          <View>
            <Text style={styles.label}>Última sync</Text>
            <Text style={styles.sync}>
              {new Date(account.lastSyncAt).toLocaleDateString('es-MX')}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E6ED',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  bankName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  accountNumber: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E6ED',
    marginBottom: 12,
  },
  details: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    marginBottom: 4,
  },
  balance: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF6B35',
  },
  type: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  sync: {
    fontSize: 12,
    color: '#64748B',
  },
});
```

### 3.4 TransactionListItem

```typescript
// apps/mobile/app/bancocheck/components/TransactionListItem.tsx
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BankTransaction } from '@packages/shared/types/banco';

interface TransactionListItemProps {
  transaction: BankTransaction;
  onPress?: () => void;
}

export function TransactionListItem({
  transaction,
  onPress,
}: TransactionListItemProps) {
  const isIncome = transaction.type === 'credit';
  const amountColor = isIncome ? '#16A34A' : '#DC2626';
  const amountSign = isIncome ? '+' : '-';

  const getMatchingBadge = (status: 'matched' | 'unmatched' | 'disputed') => {
    const badges = {
      matched: { icon: '✅', bg: '#D1FAE5', text: '#065F46' },
      unmatched: { icon: '⚠️', bg: '#FEF3C7', text: '#92400E' },
      disputed: { icon: '❌', bg: '#FEE2E2', text: '#7F1D1D' },
    };
    return badges[status];
  };

  const badge = getMatchingBadge(transaction.matchingStatus);

  return (
    <TouchableOpacity
      style={styles.item}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.left}>
        <Text style={styles.description}>{transaction.description}</Text>
        <Text style={styles.date}>
          {new Date(transaction.transactionDate).toLocaleDateString('es-MX')}
        </Text>
      </View>

      <View style={styles.right}>
        <View
          style={[
            styles.matchingBadge,
            { backgroundColor: badge.bg },
          ]}
        >
          <Text style={{ fontSize: 12, color: badge.text }}>
            {badge.icon}
          </Text>
        </View>

        <Text style={[styles.amount, { color: amountColor }]}>
          {amountSign}${Math.abs(transaction.amount).toLocaleString('es-MX')}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E6ED',
    backgroundColor: '#fff',
  },
  left: {
    flex: 1,
  },
  description: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
    color: '#94A3B8',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  matchingBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  amount: {
    fontSize: 14,
    fontWeight: '700',
    minWidth: 100,
    textAlign: 'right',
  },
});
```

---

## 4. SCHEMA SQL COMPLETO

### 4.1 Core Tables

```sql
-- ===== CUENTAS BANCARIAS MANUALES (OCR) =====
create table banco.bank_accounts_manual (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  bank_name text not null,
  account_number text not null,
  account_type text not null,  -- "Corriente", "Ahorro"
  account_holder text,
  currency text default 'MXN',
  current_balance decimal(18, 2),
  opening_balance decimal(18, 2),
  
  created_at timestamp default now(),
  updated_at timestamp default now(),
  deleted_at timestamp,
  
  unique(organization_id, account_number, deleted_at)
);

-- ===== CUENTAS BANCARIAS AUTOMÁTICAS (OAuth) =====
create table banco.bank_accounts_automated (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  
  bank_name text not null,        -- "BBVA", "Santander", "Banamex"
  account_number text not null,
  account_type text,
  account_holder text,
  currency text default 'MXN',
  current_balance decimal(18, 2),
  
  -- OAuth connection
  oauth_provider text not null,   -- "bbva", "santander"
  oauth_user_id text,             -- User ID en el sistema del banco
  oauth_access_token text encrypted,  -- Stored encrypted
  oauth_refresh_token text encrypted,
  oauth_token_expires_at timestamp,
  
  -- Metadata
  connection_status text default 'active',  -- "active", "expired", "error"
  last_sync_at timestamp,
  last_sync_error text,
  
  created_at timestamp default now(),
  updated_at timestamp default now(),
  deleted_at timestamp,
  
  unique(organization_id, account_number, oauth_provider, deleted_at)
);

-- ===== IMPORTACIONES DE EXTRACTOS =====
create table banco.bank_statement_imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  
  bank_account_id uuid,  -- Puede ser NULL si es OCR sin cuenta predefinida
  file_path text not null,           -- Path en storage (PDF/JPG)
  file_name text not null,
  file_type text,                    -- "application/pdf", "image/jpeg"
  file_size_bytes integer,
  
  -- Metadata OCR
  bank_detected text,                -- Banco detectado por OCR
  detected_confidence float,         -- 0.0-1.0
  
  -- Estado procesamiento
  processing_status text default 'pending',  -- "pending", "processing", "completed", "failed"
  processing_error text,
  
  extracted_transactions_count integer default 0,
  created_at timestamp default now(),
  processed_at timestamp,
  
  unique(id, organization_id)
);

-- ===== TRANSACCIONES BANCARIAS (Unificadas: OCR + OAuth) =====
create table banco.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  
  bank_account_id uuid,  -- Referencia a banco_accounts_* (manual u oauth)
  bank_account_type text,  -- "manual", "oauth"
  
  -- De dónde viene
  import_id uuid references banco.bank_statement_imports(id) on delete set null,  -- NULL si OAuth
  
  -- Datos transacción
  transaction_date date not null,
  posting_date date,  -- Fecha en que se hizo efectiva (puede diferir)
  
  description text not null,
  amount decimal(18, 2) not null,
  type text not null,  -- "debit", "credit"
  currency text default 'MXN',
  
  -- IDs externos
  bank_reference_id text,  -- ID en banco (BBVA, Santander, etc)
  check_number text,  -- Si es cheque
  
  -- Matching
  matching_status text default 'unmatched',  -- "matched", "unmatched", "disputed"
  matched_to_gastocheck_id uuid,  -- Referencia a transacción GastoCheck
  matched_at timestamp,
  
  -- Deduplication
  is_duplicate boolean default false,
  duplicate_of_id uuid references banco.bank_transactions(id),  -- Ref a original
  
  created_at timestamp default now(),
  updated_at timestamp default now(),
  
  unique(organization_id, transaction_date, description, amount, bank_account_id)
);

-- ===== CONFIGURACIÓN OCR POR BANCO =====
create table banco.bank_statement_ocr_config (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  
  bank_name text not null,  -- "BBVA", "Santander", "Banamex"
  
  -- Parámetros Tesseract
  tesseract_lang text default 'spa',  -- Idioma OCR
  tesseract_psm integer default 3,    -- Page Segmentation Mode
  
  -- Patrones regex para extracción
  date_pattern text,
  amount_pattern text,
  description_pattern text,
  
  -- Configuración tabla
  table_header_keywords text[],       -- Palabras clave para identificar encabezado
  row_separator_threshold float,      -- Threshold espaciado vertical entre filas
  
  -- Estado
  is_active boolean default true,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  
  unique(organization_id, bank_name)
);
```

### 4.2 Tablas Opcionales (Fase 2+)

```sql
-- ===== LOG MATCHING =====
create table banco.transaction_matching_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  
  bank_transaction_id uuid not null references banco.bank_transactions(id),
  matched_to_id uuid,  -- ID de la transacción GastoCheck
  
  matching_algorithm text,  -- "exact_amount_2days", "fuzzy_description", "manual"
  confidence_score float,   -- 0.0-1.0
  
  decision text,  -- "auto_matched", "user_confirmed", "user_rejected"
  decision_by uuid references auth.users(id),
  
  created_at timestamp default now()
);

-- ===== ESTADO RECONCILIACIÓN =====
create table banco.reconciliation_status (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  bank_account_id uuid not null,
  
  month_year text not null,  -- "2026-07"
  
  -- Counters
  total_transactions integer default 0,
  matched_count integer default 0,
  unmatched_count integer default 0,
  disputed_count integer default 0,
  
  -- Totales
  total_debit decimal(18, 2),
  total_credit decimal(18, 2),
  statement_ending_balance decimal(18, 2),
  calculated_balance decimal(18, 2),
  
  -- Status
  reconciliation_status text,  -- "pending", "in_progress", "completed", "approved"
  reconciled_by uuid references auth.users(id),
  reconciled_at timestamp,
  
  notes text,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  
  unique(organization_id, bank_account_id, month_year)
);

-- ===== SOLICITUDES DE BANCOS NO SOPORTADOS =====
create table banco.unsupported_bank_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  
  requested_bank_name text not null,
  connection_type text not null,  -- "oauth", "ocr", "both"
  
  request_reason text,  -- Por qué lo necesita
  
  -- Tracking
  status text default 'received',  -- "received", "investigating", "in_progress", "launched", "closed"
  admin_notes text,
  priority_score integer default 0,  -- Basado en cantidad requests similares
  
  -- Seguimiento
  created_at timestamp default now(),
  updated_at timestamp default now(),
  launched_date timestamp,
  
  unique(organization_id, requested_bank_name, connection_type)
);
```

### 4.3 RLS Policies

```sql
-- ===== ROW LEVEL SECURITY =====

-- Contador/Admin: ver todas sus transacciones
create policy "bank_transactions_org_access" on banco.bank_transactions
  for select using (
    organization_id = auth.uid()::uuid 
    or exists (
      select 1 from public.organizations o
      where o.id = banco.bank_transactions.organization_id
        and o.organization_id = auth.uid()::uuid
    )
  );

-- Supervisor: ver solo lectura
create policy "bank_transactions_supervisor_read" on banco.bank_transactions
  for select using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin', 'supervisor', 'accountant')
    )
  );

-- Contador: insertar/actualizar matching
create policy "bank_transactions_accountant_update" on banco.bank_transactions
  for update using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin', 'accountant')
    )
  );
```

---

## 5. API ENDPOINTS

### 5.1 POST /banco/import-statement

**Descripción**: Importar estado de cuenta (PDF/JPG) y procesar vía OCR

**Método**: `POST`  
**Autenticación**: JWT Bearer  
**Content-Type**: `multipart/form-data`

**Request Body**:
```typescript
interface ImportStatementRequest {
  file: File;                      // PDF o JPG (max 10MB)
  bankAccountId?: string;          // UUID (opcional si es nuevo)
  bankName?: string;               // "BBVA", "Santander" (si es nuevo)
  accountNumber?: string;          // Número cuenta (si es nuevo)
  statementMonth: string;          // "2026-07"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "importId": "550e8400-e29b-41d4-a716-446655440000",
  "bankDetected": "BBVA",
  "detectedConfidence": 0.94,
  "extractedTransactionsCount": 42,
  "processingStatus": "processing",
  "estimatedProcessingTime": "30s"
}
```

**Error Cases**:
- `400`: File inválido, formato no soportado
- `413`: Archivo muy grande (> 10MB)
- `422`: Banco no detectado o detección muy baja confianza
- `500`: Error procesamiento OCR

**Pseudocódigo Backend**:
```typescript
export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get('file') as File;
  const bankName = formData.get('bankName') as string;
  
  // Validar
  if (!file || file.size > 10 * 1024 * 1024) {
    return Response.json({ error: 'File too large' }, { status: 413 });
  }

  // Guardar file en storage
  const filePath = await uploadToStorage(file);

  // Crear import record
  const importRecord = await db.banco_statement_imports.create({
    organization_id: user.org_id,
    file_path: filePath,
    file_name: file.name,
    file_type: file.type,
    processing_status: 'pending',
  });

  // Queue OCR processing (async)
  await queueOCRJob(importRecord.id, filePath, bankName);

  return Response.json({
    success: true,
    importId: importRecord.id,
    processingStatus: 'pending',
  }, { status: 201 });
}
```

---

### 5.2 GET /banco/accounts

**Descripción**: Listar cuentas bancarias conectadas (manual + OAuth)

**Método**: `GET`  
**Autenticación**: JWT Bearer  
**Query Params**: 
```
?type=all|manual|oauth    # Filtro tipo conexión
?status=all|active|expired|error  # Filtro estado
```

**Response** (200 OK):
```json
{
  "success": true,
  "accounts": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "bankName": "BBVA",
      "accountNumber": "****5678",
      "accountType": "Corriente",
      "currentBalance": 50000.00,
      "connectionType": "oauth",
      "status": "active",
      "lastSyncAt": "2026-07-05T10:30:00Z",
      "lastTransactionDate": "2026-07-04"
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "bankName": "Santander",
      "accountNumber": "****1234",
      "accountType": "Ahorro",
      "currentBalance": 25000.00,
      "connectionType": "manual",
      "status": "active",
      "lastImportAt": "2026-07-03T14:15:00Z"
    }
  ],
  "summary": {
    "totalAccounts": 2,
    "activeAccounts": 2,
    "totalBalance": 75000.00
  }
}
```

---

### 5.3 POST /banco/oauth-callback

**Descripción**: Manejar callback OAuth de BBVA/Santander

**Método**: `POST`  
**Autenticación**: JWT Bearer  
**Content-Type**: `application/json`

**Request Body**:
```typescript
interface OAuthCallbackRequest {
  oauthProvider: 'bbva' | 'santander';  // Banco
  authorizationCode: string;            // Code OAuth
  stateToken: string;                  // Validar CSRF
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "account": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "bankName": "BBVA",
    "accountNumber": "****5678",
    "currentBalance": 50000.00,
    "connectionStatus": "active"
  },
  "syncStarted": true
}
```

**Error Cases**:
- `400`: State token inválido (CSRF)
- `401`: Authorization code expirado/inválido
- `403`: Usuario no autorizado
- `500`: Error OAuth provider

---

### 5.4 GET /banco/transactions

**Descripción**: Listar transacciones con estado matching

**Método**: `GET`  
**Autenticación**: JWT Bearer  
**Query Params**:
```
?bankAccountId=uuid       # Filtro por cuenta
?status=matched|unmatched|disputed
?startDate=2026-07-01
?endDate=2026-07-31
?limit=50
?offset=0
```

**Response** (200 OK):
```json
{
  "success": true,
  "transactions": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "transactionDate": "2026-07-04",
      "description": "Pago Factura #INV-001",
      "amount": -1500.00,
      "type": "debit",
      "matchingStatus": "matched",
      "matchedToGastocheckId": "770e8400-e29b-41d4-a716-446655440000",
      "confidence": 0.99,
      "bankReference": "BBVA-20260704-12345"
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "transactionDate": "2026-07-04",
      "description": "Depósito entrada",
      "amount": 5000.00,
      "type": "credit",
      "matchingStatus": "unmatched",
      "matchedToGastocheckId": null,
      "bankReference": "BBVA-20260704-12346"
    }
  ],
  "summary": {
    "total": 42,
    "matched": 38,
    "unmatched": 4,
    "disputed": 0,
    "matchPercentage": 90.5
  }
}
```

---

### 5.5 POST /banco/manual-match

**Descripción**: Relacionar manualmente una transacción bancaria con GastoCheck

**Método**: `POST`  
**Autenticación**: JWT Bearer  
**Content-Type**: `application/json`

**Request Body**:
```typescript
interface ManualMatchRequest {
  bankTransactionId: string;        // UUID
  gastocheckTransactionId: string;  // UUID de GastoCheck
  decision: 'confirm' | 'reject';   // Confirmación o rechazo
  notes?: string;                   // Notas del usuario
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Transaction matched successfully",
  "bankTransaction": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "matchingStatus": "matched",
    "matchedAt": "2026-07-05T14:30:00Z"
  }
}
```

---

### 5.6 GET /admin/unsupported-banks

**Descripción**: (Admin) Listar solicitudes de bancos no soportados

**Método**: `GET`  
**Autenticación**: JWT Bearer + Admin Role  
**Query Params**:
```
?status=received|investigating|in_progress|launched|closed
?sortBy=priority|date
?limit=50
```

**Response** (200 OK):
```json
{
  "success": true,
  "requests": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "requestedBankName": "HSBC",
      "connectionType": "oauth",
      "status": "investigating",
      "requestCount": 3,
      "priorityScore": 75,
      "createdAt": "2026-06-20T10:00:00Z",
      "adminNotes": "Investigando disponibilidad API HSBC"
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "requestedBankName": "Scotiabank",
      "connectionType": "oauth",
      "status": "received",
      "requestCount": 1,
      "priorityScore": 25,
      "createdAt": "2026-07-04T15:30:00Z",
      "adminNotes": null
    }
  ],
  "topDemandedBanks": [
    { "bankName": "HSBC", "count": 3 },
    { "bankName": "Scotiabank", "count": 1 }
  ]
}
```

---

## 6. ALGORITMOS OCR

### 6.1 PDF Parser (pseudocódigo)

```typescript
// apps/mobile/app/bancocheck/utils/ocrExtraction.ts

export async function extractFromPDF(
  filePath: string,
  bankName: string,
  config: OCRConfig
): Promise<BankTransaction[]> {
  // 1. Cargar PDF
  const pdfPages = await loadPDFPages(filePath);
  
  // 2. Por cada página, extraer tablas
  const allTransactions: BankTransaction[] = [];
  
  for (const page of pdfPages) {
    // 3. Detectar región de tabla
    const tableRegion = detectTableBoundaries(page, config.table_header_keywords);
    if (!tableRegion) continue;
    
    // 4. Extraer líneas (filas)
    const rows = splitByHorizontalLines(
      tableRegion,
      config.row_separator_threshold
    );
    
    // 5. Por cada fila, extraer campos
    for (const row of rows) {
      const transaction = parseTransactionRow(
        row,
        bankName,
        config
      );
      if (transaction) {
        allTransactions.push(transaction);
      }
    }
  }
  
  return allTransactions;
}

function parseTransactionRow(
  rowImage: PixelData,
  bankName: string,
  config: OCRConfig
): BankTransaction | null {
  // Usar Tesseract para OCR del texto
  const ocrText = performTesseractOCR(
    rowImage,
    config.tesseract_lang,
    config.tesseract_psm
  );
  
  // Extraer campos específicos
  const dateMatch = extractField(ocrText, config.date_pattern);
  const amountMatch = extractField(ocrText, config.amount_pattern);
  const descriptionMatch = extractField(ocrText, config.description_pattern);
  
  if (!dateMatch || !amountMatch) {
    return null;  // Fila inválida
  }
  
  return {
    transactionDate: parseDate(dateMatch.value),
    description: descriptionMatch?.value || 'Sin descripción',
    amount: parseAmount(amountMatch.value),
    type: amountMatch.value.startsWith('-') ? 'debit' : 'credit',
    confidence: (
      dateMatch.confidence * 
      amountMatch.confidence * 
      (descriptionMatch?.confidence || 0.7)
    ) / 3,  // Promedio confianzas
  };
}

function extractField(
  text: string,
  pattern: string,
  minConfidence: number = 0.7
): { value: string; confidence: number } | null {
  const regex = new RegExp(pattern, 'i');
  const match = text.match(regex);
  
  if (!match) return null;
  
  // Usar Levenshtein distance para calcular confianza
  const confidence = calculateConfidence(match[1], pattern);
  
  return confidence >= minConfidence
    ? { value: match[1], confidence }
    : null;
}

// Regex patterns por banco (ejemplos)
export const BANK_OCR_PATTERNS: Record<string, OCRConfig> = {
  bbva: {
    bank_name: 'BBVA',
    date_pattern: r'^(\d{1,2}/\d{1,2}/\d{4})',
    amount_pattern: r'([\d,]+\.\d{2})$',
    description_pattern: r'^.*?(\d{1,2}/\d{1,2}) (.+?) ([\d,]+\.\d{2})',
    table_header_keywords: ['Fecha', 'Concepto', 'Importe', 'Saldo'],
    row_separator_threshold: 0.08,  // 8% de altura página
    tesseract_lang: 'spa',
    tesseract_psm: 3,
  },
  santander: {
    // Similar structure
  },
};
```

### 6.2 Image OCR (Tesseract Config)

```typescript
// apps/mobile/app/bancocheck/constants/ocrConfig.ts

export const TESSERACT_CONFIG = {
  lang: 'spa',  // Spanish
  psm: 3,       // PSM 3: Fully automatic page segmentation, but no OSD
  oem: 3,       // OEM 3: Tesseract + LSTM
  
  // Preprocessing
  preprocess: {
    threshold: true,
    thresholdValue: 127,
    contrast: 1.2,
    brightness: 0,
    scale: 2,  // Aumentar resolución 2x
  },

  // Post-processing
  postprocess: {
    denoise: true,
    deskew: true,  // Corregir inclinación
    despeckle: true,
  },
};

export async function performTesseractOCR(
  imageData: PixelData,
  lang: string,
  psm: number
): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker(lang);
  
  const result = await worker.recognize(imageData, {
    psm,
    oem: 3,
  });
  
  await worker.terminate();
  
  return result.data.text;
}

export function calculateConfidence(
  extractedValue: string,
  expectedPattern: string
): number {
  // Usar Levenshtein distance
  const distance = levenshteinDistance(extractedValue, expectedPattern);
  const maxLength = Math.max(extractedValue.length, expectedPattern.length);
  
  return Math.max(0, 1 - (distance / maxLength));
}
```

### 6.3 Detección Automática de Banco

```typescript
// apps/mobile/app/bancocheck/utils/bankFormatDetection.ts

export async function detectBankFromStatement(
  filePath: string
): Promise<{ bankName: string; confidence: number }> {
  // 1. Extraer primera página
  const firstPage = await extractFirstPageAsImage(filePath);
  
  // 2. Buscar logos/text característicos
  const patterns = [
    {
      bank: 'BBVA',
      keywords: ['BBVA', 'Bancomer'],
      logoPattern: /* ... */,
    },
    {
      bank: 'Santander',
      keywords: ['Santander', 'SANTANDER'],
      logoPattern: /* ... */,
    },
    // ... más bancos
  ];
  
  let bestMatch = null;
  let highestScore = 0;
  
  for (const pattern of patterns) {
    // Buscar keywords
    const keywordScore = findKeywordsScore(firstPage, pattern.keywords);
    
    // Buscar logo (image recognition)
    const logoScore = matchLogoPattern(firstPage, pattern.logoPattern);
    
    const totalScore = (keywordScore * 0.7 + logoScore * 0.3);
    
    if (totalScore > highestScore) {
      highestScore = totalScore;
      bestMatch = pattern.bank;
    }
  }
  
  return {
    bankName: bestMatch || 'Unknown',
    confidence: highestScore,
  };
}
```

---

## 7. ALGORITMO MATCHING

### 7.1 Pseudocódigo Matching Automático

```typescript
// apps/mobile/app/bancocheck/utils/transactionMatching.ts

export async function autoMatchTransactions(
  bankTransaction: BankTransaction,
  gastocheckTransactions: GastocheckTransaction[]
): Promise<MatchingResult | null> {
  const candidates: MatchingResult[] = [];
  
  for (const gasto of gastocheckTransactions) {
    // 1. Validación básica
    if (Math.abs(bankTransaction.amount - gasto.amount) > 0.01) {
      continue;  // Monto no coincide
    }
    
    // 2. Validación fecha (±2 días)
    const dateDiff = Math.abs(
      daysBetween(bankTransaction.transactionDate, gasto.date)
    );
    
    if (dateDiff > 2) {
      continue;  // Fecha fuera de rango
    }
    
    // 3. Calcular confianza
    const confidence = calculateMatchingConfidence(
      bankTransaction,
      gasto,
      dateDiff
    );
    
    if (confidence >= 0.85) {  // Threshold mínimo
      candidates.push({
        bankTransactionId: bankTransaction.id,
        gastocheckTransactionId: gasto.id,
        confidence,
        reason: `Exact amount + ${dateDiff} days difference`,
      });
    }
  }
  
  // 4. Seleccionar mejor match
  if (candidates.length === 0) {
    return null;
  }
  
  if (candidates.length === 1) {
    return candidates[0];  // Único match
  }
  
  // Varios candidatos: seleccionar el de mayor confianza
  return candidates.reduce((best, current) =>
    current.confidence > best.confidence ? current : best
  );
}

function calculateMatchingConfidence(
  bankTx: BankTransaction,
  gastoTx: GastocheckTransaction,
  daysDifference: number
): number {
  let score = 1.0;
  
  // Reducir por diferencia de fecha
  score -= daysDifference * 0.05;  // -5% por día
  
  // Aumentar si descripciones coinciden
  if (fuzzyMatch(bankTx.description, gastoTx.description) > 0.7) {
    score += 0.1;
  }
  
  // Reducir si ya está matched
  if (bankTx.matchingStatus === 'matched') {
    score -= 0.2;
  }
  
  return Math.max(0, Math.min(1, score));
}

function fuzzyMatch(str1: string, str2: string): number {
  // Usar Levenshtein distance normalizándolo
  const distance = levenshteinDistance(
    str1.toLowerCase(),
    str2.toLowerCase()
  );
  const maxLength = Math.max(str1.length, str2.length);
  return Math.max(0, 1 - (distance / maxLength));
}
```

### 7.2 Deduplication

```typescript
// apps/mobile/app/bancocheck/utils/deduplication.ts

export async function detectDuplicates(
  importedTransactions: BankTransaction[]
): Promise<Map<string, string>> {
  // Map: transactionId → duplicateOfId
  const duplicateMap = new Map<string, string>();
  
  for (let i = 0; i < importedTransactions.length; i++) {
    for (let j = i + 1; j < importedTransactions.length; j++) {
      const tx1 = importedTransactions[i];
      const tx2 = importedTransactions[j];
      
      // Mismos valores: fecha, monto, descripción
      if (
        tx1.transactionDate.getTime() === tx2.transactionDate.getTime() &&
        Math.abs(tx1.amount - tx2.amount) < 0.01 &&
        fuzzyMatch(tx1.description, tx2.description) > 0.9
      ) {
        // Marcar segundo como duplicado del primero
        duplicateMap.set(tx2.id, tx1.id);
      }
    }
  }
  
  // También validar contra DB existente
  for (const tx of importedTransactions) {
    const existing = await db.banco_transactions.findFirst({
      where: {
        transaction_date: tx.transactionDate,
        amount: tx.amount,
        organization_id: tx.organization_id,
        bank_account_id: tx.bank_account_id,
      },
    });
    
    if (existing && !duplicateMap.has(tx.id)) {
      duplicateMap.set(tx.id, existing.id);
    }
  }
  
  return duplicateMap;
}
```

---

## 8. OAUTH FLOWS

### 8.1 BBVA OAuth Flow

```typescript
// apps/web/app/api/banco/oauth-init/bbva.ts

export async function initBBVAOAuth(req: Request) {
  const user = await getAuthUser(req);
  const stateToken = generateSecureToken();  // CSRF protection
  
  // Guardar state en DB (temporal, 10 min TTL)
  await db.oauth_state_store.create({
    state: stateToken,
    provider: 'bbva',
    user_id: user.id,
    expires_at: now() + 10 * 60,
  });
  
  const bbvaAuthURL = new URL('https://api-bbva.sandbox.com/oauth/authorize');
  bbvaAuthURL.searchParams.set('client_id', process.env.BBVA_CLIENT_ID);
  bbvaAuthURL.searchParams.set('redirect_uri', `${process.env.CALLBACK_URL}/banco/oauth-callback`);
  bbvaAuthURL.searchParams.set('response_type', 'code');
  bbvaAuthURL.searchParams.set('scope', 'accounts transactions');
  bbvaAuthURL.searchParams.set('state', stateToken);
  
  return Response.json({
    authUrl: bbvaAuthURL.toString(),
  });
}

// apps/web/app/api/banco/oauth-callback/index.ts

export async function handleOAuthCallback(req: Request) {
  const { code, state, provider } = await req.json();
  
  // 1. Validar state (CSRF)
  const stateRecord = await db.oauth_state_store.findUnique({
    where: { state },
  });
  
  if (!stateRecord || stateRecord.expires_at < now()) {
    return Response.json(
      { error: 'Invalid or expired state token' },
      { status: 400 }
    );
  }
  
  const user_id = stateRecord.user_id;
  
  // 2. Exchange code por access_token
  const tokenResponse = await fetch(
    `https://api-bbva.sandbox.com/oauth/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: process.env.BBVA_CLIENT_ID,
        client_secret: process.env.BBVA_CLIENT_SECRET,
        redirect_uri: `${process.env.CALLBACK_URL}/banco/oauth-callback`,
      }).toString(),
    }
  );
  
  const { access_token, refresh_token, expires_in } = await tokenResponse.json();
  
  // 3. Obtener cuentas del usuario
  const accountsResponse = await fetch(
    'https://api-bbva.sandbox.com/accounts',
    {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    }
  );
  
  const { accounts } = await accountsResponse.json();
  
  // 4. Guardar OAuth tokens (encrypted)
  const expiresAt = new Date(now().getTime() + expires_in * 1000);
  
  for (const account of accounts) {
    await db.banco_accounts_automated.upsert({
      where: {
        organization_id_account_number_oauth_provider: {
          organization_id: user_id,
          account_number: account.id,
          oauth_provider: 'bbva',
        },
      },
      create: {
        organization_id: user_id,
        bank_name: 'BBVA',
        account_number: account.id,
        account_holder: account.owner_name,
        current_balance: account.balance,
        oauth_provider: 'bbva',
        oauth_user_id: account.owner_id,
        oauth_access_token: encryptToken(access_token),
        oauth_refresh_token: encryptToken(refresh_token),
        oauth_token_expires_at: expiresAt,
        connection_status: 'active',
      },
      update: {
        oauth_access_token: encryptToken(access_token),
        oauth_refresh_token: encryptToken(refresh_token),
        oauth_token_expires_at: expiresAt,
        connection_status: 'active',
      },
    });
  }
  
  // 5. Queue sync de transacciones
  for (const account of accounts) {
    await queueBankTransactionSync(account.id, 'bbva');
  }
  
  return Response.json({
    success: true,
    accountsConnected: accounts.length,
  });
}
```

### 8.2 Token Refresh Flow

```typescript
// apps/web/app/api/banco/sync-transactions.ts

export async function syncBankTransactions(
  bankAccountId: string,
  provider: 'bbva' | 'santander'
) {
  const account = await db.banco_accounts_automated.findUnique({
    where: { id: bankAccountId },
  });
  
  if (!account) throw new Error('Account not found');
  
  // 1. Validar token (refresh si necesario)
  let accessToken = decryptToken(account.oauth_access_token);
  
  if (account.oauth_token_expires_at < new Date()) {
    // Refresh token
    const refreshResponse = await fetch(
      `https://api-${provider}.sandbox.com/oauth/token`,
      {
        method: 'POST',
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: decryptToken(account.oauth_refresh_token),
          client_id: process.env[`${provider.toUpperCase()}_CLIENT_ID`],
          client_secret: process.env[`${provider.toUpperCase()}_CLIENT_SECRET`],
        }).toString(),
      }
    );
    
    const { access_token, expires_in } = await refreshResponse.json();
    accessToken = access_token;
    
    // Guardar nuevo token
    await db.banco_accounts_automated.update({
      where: { id: bankAccountId },
      data: {
        oauth_access_token: encryptToken(access_token),
        oauth_token_expires_at: new Date(Date.now() + expires_in * 1000),
      },
    });
  }
  
  // 2. Obtener transacciones últimos 90 días
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 90);
  
  const txResponse = await fetch(
    `https://api-${provider}.sandbox.com/accounts/${account.oauth_user_id}/transactions?from=${startDate.toISOString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  
  const { transactions } = await txResponse.json();
  
  // 3. Guardar en DB
  for (const tx of transactions) {
    await db.banco_transactions.upsert({
      where: {
        organization_id_transaction_date_description_amount_bank_account_id: {
          organization_id: account.organization_id,
          transaction_date: new Date(tx.posting_date),
          description: tx.description,
          amount: tx.amount,
          bank_account_id: bankAccountId,
        },
      },
      create: {
        organization_id: account.organization_id,
        bank_account_id: bankAccountId,
        bank_account_type: 'oauth',
        transaction_date: new Date(tx.posting_date),
        description: tx.description,
        amount: tx.amount,
        type: tx.amount > 0 ? 'credit' : 'debit',
        bank_reference_id: tx.id,
        matching_status: 'unmatched',
      },
      update: {
        bank_reference_id: tx.id,
      },
    });
  }
  
  // 4. Auto-match con GastoCheck
  await autoMatchAllTransactions(account.organization_id, bankAccountId);
}
```

---

## 9. SISTEMA DE ALERTAS ADMIN

### 9.1 Tabla Solicitudes Bancos

```sql
-- Ya incluida en § 4.2
create table banco.unsupported_bank_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_id uuid not null,
  
  requested_bank_name text not null,
  connection_type text not null,  -- "oauth", "ocr"
  request_reason text,
  
  status text default 'received',
  admin_notes text,
  priority_score integer default 0,
  
  created_at timestamp default now(),
  updated_at timestamp default now(),
  launched_date timestamp,
  
  unique(organization_id, requested_bank_name, connection_type)
);
```

### 9.2 Endpoint Reportar Banco Nuevo

```typescript
// apps/web/app/api/banco/request-unsupported-bank.ts

export async function POST(req: Request) {
  const user = await getAuthUser(req);
  const { bankName, connectionType, reason } = await req.json();
  
  // Validar entrada
  if (!bankName || !connectionType) {
    return Response.json(
      { error: 'Missing required fields' },
      { status: 400 }
    );
  }
  
  // Crear o incrementar solicitud
  const existing = await db.banco_unsupported_bank_requests.findFirst({
    where: {
      organization_id: user.org_id,
      requested_bank_name: bankName,
      connection_type: connectionType,
      deleted_at: null,
    },
  });
  
  if (existing) {
    // Ya existe: solo actualizar status si estaba cerrado
    if (existing.status === 'closed') {
      await db.banco_unsupported_bank_requests.update({
        where: { id: existing.id },
        data: {
          status: 'received',
          updated_at: new Date(),
        },
      });
    }
    
    return Response.json({
      success: true,
      message: 'Request already recorded. Thanks for your interest!',
    });
  }
  
  // Crear nuevo
  const request = await db.banco_unsupported_bank_requests.create({
    data: {
      organization_id: user.org_id,
      user_id: user.id,
      requested_bank_name: bankName,
      connection_type: connectionType,
      request_reason: reason,
      status: 'received',
    },
  });
  
  // Enviar email confirmación a usuario
  await sendEmail({
    to: user.email,
    template: 'bank_request_received',
    data: {
      bankName,
      connectionType,
    },
  });
  
  // Notificar admin
  await notifyAdmins({
    type: 'new_bank_request',
    bankName,
    connectionType,
  });
  
  return Response.json({
    success: true,
    requestId: request.id,
  });
}
```

### 9.3 Admin Dashboard Endpoint

```typescript
// apps/web/app/api/admin/unsupported-banks/dashboard.ts

export async function GET(req: Request) {
  const user = await getAuthUser(req);
  
  // Validar admin
  if (!user.roles.includes('admin')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  // Agrupar por banco
  const groupedRequests = await db.$queryRaw`
    SELECT 
      requested_bank_name,
      connection_type,
      status,
      COUNT(*) as request_count,
      MAX(created_at) as last_request_at,
      MAX(updated_at) as last_update_at
    FROM banco.unsupported_bank_requests
    WHERE deleted_at IS NULL
    GROUP BY requested_bank_name, connection_type, status
    ORDER BY request_count DESC, last_request_at DESC
  `;
  
  // Calcular prioridad (basado en requests + tiempo)
  const requests = groupedRequests.map((req) => ({
    ...req,
    priority_score: calculatePriority(req.request_count, req.last_request_at),
  }));
  
  return Response.json({
    success: true,
    topDemandedBanks: requests.slice(0, 10),
    totalUniqueBanks: requests.length,
    activeRequests: requests.filter(r => r.status !== 'closed').length,
  });
}

function calculatePriority(count: number, lastRequestAt: Date): number {
  const daysSinceRequest = (Date.now() - lastRequestAt.getTime()) / (1000 * 60 * 60 * 24);
  
  // Fórmula: requests * 100 - daysDecay
  return Math.round(count * 100 - (daysSinceRequest * 5));
}
```

### 9.4 Email Templates

```html
<!-- emails/bank_request_received.html -->
<h1>Solicitud de Integración Bancaria Recibida</h1>
<p>Hola,</p>
<p>Hemos recibido tu solicitud para integrar <strong>{{ bankName }}</strong> a BancoCheck.</p>
<p>
  Tipo de conexión: <strong>{{ connectionType === 'oauth' ? 'Automática (OAuth)' : 'Manual (OCR)' }}</strong>
</p>
<p>
  Nuestro equipo está evaluando la disponibilidad de integración.
  Te notificaremos cuando hayamos avanzado.
</p>
<footer>CHECK SUITE — Tu plataforma integral de finanzas</footer>
```

```html
<!-- emails/bank_integration_progress.html -->
<h1>Avance en Integración de {{ bankName }}</h1>
<p>Hola,</p>
<p>
  Buenas noticias: <strong>{{ bankName }}</strong> está en evaluación técnica
  y podría estar disponible pronto.
</p>
<p>{{ adminNotes }}</p>
<footer>CHECK SUITE</footer>
```

```html
<!-- emails/bank_launched.html -->
<h1>{{ bankName }} Ahora Disponible en BancoCheck</h1>
<p>¡Excelente noticia!</p>
<p>
  <strong>{{ bankName }}</strong> ya está disponible para conectar en BancoCheck.
  Accede a la app y conecta tu cuenta ahora.
</p>
<footer>CHECK SUITE</footer>
```

---

## 10. TIPOS TYPESCRIPT

```typescript
// packages/shared/src/types/banco/index.ts

export interface BankAccount {
  id: string;
  organizationId: string;
  bankName: string;        // "BBVA", "Santander", etc.
  accountNumber: string;   // Ej: "0123456789"
  accountType: 'checking' | 'savings';
  accountHolder: string;
  currency: string;        // "MXN", "USD"
  currentBalance: number;
  connectionType: 'manual' | 'oauth';
  status: 'active' | 'expired' | 'error';
  lastSyncAt?: Date;
  lastSyncError?: string;
  oauthProvider?: 'bbva' | 'santander';
  oauthUserId?: string;
}

export interface BankTransaction {
  id: string;
  organizationId: string;
  bankAccountId?: string;
  bankAccountType: 'manual' | 'oauth';
  
  transactionDate: Date;
  postingDate?: Date;
  description: string;
  amount: number;
  type: 'debit' | 'credit';
  currency: string;
  
  bankReferenceId?: string;
  checkNumber?: string;
  
  matchingStatus: 'matched' | 'unmatched' | 'disputed';
  matchedToGastocheckId?: string;
  matchedAt?: Date;
  
  isDuplicate: boolean;
  duplicateOfId?: string;
  
  importId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OCRConfig {
  id: string;
  organizationId: string;
  bankName: string;
  
  // Tesseract
  tesseractLang: string;
  tesseractPsm: number;
  
  // Patrones
  datePattern: string;
  amountPattern: string;
  descriptionPattern: string;
  
  // Tabla
  tableHeaderKeywords: string[];
  rowSeparatorThreshold: number;
  
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MatchingResult {
  bankTransactionId: string;
  gastocheckTransactionId?: string;
  confidence: number;  // 0.0-1.0
  reason: string;      // Descripción del match
  algorithm: 'exact_amount_2days' | 'fuzzy_description' | 'manual';
}

export interface UnsupportedBankRequest {
  id: string;
  organizationId: string;
  userId: string;
  
  requestedBankName: string;
  connectionType: 'oauth' | 'ocr' | 'both';
  requestReason?: string;
  
  status: 'received' | 'investigating' | 'in_progress' | 'launched' | 'closed';
  adminNotes?: string;
  priorityScore: number;
  
  createdAt: Date;
  updatedAt: Date;
  launchedDate?: Date;
}

export interface ReconciliationStatus {
  id: string;
  organizationId: string;
  bankAccountId: string;
  monthYear: string;  // "2026-07"
  
  // Contadores
  totalTransactions: number;
  matchedCount: number;
  unmatchedCount: number;
  disputedCount: number;
  
  // Totales
  totalDebit: number;
  totalCredit: number;
  statementEndingBalance: number;
  calculatedBalance: number;
  
  // Estado
  status: 'pending' | 'in_progress' | 'completed' | 'approved';
  reconciledBy?: string;
  reconciledAt?: Date;
  notes?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface ImportStatement {
  id: string;
  organizationId: string;
  bankAccountId?: string;
  
  filePath: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  
  bankDetected?: string;
  detectedConfidence: number;
  
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  processingError?: string;
  extractedTransactionsCount: number;
  
  createdAt: Date;
  processedAt?: Date;
}
```

---

## 11. TEST STUBS

### 11.1 OCR Field Extraction Tests

```typescript
// apps/mobile/app/bancocheck/utils/__tests__/ocrExtraction.test.ts

import { extractField, parseTransactionRow } from '../ocrExtraction';

describe('OCR Field Extraction', () => {
  describe('extractField', () => {
    it('should extract date from text', () => {
      const text = 'Fecha: 04/07/2026 Concepto: Pago';
      const pattern = r'^Fecha: (\d{2}/\d{2}/\d{4})';
      
      const result = extractField(text, pattern);
      
      expect(result).not.toBeNull();
      expect(result?.value).toBe('04/07/2026');
      expect(result?.confidence).toBeGreaterThan(0.9);
    });
    
    it('should extract amount from text', () => {
      const text = 'Importe: 1,500.00 MXN';
      const pattern = r'Importe: ([\d,]+\.\d{2})';
      
      const result = extractField(text, pattern);
      
      expect(result?.value).toBe('1,500.00');
    });
    
    it('should handle OCR errors gracefully', () => {
      const text = 'Fech4: 04/07/2026';  // Typo "Fech4"
      const pattern = r'^Fecha: (\d{2}/\d{2}/\d{4})';
      
      const result = extractField(text, pattern, 0.7);
      
      // Con fuzzy match y 70% threshold
      expect(result).not.toBeNull();
    });
    
    it('should return null for non-matching patterns', () => {
      const text = 'Sin información de fecha';
      const pattern = r'Fecha: (\d{2}/\d{2}/\d{4})';
      
      const result = extractField(text, pattern);
      
      expect(result).toBeNull();
    });
  });
});
```

### 11.2 Transaction Matching Tests

```typescript
// apps/mobile/app/bancocheck/utils/__tests__/transactionMatching.test.ts

import { autoMatchTransactions, calculateMatchingConfidence } from '../transactionMatching';

describe('Transaction Matching', () => {
  const bankTx: BankTransaction = {
    id: '1',
    transactionDate: new Date('2026-07-04'),
    description: 'Pago Factura #INV-001',
    amount: -1500.00,
    type: 'debit',
  };
  
  const gastoTx: GastocheckTransaction = {
    id: 'gasto-1',
    date: new Date('2026-07-04'),
    description: 'Factura INV-001 - Proveedor A',
    amount: 1500.00,
  };
  
  describe('autoMatchTransactions', () => {
    it('should match exact amounts and dates', async () => {
      const result = await autoMatchTransactions(bankTx, [gastoTx]);
      
      expect(result).not.toBeNull();
      expect(result?.gastocheckTransactionId).toBe('gasto-1');
      expect(result?.confidence).toBeGreaterThan(0.9);
    });
    
    it('should match with ±2 day tolerance', async () => {
      const gastoTx2Day = {
        ...gastoTx,
        date: new Date('2026-07-06'),  // +2 días
      };
      
      const result = await autoMatchTransactions(bankTx, [gastoTx2Day]);
      
      expect(result).not.toBeNull();
      expect(result?.confidence).toBeGreaterThan(0.8);
    });
    
    it('should NOT match if dates differ by >2 days', async () => {
      const gastoTx3Days = {
        ...gastoTx,
        date: new Date('2026-07-07'),  // +3 días
      };
      
      const result = await autoMatchTransactions(bankTx, [gastoTx3Days]);
      
      expect(result).toBeNull();
    });
    
    it('should NOT match if amounts differ', async () => {
      const gastoTxDiff = {
        ...gastoTx,
        amount: 2000.00,  // Diferente
      };
      
      const result = await autoMatchTransactions(bankTx, [gastoTxDiff]);
      
      expect(result).toBeNull();
    });
    
    it('should select best match among candidates', async () => {
      const candidates = [
        { ...gastoTx, id: 'gasto-1' },
        { ...gastoTx, id: 'gasto-2', date: new Date('2026-07-05') },
        { ...gastoTx, id: 'gasto-3', date: new Date('2026-07-03') },
      ];
      
      const result = await autoMatchTransactions(bankTx, candidates);
      
      expect(result?.gastocheckTransactionId).toBe('gasto-1');  // Mismo día = máxima confianza
    });
  });
  
  describe('calculateMatchingConfidence', () => {
    it('should return high confidence for exact matches', () => {
      const conf = calculateMatchingConfidence(bankTx, gastoTx, 0);
      
      expect(conf).toBeGreaterThan(0.95);
    });
    
    it('should reduce confidence for date differences', () => {
      const conf0 = calculateMatchingConfidence(bankTx, gastoTx, 0);
      const conf1 = calculateMatchingConfidence(bankTx, gastoTx, 1);
      const conf2 = calculateMatchingConfidence(bankTx, gastoTx, 2);
      
      expect(conf0).toBeGreaterThan(conf1);
      expect(conf1).toBeGreaterThan(conf2);
    });
  });
});
```

### 11.3 Deduplication Tests

```typescript
// apps/mobile/app/bancocheck/utils/__tests__/deduplication.test.ts

import { detectDuplicates } from '../deduplication';

describe('Deduplication', () => {
  it('should detect identical transactions', async () => {
    const transactions = [
      {
        id: 'tx-1',
        transactionDate: new Date('2026-07-04'),
        amount: 1500.00,
        description: 'Pago Factura',
      },
      {
        id: 'tx-2',
        transactionDate: new Date('2026-07-04'),
        amount: 1500.00,
        description: 'Pago Factura',  // Idéntico
      },
    ];
    
    const duplicates = await detectDuplicates(transactions as any);
    
    expect(duplicates.has('tx-2')).toBe(true);
    expect(duplicates.get('tx-2')).toBe('tx-1');
  });
  
  it('should NOT mark similar but different transactions as duplicates', async () => {
    const transactions = [
      {
        id: 'tx-1',
        transactionDate: new Date('2026-07-04'),
        amount: 1500.00,
        description: 'Pago Factura A',
      },
      {
        id: 'tx-2',
        transactionDate: new Date('2026-07-04'),
        amount: 1500.00,
        description: 'Pago Factura B',  // Diferente
      },
    ];
    
    const duplicates = await detectDuplicates(transactions as any);
    
    expect(duplicates.size).toBe(0);
  });
});
```

---

## 12. MIGRATION SQL TEMPLATE

```sql
-- Migration: Create BancoCheck Core Tables
-- Version: 001
-- Date: 2026-07-05

BEGIN TRANSACTION;

-- Enable pgcrypto extension for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create schema
CREATE SCHEMA IF NOT EXISTS banco;

-- ===== CUENTAS MANUALES =====
CREATE TABLE banco.bank_accounts_manual (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'Corriente',
  account_holder TEXT,
  currency TEXT DEFAULT 'MXN',
  current_balance DECIMAL(18, 2),
  opening_balance DECIMAL(18, 2),
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  deleted_at TIMESTAMP,
  
  CONSTRAINT uq_manual_account UNIQUE (organization_id, account_number) 
    WHERE deleted_at IS NULL
);

-- ===== CUENTAS AUTOMÁTICAS =====
CREATE TABLE banco.bank_accounts_automated (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_type TEXT,
  account_holder TEXT,
  currency TEXT DEFAULT 'MXN',
  current_balance DECIMAL(18, 2),
  
  oauth_provider TEXT NOT NULL,
  oauth_user_id TEXT,
  oauth_access_token TEXT,  -- Encrypted
  oauth_refresh_token TEXT,  -- Encrypted
  oauth_token_expires_at TIMESTAMP,
  
  connection_status TEXT DEFAULT 'active',
  last_sync_at TIMESTAMP,
  last_sync_error TEXT,
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  deleted_at TIMESTAMP,
  
  CONSTRAINT uq_oauth_account UNIQUE (organization_id, account_number, oauth_provider)
    WHERE deleted_at IS NULL
);

-- ===== IMPORTACIONES =====
CREATE TABLE banco.bank_statement_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  bank_account_id UUID,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size_bytes INTEGER,
  
  bank_detected TEXT,
  detected_confidence FLOAT,
  
  processing_status TEXT DEFAULT 'pending',
  processing_error TEXT,
  
  extracted_transactions_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT now(),
  processed_at TIMESTAMP
);

-- ===== TRANSACCIONES =====
CREATE TABLE banco.bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  bank_account_id UUID,
  bank_account_type TEXT,
  
  import_id UUID REFERENCES banco.bank_statement_imports(id) ON DELETE SET NULL,
  
  transaction_date DATE NOT NULL,
  posting_date DATE,
  
  description TEXT NOT NULL,
  amount DECIMAL(18, 2) NOT NULL,
  type TEXT NOT NULL,
  currency TEXT DEFAULT 'MXN',
  
  bank_reference_id TEXT,
  check_number TEXT,
  
  matching_status TEXT DEFAULT 'unmatched',
  matched_to_gastocheck_id UUID,
  matched_at TIMESTAMP,
  
  is_duplicate BOOLEAN DEFAULT false,
  duplicate_of_id UUID REFERENCES banco.bank_transactions(id),
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  CONSTRAINT uq_transaction UNIQUE (
    organization_id, transaction_date, description, amount, bank_account_id
  ) WHERE is_duplicate = false
);

-- ===== OCR CONFIG =====
CREATE TABLE banco.bank_statement_ocr_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  bank_name TEXT NOT NULL,
  
  tesseract_lang TEXT DEFAULT 'spa',
  tesseract_psm INTEGER DEFAULT 3,
  
  date_pattern TEXT,
  amount_pattern TEXT,
  description_pattern TEXT,
  
  table_header_keywords TEXT[],
  row_separator_threshold FLOAT,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  CONSTRAINT uq_ocr_config UNIQUE (organization_id, bank_name)
);

-- ===== SOLICITUDES BANCOS NO SOPORTADOS =====
CREATE TABLE banco.unsupported_bank_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  
  requested_bank_name TEXT NOT NULL,
  connection_type TEXT NOT NULL,
  
  request_reason TEXT,
  
  status TEXT DEFAULT 'received',
  admin_notes TEXT,
  priority_score INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  launched_date TIMESTAMP,
  
  CONSTRAINT uq_bank_request UNIQUE (
    organization_id, requested_bank_name, connection_type
  )
);

-- ===== INDEXES =====
CREATE INDEX idx_bank_tx_date ON banco.bank_transactions(organization_id, transaction_date DESC);
CREATE INDEX idx_bank_tx_status ON banco.bank_transactions(matching_status);
CREATE INDEX idx_bank_tx_account ON banco.bank_transactions(bank_account_id);
CREATE INDEX idx_bank_accounts_org ON banco.bank_accounts_automated(organization_id);
CREATE INDEX idx_unsupported_status ON banco.unsupported_bank_requests(status);
CREATE INDEX idx_unsupported_priority ON banco.unsupported_bank_requests(priority_score DESC);

-- ===== RLS POLICIES =====
ALTER TABLE banco.bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE banco.bank_accounts_manual ENABLE ROW LEVEL SECURITY;
ALTER TABLE banco.bank_accounts_automated ENABLE ROW LEVEL SECURITY;
ALTER TABLE banco.unsupported_bank_requests ENABLE ROW LEVEL SECURITY;

-- Organization members can view transactions
CREATE POLICY "view_org_transactions" ON banco.bank_transactions
  FOR SELECT
  USING (
    organization_id = auth.uid()::uuid
    OR EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = banco.bank_transactions.organization_id
        AND o.organization_id = auth.uid()::uuid
    )
  );

-- Only accountants/admins can update matching status
CREATE POLICY "update_matching_accountant" ON banco.bank_transactions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'accountant')
    )
  );

COMMIT;
```

---

## 📋 CHECKLIST DE IMPLEMENTACIÓN

```markdown
### FASE 1: Setup Estructural (1-2 días)

- [ ] Crear carpetas según § 2
- [ ] Implementar TopBar (§ 3.1)
- [ ] Implementar BottomTabBar (§ 3.2)
- [ ] Setup DB migration (§ 12)
- [ ] Crear tipos TypeScript (§ 10)

### FASE 2: Componentes UI (2-3 días)

- [ ] BankAccountCard (§ 3.3)
- [ ] TransactionListItem (§ 3.4)
- [ ] OCRUploadZone
- [ ] MatchingBadge
- [ ] ReconciliationChart
- [ ] OAuthButton

### FASE 3: Screens (2-3 días)

- [ ] CuentasScreen
- [ ] TransaccionesScreen
- [ ] ReconciliacionScreen
- [ ] ImportarScreen
- [ ] PerfilScreen (shared)

### FASE 4: API Backends (3-4 días)

- [ ] POST /banco/import-statement (§ 5.1)
- [ ] GET /banco/accounts (§ 5.2)
- [ ] POST /banco/oauth-callback (§ 5.3)
- [ ] GET /banco/transactions (§ 5.4)
- [ ] POST /banco/manual-match (§ 5.5)
- [ ] GET /admin/unsupported-banks (§ 5.6)

### FASE 5: Algoritmos (2-3 días)

- [ ] OCR Extraction (§ 6)
- [ ] Transaction Matching (§ 7)
- [ ] Deduplication (§ 7.2)
- [ ] Bank Format Detection (§ 6.3)

### FASE 6: OAuth Integration (2-3 días)

- [ ] BBVA OAuth flow (§ 8.1)
- [ ] Santander OAuth (similar a § 8.1)
- [ ] Token refresh (§ 8.2)

### FASE 7: Admin Features (1-2 días)

- [ ] Unsupported bank requests (§ 9)
- [ ] Email templates (§ 9.4)
- [ ] Admin dashboard (§ 9.3)

### FASE 8: Testing (2-3 días)

- [ ] OCR extraction tests (§ 11.1)
- [ ] Matching tests (§ 11.2)
- [ ] Deduplication tests (§ 11.3)
- [ ] E2E testing

### TOTAL ESTIMADO: 15-20 días laborales
```

---

## 🚀 PRÓXIMOS PASOS

1. **Ejecutar migration SQL** en Supabase
2. **Implementar § 2-4** (setup + componentes)
3. **Verificar con Daniel** antes de continuar § 5+
4. **Comunicar blockers/dudas** al iniciar cada sección

---

**Documento listo para desarrollo. ¡Adelante! 🏦**
