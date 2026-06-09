# GastoCheck — Dossier Técnico Completo
> Documento para revisión de arquitectura, alcances y estructura del sistema.
> Generado: 2026-06-08 | Repo: https://github.com/romerojuan24-maker/gastocheck-app

---

## 1. QUÉ ES GASTOCHECK

GastoCheck es un **SaaS multi-empresa** para controlar anticipos de dinero, comprobaciones de gastos y saldos por persona. Está orientado a empresas del sector construcción, distribución, logística y cualquier industria donde el personal opera fuera de oficina con dinero de la empresa.

**Eslogan:** *"Tus gastos claros. Tus saldos bajo control."*

**Problema que resuelve:**
- El dueño entrega dinero a un técnico/chofer/residente para gastos de campo
- La persona gasta y trae tickets/facturas sin orden
- El contador recibe papeles sueltos sin cuadrar saldos
- No hay rastreo de quién autorizó qué ni cuándo

**Solución:**
- App móvil: empleado toma foto del ticket → IA extrae los datos → gasto queda registrado en segundos
- Dashboard web: supervisor autoriza/rechaza con motivo → saldo se actualiza automáticamente
- Cierre: dueño genera Excel/ZIP → contador recibe póliza ordenada lista para contabilidad

---

## 2. ARQUITECTURA GENERAL

```
┌────────────────────────┐     ┌─────────────────────────┐
│   📱 App Móvil          │     │   💻 Dashboard Web       │
│   Expo SDK 54           │     │   Next.js 15             │
│   React Native          │     │   App Router + Tailwind  │
│                         │     │                          │
│   ● Toma foto ticket    │     │   ● Autorizaciones       │
│   ● OCR Gemini Vision   │     │   ● Tabla de gastos      │
│   ● Saldo en tiempo real│     │   ● KPIs y métricas      │
│   ● Mis gastos          │     │   ● Cierre de póliza     │
│   ● Mis pólizas         │     │   ● Exportar Excel/ZIP   │
└───────────┬────────────┘     └─────────────┬───────────┘
            │         HTTPS + JWT             │
            └──────────────┬─────────────────┘
                           ▼
          ┌────────────────────────────────┐
          │        SUPABASE (Backend)       │
          │                                │
          │  Auth (JWT + roles)            │
          │  Postgres 15 + RLS             │  ← multi-tenant por company_id
          │  Storage (fotos/XML/PDF/ZIP)   │
          │  Edge Functions (Deno)         │
          └────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
   ┌─────────────────┐       ┌──────────────────┐
   │  Google Gemini  │       │  WhatsApp Cloud  │
   │  1.5 Flash      │       │  API (Meta)      │
   │  (OCR tickets)  │       │  (envío reportes)│
   └─────────────────┘       └──────────────────┘
```

**Patrón:** Monorepo TypeScript (npm workspaces). Multi-tenant con un solo Postgres, aislamiento lógico por `company_id` + RLS.

---

## 3. STACK TECNOLÓGICO

| Capa | Tecnología | Versión | Propósito |
|------|-----------|---------|-----------|
| Móvil | Expo + React Native | SDK 54 | App iOS/Android unificada |
| Web | Next.js + Tailwind + shadcn | 15 | Dashboard supervisor/dueño |
| Compartido | TypeScript puro | — | Tipos, lógica de saldos, estados |
| Backend | Supabase (Postgres 15) | — | Auth + DB + Storage + Functions |
| OCR | Google Gemini 1.5 Flash | REST API | Lee tickets/recibos en imagen |
| Mensajería | WhatsApp Cloud API (Meta) | v19.0 | Envío de reportes |
| XML CFDI | Parser propio (Deno) | — | Lee CFDI 4.0 sin servicio externo |
| Excel | ExcelJS 4.4 | npm | Genera hojas clasificadas |
| ZIP | JSZip 3.10 | npm | Empaqueta todos los comprobantes |
| Control de código | Git + GitHub | — | github.com/romerojuan24-maker/gastocheck-app |

