# 🏦 BancoCheck — Integración Bancaria Automática (2026-07-04)

**Objetivo**: Sincronización automática estados de cuenta + reconciliación + control saldos  
**Estado**: Investigación en progreso  
**Owner**: Juan (arquitectura), Daniel (código)

---

## 🎯 VISIÓN: BANCOCHECK COMO HUB BANCARIO

```
┌──────────────────────────────────────────────────────────┐
│              BancoCheck (HUB Bancario)                   │
│                                                          │
│  Banco → Movimientos → Reconciliación → Reportes       │
└──────────────┬───────────────────────────────────────────┘
               │
      ┌────────┴────────┬──────────────┬──────────────┐
      │                 │              │              │
      ▼                 ▼              ▼              ▼
  ┌────────┐      ┌──────────┐  ┌──────────┐  ┌──────────────┐
  │Bancos  │      │GastoCheck│  │CobraCheck│  │Contabilidad  │
  │API/SFTP│      │(Match)   │  │(Depósitos)  │(Pólizas)     │
  │        │      │          │  │          │  │              │
  │ Auto ↓ │      │ Auto ↓   │  │ Auto ↓   │  │ Auto ↓       │
  └────────┘      └──────────┘  └──────────┘  └──────────────┘
```

---

## 📊 MÉTODOS DE ENTREGA DE ESTADOS DE CUENTA

### OPCIÓN 1: API REST (Ideal - Tiempo Real)

**Concepto**: Banco expone REST API → obtener movimientos programáticamente

**Ventajas**:
✅ Tiempo real (no diario)  
✅ Automático (sin intervención usuario)  
✅ Moderno + seguro (OAuth)  
✅ Fácil de integrar  

**Bancos que podrían tener**:
- ❓ BBVA México (developers.bbva.com?)
- ❓ Santander (API Connect?)
- ❓ Scotiabank
- ❓ Banorte

**Endpoint esperado**:
```
GET /api/v1/accounts/:accountId/movements
GET /api/v1/accounts/:accountId/balance
GET /api/v1/accounts (listar cuentas del usuario)

Response:
{
  "movements": [
    {
      "date": "2026-07-04",
      "description": "PAGO CON TARJETA",
      "amount": -500.00,
      "balance": 5000.00,
      "reference": "REF123456"
    }
  ]
}
```

---

### OPCIÓN 2: SFTP + File Transfer (Diario)

**Concepto**: Banco carga archivo (OFX, MT940, CSV) → FacturaCheck descarga vía SFTP

**Ventajas**:
✅ Legacy pero confiable  
✅ Batch diario (no real-time)  
✅ Automático con scheduled jobs  

**Desventajas**:
❌ Diario, no tiempo real  
❌ Requiere SFTP credentials  
❌ Parsing de archivos complejo  

**Flujo**:
```
1. Banco prepara archivo: estado_cuenta_20260704.ofx
2. Carga a SFTP: sftp.banco.com/user/archivos/
3. FacturaCheck job (daily 6am):
   - Conecta SFTP
   - Descarga archivo
   - Parse OFX/MT940
   - Inserta movimientos
   - Reconcilia
```

---

### OPCIÓN 3: OFX (Open Financial Exchange) - Formato

**Concepto**: Estándar de intercambio de datos financieros

**Estructura OFX**:
```
<OFX>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <STMTRS>
        <BANKMULTISTMTRS>
          <STMTS>
            <STMTRS>
              <CURDEF>MXN</CURDEF>
              <BANKACCTFROM>
                <BANKID>002110</BANKID>
                <ACCTID>123456789</ACCTID>
                <ACCTTYPE>CHECKING</ACCTTYPE>
              </BANKACCTFROM>
              <BANKTRANLIST>
                <DTSTART>20260701</DTSTART>
                <DTEND>20260704</DTEND>
                <STMTTRN>
                  <TRNTYPE>DEBIT</TRNTYPE>
                  <DTPOSTED>20260704</DTPOSTED>
                  <TRNAMT>-500.00</TRNAMT>
                  <FITID>REF123456</FITID>
                  <NAME>PAGO CON TARJETA</NAME>
                </STMTTRN>
              </BANKTRANLIST>
              <LEDGERBAL>
                <BALAMT>5000.00</BALAMT>
                <DTASOF>20260704</DTASOF>
              </LEDGERBAL>
            </STMTRS>
          </STMTS>
        </BANKACCTFROM>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>
```

