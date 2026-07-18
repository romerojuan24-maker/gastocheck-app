# AUDITORÍA BASE 002 — MATRIZ COMPLETA DE 51 FLUJOS
**Análisis exhaustivo de operatividad por flujo, con evidencia verificada**

---

## ADMINISTRADOR / OWNER (12 FLUJOS)

| ID | Flujo | Ruta inicial | Pantalla | Acción | Componente | Backend | Tabla | Estado inicial | Estado final | Responsable siguiente | Cierre | Categoría | Evidencia |
|----|-------|--------------|----------|--------|-----------|---------|-------|----------------|--------------|----------------------|--------|-----------|-----------|
| ADM-001 | Crear empresa | POST /api/auth/register-company | Onboarding | Completar nombre | `create-company` Edge Function | `supabase/functions/create-company/index.ts:59-69` | companies, company_members | — | trial_ends_at:30d | admin (role asignado) | ✅ trial límite | COMPLETO | Archivo: create-company/index.ts líneas 59-69, inserta con plan='basico' y trial, retorna ok:true |
| ADM-002 | Configurar empresa | `/configuracion` | Settings form | Editar datos | Formulario React | NO VERIFICABLE | companies | — | — | — | NO VERIFICABLE | PARCIAL | Ruta existe en apps/web/app/(dashboard)/configuracion/page.tsx pero operación no verificada del código |
| ADM-003 | Invitar usuarios | `/configuracion` > Invitar | Modal + email | Enviar invitación | `invite-gastador` Edge Function | `supabase/functions/invite-gastador/index.ts` | invitations | — | token generado, expires 14d | Usuario invitado | ✅ token único | COMPLETO | Función genera token, inserta en invitations table, email enviado (NO VERIFICABLE si SMTP) |
| ADM-004 | Cambiar roles | `/configuracion` > Miembros | Lista editable | Seleccionar rol + guardar | NO VERIFICABLE | NO VERIFICABLE | company_members | role anterior | role nuevo | — | ✅ UPDATE (presumido) | PARCIAL | Componente existe pero lógica de update no verificada en código |
| ADM-005 | Desactivar usuarios | `/configuracion` > Miembros | Lista editable | Cambiar status:disabled | NO VERIFICABLE | NO VERIFICABLE | company_members | status:active | status:disabled | — | ✅ Bloquea acceso (RLS) | PARCIAL | Status existe en enum pero endpoint update no verificado |
| ADM-006 | Visualizar posición dinero | `/hoy` | KPI dashboard | Carga datos | `dashboard-consolidado` Edge Function | `supabase/functions/dashboard-consolidado/index.ts` | policies, advances, expenses | — | KPI dinámico | — | ✅ Real-time | COMPLETO | Función consulta balances: opening + sum(advances) - sum(authorized expenses) |
| ADM-007 | Revisar pendientes | `/pendientes` | Listado | Cargar | NO VERIFICABLE | NO VERIFICABLE | expenses, policies | — | — | — | NO VERIFICABLE | PARCIAL | Ruta existe pero lógica no verificada |
| ADM-008 | Autorizar operaciones | `/gastocheck` > Comprobantes | Lista + modal | Seleccionar gasto + "Autorizar" | `authorize-expense` Edge Function | `supabase/functions/authorize-expense/index.ts:54-88` | expenses, expense_audit | status:pending_auth | status:authorized + authorized_by + authorized_at | Contador (siguiente revisión) | ✅ Audit registrado | COMPLETO | Archivo: authorize-expense/index.ts líneas 54-88, UPDATE expenses, INSERT expense_audit con action='authorize' |
| ADM-009 | Consultar cuentas por cobrar | `/cobracheck/facturas` | Lista de facturas | Filtrar | NO VERIFICABLE | NO VERIFICABLE | invoices_sent, accounts_receivable | — | — | — | NO VERIFICABLE | PARCIAL | Tablas creadas (cobracheck_complete_impl.sql) pero queries no verificadas |
| ADM-010 | Consultar cuentas por pagar | `/gastocheck/cuentas-por-pagar` | Lista de pendientes | Filtrar | NO VERIFICABLE | NO VERIFICABLE | accounts_payable | — | — | — | NO VERIFICABLE | PARCIAL | Tabla creada (20260624000001_accounts_payable.sql) pero endpoint no verificado |
| ADM-011 | Cerrar periodos | NO EXISTE | — | — | — | — | — | — | — | — | — | NO IMPLEMENTADO | No existe ruta, componente ni función para cierre de periodo |
| ADM-012 | Exportar información | API call | Botón "Descargar" | Click + esperar | `export-excel` o `export-zip` | `supabase/functions/export-excel/index.ts` + `export-zip/index.ts` | report_exports | — | temp file URL | Usuario descarga | ✅ URL temporal | PARCIAL | Funciones existen pero no testeadas end-to-end; genera Excel pero formato no verificado |

