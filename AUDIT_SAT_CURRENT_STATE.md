# 🔍 AUDITORÍA SAT — ESTADO ACTUAL (2026-07-04)

**Objetivo**: Mapeo exhaustivo de qué está implementado vs qué falta  
**Método**: Búsqueda de código + Edge Functions + Migrations  
**Status**: EN PROGRESO (esperando búsqueda agente)

---

## 📊 RESUMEN EJECUTIVO

| Área | % Implementado | Status | Crítica | Notas |
|------|---|--------|---------|-------|
| **CFDIs (parsing)** | 80% | ⚠️ Parcial | SÍ | Parser XML existe, pero NO timbre real |
| **RFC Validation** | 0% | ❌ No existe | SÍ | Ni SAT API ni checks en código |
| **Pólizas Contables** | 50% | ⚠️ Schema listo | SÍ | Schema existe, triggers NO implementados |
| **Timbre Digital (PAC)** | 0% | ❌ No existe | CRÍTICA | Sin PAC = sin CFDIs válidas |
| **Auditoría Fiscal** | 60% | ⚠️ Incompleto | SÍ | created_by/at ✅, updated_by ❌ |
| **Retenciones** | 0% | ❌ No existe | SÍ | Ni tablas ni cálculo |
| **Conservación 5Y** | 70% | ⚠️ Soft delete | MEDIA | is_active=false ✅, archive bucket ❌ |
| **Export CONTPAQi** | 80% | ✅ Funcional | NO | Edge Function lista (exportar-polizas-sat) |
| **Integración SAT APIs** | 10% | ❌ Mock | SÍ | Functions existen pero con "TODO" |

**PROMEDIO ACTUAL**: 38% implementado (vs 42% del checklist)

---

## ✅ QUÉ ESTÁ IMPLEMENTADO

### 1. **CFDI Parser** (apps/cobra-mobile/lib/shared/cfdi.ts)
```typescript
✅ Extrae UUID del timbre
✅ Parsea RFC emisor/receptor
✅ Calcula IVA (002), IEPS (003) desde Traslados
✅ Calcula retenciones ISR (001), IVA (002) desde Retenciones
✅ Extrae conceptos, totales, fechas, métodos pago
✅ Sin dependencias externas (regex puro)
✅ Funciona en browser + Deno (Edge Functions)
```

**Archivo**: `apps/cobra-mobile/lib/shared/cfdi.ts` (82 líneas)

**Limitaciones**:
- ❌ NO valida estructura XSD
- ❌ NO verifica firma digital
- ❌ Solo parsea, no timbra

---

### 2. **CFDI Types & Schema** (FacturaCheck)
```typescript
✅ CfdiStatus enum (vigente, cancelado, not_found, duplicate, unmatched, matched, pending_complement)
✅ CfdiDirection (received | issued)
✅ CfdiType (I|E|P|T = Ingreso|Egreso|Pago|Traslado)
✅ CfdiDocument interface (completa)
✅ CfdiIssueRequest interface
✅ PAC Provider configs (facturama, facturapia, finkok)
✅ Status metadata (labels, colors, icons)
```

**Archivo**: `apps/cobra-mobile/lib/shared/facturacheck.ts` (100+ líneas)

**Disponible para**:
- Tipos de datos
- Status management
- PAC provider enums

**Falta**:
- ❌ Implementación de PAC calls
- ❌ Timbre digital workflow

---

### 3. **Edge Functions SAT** (supabase/functions/)

#### **A. exportar-polizas-sat** ✅ FUNCIONAL
```
Ruta: /functions/exportar-polizas-sat
Entrada: GET con query params (empresa_id, fecha_inicio, fecha_fin)
Salida: CSV en formato CONTPAQi
Caracteres: folio secuencial, debito/credito, cuentas
```

**Fórmula**:
```csv
FECHA,NUMERO,CONCEPTO,REFERENCIA,CUENTA,DEBIT,CREDIT
2026-06-15,00001,"Gasto de operación","id-gasto-1","4100",1000,
2026-06-15,00001,"Pago de gasto","id-gasto-1","1100",,1000
```

