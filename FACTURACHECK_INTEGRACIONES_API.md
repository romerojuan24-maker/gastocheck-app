# 🔗 FacturaCheck — Arquitectura de Integraciones API (2026-07-04)

**Objetivo**: FacturaCheck como HUB central: facturación ↔ cobranza ↔ contabilidad  
**Estado**: Investigación en progreso  
**Owner**: Juan (arquitectura), Daniel (implementación)

---

## 🎯 VISIÓN: INTEGRACIÓN BIDIRECCIONAL

```
┌──────────────────────────────────────────────────────────────┐
│                    FacturaCheck (HUB)                        │
│                                                              │
│   Emite CFDI → Cobranza → Contabilidad → Exporta Pólizas  │
└──────────────┬──────────────────────────────────────────────┘
               │
      ┌────────┴────────┬──────────────┬──────────────┐
      │                 │              │              │
      ▼                 ▼              ▼              ▼
  ┌────────┐      ┌──────────┐  ┌──────────┐  ┌──────────────┐
  │Factura-│      │Programa  │  │Facturador│  │CobraCheck    │
  │dores   │      │Contable  │  │Externo   │  │(Integrada)   │
  │Externos│      │(EXPORT)  │  │(IMPORT)  │  │              │
  │        │      │          │  │          │  │              │
  │ API ↓  │      │ API ↑    │  │ API ↓    │  │ Webhooks ↔   │
  └────────┘      └──────────┘  └──────────┘  └──────────────┘
     (A)             (B)           (C)             (D)
```

---

## 📊 ESCENARIOS DE INTEGRACIÓN

### ESCENARIO A: FACTURADORES EXTERNOS → FacturaCheck (IMPORT)

**Usuario**: "Ya uso Facturama/Facturapi, quiero cobranza integrada"

**Flujo**:
```
1. Usuario autoriza: "Conecta mi Facturama"
2. OAuth: Grant scope "read:invoices"
3. FacturaCheck → Facturama API: GET /invoices
4. Sincronizar facturas → cfdi_documents
5. Correlacionar con clientes CobraCheck
6. Crear movement automático cuando se reciba pago
```

**APIs Requeridas**:
- Facturama: GET /invoices, webhooks
- Facturapi: GET /invoices, webhooks
- SenHub: ? (investigar)
- FacturaPorTi: ? (investigar)

**Endpoint FacturaCheck**:
```
POST /api/v1/integrations/facturador/authorize
  → OAuth redirect a Facturama/Facturapi
  
POST /api/v1/integrations/facturador/sync
  → Importar facturas pendientes

Webhook: POST /webhooks/facturador/invoice-stamped
  → Recibir notificación de nueva factura
```

---

### ESCENARIO B: FacturaCheck → PROGRAMAS CONTABLES (EXPORT)

**Usuario**: "Usa CONTPAQi, quiero que pólizas se creen automáticas"

**Flujo**:
```
1. Usuario configura: "Mi contabilidad usa CONTPAQi"
2. Enter credentials: Usuario + Contraseña (o API key)
3. FacturaCheck → CONTPAQi API: POST /pólizas
   {
     "folio": "POL-2026-001",
     "fecha": "2026-07-04",
     "concepto": "Factura INV-001 de Cliente X",
     "movimientos": [
       { "cuenta": "1110", "debit": 1000, "concepto": "Venta" },
       { "cuenta": "2110", "credit": 1000, "concepto": "IVA Cobrado" }
     ]
   }
4. Respuesta: "Póliza creada OK"
5. Sync status: "exported_to_contapaqi: true"
```

**APIs Requeridas** (investigar):
- CONTPAQi: POST /pólizas, autenticación
- Aspel: ? (COI/SAE)
- Siigo: ?
- Alegra: ?

**Endpoint FacturaCheck**:
```
POST /api/v1/integrations/contable/config
  → Guardar credenciales (encrypted)

POST /api/v1/integrations/contable/export-voucher
  → Enviar póliza a contabilidad

GET /api/v1/integrations/contable/status
  → Ver estado sincronización
```

---

