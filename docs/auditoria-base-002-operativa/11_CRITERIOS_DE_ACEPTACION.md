# AUDITORÍA BASE 002 — CRITERIOS DE ACEPTACIÓN
**Cómo verificar que correcciones operativas están completas**

---

## CRITERIO 1: Cierre de CxP/CxC (Bloqueador OP-001, OP-002)

**Aceptado si:**
- [ ] `accounts_payable` tiene máquina de estados: pending → paid → closed
- [ ] `accounts_receivable` tiene máquina de estados: open → partially_paid → paid → closed
- [ ] Trigger automático cierra cuando saldo:0
- [ ] Contador puede ver estado de cada transacción
- [ ] Test: Crear CxP → Pagar → Verificar closed automáticamente ✅

---

## CRITERIO 2: OCR sin duplicidad (Bloqueador OP-003)

**Aceptado si:**
- [ ] Re-upload reutiliza extracción anterior si existe
- [ ] Gemini no se invoca 2 veces para mismo archivo
- [ ] Campo `ocr_reused_from_previous` se registra en auditoría
- [ ] Test: Upload → Reject → Re-upload → Verificar ocr_reused:true ✅

---

## CRITERIO 3: Auto-confirm OCR:high (Bloqueador OP-004)

**Aceptado si:**
- [ ] Si confidence:high → Auto-cambiar a pending_auth (sin click)
- [ ] Si confidence:medium → Mostrar formulario de confirmación
- [ ] Si confidence:low → Forzar re-fotografía
- [ ] Test: High-confidence OCR → Verificar skip a pending_auth ✅

---

## CRITERIO 4: Sin "relacionar" manual (Fricción FR-001)

**Aceptado si:**
- [ ] Document se relaciona automáticamente al upload
- [ ] Contador NO ve paso de "relacionar"
- [ ] Test: Upload → Verificar expense_attachments.expense_id lleno ✅

---

## CRITERIO 5: Notificaciones al siguiente responsable (Fricción FR-004)

**Aceptado si:**
- [ ] Tabla `notifications` existe
- [ ] Trigger crea notificación al cambiar status:captured
- [ ] Admin ve badge de gastos pendientes
- [ ] Push/email enviado (verificable en logs)
- [ ] Test: Comprador crea gasto → Admin recibe notificación ✅

---

## CRITERIO 6: Cierre automático de póliza (Fricción FR-006)

**Aceptado si:**
- [ ] Póliza tiene `planned_closing_date`
- [ ] Cron job cierra automáticamente si fecha vencida
- [ ] Admin recibe notificación de cierre
- [ ] Test: Crear póliza con fecha X → Verificar cierre en X+1 ✅

---

## CRITERIO 7: Web vs Mobile consistentes (Inconsistencia INCON-*)

**Aceptado si:**
- [ ] Matriz de cobertura web vs mobile completada
- [ ] Funciones core disponibles en ambos
- [ ] Admin functions claramente mobile-only o web-only
- [ ] Documentación clara de "qué funciona en mobile"

---

## CRITERIO 8: CobraCheck verificada (Hallazgo OP-005)

**Aceptado si:**
- [ ] Flujo completo testeado: crear factura → registrar pago → cerrar CxC
- [ ] Cobranza tiene UI clara para:
  - [ ] Consultar cartera
  - [ ] Identificar vencidos
  - [ ] Registrar llamada/WhatsApp/email
  - [ ] Registrar promesa + fecha
  - [ ] Aplicar pago
- [ ] Test: End-to-end cobranza completo ✅

---

## CRITERIO 9: Duplicidades eliminadas (4 hallazgos)

**Aceptado si:**
- [ ] DUP-001 (relacionar doc): Eliminado paso manual
- [ ] DUP-002 (OCR re-run): Reutiliza extracción
- [ ] DUP-003 (validación CFDI): Validar UNA sola vez
- [ ] DUP-004 (categorización): Definir quién categoriza

---

## CRITERIO 10: Operatividad real >= 50%

**Aceptado si:**
- [ ] Flujos COMPLETO + PARCIAL >= 50 / 51 (98%)
- [ ] Bloqueadores operativos = 0
- [ ] Fricciones altas documentadas para próxima fase
- [ ] No hay procesos "sin cierre"

**Métrica:** (Completo + Parcial) / Total >= 50%

---

## TEST SUITE MÍNIMO

| Test | Paso | Resultado |
|------|------|-----------|
| Crear gasto → Autorizar → Cerrar | 1. Comprador captura | ✅ Gasto en BD |
| | 2. Admin autoriza | ✅ status:authorized |
| | 3. Contador revisa | ✅ Puede ver |
| Importar XML → Detectar duplicado | 1. Subir XML 1ª vez | ✅ cfdi_data creado |
| | 2. Subir XML 2ª vez (mismo) | ✅ Error 409 duplicado |
| CxP: Registrar → Pagar → Cerrar | 1. Crear CxP | ✅ status:pending |
| | 2. Registrar pago | ✅ Saldo decrece |
| | 3. Verificar cierre | ✅ status:closed |
| CxC: Crear → Aplicar pago → Cerrar | 1. Crear factura | ✅ status:open |
| | 2. Registrar pago | ✅ Saldo decrece |
| | 3. Verificar cierre | ✅ status:closed |
| Notificación | 1. Comprador crea gasto | ✅ Notification creada |
| | 2. Admin ve badge | ✅ Badge visible |
| | 3. Admin autoriza | ✅ Notificación marcada read |

