# AUDITORÍA BASE 002 — MATRIZ DEPURADA CON NIVELES DE EVIDENCIA
**Reclasificación aplicando metodología E0-E5**

---

## METODOLOGÍA DE EVIDENCIA

| Nivel | Descripción | Ejemplo |
|-------|-------------|---------|
| **E0** | Solo nombre o documentación | "Existe una función edge_function_name.ts" |
| **E1** | Tabla, ruta o componente existe | "Tabla `companies` creada en migración" o "Ruta `/configuracion` visible en Next.js" |
| **E2** | Frontend O backend inspeccionado aisladamente | "Edge Function `xml-parse` valida RFC" pero sin probar desde UI, O "componente React existe" pero sin verificar llamada a API |
| **E3** | Frontend conectado a backend Y persistencia verificada | "UI llama Edge Function → datos persisten en BD", pero sin probar permisos, estados finales, responsables siguientes |
| **E4** | Flujo end-to-end probado | "Usuario A crea gasto → status:captured → se guarda → aparece en listado de B → B puede autorizar" |
| **E5** | Probado con permisos, errores, auditoría | E4 + "usuario sin permisos rechazado" + "usuario C no ve gastos de empresa D" + "audit_log registra acciones" |

**Regla de clasificación:**
- **E0-E3:** PARCIAL, NO VERIFICABLE, NO IMPLEMENTADO, o SIN CIERRE
- **E4-E5:** COMPLETO

---

## ADMINISTRADOR / OWNER (12 FLUJOS)

| ID | Flujo | Reclasificación | Nivel | Razón |
|----|-------|-----------------|-------|-------|
| ADM-001 | Crear empresa | PARCIAL | E2 | Edge Function inspeccionada aisladamente. NO probado: rol `admin` en enum (auditoría técnica dice que falta). NO probado: si `admin` puede ser asignado sin error BD. Contradicción no resuelta. |
| ADM-002 | Configurar empresa | NO VERIFICABLE | E1 | Solo existe ruta; backend no inspeccionado |
| ADM-003 | Invitar usuarios | PARCIAL | E3 | Edge Function probada (crea token, inserta invitación). PERO: envío de email NO VERIFICABLE (dependencia SMTP desconocida). Flujo incompleto sin email confirmado. |
| ADM-004 | Cambiar roles | NO VERIFICABLE | E1 | Solo componente existe; lógica UPDATE no verificada. Punto de entrada desconocido. |
| ADM-005 | Desactivar usuarios | NO VERIFICABLE | E1 | Enum existe; endpoint UPDATE no verificado |
| ADM-006 | Visualizar posición dinero | PARCIAL | E3 | Edge Function probada (calcula saldo). PERO: frontend render y cálculo exacto no inspeccionados. Presume SELECT OK pero no verificado permiso. |
| ADM-007 | Revisar pendientes | NO VERIFICABLE | E1 | Ruta existe; lógica de query NO inspeccionada |
| ADM-008 | Autorizar operaciones | PARCIAL | E3 | Edge Function inspeccionada (UPDATE expenses, INSERT audit). PERO: punto de entrada desde UI NO verificado. ¿Quién ve "Autorizar" botón? ¿Permisos correctos? |
| ADM-009 | Consultar cuentas por cobrar | NO VERIFICABLE | E1 | Tablas existen; queries no verificadas en código |
| ADM-010 | Consultar cuentas por pagar | NO VERIFICABLE | E1 | Tabla existe; endpoint no verificado |
| ADM-011 | Cerrar periodos | NO IMPLEMENTADO | E0 | No existe ruta, componente, función |
| ADM-012 | Exportar información | PARCIAL | E2 | Edge Functions existen; formato Excel no verificado, cierre no claro |

**Subtotal Administrador (verificado desde filas):**
- COMPLETO: 0 | PARCIAL: 5 | NO VERIFICABLE: 6 | NO IMPLEMENTADO: 1 | SIN CIERRE: 0
- Total: 12 ✓

---

## CONTADOR (14 FLUJOS)

