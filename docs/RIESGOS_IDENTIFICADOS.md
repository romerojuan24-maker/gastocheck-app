# GastoCheck — Riesgos identificados (Pre-auditoría)

**Auditor:** Daniel (Sistemas)  
**Fecha:** 2026-06-06  
**Estado:** Pre-auditoría de riesgo (sin revisar código)  
**Calificación actual:** 60–70% MVP

---

## 📊 Matriz de riesgos por área

| Área | Riesgo | Impacto | Estado | Prioridad |
|------|--------|---------|--------|-----------|
| BD + RLS | Políticas no validadas, bypass posible | CRÍTICO | ⚠️ Declarado | CRÍTICA |
| Saldos | Cálculos incorrectos, dobles descuentos | CRÍTICO | ⚠️ Declarado | CRÍTICA |
| Pólizas | Cierre sin snapshot, cambios post-cierre | CRÍTICO | ⚠️ Diseño | CRÍTICA |
| XML/PDF | Duplicados CFDI, RFC inválidos, foto repetida | CRÍTICO | ⚠️ Parcial | CRÍTICA |
| Auditoría | Sin bitácora inmutable, imposible auditar | CRÍTICO | ⚠️ No visto | CRÍTICA |
| Autorizaciones | Sin audit trail, quién autorizó unclear | IMPORTANTE | ⚠️ No validado | ALTA |
| Excel/ZIP | No implementado | IMPORTANTE | ✗ Pendiente | ALTA |
| Storage | No segregado por tenant | IMPORTANTE | ⚠️ No visto | ALTA |
| UX móvil | Bien planteada pero sin validar | MENOR | ⚠️ Conceptual | MEDIA |

---

## 🔴 RIESGOS CRÍTICOS (Producción bloqueante)

### 1. RLS no validado
**Riesgo:** Usuario A ve datos de empresa B  
**Síntoma:** Falta revisar `create policy` en 0001_init.sql  
**Impacto:** Fuga de datos, incumplimiento legal  
**Necesario validar:**
- [ ] `company_id` en WHERE de TODAS las políticas
- [ ] `auth.uid()` correctamente referenciado
- [ ] Supervisor SOLO ve personal de su empresa
- [ ] Spender SOLO ve sus gastos
- [ ] Storage protegido (no acceso directo)
- [ ] Service role bypass prevenido

### 2. Lógica de saldos sin validar
**Riesgo:** Saldo descuenta gastos rechazados, dobles descuentos, no se revierte  
**Síntoma:** Falta revisar triggers + computeBalance()  
**Impacto:** Números contables incorrectos, desconfianza  
**Necesario validar:**
- [ ] Solo `authorized` e `invoice_applied` descuentan
- [ ] `pending_auth`, `observed`, `rejected`, `deleted`, `duplicate` NO descuentan
- [ ] Trigger SQL recalcula al insertar/actualizar
- [ ] Reversión de gasto autorizado (✓ → ✗) restaura saldo
- [ ] Sin race conditions (concurrencia)

### 3. Cierre de póliza sin snapshot
**Riesgo:** Se cierra póliza, después alguien edita datos del cierre (imposible en contabilidad)  
**Impacto:** Auditoría fallida, números inconsistentes  
**Necesario agregar:**
- [ ] Tabla `policy_snapshot` inmutable
- [ ] Al cerrar: guardar closing_balance, total_authorized, total_pending
- [ ] Quién cerró, cuándo, URL de prueba
- [ ] Póliza cerrada es READ-ONLY (excepto owner, con motivo)

### 4. Detección de duplicados CFDI incompleta
**Riesgo:** Mismo XML ligado 2 veces, mismo PDF 2 veces, misma foto 2 veces  
**Síntoma:** No veo validaciones en xml-parse ni ocr-extract  
**Impacto:** Gastos duplicados, saldos incorrectos, conteo inflado  
**Necesario implementar:**
- [ ] UUID duplicado → rechazo (cfdi_data.uuid UNIQUE)
- [ ] Hash(PDF) duplicado → alerta
- [ ] Hash(foto) + fecha + RFC emisor duplicado → alerta
- [ ] RFC emisor != RFC receptor (obligatorio)
- [ ] Subtotal + IVA = Total (validación matemática)

### 5. Bitácora de cambios no inmutable
**Riesgo:** Sin historial claro de quién hizo qué cuándo  
**Síntoma:** `expense_audit` existe pero no se validó  
**Impacto:** Imposible auditar, incumplimiento regulatorio  
**Necesito revisar:**
- [ ] CADA insert/update en `expenses` → fila en `expense_audit`
- [ ] Quién subió comprobante (usuario + timestamp)
- [ ] Quién autorizó (usuario + timestamp + motivo)
- [ ] Quién rechazó (usuario + timestamp + motivo)
- [ ] Quién eliminó (usuario + timestamp)
- [ ] Quién ligó XML (usuario + timestamp)
- [ ] Tabla `expense_audit` tiene RLS para ver solo su empresa
- [ ] Sin UPDATE ni DELETE en `expense_audit` (solo INSERT)