---

## 4. MODELO DE BASE DE DATOS (19 tablas)

### Tablas core

```
companies              — Empresa (tenant). Plan, RFC, dueño.
profiles               — Extiende auth.users: nombre, teléfono, avatar.
company_members        — Relación usuario↔empresa con rol y status.

policies               — Póliza de gasto por persona/proyecto.
advances               — Anticipos entregados a la póliza.
expenses               — Gastos registrados (el corazón del sistema).
cfdi_data              — Datos fiscales del XML CFDI 4.0 (1:1 con expense).
expense_attachments    — Fotos, PDF, XML vinculados a un gasto.
expense_audit          — Historial inmutable: toda acción queda registrada.

expense_categories     — Catálogo de categorías de gasto por empresa.
cost_centers           — Centros de costo (obra, ruta, proyecto, lote...).
accounting_accounts    — Catálogo contable del contador.

invitations            — Invitaciones pendientes por email/teléfono.
report_exports         — Registro de exports generados con links firmados.
policy_snapshots       — Snapshot inmutable al cerrar póliza.
```

### Enums clave

```sql
-- Estados de un gasto (máquina de estados)
expense_status:
  captured          → Capturado por el empleado
  pending_auth      → Esperando autorización del supervisor
  authorized        → Autorizado, descuenta saldo
  pending_invoice   → Autorizado, esperando factura
  invoice_applied   → Factura XML vinculada, descuenta saldo
  observed          → Supervisor pidió corrección
  rejected          → Rechazado (con motivo obligatorio)
  deleted           → Borrado lógico (nunca físico)
  duplicate         → Detectado como duplicado
  closed_in_policy  → Póliza cerrada, gasto congelado

-- Roles de usuario
member_role: owner | supervisor | spender | office | accountant

-- Planes de empresa
company_plan: basico | equipo | empresa | corporativo
```

### Lógica de saldos (trigger SQL + TypeScript)

```
saldo_disponible = opening_balance
                 + Σ advances
                 − Σ expenses WHERE status IN (authorized, invoice_applied, closed_in_policy)

por_comprobar    = Σ expenses WHERE status IN (captured, pending_auth, observed)
```

El trigger `recompute_policy_closing()` recalcula automáticamente en cada INSERT/UPDATE/DELETE de `advances` o `expenses`.

### Seguridad multi-tenant (RLS)

Todas las tablas tienen RLS habilitado. El acceso se controla via funciones helper:

```sql
auth_is_member(company_id)    → ¿pertenece a esta empresa?
auth_role(company_id)         → ¿cuál es su rol?
auth_can_view_all(company_id) → ¿puede ver todos los gastos? (no-spender)
auth_can_authorize(company_id)→ ¿puede autorizar? (owner/supervisor)
```

---

## 5. ROLES Y PERMISOS

| Acción | Owner | Supervisor | Spender | Office | Accountant |
|--------|:-----:|:----------:|:-------:|:------:|:----------:|
| Crear empresa / gestionar usuarios | ✅ | — | — | — | — |
| Registrar anticipos | ✅ | ✅ | — | ✅ | — |
| Subir comprobante propio | ✅ | ✅ | ✅ | ✅ | — |
| Ver gastos de TODOS | ✅ | ✅ | — | ✅ | lectura |
| Ver SOLO sus gastos/saldo | — | — | ✅ | — | — |
| Autorizar / rechazar | ✅ | ✅ | — | — | — |
| Ligar factura XML | ✅ | ✅ | — | ✅ | — |
| Abrir / cerrar póliza | ✅ | ✅* | — | — | — |
| Catálogo contable | ✅ | — | — | — | ✅ |
| Exportar reportes | ✅ | ✅ | — | ✅ | lectura |
| Enviar por WhatsApp | ✅ | ✅ | — | ✅ | — |

*Supervisor cierra póliza solo si el owner habilitó `allow_supervisor_close`.

---

## 6. MÁQUINA DE ESTADOS DE UN GASTO

