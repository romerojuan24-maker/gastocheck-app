# 🚨 FEATURE — Sistema de Alertas: Bancos Nuevos Sin Integración

**Objetivo**: Detectar cuando cliente intenta conectar banco que NO TENEMOS integración → Alertar admin → Priorizar integración  
**Beneficio**: Data-driven infrastructure (clientes nos dicen qué integrar primero)  
**Owner**: Daniel (código), Yo (arquitectura)  
**Prioridad**: 🔴 CRÍTICA (diferenciador adopción)

---

## 🎯 PROBLEMA

```
SCENARIO 1 (Actual - MAL):
┌─ Cliente intenta conectar "Banco Azteca"
├─ Sistema: "No lo soportamos"
└─ Resultado: Cliente abandona o espera sin saber cuándo

SCENARIO 2 (Mejor - Con Feature):
┌─ Cliente intenta conectar "Banco Azteca"
├─ Sistema: "Aún no integrado, alertamos al admin"
├─ Admin Juan: Recibe notificación
├─ Juan: Decide priorizar Azteca (N clientes lo piden)
├─ Resultado: Integración rápida, cliente retorna
└─ Cliente: Ve sincronización Azteca listo en 1-2 días
```

**VALOR**:
- Transformar "No tenemos" → "Estamos en ello"
- Clientes ven demanda real
- Priorización data-driven
- Infraestructura crece conforme clientes necesitan

---

## 🏗️ ARQUITECTURA

### 1. TABLA: `bank_unsupported_requests`

```sql
CREATE TABLE bank_unsupported_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  
  -- Banco intentado conectar
  bank_name TEXT NOT NULL,           -- "Banco Azteca", "Inbursa", etc.
  bank_code TEXT,                     -- "AZCMXMM", "INBUMX", etc.
  
  -- Contexto del intento
  attempted_at TIMESTAMP DEFAULT now(),
  user_email TEXT,                    -- Email usuario
  company_name TEXT,                  -- Nombre empresa
  
  -- Status
  status TEXT DEFAULT 'pending',      -- pending, acknowledged, in_progress, integrated, rejected
  
  -- Admin action
  admin_notes TEXT,                   -- "Contactando Azteca API", "Prioridad media"
  assigned_to_admin UUID,             -- Admin que lo toma
  
  -- Tracking
  request_count INT DEFAULT 1,        -- Cuántos clientes piden esto
  last_request_at TIMESTAMP,
  integrated_at TIMESTAMP,            -- Cuándo se integró (si aplica)
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Index por banco + status (admin queries)
CREATE INDEX idx_bank_status ON bank_unsupported_requests(bank_name, status);
CREATE INDEX idx_company_status ON bank_unsupported_requests(company_id, status);
CREATE INDEX idx_request_count ON bank_unsupported_requests(request_count DESC);
```

### 2. TABLA: `bank_integration_tracker`

```sql
CREATE TABLE bank_integration_tracker (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Banco
  bank_name TEXT UNIQUE NOT NULL,     -- "BBVA", "Santander", "Azteca"
  bank_code TEXT UNIQUE,
  
  -- Status integración
  integration_status TEXT DEFAULT 'not_started',
  -- Values: not_started, api_research, api_contract_pending, 
  --         in_development, testing, production_ready, live
  
  -- Detalles
  requested_by_clients INT DEFAULT 0, -- Cuántos clientes lo piden
  priority_score INT,                 -- 1-100 (auto-calculado)
  
  -- Progreso
  started_at TIMESTAMP,
  estimated_completion TIMESTAMP,
  completed_at TIMESTAMP,
  
  -- Contact info
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  
  -- Notas
  technical_notes TEXT,
  blockers TEXT,
  api_documentation_url TEXT,
  api_sandbox_url TEXT,
  
  -- Integration details
  supports_oauth BOOLEAN,
  supports_webhooks BOOLEAN,
  rate_limit_per_min INT,
  cost_model TEXT,                    -- "free", "pay_per_request", "subscription", etc.
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_status ON bank_integration_tracker(integration_status);
CREATE INDEX idx_priority ON bank_integration_tracker(priority_score DESC);
```

