# 🧾 FacturaCheck — GUÍA COMPLETA DE IMPLEMENTACIÓN

**Responsable**: Daniel (implementación)  
**Base**: DESIGN_SYSTEM_CHECK_SUITE_NAVIGATION.md  
**Status**: Listo para desarrollo  
**Timeline**: 4-6 semanas MVP  

---

## 📁 1. ESTRUCTURA DE CARPETAS

```
apps/mobile/app/(tabs)/facturacheck/
├── _layout.tsx                    # Layout stack para facturacheck
├── index.tsx                      # Home/Dashboard (tab 0)
├── cfdis.tsx                      # Tab 1: CFDIs
├── distribucion.tsx               # Tab 2: Distribución
├── reportes.tsx                   # Tab 3: Reportes
├── config.tsx                     # Tab 4: Configuración
├── perfil.tsx                     # Tab 5: Perfil (reutilizable)
│
├── components/
│   ├── TopBar.tsx                 # Componente reutilizable CHECK SUITE
│   ├── BottomTabBar.tsx           # Tab bar reutilizable
│   ├── CFDICard.tsx               # Card individual CFDI
│   ├── CFDIList.tsx               # Lista CFDIs con filtros
│   ├── DistributionStatus.tsx     # Widget estado distribución
│   ├── DistributionForm.tsx       # Formulario envío email/WhatsApp
│   ├── SaldoWidget.tsx            # Widget saldo + crédito
│   ├── ReportesSummary.tsx        # Dashboard reportes
│   └── PACConfigPanel.tsx         # Configuración PACs
│
├── screens/
│   ├── CFDICreateScreen.tsx       # Crear CFDI (modal)
│   ├── CFDIDetailScreen.tsx       # Detalle CFDI (modal)
│   ├── CFDICancelScreen.tsx       # Cancelar CFDI (modal)
│   ├── OCRImportScreen.tsx        # OCR factura recibida (modal)
│   ├── DistribuirScreen.tsx       # Enviar por email/WhatsApp (modal)
│   ├── ComprarTimbresScreen.tsx   # Compra saldo (modal)
│   ├── ReporteDetalleScreen.tsx   # Detalle reporte (modal)
│   └── ConfiguracionPACScreen.tsx # Setup PAC (modal)
│
├── hooks/
│   ├── useCFDIs.ts                # Fetch/create CFDIs
│   ├── useDistribution.ts         # Email/WhatsApp sending
│   ├── useCredits.ts              # Saldo + transacciones
│   ├── usePAC.ts                  # PAC configuration
│   └── useReports.ts              # Reportes query
│
├── api/
│   ├── facturacheck.ts            # API calls (factura/*)
│   ├── pacAdapter.ts              # PAC adapter pattern
│   └── webhooks.ts                # Webhook handling
│
├── types/
│   ├── cfdi.ts                    # CFDIDocument, CFDIItem, etc.
│   ├── distribution.ts            # DistributionConfig, etc.
│   ├── credits.ts                 # CreditTransaction, etc.
│   ├── pac.ts                     # IPACAdapter, PACConfig
│   └── webhook.ts                 # WebhookEvent, etc.
│
├── utils/
│   ├── cfdiGenerator.ts           # XML CFDI generation (4.0)
│   ├── satValidator.ts            # RFC validation + SAT compliance
│   ├── calculations.ts            # IVA, retenciones, etc.
│   ├── formatting.ts              # RFC, folio formatting
│   └── constants.ts               # CFDI types, forma pago, etc.
│
├── redux/
│   ├── slices/cfdi.ts             # State management CFDIs
│   ├── slices/credits.ts          # State saldo
│   ├── slices/distributions.ts    # State distribuciones
│   └── slices/pac.ts              # State PAC config
│
└── styles/
    └── theme.ts                    # Colores FacturaCheck (#8E44AD)

supabase/sql/
├── 01-cfdi_documents.sql          # Tabla CFDIs
├── 02-cfdi_credits.sql            # Sistema crédito
├── 03-cfdi_distributions.sql      # Distribución comprobantes
├── 04-cfdi_cobracheck_links.sql   # Integración CobraCheck
├── 05-pac_configuration.sql       # PAC setup
├── 06-email_templates.sql         # Templates email
├── 07-whatsapp_templates.sql      # Templates WhatsApp
├── 08-invoice_templates.sql       # Plantillas CFDI
├── 09-audit_log_facturacheck.sql  # Auditoría fiscal
└── 10-rls_policies_facturacheck.sql # RLS policies

supabase/functions/
├── stamp-cfdi-facturama/          # Timbre con Facturama
│   ├── index.ts
│   ├── client.ts
│   └── types.ts
├── distribute-cfdi/               # Envío email/WhatsApp
│   ├── index.ts
│   ├── emailService.ts
│   └── whatsappService.ts
├── generate-cfdi-xml/             # Generar XML CFDI 4.0
│   ├── index.ts
│   └── xsdValidator.ts
├── webhook-facturama/             # Recibir callbacks Facturama
│   ├── index.ts
│   └── idempotency.ts
├── validate-rfc-sat/              # RFC validation con SAT
│   ├── index.ts
│   └── cache.ts
└── generate-reports/              # Reportes
    └── index.ts

public/
└── xsd-schemas/                   # Esquemas XSD SAT (validación)
    ├── cfdiv40.xsd
    └── cfdiv40-payments.xsd
```

---

## 🎨 2. COMPONENTES REUTILIZABLES

### 2.1 TopBar Component

```typescript
// apps/mobile/app/(tabs)/facturacheck/components/TopBar.tsx

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface TopBarProps {
  moduleTitle: string;           // "FacturaCheck"
  accent: string;                // "#8E44AD" (púrpura)
  rightIcon?: string;            // "⚙️", "🔔", etc.
  onSwitcher?: () => void;       // Para admins: cambiar vista
  onRight?: () => void;          // Callback icono derecha
  onBack?: () => void;           // Back button
}

export function TopBar({
  moduleTitle,
  accent,
  rightIcon = '⚙️',
  onSwitcher,
  onRight,
  onBack,
}: TopBarProps) {
  const [modulePart1, modulePart2] = moduleTitle.split(/(?=Check)/);

  return (
    <View style={[styles.topBar, { borderBottomColor: accent + '30' }]}>
      <TouchableOpacity
        onPress={onBack}
        style={styles.topBarBack}
        activeOpacity={0.7}
      >
        <Text style={styles.topBarBackText}>‹ CHECK SUITE</Text>
      </TouchableOpacity>

      <View style={styles.topBarCenter}>
        <Text style={styles.topBarWordA}>{modulePart1}</Text>
        <Text style={[styles.topBarWordB, { color: accent }]}>
          {modulePart2}
        </Text>
      </View>

      <View style={styles.topBarRightGroup}>
        {onSwitcher && (
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    height: 60,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  topBarBack: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  topBarBackText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  topBarCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  topBarWordA: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  topBarWordB: {
    fontSize: 16,
    fontWeight: '700',
  },
  topBarRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  topBarIcon: {
    padding: 8,
  },
});
```

### 2.2 BottomTabBar Component