**Status**: ✅ Listo, solo necesita ser llamado desde BancoCheck UI

**Archivo**: `supabase/functions/exportar-polizas-sat/index.ts` (75 líneas)

---

#### **B. cobra-sat-validator** ⚠️ MOCK
```
Ruta: /functions/cobra-sat-validator
Entrada: POST { invoice_id, uuid_cfdi }
Salida: { valid, sat_status, invoice_id, uuid_cfdi }
```

**Implementación actual**:
```typescript
// Line 14-16: TODO: Call real SAT API
const isValid = uuid_cfdi.length === 36 && uuid_cfdi.includes('-')  // ← SOLO VALIDA FORMATO
```

**Falta**: Llamar a `https://consulta.sat.gob.mx` (API estándar SAT)

**Archivo**: `supabase/functions/cobra-sat-validator/index.ts` (40 líneas)

---

#### **C. validate-batch-sat** ⚠️ MOCK
```
Ruta: /functions/validate-batch-sat
Entrada: POST { batch_id, company_id }
Salida: { ok, validated_count, warnings, blocked }
```

**Implementación actual**:
```typescript
// Lines 70-72: Mock SAT validation
// "En producción: llamar a API.SAT.GOB.MX"
// Actualmente: solo valida formato UUID + duplicados en batch
```

**Falta**: Llamada real a SAT API

**Archivo**: `supabase/functions/validate-batch-sat/index.ts` (100+ líneas)

---

### 4. **Pólizas Contables — Schema** (supabase/migrations/20260704000002_...)

```sql
✅ accounting_vouchers table
   - voucher_number (unique, sequential)
   - voucher_type (INCOME|EXPENSE|TRANSFER)
   - total_debit & total_credit (must be equal)
   - entries (JSONB array)
   - exported_format (CSV|CONTPAQi|XML)
   
✅ accounting_voucher_entries (virtual via JSONB)
   - account_code
   - description
   - debit & credit
   - tax_code

✅ Índices para performance
✅ RLS policies (accountant-only access)
✅ Trigger: update_bank_account_balance()
```

**Archivo**: `supabase/migrations/20260704000002_bancocheck_complete_schema.sql` (277 líneas)

**Falta**:
- ❌ Trigger: on INSERT expenses → crear voucher
- ❌ Trigger: on INSERT collections → crear voucher
- ❌ Trigger: on RECONCILE → crear voucher
- ❌ Edge Function: create_accounting_voucher

---

### 5. **Auditoría Fiscal — Campos**

```sql
✅ created_by (user ID)
✅ created_at (ISO timestamp)
✅ updated_at (ISO timestamp)
✅ is_active (soft delete)

❌ updated_by (NO existe)
❌ change_reason (NO existe)
❌ user_ip (NO existe)
❌ device_info (NO existe)
```

**Tablas afectadas**:
- expenses ✅ (fields)
- collections ✅ (fields)
- bank_transactions ✅ (fields)
- accounting_vouchers ✅ (fields)
- cfdi_documents ✅ (fields)

**Falta**:
- ❌ Tabla centralizada audit_log
- ❌ Captura de IP en middleware
- ❌ Captura de device info
- ❌ Tracking de cambios (before/after values)

---

### 6. **Conservación 5 Años**

```sql
✅ Soft delete (is_active = false, nunca DROP)
   - Aplicado en todas las tablas
   - Queries filtran is_active=true por defecto

❌ Bucket de archivo fiscal
   - No existe storage separado
   - PDFs, XMLs no se guardan en archive
   
❌ Backup automático
   - No hay política de retención en Supabase
   - No hay export diario a Google Cloud
```

**Falta**:
- ❌ Supabase bucket: fiscal-5y
- ❌ Retention policy: never delete
- ❌ Daily export to GCS
- ❌ Encryption in transit
- ❌ Restore procedure documented

---

## ❌ QUÉ NO EXISTE

### 1. **PAC Timbre Digital — BLOQUEANTE**

