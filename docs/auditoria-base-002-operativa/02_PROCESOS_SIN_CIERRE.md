# AUDITORÍA BASE 002 — PROCESOS SIN CIERRE DEFINIDO
**Análisis de flujos que permanecen abiertos indefinidamente sin punto final claro**

---

## HALLAZGOS CRÍTICOS

### 1. 🔴 CUENTAS POR PAGAR (Registrar CxP — CNT-008)
**Estado:** PARCIAL — Cierre incompleto / no verificable

**Flujo:**
- Contador registra CxP → `accounts_payable.status = 'pending'`
- Tesorería paga → ¿qué sucede después?
- ¿Cuándo se marca como `paid`? ¿Manual u automático?
- ¿Se cierra la política cuando CxP:0?

**Código evidencia:**
- Tabla: `supabase/migrations/20260624000001_accounts_payable.sql` (creación de tabla)
- Campos: `id, company_id, vendor_id, amount, due_date, status, paid_amount, paid_date`
- ❌ NO EXISTE Edge Function específica para "pagar CxP" ni "cerrar CxP"
- ❌ NO EXISTE trigger que marque `status:closed` cuando `paid_amount >= amount`

**Problema operativo:**
- Usuario no sabe cuándo CxP "termina"
- No hay estado final visible
- Potencial para duplicar pagos (si se paga 2 veces sin cierre)
- Cartera indefinida = corrupción de datos

**Categoría:** SIN CIERRE CLARO

---

### 2. 🔴 CUENTAS POR COBRAR (Registrar CxC — CNT-009)
**Estado:** PARCIAL — Cierre incompleto / no verificable

**Flujo:**
- Contador registra factura → `invoices_sent.status = 'emitted'`
- Cobranza cobra → ¿qué sucede después?
- ¿Cuándo se marca como `cobrada` o `closed`?
- ¿Se dispara automáticamente o es manual?

**Código evidencia:**
- Tabla: `supabase/migrations/cobracheck_complete_impl.sql` (tablas: `invoices_sent`, `accounts_receivable`)
- Campos en `accounts_receivable`: `id, invoice_id, company_id, amount, due_date, saldo, status`
- ❌ NO EXISTE lógica clara de "aplicar pago" → "restar de saldo" → "cerrar cuando saldo:0"
- ❌ NO EXISTE trigger que cierre CxC cuando `saldo = 0`

**Problema operativo:**
- Cobranza no tiene cierre de factura
- No hay confirmación "factura cobrada al 100%"
- Facturas pueden parecer "pendientes" indefinidamente aunque estén pagas
- Contador no sabe si CxC fue cobrada

**Categoría:** SIN CIERRE CLARO

---

### 3. 🔴 PÓLIZAS ABIERTAS (Generar póliza, gestionar anticipos — multiple flujos)
**Estado:** PARCIAL — ¿Cuándo cierra una póliza?

**Flujo:**
- Administrador crea anticipio → `policies.status = 'open'`
- Comprador registra gastos → `expenses.status = captured → pending_auth → authorized`
- ¿Cuándo se cierra la póliza?
- ¿Por fecha fija? ¿Por monto gastado? ¿Manual?

**Código evidencia:**
- Tabla: `supabase/migrations/20260606000001_init.sql:policies table`
- Campos: `status (enum: 'open' | 'closed'), closing_balance, closed_at`
- Edge Function: `supabase/functions/close-policy/index.ts` — existe pero:
  - ❌ NO ESTÁ CLARO cuándo se dispara
  - ❌ NO EXISTE scheduler que cierre automáticamente
  - ❌ NO EXISTE UI para cierre manual

**Problema operativo:**
- Usuario administrador no sabe cuándo cerrar póliza
- Pólizas pueden permanecer "open" indefinidamente
- No hay validación de "fecha vencimiento"
- Saldo indefinido en máquina de gastos

**Categoría:** SIN CIERRE CLARO

---

### 4. 🟠 REEMBOLSOS (Solicitar reembolso — CPR-009)
**Estado:** PARCIAL — ¿Cuándo se completa reembolso?

**Flujo:**
- Comprador registra gasto con recibos
- Gasto se autoriza → `status = authorized`
- Trigger → `reembolsos-workflow` crea reembolso
- ¿Cuándo se marca como "pagado"?
- ¿Se transfiere dinero automáticamente?

**Código evidencia:**
- Tabla: `reembolsos` table (creada en migrations)
- Edge Function: `supabase/functions/reembolsos-workflow/index.ts` — existe pero sin UI clara
- ❌ NO ESTÁ VERIFICADO si disparo es automático o manual
- ❌ NO EXISTE integración bancaria para transferencia

**Problema operativo:**
- Comprador no sabe si reembolso se procesó
- No hay confirmación de pago
- Potencial para olvidar reembolsos

**Categoría:** SIN CIERRE CLARO (parcialmente)

---

### 5. 🟠 PROMESAS DE PAGO (Cobranza — CBR-007, CBR-008)
**Estado:** NO VERIFICABLE — No hay cierre de promesa

**Flujo:**
- Cobranza registra promesa: "cliente pagará X en fecha Y"
- Sistema presume guardar en `collection_movements` (sin UI clara)
- ¿Qué sucede el día Y?
  - ¿Se le notifica a cobranza?
  - ¿Se marca como "incumplida" si no paga?
  - ¿Se cierra si paga?

**Código evidencia:**
- ❌ NO EXISTE tabla `collection_promises` o similar
- ❌ NO EXISTE trigger/scheduler para verificar promesas vencidas
- ❌ NO EXISTE notificación de "promesa incumplida"

**Problema operativo:**
- Promesas quedan "flotantes"
- No hay seguimiento automático
- Usuario manual debe recordar "revisar promesas"
- Cobranza ineficiente

**Categoría:** SIN CIERRE / NO IMPLEMENTADO

---

## MATRIZ DE PROCESOS SIN CIERRE

| ID | Proceso | Tabla/Field | Estado actual | Estado esperado | Trigger/Cierre | Categoría |
|----|---------|-----------|---------------|-----------------|----|-----------|
| P-CIERRE-001 | Registrar CxP | accounts_payable.status | pending | paid → closed | ❌ Manual / No existe | SIN CIERRE |
| P-CIERRE-002 | Registrar CxC | accounts_receivable.status | open | saldo:0 → closed | ❌ Manual / No existe | SIN CIERRE |
| P-CIERRE-003 | Cerrar póliza | policies.status | open | → closed | ⚠️ Existe func pero ¿cuándo? | SIN CIERRE |
| P-CIERRE-004 | Reembolsar | reembolsos.status | created | → completed | ❌ No claro | SIN CIERRE |
| P-CIERRE-005 | Promesa pago | collection_movements (presume) | registered | → cobrada/incumplida | ❌ No existe | NO IMPLEMENTADO |

---

## IMPACTO OPERATIVO

### 🔴 Crítico
- **CxP:** Comprador podría "re-gastar" dinero ya comprometido
- **CxC:** Contador no puede cerrar libros

### 🟠 Alto
- **Pólizas:** Sin fecha límite, saldos indefinidos
- **Reembolsos:** Dinero "perdido" en limbo

### 🟡 Medio
- **Promesas:** Seguimiento manual débil

---

## PRÓXIMA ACCIÓN

Se requiere definir explícitamente para CADA proceso:
1. ¿Cuáles son los estados posibles?
2. ¿Cuál es el estado final?
3. ¿Quién/qué dispara el cierre?
4. ¿Hay trigger automático o es manual?
5. ¿Auditar la transición?

Esto debe quedar en **10_PLAN_DE_CORRECCION_OPERATIVA.md**

