# GastoCheck — Diseño Técnico

> **Tus gastos claros. Tus saldos bajo control.**
> Toma foto. Autoriza. Controla.

Documento maestro de arquitectura y diseño del SaaS GastoCheck.

---

## 1. Arquitectura técnica recomendada

**Patrón:** Monorepo TypeScript, multi-tenant (una sola base de datos, aislamiento por `company_id` con Row Level Security).

```
┌──────────────────────────────────────────────────────────────┐
│                        CLIENTES                                │
│                                                                │
│  📱 App móvil (Expo / React Native)   💻 Dashboard (Next.js)   │
│     · Usuario que gasta                  · Dueño / Supervisor   │
│     · Captura foto / XML                 · Autorización         │
│     · Mi saldo / Mis pólizas             · Reportes / Export    │
└───────────────┬──────────────────────────────┬────────────────┘
                │            HTTPS               │
                ▼                                ▼
┌──────────────────────────────────────────────────────────────┐
│                    SUPABASE (Backend)                          │
│                                                                │
│  Auth (JWT)   Postgres + RLS   Storage   Edge Functions        │
│  · roles      · multi-tenant   · tickets · ocr-extract         │
│  · invites    · pólizas/saldos · xml/pdf · xml-parse           │
│               · triggers saldo · zip     · export-excel        │
│                                          · export-zip          │
│                                          · send-whatsapp       │
└───────────────┬──────────────────────────────┬────────────────┘
                │                                │
                ▼                                ▼
       ┌─────────────────┐            ┌────────────────────┐
       │ OCR / IA         │            │ Mensajería         │
       │ · Google Vision  │            │ · WhatsApp Cloud   │
       │   o Claude API   │            │   API (Meta)       │
       │   (lectura ticket)│           │ · o Twilio         │
       └─────────────────┘            └────────────────────┘
```

**Stack concreto**

| Capa | Tecnología | Por qué |
|------|-----------|---------|
| Móvil | Expo SDK 54 (React Native) + expo-router | Una sola base de código iOS/Android, cámara y file-picker nativos. |
| Web | Next.js 15 (App Router) + Tailwind + shadcn/ui | Dashboard rápido, SSR para reportes, mismo lenguaje. |
| Compartido | `packages/shared` (TS puro) | Tipos, lógica de saldos y máquina de estados reutilizada en web y móvil. |
| Backend | Supabase (Postgres 15) | Auth + DB + Storage + Edge Functions en una sola plataforma; RLS resuelve multi-tenant. |
| OCR ticket | Edge Function → Claude API (vision) o Google Vision | Lee tickets/recibos en imagen. |
| XML CFDI | Edge Function (parser propio, Deno) | Lee CFDI 4.0 sin servicio externo. |
| Excel | `exceljs` en Edge Function | Reporte clasificado. |
| ZIP | `jszip` en Edge Function | Empaqueta Excel + comprobantes. |
| WhatsApp | WhatsApp Cloud API (Meta) | Envío de PDF/Excel/ZIP/link. |
| Pagos suscripción | Stripe (o Mercado Pago para MX) | Planes Básico/Equipo/Empresa. |

**Multi-tenant:** cada fila de negocio lleva `company_id`. Las políticas RLS garantizan que un usuario solo ve datos de su empresa y según su rol. No hay base de datos por cliente — un solo Postgres, aislamiento lógico.

---

## 2. Modelo de base de datos

Entidades centrales (detalle SQL en `supabase/migrations/0001_init.sql`):

```
companies ──< company_members >── auth.users (profiles)
    │
    ├──< cost_centers          (centros de costo: obra/ruta/proyecto/lote)
    ├──< expense_categories    (categorías de gasto)
    ├──< accounting_accounts   (catálogo contable del contador)
    │
    ├──< policies              (pólizas por persona/proyecto/semana)
    │       │  saldo_inicial, saldo_final, status (abierta/cerrada)
    │       │  previous_policy_id  (encadena saldos)
    │       │
    │       ├──< advances       (anticipos/transferencias entregadas)
    │       └──< expenses       (gastos)
    │
    └──< expenses
            │  status (máquina de estados)
            ├──< expense_attachments  (ticket/pdf/xml/comprobante)
            ├── cfdi_data             (datos fiscales del XML, 1:1)
            └──< expense_audit        (historial: nunca se borra)
```

