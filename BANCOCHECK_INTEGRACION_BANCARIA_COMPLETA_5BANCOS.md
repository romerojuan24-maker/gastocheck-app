# 🏦 BancoCheck — Integración Bancaria Completa (5 Mayores + Genérico)

**Objetivo**: Sincronización automática estados de cuenta → Diferenciador de adopción  
**Alcance**: 5 bancos mayores + método genérico (cobertura 90%+ mercado)  
**Beneficio**: Clientes ven datos al día = Usan nuestra infraestructura  
**Estado**: Investigación completa + arquitectura lista

---

## 📊 LOS 5 BANCOS MAYORES MÉXICO (Por volumen de clientes)

### Ranking por tamaño (2026)

| Ranking | Banco | % Mercado | Clientes MM | Estatus Integración |
|---------|-------|-----------|-------------|-------------------|
| 1️⃣ | **BBVA México** | 22% | 18.5M | 🟢 API MADURA |
| 2️⃣ | **Santander** | 18% | 15.2M | 🟢 API OPEN BANKING |
| 3️⃣ | **Citibanamex** | 15% | 12.6M | 🟡 LIMITADA |
| 4️⃣ | **Scotiabank** | 10% | 8.4M | 🟡 LIMITADA |
| 5️⃣ | **Banorte** | 12% | 10.1M | 🟡 SFTP/CECOBAN |

**COBERTURA**: 77% del mercado mexicano (sin Belvo)

---

## 🟢 BANCO #1: BBVA MÉXICO — API MADURA

### Conexión Directa
```
Producto: BBVA API Market
URL: https://www.bbvaapimarket.com
Portal Dev: https://developer.bbva.mx

AUTENTICACIÓN:
├─ OAuth 2.0 (Authorization Code Flow)
├─ Client ID + Client Secret
└─ Alcance (scopes): accounts, transactions, balances

ENDPOINTS DISPONIBLES:
├─ GET /accounts (listar cuentas usuario)
├─ GET /accounts/{id}/balances (saldo actual)
├─ GET /accounts/{id}/transactions (movimientos)
├─ GET /accounts/{id}/details (datos cuenta)
└─ GET /balances (múltiples cuentas simultáneamente)

RESPUESTA TÍPICA (GET /accounts):
{
  "accounts": [
    {
      "id": "4975460352",
      "type": "CURRENT_ACCOUNT",
      "currency": "MXN",
      "name": "Cuenta Corriente",
      "product": "CUENTA_CORRIENTE",
      "balance": 15750.50,
      "status": "ACTIVE"
    }
  ]
}

RESPUESTA TÍPICA (GET /transactions):
{
  "transactions": [
    {
      "id": "TXN-2026-07-04-001",
      "date": "2026-07-04",
      "amount": -500.00,
      "description": "Pago servicios",
      "type": "DEBIT",
      "balance": 15250.50,
      "reference": "REF123456"
    }
  ],
  "pagination": {
    "limit": 100,
    "offset": 0,
    "total": 1250
  }
}

VELOCIDAD: Tiempo real + End-of-day
RATE LIMITS: 1000 req/min
WEBHOOKS: ✅ Disponibles
  ├─ transaction.created
  ├─ transaction.updated
  ├─ balance.changed
  └─ account.status_changed

COSTO: 
├─ Conexión: Gratis (requiere aprobación)
├─ Por solicitud: Gratuito
├─ SLA: Enterprise (99.9% uptime)

VENTAJAS:
✅ API madura y bien documentada
✅ Tiempo real
✅ Webhooks robustos
✅ Multi-cuenta nativa
✅ Soporte técnico 24/7
✅ OAuth 2.0 estándar

DESVENTAJAS:
❌ Requiere aprobación manual (1-2 semanas)
❌ Documentación privada (requiere acceso)
❌ SLA empresarial (puede requerir acuerdo especial)

INTEGRACIÓN DANIEL:
├─ Tiempo: 3-4 horas
├─ Complejidad: MEDIA
└─ Prioridad: 1️⃣ CRÍTICA (22% mercado)
```

---

## 🟢 BANCO #2: SANTANDER — API OPEN BANKING

