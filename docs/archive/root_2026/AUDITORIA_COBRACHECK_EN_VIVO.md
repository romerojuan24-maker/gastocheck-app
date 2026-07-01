# 🔍 AUDITORÍA COBRACHECK EN VIVO

**Fecha:** 2026-06-19  
**Objetivo:** Identificar bugs antes de lanzar  
**Estado:** EN PROGRESO

---

## ✅ HALLAZGOS POSITIVOS

### Dashboard (page.tsx)
- ✅ Auth check correcta (getSession)
- ✅ Company isolation (eq company_id)
- ✅ KPIs calculados correctamente
- ✅ Error handling básico
- ✅ Loading state implementado
- ✅ Modal para crear cliente

### Crear Cliente
- ✅ Validación RFC (mínimo 12 caracteres)
- ✅ Validación nombre (mínimo 3 caracteres)
- ✅ Inserta con company_id correcto
- ✅ Recarga datos después de crear

---

## 🐛 BUGS ENCONTRADOS

### Bug #1: RFC validation débil
**Ubicación:** `handleAddClient` (línea ~85)

**Problema:**
```typescript
if (!rfc || rfc.length < 12) throw new Error('RFC inválido')
// ❌ Acepta RFC de 12 caracteres
// Debería ser exactamente 13 caracteres (RFC mexicano)
```

**Severidad:** 🟡 MEDIO (aceptará RFCs inválidos)

**Fix:**
```typescript
if (!rfc || rfc.length !== 13) throw new Error('RFC debe ser exactamente 13 caracteres')
```

---

### Bug #2: Email no validado en cliente
**Ubicación:** Formulario crear cliente

**Problema:**
```
Campo email:
- No existe en el formulario de crear cliente
- Pero está en la tabla (cobra_clients.email)
- Usuario no puede ingresar email
```

**Severidad:** 🟡 MEDIO (dato faltante)

**Fix:** Agregar campo email al formulario con validación

---

### Bug #3: RFC no valida duplicados
**Ubicación:** `handleAddClient`

**Problema:**
```typescript
// Crea cliente sin verificar RFC único
await supabase.from('cobra_clients').insert({ name, rfc, company_id })
// ❌ Si RFC ya existe en empresa, falla silenciosamente
```

**Severidad:** 🔴 CRÍTICO (datos duplicados)

**Fix:**
```typescript
// Verificar antes de insertar
const { data: existing } = await supabase
  .from('cobra_clients')
  .select('id')
  .eq('rfc', rfc)
  .eq('company_id', member.company_id)
  .single()

if (existing) throw new Error('RFC ya existe en esta empresa')
```

---

### Bug #4: Teléfono no validado
**Ubicación:** Campo teléfono (si existe)

**Problema:**
- No hay validación de formato
- Acepta strings aleatorios

**Severidad:** 🟡 BAJO (no crítico, pero debería validar)

**Fix:**
```typescript
// Si ingresa teléfono, debe ser válido
if (phone && !/^\d{10}$/.test(phone)) {
  throw new Error('Teléfono debe ser 10 dígitos')
}
```

---

### Bug #5: No hay loader visual en createCliente
**Ubicación:** Botón "Crear cliente"

**Problema:**
- Después de hacer click, usuario no sabe si está procesando
- Puede hacer click múltiples veces

**Severidad:** 🟡 BAJO (UX)

**Fix:**
```typescript
const [creatingClient, setCreatingClient] = useState(false)

// En handleAddClient:
setCreatingClient(true)
try {
  // ... crear
} finally {
  setCreatingClient(false)
}

// En botón:
<button disabled={creatingClient}>
  {creatingClient ? '...' : 'Crear cliente'}
</button>
```

---

### Bug #6: Facturas vencidas - cálculo de days_overdue
**Ubicación:** Tabla cobra_invoices

**Problema:**
```typescript
// En BD, days_overdue es GENERATED COLUMN
// Pero no se actualiza en tiempo real si:
// - La fecha vencimiento cambió
// - La fecha de hoy avanzó
```

**Severidad:** 🟡 MEDIO (datos desincronizados)

**Fix:** Calcular days_overdue en SELECT:
```typescript
.select(`
  *,
  days_overdue:
    CASE WHEN status = 'overdue'
    THEN (CURRENT_DATE - due_date)::int
    ELSE NULL
    END
`)
```

---

### Bug #7: Risk scoring - no recalcula
**Ubicación:** Dashboard (avgScore)

**Problema:**
```typescript
const avgScore = ... // Calculado al cargar
// Si usuario registra pago, score debería bajar
// Pero no se recalcula automáticamente
```

**Severidad:** 🟡 MEDIO (datos obsoletos)

