# AUDITORÍA BASE 002 — ESTADOS MUERTOS Y TRANSICIONES
**Análisis de estados sin salida posible o transiciones incompletas**

---

## ESTADO MUERTO 1: Expense Status "observed"
**Ubicación:** `supabase/migrations/20260606000001_init.sql` — enum status_expense

**Flujo:**
- Gasto: captured → pending_auth → authorized (✅ OK)
- Gasto rechazado: authorized → **observed** 
- ¿Salida desde "observed"? → capture nuevamente (presume)

**Transición:**
```
observed ──> captured (re-intenta) ──> pending_auth ──> authorized
```

**Problema:** ¿Estado puede permanecer en "observed"? ¿Hay límite de intentos?

**Verificación:** PARCIAL — Existe salida pero ciclo indefinido posible

---

## ESTADO MUERTO 2: Policy Status Sin Transición de "open" a "closed"
**Ubicación:** `supabase/migrations/20260606000001_init.sql` — enum status_policy

**Máquina de estados incompleta:**
```
open ──???──> closed
```

**Problema:**
- ¿Quién dispara cierre?
- ¿Hay timeout automático?
- ¿Usuario puede estar "stuck" en "open"?

**Verificación:** INCOMPLETO — Transición no clara

---

## ESTADO MUERTO 3: CxP Status Indefinido
**Ubicación:** `accounts_payable.status` — estados: pending, paid (presume)

**Flujo:**
```
pending ──> paid ──> ??? (closed? removed?)
```

**Problema:** Si status='paid' pero amount:X > 0, ¿cuál es estado? ¿Existe cierre explícito?

**Verificación:** INDEFINIDO — Transición no clara

---

## ESTADO MUERTO 4: CxC Status Sin Cierre Claro
**Ubicación:** `accounts_receivable.status` — estados: open, partially_paid, paid (presume)

**Flujo:**
```
open ──> partially_paid (pago parcial) ──> paid (pago total) ──> ??? (closed?)
```

**Problema:** ¿"paid" es estado final o no? ¿Necesita "closed" explícito?

**Verificación:** INDEFINIDO — Transición no clara

---

## ESTADO MUERTO 5: Reembolso Status Sin Cierre
**Ubicación:** `reembolsos` table — status desconocido

**Problema:** No existe definición de máquina de estados para reembolsos

**Verificación:** INDEFINIDO — Estado ausente

---

## MATRIZ DE TRANSICIONES

| Estado | Tabla | Entrada | Salida | Loops? | Timeout? | Muerto? |
|--------|-------|---------|--------|--------|----------|---------|
| captured | expenses | — | pending_auth | ❌ No | ✅ (N/A) | ❌ No |
| pending_auth | expenses | captured | authorized, observed | ⚠️ Parcial | ❌ No | ⚠️ Si observed |
| authorized | expenses | pending_auth | closed_in_policy, observed | ⚠️ Parcial | ❌ No | ⚠️ Si observed |
| observed | expenses | authorized | captured | ✅ Sí | ❌ No | ⚠️ Posible loop |
| open | policies | — | closed | ❌ Claro | ⚠️ No | ✅ Sí |
| pending | accounts_payable | — | paid | ✅ Claro | ✅ Sí | ❌ No |
| paid | accounts_payable | pending | ??? | ❓ | ❓ | ⚠️ Sí |
| open | accounts_receivable | — | paid | ✅ Claro | ⚠️ No | ⚠️ Sí |
| paid | accounts_receivable | open | ??? | ❓ | ❓ | ⚠️ Sí |

**Resumen:** 3-4 estados potencialmente muertos por transición indefinida