**Tablas:**

- **companies** — empresa (tenant). `name, rfc, plan, plan_seats, created_by`.
- **profiles** — extiende `auth.users`: `full_name, phone, avatar_url`.
- **company_members** — relación usuario↔empresa con `role` (owner/supervisor/spender/office/accountant) y `status` (active/invited).
- **cost_centers** — `name, type (obra/ruta/proyecto/lote/cliente/unidad/sucursal), code, active`.
- **expense_categories** — `name, parent_id, default_account_id`.
- **accounting_accounts** — catálogo contable: `code, name, account_type` (configurable por contador).
- **policies** — póliza: `holder_id (persona), name, period_start/end, opening_balance, closing_balance, status (open/closed), previous_policy_id, closed_at`.
- **advances** — anticipo: `policy_id, amount, method (transfer/cash), reference, date, created_by`.
- **expenses** — gasto: `policy_id, spender_id, category_id, cost_center_id, amount, subtotal, iva, total, provider_name, provider_rfc, expense_date, status, notes, authorized_by, authorized_at`.
- **cfdi_data** — 1:1 con expense cuando hay XML: `uuid, rfc_emisor, rfc_receptor, subtotal, iva, total, fecha, metodo_pago, forma_pago, conceptos (jsonb)`.
- **expense_attachments** — `expense_id, kind (ticket/pdf/xml/payment/receipt), storage_path, mime, ocr_raw (jsonb)`.
- **expense_audit** — historial inmutable: `expense_id, actor_id, action, from_status, to_status, payload, created_at`.
- **invitations** — invitaciones pendientes por teléfono/email + rol.
- **report_exports** — registro de exports generados (excel/zip) con link y expiración.

**Reglas de integridad clave**
- Un gasto pertenece a UNA póliza abierta (no se puede agregar a póliza cerrada).
- `closing_balance` se calcula con trigger, no se escribe a mano.
- Borrar nunca es físico: `status = deleted` + registro en `expense_audit`.

---

## 3. Roles y permisos

| Acción | Owner | Supervisor | Spender | Office | Accountant |
|--------|:---:|:---:|:---:|:---:|:---:|
| Crear/editar empresa | ✅ | — | — | — | — |
| Gestionar usuarios/roles | ✅ | — | — | — | — |
| Crear categorías / centros de costo | ✅ | ✅ | — | — | — |
| Registrar anticipos | ✅ | ✅ | — | ✅ | — |
| Subir comprobante (propio) | ✅ | ✅ | ✅ | ✅ | — |
| Ver gastos de **todos** | ✅ | ✅ | — | ✅ | 👁 (solo lectura) |
| Ver **solo sus** gastos/saldo | — | — | ✅ | — | — |
| Autorizar / rechazar gasto | ✅ | ✅ | — | — | — |
| Ligar factura XML a gasto previo | ✅ | ✅ | — | ✅ | — |
| Abrir / cerrar póliza | ✅ | ✅* | — | — | — |
| Configurar catálogo contable | ✅ | — | — | — | ✅ |
| Generar/exportar reportes | ✅ | ✅ | — | ✅ | 👁 |
| Enviar por WhatsApp | ✅ | ✅ | — | ✅ | — |

\* Supervisor cierra póliza solo si el owner lo habilita en config.

Implementado vía RLS + función `auth_role(company_id)` y `auth_is_member(company_id)`.

---

## 4. Flujos de usuario

**Flujo principal (el corazón del producto):**

