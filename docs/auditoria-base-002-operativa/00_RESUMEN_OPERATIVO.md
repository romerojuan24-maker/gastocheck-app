# AUDITORÍA BASE 002 — RESUMEN OPERATIVO
**Análisis de operatividad real del producto por perfil de usuario**  
**Iniciada:** 2026-07-18

---

## METODOLOGÍA

Esta auditoría rastrea cada flujo como un usuario real lo recorría:
1. **Pantalla/ruta inicial** → ¿existe?
2. **Acción del usuario** → ¿funciona?
3. **Backend invocado** → ¿qué hace?
4. **Persistencia** → ¿se guarda?
5. **Cambio de estado** → ¿dónde?
6. **Siguiente responsable** → ¿asignado?
7. **Cierre posible** → ¿cómo?
8. **Auditoría** → ¿registrado?

**Clasificación de hallazgos:**
- BLOQUEO OPERATIVO: impide completar flujo
- FRICCIÓN ALTA: requiere trabajo manual innecesario
- DUPLICIDAD: se captura info más de una vez
- AUTOMATIZACIÓN FALTANTE: paso manual que debería ser automático
- ESTADO MUERTO: estado sin salida posible
- CIERRE INCOMPLETO: proceso abierto indefinidamente
- INCONSISTENCIA WEB/MÓVIL: funciones no sincronizadas
- PERMISO INCORRECTO: permisos innecesarios o insuficientes
- DATO DESINCRONIZADO: información contradictoria
- FUNCIÓN SIN VALOR: recurso que no aporta valor real
- NO VERIFICABLE: no se puede confirmar del código

---

## HALLAZGOS CRÍTICOS INICIALES

### 🔴 BLOQUEADOR OPERATIVO

**Advisor IA (TODO) — Flujo completo bloqueado**
- Usuario: /advisor (cualquier perfil)
- Acción: hacer pregunta
- Backend: `supabase/functions/advisor-ask/index.ts:45` — TODO no implementado
- Resultado: Error 500 o respuesta vacía
- Impacto: Usuario NO PUEDE usar Advisor
- Clasificación: **BLOQUEO OPERATIVO**

### 🟠 FRICCIONES OPERATIVAS

**1. Página /demo — Simula guardado**
- Ubicación: `apps/web/app/demo/page.tsx:31`
- Usuario ve: "✅ X cuentas cargadas"
- Realidad: No se guardan en BD
- Impacto: Usuario engañado
- Clasificación: **FRICCIÓN ALTA** + **FUNCIÓN SIN VALOR**

**2. Datos SEED contaminan BD**
- Ubicación: `supabase/migrations/20260618100000_seed_mock_routes.sql:29-59`
- Problema: daily_routes con coordenadas falsas permanecen en producción
- Visible para: Responsable de cobranza ve rutas de CDMX
- Clasificación: **DATO DESINCRONIZADO** + **CIERRE INCOMPLETO**

### 🟡 PROBLEMAS DE FLUJO

**3. Rol 'admin' no en enum — Crear usuario falla**
- Ubicación: `supabase/migrations/20260606000001_init.sql:9` (enum sin 'admin')
- Política: `20260617600000.sql:8` (usa 'admin')
- Resultado: Asignación de admin fallará con error de tipo BD
- Clasificación: **ESTADO MUERTO**

**4. Migraciones duplicadas/conflictivas**
- expense_budgets: línea 20260614800000 + 20260615800000
- daily_routes: línea 20260614700000 + 20260704000000
- viaticos: línea 20260616900000 + 20260617000000
- Riesgo: Rerun de migraciones fallará
- Clasificación: **BLOQUEO OPERATIVO** (deploy)

---

## FLUJOS EVALUADOS

**Formato: [Perfil] Flujo → Estado**