| ID | Flujo | Reclasificación | Nivel | Razón |
|----|-------|-----------------|-------|-------|
| CNT-001 | Importar XML | PARCIAL | E2 | Edge Function inspeccionada (parsea XML, valida RFC/UUID). PERO: punto de entrada desde UI (upload handler) NO inspeccionado. ¿Quién invoca `xml-parse`? ¿Permisos? |
| CNT-002 | Importar PDF | NO VERIFICABLE | E1 | Viewer presume; extractor NO existe verificado |
| CNT-003 | Validar CFDI | PARCIAL | E2 | Edge Function inspeccionada (valida estructura local). PERO: NO se verifica con SAT. NO se verifica si `validated:true` bloquea o permite siguiente paso. Validación parcial. |
| CNT-004 | Relacionar documento | NO VERIFICABLE | E1 | Dropdown existe; UPDATE logic NO inspeccionado |
| CNT-005 | Detectar duplicados | PARCIAL | E2 | Edge Function inspeccionada (compara UUID, retorna 409). PERO: flujo "mostrar alerta" y "acción usuario ante duplicado" NO verificados |
| CNT-006 | Clasificar gasto | NO VERIFICABLE | E1 | Dropdown existe; UPDATE no verificado; permisos desconocidos |
| CNT-007 | Registrar compra directa | PARCIAL | E2 | Edge Function existe; flujo desde UI y validaciones NO inspeccionados |
| CNT-008 | Registrar CxP | SIN CIERRE | E1 | Tabla existe; forma de pagar NO clara; cierre NO definido |
| CNT-009 | Registrar CxC | SIN CIERRE | E1 | Tabla existe; forma de cerrar NO definida |
| CNT-010 | Registrar pago | PARCIAL | E1 | Tabla existe; ¿quién invoca? ¿automático o manual? NO claro |
| CNT-011 | Aplicar pago | PARCIAL | E2 | Edge Function existe; ¿cuándo se invoca? ¿automático? ¿manual? ¿qué dispara cierre? NO claro |
| CNT-012 | Conciliar | PARCIAL | E2 | Edge Function existe; matching logic (exacto vs. tolerancia) NO verificado |
| CNT-013 | Cerrar operación | NO VERIFICABLE | E2 | Edge Function inspeccionada Y funciona correctamente. PERO: ¿quién la invoca? ¿cuándo? ¿automático o admin manual? NO VERIFICADO. Función existe; flujo operativo NO. |
| CNT-014 | Generar info contable | NO IMPLEMENTADO | E0 | No existe |

**Subtotal Contador (verificado desde filas):**
- COMPLETO: 0 | PARCIAL: 7 | NO VERIFICABLE: 4 | NO IMPLEMENTADO: 1 | SIN CIERRE: 2
- Total: 14 ✓

---

## COMPRADOR (12 FLUJOS)

| ID | Flujo | Reclasificación | Nivel | Razón |
|----|-------|-----------------|-------|-------|
| CPR-001 | Recibir anticipo | NO IMPLEMENTADO | E1 | Dashboard MUESTRA saldo (lectura); NO hay acción confirmable. Usuario solo ve, no "recibe" activamente. |
| CPR-002 | Registrar compra | PARCIAL | E2 | Edge Function inspeccionada. PERO: ¿punto de entrada real en UI? ¿formulario existe? ¿permisos? NO verificados. |
| CPR-003 | Fotografía de ticket | PARCIAL | E2 | Edge Function inspeccionada (llama Gemini 2.5). PERO: ¿cámara realmente invoca esta función? ¿frontend handler? NO verificado. |
| CPR-004 | Subir ticket | PARCIAL | E2 | `submit-receipt` inspeccionada; RLS presume correcto; flujo desde UI NO verificado |
| CPR-005 | Subir XML | PARCIAL | E2 | `xml-parse` inspeccionada; flujo desde UI NO verificado; permisos desconocidos |
| CPR-006 | Subir PDF | NO VERIFICABLE | E1 | Extractor NO existe; solo storage presume |
| CPR-007 | Confirmar datos | PARCIAL | E1 | Formulario presume; automatización para `confidence:high` NO existe |
| CPR-008 | Corregir datos | PARCIAL | E2 | UPDATE presume; condiciones de estado (`captured`, `pending_auth`, `observed`) inspeccionadas; UX flujo NO probado |
| CPR-009 | Solicitar reembolso | NO VERIFICABLE | E1 | Función existe; ¿quién la invoca? ¿cuándo? ¿trigger automático? NO VERIFICABLE |
| CPR-010 | Atender rechazo | PARCIAL | E2 | Status transition (`observed` → `captured`) inspeccionada; duplicidad OCR identificada; flujo completo NO probado |
| CPR-011 | Volver a enviar | PARCIAL | E2 | Duplicidad OCR verificada (re-procesa); flujo completo NO probado end-to-end |
| CPR-012 | Consultar saldo | PARCIAL | E3 | Cálculo formulado (opening + advances - authorized); PERO: ¿query realmente ejecutada? ¿permisos? ¿UI muestra datos? NO verificados |