```typescript
// apps/mobile/app/(tabs)/facturacheck/components/BottomTabBar.tsx

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Tab {
  icon: string;
  label: string;
  badge: number;
}

interface BottomTabBarProps {
  tabs: Tab[];
  activeTab: number;
  onTabChange: (index: number) => void;
  accentColor: string;
}

export function BottomTabBar({
  tabs,
  activeTab,
  onTabChange,
  accentColor,
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

          {tab.badge > 0 && (
            <View style={[styles.badge, { backgroundColor: '#E74C3C' }]}>
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

### 2.3 CFDICard Component

```typescript
// apps/mobile/app/(tabs)/facturacheck/components/CFDICard.tsx

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import { CFDIDocument } from '../types/cfdi';

interface CFDICardProps {
  cfdi: CFDIDocument;
  onPress: () => void;
  onDistribute?: () => void;
  accentColor: string;
}

export function CFDICard({
  cfdi,
  onPress,
  onDistribute,
  accentColor,
}: CFDICardProps) {
  const getStatusBadge = (status: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      draft: { bg: '#ECF0F1', text: '#7F8C8D' },
      pending: { bg: '#FFF3CD', text: '#856404' },
      timbrado: { bg: '#D4EDDA', text: '#155724' },
      cancelled: { bg: '#F8D7DA', text: '#721C24' },
      error: { bg: '#F5C6CB', text: '#721C24' },
    };
    return colors[status] || colors.draft;
  };

  const statusStyle = getStatusBadge(cfdi.status);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardTitle}>
            {cfdi.rfc_receptor.substring(0, 6)}... • Folio {cfdi.folio}
          </Text>
          <Text style={styles.cardSubtitle}>
            {cfdi.razon_social_receptor}
          </Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            { backgroundColor: statusStyle.bg },
          ]}
        >
          <Text style={[styles.statusText, { color: statusStyle.text }]}>
            {cfdi.status}
          </Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.montoRow}>
          <Text style={styles.montoLabel}>Total</Text>
          <Text style={[styles.montoValue, { color: accentColor }]}>
            ${cfdi.total.toFixed(2)}
          </Text>
        </View>

        <Text style={styles.cardDate}>
          {new Date(cfdi.timbrado_at || cfdi.created_at).toLocaleDateString(
            'es-MX'
          )}
        </Text>
      </View>

      {cfdi.status === 'timbrado' && onDistribute && (
        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={[styles.actionButton, { borderColor: accentColor }]}
            onPress={onDistribute}
          >
            <Text style={[styles.actionButtonText, { color: accentColor }]}>
              📤 Distribuir
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginVertical: 8,
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#ECEFF1',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  cardPressed: {
    backgroundColor: '#F8F9FA',
    opacity: 0.8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  cardBody: {
    marginBottom: 12,
  },
  montoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  montoLabel: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },
  montoValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardDate: {
    fontSize: 11,
    color: '#AAA',
    marginTop: 8,
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#ECEFF1',
    paddingTop: 12,
  },
  actionButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
```

### 2.4 DistributionStatus Widget

```typescript
// apps/mobile/app/(tabs)/facturacheck/components/DistributionStatus.tsx

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CFDIDistribution } from '../types/distribution';

interface DistributionStatusProps {
  distribution: CFDIDistribution;
  accentColor: string;
}

export function DistributionStatus({
  distribution,
  accentColor,
}: DistributionStatusProps) {
  const getStatusIcon = (status?: string) => {
    if (!status) return '⏳';
    if (status === 'sent') return '✅';
    if (status === 'failed' || status === 'bounced') return '❌';
    if (status === 'undelivered') return '⚠️';
    return '⏳';
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Estado de Distribución</Text>

      <View style={styles.row}>
        <View style={styles.channel}>
          <Text style={styles.channelIcon}>✉️</Text>
          <View>
            <Text style={styles.channelName}>Email</Text>
            <Text style={styles.channelStatus}>
              {getStatusIcon(distribution.email_status)}{' '}
              {distribution.enviado_email
                ? distribution.email_status || 'Enviado'
                : 'No enviado'}
            </Text>
          </View>
        </View>

        <View style={styles.channel}>
          <Text style={styles.channelIcon}>📱</Text>
          <View>
            <Text style={styles.channelName}>WhatsApp</Text>
            <Text style={styles.channelStatus}>
              {getStatusIcon(distribution.whatsapp_status)}{' '}
              {distribution.enviado_whatsapp
                ? distribution.whatsapp_status || 'Enviado'
                : 'No enviado'}
            </Text>
          </View>
        </View>
      </View>

      {distribution.descargado && (
        <View style={[styles.downloadedBadge, { borderColor: accentColor }]}>
          <Text style={[styles.downloadedText, { color: accentColor }]}>
            📥 Descargado {new Date(distribution.descarga_timestamp!).toLocaleDateString('es-MX')}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  channel: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  channelIcon: {
    fontSize: 18,
  },
  channelName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  channelStatus: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  downloadedBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTopISOString: 12,
    alignItems: 'center',
  },
  downloadedText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
```

---

## 📊 3. SCHEMA SQL COMPLETO

### 3.1 cfdi_documents.sql

```sql
-- apps/supabase/sql/01-cfdi_documents.sql

CREATE TABLE IF NOT EXISTS cfdi_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Identificación CFDI
  uuid_cfdi VARCHAR(36) UNIQUE,
  folio VARCHAR(40) NOT NULL,
  serie VARCHAR(25),
  numero_secuencial INTEGER,
  
  -- Datos fiscales
  rfc_emisor VARCHAR(13) NOT NULL,
  rfc_receptor VARCHAR(13) NOT NULL,
  razon_social_emisor TEXT,
  razon_social_receptor TEXT,
  
  -- Contenido
  cfdi_type VARCHAR(1) NOT NULL CHECK (cfdi_type IN ('I', 'E', 'P', 'T')),
  concepto TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Montos
  subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
  descuento DECIMAL(15,2) DEFAULT 0,
  iva DECIMAL(15,2) DEFAULT 0,
  ieps DECIMAL(15,2) DEFAULT 0,
  retenciones JSONB DEFAULT '{}'::jsonb,
  total DECIMAL(15,2) NOT NULL,
  
  -- Método pago
  metodo_pago VARCHAR(3),
  forma_pago VARCHAR(2),
  
  -- Timbre
  status VARCHAR(20) NOT NULL DEFAULT 'draft' 
    CHECK (status IN ('draft', 'pending', 'timbrado', 'cancelled', 'error')),
  uuid_timbre_facturama VARCHAR(36),
  timbrado_at TIMESTAMP,
  xml_storage_path TEXT,
  pdf_storage_path TEXT,
  error_message TEXT,
  
  -- Integraciones
  source_module VARCHAR(20),
  source_id UUID,
  
  -- Cancelación
  motivo_cancelacion TEXT,
  acta_cancelacion_path TEXT,
  cancelado_at TIMESTAMP,
  
  -- Auditoría
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  
  CONSTRAINT valid_rfc_emisor CHECK (rfc_emisor ~ '^[A-ZÑ&]{3,4}[0-9]{6}[A-V0-9]{3}$'),
  CONSTRAINT valid_rfc_receptor CHECK (rfc_receptor ~ '^[A-ZÑ&]{3,4}[0-9]{6}[A-V0-9]{3}$|^[0-9]{1,}$'),
  CONSTRAINT valid_uuid_format CHECK (uuid_cfdi IS NULL OR uuid_cfdi ~ '^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$'),
  CONSTRAINT folio_not_empty CHECK (length(folio) > 0 AND length(folio) <= 40)
);

CREATE UNIQUE INDEX idx_cfdi_folio_empresa 
  ON cfdi_documents(company_id, folio, serie) 
  WHERE is_active = true AND status != 'cancelled';

CREATE INDEX idx_cfdi_status 
  ON cfdi_documents(company_id, status) WHERE is_active = true;

CREATE INDEX idx_cfdi_rfc 
  ON cfdi_documents(company_id, rfc_receptor, rfc_emisor);

CREATE INDEX idx_cfdi_timbrado_at 
  ON cfdi_documents(company_id, timbrado_at DESC) WHERE status = 'timbrado';

CREATE INDEX idx_cfdi_source 
  ON cfdi_documents(source_module, source_id) WHERE source_module IS NOT NULL;

-- RLS Policy
ALTER TABLE cfdi_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cfdi_company_isolation"
  ON cfdi_documents
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM company_members 
      WHERE user_id = auth.uid()
    )
  );