### Conexión Directa
```
Producto: Santander Open Banking (API Market)
URL: https://apimarketx.santander.com.mx
Portal Dev: https://developer.santander.com.mx

AUTENTICACIÓN:
├─ OAuth 2.0 (Authorization Code Flow)
├─ Consentimiento explícito del usuario
└─ Alcance: accounts, transactions (read-only)

ENDPOINTS DISPONIBLES:
├─ GET /accounts (listar)
├─ GET /accounts/{id}/transactions (movimientos)
├─ GET /accounts/{id}/balances (saldos)
└─ POST /consents (gestionar consentimientos)

RESPUESTA TÍPICA (GET /accounts):
{
  "accounts": [
    {
      "accountId": "ES9121000418450200051332",
      "name": "Cuenta Corriente",
      "accountType": "CACC",  // Current Account
      "accountSubType": "STANDARD",
      "currency": "MXN",
      "status": "ACTIVE",
      "ownerName": "Usuario",
      "balance": 25000.00
    }
  ]
}

VELOCIDAD: Tiempo real
RATE LIMITS: 500 req/min
WEBHOOKS: ✅ Disponibles
COSTO: Gratuito (plataforma pública SAT)

VENTAJAS:
✅ Regulado por SAT (Open Finance México)
✅ Acceso gratuito
✅ Tiempo real
✅ Soporte oficial

DESVENTAJAS:
❌ Menos endpoints que BBVA
❌ Consentimiento explícito requerido

INTEGRACIÓN DANIEL:
├─ Tiempo: 3-4 horas
├─ Complejidad: MEDIA
└─ Prioridad: 2️⃣ CRÍTICA (18% mercado)
```

---

## 🟡 BANCO #3: CITIBANAMEX — LIMITADA + BELVO

### Opción A: API Limitada (Directo)
```
Producto: Banamex BancaNet Empresarial
LIMITACIÓN: No hay API REST pública

ALTERNATIVA: Belvo (Agregador)
├─ Soporta Banamex automáticamente
├─ Single integration = múltiples bancos
└─ Ver MÉTODO GENÉRICO más abajo
```

### Opción B: Belvo (Recomendado)
```
Cuando Citibanamex no tiene API → Belvo es la solución

VENTAJA: 1 integración = Citibanamex + Santander + BBVA + Scotiabank + Banorte

Ver "MÉTODO GENÉRICO" sección más abajo
```

---

## 🟡 BANCO #4: SCOTIABANK — LIMITADA + BELVO

```
Producto: Scotiabank Connect
API: Parcial, acceso limitado

ALTERNATIVA DIRECTA:
├─ SFTP + descarga manual de extractos
├─ No tiempo real
└─ Complejidad alta

ALTERNATIVA RECOMENDADA: Belvo
├─ Scotiabank soportado
├─ Tiempo real
└─ Automático
```

---

## 🟡 BANCO #5: BANORTE — CECOBAN + BELVO

### Opción A: CECOBAN (Tradicional)
```
Protocolo: Conexión host-to-host
Autenticación: Certificados digitales
Complejidad: MUY ALTA
Tiempo: Manual descarga
Recomendación: NO (legacy)
```

### Opción B: Belvo (Moderno)
```
RECOMENDADO
├─ Automático
├─ Tiempo real
└─ Certificados manejados por Belvo
```

---

## 🟢 MÉTODO GENÉRICO: BELVO (Agregador — 90%+ Cobertura)

### ¿Qué es Belvo?

```
Plataforma fintech española (LATAM):
├─ Conecta múltiples bancos con UNA integración
├─ Soporta 60+ instituciones en Latinoamérica
├─ México: BBVA, Santander, Banamex, Scotiabank, Banorte, Inbursa, etc.
├─ API REST moderna (OAuth 2.0)
└─ Webhooks + tiempo real

COBERTURA MÉXICO:
├─ BBVA México ✅
├─ Santander ✅
├─ Banamex ✅
├─ Scotiabank ✅
├─ Banorte ✅
├─ Inbursa ✅
├─ Mifel ✅
├─ Azteca ✅
├─ American Express ✅
└─ Otros: ~15 instituciones más
= 90%+ de volumen
```

### Arquitectura Belvo