**Subtotal Comprador (verificado desde filas):**
- COMPLETO: 0 | PARCIAL: 9 | NO VERIFICABLE: 2 | NO IMPLEMENTADO: 1 | SIN CIERRE: 0
- Total: 12 ✓

---

## RESPONSABLE DE COBRANZA (13 FLUJOS)

| ID | Flujo | Reclasificación | Nivel | Razón |
|----|-------|-----------------|-------|-------|
| CBR-001 | Consultar cartera | NO VERIFICABLE | E1 | Tablas existen; queries NO verificadas |
| CBR-002 | Identificar vencidos | NO VERIFICABLE | E1 | Cálculo `due_date < today` presume; NO probado en código |
| CBR-003 | Priorizar clientes | NO IMPLEMENTADO | E0 | No existe |
| CBR-004 | Registrar llamada | NO VERIFICABLE | E1 | Tabla presume; UI NO existe verificada |
| CBR-005 | Registrar WhatsApp | PARCIAL | E1 | Webhook inspeccionada (inbound); UI cobranza NO existe |
| CBR-006 | Registrar correo | NO IMPLEMENTADO | E0 | No existe |
| CBR-007 | Registrar promesa | NO VERIFICABLE | E1 | Tabla presume; flujo NO verificado |
| CBR-008 | Fecha prometida | NO VERIFICABLE | E1 | Campo presume; lógica NO verificada |
| CBR-009 | Incumplimiento | NO IMPLEMENTADO | E0 | No existe |
| CBR-010 | Pago parcial | PARCIAL | E1 | Edge Function existe; ¿flujo real invocable? ¿permisos? ¿saldo actualiza? NO verificado |
| CBR-011 | Aplicar pago | PARCIAL | E1 | Edge Function existe; ¿cuándo se invoca? ¿manual o auto? ¿cierre? NO VERIFICABLE |
| CBR-012 | Escalar caso | NO IMPLEMENTADO | E0 | No existe |
| CBR-013 | Cerrar cuenta | SIN CIERRE | E1 | Transición presume; lógica NO verificada |

**Subtotal Cobranza (verificado desde filas):**
- COMPLETO: 0 | PARCIAL: 3 | NO VERIFICABLE: 5 | NO IMPLEMENTADO: 4 | SIN CIERRE: 1
- Total: 13 ✓

---

## RESUMEN DEPURADO (Conteos Automatizados Verificados)

### Flujos por categoría (51 total)

| Categoría | Cantidad | % |
|-----------|----------|------|
| COMPLETO | 0 | 0% |
| PARCIAL | 24 | 47.1% |
| NO VERIFICABLE | 17 | 33.3% |
| SIN CIERRE | 3 | 5.9% |
| NO IMPLEMENTADO | 7 | 13.7% |
| **TOTAL** | **51** | **100%** |

### Flujos por nivel de evidencia (51 total)

Nota: Categoría y Evidencia son dimensiones independientes.

| Nivel | Cantidad | Descripción |
|-------|----------|-------------|
| E0 | 6 | Solo nombre/documentación |
| E1 | 25 | Componente/tabla/ruta existe, sin inspección lógica |
| E2 | 16 | Código inspeccionado aisladamente, sin flujo completo |
| E3 | 4 | Frontend → Backend → Persistencia, sin permisos/auditoría/cierre |
| E4 | 0 | Flujo end-to-end probado |
| E5 | 0 | Con permisos, auditoría, errores probados |
| **TOTAL** | **51** | **100%** |