```
                     captured
                        │
              ┌─────────▼──────────┐
              │   pending_auth     │ ← pendiente de autorización
              └─────────┬──────────┘
                        │
         ┌──────────────┼──────────────┐
         ▼              ▼              ▼
     authorized      observed       rejected
         │              │              (fin)
         │         (empleado corrige)
         │              │
         └──────► pending_auth (de nuevo)
         │
         ├──► pending_invoice ──► invoice_applied
         │
         └──► closed_in_policy (al cerrar póliza)

En cualquier punto: deleted | duplicate (acciones especiales)
```

**Validación:** La función `canTransition(action, fromStatus, role)` del paquete `shared` verifica que la acción sea válida para el estado actual y el rol del actor.

---

## 7. EDGE FUNCTIONS (API Backend — 7 funciones Deno)

### /ocr-extract — Lectura de tickets con IA
- **Input:** `{ image_base64: string, mime_type: string }`
- **Proceso:** Envía imagen a Google Gemini 1.5 Flash con prompt estructurado
- **Output:** `{ total, subtotal, iva, fecha, proveedor, conceptos[], confidence, raw_text }`
- **Confidence:** high / medium / low según legibilidad del ticket
- **Formatos:** JPEG, PNG, WEBP

### /authorize-expense — Cambio de estado de gasto
- **Input:** `{ expense_id, action, rejection_reason? }`
- **Actions disponibles:** confirm | authorize | reject | observe | fix | apply_invoice | mark_duplicate | close | delete
- **Validaciones:** RLS de rol, máquina de estados, motivo obligatorio al rechazar
- **Output:** `{ ok, status: nuevo_status }`
- **Audit:** Escribe en `expense_audit` cada transición (actor, from, to, timestamp, payload)

### /xml-parse — Parser CFDI 4.0
- **Input:** `{ xml: string, expense_id?: string }`
- **Proceso:** Parsea XML del SAT sin dependencias externas (regex sobre el XML)
- **Validaciones críticas:**
  - UUID único por empresa (detecta duplicados)
  - Formato RFC emisor y receptor (regex SAT)
  - Emisor diferente de Receptor
  - |Subtotal + IVA - Total| menor a $0.10
- **Output:** `{ data: CfdiData, warnings: string[] }`

### /close-policy — Cierre de póliza
- **Input:** `{ policy_id, create_next?: boolean, next_name?: string }`
- **Validaciones:**
  - Solo owner (o supervisor con permiso especial)
  - Bloquea si hay gastos en `pending_auth` u `observed`
- **Proceso:**
  1. Marca póliza como `closed`
  2. Marca gastos autorizados como `closed_in_policy`
  3. Crea snapshot inmutable en `policy_snapshots`
  4. Opcionalmente crea póliza siguiente con `opening_balance = closing_balance` anterior
- **Output:** `{ ok, closing_balance, next_policy? }`

### /export-excel — Reporte Excel de póliza
- **Input:** `{ policy_id }`
- **Genera:** Archivo .xlsx con 5 hojas:
  1. **Resumen** — KPIs: saldo inicial, anticipos, autorizados, disponible
  2. **Detalle** — Todos los gastos con columnas: fecha, proveedor, RFC, empleado, categoría, centro, subtotal, IVA, total, estatus, UUID CFDI, notas
  3. **Por Empleado** — Agrupado por persona: cantidad gastos, total, autorizados, pendientes
  4. **Por Categoría** — Combustible, Materiales, Alimentación, etc.
  5. **Por Centro de Costo** — Obra, Ruta, Proyecto, etc.
- **Formato:** Encabezados con fondo azul marino, colores por estatus, fila de totales
- **Entrega:** Sube a Storage `report-exports/{company_id}/exports/` + genera signed URL (7 días)