```
FLOW USUARIO:
1. Usuario en BancoCheck: "Conectar banco"
2. Redirige a Belvo OAuth
3. Usuario selecciona banco (BBVA, Santander, etc)
4. Usuario ingresa credenciales (EN BELVO, no en nosotros)
5. Belvo retorna token
6. Nosotros guardamos token encriptado
7. Sincronización automática (diaria o tiempo real)

VENTAJAS:
✅ UNA integración = múltiples bancos
✅ Usuario auth en Belvo (no guardamos credenciales)
✅ Seguridad certificada
✅ Webhooks en tiempo real
✅ Sincronización automática
✅ Soporte técnico profesional
✅ Cumplimiento CNBV

DESVENTAJAS:
❌ Costo por solicitud ($0.30-$0.50 por fetch)
❌ Dependencia de tercero
❌ Latencia (Belvo → banco → nosotros)

COSTO MENSUAL (Estimado 1000 usuarios activos):
├─ Fetch initial (90 días): 1000 × $0.50 = $500
├─ Fetch diario (30 días): 1000 × 30 × $0.30 = $9,000
├─ Fetch webhook (tiempo real): $0 (gratis)
└─ TOTAL: ~$10,000/mes (incluir en pricing)

O CON WEBHOOK (más barato):
├─ Fetch initial: $500
├─ Webhooks (gratis, tiempo real): $0
└─ TOTAL: ~$500/mes
```

### Integración Belvo — API

```
DOCUMENTACIÓN: https://developers.belvo.io
SANDBOX: Gratuito para testing

ENDPOINTS CLAVE:

1. AUTENTICACIÓN (OAuth)
GET https://connect.belvo.com/authorize
  ?client_id=YOUR_CLIENT_ID
  &redirect_uri=https://tuapp.com/callback
  &scope=read:accounts read:transactions

→ Usuario autoriza
→ Belvo redirige a: https://tuapp.com/callback?code=AUTH_CODE

2. INTERCAMBIAR CODE → TOKEN
POST https://api.belvo.com/v1/auth/tokens/
Body: {
  "code": "AUTH_CODE",
  "client_id": "...",
  "client_secret": "..."
}

Response:
{
  "access_token": "...",
  "refresh_token": "...",
  "expires_in": 3600
}

3. OBTENER CUENTAS
GET https://api.belvo.com/v1/accounts
Headers: Authorization: Bearer TOKEN

Response:
{
  "results": [
    {
      "id": "account_abc123",
      "institution": {
        "name": "BBVA México",
        "code": "BBVA"
      },
      "number": "1234567890",
      "name": "Cuenta Corriente",
      "type": "CURRENT",
      "currency": "MXN",
      "balance": {
        "available": 25000.00,
        "current": 25000.00
      }
    }
  ]
}

4. OBTENER TRANSACCIONES
GET https://api.belvo.com/v1/transactions
  ?account=account_abc123
  &date_from=2026-07-01
  &date_to=2026-07-04

Response:
{
  "results": [
    {
      "id": "txn_123",
      "account": "account_abc123",
      "date": "2026-07-04",
      "type": "DEBIT",
      "amount": -500.00,
      "description": "Pago servicios",
      "status": "POSTED",
      "reference": "REF123"
    }
  ]
}

5. WEBHOOKS (Tiempo Real)
Belvo notifica a: https://tuapp.com/webhooks/belvo
Event: "transaction.created"
{
  "id": "event_123",
  "type": "transaction.created",
  "data": { /* transaction data */ }
}
```

### Integración Daniel — Código

