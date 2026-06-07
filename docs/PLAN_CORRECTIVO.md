# GastoCheck — Plan correctivo por riesgo

**Propósito:** Hoja de ruta para resolver los 9 riesgos identificados antes de producción

---

## 🔴 CRÍTICOS (Bloquean producción)

### CR-01: RLS no validado

**Problema:** No se ha verificado que las políticas RLS en Supabase realmente aíslan datos por company_id

**Acciones:**

1. **Auditar 0001_init.sql**
   - [ ] Revisar CADA `create policy` 
   - [ ] Validar que TODAS usan `auth_is_member(company_id)` o equivalente
   - [ ] Validar que TODAS usan WHERE con `company_id`
   - [ ] Validar que service_role bypass no existe (o está explícito)

2. **Validar tablas críticas:**
   ```sql
   -- Verificar que TODAS tienen RLS habilitado
   SELECT tablename FROM pg_tables 
   WHERE schemaname = 'public'
   ORDER BY tablename;
   
   -- Verificar políticas
   SELECT * FROM pg_policies 
   WHERE schemaname = 'public'
   ORDER BY tablename, policyname;
   ```

3. **Test manual:**
   - [ ] User A (empresa 1) login, intenta SELECT de empresa 2 → debe fallar
   - [ ] Spender intenta listar gastos de otro spender → debe fallar
   - [ ] Office intenta descargar archivo de otra empresa → debe fallar

4. **Estimar:** 4 horas auditoría + 2 horas corrección si hay issues

---

### CR-02: Saldos sin validar

**Problema:** Lógica de descuento de saldos no verificada. Riesgo: dobles descuentos, gastos rechazados que aún restan

**Acciones:**

1. **Auditar packages/shared/src/balance.ts**
   - [ ] `computeBalance()` solo suma gastos con status en `['authorized', 'invoice_applied']`?
   - [ ] `pendingToVerify` suma gastos en `['captured', 'pending_auth', 'observed']`?
   - [ ] ¿Excluyendo `['rejected', 'deleted', 'duplicate']`?

2. **Auditar trigger SQL (0001_init.sql)**
   ```sql
   -- Verificar trigger recompute_policy_closing
   -- Debe ejecutarse SOLO al cambiar status a authorized/invoice_applied/rejected
   -- Debe restar SOLO authorized + invoice_applied
   ```
   - [ ] Trigger existe y se ejecuta
   - [ ] Lógica es: `opening + advances - authorized - invoice_applied`
   - [ ] Sin errores de redondeo decimal

3. **Test de descuentos:**
   - [ ] Crear póliza, registrar anticipio, crear gasto
   - [ ] Gasto pending_auth: saldo NO desciende
   - [ ] Gasto → authorized: saldo desciende exactamente total del gasto
   - [ ] Gasto authorized → rejected: saldo restaura
   - [ ] Gasto authorized → duplicate: saldo restaura

4. **Test concurrencia:**
   - [ ] 2 usuarios autorizan mismo gasto simultáneamente → error o idempotent?
   - [ ] No double-count

5. **Estimar:** 6 horas (auditoría + tests + fix si hay issues)

---

### CR-03: Cierre de póliza sin snapshot

**Problema:** Al cerrar póliza no se congela estado. Después alguien edita gastos del cierre.

**Acciones:**

1. **Diseñar policy_snapshot**
   ```sql
   create table policy_snapshot (
     id uuid primary key,
     policy_id uuid not null references policies(id),
     snapshot_date date,
     opening_balance numeric,
     total_advances numeric,
     total_authorized numeric,
     total_pending numeric,
     closing_balance numeric,
     closed_by uuid references auth.users,
     closed_at timestamptz,
     url_comprobante text,  -- link a Excel/ZIP
     created_at timestamptz,
     -- NEVER UPDATE OR DELETE
   );
   ```

2. **Implementar cierre atómico:**
   - [ ] Trigger: al marcar `policy.status = 'closed'`, crear snapshot
   - [ ] Snapshot es READ-ONLY (RLS: solo owner puede crear, nadie puede editar)
   - [ ] Nueva póliza encadenada: `opening_balance = snapshot.closing_balance`
   - [ ] Previous_policy_id → snapshot para auditoría

3. **Congelar póliza cerrada:**
   - [ ] RLS: póliza cerrada NO permite modificar expenses
   - [ ] Excepto: owner con motivo + auditoría extra

4. **Estimar:** 4 horas (diseño + implementación + tests)

---

### CR-04: Duplicados CFDI / PDF / Foto no detectados

**Problema:** Mismo CFDI puede ligarse 2 veces, misma foto puede subirse 2 veces

**Acciones:**

1. **Validaciones CFDI (xml-parse function):**
   - [ ] UUID UNIQUE en cfdi_data (constraint + error handling)
   - [ ] RFC emisor NOT NULL, formato válido (^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$)
   - [ ] RFC receptor NOT NULL, formato válido
   - [ ] RFC emisor ≠ RFC receptor (check)
   - [ ] Subtotal + IVA ≈ Total (con tolerancia 0.01)
   - [ ] Fecha en rango razonable (últimos 90 días, para el futuro máx 30)

2. **Validaciones Foto/PDF:**
   - [ ] Hash(archivo) en tabla (para detectar duplicados)
   - [ ] Si hash existe + mismo RFC + ±1 día → ALERTA (duplicado probable)
   - [ ] Permitir pero marcar con `is_likely_duplicate = true`
   - [ ] Admin puede marcar como `duplicate` estatus