### /export-zip — Paquete completo de comprobantes
- **Input:** `{ policy_id }`
- **Genera:** Archivo .zip con estructura:
  ```
  reporte_<poliza>_<fecha>.xlsx   ← Excel completo
  xml/                            ← Archivos CFDI (.xml)
  pdf/                            ← Facturas PDF
  tickets/                        ← Fotos de tickets (.jpg/.png)
  LEAME.txt                       ← Resumen: totales, conteos, fecha
  ```
- **Entrega:** Signed URL 7 días desde Storage

### /send-whatsapp — Envío por WhatsApp Cloud API
- **Input:** `{ to, policy_id, kind, signed_url?, export_id? }`
- **Modos (kind):**
  - `link` → Mensaje de texto con URL firmada + resumen de póliza
  - `excel` → Documento adjunto .xlsx
  - `zip` → Documento adjunto .zip
- **API:** WhatsApp Cloud API v19.0 (Meta Business)

---

## 8. FLUJO COMPLETO DEL SISTEMA

```
1. DUEÑO ENTREGA DINERO
   → Registra anticipo en póliza del empleado (BD: advances)
   → Saldo de póliza sube automáticamente (trigger SQL)

2. EMPLEADO GASTA EN CAMPO (móvil)
   → Abre app → "Tomar foto del ticket"
   → Gemini Vision extrae: proveedor, total, IVA, fecha, conceptos
   → Empleado confirma/edita datos en 2 toques
   → App guarda: expense (status=captured) + foto en Storage + attachment + audit
   → Saldo NO cambia todavía (gasto en captured)

3. SUPERVISOR AUTORIZA (web)
   → Bandeja "Autorizaciones pendientes" muestra gasto
   → Revisa imagen + datos extraídos por IA
   → Autorizar → status=authorized → saldo DESCUENTA automáticamente (trigger)
   → Rechazar → motivo obligatorio → status=rejected → saldo NO cambia
   → Historial de auditoría registra: quién, cuándo, motivo

4. OFICINA LIGA FACTURA XML (opcional)
   → Sube XML del SAT
   → xml-parse valida: UUID único, RFC, matemática
   → status=invoice_applied → saldo descuenta con factura oficial

5. DUEÑO CIERRA PÓLIZA
   → Valida que no hay gastos pendientes (bloquea si hay)
   → close-policy: congela póliza, cierra gastos, genera snapshot inmutable
   → Opción: crear nueva póliza encadenada (opening = closing anterior)

6. CONTADOR RECIBE REPORTE
   → export-excel: 5 hojas clasificadas
   → export-zip: Excel + XML + PDF + fotos
   → send-whatsapp: envía al número del contador
   → Listo para importar en Contpaq / COI / cualquier sistema contable
```

---

## 9. REPORTES Y EXPORTACIONES

### Excel (5 hojas)
| Hoja | Contenido | Uso |
|------|-----------|-----|
| Resumen | Saldo inicial, anticipos, autorizados, disponible, pendientes | Vista ejecutiva |
| Detalle | Cada gasto con todos los campos + UUID CFDI | Auditoría completa |
| Por Empleado | Subtotales por persona | Cuadre de responsabilidades |
| Por Categoría | Subtotales combustible/materiales/etc | Análisis de costos |
| Por Centro | Subtotales obra/ruta/proyecto | Costeo por proyecto |

### ZIP (archivo todo en uno)
- Reporte Excel completo
- Carpeta `xml/` con todos los CFDI del SAT originales
- Carpeta `pdf/` con facturas en PDF
- Carpeta `tickets/` con fotos de recibos y tickets
- `LEAME.txt` con resumen ejecutivo (totales, fechas, conteos)

### WhatsApp (3 modos)
- **Link:** Mensaje de texto con URL firmada y resumen de póliza
- **Excel:** Archivo .xlsx adjunto enviado como documento
- **ZIP:** Archivo .zip adjunto con todos los comprobantes

---

## 10. VALIDACIONES CRÍTICAS IMPLEMENTADAS

### Anti-duplicados CFDI
- Índice UNIQUE en `cfdi_data(uuid, company_id)`
- Error 409 con mensaje explicativo al intentar subir CFDI duplicado
- La Edge Function `/xml-parse` consulta BD antes de insertar