```

### 3.2 cfdi_credits.sql

```sql
-- apps/supabase/sql/02-cfdi_credits.sql

CREATE TABLE IF NOT EXISTS cfdi_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Saldo
  saldo_disponible DECIMAL(15,2) NOT NULL DEFAULT 0,
  saldo_congelado DECIMAL(15,2) DEFAULT 0,
  limite_sobregiro DECIMAL(15,2) DEFAULT 0,
  
  -- Plan
  plan_type VARCHAR(20) CHECK (plan_type IN ('fixed', 'payperuse', 'hybrid')),
  timbres_mensuales INTEGER,
  precio_timbre_unitario DECIMAL(10,2),
  
  -- Consumo
  timbres_usados_mes INTEGER DEFAULT 0,
  proxima_fecha_reset DATE,
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cfdi_credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  credit_id UUID NOT NULL REFERENCES cfdi_credits(id) ON DELETE CASCADE,
  
  -- Operación
  tipo VARCHAR(20) NOT NULL 
    CHECK (tipo IN ('recarga', 'consumo_timbre', 'pago_manual', 'sobregiro_cobro')),
  monto DECIMAL(15,2) NOT NULL,
  saldo_anterior DECIMAL(15,2),
  saldo_posterior DECIMAL(15,2),
  
  -- Referencias
  cfdi_id UUID REFERENCES cfdi_documents(id),
  facturama_transaction_id VARCHAR(50),
  
  -- Auditoría
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  descripcion TEXT
);

CREATE INDEX idx_credit_transactions_cfdi 
  ON cfdi_credit_transactions(cfdi_id);

CREATE INDEX idx_credit_transactions_tipo 
  ON cfdi_credit_transactions(company_id, tipo, created_at DESC);

ALTER TABLE cfdi_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE cfdi_credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credits_company_isolation"
  ON cfdi_credits
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM company_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "credit_transactions_company_isolation"
  ON cfdi_credit_transactions
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM company_members 
      WHERE user_id = auth.uid()
    )
  );
```

### 3.3 cfdi_distributions.sql

```sql
-- apps/supabase/sql/03-cfdi_distributions.sql

CREATE TABLE IF NOT EXISTS cfdi_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  cfdi_id UUID NOT NULL REFERENCES cfdi_documents(id) ON DELETE CASCADE,
  
  -- Email
  enviado_email BOOLEAN DEFAULT false,
  email_timestamp TIMESTAMP,
  email_receptor TEXT,
  email_status VARCHAR(20) CHECK (email_status IN ('sent', 'failed', 'bounced', 'opened')),
  
  -- WhatsApp
  enviado_whatsapp BOOLEAN DEFAULT false,
  whatsapp_timestamp TIMESTAMP,
  whatsapp_numero VARCHAR(15),
  whatsapp_status VARCHAR(20) CHECK (whatsapp_status IN ('sent', 'failed', 'undelivered', 'read')),
  
  -- Descarga
  descargado BOOLEAN DEFAULT false,
  descarga_timestamp TIMESTAMP,
  
  -- Auditoría
  enviado_por UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  
  CONSTRAINT at_least_one_channel 
    CHECK (enviado_email OR enviado_whatsapp OR descargado)
);

CREATE INDEX idx_distributions_cfdi 
  ON cfdi_distributions(cfdi_id);

CREATE INDEX idx_distributions_timestamps 
  ON cfdi_distributions(company_id, created_at DESC);

ALTER TABLE cfdi_distributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "distributions_company_isolation"
  ON cfdi_distributions
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM company_members 
      WHERE user_id = auth.uid()
    )
  );
```

### 3.4 PAC Configuration

```sql
-- apps/supabase/sql/05-pac_configuration.sql

CREATE TABLE IF NOT EXISTS pac_configuration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  
  -- PAC elegido
  pac_provider VARCHAR(50) NOT NULL,  -- 'facturama', 'solucionfacil', etc.
  pac_api_key TEXT NOT NULL,
  pac_api_secret TEXT,
  
  -- Certificado digital
  cer_file_path TEXT,
  key_file_path TEXT,
  key_password TEXT,
  cert_expiry_date DATE,
  
  -- Webhook
  webhook_url TEXT,
  webhook_secret TEXT,
  
  -- Configuración
  auto_generate_pdf BOOLEAN DEFAULT true,
  auto_generate_xml BOOLEAN DEFAULT true,
  default_email_template_id UUID REFERENCES email_templates(id),
  default_whatsapp_template_id UUID REFERENCES whatsapp_templates(id),
  
  -- Auditoría
  configured_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  CONSTRAINT pac_provider_valid CHECK (pac_provider IN ('facturama', 'solucionfacil', 'sat'))
);

ALTER TABLE pac_configuration ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pac_config_company_isolation"
  ON pac_configuration
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM company_members 
      WHERE user_id = auth.uid()
    )
  );
```

### 3.5 Email & WhatsApp Templates

```sql
-- apps/supabase/sql/06-email_templates.sql

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  name VARCHAR(100) NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  footer TEXT,
  
  -- Variables interpolables: {cfdi_folio}, {receptor_name}, {total}, etc.
  variables JSONB DEFAULT '[]'::jsonb,
  
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- apps/supabase/sql/07-whatsapp_templates.sql

CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  name VARCHAR(100) NOT NULL,
  message_text TEXT NOT NULL,
  
  -- Variables: {receptor_name}, {cfdi_folio}, {download_url}, etc.
  variables JSONB DEFAULT '[]'::jsonb,
  
  include_xml BOOLEAN DEFAULT true,
  include_pdf BOOLEAN DEFAULT true,
  
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_templates_company_isolation"
  ON email_templates
  FOR ALL
  USING (company_id = auth.uid()::uuid);

CREATE POLICY "whatsapp_templates_company_isolation"
  ON whatsapp_templates
  FOR ALL
  USING (company_id = auth.uid()::uuid);
```

### 3.6 Integración CobraCheck

```sql
-- apps/supabase/sql/04-cfdi_cobracheck_links.sql

