# AUDITORÍA BASE 002 — FRICCIONES Y ATOROS
**Puntos donde usuarios quedan bloqueados o requieren trabajo manual excesivo**

---

## ATORO 1: Admin esperando gastos a autorizar
**Perfil:** Administrador  
**Escenario:** Comprador captura gasto → Admin debe autorizarlo

**Fricción:**
- ❌ NO hay notificación
- ❌ Admin DEBE ir a `/pendientes` y buscar
- ❌ No sabe si hay gastos esperando
- ⏱️ Gasto puede esperar indefinidamente

**Impacto:** 50+ min/mes de "búsqueda manual" + retrasos de autorización

**Solución:** (Ver 10_PLAN_DE_CORRECCION_OPERATIVA.md → 2.2)

---

## ATORO 2: Contador reasignando documento dos veces
**Perfil:** Contador  
**Escenario:** Comprador carga documento → Contador debe "relacionarlo"

**Fricción:**
- ❌ Ya está relacionado (expense_id asignado)
- ⚠️ Contador no sabe si está relacionado
- ⏱️ 1 min/documento × 100/mes = 100 min/mes

**Solución:** (Ver 10_PLAN_DE_CORRECCION_OPERATIVA.md → 2.1)

---

## ATORO 3: Comprador re-fotografía todo en caso de rechazo
**Perfil:** Comprador  
**Escenario:** Comprador fotografía ticket → Contador rechaza → Comprador re-fotografía

**Fricción:**
- ❌ Primer OCR se ejecutó (con costo API)
- ❌ No se reutiliza: se ejecuta OCR NUEVAMENTE
- ❌ Archivo anterior se pierde o duplica
- 💰 Costo: ~$0.10/re-fotografía × 20 rechazos/mes = $2/mes
- ⏱️ Tiempo: 2 min/re-fotografía × 20/mes = 40 min/mes

**Solución:** (Ver 10_PLAN_DE_CORRECCION_OPERATIVA.md → 1.2)

---

## ATORO 4: OCR requiere confirmación manual incluso si confidence:high
**Perfil:** Comprador  
**Escenario:** OCR extrae monto/fecha/proveedor con confidence:high

**Fricción:**
- ❌ Sistema sabe que es high-confidence
- ⚠️ Requiere click manual "Confirmar" de todas formas
- ⏱️ 1 min/documento × 100/mes = 100 min/mes

**Solución:** (Ver 10_PLAN_DE_CORRECCION_OPERATIVA.md → 1.3)

---

## ATORO 5: Cobranza sin interfaz clara
**Perfil:** Responsable de Cobranza  
**Escenario:** Cobranza abre `/cobracheck` y no sabe qué hacer

**Fricción:**
- ❌ No hay lista clara de "qué debo hacer"
- ❌ No hay notificaciones de "facturas vencidas"
- ❌ Debe filtrar manualmente
- ❌ No hay opción para "registrar llamada"

**Solución:** (Ver 10_PLAN_DE_CORRECCION_OPERATIVA.md → 3.2)

---

## ATORO 6: Póliza abierta indefinidamente
**Perfil:** Administrador  
**Escenario:** Póliza se abre y Admin debe recordar cerrarla

**Fricción:**
- ❌ No hay fecha límite
- ⚠️ No hay recordatorio
- ❌ Admin OLVIDA cerrar → póliza permanece abierta
- ❌ Saldos indefinidos

**Solución:** (Ver 10_PLAN_DE_CORRECCION_OPERATIVA.md → 2.3)

---

## ATORO 7: Transacciones CxP/CxC sin cierre claro
**Perfil:** Contador  
**Escenario:** Contador registra CxP/CxC y no sabe cuándo "cierra"

**Fricción:**
- ❌ No hay confirmación de "completada"
- ⚠️ Puede aparecer como "pendiente" indefinidamente
- ❌ Difícil cerrar libros

**Solución:** (Ver 10_PLAN_DE_CORRECCION_OPERATIVA.md → 1.1)

---

## ATORO 8: Estados inconsistentes web vs mobile
**Perfil:** Todos  
**Escenario:** Usuario ve función en web pero no en mobile

**Fricción:**
- ❌ Confusión: ¿Por qué no está acá?
- ⚠️ Necesita usar otra plataforma
- ⏱️ Cambio de contexto

**Solución:** (Ver 10_PLAN_DE_CORRECCION_OPERATIVA.md → 4.1)

---

## MATRIZ DE SEVERIDAD

| ID | Atoro | Perfil | Tiempo/mes | Costo | Bloqueo? |
|----|-------|--------|-----------|-------|----------|
| AT-001 | Sin notificaciones auth | Admin | 50 min | — | ⚠️ Retrasos |
| AT-002 | Relacionar doc 2x | Contador | 100 min | — | ⚠️ Fricción |
| AT-003 | Re-upload OCR | Comprador | 40 min | $2 | ⚠️ Fricción |
| AT-004 | Manual confirm OCR | Comprador | 100 min | — | 🟡 Alta |
| AT-005 | Cobranza sin UI | Cobranza | 200+ min | — | 🟡 Alta |
| AT-006 | Póliza indefinida | Admin | Ad-hoc | — | 🔴 Crítica |
| AT-007 | CxP/CxC sin cierre | Contador | Ad-hoc | — | 🔴 Crítica |
| AT-008 | Web vs mobile | Todos | Variable | — | 🟡 Media |

**Total tiempo perdido/mes:** ~590 min (10 horas/mes)