**Parsing OFX en Node.js**:
```typescript
import ofxjs from 'ofx.js'

const ofxData = fs.readFileSync('estado_cuenta.ofx', 'utf-8')
const parsed = ofxjs.parse(ofxData)

const movements = parsed.BANKACCTFROM.stmts[0].STMTTRN.map(txn => ({
  date: parseOfxDate(txn.DTPOSTED),
  description: txn.NAME,
  amount: parseFloat(txn.TRNAMT),
  reference: txn.FITID,
  type: txn.TRNTYPE // DEBIT, CREDIT
}))
```

---

### OPCIÓN 4: MT940 (ISO 20022) - Estándar SWIFT

**Concepto**: Formato usado por bancos europeos + algunos en México

**Estructura MT940** (simplificada):
```
:20:STARTUMX
:25:MX002110123456789
:28C:00000/001
:60F:C260701MXN5500.00
:61:2607040704DR500.00NMSCPAGO CON TARJETA//REF123456
:86:PAGO CON TARJETA - COMPRA ONLINE
:61:2607040704CR2000.00NMSDEPÓSITO//DEP789012
:86:TRANSFERENCIA DE TERCERO
:62F:C260704MXN7000.00
-
```

**Parsing MT940 en Node.js**:
```typescript
import Parser from 'mt940-js'

const mt940Data = fs.readFileSync('estado_cuenta.mt940', 'utf-8')
const parser = new Parser()
const result = parser.parse(mt940Data)

const movements = result.messages[0].lines
  .filter(l => l.tag === '61') // Transaction line
  .map(line => ({
    date: line.date,
    amount: line.amount,
    description: line.details,
    type: line.isDebit ? 'DEBIT' : 'CREDIT'
  }))
```

---

### OPCIÓN 5: CSV + Excel (Manual, no ideal)

**Concepto**: Usuario descarga CSV de banco → carga a BancoCheck

**Ventajas**:
✅ 100% compatible (todos los bancos exportan)  

**Desventajas**:
❌ Manual (requiere usuario)  
❌ Propenso a errores  
❌ No automático  

**Flujo**:
```
Usuario descarga estado_cuenta.csv de banco
  ↓
Carga archivo a BancoCheck
  ↓
Parser de CSV (con validación de columnas)
  ↓
Inserta movimientos
```

---

### OPCIÓN 6: AGREGADORES (Belvo, Plaid, etc.)

**Concepto**: Plataforma tercera conecta múltiples bancos → API REST única

**BELVO** (Latinoamérica):
- ✅ Conecta BBVA, Santander, Scotiabank, Banorte, etc.
- ✅ API REST moderno
- ✅ OAuth flow
- ✅ Movimientos + saldos en tiempo real
- ❌ Requiere pagar comisión
- API: `https://api.belvo.com/api/`

**PLAID** (USA/LAM - verificar México):
- ✅ Cobertura Latinoamérica?
- ✅ API REST
- ❓ Bancos mexicanos incluidos?

**Ventajas de agregadores**:
✅ Una integración = múltiples bancos  
✅ Mantenimiento centralizado  
✅ Seguridad profesional  
✅ Soporte + SLA  

**Desventajas**:
❌ Costo mensual por usuario  
❌ Dependencia de tercero  
❌ Latencia (si usan scraping interno)  

---

## 🏗️ ARQUITECTURA RECOMENDADA

### OPCIÓN A: API Directa (Si banco tiene)