### ESCENARIO C: COBRACHECK ↔ FACTURACHECK (WEBHOOKS)

**Flujo** (ya diseñado en arquitectura):
```
CobraCheck Event: "Pago recibido" 
  → Webhook: POST /webhooks/cobracheck/payment-received
  → Datos: { payment_id, amount, client_id, factura_ids[] }
  → FacturaCheck: 
    - Crear entry pago en cfdi_distributions
    - Marcar facturas como "pagadas"
    - Contabilidad: Crear póliza de cobro
    - Email/SMS: Enviar confirmación al cliente
```

**Endpoint FacturaCheck**:
```
POST /webhooks/cobracheck/payment-received
  → Procesar pago CobraCheck
  
POST /webhooks/cobracheck/route-completed
  → Rutas completadas = facturas a verificar
```

---

## 🏗️ ARQUITECTURA PROPUESTA

### 1. ADAPTER PATTERN (Agnóstico del Facturador/Contable)

```typescript
// services/integrations/types.ts
export interface ExternalInvoiceProvider {
  name: 'facturama' | 'facturapi' | 'senhub' | 'facturaporti'
  authorize(code: string): Promise<{ token: string; expires_in: number }>
  refreshToken(refreshToken: string): Promise<string>
  listInvoices(limit: number): Promise<ExternalInvoice[]>
  getInvoice(id: string): Promise<ExternalInvoice>
  subscribeToWebhooks(): Promise<{ subscriptionId: string }>
}

export interface AccountingProvider {
  name: 'contpaqi' | 'aspel' | 'siigo' | 'alegra'
  authenticate(credentials: { user: string; password: string }): Promise<AuthToken>
  createVoucher(voucher: AccountingVoucher): Promise<{ voucherId: string }>
  getVoucherStatus(voucherId: string): Promise<VoucherStatus>
  listChartOfAccounts(): Promise<Account[]>
}

// services/integrations/factory.ts
export class IntegrationFactory {
  static getInvoiceProvider(name: string): ExternalInvoiceProvider {
    switch(name) {
      case 'facturama': return new FacturamaProvider()
      case 'facturapi': return new FacturapiProvider()
      // ...
    }
  }
  
  static getAccountingProvider(name: string): AccountingProvider {
    switch(name) {
      case 'contpaqi': return new ContpaQiProvider()
      case 'aspel': return new AspelProvider()
      // ...
    }
  }
}
```

### 2. OAUTH FLOW (Autorización Segura)

```
User: "Conecta mi Facturama"
  ↓
FacturaCheck: Redirect → https://facturama.com/oauth/authorize?
  client_id=...
  redirect_uri=https://facturacheck.com/callback/facturama
  scope=read:invoices,read:webhooks
  ↓
User: [Login en Facturama + Authorize]
  ↓
Facturama: Redirect → https://facturacheck.com/callback/facturama?code=AUTH_CODE
  ↓
FacturaCheck: Exchange code → GET /token
  {
    access_token: "...",
    refresh_token: "...",
    expires_in: 3600
  }
  ↓
Store encrypted en BD (company_id + provider_token)
```

### 3. WEBHOOK RECEIVER (Evento-Driven)

```typescript
// supabase/functions/webhooks/external-invoice-stamped/index.ts

export async function handleExternalInvoiceStamped(
  event: ExternalInvoiceEvent
) {
  // 1. Validar webhook signature
  if (!validateWebhookSignature(event.signature, event.body)) {
    return { status: 401, error: 'Invalid signature' }
  }

  // 2. Procesar factura
  const { cfdi_id, uuid, client_rfc, amount } = event.body
  
  // 3. Sincronizar a FacturaCheck
  const { error } = await supabase
    .from('cfdi_documents')
    .insert([{
      external_id: cfdi_id,
      external_provider: 'facturama',
      uuid: uuid,
      status: 'timbrado',
      // ... otros campos
    }])
  
  // 4. Crear póliza contable si aplica
  if (company.accounting_provider) {
    await createAccountingVoucher({
      type: 'income',
      amount: amount,
      invoice_id: cfdi_id
    })
  }
  
  // 5. Retornar OK
  return { status: 200 }
}
```