```
1. Empresa entrega dinero        → advances (registra transferencia/anticipo)
2. Sube saldo de la póliza       → opening_balance + Σ advances
3. Empleado sube comprobante     → expense (status: captured) + attachment
4. IA/XML extrae info            → cfdi_data / ocr_raw  → sugiere categoría y centro de costo
5. Usuario confirma datos        → status: pending_auth
6. Supervisor autoriza ✅         → status: authorized  → descuenta del saldo
   (o rechaza ❌ → rejected / observado)
7. Oficina liga factura después  → status: invoice_applied (cuando llega el XML)
8. Dueño cierra póliza           → status policy: closed; genera nueva con opening = closing anterior
9. App genera Excel / ZIP        → report_exports
10. Envía al contador            → WhatsApp (PDF/Excel/ZIP/link)
```

**Sub-flujos:**
- *Onboarding empresa:* registrar → crear empresa → invitar personas (WhatsApp/email) → crear categorías y centros de costo.
- *Captura express (móvil, 2-3 toques):* abrir app → botón cámara → foto → IA rellena → confirmar → listo.
- *Autorización (dashboard):* bandeja "Pendientes de autorizar" → revisar imagen+datos → palomita o rechazo en lote.
- *Cierre de póliza:* revisar saldo → confirmar → snapshot inmutable → nueva póliza encadenada.

---

## 5. Componentes principales

**Móvil (Expo)**
- `BalanceCard` — saldo actual, anticipos, autorizados, disponible.
- `CaptureButton` — cámara / file-picker, 2-3 toques.
- `ExpenseForm` — datos detectados editables + categoría + centro de costo.
- `ExpenseList` / `ExpenseStatusBadge` — lista con color de estatus.
- `ExpenseDetail` — imagen + datos fiscales + ver XML/PDF.
- `PolicyList` — abiertas/cerradas con saldos.

**Web (Next.js)**
- `DashboardSummary` — KPIs (anticipos, autorizados, pendientes, por comprobar).
- `AuthorizationInbox` — bandeja con autorización en lote.
- `ExpensesTable` — filtros por empleado/categoría/centro/periodo.
- `PolicyManager` — abrir/cerrar pólizas.
- `AccountingCatalog` — catálogo contable (contador).
- `CostCenters`, `MembersAndRoles`.
- `ReportBuilder` + `ExportDialog` (Excel/ZIP) + `WhatsAppSendDialog`.

**Compartido (`packages/shared`)**
- `types.ts` — tipos del dominio.
- `balance.ts` — cálculo de saldos.
- `status.ts` — máquina de estados de gasto.
- `cfdi.ts` — tipos del CFDI.

---

## 6. Diseño UI inicial

**Marca**
| Token | Hex |
|------|-----|
| Azul oscuro | `#0D1B2A` |
| Azul principal | `#1565C0` |
| Verde check | `#43A047` |
| Naranja pendiente | `#FF9800` |
| Rojo rechazo | `#E53935` |
| Fondo | `#FFFFFF` |
| Gris UI | `#F5F7FA` |

**Color por estatus:** Verde = autorizado · Naranja = pendiente · Rojo = rechazado · Azul = cerrado en póliza.

**Logo:** círculo azul (`#1565C0`) con palomita verde (`#43A047`). Ver `apps/web/public/logo.svg`.

**Principios UX**
- Spender: experiencia mínima — *"Toma foto y olvídate del ticket."*
- Dueño: control — *"Controla cada peso entregado."*
- Contador: *"Recibe pólizas ordenadas listas para importar."*
- Máx. 2-3 toques para subir comprobante. Estatus siempre visible por color.

---

## 7. API endpoints

Mayoría vía PostgREST autogenerado de Supabase (CRUD con RLS). Lógica especial vía Edge Functions:

| Método | Ruta (Edge Function) | Descripción |
|--------|----------------------|-------------|
| POST | `/ocr-extract` | Recibe imagen → OCR/IA → `{provider, total, iva, date, category_suggestion}` |
| POST | `/xml-parse` | Recibe XML CFDI → `cfdi_data` estructurado |
| POST | `/expenses/:id/authorize` | Autoriza/rechaza (valida rol, escribe audit) |
| POST | `/policies/:id/close` | Cierra póliza, calcula saldo, crea encadenada |
| POST | `/reports/excel` | Genera Excel clasificado → link firmado |
| POST | `/reports/zip` | Genera ZIP (Excel+XML+PDF+tickets) → link firmado |
| POST | `/send-whatsapp` | Envía reporte por WhatsApp |
| POST | `/invitations` | Crea invitación + manda WhatsApp/email |

