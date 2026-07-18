# AUDITORÍA BASE 002 — PLAN DE CORRECCIÓN OPERATIVA
**Orden de prioridad para resolver problemas de flujos, NO técnicos**

---

## FASE 1: BLOQUEOS OPERATIVOS (CRÍTICO — Semana 1)

### 1.1 Definir cierre de CxP y CxC (P0 Operativo)
**Por qué:** Sin cierre, no se puede cerrar libros contables

**Qué hacer:**
- [ ] Definir máquina de estados para `accounts_payable`: pending → paid → closed
- [ ] Definir máquina de estados para `accounts_receivable`: open → partially_paid → paid → closed
- [ ] Crear trigger/función que cierre automáticamente cuando saldo:0
- [ ] Crear Trigger en `payment_receipts` que actualice `accounts_receivable.saldo`
- [ ] Documentar flujo de cierre en cada módulo

**Archivos a modificar:**
- `supabase/migrations/2026XXYY000000_add_closure_logic.sql` (nueva)
- `supabase/functions/arrastrar-pago/index.ts` (modificar)
- `supabase/functions/close-policy/index.ts` (documentar cuándo se invoca)

**Esfuerzo:** 6-8 horas

---

### 1.2 Eliminar duplicidad OCR (P0 Operativo)
**Por qué:** Costo de API + tiempo usuario

**Qué hacer:**
- [ ] Modificar `submit-receipt` para reutilizar extracción anterior si existe
- [ ] Si `confidence:high` de anterior → auto-confirmar, no re-procesar
- [ ] Si usuario re-sube = reemplazar archivo PERO reutilizar OCR si posible
- [ ] Agregar campo `ocr_reused_from_previous:true` en auditoría

**Archivos a modificar:**
- `supabase/functions/submit-receipt/index.ts` (agregar lógica de reutilización)
- `supabase/migrations/2026XXYY000001_track_ocr_reuse.sql` (nuevo campo)

**Esfuerzo:** 3-4 horas

---

### 1.3 Automatizar confirmación OCR de alta confianza (P0 Operativo)
**Por qué:** 100 min/mes de trabajo innecesario

**Qué hacer:**
- [ ] Si `confidence:high` → auto-cambiar status a `pending_auth` (sin esperar click manual)
- [ ] Si `confidence:medium` → requerir manual, mostrar formulario
- [ ] Si `confidence:low` → forzar re-fotografía

**Archivos a modificar:**
- `supabase/functions/ocr-extract/index.ts:88-100` (agregar auto-confirm)

**Esfuerzo:** 2-3 horas

---

## FASE 2: FRICCIONES ALTAS (IMPORTANTE — Semana 1-2)

### 2.1 Eliminar manual "relacionar documento" (P1 Operativo)
**Por qué:** Documento ya está relacionado desde upload

**Qué hacer:**
- [ ] Verificar que `expense_attachments.expense_id` se asigna en `submit-receipt`
- [ ] Si SÍ: Eliminar paso de "relacionar" en UI contador
- [ ] Si NO: Agregar lógica en `submit-receipt` para relacionar

**Esfuerzo:** 1-2 horas

---

### 2.2 Crear notificaciones para próximo responsable (P1 Operativo)
**Por qué:** Admin no sabe que gasto está esperando autorización

**Qué hacer:**
- [ ] Crear tabla `notifications` (id, user_id, type, related_id, read)
- [ ] Trigger en `expenses`: si status:'captured' → insert notificación para admin
- [ ] Trigger en `expenses`: si status:'observed' → insert notificación para comprador
- [ ] UI: Badge con contador de notificaciones

**Esfuerzo:** 4-5 horas

---

### 2.3 Definir cierre de póliza (P1 Operativo)
**Por qué:** Pólizas abiertas indefinidamente

**Qué hacer:**
- [ ] Agregar campo `planned_closing_date` a `policies`
- [ ] Opción 1: Cierre automático por fecha
- [ ] Opción 2: Cierre manual con confirmación de admin
- [ ] Crear cron job (scheduler) que cierre pólizas vencidas

**Esfuerzo:** 4-6 horas

---

## FASE 3: MEJORAS DE VERIFICABILIDAD (IMPORTANTE — Semana 2)

### 3.1 Verificar CobraCheck end-to-end (P2 Operativo)
**Por qué:** 50% de CobraCheck no verificada

**Qué hacer:**
- [ ] Testear: Crear factura → Registrar pago → Cerrar CxC
- [ ] Testear: Registrar promesa → Verificar vencimiento → Marcar cobrada
- [ ] Testear: Cobranza puede ver cartera vencida
- [ ] Documentar gaps si existen

**Esfuerzo:** 3-4 horas (testing)

---

### 3.2 Crear UI para cobranza si falta (P2 Operativo)
**Por qué:** Cobranza no tiene interfaz clara

**Qué hacer:**
- [ ] Crear o verificar `/cobracheck/actividades` (registrar llamada, WhatsApp, email, promesa)
- [ ] Crear `/cobracheck/vencidos` (filtro automático)
- [ ] Crear `/cobracheck/scoring` (priorización si existe función)

**Esfuerzo:** 6-8 horas (UI + Backend)

---

## FASE 4: INCONSISTENCIAS (IMPORTANTE — Semana 2-3)

### 4.1 Verificar web vs mobile (P2 Operativo)
**Por qué:** Usuarios confundidos por funciones ausentes

**Qué hacer:**
- [ ] Listar todas las rutas en web
- [ ] Verificar que existan en mobile (o documentar como mobile-only)
- [ ] Alinear funcionalidad: si en web, debe estar en mobile
- [ ] Crear matriz de cobertura

**Esfuerzo:** 3-4 horas (auditoría) + X horas (implementación según gaps)

---

## RESUMEN OPERATIVO

| Fase | Prioridad | Esfuerzo | Bloqueador? |
|------|-----------|----------|------------|
| 1.1 Cierre CxP/CxC | 🔴 CRÍTICA | 6-8h | ✅ Sí |
| 1.2 Sin duplicidad OCR | 🔴 CRÍTICA | 3-4h | ⚠️ Costo |
| 1.3 Auto-confirm OCR | 🔴 CRÍTICA | 2-3h | ⚠️ Tiempo |
| 2.1 Sin "relacionar" manual | 🟠 Alta | 1-2h | ⚠️ Fricción |
| 2.2 Notificaciones | 🟠 Alta | 4-5h | ⚠️ Fricción |
| 2.3 Cierre póliza | 🟠 Alta | 4-6h | ✅ Bloqueo |
| 3.1 Verificar CobraCheck | 🟡 Media | 3-4h | ⚠️ Verificabilidad |
| 3.2 UI Cobranza | 🟡 Media | 6-8h | ⚠️ Usabilidad |
| 4.1 Web vs Mobile | 🟡 Media | 3-4h + X | ⚠️ Consistencia |

**Total Fase 1-2 (Bloqueadores + Fricciones):** 24-32 horas

**Total Fase 1-4 (Completo):** 33-47 horas