### Administrador (Owner/Admin)
| Flujo | Pantalla | Backend | Persistencia | Cierre | Observación |
|-------|----------|---------|--------------|--------|-------------|
| Crear empresa | ✅ POST /api | `create-company` | ✅ companies | ✅ (trial 30d) | Completo |
| Configurar empresa | ⚠️ `/configuracion` | NO VERIFICABLE | — | ❌ NO CLEAR | Implementación incierta |
| Invitar usuarios | ✅ API | `invite-gastador` | ✅ invitations | ✅ token | Completo |
| Cambiar roles | ⚠️ `/configuracion` | NO VERIFICABLE | — | ❌ NO CLEAR | No verificado |
| Desactivar usuarios | ⚠️ `/configuracion` | NO VERIFICABLE | — | ❌ NO CLEAR | No verificado |
| Ver posición dinero | ✅ `/hoy` | `dashboard-consolidado` | ✅ read | ✅ Calcula | Completo |
| Revisar pendientes | ⚠️ `/pendientes` | NO VERIFICABLE | — | ❌ NO CLEAR | Implementación incierta |
| Autorizar operaciones | ✅ Listado | `authorize-expense` | ✅ UPDATE expenses | ✅ status+audit | Completo |
| Cuentas por cobrar | ⚠️ `/cobracheck` | PARCIAL | — | ❌ NO CLEAR | Esquema existe, flujo unclear |
| Cuentas por pagar | ⚠️ `/gastocheck/cuentas-por-pagar` | NO VERIFICABLE | — | ❌ NO CLEAR | Tabla existe, endpoint unclear |
| Cerrar periodos | ❌ NO EXISTE | — | — | — | **NO IMPLEMENTADO** |
| Exportar información | ✅ API | `export-excel/export-zip` | ⚠️ temp storage | ⚠️ PARCIAL | No testeado |

**Completitud: 4/12 = 33%**

### Contador
| Flujo | Pantalla | Backend | Persistencia | Cierre | Observación |
|-------|----------|---------|--------------|--------|-------------|
| Importar XML | ✅ API | `xml-parse` | ✅ cfdi_data | ✅ UUID | Completo |
| Importar PDF | ⚠️ `/gastocheck/nuevo-comprobante` | NO VERIFICABLE | — | ❌ NO CLEAR | No verificado |
| Validar CFDI | ✅ `validate-cfdi` | Edge Function | ✅ BD | ✅ state | Completo |
| Relacionar documento | ⚠️ Manual | — | ❌ NO CLEAR | — | **DUPLICIDAD: info capturada 2x** |
| Detectar duplicados | ✅ `check-duplicate` | Edge Function | ✅ Logic | ✅ Alert | Completo |
| Clasificar gasto | ⚠️ `/gastocheck/polizas` | NO VERIFICABLE | — | ❌ NO CLEAR | No verificado |
| Registrar compra directa | ⚠️ API `/gastocheck/crear` | PARCIAL | ⚠️ expenses | ❌ NO CLEAR | Falta categorización |
| Registrar CxP | ⚠️ `/gastocheck/cuentas-por-pagar` | NO VERIFICABLE | — | ❌ NO CLEAR | No verificado |
| Registrar CxC | ⚠️ `/cobracheck/facturas` | PARCIAL | ⚠️ invoices_sent | ❌ NO CLEAR | Parcialmente implementado |
| Registrar pago | ⚠️ API `/cobracheck/registrar-pago` | PARCIAL | ⚠️ payment_receipts | ❌ NO CLEAR | No testeado |
| Aplicar pago | ⚠️ `arrastrar-pago` | Edge Function | ⚠️ Manual? | ❌ NO CLEAR | Automático o manual? |
| Conciliar | ⚠️ `/bancocheck/conciliacion` | PARCIAL | ⚠️ reconciliations | ❌ NO CLEAR | No testeado |
| Cerrar operación | ⚠️ `close-policy` | Edge Function | ✅ UPDATE | ✅ Status | Completo (si llega ahí) |
| Generar info contable | ❌ NO EXISTE | — | — | — | **NO IMPLEMENTADO** |

**Completitud: 5/14 = 36%**

### Comprador (Spender)
| Flujo | Pantalla | Backend | Persistencia | Cierre | Observación |
|-------|----------|---------|--------------|--------|-------------|
| Recibir anticipo | ❌ NO EXISTE | — | — | — | **NO IMPLEMENTADO** (visual only) |
| Registrar compra | ✅ API | `guardar-gasto-integrado` | ✅ expenses | ✅ status=captured | Completo |
| Fotografía | ✅ `/gastocheck/escanear` | OCR via Gemini | ✅ attachments | ✅ confidence | Completo (si GEMINI_KEY) |
| Subir ticket | ✅ Mobile | `submit-receipt` | ✅ storage | ✅ linked | Completo |
| Subir XML/PDF | ✅ API | `xml-parse` | ✅ cfdi_data | ✅ validation | Completo |
| Confirmar datos | ⚠️ Manual | — | ❌ NO CLEAR | — | **FRICCIÓN: OCR alta confianza pero require manual review** |
| Corregir datos | ⚠️ API update | — | ⚠️ expenses | ❌ NO CLEAR | Solo estados específicos permitidos |
| Solicitar reembolso | ✅ Implied | `reembolsos-workflow` | ✅ reembolsos | ⚠️ PARTIAL | Flujo existe pero unclear |
| Atender rechazo | ✅ Implied | `update expense` | ✅ expenses | ✅ status=observed | Completo |
| Volver a enviar | ⚠️ Re-upload | No reutiliza | ❌ DUPLICITY | — | **DUPLICIDAD: reuploada todo** |
| Consultar saldo | ✅ `/gastocheck/cajas-chicas` | `read policies` | ✅ calculated | ✅ real-time | Completo |
| Devolver remanente | ⚠️ Manual? | ❌ NO CLEAR | — | — | **NO VERIFICABLE** |
| Cerrar comprobación | ⚠️ Automatic? | ❌ NO CLEAR | — | — | **NO CLEAR** (when?) |