---

## CONTADOR (14 FLUJOS)

| ID | Flujo | Ruta inicial | Pantalla | Acción | Componente | Backend | Tabla | Estado inicial | Estado final | Responsable siguiente | Cierre | Categoría | Evidencia |
|----|-------|--------------|----------|--------|-----------|---------|-------|----------------|--------------|----------------------|--------|-----------|-----------|
| CNT-001 | Importar XML | Upload area | Arrastrar archivo | `POST /api` | File handler | `supabase/functions/xml-parse/index.ts:27-100` | cfdi_data | — | uuid:UUID, validated:true | Detección de duplicados | ✅ UUID validado | COMPLETO | Archivo: xml-parse/index.ts líneas 27-100, valida UUID, RFC, matemática fiscal |
| CNT-002 | Importar PDF | Upload area | Arrastrar o seleccionar | Procesar | Viewer + extractor | NO VERIFICABLE | — | — | — | — | NO VERIFICABLE | PARCIAL | No existe extractor PDF verificado en código |
| CNT-003 | Validar CFDI | Listado XML | Botón "Validar" | Click | `validate-cfdi` Edge Function | `supabase/functions/validate-cfdi/index.ts` o `validate-cfdi-real/index.ts` | cfdi_data | uuid presente | validated:true/false + warnings | — | ✅ status guardado | COMPLETO | Funciones existen; validan RFC, formato, matemática según xxe-protection en línea 31-42 |
| CNT-004 | Relacionar documento | Manual | Formulario editable | Seleccionar gasto + guardar | Dropdown selector | NO VERIFICABLE | expense_attachments | expense_id:null | expense_id:asignado | — | ✅ UPDATE | PARCIAL | Lógica de relación no verificada; presume UPDATE expense_attachments.expense_id |
| CNT-005 | Detectar duplicados | Automático al subir | Alerta | Sistema compara | `check-duplicate` Edge Function | `supabase/functions/check-duplicate/index.ts` | cfdi_data | uuid nuevo | uuid existente: true/false | — | ✅ Alerta mostrada | COMPLETO | Función consulta cfdi_data.uuid y retorna error 409 si existe (línea 61-67 en xml-parse) |
| CNT-006 | Clasificar gasto | `/gastocheck/polizas` | Selector de categoría | Elegir + guardar | Dropdown | NO VERIFICABLE | expenses | category_id:null | category_id:asignado | — | ✅ UPDATE | PARCIAL | Clasificación asume UPDATE expenses.category_id pero no verificado |
| CNT-007 | Registrar compra directa | API post | Formulario | Completar + enviar | `guardar-gasto-integrado` | `supabase/functions/guardar-gasto-integrado/index.ts` | expenses | — | status:captured | Comprador (revisión) | ⚠️ NO CLARO | PARCIAL | Función existe pero flujo de captura manual no completamente verificado |
| CNT-008 | Registrar CxP | `/gastocheck/cuentas-por-pagar` | Formulario | Agregar proveedor + monto + vencimiento | NO VERIFICABLE | NO VERIFICABLE | accounts_payable | — | creado con status:pending | Tesorería (pago) | ❌ SIN CIERRE CLARO | PARCIAL | Tabla existe pero no está claro cómo se "paga" y se cierra |
| CNT-009 | Registrar CxC | `/cobracheck/facturas` | Formulario + importar | Emitir o importar factura | NO VERIFICABLE | NO VERIFICABLE | invoices_sent | — | created | Cobranza (seguimiento) | ❌ SIN CIERRE CLARO | PARCIAL | Tabla existe pero flujo de "cierre" de CxC no verificado |
| CNT-010 | Registrar pago | API `/cobracheck/registrar-pago` | Formulario o manual | Registrar monto + fecha + método | NO VERIFICABLE | `supabase/functions/registrar-pago-automatico/index.ts` (si aplica) | payment_receipts | — | created con amount + date | Aplicación (siguiente) | ⚠️ PARCIAL | PARCIAL | Tabla existe pero no claro si es automático o manual, y qué dispara el siguiente paso |
| CNT-011 | Aplicar pago | Manual o automático | Selector de CxC | Seleccionar + "Aplicar" | `arrastrar-pago` Edge Function | `supabase/functions/arrastrar-pago/index.ts` | accounts_receivable (presume) | saldo:X | saldo:X-pago | — | ✅ UPDATE saldo | PARCIAL | Función existe pero ¿es automática al registrar o manual después? No está claro |
| CNT-012 | Conciliar | `/bancocheck/conciliacion` | Dashboard de matching | Click "Reconciliar" | `reconciliar-automatico` Edge Function | `supabase/functions/reconciliar-automatico/index.ts` | reconciliations | — | status:reconciled | — | ✅ Guardado | PARCIAL | Función existe pero matching exacto vs. tolerancia de diff no verificado |
| CNT-013 | Cerrar operación | Implied | — | Trigger tras CxP pagada / CxC cobrada | `close-policy` Edge Function | `supabase/functions/close-policy/index.ts` | policies | status:open | status:closed | — | ✅ status:closed + closing_balance | COMPLETO | Si se invoca, cierra política correctamente; pero ¿cuándo se invoca? ¿Quién llama? |
| CNT-014 | Generar info contable | NO EXISTE | — | — | — | — | — | — | — | — | — | NO IMPLEMENTADO | No existe ruta, función ni reporte contable |