### 3. TABLA: `bank_integration_log`

```sql
-- Histórico de cambios de integración
CREATE TABLE bank_integration_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID REFERENCES bank_integration_tracker(id),
  
  action TEXT,  -- 'status_change', 'priority_updated', 'note_added', 'client_added'
  old_value TEXT,
  new_value TEXT,
  
  changed_by_admin UUID REFERENCES auth.users(id),
  changed_at TIMESTAMP DEFAULT now()
);
```

---

## 🔄 FLUJO: Cliente Intenta Conectar Banco

```
STEP 1: Usuario selecciona banco en UI
┌─ Pantalla: "Conectar Banco"
├─ Usuario: Busca "Azteca" en dropdown
├─ Sistema: Verifica si Azteca está en integrated_banks
└─ Decision point: ¿Soportamos Azteca?

STEP 2A: SÍ soportamos → OAuth flow normal
┌─ Redirigir a Azteca OAuth
├─ Usuario autentica
├─ Token guardado
└─ Transacciones sync

STEP 2B: NO soportamos → Feature alertas
┌─ Mostrar modal: "Banco aún no soportado"
├─ Botón: "Notificar cuando esté listo"
├─ Usuario email: romero.juan24@gmail.com
├─ Sistema:
│  ├─ INSERT bank_unsupported_requests
│  ├─ UPDATE bank_integration_tracker (request_count++)
│  ├─ Calcular priority_score
│  └─ SEND WEBHOOK (admin alert)
└─ Modal cierre: "Admin notificado, te avisamos en 1-2 días"

STEP 3: Admin recibe alerta
┌─ Email: "3 clientes piden Banco Azteca"
├─ Link a admin panel: /admin/unsupported-banks
├─ Admin ve:
│  ├─ Azteca (Priority: 85/100, 3 clientes)
│  ├─ Botones: [Integrating], [Contactar Azteca], [Postpone], [Reject]
│  └─ Timeline estimada integración
└─ Admin actualiza status → "in_development"

STEP 4: Admin inicia integración
┌─ Cambia status → "api_research" or "api_contract_pending"
├─ Actualiza timeline estimada
├─ Sistema: SEND EMAIL a clientes
│  ├─ "Banco Azteca en desarrollo"
│  ├─ "Completado en ~X días"
│  └─ "Te notificamos cuando esté"
└─ Log entry: quien, cuándo, qué cambió

STEP 5: Desarrollo integración (Daniel)
┌─ Daniel ve en panel: "Azteca priority 85"
├─ Crea PR con código Azteca
├─ Status → "testing"
├─ Sistema: Email a clientes "En testing"
├─ Status → "production_ready"
├─ Sistema: Email a clientes "Disponible mañana"
└─ Status → "live" + integrated_at timestamp

STEP 6: Cliente vuelve a intentar
┌─ Usuario abre BancoCheck
├─ Azteca ahora en dropdown ✅
├─ Click → OAuth Azteca
├─ Transacciones sync
└─ Happy customer 🎉
```

---

## 🎨 UI COMPONENTS

### Component 1: Modal "Banco No Soportado"

```
╔════════════════════════════════════════════════════════════╗
║  ⚠️  Banco Aún No Soportado                           [✕]  ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║  "Banco Azteca" aún no está integrado en BancoCheck.      ║
║                                                            ║
║  ¿Quieres que notifiquemos al equipo?                     ║
║  Te avisaremos tan pronto lo tengamos listo.              ║
║                                                            ║
║  Otros bancos disponibles:                                ║
║  ├─ BBVA                                                  ║
║  ├─ Santander                                             ║
║  ├─ Banamex                                               ║
║  └─ + 10 más                                              ║
║                                                            ║
║  ┌─────────────────────────────────────────────────────┐  ║
║  │ Tu Email: romero.juan24@gmail.com                  │  ║
║  └─────────────────────────────────────────────────────┘  ║
║                                                            ║
║  ┌──────────────────┐         ┌──────────────────────┐    ║
║  │ Notificar Admin  │         │ Usar Otro Banco      │    ║
║  └──────────────────┘         └──────────────────────┘    ║
║                                                            ║
║  ℹ️  Tiempo estimado: 1-3 días                             ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
```