### Validación fiscal XML
- Formato RFC SAT: `^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$`
- RFC emisor diferente a RFC receptor
- Matemática: |Subtotal + IVA - Total| menor a $0.10 de tolerancia
- UUID TimbreFiscalDigital presente y con formato correcto

### Auditoría inmutable
- Cada acción sobre un gasto genera una fila en `expense_audit`
- Solo INSERT permitido vía RLS (no UPDATE ni DELETE)
- Campos: expense_id, actor_id, action, from_status, to_status, timestamp, payload JSON

### Cierre de póliza
- Bloquea si hay gastos en `pending_auth` u `observed`
- Genera snapshot inmutable antes de cerrar
- Encadenado automático de saldos (opening del siguiente = closing del actual)

### Motivo de rechazo
- Campo `rejection_reason` en tabla `expenses` (text, nullable)
- Edge Function valida que no esté vacío al usar action=reject
- Dashboard web: modal con textarea + botón deshabilitado hasta escribir motivo

---

## 11. ESTRUCTURA DE ARCHIVOS

```
gastocheck-app/
│
├── apps/
│   ├── mobile/                     ← Expo SDK 54 (React Native)
│   │   ├── app/
│   │   │   ├── _layout.tsx         Navegación raíz
│   │   │   ├── index.tsx           Home: saldo + lista gastos (Supabase real)
│   │   │   └── capture.tsx         Captura: foto → OCR → confirmar → guardar
│   │   ├── hooks/
│   │   │   └── useOcr.ts           Hook: llama a /ocr-extract, maneja estados
│   │   └── lib/
│   │       └── supabase.ts         Cliente Supabase con persistencia de sesión
│   │
│   └── web/                        ← Next.js 15 (App Router)
│       ├── app/
│       │   ├── layout.tsx          Layout raíz
│       │   └── page.tsx            Dashboard: KPIs + bandeja autorización + gastos
│       ├── components/
│       │   └── Logo.tsx            Logo SVG del sistema
│       └── lib/
│           └── supabase.ts         Cliente Supabase web
│
├── packages/
│   └── shared/
│       └── src/
│           ├── types.ts            Todos los tipos TypeScript del dominio
│           ├── balance.ts          computeBalance() — lógica de saldos
│           ├── status.ts           Máquina de estados + canTransition()
│           ├── cfdi.ts             parseCfdiXml() — parser CFDI 4.0
│           └── index.ts            Re-exports públicos
│
├── supabase/
│   ├── functions/
│   │   ├── ocr-extract/            Gemini Vision → JSON estructurado
│   │   ├── authorize-expense/      Transiciones de estado + audit trail
│   │   ├── xml-parse/              Parser CFDI + validaciones fiscales
│   │   ├── close-policy/           Cierre + snapshot + encadenado
│   │   ├── export-excel/           Excel 5 hojas + Storage + signed URL
│   │   ├── export-zip/             ZIP completo + Storage + signed URL
│   │   └── send-whatsapp/          WhatsApp Cloud API (link/doc)
│   ├── migrations/
│   │   ├── 20260606000001_init.sql           19 tablas + RLS + triggers
│   │   └── 20260608000002_storage_rls_seed.sql  Storage buckets + RLS + extras
│   └── seed.sql                    Datos de prueba (requiere UUIDs reales)
│
└── docs/
    ├── DISENO.md                   Documento maestro de arquitectura
    ├── DEPLOYMENT.md               Guía paso a paso de deployment
    ├── RIESGOS_IDENTIFICADOS.md    Pre-auditoría de seguridad (Daniel)
    ├── PLAN_CORRECTIVO.md          Plan 38h para producción (Daniel)
    └── DOSSIER_SISTEMA.md          Este documento
```

---

## 12. DEPLOYMENT ACTUAL