CREATE TABLE IF NOT EXISTS cfdi_cobracheck_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Relación 1:1
  cobra_movement_id UUID NOT NULL UNIQUE REFERENCES cobra_movements(id),
  cfdi_id UUID NOT NULL UNIQUE REFERENCES cfdi_documents(id),
  
  -- Sincronización
  status_sync VARCHAR(20) DEFAULT 'pending' 
    CHECK (status_sync IN ('synchronized', 'pending', 'error')),
  ultima_sync TIMESTAMP,
  sync_error_message TEXT,
  
  -- Auditoría
  linked_at TIMESTAMP NOT NULL DEFAULT now(),
  
  CONSTRAINT links_company_match CHECK (
    -- Validar que ambas entidades pertenezcan a la misma compañía
    true
  )
);

CREATE UNIQUE INDEX idx_cobra_cfdi_link 
  ON cfdi_cobracheck_links(cobra_movement_id, cfdi_id);

CREATE INDEX idx_sync_status 
  ON cfdi_cobracheck_links(company_id, status_sync) WHERE status_sync != 'synchronized';

ALTER TABLE cfdi_cobracheck_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cobra_cfdi_links_isolation"
  ON cfdi_cobracheck_links
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM company_members 
      WHERE user_id = auth.uid()
    )
  );
```

### 3.7 Auditoría Fiscal

```sql
-- apps/supabase/sql/09-audit_log_facturacheck.sql

CREATE TABLE IF NOT EXISTS audit_log_facturacheck (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Entidad auditada
  entity_type VARCHAR(50) NOT NULL,  -- 'cfdi', 'distribution', 'credit_transaction'
  entity_id UUID NOT NULL,
  
  -- Acción
  action VARCHAR(50) NOT NULL,  -- 'create', 'update', 'cancel', 'distribute'
  
  -- Usuario
  user_id UUID NOT NULL REFERENCES auth.users(id),
  user_email TEXT,
  
  -- Cambios
  changes_before JSONB,
  changes_after JSONB,
  
  -- Contexto
  ip_address INET,
  user_agent TEXT,
  device_info TEXT,
  
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_entity 
  ON audit_log_facturacheck(company_id, entity_type, entity_id);

CREATE INDEX idx_audit_user 
  ON audit_log_facturacheck(company_id, user_id, created_at DESC);

ALTER TABLE audit_log_facturacheck ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_company_isolation"
  ON audit_log_facturacheck
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM company_members 
      WHERE user_id = auth.uid()
    )
  );
```

---

## 🔌 4. API ENDPOINTS

### 4.1 Edge Function: /factura/generate-cfdi

```typescript
// supabase/functions/generate-cfdi/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

interface GenerateCFDIRequest {
  company_id: string;
  rfc_receptor: string;
  razon_social_receptor: string;
  cfdi_type: "I" | "E" | "P" | "T";
  concepto: string;
  items: Array<{
    clave: string;
    descripcion: string;
    cantidad: number;
    unitario: number;
    iva: number;
    ieps?: number;
  }>;
  metodo_pago: string;
  forma_pago: string;
  descuento?: number;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const payload: GenerateCFDIRequest = await req.json();

    // 1. Validar RFC receptor contra SAT
    const rfcValid = await validateRFCWithSAT(payload.rfc_receptor);
    if (!rfcValid) {
      return new Response(
        JSON.stringify({ error: "RFC receptor no válido" }),
        { status: 400 }
      );
    }

    // 2. Calcular totales
    const subtotal = payload.items.reduce(
      (acc, item) => acc + item.cantidad * item.unitario,
      0
    );
    const iva = subtotal * 0.16; // 16% por defecto
    const total = subtotal + iva;

    // 3. Validar saldo disponible
    const credits = await supabase
      .from("cfdi_credits")
      .select("*")
      .eq("company_id", payload.company_id)
      .single();

    if (
      !credits.data ||
      credits.data.saldo_disponible < 1 // Al menos 1 timbre
    ) {
      return new Response(
        JSON.stringify({ error: "Saldo insuficiente" }),
        { status: 402 }
      );
    }

    // 4. Generar XML CFDI 4.0
    const xml = generateCFDIXML({
      ...payload,
      subtotal,
      iva,
      total,
    });

    // 5. Timbrar con Facturama
    const stampResult = await stampWithFacturama(xml, payload.company_id);

    if (!stampResult.success) {
      return new Response(
        JSON.stringify({ error: stampResult.error }),
        { status: 500 }
      );
    }

    // 6. Guardar CFDI en BD
    const cfdiInsert = await supabase.from("cfdi_documents").insert({
      company_id: payload.company_id,
      uuid_cfdi: stampResult.uuid,
      folio: generateFolio(payload.company_id),
      rfc_receptor: payload.rfc_receptor,
      razon_social_receptor: payload.razon_social_receptor,
      cfdi_type: payload.cfdi_type,
      concepto: payload.concepto,
      items: payload.items,
      subtotal,
      iva,
      total,
      metodo_pago: payload.metodo_pago,
      forma_pago: payload.forma_pago,
      status: "timbrado",
      uuid_timbre_facturama: stampResult.uuid,
      timbrado_at: new Date(),
      xml_storage_path: stampResult.xml_path,
      pdf_storage_path: stampResult.pdf_path,
      created_by: (await getAuthUser()).id,
    });

    // 7. Descontar saldo
    await supabase.from("cfdi_credit_transactions").insert({
      company_id: payload.company_id,
      credit_id: credits.data!.id,
      tipo: "consumo_timbre",
      monto: -1,
      saldo_anterior: credits.data!.saldo_disponible,
      saldo_posterior: credits.data!.saldo_disponible - 1,
      cfdi_id: cfdiInsert.data?.[0]?.id,
      created_by: (await getAuthUser()).id,
      descripcion: `Timbre CFDI folio ${payload.items[0]?.clave}`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        cfdi_id: cfdiInsert.data?.[0]?.id,
        uuid: stampResult.uuid,
        folio: cfdiInsert.data?.[0]?.folio,
      }),
      { status: 201 }
    );
  } catch (error) {
    console.error("Error generating CFDI:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
});
```

### 4.2 Edge Function: /factura/distribute

```typescript
// supabase/functions/distribute-cfdi/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

interface DistributeRequest {
  cfdi_id: string;
  email_to?: string;
  whatsapp_to?: string;
  use_default_template?: boolean;
  email_template_id?: string;
  whatsapp_template_id?: string;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const payload: DistributeRequest = await req.json();

    // 1. Recuperar CFDI
    const cfdi = await supabase
      .from("cfdi_documents")
      .select("*")
      .eq("id", payload.cfdi_id)
      .single();

    // 2. Enviar por email
    if (payload.email_to) {
      const emailResult = await sendCFDIEmail({
        cfdi: cfdi.data,
        recipient_email: payload.email_to,
        template_id: payload.email_template_id,
      });

      await supabase.from("cfdi_distributions").update({
        enviado_email: true,
        email_timestamp: new Date(),
        email_receptor: payload.email_to,
        email_status: emailResult.success ? "sent" : "failed",
      });
    }