**Fix:** Recalcular después de cualquier acción:
```typescript
// Después de registrar pago:
await loadData() // Recarga KPIs y scores
```

---

### Bug #8: No hay validación de límite de crédito
**Ubicación:** Crear factura

**Problema:**
```
Caso: Cliente con límite $1000
Usuario crea factura de $5000
Sistema PERMITE (debería bloquear)
```

**Severidad:** 🔴 CRÍTICO (sobreendeudamiento)

**Fix:**
```typescript
if (newInvoiceAmount > client.credit_limit) {
  throw new Error(`Sobrepasa límite de crédito ($${client.credit_limit})`)
}
```

---

### Bug #9: No hay confirmación antes de eliminar
**Ubicación:** Acciones cliente/factura

**Problema:**
- Si existe botón eliminar, no pide confirmación
- Usuario puede borrar por accidente

**Severidad:** 🟡 MEDIO (UX)

**Fix:**
```typescript
if (!confirm('¿Estás seguro de eliminar? Esta acción no se puede deshacer')) {
  return
}
```

---

### Bug #10: Actualizar status factura después de pago
**Ubicación:** Registrar pago

**Problema:**
```
Usuario paga $500 de factura $1000
Status debería cambiar a 'partial'
Pero no está implementado (ver código pago)
```

**Severidad:** 🔴 CRÍTICO (lógica incompleta)

**Fix:**
```typescript
// Después de registrar pago, actualizar factura:
const newStatus = amountPaid >= facturaAmount ? 'paid' : 'partial'
await supabase
  .from('cobra_invoices')
  .update({ status: newStatus })
  .eq('id', facturaId)
```

---

## 📋 CHECKLIST DE FIXES NECESARIOS

### CRÍTICOS (Hacer HOY)
- [ ] RFC validación exacta (13 caracteres)
- [ ] RFC duplicado en empresa (no permitir)
- [ ] Límite de crédito (bloquear si se sobrepasa)
- [ ] Status factura después de pago (partial/paid)
- [ ] Implementar pólizas descargables ← NUEVO

### MEDIOS (Hacer HOY)
- [ ] Agregar email al formulario cliente
- [ ] Validar email formato
- [ ] Days_overdue recalcular en tiempo real
- [ ] Risk scoring actualizar después de pago
- [ ] Validar teléfono (10 dígitos)

### BAJOS (Si hay tiempo)
- [ ] Loader visual en crear cliente
- [ ] Confirmación antes de eliminar
- [ ] Mensajes de error más claros

---

## 🔧 PLAN DE FIXES (Hoy 15:00-18:00)

### 15:00-15:30: Fixes CRÍTICOS
```
1. RFC validation fix
2. RFC duplicado check
3. Límite crédito validation
4. Update factura status
```

### 15:30-16:30: Pólizas
```
5. Implement generatePolizaFromPayment()
6. Implement downloadCSV()
7. Implement downloadExcel()
8. Add UI component
```

### 16:30-17:30: Fixes MEDIOS
```
9. Email field + validation
10. Days_overdue recalc
11. Risk scoring update
12. Teléfono validation
```

### 17:30-18:00: Testing rápido
```
- Flujo: Crear cliente → Factura → Pago → Póliza
- Verificar status = partial/paid
- Verificar risk score
- Descargar póliza CSV/Excel
```

---

## 📊 RESUMEN AUDITORÍA

| Bug | Severidad | Estado | Fix |
|-----|-----------|--------|-----|
| RFC 12 chars | MEDIO | BLOQUEADO | 1 línea |
| RFC duplicado | CRÍTICO | TODO | 5 líneas |
| Límite crédito | CRÍTICO | TODO | 3 líneas |
| Status factura | CRÍTICO | TODO | 5 líneas |
| Email missing | MEDIO | TODO | Form + validation |
| Days_overdue | MEDIO | PARCIAL | Query fix |
| Risk score | MEDIO | TODO | Recalc |
| Teléfono | BAJO | TODO | Regex |
| Loader | BAJO | TODO | State |
| Confirmar delete | BAJO | TODO | Modal |

**Total bugs:** 10 (3 críticos, 5 medios, 2 bajos)  
**Tiempo fixes:** ~3 horas  
**Testing:** ~1 hora

---

## ✅ SIGUIENTE PASO

Comenzar fixes críticos ahora (15:00):

1. ✏️ RFC validation (1 línea)
2. ✏️ RFC duplicado check (5 líneas)
3. ✏️ Límite crédito (3 líneas)
4. ✏️ Update factura status (5 líneas)

Después: Implementar pólizas descargables.

---

**Auditoría completada. Listos para arreglar.**