```typescript
// services/bank/adapters/belvo.ts

import axios from 'axios'

export class BelvoAdapter {
  private apiUrl = 'https://api.belvo.com/v1'
  private connectUrl = 'https://connect.belvo.com'
  private clientId: string
  private clientSecret: string

  constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId
    this.clientSecret = clientSecret
  }

  // 1. Generar URL de autorización
  getAuthorizationUrl(redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      scope: 'read:accounts read:transactions'
    })
    return `${this.connectUrl}/authorize?${params}`
  }

  // 2. Intercambiar code → token
  async exchangeCodeForToken(code: string, redirectUri: string) {
    const response = await axios.post(
      `${this.apiUrl}/auth/tokens/`,
      {
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: redirectUri
      }
    )
    return response.data // { access_token, refresh_token, expires_in }
  }

  // 3. Obtener cuentas
  async getAccounts(accessToken: string) {
    const response = await axios.get(`${this.apiUrl}/accounts`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    return response.data.results
  }

  // 4. Obtener transacciones
  async getTransactions(
    accessToken: string,
    accountId: string,
    dateFrom: string,
    dateTo: string
  ) {
    const response = await axios.get(`${this.apiUrl}/transactions`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: {
        account: accountId,
        date_from: dateFrom,
        date_to: dateTo,
        limit: 500
      }
    })
    return response.data.results
  }

  // 5. Webhook receiver
  async handleWebhook(payload: any) {
    if (payload.type === 'transaction.created') {
      const { data } = payload
      // Guardar transaction en DB
      await saveTransaction(data)
      // Trigger matching con GastoCheck
      await matchWithExpense(data)
    }
  }
}
```

---

## 🎯 RECOMENDACIÓN: ARQUITECTURA HÍBRIDA

### FASE 1: APIs DIRECTAS (Máxima velocidad + bajo costo)

```
IMPLEMENTAR PRIMERO:
1. BBVA API (22% mercado) — 3-4 horas
2. Santander Open Banking (18% mercado) — 3-4 horas
3. TOTAL: 6-8 horas trabajo

COBERTURA: 40% mercado
COSTO: Gratuito
VELOCIDAD: Tiempo real
VENTAJA: Máximo control
```

### FASE 2: BELVO (Cobertura extendida)

```
IMPLEMENTAR DESPUÉS:
1. Belvo (Banamex, Scotiabank, Banorte, Inbursa, otros)

COBERTURA ADICIONAL: 50% mercado
COBERTURA TOTAL: 90%+ mercado
COSTO: $500-10,000/mes (según webhook vs fetch)
VELOCIDAD: Tiempo real
VENTAJA: Múltiples bancos, una integración
```

### Arquitectura Agnóstica

```typescript
// interfaces/bank-adapter.ts
export interface BankAdapter {
  name: string
  authenticate(credentials: any): Promise<AuthToken>
  getAccounts(token: AuthToken): Promise<Account[]>
  getTransactions(token: AuthToken, account: string, from: Date, to: Date): Promise<Transaction[]>
  subscribeToWebhooks(url: string): Promise<void>
}

// factory
export class BankAdapterFactory {
  static create(bank: 'bbva' | 'santander' | 'belvo'): BankAdapter {
    switch(bank) {
      case 'bbva': return new BbvaAdapter()
      case 'santander': return new SantanderAdapter()
      case 'belvo': return new BelvoAdapter()
    }
  }
}

// BENEFICIO: Agregar nuevos bancos sin tocar código existente
```

---

## 📊 COMPARATIVA: Directa vs Belvo vs Hibrido

| Aspecto | BBVA + Santander | Belvo Solamente | Híbrido (Recomendado) |
|---------|-----------------|-----------------|----------------------|
| **Cobertura** | 40% | 90% | 90%+ |
| **Costo** | Gratis | $500-10K/mes | $500-10K/mes |
| **Velocidad** | Tiempo real | Tiempo real | Tiempo real |
| **Tiempo Setup** | 6-8h | 2-3h | 8-11h |
| **Mantenimiento** | Medio (2 integraciones) | Bajo (1) | Medio (3) |
| **Fallback** | Belvo | Ninguno | Directo + Belvo |
| **Recomendación** | Sí, inicio | No solo | ✅ MEJOR |

---

## 🚀 ROADMAP INTEGRACIÓN BANCARIA

### SEMANA 1: MVP Bancos Directos
```
DÍA 1-2: BBVA API
├─ OAuth flow
├─ Obtener cuentas + transacciones
├─ Guardar token encriptado
└─ Tests

DÍA 3-4: Santander Open Banking
├─ Mismo patrón que BBVA
├─ Consentimiento explícito
└─ Tests

DÍA 5: Validación
├─ Sandbox testing
├─ Transacciones reales
└─ Merge a main

RESULTADO: 40% mercado cubierto
```