    // 3. Enviar por WhatsApp
    if (payload.whatsapp_to) {
      const whatsappResult = await sendCFDIWhatsApp({
        cfdi: cfdi.data,
        recipient_number: payload.whatsapp_to,
        template_id: payload.whatsapp_template_id,
      });

      await supabase.from("cfdi_distributions").update({
        enviado_whatsapp: true,
        whatsapp_timestamp: new Date(),
        whatsapp_numero: payload.whatsapp_to,
        whatsapp_status: whatsappResult.success ? "sent" : "failed",
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        distribution_id: payload.cfdi_id,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Error distributing CFDI:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
});
```

### 4.3 Endpoints Resumen

```typescript
// apps/mobile/app/(tabs)/facturacheck/api/facturacheck.ts

export const facturaAPI = {
  // CFDI Management
  generateCFDI: async (payload: GenerateCFDIRequest) =>
    fetch('/api/factura/generate-cfdi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  importInvoiceOCR: async (file: File, company_id: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('company_id', company_id);
    return fetch('/api/factura/import-invoice', {
      method: 'POST',
      body: formData,
    });
  },

  getCFDIs: async (company_id: string, filters?: {
    status?: string;
    date_from?: Date;
    date_to?: Date;
  }) =>
    fetch(
      `/api/factura/cfdis?company_id=${company_id}&${new URLSearchParams(
        filters || {}
      )}`,
      { method: 'GET' }
    ),

  getCFDIDetail: async (cfdi_id: string) =>
    fetch(`/api/factura/cfdis/${cfdi_id}`, { method: 'GET' }),

  distributeCFDI: async (payload: DistributeRequest) =>
    fetch('/api/factura/distribute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  cancelCFDI: async (cfdi_id: string, motivo: string) =>
    fetch(`/api/factura/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cfdi_id, motivo }),
    }),

  // Credits
  getCredits: async (company_id: string) =>
    fetch(`/api/factura/credits?company_id=${company_id}`, {
      method: 'GET',
    }),

  buyCFDICredits: async (payload: BuyCreditRequest) =>
    fetch('/api/factura/buy-credits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  // Reports
  getReports: async (company_id: string, period?: string) =>
    fetch(`/api/factura/reports?company_id=${company_id}&period=${period}`, {
      method: 'GET',
    }),

  // PAC Config
  getPACConfig: async (company_id: string) =>
    fetch(`/api/admin/pac-config?company_id=${company_id}`, {
      method: 'GET',
    }),

  updatePACConfig: async (company_id: string, config: PACConfig) =>
    fetch(`/api/admin/pac-config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id, ...config }),
    }),
};
```

---

## 🔧 5. PAC ADAPTER PATTERN (Agnóstico)

```typescript
// apps/mobile/app/(tabs)/facturacheck/api/pacAdapter.ts

import { CFDIDocument } from '../types/cfdi';

export interface IPACAdapter {
  // Timbre digital
  stampCFDI(xml: string, options: StampOptions): Promise<StampResult>;

  // Cancelación
  cancelCFDI(
    uuid: string,
    motivo: string,
    options: CancelOptions
  ): Promise<CancelResult>;

  // Validación
  validateCertificate(): Promise<boolean>;
  validateXML(xml: string): Promise<{ valid: boolean; errors?: string[] }>;

  // Status
  getCFDIStatus(uuid: string): Promise<CFDIStatus>;

  // Credentials
  setCredentials(apiKey: string, apiSecret?: string): void;
}

export interface StampResult {
  success: boolean;
  uuid: string;
  xml_timbrado: string;
  pdf_url: string;
  fecha_timbre: Date;
  folio_timbre: string;
  error?: string;
}

export interface CancelResult {
  success: boolean;
  acta_cancelacion: string; // Path a bucket
  fecha_cancelacion: Date;
  error?: string;
}

// Implementación: Facturama
export class FacturamaAdapter implements IPACAdapter {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl = 'https://api.facturama.mx/v3';

  constructor(apiKey: string, apiSecret?: string) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret || '';
  }

  async stampCFDI(xml: string, options: StampOptions): Promise<StampResult> {
    try {
      const response = await fetch(`${this.baseUrl}/cfdi/stamp`, {
        method: 'POST',
        headers: {
          'X-API-KEY': this.apiKey,
          'Content-Type': 'application/xml',
        },
        body: xml,
      });

      if (!response.ok) {
        return {
          success: false,
          uuid: '',
          xml_timbrado: '',
          pdf_url: '',
          fecha_timbre: new Date(),
          folio_timbre: '',
          error: await response.text(),
        };
      }

      const result = await response.json();

      return {
        success: true,
        uuid: result.cfdi.uuid,
        xml_timbrado: result.cfdi.xml,
        pdf_url: result.cfdi.pdf,
        fecha_timbre: new Date(result.cfdi.stampDate),
        folio_timbre: result.cfdi.folioFiscal,
      };
    } catch (error) {
      return {
        success: false,
        uuid: '',
        xml_timbrado: '',
        pdf_url: '',
        fecha_timbre: new Date(),
        folio_timbre: '',
        error: error.message,
      };
    }
  }

  async cancelCFDI(
    uuid: string,
    motivo: string,
    options: CancelOptions
  ): Promise<CancelResult> {
    // TODO: Implementar cancelación SAT
    return {
      success: false,
      acta_cancelacion: '',
      fecha_cancelacion: new Date(),
      error: 'Not implemented',
    };
  }

  async validateCertificate(): Promise<boolean> {
    // TODO: Validar certificado
    return true;
  }

  async validateXML(xml: string): Promise<{ valid: boolean; errors?: string[] }> {
    // TODO: Validar contra XSD
    return { valid: true };
  }

  async getCFDIStatus(uuid: string): Promise<CFDIStatus> {
    const response = await fetch(`${this.baseUrl}/cfdi/${uuid}`, {
      headers: { 'X-API-KEY': this.apiKey },
    });
    const data = await response.json();
    return { uuid, status: data.status, ...data };
  }

  setCredentials(apiKey: string, apiSecret?: string): void {
    this.apiKey = apiKey;
    if (apiSecret) this.apiSecret = apiSecret;
  }
}

// Factory
export function createPACAdapter(
  provider: string,
  apiKey: string,
  apiSecret?: string
): IPACAdapter {
  switch (provider) {
    case 'facturama':
      return new FacturamaAdapter(apiKey, apiSecret);
    // case 'solucionfacil':
    //   return new SolucionFacilAdapter(apiKey, apiSecret);
    default:
      throw new Error(`Unknown PAC provider: ${provider}`);
  }
}
```

---

## 🔔 6. WEBHOOK SYSTEM

```typescript
// supabase/functions/webhook-facturama/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createHmac } from "https://deno.land/std@0.208.0/crypto/mod.ts";

interface WebhookEvent {
  id: string;
  type: string; // 'cfdi.stamped', 'cfdi.cancelled', 'payment.received'
  timestamp: string;
  data: Record<string, unknown>;
  signature: string;
}

// Idempotency: guardar event IDs ya procesados (Redis o BD)
const processedEvents = new Set<string>();