```typescript
// services/bank/providers/types.ts
export interface BankProvider {
  name: 'bbva' | 'santander' | 'scotiabank' | 'banorte' | 'belvo'
  authenticate(credentials: BankCredentials): Promise<AuthToken>
  listAccounts(): Promise<Account[]>
  getMovements(accountId: string, from: Date, to: Date): Promise<Movement[]>
  getBalance(accountId: string): Promise<Balance>
}

// services/bank/providers/bbva.ts
export class BBVAProvider implements BankProvider {
  private apiUrl = 'https://api.bbva.mx/v1'
  
  async authenticate(creds: BankCredentials) {
    // OAuth flow
  }
  
  async listAccounts() {
    const res = await fetch(`${this.apiUrl}/accounts`, {
      headers: { Authorization: `Bearer ${this.token}` }
    })
    return res.json()
  }
  
  async getMovements(accountId: string, from: Date, to: Date) {
    const res = await fetch(
      `${this.apiUrl}/accounts/${accountId}/movements?from=${from}&to=${to}`,
      { headers: { Authorization: `Bearer ${this.token}` } }
    )
    const data = await res.json()
    
    // Map banco format → BancoCheck format
    return data.movements.map(m => ({
      date: new Date(m.date),
      description: m.description,
      amount: m.amount,
      balance: m.balance,
      reference: m.reference_id
    }))
  }
}

// services/bank/factory.ts
export class BankFactory {
  static getProvider(name: string): BankProvider {
    switch(name) {
      case 'bbva': return new BBVAProvider()
      case 'belvo': return new BelvoProvider()
      // ...
    }
  }
}
```

### OPCIÓN B: Agregador (Belvo)

```typescript
// services/bank/providers/belvo.ts
import Belvo from 'belvo'

export class BelvoProvider implements BankProvider {
  private belvo: Belvo
  
  constructor(apiKey: string, apiSecret: string) {
    this.belvo = new Belvo({
      clientId: apiKey,
      clientSecret: apiSecret,
      environment: 'production'
    })
  }
  
  async authenticate(creds: BankCredentials) {
    // Belvo OAuth: redirect user to connect.belvo.com
    // User authorizes → grant access tokens
  }
  
  async getMovements(accountId: string, from: Date, to: Date) {
    const transactions = await this.belvo.transactions.list({
      account: accountId,
      date_from: from,
      date_to: to
    })
    
    return transactions.map(t => ({
      date: new Date(t.booked_at),
      description: t.description,
      amount: t.amount,
      balance: t.balance,
      reference: t.internal_id
    }))
  }
}
```

### OPCIÓN C: SFTP + OFX Parser

```typescript
// services/bank/sftp-sync.ts
import Client from 'ssh2-sftp-client'
import OFXParser from 'ofx-js'

export async function syncBankStatementBySFTP(
  bankId: string,
  accountId: string
) {
  const sftp = new Client()
  
  // Conectar SFTP
  await sftp.connect({
    host: `sftp.${bankId}.com`,
    username: process.env[`BANK_${bankId}_USER`],
    password: decryptPassword(process.env[`BANK_${bankId}_PASS`])
  })
  
  // Descargar archivo
  const remoteFile = `/statements/estado_${accountId}_${today()}.ofx`
  const buffer = await sftp.get(remoteFile)
  await sftp.end()
  
  // Parse OFX
  const parser = new OFXParser()
  const ofxData = buffer.toString('utf-8')
  const parsed = parser.parse(ofxData)
  
  // Extraer movimientos
  const movements = parsed.accounts[0].transactions.map(t => ({
    date: parseOfxDate(t.date),
    description: t.memo,
    amount: t.amount,
    balance: t.balance,
    reference: t.id
  }))
  
  // Guardar en BD
  await saveMovementsToDatabase(accountId, movements)
}
```

---

## 📋 TABLA: MÉTODOS POR BANCO

| Banco | API Rest | OAuth | SFTP | OFX | MT940 | Belvo | Recomendación |
|-------|----------|-------|------|-----|-------|-------|---------------|
| **BBVA** | ❓ | ❓ | ❓ | ✓? | ✓? | ✓ | Belvo + API nativa |
| **Santander** | ❓ | ❓ | ✓? | ✓ | ✓ | ✓ | Belvo o SFTP |
| **Scotiabank** | ❓ | ❓ | ❓ | ✓? | ✓? | ✓ | Belvo |
| **Banorte** | ❓ | ❓ | ✓? | ✓ | ✓ | ✓ | Belvo o SFTP |
| **Banamex** | ❓ | ❓ | ❓ | ✓? | ✓? | ✓ | Belvo |
| **Inbursa** | ❓ | ❓ | ❓ | ✓? | ✓? | ? | SFTP o manual |