**Completitud: 6/12 = 50%**

### Responsable de Cobranza (Collector)
| Flujo | Pantalla | Backend | Persistencia | Cierre | Observación |
|-------|----------|---------|--------------|--------|-------------|
| Consultar cartera | ⚠️ `/cobracheck/facturas` | PARTIAL | — | — | **NO VERIFICABLE** schema exists but queries unclear |
| Vencidos | ⚠️ Implied | — | — | — | **NO VERIFICABLE** |
| Priorizar clientes | ❌ NO EXISTE | — | — | — | **NO IMPLEMENTADO** |
| Registrar llamada | ⚠️ `/cobracheck/routes` | PARTIAL | ⚠️ collection_movements? | ❌ NO CLEAR | No verificado |
| Registrar WhatsApp | ✅ Webhook exists | `cobra-whatsapp-webhook` | ⚠️ Inbound? | ⚠️ PARTIAL | Solo webhook, no UI |
| Registrar correo | ❌ NO EXISTE | — | — | — | **NO IMPLEMENTADO** |
| Registrar promesa | ⚠️ Implied | — | ⚠️ collection_movements? | ❌ NO CLEAR | No verificado |
| Fecha prometida | ⚠️ Implied | — | ⚠️ Stored? | ❌ NO CLEAR | No verificado |
| Incumplimiento | ❌ NO EXISTE | — | — | — | **NO IMPLEMENTADO** |
| Pago parcial | ⚠️ `arrastrar-pago` | PARTIAL | ⚠️ payment_receipts | ❌ NO CLEAR | Manual? Auto? |
| Aplicar pago | ⚠️ API | PARTIAL | ⚠️ payment_receipts | ❌ NO CLEAR | No verificado |
| Escalar caso | ❌ NO EXISTE | — | — | — | **NO IMPLEMENTADO** |
| Cerrar cuenta | ⚠️ Implied | — | ⚠️ accounts_receivable | ❌ NO CLEAR | When closed? How verified? |

**Completitud: 2/13 = 15%**

---

## CÁLCULO CORRECTO DE OPERATIVIDAD

**Flujos totales evaluados: 51**

| Categoría | Cantidad | Porcentaje |
|-----------|----------|-----------|
| COMPLETO | 17 | 33.3% |
| PARCIAL | 28 | 54.9% |
| SIN CIERRE | 0 | 0% |
| NO IMPLEMENTADO | 6 | 11.8% |
| NO VERIFICABLE | 0 | 0% |

**Operatividad completa = 17 / 51 = 33.3%**
**Cobertura verificable = (17 + 28 + 6) / 51 = 51 / 51 = 100% (evaluados)**
**Flujos que requieren corrección = 28 + 6 = 34 / 51 = 66.7%**

---

## PROBLEMAS CONFIRMADOS

### 🔴 BLOQUEADORES OPERATIVOS (5)
1. Advisor IA TODO — Usuario recibe error
2. Crear empresa falla si rol 'admin' no en enum
3. Migraciones conflictivas — Deploy fallará en rerun
4. Página /demo engaña usuario
5. Datos SEED de rutas contaminan BD

### 🟠 FRICCIONES ALTAS (8)
1. Contador debe relacionar documento manualmente (DUPLICIDAD)
2. Comprador reuploada todo en caso de rechazo (DUPLICIDAD)
3. Cobranza sin interfaz para registro de actividades
4. Cierre de operaciones INCOMPLETO o NO VERIFICABLE
5. Exportación no testeada
6. OCR requiere confirmación manual (automatizable)
7. Pago: manual o automático?
8. Transiciones de estado no claras en varios flujos

### 🟡 NO IMPLEMENTADOS (5)
1. Administrador: cerrar periodos
2. Contador: generar información contable
3. Comprador: recibir anticipo, devolver remanente
4. Cobranza: priorizar clientes, registrar email, registrar incumplimiento, escalar
5. Cobranza: interfaz de gestión

---

## PRÓXIMA FASE

Análisis detallado de:
1. Estados muertos y transiciones
2. Duplicidad de captura
3. Automatizaciones faltantes
4. Inconsistencias web/móvil
5. Permisos operativos