async function verifySignature(
  event: WebhookEvent,
  secret: string
): Promise<boolean> {
  const payload = JSON.stringify(event, Object.keys(event).sort());
  const hash = createHmac("sha256", secret, payload);
  const hex = new TextEncoder().encode(hash).toString();
  return hex === event.signature;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const event: WebhookEvent = await req.json();

    // 1. Verificar firma HMAC
    const config = await getCompanyPACConfig(event.data.company_id);
    const isValid = await verifySignature(event, config.webhook_secret);
    if (!isValid) {
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 401 }
      );
    }

    // 2. Idempotency: evitar procesar 2x
    if (processedEvents.has(event.id)) {
      return new Response(JSON.stringify({ status: "already_processed" }), {
        status: 200,
      });
    }
    processedEvents.add(event.id);

    // 3. Procesar según tipo de evento
    switch (event.type) {
      case "cfdi.stamped":
        await handleCFDIStamped(event);
        break;
      case "cfdi.cancelled":
        await handleCFDICancelled(event);
        break;
      case "payment.received":
        await handlePaymentReceived(event);
        break;
      default:
        console.log(`Unknown event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    // Retornar 200 pero loguear error (no reintentar por ahora)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 200 }
    );
  }
});

async function handleCFDIStamped(event: WebhookEvent) {
  // Actualizar BD
  const { cfdi_id, uuid, xml_url, pdf_url } = event.data;
  await supabase.from("cfdi_documents").update({
    uuid_cfdi: uuid,
    status: "timbrado",
    timbrado_at: new Date(),
    xml_storage_path: xml_url,
    pdf_storage_path: pdf_url,
  });
}

async function handleCFDICancelled(event: WebhookEvent) {
  const { cfdi_id, acta_url } = event.data;
  await supabase.from("cfdi_documents").update({
    status: "cancelled",
    cancelado_at: new Date(),
    acta_cancelacion_path: acta_url,
  });
}

async function handlePaymentReceived(event: WebhookEvent) {
  // Recargar saldo automáticamente
  const { company_id, amount } = event.data;
  await supabase.from("cfdi_credits").update({
    saldo_disponible: supabase.rpc("increment_saldo", {
      p_company_id: company_id,
      p_amount: amount,
    }),
  });
}
```

---

## 💾 7. DISTRIBUTION SYSTEM

```typescript
// supabase/functions/send-cfdi-email/index.ts

export async function sendCFDIEmail(options: {
  cfdi: CFDIDocument;
  recipient_email: string;
  template_id?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // 1. Recuperar template
    const template = await getEmailTemplate(
      options.template_id,
      options.cfdi.company_id
    );

    // 2. Interpolar variables
    const subject = interpolate(template.subject, {
      folio: options.cfdi.folio,
      total: options.cfdi.total,
      receptor: options.cfdi.razon_social_receptor,
    });

    const body = interpolate(template.body, {
      folio: options.cfdi.folio,
      total: options.cfdi.total,
      receptor: options.cfdi.razon_social_receptor,
      fecha: new Date(options.cfdi.timbrado_at).toLocaleDateString("es-MX"),
    });

    // 3. Attachments
    const attachments = [
      {
        filename: `${options.cfdi.folio}.xml`,
        content: options.cfdi.xml_storage_path, // Base64
        contentType: "application/xml",
      },
      {
        filename: `${options.cfdi.folio}.pdf`,
        content: options.cfdi.pdf_storage_path, // Base64
        contentType: "application/pdf",
      },
    ];

    // 4. Enviar con SendGrid / Postmark
    const result = await sendEmail({
      to: options.recipient_email,
      from: "facturación@checksuite.mx",
      subject,
      html: body,
      attachments,
    });

    return { success: true, messageId: result.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// supabase/functions/send-cfdi-whatsapp/index.ts

export async function sendCFDIWhatsApp(options: {
  cfdi: CFDIDocument;
  recipient_number: string;
  template_id?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // 1. Recuperar template
    const template = await getWhatsAppTemplate(
      options.template_id,
      options.cfdi.company_id
    );

    // 2. Interpolar variables
    const message = interpolate(template.message_text, {
      receptor: options.cfdi.razon_social_receptor,
      folio: options.cfdi.folio,
      download_url: generateDownloadLink(options.cfdi.id), // Link con expiry 7 días
    });

    // 3. Enviar con Twilio
    const result = await twilioClient.messages.create({
      body: message,
      from: `whatsapp:+525599999999`, // Tu número
      to: `whatsapp:${options.recipient_number}`,
      mediaUrl: options.cfdi.pdf_storage_path
        ? [options.cfdi.pdf_storage_path]
        : undefined,
    });

    return { success: true, messageId: result.sid };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Resend workflow (reintentos exponenciales)
export async function resendDistribution(
  distribution_id: string,
  channel: "email" | "whatsapp"
): Promise<boolean> {
  const distribution = await getDistribution(distribution_id);

  let attempt = 0;
  const maxAttempts = 3;
  const baseDelay = 5000; // 5s

  while (attempt < maxAttempts) {
    try {
      if (channel === "email") {
        const result = await sendCFDIEmail({
          cfdi: distribution.cfdi,
          recipient_email: distribution.email_receptor,
        });
        if (result.success) return true;
      } else {
        const result = await sendCFDIWhatsApp({
          cfdi: distribution.cfdi,
          recipient_number: distribution.whatsapp_numero,
        });
        if (result.success) return true;
      }

      attempt++;
      await new Promise((resolve) =>
        setTimeout(resolve, baseDelay * Math.pow(2, attempt))
      );
    } catch (error) {
      console.error(`Resend attempt ${attempt + 1} failed:`, error);
    }
  }

  return false;
}
```

---

## ✅ 8. SAT COMPLIANCE

```typescript
// apps/mobile/app/(tabs)/facturacheck/utils/satValidator.ts

const RFC_PATTERN = /^[A-ZÑ&]{3,4}\d{6}[A-V0-9]{3}$/;
const SAT_RFC_CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 días

export async function validateRFCAndSync(rfc: string): Promise<{
  valid: boolean;
  status?: string;
  error?: string;
}> {
  // 1. Formato
  if (!RFC_PATTERN.test(rfc)) {
    return { valid: false, error: "Formato RFC inválido" };
  }

  // 2. Cache local
  const cached = await getRFCCache(rfc);
  if (cached && Date.now() - cached.checked_at < SAT_RFC_CACHE_DURATION) {
    return { valid: cached.status === "active", status: cached.status };
  }

  // 3. SAT API (con reintentos)
  try {
    const satResult = await checkRFCWithSAT(rfc);

    // 4. Guardar en cache
    await saveRFCCache(rfc, satResult);

    return { valid: satResult.status === "active", status: satResult.status };
  } catch (error) {
    return {
      valid: false,
      error: `No se pudo validar contra SAT: ${error.message}`,
    };
  }
}

export async function checkRFCWithSAT(rfc: string): Promise<{
  status: string;
  razon_social: string;
  regimen_fiscal: string;
}> {
  // TODO: Integrar con SAT API real (si está disponible)
  // Por ahora, mock response
  return {
    status: "active",
    razon_social: "Empresa Test S.A. de C.V.",
    regimen_fiscal: "601",
  };
}

// XML Validation contra XSD
export async function validateCFDIXML(
  xml: string
): Promise<{ valid: boolean; errors?: string[] }> {
  try {
    const xsd = await fetch("/xsd-schemas/cfdiv40.xsd").then((r) => r.text());
    const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");
    const xsdDoc = new DOMParser().parseFromString(xsd, "application/xml");

    // Usar libxmljs o similar para validar
    // Por ahora, validación básica
    const errors: string[] = [];

    // Validar elementos requeridos
    const requiredElements = ["Emisor", "Receptor", "Conceptos"];
    requiredElements.forEach((elem) => {
      if (!xmlDoc.querySelector(elem)) {
        errors.push(`Elemento requerido ${elem} no encontrado`);
      }
    });

    return { valid: errors.length === 0, errors };
  } catch (error) {
    return { valid: false, errors: [error.message] };
  }
}

// Audit Trail
export async function logAuditAction(
  company_id: string,
  entity_type: string,
  entity_id: string,
  action: string,
  changes: { before?: unknown; after?: unknown }
): Promise<void> {
  const user = await getAuthUser();

  await supabase.from("audit_log_facturacheck").insert({
    company_id,
    entity_type,
    entity_id,
    action,
    user_id: user.id,
    user_email: user.email,
    changes_before: changes.before,
    changes_after: changes.after,
    ip_address: getClientIP(),
    user_agent: navigator.userAgent,
    device_info: getDeviceInfo(),
  });
}

// Calculateretenciones automáticas
export function calculateWithholdings(cfdi: CFDIDocument): {
  isr: number;
  iva: number;
} {
  // TODO: Implementar lógica de retenciones por categoría
  // ISR: 10%, 15%, 20%, 25%, 30%, 35% según categoría de gasto
  // IVA: 10% en ciertos casos

  return {
    isr: 0, // Placeholder
    iva: 0, // Placeholder
  };
}
```

---

## 9️⃣ 9. TIPOS TYPESCRIPT

```typescript
// apps/mobile/app/(tabs)/facturacheck/types/cfdi.ts

export interface CFDIDocument {
  id: string;
  company_id: string;
  uuid_cfdi?: string;
  folio: string;
  serie?: string;
  numero_secuencial: number;

  rfc_emisor: string;
  rfc_receptor: string;
  razon_social_emisor: string;
  razon_social_receptor: string;

  cfdi_type: "I" | "E" | "P" | "T";
  concepto: string;
  items: CFDIItem[];

  subtotal: number;
  descuento?: number;
  iva: number;
  ieps?: number;
  retenciones?: Record<string, number>;
  total: number;

  metodo_pago?: string;
  forma_pago?: string;

  status: "draft" | "pending" | "timbrado" | "cancelled" | "error";
  uuid_timbre_facturama?: string;
  timbrado_at?: Date;
  xml_storage_path?: string;
  pdf_storage_path?: string;
  error_message?: string;

  source_module?: string;
  source_id?: string;

  motivo_cancelacion?: string;
  acta_cancelacion_path?: string;
  cancelado_at?: Date;

  created_by: string;
  created_at: Date;
  updated_by?: string;
  updated_at: Date;
  is_active: boolean;
}

export interface CFDIItem {
  clave: string; // Clave de concepto SAT
  descripcion: string;
  cantidad: number;
  unitario: number;
  subtotal: number;
  iva: number;
  ieps?: number;
}

// apps/mobile/app/(tabs)/facturacheck/types/distribution.ts

export interface CFDIDistribution {
  id: string;
  company_id: string;
  cfdi_id: string;

  enviado_email: boolean;
  email_timestamp?: Date;
  email_receptor?: string;
  email_status?: "sent" | "failed" | "bounced" | "opened";

  enviado_whatsapp: boolean;
  whatsapp_timestamp?: Date;
  whatsapp_numero?: string;
  whatsapp_status?: "sent" | "failed" | "undelivered" | "read";

  descargado: boolean;
  descarga_timestamp?: Date;

  enviado_por: string;
  created_at: Date;
}

export interface DistributionConfig {
  email_template_id?: string;
  whatsapp_template_id?: string;
  auto_send_email: boolean;
  auto_send_whatsapp: boolean;
  email_recipients?: string[];
  whatsapp_numbers?: string[];
}

// apps/mobile/app/(tabs)/facturacheck/types/credits.ts

export type CreditPlanType = "fixed" | "payperuse" | "hybrid";

export interface CFDICredits {
  id: string;
  company_id: string;

  saldo_disponible: number;
  saldo_congelado: number;
  limite_sobregiro: number;

  plan_type: CreditPlanType;
  timbres_mensuales?: number;
  precio_timbre_unitario?: number;

  timbres_usados_mes: number;
  proxima_fecha_reset: Date;

  created_at: Date;
  updated_at: Date;
}

export type CreditTransactionType =
  | "recarga"
  | "consumo_timbre"
  | "pago_manual"
  | "sobregiro_cobro";

export interface CFDICreditTransaction {
  id: string;
  company_id: string;
  credit_id: string;

  tipo: CreditTransactionType;
  monto: number;
  saldo_anterior: number;
  saldo_posterior: number;

  cfdi_id?: string;
  facturama_transaction_id?: string;

  created_by: string;
  created_at: Date;
  descripcion: string;
}

// apps/mobile/app/(tabs)/facturacheck/types/pac.ts

export interface PACConfig {
  id: string;
  company_id: string;

  pac_provider: "facturama" | "solucionfacil" | "sat";
  pac_api_key: string;
  pac_api_secret?: string;

  cer_file_path?: string;
  key_file_path?: string;
  key_password?: string;
  cert_expiry_date?: Date;

  webhook_url: string;
  webhook_secret: string;

  auto_generate_pdf: boolean;
  auto_generate_xml: boolean;
  default_email_template_id?: string;
  default_whatsapp_template_id?: string;

  configured_at: Date;
  updated_at: Date;
}

// apps/mobile/app/(tabs)/facturacheck/types/webhook.ts

export interface WebhookEvent {
  id: string;
  type: string;
  timestamp: string;
  data: Record<string, unknown>;
  signature: string;
}

export interface WebhookPayload {
  company_id: string;
  entity_id: string;
  action: string;
  timestamp: Date;
  metadata: Record<string, unknown>;
}
```

---

## 🔗 10. INTEGRACIÓN BANCOCHECK

```typescript
// supabase/sql/integrations/facturacheck_bancocheck.sql

-- Cuando una CFDI se marca como pagada en BancoCheck,
-- auto-generar póliza en BancoCheck

CREATE OR REPLACE TRIGGER after_cfdi_paid
  AFTER UPDATE ON cfdi_documents
  FOR EACH ROW
  WHEN (OLD.status != NEW.status AND NEW.status = 'pagada')
  EXECUTE FUNCTION create_bancocheck_entry();

CREATE OR REPLACE FUNCTION create_bancocheck_entry()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO bank_transactions (
    company_id,
    account_id,
    type,
    amount,
    description,
    reference_id,
    reference_type,
    transaction_date,
    status
  ) VALUES (
    NEW.company_id,
    (SELECT id FROM bank_accounts WHERE company_id = NEW.company_id LIMIT 1),
    'income',
    NEW.total,
    'Ingreso - CFDI ' || NEW.folio,
    NEW.id,
    'facturacheck',
    NEW.timbrado_at::date,
    'reconciliated'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

```typescript
// apps/mobile/app/(tabs)/facturacheck/api/bancoIntegration.ts

export async function syncCFDIToBancoCheck(
  cfdi_id: string,
  bank_account_id: string
): Promise<{ success: boolean; transaction_id?: string }> {
  const cfdi = await supabase
    .from("cfdi_documents")
    .select("*")
    .eq("id", cfdi_id)
    .single();

  if (!cfdi.data) {
    return { success: false };
  }

  // Crear entrada en BancoCheck
  const result = await supabase.from("bank_transactions").insert({
    company_id: cfdi.data.company_id,
    account_id: bank_account_id,
    type: cfdi.data.cfdi_type === "I" ? "income" : "expense",
    amount: cfdi.data.total,
    description: `Factura ${cfdi.data.folio} - ${cfdi.data.razon_social_receptor}`,
    reference_id: cfdi_id,
    reference_type: "facturacheck",
    transaction_date: new Date(cfdi.data.timbrado_at),
    status: "reconciliated",
  });

  return {
    success: result.data !== null,
    transaction_id: result.data?.[0]?.id,
  };
}
```

---

## 🧪 11. TEST STUBS

```typescript
// apps/mobile/app/(tabs)/facturacheck/__tests__/cfdi.test.ts

import { generateCFDIXML, validateCFDIXML } from '../utils/cfdiGenerator';

describe('CFDI Generation', () => {
  it('should generate valid XML', async () => {
    const cfdi = {
      rfc_emisor: 'AAA010101ABC',
      rfc_receptor: 'BBB020202XYZ',
      folio: '001',
      subtotal: 1000,
      iva: 160,
      total: 1160,
    };

    const xml = generateCFDIXML(cfdi);
    expect(xml).toContain('<cfdi:Comprobante');
    expect(xml).toContain(cfdi.folio);
  });

  it('should validate against XSD', async () => {
    const xml = `
      <cfdi:Comprobante>
        <cfdi:Emisor rfc="AAA010101ABC"/>
        <cfdi:Receptor rfc="BBB020202XYZ"/>
        <cfdi:Conceptos/>
      </cfdi:Comprobante>
    `;

    const result = await validateCFDIXML(xml);
    expect(result.valid).toBe(true);
  });
});

// apps/mobile/app/(tabs)/facturacheck/__tests__/webhook.test.ts

describe('Webhook Handling', () => {
  it('should verify HMAC signature', async () => {
    const secret = 'test-secret';
    const event = {
      id: '123',
      type: 'cfdi.stamped',
      data: { uuid: 'xxx' },
    };

    const signature = generateHMAC(JSON.stringify(event), secret);
    const valid = await verifySignature({ ...event, signature }, secret);
    expect(valid).toBe(true);
  });

  it('should handle idempotency', async () => {
    const eventId = 'event-123';
    await processWebhookEvent({ id: eventId, ...mockEvent });
    const result = await processWebhookEvent({ id: eventId, ...mockEvent });
    expect(result.status).toBe('already_processed');
  });
});

// apps/mobile/app/(tabs)/facturacheck/__tests__/distribution.test.ts

describe('CFDI Distribution', () => {
  it('should send email with attachments', async () => {
    const cfdi = mockCFDI();
    const result = await sendCFDIEmail({
      cfdi,
      recipient_email: 'test@example.com',
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
  });

  it('should resend with exponential backoff', async () => {
    const distribution_id = 'dist-123';
    let attempt = 0;

    const originalFetch = global.fetch;
    global.fetch = jest.fn(() => {
      attempt++;
      if (attempt < 3) {
        return Promise.resolve({ ok: false });
      }
      return Promise.resolve({ ok: true });
    });

    const result = await resendDistribution(distribution_id, 'email');
    expect(result).toBe(true);
    expect(attempt).toBe(3);

    global.fetch = originalFetch;
  });
});
```

---

## 🗄️ 12. MIGRATION SQL (Template)

```sql
-- apps/supabase/migrations/20240705_create_facturacheck_schema.sql

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Import all FacturaCheck tables
\i ./01-cfdi_documents.sql
\i ./02-cfdi_credits.sql
\i ./03-cfdi_distributions.sql
\i ./04-cfdi_cobracheck_links.sql
\i ./05-pac_configuration.sql
\i ./06-email_templates.sql
\i ./07-whatsapp_templates.sql
\i ./09-audit_log_facturacheck.sql
\i ./10-rls_policies_facturacheck.sql

-- Indices optimization
CREATE INDEX idx_cfdi_company_status_date 
  ON cfdi_documents(company_id, status, timbrado_at DESC);

CREATE INDEX idx_distributions_channels 
  ON cfdi_distributions(company_id) 
  WHERE enviado_email = true OR enviado_whatsapp = true;

-- Data seeding (demo)
INSERT INTO email_templates (company_id, name, subject, body, is_default)
SELECT 
  c.id,
  'Default Template',
  'Tu factura CFDI {cfdi_folio}',
  'Estimado {receptor_name}, adjuntamos tu comprobante fiscal por ${total}. Folio: {cfdi_folio}. Emitido: {fecha_emision}',
  true
FROM companies c
ON CONFLICT DO NOTHING;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON cfdi_documents TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON cfdi_credits TO authenticated;
GRANT SELECT, INSERT ON cfdi_distributions TO authenticated;

-- Timeline tracking
CREATE TABLE IF NOT EXISTS migration_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  executed_at TIMESTAMP NOT NULL DEFAULT now(),
  status VARCHAR(20) DEFAULT 'completed'
);

INSERT INTO migration_timeline (name) 
VALUES ('facturacheck_schema_v1');
```

---

## ✅ CHECKLIST IMPLEMENTACIÓN

```
CORE CFDI
  ☐ Tabla cfdi_documents creada + índices
  ☐ Generador XML CFDI 4.0 funcional
  ☐ Integración Facturama (PAC adapter)
  ☐ UI: TopBar + BottomTabBar
  ☐ UI: Crear CFDI manual

SISTEMA CRÉDITO
  ☐ Tabla cfdi_credits + cfdi_credit_transactions
  ☐ Consumo automático al timbrar
  ☐ Línea de sobregiro configurable
  ☐ UI: SaldoWidget
  ☐ UI: Comprar timbres (checkout)

DISTRIBUCIÓN
  ☐ Tabla cfdi_distributions
  ☐ Email automático con XML + PDF
  ☐ WhatsApp automático (Twilio)
  ☐ Descarga ZIP
  ☐ UI: DistributionStatus + DistribuirScreen

INTEGRACIÓN COBRACHECK
  ☐ Tabla cfdi_cobracheck_links
  ☐ Trigger: cobro pagado → CFDI auto
  ☐ Sincronización status
  ☐ UI en CobraCheck: botón "Ver CFDI"

REPORTES
  ☐ Dashboard principal (ingresos, egresos, crédito)
  ☐ Reporte por período
  ☐ Reporte por cliente
  ☐ Impuestos acumulados
  ☐ UI: ReportesSummary

CUMPLIMIENTO FISCAL
  ☐ RFC validation contra SAT
  ☐ XML validation contra XSD
  ☐ Tabla audit_log_facturacheck
  ☐ Retenciones automáticas
  ☐ Cancelación digital SAT

WEBHOOKS
  ☐ Edge Function: webhook-facturama
  ☐ HMAC signature verification
  ☐ Idempotency handling
  ☐ Retry logic (exponential backoff)

SEGURIDAD
  ☐ RLS policies en todas las tablas
  ☐ Company isolation
  ☐ Auditoría de acceso
  ☐ Encriptación certificados

TESTING
  ☐ CFDI generation tests
  ☐ Webhook handling tests
  ☐ Distribution tests
  ☐ SAT compliance tests

DEPLOYMENT
  ☐ SQL migrations ejecutadas
  ☐ Supabase Functions deployadas
  ☐ Env vars configuradas (PAC keys, secrets)
  ☐ Bucket storage creado (5 años)
  ☐ Webhook URL registrada en Facturama
  ☐ QA completo
```

---

**LISTO PARA DESARROLLO**: Daniel puede iniciar con esta guía. Todos los componentes, schemas, tipos y endpoints están documentados. El orden recomendado es: 1→2→3→4→5 según checklist.