---

## 🟠 RIESGOS IMPORTANTES (Producción con cuidado)

### 6. Autorizaciones sin audit trail claro
**Riesgo:** Supervisor autoriza, después cambia idea o se disputa  
**Impacto:** Conflictos, imposible rastrear decisiones  
**Necesario validar:**
- [ ] `authorized_by` + `authorized_at` en `expenses`
- [ ] Quién rechaza queda registrado
- [ ] Motivo de rechazo guardado
- [ ] ¿Permite re-autorizar después de rechazo?

### 7. Excel + ZIP no implementados
**Riesgo:** Contador no puede exportar datos  
**Impacto:** Workflow incompleto, no se puede cerrar ciclo  
**Necesario implementar:**
- [ ] Edge Function `/export-excel` (por empleado, consolidado, por categoría, por centro, por póliza)
- [ ] Mapeo categoría → cuenta contable
- [ ] Edge Function `/export-zip` (Excel + XML + PDF + fotos)
- [ ] Links firmados (signed URL) que expiren

### 8. Storage no segregado por tenant
**Riesgo:** Usuario A descarga foto de empresa B  
**Impacto:** Fuga de datos sensibles  
**Necesario validar:**
- [ ] Storage path: `/companies/{company_id}/expenses/{expense_id}/{file}`
- [ ] Bucket RLS por company_id
- [ ] No acceso directo sin JWT
- [ ] Descarga vía endpoint con validación RLS

---

## 🟡 RIESGOS MENORES (Validar después de MVP)

### 9. UX móvil bien planteada pero sin validar
**Riesgo:** Complica para usuario o queda incompleta  
**Impacto:** Adopción baja, flujo lento  
**Validación:**
- [ ] Foto → OCR → confirmar → enviar: máx 2-3 pasos
- [ ] Usuario ve su saldo actualizado en tiempo real
- [ ] Ve pendientes, autorizados, rechazados
- [ ] Offline-friendly (? opcional)

---

## 🆘 RIESGOS NO MENCIONADOS (Deberían existir)

| Riesgo | Motivo | Solución |
|--------|--------|----------|
| **Reembolso de saldos** | ¿Qué pasa si empleado devuelve dinero sobrante? | Tabla `refunds`, ligada a póliza |
| **Caja chica recurrente** | ¿Cada mes nueva póliza automática? | Trigger o job scheduled |
| **Exportación Contpaq** | ¿Contador usa Contpaq? | Formato CSV/XML según contabilidad |
| **Cancelación CFDI** | ¿SAT cancela CFDI? | Detectar status SAT, marcar como cancelado |
| **Límites por plan** | ¿Plan Básico permite max 2 empleados? | RLS + conteo en app, no en BD |
| **Notificaciones** | ¿Spender recibe alerta cuando autoriza? | WhatsApp / push (opcional MVP) |
| **Anticipo vs Gasto** | ¿Permitir anticipo sin póliza abierta? | Requiere póliza viva |

---

## 📋 Checklist para auditoría COMPLETA

**Necesito revisar estos archivos:**

```
✓ docs/DISENO.md (ya revisado — bueno)
❓ supabase/migrations/0001_init.sql
  └─ Validar RLS policies (CRÍTICO)
  └─ Validar triggers saldo (CRÍTICO)
  └─ Validar UNIQUE constraints (duplicados)

❓ packages/shared/src/balance.ts
  └─ Validar cálculo de saldos

❓ supabase/functions/authorize-expense/index.ts (no existe aún)
  └─ Validar audit trail

❓ supabase/functions/xml-parse/index.ts (no existe aún)
  └─ Validar duplicados CFDI

❓ supabase/functions/export-excel/index.ts (no existe aún)
❓ supabase/functions/export-zip/index.ts (no existe aún)

❓ apps/mobile/app/capture.tsx
  └─ Validar flujo 2-3 pasos

❓ apps/web/... (dashboard)
  └─ Validar conexión a BD
```

---

## 🎯 Conclusión preliminar

**Arquitectura:** 9/10 — bien pensada, enfoque correcto  
**SaaS model:** 9/10 — multi-tenant desde inicio, RLS considerado  
**UX:** 9/10 — flujo simple y claro  
**Seguridad:** 6/10 — RLS declarado pero no validado  
**Contabilidad:** 7/10 — modelo correcto, snapshot falta  

**Estado real:** 60–70% (código scaffolded, lógica crítica parcial)

**Apto para:** Piloto cerrado (2-5 empresas, equipo técnico presente)  
**NO apto para:** Producción general (revisar 7 áreas antes)

---

**Próximo paso:** Auditar código en orden:
1. RLS
2. Saldos
3. Pólizas (snapshot)
4. XML/duplicados
5. Auditoría inmutable
6. Excel/ZIP
7. UX