| Componente | Estado | URL / Referencia |
|-----------|:------:|-----------------|
| GitHub | ✅ Live | github.com/romerojuan24-maker/gastocheck-app |
| Supabase DB | ✅ Live | omhycwfjxynkfwywzwvz (East US Ohio) |
| Migrations (0001+0002) | ✅ Aplicadas | — |
| 7 Edge Functions | ✅ Deployadas | Supabase → Functions |
| Storage buckets | ✅ Creados | expense-attachments + report-exports |
| Web (Next.js) | ⏳ Pendiente | Falta deploy en Vercel |
| Móvil (iOS/Android) | ⏳ Pendiente | Falta EAS Build + Submit |

---

## 13. PENDIENTES ANTES DEL PILOTO

### Que hace Daniel (mañana):
1. Configurar secret `GEMINI_API_KEY` en Supabase Dashboard → Settings → Secrets
2. Crear 3 usuarios de prueba: `owner@gastocheck.test`, `super@gastocheck.test`, `spender@gastocheck.test` (pass: Test1234!)
3. Copiar los 3 UUIDs generados en `supabase/seed.sql` y ejecutarlo en SQL Editor
4. Opcional: `WHATSAPP_API_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` para probar WhatsApp

### Post-piloto:
- Deploy web en Vercel (conectar repo → dominio personalizado)
- EAS Build para iOS y Android (App Store / Google Play)
- Suscripciones con Stripe o Mercado Pago (planes Básico/Equipo/Empresa)
- Notificaciones push al autorizar gastos
- Exportación en formato Contpaq

---

## 14. CALIFICACIÓN PRE-AUDITORÍA

Revisión independiente realizada por Daniel (Sistemas), 2026-06-08:

| Área | Nota | Observación |
|------|:----:|-------------|
| Arquitectura general | 9/10 | Bien enfocada al problema real |
| Modelo SaaS multi-tenant | 9/10 | company_id desde el inicio, correcto |
| UX del flujo | 9/10 | Flujo simple: foto → confirmar → listo |
| Seguridad (RLS) | 6/10 | Declarado en código, falta validar en producción |
| Modelo contable | 7/10 | Correcto, snapshot implementado |
| **Estado real MVP** | **65-70%** | Scaffolded + lógica crítica implementada |

**Conclusión:** Apto para piloto cerrado (2-5 empresas con equipo técnico presente). No apto para producción general hasta validar RLS, saldos y audit trail en entorno real con datos reales.

---

## 15. VARIABLES DE ENTORNO NECESARIAS

### apps/mobile/.env
```
EXPO_PUBLIC_SUPABASE_URL=https://omhycwfjxynkfwywzwvz.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### apps/web/.env.local
```
NEXT_PUBLIC_SUPABASE_URL=https://omhycwfjxynkfwywzwvz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### Supabase Secrets (Edge Functions)
```
GEMINI_API_KEY          → Google AI Studio (aistudio.google.com/apikey)
WHATSAPP_API_TOKEN      → Meta Business → WhatsApp → API Access
WHATSAPP_PHONE_NUMBER_ID → Meta Business → WhatsApp → Phone Number ID
```

---

## 16. LINKS CLAVE

| Recurso | URL |
|---------|-----|
| Repositorio GitHub | https://github.com/romerojuan24-maker/gastocheck-app |
| Supabase Dashboard | https://supabase.com/dashboard/project/omhycwfjxynkfwywzwvz |
| Edge Functions | https://supabase.com/dashboard/project/omhycwfjxynkfwywzwvz/functions |
| Storage | https://supabase.com/dashboard/project/omhycwfjxynkfwywzwvz/storage/buckets |
| Tablas BD | https://supabase.com/dashboard/project/omhycwfjxynkfwywzwvz/editor |
| SQL Editor | https://supabase.com/dashboard/project/omhycwfjxynkfwywzwvz/sql/new |
| Secrets | https://supabase.com/dashboard/project/omhycwfjxynkfwywzwvz/settings/functions |

---

*Documento generado con Claude (Anthropic) — Sesión 2026-06-08*
