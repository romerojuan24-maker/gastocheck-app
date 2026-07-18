# AUDITORÍA BASE 002 — AUTOMATIZACIONES FALTANTES
**Tareas manuales que deberían ser automáticas en flujos operativos**

---

## AUTOMATIZACIÓN 1: CONFIRMACIÓN OCR DE ALTA CONFIANZA
**Flujo:** Comprador fotografía ticket → OCR extrae con `confidence:high` → ¿Qué sucede?

**Estado actual:** ⚠️ MANUAL SIEMPRE
- OCR retorna `confidence: "high" | "medium" | "low"`
- Usuario DEBE abrir formulario y confirmar manualmente
- Incluso si `confidence:high`, requiere click "Confirmar"

**Archivo:** `supabase/functions/ocr-extract/index.ts:75-88`
```
response.json({
  extracted: { monto, fecha, proveedor },
  confidence: "high"
})
```

**Problema:** No hay lógica que diga "si confidence:high, auto-confirm"

**Automatización propuesta:**
- Si `confidence:high` → Auto-confirmar datos + cambiar status a `pending_auth`
- Si `confidence:medium` → Requerir confirmación manual
- Si `confidence:low` → Requerir re-fotografía

**Impacto:** -1 min/documento × 100/mes = 100 min/mes ahorrados

---

## AUTOMATIZACIÓN 2: ASIGNACIÓN DE RESPONSABLE SIGUIENTE
**Flujo:** Comprador crea gasto → ¿Quién lo autoriza?

**Estado actual:** ⚠️ NO AUTOMATIZADO
- Gasto se crea con `status:captured`
- Debe "esperar" que un administrador lo vea
- NO HAY notificación al admin
- Admin debe ir a `/pendientes` y buscarlo manualmente

**Archivo:** Ninguno — NO EXISTE

**Problema:** Gastos "perdidos" en limbo, admin no sabe que está esperando

**Automatización propuesta:**
- Crear gasto → Trigger que inserta en `notifications` tabla
- Enviar email/push: "Nuevo gasto de $X por autorizar"
- Mostrar contador de pendientes en UI

**Impacto:** Reducir tiempo de "espera" en 50%

---

## AUTOMATIZACIÓN 3: CIERRE AUTOMÁTICO DE PÓLIZA
**Flujo:** Póliza `status:open` → ¿Cuándo cierra?

**Estado actual:** ⚠️ MANUAL o NO EXISTE
- Archivo: `supabase/functions/close-policy/index.ts` existe pero:
  - NO HAY trigger que lo llame automáticamente
  - NO HAY scheduler (cron job)
  - Admin DEBE llamar manualmente

**Problema:** Pólizas permanecen `open` indefinidamente

**Automatización propuesta:**
- Opción 1: Cierre por fecha (fecha_vencimiento → cierre automático)
- Opción 2: Cierre por eventos (100% gastado → cierre automático)
- Opción 3: Cierre manual con fecha programada

**Impacto:** Evitar pólizas indefinidas

---

## AUTOMATIZACIÓN 4: APLICACIÓN AUTOMÁTICA DE PAGOS
**Flujo:** Cobranza registra pago → ¿Se aplica automáticamente a CxC?

**Estado actual:** ⚠️ NO ESTÁ CLARO
- Archivo: `supabase/functions/arrastrar-pago/index.ts` (presume lógica manual)
- ¿Automático? ¿Manual? ¿Seleccionar factura?

**Problema:** No se sabe si pago "se aplica solo" o requiere manual

**Automatización propuesta:**
- Si pago de cliente conocido + factura abierta única → Auto-aplicar
- Si múltiples facturas abiertas → Preseleccionar mayor vencida

**Impacto:** -2 min/pago × 50 pagos/mes = 100 min/mes

---

## AUTOMATIZACIÓN 5: NOTIFICACIÓN DE VENCIMIENTO
**Flujo:** Cobranza debe seguir CxC vencidas

**Estado actual:** ❌ NO IMPLEMENTADA
- No existe lógica para notificar "facturas vencidas"
- Cobranza DEBE ver dashboard y filtrar manualmente
- NO HAY alertas

**Archivo:** Ninguno

**Problema:** Facturas vencidas no se notan

**Automatización propuesta:**
- Cron job diario: Identificar facturas con `due_date < TODAY`
- Crear notificaciones
- Enviar email a gestor de cobranza

**Impacto:** Mejorar recupero de cartera en ~5%

---

## AUTOMATIZACIÓN 6: DESCARTE DE DUPLICADOS
**Flujo:** Comprador sube XML → Sistema detecta UUID duplicado

**Estado actual:** ✅ PARCIALMENTE AUTOMATIZADO
- Si UUID existe → Error 409 "CFDI duplicado"
- Usuario VE el error
- Problema: No le propone "usar el anterior" o "descartar"

**Archivo:** `supabase/functions/xml-parse/index.ts:61-67`

**Mejora propuesta:**
- Si duplicado detectado → Mostrar "¿Reutilizar CFDI anterior?" con opción de aceptar/rechazar

**Impacto:** Mejorar UX

---

## AUTOMATIZACIÓN 7: RECÁLCULO DE SALDO EN TIEMPO REAL
**Flujo:** ¿Cuándo se recalcula `policies.saldo`?

**Estado actual:** ⚠️ TRIGGER PARCIAL
- Archivo: `supabase/migrations/20260606000001_init.sql` — Trigger `recompute_policy_closing`
- Calcula: `opening_balance + SUM(advances) - SUM(authorized_expenses)`
- Problema: ¿Se ejecuta siempre o solo en ciertos estados?

**Mejora propuesta:**
- Verificar que trigger se ejecute en CADA cambio de estado de expense
- Verificar que se ejecute en CADA nuevo anticipo

**Impacto:** Garantizar datos consistentes

---

## AUTOMATIZACIÓN 8: VERIFICACIÓN DE INCONSISTENCIA WEB/MÓVIL
**Flujo:** Usuario ve diferentes datos en web vs móvil

**Estado actual:** ❌ NO VERIFICABLE
- Presume que datos vienen del mismo BD (✅)
- Pero ¿qué si UI show diferentes campos?

**Mejora propuesta:**
- Crear lógica de validación que compare vista web vs móvil
- Alertar si campos no coinciden

**Impacto:** Garantizar consistencia

---

## MATRIZ CONSOLIDADA

| ID | Automatización | Estado | Impacto | Esfuerzo |
|----|----------------|--------|--------|----------|
| AUTO-001 | Confirmar OCR:high | ❌ No | 100 min/mes | 2-3h |
| AUTO-002 | Notificar próximo responsable | ❌ No | -50% espera | 3-4h |
| AUTO-003 | Cierre póliza automático | ❌ No | Póliza indefinida | 4-6h |
| AUTO-004 | Aplicar pago automático | ⚠️ Unclear | 100 min/mes | 2-3h |
| AUTO-005 | Alerta de vencidos | ❌ No | +5% recupero | 3-4h |
| AUTO-006 | Resolver duplicados | ⚠️ Parcial | UX mejorada | 1-2h |
| AUTO-007 | Recálculo saldo real-time | ⚠️ Parcial | Consistencia | 1-2h |
| AUTO-008 | Validar web/móvil | ❌ No | Consistencia | 2-3h |

**Total impacto:** ~8+ horas de ahorro/mes para usuarios + mayor consistencia