### Component 2: Admin Dashboard (Unsupported Banks)

```
┌─────────────────────────────────────────────────────────────────┐
│ 🏦 Bancos Solicitados (No Integrados)                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─ BANCO AZTECA                      [Priority: 85/100] 🔴    │
│ │  • Clientes solicitando: 3                                   │
│ │  • Primer request: 2026-07-04                                │
│ │  • Status: pending                                           │
│ │  • Acciones: [Integrating] [Contact Bank] [Postpone] [Skip] │
│ │  • Admin notes: [edit textarea]                              │
│ │                                                              │
│ ├─ BANCO INBURSA                     [Priority: 42/100] 🟡    │
│ │  • Clientes solicitando: 1                                   │
│ │  • Primer request: 2026-07-02                                │
│ │  • Status: pending                                           │
│ │  • Acciones: [Integrating] [Contact Bank] [Postpone] [Skip] │
│ │                                                              │
│ ├─ MIFEL                             [Priority: 15/100] 🟢    │
│ │  • Clientes solicitando: 1                                   │
│ │  • Primer request: 2026-06-28                                │
│ │  • Status: rejected (low demand)                             │
│ │                                                              │
│ └─ [+2 more]                                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

ACTIONS CUANDO ADMIN CLICK [Integrating]:
┌─────────────────────────────────────────────────────────────────┐
│ ✏️  Actualizar Status Integración                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Status Actual: pending  →  [Dropdown]                          │
│   ├─ not_started                                               │
│   ├─ api_research                                              │
│   ├─ api_contract_pending                                      │
│   ├─ in_development       ← Seleccionar                        │
│   ├─ testing                                                   │
│   ├─ production_ready                                          │
│   └─ live                                                      │
│                                                                 │
│ Fecha Estimada Completación: [Date Picker]                    │
│                                                                 │
│ Notas Técnicas:                                                │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ Contactando Azteca API team, esperando respuesta.          │ │
│ │ OAuth disponible, webhooks NO.                             │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ [Enviar Notificación a Clientes] [Guardar] [Cancelar]         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Component 3: Admin: Tracking Board

```
┌─────────────────────────────────────────────────────────────────┐
│ 📊 Integration Tracking — BancoCheck                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ En Desarrollo (2)          | Testing (1)    | Completado (5)   │
│ ───────────────────────────┼────────────────┼──────────────────│
│ • Azteca (3 clientes)      │ • Inbursa      │ ✅ BBVA          │
│   Due: 2026-07-07          │   Due: 2026-07 │ ✅ Santander     │
│   Assigned: Juan           │   Assigned: Daniel                 │
│                            │                │ ✅ Banamex       │
│ • Mifel (1 cliente)        │                │ ✅ Scotiabank    │
│   Due: 2026-07-10          │                │ ✅ Banorte       │
│   Assigned: Daniel         │                │                  │
│                            │                │ ✅ Belvo (Meta)  │
│ Not Started (2)            │                │                  │
│ ───────────────────────────┤                │                  │
│ • [Bank X] (pending)       │                │                  │
│ • [Bank Y] (backlog)       │                │                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📧 EMAIL TEMPLATES

### Email 1: Admin Alert — "Nuevo Banco Solicitado"