### Operatividad demostrada

| Métrica | Cálculo | Valor |
|---------|---------|-------|
| **Flujos operativos probados** | E4 + E5 | **0 / 51 = 0%** |
| Implementación conectada | E3 + E4 + E5 | 4 / 51 = **7.8%** |
| Existencia técnica | E1 + E2 + E3 + E4 + E5 | 50 / 51 = **98.0%** |
| Requiere verificación/fix | PARCIAL + NO VERIFICABLE + SIN CIERRE | 44 / 51 = **86.3%** |

---

## CONTRADICCIONES VERIFICADAS

### 1. Rol `admin` en ADM-001 — ERROR CONFIRMADO

**Definición del enum (supabase/migrations/20260606000001_init.sql:9):**
```sql
create type member_role as enum ('owner','supervisor','spender','office','accountant');
```

**Uso en create-company (supabase/functions/create-company/index.ts:84):**
```typescript
role: 'admin'  // ← Intenta insertar valor que NO está en enum
```

**Resultado:** Error 500 en BD cuando se intenta crear empresa. El flujo ADM-001 **FALLA EN PRODUCCIÓN**.

**Opciones para corregir:**
1. Agregar `'admin'` al enum: `('owner','supervisor','spender','office','accountant','admin')`
2. Cambiar create-company para usar `'owner'` o `'supervisor'` en lugar de `'admin'`

**Reclasificación:** ADM-001 → BLOQUEADO (E2), No probado end-to-end, fallaría en primera ejecución

**Acción requerida:** Corregir enum O cambiar role asignado ANTES de lanzar.

### 2. CNT-013: Función correcta pero flujo desconocido

**Afirmación anterior:** CNT-013 clasifica como COMPLETO: "Si se invoca, cierra política correctamente"

**Problema:** "¿cuándo se invoca? ¿Quién llama?" NO está resuelto

**Resolución:**
- `close-policy/index.ts` probada en aislamiento: UPDATE policies, calcula closing_balance ✅
- PERO: No existe ningún código que LA INVOQUE verificado
- No hay trigger, ni scheduler, ni endpoint POST desde UI
- Flujo operativo = E0 (función existe pero cómo se usa es desconocido)

**Reclasificación:** CNT-013 → NO VERIFICABLE (E2)

### 3. ADM-003: Email no verificado pero clasificado completo

**Afirmación anterior:** ADM-003 COMPLETO: "email enviado (NO VERIFICABLE si SMTP)"

**Problema:** Si email NO SE VERIFICA, el flujo NO está completo. Invitación sin confirmación no es operativa.

**Resolución:**
- `invite-gastador/index.ts` crea token ✅
- Token se inserta en `invitations` ✅
- Email se presume enviado por Supabase Auth pero NO VERIFICADO

**Reclasificación:** ADM-003 → PARCIAL (E3, bloqueado por SMTP)

---

## CONTRADICCIONES IDENTIFICADAS SIN RESOLVER AÚN

1. **¿Quién ve qué?** Muchos flujos no verifican permisos ni RLS correctas
2. **¿Cuándo se dispara?** Workflows "implied" (CPR-009 reembolsos, CNT-013 cierre) sin código invocador identificado
3. **¿Quién actúa después?** Responsable siguiente presume pero no probado (notificaciones, UI, permisos)
4. **¿Cierre automatizado o manual?** CxP, CxC, Pólizas SIN DEFINICIÓN clara

---

## PRÓXIMA ACCIÓN

**NO INICIAR CORRECCIONES TODAVÍA.**

1. Resolver contradicción enum 'admin': agregar a `member_role` enum o cambiar ADM-001
2. Identificar qué código invoca funciones "implied": CNT-013, CPR-009, etc.
3. Definir cierre explícito para CxP (5 flujos), CxC (5 flujos), Pólizas
4. Especificar: ¿Manual o automático? ¿Quién? ¿Cuándo?

Después de eso, matriz puede re-evaluarse con E3-E4 potenciales.

