# Prompt para ChatGPT — Validación de Diseño vs Código

Copia este prompt completo y pégalo en ChatGPT. Luego adjunta los archivos que te pida.

---

## PROMPT PARA CHATGPT

```
SOY JUAN, PRODUCT MANAGER DE GASTOCHECK (APP SAAS DE CONTROL DE GASTOS).

He diseñado una aplicación completa y ahora quiero validar que TODO está codificado correctamente. 
Te paso el DISEÑO y el CÓDIGO. Por favor, haz una auditoría detallada.

---

## DISEÑO ORIGINAL (GastoCheck)

**PRODUCTO:**
- App móvil (React Native/Expo) + dashboard web (Next.js) + backend Supabase
- Control de anticipos, gastos, saldos, pólizas, autorización, reportes
- Multi-tenant (una BD, aislamiento por company_id con RLS)

**ARQUITECTURA TÉCNICA:**
1. Móvil: Expo SDK 54 + React Native + TypeScript
2. Web: Next.js 15 + Tailwind + shadcn/ui
3. Compartido: packages/shared (tipos, lógica de saldos, máquina de estados)
4. Backend: Supabase (Postgres + Auth + Storage + Edge Functions)
5. OCR: Claude Vision (Edge Function /ocr-extract)
6. XML: Parser CFDI (Edge Function /xml-parse)
7. Reportes: Excel (exceljs), ZIP (jszip)
8. WhatsApp: Meta Cloud API

**MODELO DE BASE DE DATOS:**
Tablas:
- companies (tenant)
- company_members (usuarios con roles)
- profiles (extiende auth.users)
- expense_categories
- cost_centers
- accounting_accounts (catálogo contable)
- policies (pólizas por persona)
- advances (anticipos/transferencias)
- expenses (gastos)
- cfdi_data (datos XML)
- expense_attachments (tickets/PDFs)
- expense_audit (historial inmutable)
- invitations
- report_exports

Enums:
- member_role: owner, supervisor, spender, office, accountant
- expense_status: captured, pending_auth, authorized, pending_invoice, invoice_applied, observed, rejected, deleted, duplicate, closed_in_policy
- policy_status: open, closed

RLS: Habilitado, aislamiento por company_id

**ROLES Y PERMISOS:**
- Owner: todo
- Supervisor: crear categorías/centros, autorizar, cerrar póliza (opcional)
- Spender: subir comprobantes, ver sus gastos/saldo
- Office: registrar anticipos, subir comprobantes, ligar facturas
- Accountant: ver todo, configurar catálogo

**FLUJO PRINCIPAL:**
1. Empresa entrega dinero → registra anticipio (advances)
2. Empleado sube comprobante (foto/XML/PDF)
3. IA/OCR extrae información
4. Usuario confirma datos
5. Supervisor autoriza (✅) o rechaza (❌)
6. Se descuenta del saldo
7. Oficina puede ligar factura XML después
8. Dueño cierra póliza → genera nueva encadenada
9. App genera Excel/ZIP → envía por WhatsApp al contador

**LÓGICA DE SALDOS:**
saldo_disponible = opening_balance + Σ advances − Σ gastos(authorized+invoice_applied)
saldo_por_comprobar = Σ gastos(captured+pending_auth+observed)

Cierre de póliza: closing_balance = saldo_disponible en el momento; nueva_póliza.opening = closing_anterior

**MÁQUINA DE ESTADOS DEL GASTO:**
captured → pending_auth → authorized → invoice_applied → closed_in_policy
                     ↓
                  rejected
                     ↓
                  observed

**PANTALLAS MÓVILES:**
1. Inicio: Mi saldo (con desglose opening, advances, autorizados, disponible)
2. Captura: tomar foto/subir archivo, confirmar datos detectados
3. Mis gastos: lista con estatus visual
4. Detalle: imagen + datos + opciones
5. Mis pólizas: abiertas/cerradas

**PANTALLAS WEB:**
1. Resumen: KPIs (anticipos, autorizados, pendientes, por comprobar)
2. Gastos: tabla filtrable (empleado, categoría, centro, periodo)
3. Autorización: bandeja de pendientes con ✅/❌ en lote
4. Pólizas: abrir/cerrar
5. Catálogo contable: owner + accountant
6. Centros de costo: gestión
7. Usuarios: invitar + roles
8. Reportes: generar + exportar

**EDGE FUNCTIONS:**
1. /ocr-extract: foto → Claude Vision → {total, iva, fecha, proveedor, conceptos, confidence}
2. /xml-parse: CFDI → datos fiscales estructurados
3. /authorize-expense: cambiar status (authorized/rejected), audit, recalcular saldo
4. /export-excel: generar reporte clasificado
5. /export-zip: empaquetar Excel+XML+PDFs+tickets
6. /send-whatsapp: enviar por WhatsApp Business

---

## CÓDIGO ENTREGADO (HOY)

**Ruta:** C:\Users\admin\Documents\gastocheck-app
**Commits:** 4
**Estado:** Supabase conectado, BD live, ocr-extract deployada, web+móvil conectados

**Archivos principales:**
- docs/DISENO.md (este diseño)
- supabase/migrations/0001_init.sql (BD completa)
- apps/web/* (Next.js dashboard)
- apps/mobile/* (Expo)
- packages/shared/src/* (tipos + lógica)
- supabase/functions/ocr-extract/index.ts (Edge Function OCR)

---

## TU TAREA (VALIDACIÓN)

Por favor, haz una auditoría completa:

### 1. MODELO DE BD
- [ ] ¿Existen todas las 14 tablas mencionadas?
- [ ] ¿Están los enums correctos (member_role, expense_status, policy_status)?
- [ ] ¿RLS habilitado en todas las tablas?
- [ ] ¿Triggers de cálculo de saldo (closing_balance)?
- [ ] ¿Historial inmutable (expense_audit)?
- [ ] ¿Funciones de autorización (auth_is_member, auth_role, auth_can_authorize)?

### 2. TIPOS COMPARTIDOS (packages/shared/src/types.ts)
- [ ] ¿Tipos TypeScript para todas las entidades?
- [ ] ¿Enums correctos en TypeScript?
- [ ] ¿Interfaz PolicyBalance para cálculos?

### 3. LÓGICA DE SALDOS (packages/shared/src/balance.ts)
- [ ] ¿Función computeBalance(policy, advances, expenses) implementada?
- [ ] ¿Cálculo correcto de available, pendingToVerify?
- [ ] ¿Función closingBalance()?

### 4. MÁQUINA DE ESTADOS (si existe)
- [ ] ¿Transiciones correctas del estatus del gasto?
- [ ] ¿Validaciones (ej: no pasar de captured a invoice_applied sin pasar por authorized)?

### 5. APP MÓVIL (apps/mobile/)
- [ ] ¿Pantalla de inicio con saldo desglosado?
- [ ] ¿Pantalla de captura (foto) con hook useOcr?
- [ ] ¿Integración con /ocr-extract Edge Function?
- [ ] ¿Pantalla de "Mis gastos" con lista?
- [ ] ¿Pantalla de "Mis pólizas"?
- [ ] ¿Conexión a Supabase (cliente)?

### 6. WEB DASHBOARD (apps/web/)
- [ ] ¿Resumen con KPIs?
- [ ] ¿Tabla de gastos filtrable?
- [ ] ¿Bandeja de autorización con ✅/❌?
- [ ] ¿Gestión de pólizas (abrir/cerrar)?
- [ ] ¿Catálogo contable?
- [ ] ¿Centros de costo?
- [ ] ¿Usuarios + invitaciones?

### 7. EDGE FUNCTIONS
- [ ] ¿/ocr-extract deployada con Claude Vision?
- [ ] ¿/xml-parse comenzada?
- [ ] ¿/authorize-expense comenzada?
- [ ] ¿Variables de entorno configuradas (ANTHROPIC_API_KEY)?

### 8. AUTENTICACIÓN Y RLS
- [ ] ¿Auth con Supabase?
- [ ] ¿RLS por company_id?
- [ ] ¿Spender solo ve sus gastos?
- [ ] ¿Owner ve todo?

### 9. ROADMAP Y DOCUMENTACIÓN
- [ ] ¿Documentación clara (DISENO.md)?
- [ ] ¿Roadmap definido?
- [ ] ¿Setup instructions para Supabase?

---

## PROBLEMAS A REPORTAR

Si encuentras discrepancias entre el DISEÑO y el CÓDIGO:
1. **¿Qué falta?** (ej: pantalla X no existe)
2. **¿Qué está incorrecto?** (ej: lógica de saldo calcula mal)
3. **¿Qué está parcial?** (ej: Edge Function comenzada pero sin terminar)
4. **Prioridad:** alta/media/baja

---

## INFORMACIÓN ADICIONAL

- **Proyecto Supabase:** https://app.supabase.com (proyecto: gastocheck, Pro plan, East US)
- **Git:** master branch, 4 commits
- **Stack:** Expo 54 + Next.js 15 + Supabase + Claude Vision
- **Idioma código:** TypeScript
- **BD:** Postgres 15, 19 tablas, RLS habilitado

---

## ADJUNTOS QUE NECESITO

1. Archivo: docs/DISENO.md (diseño completo)
2. Archivo: supabase/migrations/0001_init.sql (BD)
3. Archivo: packages/shared/src/types.ts (tipos)
4. Archivo: packages/shared/src/balance.ts (lógica saldos)
5. Carpeta: apps/mobile/app/* (pantallas móvil)
6. Carpeta: apps/web/app/* (pantallas web)
7. Archivo: supabase/functions/ocr-extract/index.ts (OCR)

**Instrucción:** Revisa el código en cada archivo y valida si cumple con el DISEÑO. 
Si algo falta o está incorrecto, dime exactamente qué y dónde.

---

FIN DEL PROMPT
```

---

## CÓMO USARLO

1. **Copia el prompt completo** (desde "SOY JUAN" hasta "FIN DEL PROMPT")
2. **Ve a ChatGPT** (chat.openai.com)
3. **Pega el prompt**
4. **Adjunta los archivos** que te pida (arriba a la izquierda, paperclip)
5. **Presiona Enter**
6. **ChatGPT te dirá qué falta, qué está mal, qué está bien**

---

## QUÉ ESPERAR

ChatGPT te dará un reporte tipo:

```
✅ CUMPLIDO:
- BD con 19 tablas ✓
- RLS habilitado ✓
- Tipos TypeScript completos ✓
- ocr-extract funcional ✓

⚠️ PARCIAL:
- xml-parse comenzado pero incompleto
- authorize-expense no existe aún
- Dashboard web tiene resumen pero no tabla de gastos

❌ FALTA:
- Pantalla "Mis pólizas" en móvil
- Export Excel
- WhatsApp integration
```

Así sabes exactamente qué sigue para la semana 2. 🎯