```
TO: romero.juan24@gmail.com
SUBJECT: 🚨 Banco Solicitado: Azteca (3 clientes)
PRIORITY: High

Hola Juan,

3 clientes han solicitado integración con "Banco Azteca".

DETALLES:
├─ Banco: Azteca
├─ Clientes pidiendo: 3
│  ├─ Empresa 1 (2026-07-04)
│  ├─ Empresa 2 (2026-07-03)
│  └─ Empresa 3 (2026-07-02)
├─ Priority Score: 85/100
└─ Primer request hace: 2 días

ACCIONES RECOMENDADAS:
1. Revisar API Azteca: https://developer.azteca.com.mx
2. Evaluar effort: OAuth? Webhooks? Rate limits?
3. Decidir: Integrar primero Azteca o postergar?
4. Notificar clientes: "En desarrollo" o "Postergar"

LINK AL ADMIN PANEL:
https://app.gastocheck.com/admin/unsupported-banks?bank=Azteca

---
[Admin Dashboard] [Mark as Resolved] [Snooze 7 days]
```

### Email 2: Cliente — "Banco en Desarrollo"

```
TO: cliente@empresa.com
CC: romero.juan24@gmail.com
SUBJECT: ✅ Banco Azteca en Desarrollo (Notificaste hace 2 días)

Hola [ClientName],

¡Excelente noticia! Tu solicitud de Banco Azteca ha sido prioritizada.

ESTADO:
├─ Status: Iniciando Desarrollo
├─ Otros clientes pidiendo: 2
├─ Fecha estimada completación: 2026-07-07
├─ Te avisaremos: Tan pronto esté listo
└─ Tiempo estimado: 2-3 días

¿QUÉ SIGNIFICA?
• Nuestro equipo técnico está integrando Azteca
• Realizaremos testing con datos reales
• Notificación cuando esté 100% listo
• Podrás conectar tu cuenta Azteca automáticamente

MIENTRAS TANTO:
Puedes usar otros bancos ya soportados:
├─ BBVA ✅
├─ Santander ✅
├─ Banamex ✅
└─ +7 más

¿Preguntas?
Contáctanos: support@gastocheck.com | +52 55 1234 5678

---
[Ver Estado en Tiempo Real] [Agregar Otro Banco]
```

### Email 3: Cliente — "Banco Listo! 🎉"

```
TO: cliente@empresa.com
SUBJECT: 🎉 Banco Azteca Ahora Disponible en BancoCheck!

Hola [ClientName],

¡Tu solicitud de hace 3 días ha sido completada! 🚀

BANCO AZTECA: ✅ LISTO

Ahora puedes:
1. Ir a BancoCheck → "Conectar Banco"
2. Seleccionar "Banco Azteca" en el dropdown
3. Autorizar con OAuth
4. Listas tus transacciones sincronizadas automáticamente

BENEFICIOS:
✅ Sincronización automática de transacciones
✅ Matching automático con gastos
✅ Reconciliación end-of-day
✅ Reportes de cash flow
✅ Integración con GastoCheck completa

¿CÓMO EMPEZAR?
1. Click: https://app.gastocheck.com/bancocheck/connect
2. Selecciona Azteca
3. Autoriza (2 min)
4. ¡Listo! Datos sincronizados

¿Problemas? support@gastocheck.com

---
[Conectar Ahora] [Ver Tutorial Video]
```

---

## 🤖 WEBHOOK: Admin Alert

```typescript
// services/webhooks/admin-alerts.ts

export async function notifyBankRequestAlert(
  bankName: string,
  requestCount: number,
  priorityScore: number
) {
  const adminEmail = process.env.ADMIN_EMAIL // romero.juan24@gmail.com
  
  // 1. Send email
  await sendEmail({
    to: adminEmail,
    subject: `🚨 Banco ${bankName} Solicitado (${requestCount} clientes)`,
    template: 'bank_alert_admin',
    data: { bankName, requestCount, priorityScore }
  })

  // 2. Send Slack notification (si Juan lo prefiere)
  await notifySlack({
    channel: '#checklist-alerts',
    text: `🚨 *Banco sin Integración*\n${bankName} solicitado por ${requestCount} clientes (Priority: ${priorityScore}/100)`,
    buttons: [
      { text: 'Ver en Admin Panel', url: `https://app.com/admin/unsupported-banks?bank=${bankName}` }
    ]
  })

  // 3. Log en DB
  await db.insert('bank_unsupported_requests').values({
    bank_name: bankName,
    request_count: requestCount,
    status: 'pending',
    alerted_at: new Date()
  })
}
```

---

## 📊 PRIORITY SCORE ALGORITHM

```typescript
// Calcular automáticamente qué bancos priorizar