Ninguna integración con:
- Finanzauto (SOLUCIONES)
- Facturama
- Facturapia
- Finkok

**Impacto**: Sin timbre = CFDIs inválidas = multa $50k-500k SAT

---

### 2. **RFC Validation con SAT API**

```
❌ Sin consulta SAT padrón
❌ Sin verificación RFC activo
❌ Sin detección RFC cancelado/fantasma
```

**Impacto**: Facturar a RFC fantasma = fraude fiscal

---

### 3. **Retenciones ISR e IVA**

```
❌ Sin tabla withholding_rules
❌ Sin cálculo automático
❌ Sin comprobante de retención
❌ Sin reporte a SAT
```

**Impacto**: No retener = multa por omisión

---

### 4. **Audit Log Centralizado**

```
❌ Sin tabla audit_log
❌ Sin IP logging
❌ Sin device tracking
❌ Sin change history
```

**Impacto**: Si hay auditoría SAT, no puedes probar quién operó

---

### 5. **Integración SAT APIs Real**

```
❌ cobra-sat-validator: solo formato UUID, no SAT real
❌ validate-batch-sat: mock validation, no SAT real
❌ Sin consulta status CFDI en SAT
❌ Sin reporte mensual a SAT
```

**Impacto**: No sincronizado con SAT = inconsistencias legales

---

## 🔴 CRÍTICAS SIN LAS CUALES NO SE PUEDE VENDER

```
1. ❌ TIMBRE PAC — sin esto, CFDI inválida
2. ❌ RFC VALIDATION — sin esto, facturas fantasma
3. ❌ PÓLIZAS AUTOMÁTICAS — sin esto, contador no puede cerrar
4. ❌ AUDITORÍA FISCAL — sin esto, no hay prueba de operación
5. ✅ SOFT DELETE — ya implementado
6. ❌ 5-YEAR ARCHIVE — sin esto, SAT cierra el RFC
7. ❌ RETENCIONES — sin esto, multa por omisión
```

---

## 📋 PLAN PRÓXIMOS PASOS

### SEMANA 1 — CRÍTICOS

**Día 1-2: PAC Integration (Finanzauto)**
```typescript
// supabase/functions/stamp-cfdi/index.ts
export async function stampCfdi(xml: string, companyId: string) {
  const response = await fetch('https://api.finanzauto.com/stamp', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${FINANZAUTO_API_KEY}`,
      'Content-Type': 'application/xml'
    },
    body: xml
  })
  
  const result = await response.json()
  // Returns: { uuid, xml_timbrado, fecha_timbre, folio_timbre }
  return result
}
```

**Día 2-3: RFC Validation**
```typescript
// packages/shared/src/validation/rfc-validator.ts
export async function validateRfcWithSat(rfc: string) {
  // Call https://consulta.sat.gob.mx/cfdi/api/services/Inteligencia
  // or use cache + backoff
}
```

**Día 3-4: Pólizas Automáticas**
```sql
CREATE TRIGGER after_expense_insert
  AFTER INSERT ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION create_accounting_voucher('EXPENSE', NEW.id, NEW.total);
```

**Día 4-5: Auditoría Fiscal**
```sql
ALTER TABLE expenses ADD COLUMN updated_by UUID;
ALTER TABLE expenses ADD COLUMN change_reason TEXT;
CREATE TABLE audit_log (...);
```

---

## 🎯 CONCLUSIÓN

**Implementación actual: 38%**
- ✅ Parser CFDI funciona
- ✅ Schema de pólizas listo
- ✅ Export CONTPAQi funciona
- ❌ Timbre PAC NO existe (CRÍTICO)
- ❌ RFC validation NO existe (CRÍTICO)
- ❌ Triggers de pólizas NO implementados (CRÍTICO)
- ❌ Auditoría fiscal incompleta (CRÍTICO)

**SIN ESTAS 4 CRÍTICAS, NO SE PUEDE VENDER.**

Tiempo estimado para cerrar brechas: **2-3 semanas**