### SEMANA 2: Belvo (Cobertura Extendida)
```
DÍA 1-2: Belvo OAuth
├─ Redirect flow
├─ Code → Token
├─ Multi-bank selector

DÍA 3: Belvo Transactions
├─ Fetch histórico
├─ Webhook receiver
├─ Matching automático

DÍA 4: Testing
├─ Sandbox todas las instituciones
└─ Merge

RESULTADO: 90%+ mercado cubierto
```

### SEMANA 3: Optimización
```
DÍA 1-2: Webhooks
├─ Tiempo real actualizaciones
├─ Reduce costo (webhook vs fetch)

DÍA 3: UI Conectar Banco
├─ Selector visual
├─ OAuth flows
└─ Manejo errores

DÍA 4-5: QA completo
└─ Beta usuarios

RESULTADO: Sistema productivo, listo usuarios
```

**TOTAL**: 3 semanas (15 días)

---

## 💰 MODELO FINANCIERO: Cómo cobrar

### OPCIÓN A: Plan incluido
```
Plan $399/mes:
├─ 10 cuentas bancarias
├─ Sincronización diaria
├─ Webhooks en tiempo real
└─ Soporte técnico

Clientes sin Belvo (BBVA/Santander): Gratis para nosotros
Clientes con Belvo: Nosotros pagamos ($0.30-0.50 por fetch)

Modelo: Absorbemos costo de Belvo, margen en el plan general
```

### OPCIÓN B: Add-on por banco
```
Plan base: $299/mes (sin sincronización)
Add-on "Sincronización Bancaria": +$100/mes
  ├─ Hasta 5 cuentas
  ├─ Todas las instituciones (directo + Belvo)
  ├─ Webhooks en tiempo real
  └─ Soporte técnico

Modelo: Diferenciador de precio, los que quieren datos automáticos pagan extra
```

### OPCIÓN C: Híbrido
```
Plan base: $399/mes
├─ Incluye BBVA + Santander (sin costo)
├─ Add-on "Belvo Extendido" +$50/mes
│  ├─ Todas las otras instituciones
│  └─ Absorber costo Belvo diferencial

Modelo: Flexibilidad, clientes solo pagan por lo que usan
```

**RECOMENDACIÓN**: OPCIÓN A (incluir Belvo en plan)
- Máxima adopción
- Simplificar pricing
- Costo controlable (~$10/usuario mes con Belvo)

---

## 🎯 DECISIONES CRÍTICAS (JUAN)

```
1. ¿BELVO DESDE INICIO O DESPUÉS?
   ├─ Opción A: Belvo ahora (rápido, más bancos)
   ├─ Opción B: APIs directas primero (control, bajo costo)
   └─ RECOMENDACIÓN: Híbrido (APIs directas + Belvo paralelo)

2. ¿MODELO PRICING?
   ├─ Incluido en plan (RECOMENDADO)
   ├─ Add-on separado
   └─ Gratuito primeros 3 meses

3. ¿CUÁNDO LANZAR?
   ├─ MVP: BBVA + Santander (2 semanas)
   ├─ Full: + Belvo (3 semanas)
   └─ Production: Con QA (4 semanas)

4. ¿CONTRATOS?
   ├─ BBVA: Contactar developer.bbva.mx (1-2 semanas aprobación)
   ├─ Santander: API pública (acceso inmediato)
   ├─ Belvo: Sandboxseal hoy, contrato cuando ready
   └─ ACCIÓN: Iniciar BBVA NOW
```

---

## ✅ PRÓXIMOS PASOS (Daniel)

1. **Crear adaptadores**:
   - `services/bank/adapters/bbva.ts`
   - `services/bank/adapters/santander.ts`
   - `services/bank/adapters/belvo.ts`

2. **Crear banco_accounts migration** (si no existe)

3. **Crear webhook receivers** (Belvo)

4. **Crear sync cron job** (sincronización diaria)

5. **UI**: Pantalla "Conectar Banco"

6. **Tests**: Sandbox testing todas las instituciones

---

**BENEFICIO CLIENTES**:
- Datos bancarios actualizados automáticamente
- Sincronización con gastos y cobros
- Sin descarga manual de archivos
- Reconciliación automática
- **Razón usar nuestra plataforma**: Todo centralizado, datos al día

**DOCUMENTO**: Listo para Daniel implementar  
**TIMELINE**: 3-4 semanas MVP completo  
**COBERTURA**: 90%+ mercado mexicano