function calculatePriorityScore(
  requestCount: number,
  daysSinceFirstRequest: number,
  marketShare: number,  // % mercado (0-100)
  alreadyIntegrated: boolean
): number {
  if (alreadyIntegrated) return 0
  
  const recencyScore = Math.max(0, 100 - (daysSinceFirstRequest * 2)) // Decay si viejo
  const demandScore = Math.min(100, requestCount * 20)              // 5+ clientes = 100
  const marketScore = marketShare * 0.5                             // 50% weight
  
  const total = (recencyScore * 0.3) + (demandScore * 0.4) + (marketScore * 0.3)
  return Math.round(total)
}

// EJEMPLOS:
- Azteca: 3 clientes, 2 días, 8% mercado → Priority: 85
- Inbursa: 1 cliente, 5 días, 3% mercado → Priority: 42
- MIFEL: 1 cliente, 10 días, 1% mercado → Priority: 15
```

---

## 🔔 NOTIFICACIÓN CLIENTES: Cambios Status

```typescript
// Cuando admin cambia status integración → Notificar clientes

async function notifyClientsStatusChange(
  bankName: string,
  oldStatus: string,
  newStatus: string
) {
  // 1. Buscar todos los que pidieron este banco
  const requests = await db
    .from('bank_unsupported_requests')
    .select('*')
    .eq('bank_name', bankName)
    .eq('status', 'pending')
  
  // 2. Para cada uno → enviar email personalizado
  for (const req of requests) {
    const emailTemplate = getEmailTemplate(newStatus) // template por status
    
    await sendEmail({
      to: req.user_email,
      subject: getEmailSubject(bankName, newStatus),
      template: emailTemplate,
      data: {
        bankName,
        clientName: req.company_name,
        estimatedCompletion: req.integration?.estimated_completion,
        trackingLink: `https://app.com/bancocheck/status/${bankName}`
      }
    })
  }
}
```

---

## 📋 ADMIN DASHBOARD FEATURES

```
1. UNSUPPORTED BANKS VIEW
   ├─ Tabla con todos bancos solicitados
   ├─ Sorteable: Priority, Clientes, Fecha
   ├─ Filtrable: Status, Market Share
   ├─ Action buttons: Status change, Contact, Notes
   └─ Bulk actions: "Mark as in_development (all)"

2. INTEGRATION TRACKER
   ├─ Kanban board: Not Started → Development → Testing → Live
   ├─ Timeline Gantt (cuándo se complete cada uno)
   ├─ Histórico changelog (quién cambió qué cuándo)
   └─ Contact info + API docs por banco

3. ANALYTICS
   ├─ "Bancos más solicitados" (pie chart)
   ├─ "Tiempo promedio integración" (bar chart)
   ├─ "Clientes esperando por banco" (table)
   └─ "Satisfaction score" (post-integration survey)

4. NOTIFICATIONS
   ├─ Email nuevos bancos solicitados
   ├─ Slack alerts high priority
   ├─ In-app notifications status changes
   └─ Webhook para integraciones externas
```

---

## 🎯 DECISIONES (JUAN)

```
1. ¿COMUNICACIÓN CLIENTES?
   ├─ Opción A: Email auto cuando status cambia
   ├─ Opción B: Manual (Juan revisa primero)
   └─ RECOMENDACIÓN: A (faster, better UX)

2. ¿NOTIFICACIÓN ADMIN?
   ├─ Opción A: Email cada solicitud nueva
   ├─ Opción B: Digest diario (resumen)
   ├─ Opción C: Solo high-priority (Priority > 70)
   └─ RECOMENDACIÓN: C (evitar spam)