**❓** = Investigando  
**✓** = Confirmado  

---

## 🔄 FLUJO DE SINCRONIZACIÓN AUTOMÁTICA

```
┌─────────────────────────────────────────────────────────┐
│ BancoCheck Sync Engine (Daily 6am)                      │
└─────────────────────────────────────────────────────────┘
                        │
         ┌──────────────┼──────────────┐
         │              │              │
         ▼              ▼              ▼
    ┌────────┐    ┌──────────┐  ┌──────────┐
    │ API    │    │SFTP      │  │Belvo     │
    │Directo │    │+ OFX     │  │Agregador │
    │        │    │Parser    │  │          │
    │ Fetch  │    │Descarga  │  │ OAuth    │
    │ Real   │    │ Diaria   │  │ Real     │
    └────────┘    └──────────┘  └──────────┘
         │              │              │
         └──────────────┼──────────────┘
                        │
                        ▼
         ┌──────────────────────────┐
         │ Normalize Movements      │
         │ (formato estándar)       │
         └──────────────┬───────────┘
                        │
                        ▼
         ┌──────────────────────────┐
         │ Check Duplicates         │
         │ (reference_id unique)    │
         └──────────────┬───────────┘
                        │
                        ▼
         ┌──────────────────────────┐
         │ Save to bank_movements   │
         │ Table                    │
         └──────────────┬───────────┘
                        │
                        ▼
         ┌──────────────────────────┐
         │ Auto-Reconcile           │
         │ Match GastoCheck/Cobra   │
         └──────────────┬───────────┘
                        │
                        ▼
         ┌──────────────────────────┐
         │ Update Balance + Saldos  │
         │ KPI Cards               │
         └──────────────────────────┘
```

---

## 🎯 ROADMAP BANCOCHECK

### FASE 1: MVP (Semana 4-5)
- ✅ SFTP + OFX parser (fallback confiable)
- ✅ Sincronización diaria manual
- ✅ UI: conectar banco (SFTP creds)
- ✅ Parser movimientos OFX
- ✅ Tabla bank_movements

### FASE 2: AUTOMÁTICO (Semana 5-6)
- ✅ Job scheduler (daily 6am)
- ✅ Reconciliación automática
- ✅ Notificación diferencias

### FASE 3: APIs DIRECTAS (Post-MVP)
- ✅ Belvo integration (múltiples bancos)
- ✅ BBVA API (si disponible)
- ✅ OAuth flows

### FASE 4: REAL-TIME (Futuro)
- ✅ Webhooks bancos
- ✅ Movimientos <1min latencia
- ✅ Alertas instantáneas

---

## 🔐 SEGURIDAD

**Credenciales Bancarias**:
- ✅ Encrypted at rest (AES-256)
- ✅ Never logged
- ✅ HTTPS only
- ✅ Separate vault (no BD principal)

**OAuth (Belvo/APIs)**:
- ✅ State parameter (CSRF)
- ✅ Scope limiting (read:accounts, read:transactions)
- ✅ Token rotation
- ✅ Audit logging

**Datos de Movimientos**:
- ✅ PII handling (no logs de montos)
- ✅ Compliance CNBV
- ✅ Encryption de referencia ID

---

## 📊 PENDING: Resultados investigación

⏳ **Esperando datos**:
- APIs disponibles por banco mexicano
- Soporte OFX/MT940 en México
- Pricing Belvo
- SFTP endpoints confirmados
- Normativas CNBV para acceso datos

**ETA**: 30-40 min (investigación agent)

---

**Documento**: 2026-07-04  
**Estado**: TEMPLATE (esperando agent)  
**Owner**: Juan (decisión), Daniel (código)