3. **Implementar:**
   ```sql
   -- En expense_attachments
   ALTER TABLE expense_attachments ADD COLUMN (
     file_hash varchar(64),  -- SHA-256
     is_likely_duplicate boolean default false
   );
   ```

4. **Estimar:** 6 horas (validaciones + hashes + UI de merge/split)

---

### CR-05: Bitácora no inmutable

**Problema:** Sin historial claro de quién hizo qué

**Acciones:**

1. **Validar expense_audit estructura:**
   - [ ] Existe tabla `expense_audit`
   - [ ] Campos: `expense_id, actor_id, action, from_status, to_status, timestamp, payload`
   - [ ] RLS: users de misma empresa pueden leer su audit

2. **Implementar triggers para audit:**
   - [ ] INSERT en expenses → fila en expense_audit (action: 'created')
   - [ ] UPDATE status en expenses → fila en audit (action: 'status_change')
   - [ ] UPDATE attachment → fila en audit (action: 'attachment_added')
   - [ ] DELETE (soft) → fila en audit (action: 'deleted')

3. **Congelar audit:**
   - [ ] No permitir UPDATE ni DELETE en expense_audit
   - [ ] Solo INSERT
   - [ ] RLS: cada empresa ve solo su audit

4. **Test:**
   - [ ] Crear gasto → 1 fila audit
   - [ ] Autorizar → nueva fila (quién, cuándo)
   - [ ] Rechazar → nueva fila (quién, motivo)
   - [ ] Ligar XML → nueva fila (quién, XML UUID)

5. **Estimar:** 3 horas (triggers + RLS + tests)

---

## 🟠 IMPORTANTES (Producción con cuidado)

### IM-01: Autorizaciones sin motivo de rechazo

**Problema:** Supervisor rechaza pero no dice por qué

**Acciones:**

1. **Agregar campo:**
   ```sql
   ALTER TABLE expenses ADD COLUMN rejection_reason text;
   ```

2. **Validar en authorize-expense:**
   - [ ] Si action='reject', require `rejection_reason`
   - [ ] Guardar en audit

3. **Estimar:** 1 hora

---

### IM-02: Excel + ZIP no implementados

**Problema:** Exportación bloqueada para contador

**Acciones:**

1. **Crear Edge Function `/export-excel`:**
   - [ ] Parámetro: `policy_id` o rango fecha
   - [ ] Hojas: Resumen, Por Empleado, Por Categoría, Por Centro, Detalle
   - [ ] Validar que usuario tiene permisos

2. **Crear Edge Function `/export-zip`:**
   - [ ] Incluir Excel + XML + PDF + fotos
   - [ ] ZIP sin datos de otras empresas
   - [ ] Signed URL que expira (7 días)

3. **Estimar:** 8 horas (implementación + testing)

---

### IM-03: Storage no segregado por tenant

**Problema:** Arquitectura storage unclear

**Acciones:**

1. **Validar estructura Supabase Storage:**
   - [ ] Buckets: `expense-attachments` (u otro nombre)
   - [ ] Paths: `/company/{company_id}/expense/{expense_id}/{file}`
   - [ ] RLS en bucket

2. **Implementar RLS en Storage:**
   ```sql
   -- En policy definition
   -- User solo descarga si pertenece a company_id del path
   ```

3. **Upload validado:**
   - [ ] Validar company_id en JWT
   - [ ] Rechazar si usuario no pertenece a company_id

4. **Estimar:** 4 horas

---

## 🟡 MENORES (Post-MVP)

### MN-01: Reembolso de saldos
**Solución:** Tabla `refunds`, ligada a póliza  
**Estimar:** 2 horas

### MN-02: Caja chica recurrente
**Solución:** Job recurrente mensual, crear póliza automática  
**Estimar:** 3 horas

### MN-03: Exportación Contpaq
**Solución:** Formato CSV con estructura de Contpaq  
**Estimar:** 4 horas

### MN-04: Notificaciones WhatsApp
**Solución:** Edge Function que envía, trigger al autorizar  
**Estimar:** 3 horas

---

## 📅 Timeline de correcciones

| Semana | Tarea | Horas | Riesgo |
|--------|-------|-------|--------|
| 1 | CR-01 RLS audit | 6 | 🔴 |
| 1 | CR-02 Saldos audit | 6 | 🔴 |
| 2 | CR-03 Policy snapshot | 4 | 🔴 |
| 2 | CR-04 Duplicados CFDI | 6 | 🔴 |
| 2 | CR-05 Audit immutable | 3 | 🔴 |
| 3 | IM-01 Motivo rechazo | 1 | 🟠 |
| 3 | IM-02 Excel/ZIP | 8 | 🟠 |
| 3 | IM-03 Storage RLS | 4 | 🟠 |
| **Total** | | **38 horas** | |

---

## ✅ Criterios de aprobación

**Apto para PILOTO (2-5 empresas):**
- ✅ CR-01, CR-02, CR-03, CR-05 resueltos
- ✅ IM-01, IM-02, IM-03 resueltos
- ⚠️ CR-04 puede ir a segundas iteraciones

**Apto para PRODUCCIÓN:**
- ✅ TODOS los CRÍTICOS resueltos
- ✅ TODOS los IMPORTANTES resueltos
- ⚠️ MENORES en roadmap

**Condición:** Auditoría externa (independiente) aprueba antes de launch