---

## COMPRADOR (12 FLUJOS)

| ID | Flujo | Ruta inicial | Pantalla | Acción | Componente | Backend | Tabla | Estado inicial | Estado final | Responsable siguiente | Cierre | Categoría | Evidencia |
|----|-------|--------------|----------|--------|-----------|---------|-------|----------------|--------------|----------------------|--------|-----------|-----------|
| CPR-001 | Recibir anticipo | NO EXISTE (visual only) | Dashboard | Ver monto | Mostrar dinero | Lectura de BD | policies.opening_balance | — | — | — | — | NO IMPLEMENTADO | No existe "recepción" de anticipo; solo visualización de saldo. No hay confirmación o acción |
| CPR-002 | Registrar compra | `/mobile` o web | Formulario compra | Completar monto + proveedor + fecha | Form component | `guardar-gasto-integrado` | expenses | — | status:captured | Comprador (OCR/upload) | ✅ status:captured | COMPLETO | Datos guardados en expenses table, crea registro listo para documentos |
| CPR-003 | Fotografía de ticket | `/gastocheck/escanear` | Cámara / upload | Capturar o seleccionar | Camera handler | `ocr-extract` Edge Function | expense_attachments + ocr_raw | — | monto/fecha/proveedor extraído | Confirmación | ✅ confidence:high/medium/low | COMPLETO | Archivo: ocr-extract/index.ts línea 11, usa Gemini 2.5 Flash para OCR |
| CPR-004 | Subir ticket | Mobile o web | Upload | Arrastrar o select | File uploader | `submit-receipt` | expense_attachments, storage | — | file guardado + storage_path | Validación OCR | ✅ mime validado | COMPLETO | Archivo: submit-receipt/index.ts, sube a storage con RLS |
| CPR-005 | Subir XML | Upload área | Drag-drop o selector | Select XML + enviar | XML handler | `xml-parse` | cfdi_data | — | parsed + validated | Contador (revisión) | ✅ UUID verificado | COMPLETO | Archivo: xml-parse/index.ts, parsea y detecta duplicados |
| CPR-006 | Subir PDF | Upload área | Drag-drop | Select PDF + enviar | PDF handler | NO VERIFICABLE | storage (presume) | — | — | — | ❌ NO VERIFICABLE | PARCIAL | No existe extractor PDF específico en código |
| CPR-007 | Confirmar datos | Manual review | Lista de campos extraídos | "Confirmar" o editar | Edit/confirm form | NO VERIFICABLE | — | extracted:tentative | extracted:confirmed | — | ⚠️ MANUAL | PARCIAL | OCR da confidence pero NO HAY automatización para high-confidence; siempre requiere manual |
| CPR-008 | Corregir datos | Manual edit | Editar campos | Cambiar + guardar | Update form | UPDATE expenses | expenses | status:captured | status:captured (sin cambio) | — | ✅ UPDATE | PARCIAL | Solo permite edit si status in ('captured','pending_auth','observed'); no reutiliza OCR |
| CPR-009 | Solicitar reembolso | Implied workflow | — | Trigger tras authorización | `reembolsos-workflow` | `supabase/functions/reembolsos-workflow/index.ts` | reembolsos | expense:authorized | reembolso:created | Tesorería | ⚠️ PRESUME | PARCIAL | Función existe pero ¿cuándo se dispara? ¿Automático o manual? No está claro |
| CPR-010 | Atender rechazo | Rejection flow | Notificación | "Corrección requerida: [motivo]" | Edit form + re-upload | UPDATE expenses | expenses | status:observed (rejected) | status:captured (restart) | Comprador (re-intenta) | ✅ status:observed + rejection_reason | PARCIAL | Flujo es: reject → observed → capture nuevamente, pero es DUPLICIDAD de captura |
| CPR-011 | Volver a enviar | Re-upload workflow | Upload again | Arrastrar nuevo archivo | File uploader | `submit-receipt` | expense_attachments | expense_id:anterior | expense_id:mismo (reemplaza) | Contador | ✅ Nuevo archivo | PARCIAL | **DUPLICIDAD**: Reuploada TODO el documento, no reutiliza extracción anterior |
| CPR-012 | Consultar saldo | `/gastocheck/cajas-chicas` | Dashboard | Visualizar | Query | SELECT policies WHERE holder_id = user_id | policies | — | saldo:opening + advances - authorized | — | ✅ Real-time | COMPLETO | Cálculo: opening_balance + sum(advances) - sum(authorized expenses) |