3. ¿TIMELINE ESTIMADA?
   ├─ Opción A: Admin ingresa manualmente
   ├─ Opción B: Auto-default (2-3 días)
   ├─ Opción C: Histórico promedio
   └─ RECOMENDACIÓN: A (flexible)

4. ¿DESAPPROBAR BANCOS?
   ├─ Opción A: Admin puede marcar "rejected"
   ├─ Opción B: Todos eventuales (nada rechazado)
   └─ RECOMENDACIÓN: A (backlog control)

5. ¿CUANDO LANZAR?
   ├─ Con BancoCheck MVP (junto BBVA + Santander)
   ├─ Fase 2 (después GastoCheck OTA 132 estable)
   ├─ Fase 3 (cuando Daniel codifique BancoCheck)
   └─ RECOMENDACIÓN: Con BancoCheck MVP (es core)
```

---

## 📝 DOCUMENTACIÓN PARA DANIEL

**Archivo**: `BANCOCHECK_ADMIN_ALERTS_IMPLEMENTATION.md`

```
Checklist Daniel:

□ Crear tablas (migration SQL)
  ├─ bank_unsupported_requests
  ├─ bank_integration_tracker
  └─ bank_integration_log

□ API endpoints
  ├─ POST /api/bancocheck/request-bank (cliente pide banco nuevo)
  ├─ GET /api/admin/unsupported-banks (admin panel)
  ├─ PATCH /api/admin/banks/{bankId}/status (admin actualiza)
  └─ GET /api/admin/analytics/banks (stats)

□ UI Components
  ├─ Modal "Banco No Soportado" (conexión flow)
  ├─ Admin Dashboard "Unsupported Banks"
  ├─ Tracking Board integración
  └─ Email templates (3 tipos)

□ Webhooks + Notifications
  ├─ Webhook admin alert
  ├─ Email notifications clientes
  ├─ Slack integration (optional)
  └─ In-app notifications

□ Business Logic
  ├─ Priority score calculation
  ├─ Auto-increment request_count
  ├─ Status transitions validation
  └─ Timeline tracking

□ Testing
  ├─ Unit tests: priority score
  ├─ Integration tests: email flow
  ├─ E2E: Cliente solicita → Admin ve → Cliente notificado
  └─ Security: RLS policies

□ Deployment
  ├─ Migration script
  ├─ Email provider config
  ├─ Slack webhook config (optional)
  └─ Monitoring + alerting
```

---

## 🚀 ROADMAP

```
WEEK 1: Core Feature
├─ Tables schema
├─ Request flow (cliente solicita)
├─ Admin dashboard basic
└─ Email notifications (basic)

WEEK 2: Enhancements
├─ Priority score algorithm
├─ Status tracking + transitions
├─ Analytics dashboard
└─ Slack integration

WEEK 3: Integration
├─ Testing múltiples bancos
├─ Performance optimization
├─ Security audit
└─ Go live

TIMELINE: 3 semanas (paralelo con BancoCheck código)
```

---

## 📊 BENEFICIOS (Por qué esto importa)

```
PARA JUAN (Product):
✅ Data-driven priorities (qué integrar primero?)
✅ Visibility de demanda real (cuántos clientes piden qué)
✅ Rápida respuesta clientes ("estamos en ello")
✅ Competitive advantage (clientes ven infraestructura crece)

PARA DANIEL (Engineering):
✅ Clear priorities (next banco que integrar)
✅ Metrics de impacto (cuántos clientes esperan)
✅ Automated notifications (no olvidar actualizar)
✅ Audit trail (tracking cambios)

PARA CLIENTES:
✅ Transparencia (cuando estará listo?)
✅ Voz escuchada (demanda real importa)
✅ Notificación automática (cuando disponible)
✅ Mejor UX (modal informativo, no error)

PARA PRODUCTO:
✅ Feature diferenciador (otros no lo hacen)
✅ Crece infraestructura automáticamente
✅ Reduce soporte (clientes saben qué esperar)
✅ Metricas de éxito claras
```

---

**DOCUMENTO LISTO**: Enviar a Daniel cuando listo codificar BancoCheck ✅