### 4. ENCRYPTION DE CREDENCIALES

```typescript
// services/encryption.ts
export async function storeProviderToken(
  companyId: string,
  provider: string,
  token: string,
  refreshToken?: string
) {
  const encrypted = await encryptAES256(token)
  
  const { error } = await supabase
    .from('provider_tokens')
    .insert([{
      company_id: companyId,
      provider: provider,
      access_token: encrypted,
      refresh_token: refreshToken ? encryptAES256(refreshToken) : null,
      expires_at: new Date(Date.now() + 3600 * 1000),
      created_at: new Date()
    }])
  
  if (error) throw error
}

export async function getProviderToken(
  companyId: string,
  provider: string
) {
  const { data, error } = await supabase
    .from('provider_tokens')
    .select('*')
    .eq('company_id', companyId)
    .eq('provider', provider)
    .single()
  
  if (!data) return null
  
  // Check expiration + refresh si necesario
  if (new Date() > data.expires_at) {
    // Refresh token silenciosamente
  }
  
  return decryptAES256(data.access_token)
}
```

---

## 📋 TABLA DE INTEGRACIONES: ESTADO ACTUAL

### FACTURADORES (IMPORT)

| Facturador | API REST | Webhooks | OAuth | Status |
|-----------|----------|----------|-------|--------|
| Facturama | ? | ? | ? | ⏳ Investigando |
| Facturapi | ? | ? | ? | ⏳ Investigando |
| SenHub | ? | ? | ? | ⏳ Investigando |
| FacturaPorTi | ? | ? | ? | ⏳ Investigando |

### PROGRAMAS CONTABLES (EXPORT)

| Contable | API | Auth | Pólizas | Status |
|----------|-----|------|---------|--------|
| CONTPAQi | ? | ? | ? | ⏳ Investigando |
| Aspel | ? | ? | ? | ⏳ Investigando |
| Siigo | ? | ? | ? | ⏳ Investigando |
| Alegra | ? | ? | ? | ⏳ Investigando |

---

## 🎯 ROADMAP INTEGRACIONES

### FASE 1: PROTOTIPO (Semana 3-4)
- ✅ Facturama API (lectura facturas)
- ✅ OAuth flow básico
- ✅ Webhook receiver de Facturama
- ✅ Sincronización facturas → cfdi_documents

### FASE 2: CONTABILIDAD (Semana 4-5)
- ✅ CONTPAQi API (crear pólizas)
- ✅ Autenticación credenciales
- ✅ Mapeo de cuentas contables
- ✅ Exportación automática pólizas

### FASE 3: MULTI-INTEGRACIONES (Semana 5-6)
- ✅ Facturapi support
- ✅ Aspel support
- ✅ SenHub support
- ✅ Failover strategy

### FASE 4: WEBHOOKS ROBUSTOS (Post-MVP)
- ✅ Retry logic + dead letter queues
- ✅ Webhook signature validation
- ✅ Rate limiting
- ✅ Logging exhaustivo

---

## 🔐 SEGURIDAD

### Credenciales
- ✅ Encrypted at rest (AES-256)
- ✅ Never logged o exposed
- ✅ Secure transmission (HTTPS only)
- ✅ Refresh tokens stored separately

### OAuth
- ✅ State parameter para CSRF
- ✅ Scope limiting (read:invoices, not write)
- ✅ Scope audit logging
- ✅ Disconnection flow (revoke tokens)

### Webhooks
- ✅ HMAC-SHA256 signature validation
- ✅ Webhook secret rotation
- ✅ Timestamp validation (prevent replay)
- ✅ Rate limiting per provider

---

## 📊 PENDING: Resultados investigación

⏳ **Esperando datos completos**:
- CONTPAQi API capabilities
- Facturama/Facturapi GET /invoices endpoints
- Aspel integration documentation
- Siigo México support
- OAuth providers vs API key auth
- Webhook event types per platform

**ETA**: 30-40 min (investigación agent)

---

**Documento**: 2026-07-04  
**Estado**: TEMPLATE (esperando agent)  
**Owner**: Juan (decisión), Daniel (código)