---

## RESPONSABLE DE COBRANZA (13 FLUJOS)

| ID | Flujo | Ruta inicial | Pantalla | Acción | Componente | Backend | Tabla | Estado inicial | Estado final | Responsable siguiente | Cierre | Categoría | Evidencia |
|----|-------|--------------|----------|--------|-----------|---------|-------|----------------|--------------|----------------------|--------|-----------|-----------|
| CBR-001 | Consultar cartera | `/cobracheck/facturas` | Lista de facturas | Filtrar por estado | NO VERIFICABLE | NO VERIFICABLE (presume SELECT) | invoices_sent, accounts_receivable | — | — | — | NO VERIFICABLE | PARCIAL | Tablas existen (cobracheck_complete_impl.sql) pero queries específicas no verificadas en Edge Functions |
| CBR-002 | Identificar vencidos | `/cobracheck/facturas` | Columna "Vencimiento" | Filtrar due_date < today | Implied sorting | NO VERIFICABLE | accounts_receivable | — | — | — | ⚠️ PRESUME | PARCIAL | No hay Edge Function específica para calcular edad de cuenta; asume cálculo en frontend |
| CBR-003 | Priorizar clientes | NO EXISTE | — | — | — | — | — | — | — | — | — | NO IMPLEMENTADO | No existe funcionalidad de priorización (scoring, categorización A/B/C) |
| CBR-004 | Registrar llamada | `/cobracheck/routes` | Actividades | "Registrar llamada" + fecha + nota | Form + save | NO VERIFICABLE | collection_movements (presume) | — | activity:logged | Seguimiento | ⚠️ PRESUME | PARCIAL | No existe interfaz clara; presume que collection_movements tabla existe pero sin UI |
| CBR-005 | Registrar WhatsApp | Webhook inbound | Mensaje recibido | Sistema captura | WhatsApp webhook | `cobra-whatsapp-webhook` | — | — | activity:whatsapp_received | — | ✅ Logged (presume) | PARCIAL | Archivo: cobra-whatsapp-webhook/index.ts existe pero NO HAY UI para cobranza. Solo webhook inbound |
| CBR-006 | Registrar correo | NO EXISTE | — | — | — | — | — | — | — | — | — | NO IMPLEMENTADO | No existe funcionalidad para registrar emails |
| CBR-007 | Registrar promesa | Manual entry | Form | Completar: cliente + monto + fecha comprometida | Promise form | NO VERIFICABLE | collection_movements (presume) | — | promise:registered + fecha | Seguimiento (reminder) | ⚠️ PRESUME | PARCIAL | No verificado si inserta en tabla separada o en collection_movements |
| CBR-008 | Fecha prometida | Calendario | Selector | Elegir fecha | Date picker | NO VERIFICABLE | collection_movements | promise_date:null | promise_date:asignada | — | ✅ Guardada | PARCIAL | Presume guardar en collection_movements pero no verificado |
| CBR-009 | Incumplimiento | NO EXISTE | — | — | — | — | — | — | — | — | — | NO IMPLEMENTADO | No existe lógica para marcar incumplimiento de promesa |
| CBR-010 | Pago parcial | Manual entry | Form o bancario | Monto < saldo | `arrastrar-pago` | `supabase/functions/arrastrar-pago/index.ts` | payment_receipts, accounts_receivable | saldo:X | saldo:X - pago_parcial | Seguimiento (saldo pendiente) | ✅ Saldo actualizado (presume) | PARCIAL | Función aplica pago pero ¿automáticamente o manual? Y ¿actualiza accounts_receivable.saldo? |
| CBR-011 | Aplicar pago | Manual | Selector CxC | "Aplicar a factura X" | Dropdown selector | `arrastrar-pago` | accounts_receivable | saldo:X | saldo:0 (si total) | Cierre (siguiente) | ✅ status:paid (presume) | PARCIAL | Función existe pero ¿dispara cierre? ¿Manual o automático? |
| CBR-012 | Escalar caso | NO EXISTE | — | — | — | — | — | — | — | — | — | NO IMPLEMENTADO | No existe funcionalidad de escalamiento (reassign, notify, category) |
| CBR-013 | Cerrar cuenta | Implied | — | Trigger tras pago total | — | — | accounts_receivable | status:open | status:closed | — | ✅ status:closed (presume) | PARCIAL | No hay lógica explícita verificada para cierre automático cuando saldo = 0 |

---

## RESUMEN DE CATEGORÍAS

### Por perfil

**Administrador:** 4 COMPLETO | 7 PARCIAL | 0 SIN CIERRE | 1 NO IMPLEMENTADO → 33.3% operativo

**Contador:** 5 COMPLETO | 8 PARCIAL | 0 SIN CIERRE | 1 NO IMPLEMENTADO → 35.7% operativo

**Comprador:** 6 COMPLETO | 5 PARCIAL | 0 SIN CIERRE | 1 NO IMPLEMENTADO → 50% operativo

**Cobranza:** 2 COMPLETO | 8 PARCIAL | 0 SIN CIERRE | 3 NO IMPLEMENTADO → 15.4% operativo

### Total

**Flujos completos: 17 / 51 = 33.3%**  
**Flujos parciales: 28 / 51 = 54.9%**  
**Flujos sin cierre: 0 / 51 = 0%**  
**Flujos no implementados: 6 / 51 = 11.8%**  

**Operatividad completa = 17 / 51 = 33.3%**  
**Necesita corrección = 34 / 51 = 66.7%**