CRUD directo (PostgREST): `companies, company_members, cost_centers, expense_categories, accounting_accounts, policies, advances, expenses, expense_attachments`.

---

## 8. Lógica de pólizas y saldos

```
saldo_disponible(póliza) = opening_balance
                         + Σ advances
                         − Σ expenses(status = authorized | invoice_applied)

saldo_por_comprobar      = Σ expenses(status ∈ {captured, pending_auth})

Al CERRAR póliza:
  closing_balance = saldo_disponible(en el momento del cierre)
  nueva_póliza.opening_balance = closing_balance
  nueva_póliza.previous_policy_id = póliza.id
```

- Solo gastos **autorizados** descuentan saldo. Pendientes se muestran aparte como "por comprobar".
- El cierre congela la póliza (snapshot inmutable) y arrastra el saldo.
- Implementado en `packages/shared/src/balance.ts` (cálculo cliente) y trigger SQL (consistencia servidor).

---

## 9. Lógica de autorización

Máquina de estados (`packages/shared/src/status.ts`):

```
captured ──confirm──▶ pending_auth ──authorize──▶ authorized ──apply_invoice──▶ invoice_applied
                          │  ▲                          │
                     reject│  │observe→fix              └──close_policy──▶ closed_in_policy
                          ▼  │
                       rejected / observed
   (cualquiera) ──delete──▶ deleted     (duplicate detectado por UUID/total+fecha)
```

- Toda transición exige rol con permiso y deja registro en `expense_audit` (actor, from, to, timestamp).
- `duplicate`: se detecta por `cfdi_data.uuid` repetido o (provider_rfc + total + fecha) similar.
- Nada se borra físicamente; `deleted`/`rejected` se conservan según permisos.

---

## 10. Lógica de exportación Excel / ZIP

**Excel** (`exceljs`): hojas por *Resumen*, *Por empleado*, *Por categoría*, *Por centro de costo*, *Detalle de gastos* (con datos fiscales). Formato clasificado listo para contador. Última hoja: *Importable contable* mapeando categoría→cuenta del catálogo.

**ZIP** (`jszip`): 
```
reporte_<empresa>_<periodo>.zip
├── reporte.xlsx
├── importable_contable.csv
├── xml/        (CFDIs)
├── pdf/        (facturas pdf)
├── tickets/    (imágenes)
└── comprobantes/ (pagos / recibos)
```

Genera link firmado (Supabase Storage, expira en N días) → se puede enviar por WhatsApp como link seguro o adjunto.

---

## 11. Roadmap de MVP

**Fase 0 — Cimientos (semana 1-2)**
- Monorepo, Supabase, esquema + RLS, auth, crear empresa, invitar usuarios.

**Fase 1 — Captura y saldo (semana 3-4)** ← *núcleo de valor*
- Móvil: captura foto/XML, OCR/XML parse, confirmar, Mis gastos, Mi saldo.
- Web: bandeja de autorización (✅/❌), tabla de gastos.

**Fase 2 — Pólizas (semana 5)**
- Anticipos, abrir/cerrar póliza, encadenado de saldos.

**Fase 3 — Reportes (semana 6-7)**
- Excel clasificado, ZIP de comprobantes, reportes por empleado/categoría/centro.

**Fase 4 — Distribución (semana 8)**
- WhatsApp, importable contable, catálogo contable.

**Fase 5 — Comercial (semana 9+)**
- Planes/Stripe, límites por plan, multi-sucursal (Corporativo), API.

---

## Estatus de gasto (referencia)
`captured` · `pending_auth` · `authorized` · `pending_invoice` · `invoice_applied` · `observed` · `rejected` · `deleted` · `duplicate` · `closed_in_policy`
