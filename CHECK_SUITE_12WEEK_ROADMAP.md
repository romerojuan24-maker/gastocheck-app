# CHECK SUITE 12-WEEK DEVELOPMENT ROADMAP
**Sprint 0: Jul 04 - Sep 25, 2026**
**Owner: Juan (Arquitectura) + Daniel (Implementación)**
**Last Updated: 2026-07-04**

---

## OVERVIEW & MILESTONES

| Milestone | Timeline | Status | Owner |
|-----------|----------|--------|-------|
| **Sprint 1-2: Foundation** | Jul 04 - Jul 18 | 🟡 Pending | Juan setup + Daniel code |
| **Sprint 3-4: Core Engines** | Jul 19 - Aug 01 | 🔴 Blocking | Flows + OCR + CFDI base |
| **Sprint 5-6: Features** | Aug 02 - Aug 15 | 🔴 Blocked | Credits + OAuth + Distribution |
| **Sprint 7-8: Refinement** | Aug 16 - Aug 29 | 🔴 Blocked | Projections + Compliance + Matching |
| **Sprint 9-10: Integration Layer** | Aug 30 - Sep 12 | 🔴 Blocked | 5-way convergence |
| **Sprint 11-12: QA + Launch v2.0** | Sep 13 - Sep 25 | 🔴 Blocked | Performance + E2E + Release |

---

## SHARED ARCHITECTURE ASSUMPTIONS

**Active Monorepo Structure:**
```
gastocheck-app/
├── packages/shared/          ← Common types, hooks, utilities
│   ├── src/types/            ← TypeScript interfaces
│   ├── src/hooks/            ← Supabase, integrations
│   └── src/utils/            ← Dates, formatting, calcs
├── apps/web/                 ← Next.js admin/backoffice
│   ├── app/api/              ← API routes (BFF)
│   └── app/(modules)/        ← FlujoCheck, BancoCheck, FacturaCheck dashboards
└── apps/cobra-mobile/        ← Expo mobile
    └── app/(modules)/        ← CobraCheck screens + GastoCheck views
```

**Database:** Supabase PostgreSQL
**Auth:** JWT (existing setup from v1)
**Payments:** Stripe (v1 ready)
**Integration Patterns:**
- Event-driven via Supabase Realtime
- Server-side via Edge Functions
- Client validation + RLS enforcement

---

---

## SEMANA 1-2: SETUP + FOUNDATION
**Dates: Jul 04 - Jul 18 | 80 hours**
**Goal: Scaffolding complete, SQL migrations ready, component libraries initialized**

### FlujoCheck (Cash Flow Module)
**Arquitecto: Juan | Dev: Daniel**

**Tasker — Setup Phase:**
```
□ [1h] Create /apps/web/app/(modules)/flujocheck directory structure
  ├── dashboard/
  ├── flows/
  ├── credits/
  ├── projections/
  └── settings/

□ [2h] Define Supabase schema v2 (cash_flows table)
  - cash_flow_id (uuid, PK)
  - organization_id (uuid, FK)
  - flow_type enum: 'weekly', 'bi_weekly', 'monthly', 'custom'
  - recurring_amount (numeric)
  - start_date, end_date (date)
  - payment_capacity_percent (numeric, default 70)
  - created_at, updated_at
  - RLS policy: org-scoped access

□ [2h] Create cash_flow_projections table
  - projection_id (uuid, PK)
  - cash_flow_id (FK)
  - week_number (smallint, 1-52)
  - projected_balance (numeric)
  - inflows (numeric: GastoCheck reimbursements)
  - outflows (numeric: CobraCheck collections + supplier payments)
  - confidence_score (numeric, 0-100)
  - created_at

□ [1h] Create migration file: 20260704_cash_flows_init.sql
  - Run locally: npx supabase migration up
  - Export schema to packages/shared/types/flujo.ts

□ [3h] Initialize TypeScript types
  packages/shared/src/types/flujo.ts:
  - CashFlow interface
  - ProjectionWeek interface
  - PaymentCapacityConfig interface
  - Integration points with GastoCheck (expenses) + CobraCheck (collections)

□ [2h] Create React component skeleton
  - /apps/web/components/FlujoCheck/Dashboard.tsx (empty)
  - /apps/web/components/FlujoCheck/FlowChart.tsx (empty)
  - /apps/web/components/FlujoCheck/WeeklySummary.tsx (empty)
  - Use shadcn/ui Card, Tabs, Chart (placeholder)

□ [1h] Setup Supabase hooks in packages/shared/src/hooks/
  - useCashFlows() → fetch + subscribe
  - useProjections() → fetch weekly data
  - usePaymentCapacity() → calculate from schema

□ [1h] Integration checklist document
  Create GastoCheck + FlujoCheck integration doc (data flow)
```

**Deliverables:**
- ✅ SQL migration executed locally
- ✅ TypeScript types exported
- ✅ 3 component stubs with placeholder Tailwind
- ✅ 2 Supabase hooks ready for Dan

**Blocking Issues:**
- None expected
- ⚠️ Await Supabase RLS policies from v1 review

**Est. Hours: 16h | Actual: —**

---

### BancoCheck (Bank Integration Module)
**Arquitecto: Juan | Dev: Daniel**

**Tasker — Setup Phase:**
```
□ [1h] Create /apps/web/app/(modules)/bancocheck directory structure
  ├── dashboard/
  ├── statements/
  ├── transactions/
  ├── matching/
  └── admin/

□ [2h] Define Supabase schema v2 (bank_accounts, transactions tables)
  - bank_account_id (uuid, PK)
  - organization_id, account_number, bank_code, balance
  - oauth_provider enum: 'bbva', 'santander', 'belvo', 'manual'
  - last_sync (timestamp), next_sync (timestamp)
  - active (boolean, default true)
  - RLS: org-scoped

  - transaction_id (uuid, PK)
  - bank_account_id (FK)
  - ref_date (date), amount (numeric), description (text)
  - matched_gasto_id (uuid, nullable FK to gastos)
  - matched_cobra_id (uuid, nullable FK to cobros)
  - confidence_score (numeric, 0-100, default 0)
  - status enum: 'pending', 'reconciled', 'manual_review'
  - created_at, updated_at

□ [2h] Create bank_ocr_configs table
  - ocr_config_id (uuid, PK)
  - organization_id (FK)
  - pdf_parser_type enum: 'bbva', 'santander', 'generic'
  - column_mappings (jsonb)
  - date_format (text, default 'DD/MM/YYYY')
  - decimal_separator enum: '.', ','
  - active (boolean)
  - created_at

□ [1h] Create migration file: 20260704_bank_init.sql
  - Run locally
  - Export to packages/shared/types/banco.ts

□ [3h] Initialize TypeScript types
  packages/shared/src/types/banco.ts:
  - BankAccount interface
  - Transaction interface
  - OCRConfig interface
  - BankProvider enum
  - MatchingResult interface

□ [2h] Create React component skeleton
  - /apps/web/components/BancoCheck/Dashboard.tsx (empty)
  - /apps/web/components/BancoCheck/StatementUpload.tsx (empty)
  - /apps/web/components/BancoCheck/TransactionList.tsx (empty)
  - /apps/web/components/BancoCheck/MatchingPanel.tsx (empty)

□ [1h] Setup OCR adapter pattern (not implemented yet)
  packages/shared/src/parsers/
  - BaseParser.ts (abstract class)
  - BBVAParser.ts (stub)
  - SantanderParser.ts (stub)
  - GenericCSVParser.ts (stub)

□ [1h] Supabase hooks
  - useBankAccounts() → list + sync status
  - useTransactions() → paginated fetch
  - useMatching() → fetch unmatched transactions

□ [1h] Integration checklist document
  Create GastoCheck ↔ BancoCheck mapping rules
```

**Deliverables:**
- ✅ SQL migration executed locally
- ✅ TypeScript types exported
- ✅ 4 component stubs
- ✅ Parser base classes ready
- ✅ 3 Supabase hooks ready for Dan

**Blocking Issues:**
- None expected
- ⚠️ Await PDF library decision (pdfjs vs pdf-parse)

**Est. Hours: 16h | Actual: —**

---

### FacturaCheck (Billing + Compliance Module)
**Arquitecto: Juan | Dev: Daniel**

**Tasker — Setup Phase:**
```
□ [1h] Create /apps/web/app/(modules)/facturacheck directory structure
  ├── dashboard/
  ├── cfdi/
  ├── distribution/
  ├── webhooks/
  └── compliance/

□ [2h] Define Supabase schema v2 (facturas table)
  - factura_id (uuid, PK)
  - organization_id, invoice_number (text), version (text, default '4.0')
  - emisor_rfc (text), receptor_rfc (text)
  - issue_date (timestamp), valid_until (timestamp)
  - subtotal, taxes, total (all numeric)
  - status enum: 'draft', 'signed', 'sent', 'cancelled'
  - cfdi_payload (jsonb, encrypted SAT payload)
  - distribution_method enum: 'email', 'whatsapp', 'both'
  - recipient_email, recipient_phone (nullable)
  - created_at, updated_at
  - RLS: org-scoped

□ [1h] Create factura_distribution_logs table
  - log_id (uuid, PK)
  - factura_id (FK)
  - distribution_method (enum)
  - status enum: 'pending', 'sent', 'failed', 'bounced'
  - sent_at (timestamp, nullable)
  - error_message (text, nullable)
  - created_at

□ [1h] Create factura_compliance_audit table
  - audit_id (uuid, PK)
  - factura_id (FK)
  - compliance_check enum: 'sat_validation', 'rfc_format', 'amount_matching'
  - result enum: 'pass', 'fail', 'warning'
  - details (jsonb)
  - checked_at (timestamp)

□ [1h] Create migration file: 20260704_factura_init.sql
  - Run locally
  - Export to packages/shared/types/factura.ts

□ [3h] Initialize TypeScript types
  packages/shared/src/types/factura.ts:
  - Factura interface (with nested Emisor, Receptor, ConceptoItem)
  - FacturaPayload interface (SAT CFDI structure)
  - DistributionConfig interface
  - ComplianceCheckResult interface
  - Integration points with GastoCheck (gastos as conceptos)

□ [2h] Create React component skeleton
  - /apps/web/components/FacturaCheck/Dashboard.tsx
  - /apps/web/components/FacturaCheck/InvoiceBuilder.tsx
  - /apps/web/components/FacturaCheck/DistributionConfig.tsx
  - /apps/web/components/FacturaCheck/ComplianceViewer.tsx

□ [1h] Setup CFDI adapter pattern (PAC = FACTUROO)
  packages/shared/src/adapters/
  - BasePACAdapter.ts (abstract)
  - FacturooAdapter.ts (stub, awaiting API key)
  - Create adapter registry pattern

□ [1h] Setup distribution engine (abstract)
  packages/shared/src/services/
  - DistributionService.ts (stub)
  - Email provider adapter
  - WhatsApp provider adapter

□ [1h] Supabase hooks
  - useFacturas() → list + status
  - useComplianceStatus() → audit results
  - useDistributionLogs() → delivery tracking

□ [1h] Integration checklist document
  Create 5-way integration map: Gasto → Factura → Bank → Flow → Cobra
```

**Deliverables:**
- ✅ SQL migration executed locally
- ✅ TypeScript types exported
- ✅ 4 component stubs
- ✅ PAC + Distribution adapters (abstract)
- ✅ 3 Supabase hooks ready
- ✅ Integration map doc

**Blocking Issues:**
- ⚠️ FACTUROO API key + Sandbox creds (awaiting)
- ⚠️ WhatsApp Business token (awaiting)

**Est. Hours: 16h | Actual: —**

---

### Cross-Module Setup
**Arquitecto: Juan**

**Tasker — Integration Foundation:**
```
□ [2h] Create integration types document
  packages/shared/src/types/integrations.ts:
  - DataSourceMap interface (Gasto → Factura → Bank, etc.)
  - EventStreamSchema (webhook payloads)
  - CrossModuleQuery pattern (multi-table queries)

□ [2h] Setup Supabase Realtime subscriptions (utilities)
  packages/shared/src/hooks/useRealtimeSync.ts:
  - Subscribe to cash_flows updates
  - Subscribe to transactions updates
  - Subscribe to facturas status changes
  - Conflict resolution for multi-user updates

□ [1h] Setup error boundaries + logging for new modules
  packages/shared/src/logging/
  - FlowError, BankError, FacturaError class hierarchies
  - Breadcrumb tracking for multi-module flows

□ [2h] Create shared component library
  /apps/web/components/shared/
  - ModuleHeader.tsx
  - SyncStatus.tsx
  - IntegrationAlert.tsx
  - DataImportModal.tsx

□ [1h] Update package.json workspaces + dependencies
  - Add @supabase/supabase-js (if not present)
  - Add pdf-parse or pdfjs-dist (decision pending)
  - Add @hookform/resolvers for validation schemas
  - Add date-fns for calendar/timeline components
  - Add recharts for dashboard charts (FlujoCheck weekly view)

□ [2h] Create development checklist document
  - Local Supabase setup commands
  - Environment variables required
  - Mock data setup for testing
  - Syncing schema between Juan's branch + Daniel's branch
```

**Deliverables:**
- ✅ Integration types standardized
- ✅ Realtime utilities ready
- ✅ Error handling patterns
- ✅ Dependencies installed
- ✅ Dev setup guide

**Est. Hours: 10h | Actual: —**

---

### SEMANA 1-2 SUMMARY

| Task | Owner | Status | Hours | Notes |
|------|-------|--------|-------|-------|
| FlujoCheck Setup | Juan → Dan | 🟡 | 16 | RLS policy review needed |
| BancoCheck Setup | Juan → Dan | 🟡 | 16 | PDF lib decision pending |
| FacturaCheck Setup | Juan → Dan | 🟡 | 16 | FACTUROO API key blocking |
| Cross-Module Setup | Juan | 🟡 | 10 | Foundation for Semana 3+ |
| **TOTAL** | — | **🟡** | **58** | — |

**Blocking Issues:**
- FACTUROO API key + CFDI test environment
- PDF parser library final selection
- WhatsApp Business API credentials

**Go/No-Go Criteria:**
- [ ] All migrations executed + exported to types
- [ ] All 11 component stubs created
- [ ] All Supabase hooks written (9 total)
- [ ] Integration map documented
- [ ] BFF API routes scaffolded (next semana)

---

---

## SEMANA 3-4: CORE ENGINES
**Dates: Jul 19 - Aug 01 | 90 hours**
**Goal: Data import, core algorithms, SAT compliance MVP**

### FlujoCheck — Weekly Dashboard + Capacity Algorithm
**Arquitecto: Juan | Dev: Daniel | QA: —**

**Tasker — Core Implementation:**
```
□ [3h] Implement weekly dashboard UI
  /apps/web/components/FlujoCheck/Dashboard.tsx:
  - Card grid: Current Balance | Weekly Inflow | Weekly Outflow | Confidence
  - Calendar picker for date range
  - Filter by flow_type (weekly, bi-weekly, monthly)
  - Realtime sync badge (Supabase Realtime listener)
  - Export button (CSV, PDF)

□ [4h] Implement capacity calculation algorithm
  packages/shared/src/utils/cashFlowCalc.ts:
  ```typescript
  interface PaymentCapacityInput {
    weeklyInflows: number;     // From GastoCheck reimbursements
    weeklyOutflows: number;    // From CobraCheck collections
    suppliersPaymentDates: Date[];
    safetyMargin: number;      // Default 30% buffer
    customCapacityLimit?: number;
  }
  
  interface CapacityResult {
    availableAmount: number;
    confidenceScore: number;   // 0-100
    warnings: string[];
    recommendation: 'safe' | 'caution' | 'risk';
  }
  
  export function calculatePaymentCapacity(input: PaymentCapacityInput): CapacityResult
  ```
  - Logic: availableAmount = (inflows - outflows) * safety_margin
  - Confidence = based on data freshness + historical variance
  - Warnings if data > 24h stale or variance > 30%

□ [2h] Create BFF API endpoint
  /apps/web/app/api/flujocheck/capacity:
  - POST /api/flujocheck/capacity → calculate + persist
  - GET /api/flujocheck/capacity/:flowId → fetch cached result
  - Validates org ownership via JWT

□ [3h] Implement FlowChart component
  /apps/web/components/FlujoCheck/FlowChart.tsx:
  - Use Recharts (LineChart + BarChart combo)
  - X-axis: weeks 1-12
  - Y-axis: balance projection
  - Overlay: inflows (green), outflows (red), safety line (orange)
  - Interactive tooltips with date + amount

□ [3h] Implement weekly summary cards
  /apps/web/components/FlujoCheck/WeeklySummary.tsx:
  - Filterable table: Date | Inflows | Outflows | Net | Capacity %
  - Clickable row → detail modal
  - Export selected weeks

□ [2h] Setup Supabase Real-time listener
  packages/shared/src/hooks/useCashFlowSync.ts:
  - Subscribe to cash_flow_projections changes
  - Auto-refresh chart on update
  - Handle connection loss gracefully

□ [2h] Add integration with GastoCheck
  packages/shared/src/hooks/useGastoCheckIntegration.ts:
  - Fetch pending reimbursements (count, sum)
  - Subscribe to reimbursement approvals
  - Update inflows in real-time

□ [2h] Add integration with CobraCheck
  packages/shared/src/hooks/useCobraCheckIntegration.ts:
  - Fetch daily collections (count, sum)
  - Subscribe to payment confirmations
  - Update outflows in real-time

□ [1h] Setup error handling + edge cases
  - Null/undefined flows → show empty state
  - Stale data warnings
  - Network retry logic (exponential backoff)

□ [1h] Create unit tests
  packages/shared/src/utils/__tests__/cashFlowCalc.test.ts:
  - Test capacity calculation with various inputs
  - Test confidence scoring
  - Test warning generation

□ [1h] Create E2E test scenario
  apps/web/__tests__/e2e/flujocheck-flow.spec.ts:
  - Login → Create flow → Verify dashboard → Check sync
```

**Deliverables:**
- ✅ Dashboard fully functional with live data
- ✅ Capacity algorithm tested + integrated
- ✅ 2 Real-time integrations (GastoCheck, CobraCheck)
- ✅ Unit + E2E tests passing
- ✅ CSV/PDF export working

**Blocking Issues:**
- None expected (depends on Semana 1 completion)

**Est. Hours: 28h | Actual: —**

---

### BancoCheck — OCR Import + Basic Matching
**Arquitecto: Juan | Dev: Daniel | QA: —**

**Tasker — Core Implementation:**
```
□ [3h] Implement PDF upload + parsing UI
  /apps/web/components/BancoCheck/StatementUpload.tsx:
  - Drag-drop zone for PDF
  - OCR config selector (BBVA, Santander, generic)
  - Progress bar (3 stages: upload, parse, import)
  - Preview table (parsed transactions)
  - Confirm button → save to DB

□ [4h] Implement OCR parsers
  packages/shared/src/parsers/index.ts:
  
  BBVAParser.ts:
  - Extract date, description, amount from BBVA PDF
  - Handle multi-page PDFs
  - Date format normalization (BBVA uses DD/MM/YYYY)
  - Regex patterns for debit/credit detection
  
  SantanderParser.ts:
  - Similar to BBVA but different PDF structure
  - Santander uses MM/DD/YYYY sometimes
  - Handle "Saldo" vs "Movimiento" sections
  
  GenericCSVParser.ts:
  - Accept CSV uploads as fallback
  - Column mapping via OCRConfig
  - Delimiter auto-detection (,;|\t)

□ [2h] Create BFF API endpoint
  /apps/web/app/api/bancocheck/import:
  - POST /api/bancocheck/import → upload + parse → insert transactions
  - Batch insert to bank_transactions
  - Return import_id for tracking

□ [3h] Implement transaction list UI
  /apps/web/components/BancoCheck/TransactionList.tsx:
  - Sortable table: Date | Description | Amount | Status | Actions
  - Filter by date range, amount range, status
  - Pagination (50 rows/page)
  - Bulk actions: Mark as reviewed, Delete

□ [3h] Implement basic matching algorithm
  packages/shared/src/utils/bankMatching.ts:
  ```typescript
  interface MatchingInput {
    transaction: Transaction;
    candidateGastos?: Gasto[];  // From GastoCheck
    candidateCobras?: Cobro[];  // From CobraCheck
  }
  
  interface MatchResult {
    matchedEntityId: string | null;
    matchType: 'gasto' | 'cobra' | 'none';
    confidenceScore: number;    // 0-100
    reasoning: string;
  }
  
  export function findBestMatch(input: MatchingInput): MatchResult
  ```
  - Logic: amount ± 5% + description keyword matching
  - Confidence based on date proximity (within ±3 days)

□ [2h] Create BFF matching endpoint
  /apps/web/app/api/bancocheck/match:
  - POST → run matching algorithm on pending transactions
  - GET /auto → run auto-matching + return results
  - GET /:transactionId/candidates → list possible matches

□ [2h] Implement matching UI panel
  /apps/web/components/BancoCheck/MatchingPanel.tsx:
  - Show unmatched transactions (top 10)
  - Auto-suggested matches with confidence score
  - Manual search box → fuzzy search GastoCheck + CobraCheck
  - Accept/Reject/Skip buttons
  - Bulk match all auto-matches

□ [2h] Add transaction list to dashboard
  /apps/web/components/BancoCheck/Dashboard.tsx:
  - Recent imports (last 5)
  - Import status summary (Total | Matched | Pending)
  - Quick stats: Total inflows, Total outflows
  - Import new button → modal

□ [1h] Setup RLS policies for transactions
  - org-scoped read/write
  - Admin can see all transactions
  - User can only see their org's data

□ [1h] Create unit tests
  packages/shared/src/utils/__tests__/bankMatching.test.ts:
  - Test exact amount match
  - Test fuzzy amount match (±5%)
  - Test date proximity scoring

□ [1h] Create E2E test scenario
  apps/web/__tests__/e2e/bancocheck-import.spec.ts:
  - Upload test PDF → Verify parsed data → Confirm import
  - Verify transactions in DB
```

**Deliverables:**
- ✅ PDF upload working for 3 bank formats
- ✅ 2 OCR parsers tested + functional
- ✅ Transaction matching algorithm (basic)
- ✅ Dashboard showing import status
- ✅ 50+ transactions can be imported per session

**Blocking Issues:**
- ⚠️ Test PDFs needed for BBVA + Santander
- ⚠️ pdfjs library behavior with encrypted PDFs

**Est. Hours: 26h | Actual: —**

---

### FacturaCheck — CFDI Generation Base + SAT Validation
**Arquitecto: Juan | Dev: Daniel | QA: —**

**Tasker — Core Implementation:**
```
□ [3h] Create CFDI generator (template-based)
  packages/shared/src/services/cfdiGenerator.ts:
  ```typescript
  interface CFDIGeneratorInput {
    emisorRFC: string;
    receptorRFC: string;
    conceptos: ConceptoItem[];      // From GastoCheck
    issueDate: Date;
    validUntil?: Date;
    folio?: string;
  }
  
  interface CFDIOutput {
    xmlPayload: string;
    base64: string;
    digest: string;
  }
  
  export async function generateCFDI(input: CFDIGeneratorInput): Promise<CFDIOutput>
  ```
  - Use EJS or Handlebars to render XML template
  - Template: SAT CFDI 4.0 compliant structure
  - Support multiple conceptos (invoice line items)
  - Add UUIDs for tracking

□ [2h] Create CFDI XML template
  packages/shared/src/templates/cfdi-4.0.xml.ejs:
  - Standard CFDI 4.0 structure
  - Namespace declarations
  - Embed comprobante, emisor, receptor, conceptos
  - Add timbre placeholder (for PAC signature)
  - Comments for SAT validation rules

□ [3h] Setup SAT validation integration (mock)
  packages/shared/src/adapters/SATValidator.ts:
  - Abstract class for SAT compliance checks
  - Validate RFC format (both emisor + receptor)
  - Validate CURP if applicable
  - Validate amount fields (no decimals for certain rules)
  - Return ValidationResult with pass/fail + warnings

□ [2h] Implement validation UI
  /apps/web/components/FacturaCheck/ComplianceViewer.tsx:
  - Show validation results: ✅/❌ for each rule
  - SAT requirement checklist
  - Warning messages (orange) vs errors (red)
  - Suggest fixes if possible

□ [3h] Create BFF API endpoint
  /apps/web/app/api/facturacheck/generate:
  - POST → validate RFC + generate CFDI + persist to DB
  - Validate org ownership
  - Return factura_id + download link

□ [2h] Implement invoice builder UI (forms)
  /apps/web/components/FacturaCheck/InvoiceBuilder.tsx:
  - Step 1: Emisor/Receptor (pre-filled from org config)
  - Step 2: Select conceptos (fetch from GastoCheck)
  - Step 3: Review + adjust amounts
  - Step 4: Preview XML → Generate
  - Stepper component with validation

□ [2h] Create invoice list in dashboard
  /apps/web/components/FacturaCheck/Dashboard.tsx:
  - Recent invoices (draft + signed)
  - Filter by status, date
  - Actions: Edit (draft), Download, Cancel, Resend

□ [2h] Integrate GastoCheck data as conceptos
  packages/shared/src/hooks/useGastoAsFacturaConceptos.ts:
  - Fetch approved reimbursements
  - Map gasto fields → CFDI concepto fields
  - Handle unit conversions (if needed)
  - Allow manual adjustments

□ [1h] Setup encryption for CFDI payloads
  packages/shared/src/utils/encryption.ts:
  - Encrypt xmlPayload before storing in DB
  - Decrypt on retrieval (BFF only)
  - Use org-specific encryption key

□ [1h] Create unit tests
  packages/shared/src/utils/__tests__/cfdiGenerator.test.ts:
  - Test valid CFDI generation
  - Test invalid RFC handling
  - Test concepto calculation

□ [1h] Create E2E test scenario
  apps/web/__tests__/e2e/facturacheck-generate.spec.ts:
  - Login → Select expenses → Generate CFDI → Verify XML
```

**Deliverables:**
- ✅ CFDI generator working (unsigned)
- ✅ SAT validation mock running
- ✅ Invoice builder UI complete
- ✅ 10+ invoices can be drafted per session
- ✅ GastoCheck integration working

**Blocking Issues:**
- ⚠️ FACTUROO API key blocking signed CFDI generation (will implement Semana 5-6)
- ⚠️ SAT RFCS for testing (production vs sandbox)

**Est. Hours: 23h | Actual: —**

---

### Cross-Module Integration — Data Flow
**Arquitecto: Juan | Dev: Daniel**

**Tasker — Plumbing:**
```
□ [2h] Implement data sync utilities
  packages/shared/src/utils/dataSyncBridge.ts:
  - Fetch GastoCheck reimbursements for FlujoCheck inflows
  - Fetch CobraCheck collections for FlujoCheck outflows
  - Fetch GastoCheck expenses for FacturaCheck conceptos
  - Caching + stale-while-revalidate pattern

□ [2h] Create webhook listener stubs (Supabase Functions)
  supabase/functions/
  - on-gasto-approved.ts → trigger FlujoCheck update
  - on-cobro-completed.ts → trigger FlujoCheck + BancoCheck update
  - on-factura-signed.ts → trigger audit log
  - (Implementation: Semana 5-6)

□ [1h] Update BFF routing to expose cross-module queries
  /apps/web/app/api/dashboard/integrated-view:
  - GET → return combined view (FlujoCheck + BancoCheck + FacturaCheck)
  - For home dashboard of web app

□ [1h] Setup logging + monitoring dashboard
  packages/shared/src/logging/ModuleLogger.ts:
  - Structured logs for each module (flujocheck, bancocheck, facturacheck)
  - Send to Supabase audit_logs table
  - Include org_id, user_id, action, timestamp
```

**Deliverables:**
- ✅ Data sync utilities tested
- ✅ Webhook listener stubs ready for Semana 5
- ✅ BFF integrated view endpoint working

**Est. Hours: 6h | Actual: —**

---

### SEMANA 3-4 SUMMARY

| Task | Owner | Status | Hours | Notes |
|------|-------|--------|-------|-------|
| FlujoCheck Core | Juan → Dan | 🟡 | 28 | Capacity algorithm critical |
| BancoCheck OCR + Match | Juan → Dan | 🟡 | 26 | Test PDFs needed |
| FacturaCheck CFDI Base | Juan → Dan | 🟡 | 23 | SAT validation mock |
| Cross-Module Plumbing | Juan → Dan | 🟡 | 6 | Webhooks stub |
| **TOTAL** | — | **🟡** | **83** | — |

**Blocking Issues:**
- FACTUROO API key + CFDI signing (Semana 5 task)
- Test PDFs from partner banks

**Go/No-Go Criteria:**
- [ ] FlujoCheck dashboard live with real GastoCheck + CobraCheck data
- [ ] BancoCheck can import 100+ transactions
- [ ] FacturaCheck can generate unsigned CFDI
- [ ] All 3 modules show data in home dashboard
- [ ] Performance: <2s load time for each dashboard

---

---

## SEMANA 5-6: FEATURES & EXTERNAL INTEGRATIONS
**Dates: Aug 02 - Aug 15 | 95 hours**
**Goal: Credits engine, OAuth, distribution network, production-ready integrations**

### FlujoCheck — Credit Management + Amortization
**Arquitecto: Juan | Dev: Daniel | QA: —**

**Tasker — Feature Implementation:**
```
□ [3h] Design credit schema (SQL migration)
  - cash_flow_credits table
  - credit_id, cash_flow_id, amount, rate, term_weeks, status
  - amortization_schedule table (auto-generated)
  - payment_schedule_item: week_num, due_date, principal, interest, balance
  - RLS: org-scoped

□ [4h] Implement amortization calculation engine
  packages/shared/src/utils/amortizationCalc.ts:
  ```typescript
  interface CreditInput {
    principal: number;
    annualRate: number;        // e.g., 8% = 0.08
    termWeeks: number;          // 52 weeks = 1 year
    paymentFrequency: 'weekly' | 'bi-weekly' | 'monthly';
    gracePeriod?: number;       // Weeks before first payment
  }
  
  interface AmortizationSchedule {
    scheduleId: string;
    items: PaymentScheduleItem[];
    totalInterest: number;
    totalCost: number;
  }
  
  export function calculateAmortization(input: CreditInput): AmortizationSchedule
  ```
  - Logic: Calculate equal payments using PMT formula
  - Each payment: principal + interest
  - Track remaining balance

□ [3h] Create credit UI forms
  /apps/web/components/FlujoCheck/CreditApplication.tsx:
  - Input: Amount, annual rate, term weeks
  - Show amortization preview table
  - Submit → save credit record
  
  /apps/web/components/FlujoCheck/CreditPanel.tsx:
  - Show active credits (principal, rate, remaining balance)
  - Show payment schedule (upcoming due dates)
  - Track payments (mark as paid)

□ [3h] Integrate credits into capacity calculation
  packages/shared/src/utils/cashFlowCalc.ts (update):
  - Reduce available_amount by credit payment due this week
  - Add warning if capacity < credit payment amount
  - Calculate "debt service ratio" (outflows + credit payments) / inflows

□ [2h] Create BFF endpoints
  /apps/web/app/api/flujocheck/credits:
  - POST /create → save credit + generate schedule
  - GET /list → fetch active credits
  - PATCH /:creditId/pay → mark payment as completed
  - GET /:creditId/schedule → fetch amortization schedule

□ [2h] Add credit widget to dashboard
  /apps/web/components/FlujoCheck/Dashboard.tsx (update):
  - Active credits count + total debt
  - Upcoming credit payments (red alert if conflicting with capacity)
  - Link to credit management panel

□ [1h] Create unit tests
  packages/shared/src/utils/__tests__/amortizationCalc.test.ts:
  - Test PMT formula (known values)
  - Test schedule generation
  - Test remaining balance tracking

□ [1h] Create E2E test
  apps/web/__tests__/e2e/credit-management.spec.ts:
  - Create credit → Verify schedule → Mark payment → Verify balance
```

**Deliverables:**
- ✅ Credit management system fully functional
- ✅ Amortization calculations accurate
- ✅ Payment schedule tracked in DB
- ✅ Dashboard shows credit impact on capacity

**Est. Hours: 22h | Actual: —**

---

### BancoCheck — OAuth Integration (BBVA + Santander)
**Arquitecto: Juan | Dev: Daniel | QA: —**

**Tasker — External Integration:**
```
□ [3h] Setup OAuth flow abstraction
  packages/shared/src/adapters/BankOAuthAdapter.ts:
  ```typescript
  abstract class BankOAuthAdapter {
    abstract getAuthorizationUrl(state: string): string;
    abstract exchangeCode(code: string): Promise<OAuthToken>;
    abstract refreshToken(refreshToken: string): Promise<OAuthToken>;
    abstract fetchAccounts(token: OAuthToken): Promise<BankAccount[]>;
    abstract fetchTransactions(
      accountId: string,
      fromDate: Date,
      token: OAuthToken
    ): Promise<Transaction[]>;
  }
  ```

□ [3h] Implement BBVA OAuth adapter
  packages/shared/src/adapters/BBVAOAuthAdapter.ts:
  - Client ID + Secret from environment
  - Authorization endpoint: https://oauth.bbva.com/authorize
  - Token endpoint: https://oauth.bbva.com/token
  - Scopes: accounts, transactions
  - Map BBVA account structure to BankAccount schema

□ [3h] Implement Santander OAuth adapter
  packages/shared/src/adapters/SantanderOAuthAdapter.ts:
  - Client ID + Secret from environment
  - Use Belvo as intermediary (Santander doesn't have direct OAuth)
  - OR: Direct Santander endpoints if available
  - Map Santander transaction format

□ [3h] Create OAuth callback handler
  /apps/web/app/api/auth/bank-oauth/callback:
  - POST ← bank provider callback (code + state)
  - Exchange code for token
  - Save token to bank_oauth_tokens table (encrypted)
  - Verify state (CSRF protection)
  - Redirect to success page

□ [2h] Create OAuth initiation UI
  /apps/web/components/BancoCheck/OAuthModal.tsx:
  - Show bank options (BBVA, Santander, etc.)
  - "Connect" button → opens popup to bank auth
  - Listens for popup close → refresh account list
  - Handle errors gracefully

□ [2h] Implement token refresh flow
  packages/shared/src/utils/tokenRefresh.ts:
  - Cron job to refresh tokens before expiry
  - Refresh endpoint: refresh_token from secure storage
  - Handle refresh token rotation
  - Log failures to audit table

□ [2h] Create BFF endpoints
  /apps/web/app/api/bancocheck/oauth:
  - POST /connect/:bankProvider → initiate flow
  - GET /accounts → list connected accounts
  - POST /disconnect/:bankAccountId → revoke + cleanup
  - PATCH /sync/:bankAccountId → manual sync

□ [2h] Add connected accounts UI to dashboard
  /apps/web/components/BancoCheck/Dashboard.tsx (update):
  - Show connected bank accounts (name, balance, last sync)
  - "Connect new account" button
  - Manual sync button (refresh transactions)
  - Disconnect option (warning)

□ [1h] Setup automatic sync scheduling
  supabase/functions/bank-transaction-sync.ts:
  - Triggered via cron (daily at 8 AM)
  - Fetch new transactions from all connected accounts
  - Insert into bank_transactions table
  - Log sync status + error count

□ [1h] Create unit tests
  packages/shared/src/adapters/__tests__/OAuthAdapter.test.ts:
  - Mock BBVA + Santander endpoints
  - Test auth flow
  - Test token refresh

□ [1h] Create E2E test
  apps/web/__tests__/e2e/bank-oauth.spec.ts:
  - Initiate OAuth → Mock callback → Verify token saved → List accounts
```

**Deliverables:**
- ✅ BBVA OAuth working (sandbox)
- ✅ Santander OAuth working (sandbox)
- ✅ Automatic daily sync running
- ✅ 50+ transactions fetched per account per day

**Blocking Issues:**
- ⚠️ BBVA + Santander sandbox credentials (awaiting)
- ⚠️ OAuth callback domain configuration (production URL)

**Est. Hours: 24h | Actual: —**

---

### FacturaCheck — Distribution Engine (Email + WhatsApp)
**Arquitecto: Juan | Dev: Daniel | QA: —**

**Tasker — Distribution Network:**
```
□ [2h] Implement email distribution adapter
  packages/shared/src/adapters/EmailDistributionAdapter.ts:
  ```typescript
  interface EmailPayload {
    to: string;
    subject: string;
    body: string;
    attachments: { filename: string; content: Buffer }[];
    htmlTemplate?: 'factura_simple' | 'factura_detailed';
  }
  
  export async function sendFacturaEmail(payload: EmailPayload): Promise<SendResult>
  ```
  - Use SendGrid API (or Resend for simplicity)
  - Attach CFDI XML + PDF rendering
  - Track delivery status (webhook from SendGrid)

□ [2h] Implement WhatsApp distribution adapter
  packages/shared/src/adapters/WhatsAppDistributionAdapter.ts:
  ```typescript
  interface WhatsAppPayload {
    phoneNumber: string;          // +52...
    message: string;              // Template message
    attachments?: { url: string }[];
  }
  
  export async function sendFacturaWhatsApp(payload: WhatsAppPayload): Promise<SendResult>
  ```
  - Use WhatsApp Business API (Twilio or Meta)
  - Support templates for compliance
  - Track read/delivery status

□ [2h] Create distribution config UI
  /apps/web/components/FacturaCheck/DistributionConfig.tsx:
  - Toggle email on/off
  - Toggle WhatsApp on/off
  - Template editor (simple HTML)
  - Sender email + phone
  - Test send button

□ [3h] Create CFDI signing integration (FACTUROO)
  packages/shared/src/adapters/FacturooAdapter.ts:
  ```typescript
  interface FacturooSignRequest {
    cfdi: string;                 // XML payload
    issuerRFC: string;
  }
  
  interface FacturooSignResponse {
    signedCFDI: string;            // XML with signature
    folio: string;
    selloDigital: string;
  }
  
  export async function signCFDI(req: FacturooSignRequest): Promise<FacturooSignResponse>
  ```
  - Submit XML to FACTUROO PAC
  - Receive signed CFDI + folio
  - Store both in DB
  - Return to user

□ [2h] Create PDF rendering for CFDI
  packages/shared/src/utils/cfdiToPdf.ts:
  - Convert signed CFDI XML → readable PDF
  - Use puppeteer or similar
  - Include QR code (SAT compliance)
  - Add company branding

□ [2h] Create distribution API endpoints
  /apps/web/app/api/facturacheck/distribute:
  - POST /sign → call FACTUROO to sign CFDI
  - POST /send → send via email + WhatsApp
  - GET /logs/:facturaId → delivery status
  - GET /templates → list distribution templates

□ [2h] Add distribution workflow to dashboard
  /apps/web/components/FacturaCheck/Dashboard.tsx (update):
  - Draft factura → Sign button → Send modal → Confirm
  - Show delivery status badge (pending, sent, bounced)
  - Log view with date/time/channel

□ [1h] Setup delivery webhooks (SendGrid/WhatsApp)
  /apps/web/app/api/webhooks/email-delivery:
  - Receive delivery status updates
  - Update factura_distribution_logs table
  - Trigger alerts if bounced

□ [1h] Create unit tests
  packages/shared/src/adapters/__tests__/DistributionAdapter.test.ts:
  - Mock email + WhatsApp API calls
  - Test payload construction
  - Test error handling

□ [1h] Create E2E test
  apps/web/__tests__/e2e/factura-distribution.spec.ts:
  - Create + Sign + Distribute factura
  - Verify email/WhatsApp sent
  - Verify delivery log updated
```

**Deliverables:**
- ✅ CFDI signing via FACTUROO working
- ✅ PDF rendering working
- ✅ Email distribution working (SendGrid)
- ✅ WhatsApp distribution working (Twilio/Meta)
- ✅ Delivery tracking in DB

**Blocking Issues:**
- ⚠️ FACTUROO API key + sandbox
- ⚠️ SendGrid API key + verified sender
- ⚠️ WhatsApp Business API credentials
- ⚠️ SMS/WhatsApp delivery setup

**Est. Hours: 19h | Actual: —**

---

### Cross-Module Integration — Event Hooks
**Arquitecto: Juan | Dev: Daniel**

**Tasker — Webhook Implementation:**
```
□ [3h] Implement webhook handlers
  supabase/functions/:
  - on-gasto-approved.ts → fetch gasto → update FlujoCheck inflows
  - on-cobro-completed.ts → fetch cobro → update FlujoCheck outflows + BancoCheck if matched
  - on-factura-signed.ts → log to audit
  - on-bank-sync-complete.ts → notify dashboard

□ [2h] Setup webhook trigger chains
  Supabase Triggers:
  - gastos.status = 'approved' → publish event
  - cobros.status = 'completed' → publish event
  - facturas.status = 'signed' → publish event
  - bank_transactions inserted → publish event

□ [2h] Create event schema
  packages/shared/src/types/events.ts:
  - EventPayload union type
  - EventBus interface
  - Retry logic for failed hooks

□ [1h] Add error handling + DLQ (Dead Letter Queue)
  - Failed events → supabase_event_dlq table
  - Alerting if DLQ size > 100
```

**Deliverables:**
- ✅ Event hooks wired + tested
- ✅ Real-time sync working across modules

**Est. Hours: 8h | Actual: —**

---

### SEMANA 5-6 SUMMARY

| Task | Owner | Status | Hours | Notes |
|------|-------|--------|-------|-------|
| FlujoCheck Credits | Juan → Dan | 🟡 | 22 | Amortization critical |
| BancoCheck OAuth | Juan → Dan | 🟡 | 24 | Bank creds blocking |
| FacturaCheck Distribution | Juan → Dan | 🟡 | 19 | FACTUROO + Email keys |
| Event Hooks | Juan → Dan | 🟡 | 8 | — |
| **TOTAL** | — | **🟡** | **73** | — |

**Blocking Issues:**
- FACTUROO, SendGrid, WhatsApp Business credentials
- BBVA + Santander OAuth sandbox setup

**Go/No-Go Criteria:**
- [ ] Credit system fully operational
- [ ] 2+ banks connected via OAuth
- [ ] Invoices signing + distribution working
- [ ] Real-time event propagation across modules
- [ ] <500ms webhook response time

---

---

## SEMANA 7-8: REFINEMENT & COMPLIANCE
**Dates: Aug 16 - Aug 29 | 85 hours**
**Goal: Advanced projections, SAT compliance, transaction matching intelligence, admin tooling**

### FlujoCheck — Advanced Projections + Optimization
**Arquitecto: Juan | Dev: Daniel | QA: —**

**Tasker — Refinement:**
```
□ [4h] Implement 12-week projection algorithm
  packages/shared/src/utils/projectionCalc.ts:
  ```typescript
  interface ProjectionConfig {
    historicalWeeks: number;      // e.g., 13 weeks of data
    forecastMethod: 'linear' | 'seasonal' | 'ml';
    confidenceThreshold: number;  // Default 0.7
  }
  
  interface WeeklyProjection {
    weekNumber: number;
    projectedInflow: number;
    projectedOutflow: number;
    projectedBalance: number;
    confidence: number;           // 0-1
    factors: ProjectionFactor[];  // Why this projection
  }
  
  export function project52Weeks(
    historicalData: Transaction[],
    config: ProjectionConfig
  ): WeeklyProjection[]
  ```
  - Linear: straight trend line
  - Seasonal: detect weekly/monthly patterns
  - ML (optional): use TensorFlow.js for ARIMA

□ [2h] Add scenario planning UI
  /apps/web/components/FlujoCheck/ScenarioPlanning.tsx:
  - Base case (current trend)
  - Optimistic case (+15% inflows)
  - Pessimistic case (-20% inflows)
  - Custom case (adjust any week manually)
  - Show all scenarios overlay on chart

□ [2h] Implement alert system
  packages/shared/src/utils/cashFlowAlerts.ts:
  - Alert type: "Negative cash flow week 8"
  - Alert severity: warning, critical
  - Recommendations: "Request credit by week 7"
  - Send via email/in-app notification

□ [2h] Create optimization recommendations engine
  packages/shared/src/utils/optimizationEngine.ts:
  ```typescript
  interface OptimizationRecommendation {
    type: 'adjust_credit' | 'accelerate_collections' | 'defer_payment';
    impactAmount: number;
    rationale: string;
    implementation: string;
  }
  
  export function recommendOptimizations(
    projections: WeeklyProjection[]
  ): OptimizationRecommendation[]
  ```

□ [3h] Create detailed projection UI
  /apps/web/components/FlujoCheck/ProjectionDetail.tsx:
  - Drill-down by week
  - Show factors affecting projection
  - Edit assumptions (rerun projection)
  - Export projection report (PDF)

□ [2h] Create year-over-year comparison
  /apps/web/components/FlujoCheck/YoYComparison.tsx:
  - Compare current year projection vs actual last year
  - Highlight improvements/regressions
  - Identify seasonal patterns

□ [1h] Create unit tests
  packages/shared/src/utils/__tests__/projectionCalc.test.ts:
  - Test linear projection
  - Test seasonal detection
  - Test alert thresholds

□ [1h] Create E2E test
  apps/web/__tests__/e2e/projection-scenario.spec.ts:
  - Create scenario → Adjust week → View impact → Export PDF
```

**Deliverables:**
- ✅ 52-week projection running
- ✅ 3 scenario planning working
- ✅ Alert system operational
- ✅ Optimization recommendations showing

**Est. Hours: 18h | Actual: —**

---

### BancoCheck — Intelligent Matching + Admin Controls
**Arquitecto: Juan | Dev: Daniel | QA: —**

**Tasker — Refinement:**
```
□ [4h] Implement ML-based matching (optional upgrade)
  packages/shared/src/utils/advancedMatching.ts:
  ```typescript
  interface MatchingContext {
    transaction: Transaction;
    gastos: Gasto[];
    cobros: Cobro[];
    historicalMatches: Match[];   // Training data
  }
  
  interface AdvancedMatchResult extends MatchResult {
    alternativeMatches: Match[];
    explainability: string;       // Why this match
  }
  
  export function findBestMatchAdvanced(ctx: MatchingContext): AdvancedMatchResult
  ```
  - Use historical matching patterns
  - Weight by description + date + amount combinations
  - Handle partial matches (split transactions)

□ [2h] Create matching admin UI
  /apps/web/components/BancoCheck/MatchingAdmin.tsx:
  - Review unmatched transactions (all)
  - Manual search + match
  - Batch operations (mark as reviewed)
  - Matching rules editor (custom rules per org)

□ [3h] Implement duplicate detection
  packages/shared/src/utils/duplicateDetection.ts:
  - Detect if same transaction imported twice
  - Check: same amount ± 0.1%, same date, similar description
  - Merge or mark as duplicate
  - Log action in audit table

□ [2h] Create transaction reconciliation report
  /apps/web/components/BancoCheck/ReconciliationReport.tsx:
  - Summary: Total imported, Matched, Unmatched, Duplicates
  - Exceptions: Large transactions, Unusual descriptions
  - Export reconciliation report (PDF)

□ [2h] Create admin dashboard for BancoCheck
  /apps/web/app/(modules)/bancocheck/admin:
  - View all org's bank accounts
  - View all transactions (not just current org)
  - Manual transaction edit
  - Bulk re-matching
  - Audit log of changes

□ [2h] Setup monitoring + alerting
  packages/shared/src/logging/BankChecklogs.ts:
  - Log all matching decisions
  - Alert if unmatched % > 30% of daily imports
  - Alert if duplicate % > 5%

□ [1h] Create unit tests
  packages/shared/src/utils/__tests__/advancedMatching.test.ts:
  - Test partial matches
  - Test historical pattern learning
  - Test duplicate detection

□ [1h] Create E2E test
  apps/web/__tests__/e2e/bank-reconciliation.spec.ts:
  - Import transactions → Verify matches → Run reconciliation → Export report
```

**Deliverables:**
- ✅ Advanced matching algorithm working
- ✅ Admin dashboard operational
- ✅ Reconciliation reports exportable
- ✅ Duplicate detection running

**Est. Hours: 19h | Actual: —**

---

### FacturaCheck — SAT Compliance + Audit Trail
**Arquitecto: Juan | Dev: Daniel | QA: —**

**Tasker — Compliance:**
```
□ [3h] Implement comprehensive SAT validator
  packages/shared/src/validators/SATComplianceValidator.ts:
  - RFC format: "^[A-ZÑ&]{3,4}\\d{6}(?:[A-V0-9]){3}$"
  - CURP format validation
  - Amount field rules (no excess decimals in certain cases)
  - Fecha format (ISO 8601)
  - Validate concepto types against SAT catalog
  - Version 4.0 compliance checks

□ [2h] Create compliance checklist UI
  /apps/web/components/FacturaCheck/ComplianceChecklist.tsx:
  - Show all SAT requirements
  - ✅/❌ status for each
  - Hover explanations for failures
  - Link to SAT documentation

□ [2h] Implement cancellation workflow
  packages/shared/src/utils/cfdiCancellation.ts:
  ```typescript
  interface CancellationRequest {
    cfdi_id: string;
    folio: string;
    reason: 'Comprobante globalizado' | 'Operación cancelada' | etc.
  }
  
  export async function requestCancellation(req: CancellationRequest)
  ```
  - Submit to PAC for cancellation
  - Track status (pending, approved, rejected)
  - Generate replacement CFDI if needed

□ [2h] Create audit trail UI
  /apps/web/components/FacturaCheck/AuditTrail.tsx:
  - Timeline of all CFDI actions (created, signed, sent, cancelled)
  - Who performed action + timestamp
  - Change log (before/after values)
  - Download audit report (PDF)

□ [3h] Create backup + versioning system
  packages/shared/src/utils/cfdiVersioning.ts:
  - Keep all CFDI versions (draft → signed → sent)
  - Immutable storage (cannot overwrite old versions)
  - Allow rollback to draft (create new version)
  - 7-year retention requirement per SAT

□ [2h] Implement automatic compliance checks
  supabase/functions/compliance-check.ts:
  - Triggered before CFDI signing
  - Return compliance report
  - Block signing if critical failures
  - Allow "force sign" with warning (admin only)

□ [2h] Create compliance dashboard
  /apps/web/components/FacturaCheck/ComplianceDashboard.tsx:
  - Org compliance score (% passing checks)
  - Trend: last 30 days
  - Non-compliant invoices list
  - Action items

□ [1h] Create unit tests
  packages/shared/src/validators/__tests__/SATValidator.test.ts:
  - Test RFC validation (valid + invalid)
  - Test CFDI structure validation
  - Test cancellation rules

□ [1h] Create E2E test
  apps/web/__tests__/e2e/factura-compliance.spec.ts:
  - Create factura → Verify compliance → Sign → Cancel → Verify audit trail
```

**Deliverables:**
- ✅ SAT compliance validator working
- ✅ Cancellation workflow operational
- ✅ Audit trail immutable + searchable
- ✅ Compliance score tracking

**Est. Hours: 19h | Actual: —**

---

### Cross-Module — Integration Refinement
**Arquitecto: Juan | Dev: Daniel**

**Tasker — Convergence:**
```
□ [3h] Create unified dashboard view
  /apps/web/app/(modules)/dashboard/integrated:
  - Show FlujoCheck projections + alerts
  - Show recent BancoCheck transactions + unmatched count
  - Show pending FacturaCheck actions
  - Show overall compliance score
  - Unified alerts (warning, critical)

□ [2h] Implement cross-module data validation
  packages/shared/src/utils/crossModuleValidation.ts:
  - Verify totals match (BancoCheck inflows = Flujo inflows)
  - Verify no missing transactions
  - Alert on discrepancies

□ [2h] Create data quality dashboard
  /apps/web/components/DataQuality/Dashboard.tsx:
  - Data freshness (last sync times)
  - Completeness (% data coverage)
  - Consistency (cross-module checks)
  - Issues table (with auto-fix options)

□ [1h] Setup monitoring + alerting
  - Alert if FlujoCheck data > 24h stale
  - Alert if BancoCheck sync fails
  - Alert if FacturaCheck compliance score drops
```

**Deliverables:**
- ✅ Integrated dashboard live
- ✅ Cross-module validation running
- ✅ Data quality score tracking

**Est. Hours: 8h | Actual: —**

---

### SEMANA 7-8 SUMMARY

| Task | Owner | Status | Hours | Notes |
|------|-------|--------|-------|-------|
| FlujoCheck Projections | Juan → Dan | 🟡 | 18 | Optional ML upgrade |
| BancoCheck Matching | Juan → Dan | 🟡 | 19 | Admin tooling critical |
| FacturaCheck Compliance | Juan → Dan | 🟡 | 19 | SAT compliance core |
| Cross-Module Refinement | Juan → Dan | 🟡 | 8 | Convergence dashboard |
| **TOTAL** | — | **🟡** | **64** | — |

**Go/No-Go Criteria:**
- [ ] FlujoCheck 52-week projection accurate within ±10%
- [ ] BancoCheck matching accuracy > 90%
- [ ] FacturaCheck compliance score > 95%
- [ ] Integrated dashboard load time < 2s
- [ ] 0 P0 compliance issues

---

---

## SEMANA 9-10: INTEGRATION LAYER & CONVERGENCE
**Dates: Aug 30 - Sep 12 | 100 hours**
**Goal: Full 5-way integration, unified workflows, production stability**

### MASTER INTEGRATION: GastoCheck ↔ FlujoCheck ↔ BancoCheck ↔ FacturaCheck ↔ CobraCheck

**Arquitecto: Juan**

**Tasker — Full Convergence:**

```
WORKFLOW 1: REIMBURSEMENT FLOW (GastoCheck → FlujoCheck → FacturaCheck → BancoCheck)
□ [5h] Implement end-to-end reimbursement workflow
  User flow:
  1. Comprador submits gasto (GastoCheck)
  2. Contador approves → updates FlujoCheck inflows
  3. Admin reviews → triggers FacturaCheck (generate CFDI)
  4. FacturaCheck signs + distributes invoice
  5. Comprador receives payment (BancoCheck matches transaction)
  6. Audit log tracks entire journey

  Database transactions:
  - gastos.status = 'approved' → trigger flow_projection recalc
  - facturas.status = 'signed' → increment flow_inflows
  - bank_transactions matched to gasto → mark gasto as 'paid'

  Code: packages/shared/src/workflows/reimbursementFlow.ts
  - orchestrate() function
  - error handling + rollback
  - event emission at each step

□ [5h] Implement cash collection flow (CobraCheck → FlujoCheck → BancoCheck)
  User flow:
  1. Cobrador collects payment (CobraCheck)
  2. Payment status = 'collected' → updates FlujoCheck outflows
  3. Banco deposits to account (BancoCheck)
  4. BancoCheck auto-matches to CobraCheck cobro
  5. Update cobro status → 'reconciled'
  
  Validation:
  - Cobrado amount ± 2% vs BancoCheck amount
  - Timestamp within ±2 business days

  Code: packages/shared/src/workflows/collectionFlow.ts

□ [5h] Implement supplier payment flow (FlujoCheck → BancoCheck → FacturaCheck)
  User flow:
  1. Supplier invoice received (FacturaCheck or manual entry)
  2. Due date approaches → alert in FlujoCheck
  3. If capacity available: suggest payment date in FlujoCheck
  4. Admin approves → pay from bank (BancoCheck)
  5. Bank payment matched to supplier invoice

  Code: packages/shared/src/workflows/paymentFlow.ts

WORKFLOW 2: COMPLIANCE AUDIT TRAIL
□ [4h] Implement immutable audit log (cross-module)
  - All module actions logged
  - Timestamp + user + org
  - Before/after values for sensitive fields
  - Cannot be modified (append-only table)
  - Support full-text search

  Schema: supabase audit_logs_extended table
  - Add indexes for date, org_id, action_type

□ [3h] Create audit dashboard
  /apps/web/components/Audit/Dashboard.tsx:
  - Timeline of all actions (6-month view)
  - Filter by date, user, org, action_type
  - Export audit report (SAT compliance)
  - Alert on suspicious patterns

WORKFLOW 3: ALERT & NOTIFICATION SYSTEM
□ [3h] Implement unified alert system
  packages/shared/src/utils/alertEngine.ts:
  - Alert priority: info, warning, critical
  - Alert destinations: in-app, email, SMS
  - Delivery preferences per user/org
  - Delivery status tracking

  Alert types:
  - FlujoCheck: Negative cash week, credit due, projection update
  - BancoCheck: Large transaction, duplicate detected, sync failed
  - FacturaCheck: Compliance failure, cancellation approved, delivery bounced
  - GastoCheck: Reimbursement approved, payment received
  - CobraCheck: Collection confirmed, payment overdue

□ [3h] Create notification UI
  /apps/web/components/Notifications/NotificationCenter.tsx:
  - Bell icon with unread count
  - Dropdown list of recent notifications
  - Mark as read / dismiss
  - Settings for alert preferences

WORKFLOW 4: UNIFIED DATA EXPORT
□ [4h] Implement multi-module data export
  packages/shared/src/exporters/:
  - ReportExporter.ts (base class)
  - CashFlowReporter.ts (weekly, monthly, annual reports)
  - BankReconciliationReporter.ts (bank statement vs system)
  - ComplianceReporter.ts (SAT audit ready)
  - IntegratedFinancialReporter.ts (P&L, balance sheet)

  Export formats:
  - PDF (for sharing)
  - CSV (for Excel)
  - JSON (for integrations)

□ [3h] Create report builder UI
  /apps/web/components/Reports/ReportBuilder.tsx:
  - Select modules to include
  - Select date range
  - Select format (PDF/CSV/JSON)
  - Preview before download
  - Schedule recurring reports (email)

WORKFLOW 5: PERFORMANCE & OPTIMIZATION
□ [3h] Implement caching layer (Redis)
  packages/shared/src/cache/:
  - CacheService (TTL-based)
  - Cache projections (recalc weekly)
  - Cache transaction matches (recalc daily)
  - Cache compliance scores (recalc hourly)
  - Cache org data (recalc on user login)

□ [2h] Implement pagination + lazy loading
  - All large tables paginate (50 rows/page)
  - Virtual scrolling for transaction lists
  - Infinite scroll for feed-style views

□ [2h] Add database query optimization
  - Add indexes for frequent queries
  - Add materialized views for complex aggregations
  - Query analysis + tuning

WORKFLOW 6: ERROR RECOVERY & ROLLBACK
□ [4h] Implement transactional workflows
  packages/shared/src/utils/transactionManager.ts:
  - Begin transaction
  - Execute workflow steps
  - If any step fails: rollback all
  - Log failure reason
  - Create manual recovery task

  Workflow steps that require rollback:
  - Gasto approved → FlujoCheck update → FacturaCheck generation
  - Payment made → BancoCheck match → CobraCheck reconciliation

WORKFLOW 7: MOBILE ↔ WEB SYNC
□ [3h] Implement background sync (Expo)
  apps/cobra-mobile/src/sync/:
  - Background task runs every 6 hours
  - Fetch latest data for CobraCheck + GastoCheck
  - Push notifications on important events
  - Handle offline mode (queue actions)

□ [2h] Implement real-time sync (Supabase Realtime)
  - Subscribe to org data changes
  - Auto-refresh on web/mobile when other user updates
  - Handle sync conflicts (last-write-wins + logging)
```

**Deliverables:**
- ✅ 5-way workflow fully integrated
- ✅ Audit log immutable + searchable
- ✅ Alert system operational
- ✅ Multi-module export working
- ✅ Performance optimizations applied
- ✅ Mobile ↔ Web real-time sync

**Est. Hours: 66h | Actual: —**

---

### Daniel QA — Integration Testing
**Owner: Daniel**

**Tasker — QA Phase:**

```
□ [8h] Create E2E test suite for each workflow
  apps/web/__tests__/e2e/workflows/:
  - reimbursement-flow.spec.ts (8 scenarios)
  - collection-flow.spec.ts (6 scenarios)
  - payment-flow.spec.ts (5 scenarios)
  - Each scenario: valid path + error path

□ [4h] Create performance tests
  apps/web/__tests__/perf/:
  - Dashboard load time < 2s (target)
  - Report generation < 10s
  - Transaction list scroll smooth (60fps)

□ [3h] Create mobile ↔ web sync tests
  apps/cobra-mobile/__tests__/e2e/:
  - Edit data on mobile → verify on web
  - Edit data on web → verify on mobile
  - Handle offline then online

□ [3h] Manual testing checklist
  - Sign up new org → go through full workflow
  - 3 users (Admin, Contador, Cobrador) in same org
  - Verify all notifications delivered
  - Verify all reports generated correctly

□ [2h] Load testing
  - 100 concurrent users
  - Target < 5s response time for all endpoints
  - Database connection pooling working
```

**Deliverables:**
- ✅ 50+ E2E tests passing
- ✅ All workflows tested + documented
- ✅ Performance benchmarks met
- ✅ Mobile ↔ Web sync verified
- ✅ Load testing successful

**Est. Hours: 20h | Actual: —**

---

### SEMANA 9-10 SUMMARY

| Task | Owner | Status | Hours | Notes |
|------|-------|--------|-------|-------|
| Full 5-Way Integration | Juan | 🟡 | 66 | Core of v2.0 |
| QA + Performance | Daniel | 🟡 | 20 | Critical before launch |
| **TOTAL** | — | **🟡** | **86** | — |

**Blocking Issues:**
- None expected (all modules should be ready)

**Go/No-Go Criteria:**
- [ ] All 5 workflows tested end-to-end
- [ ] Audit log for SAT compliance complete
- [ ] Alerts delivering correctly
- [ ] Export formats validated by accountant
- [ ] Mobile ↔ Web sync 100% reliable
- [ ] Performance benchmarks achieved
- [ ] P0 bugs = 0

---

---

## SEMANA 11-12: QA + LAUNCH v2.0
**Dates: Sep 13 - Sep 25 | 75 hours**
**Goal: Final QA, performance optimization, production launch**

### QA PHASE 1: FULL SYSTEM TESTING
**Owner: Daniel + Juan**

```
□ [5h] Regression testing (all modules)
  - FlujoCheck: Create 50 flows, verify projections
  - BancoCheck: Import 200+ transactions, verify matching accuracy
  - FacturaCheck: Generate 30 invoices, verify SAT compliance
  - GastoCheck: Create 100 reimbursements, verify reimbursement flow
  - CobraCheck: Create 50 collections, verify collection flow

□ [4h] Security testing
  - RLS policies verified (can't access other org's data)
  - JWT token validation
  - SQL injection prevention (ORM protection)
  - XSS prevention (sanitization)
  - CSRF protection (state verification)

□ [3h] Data integrity testing
  - Start with empty DB
  - Create test data (50 orgs × 10 users each)
  - Run full workflows
  - Verify data consistency across tables
  - Verify audit trail completeness

□ [3h] Accessibility testing
  - WCAG 2.1 Level AA compliance
  - Screen reader testing (components)
  - Keyboard navigation
  - Color contrast ratios

□ [3h] Mobile testing (iOS + Android)
  - CobraCheck on iOS simulator
  - CobraCheck on Android emulator
  - Offline mode working
  - Background sync working
  - Notifications delivering

□ [2h] Browser compatibility
  - Chrome, Firefox, Safari, Edge
  - Latest versions
  - Mobile browsers (iOS Safari, Chrome Mobile)

□ [2h] API testing (all 50+ endpoints)
  - Correct response codes
  - Correct response formats
  - Error messages helpful
  - Rate limiting working

□ [2h] Load testing (production simulation)
  - 1000 concurrent users
  - Measure response times
  - Measure database load
  - Identify bottlenecks
```

**Deliverables:**
- ✅ 0 P0 bugs
- ✅ <5 P1 bugs (cosmetic/nice-to-have)
- ✅ Performance benchmarks met
- ✅ Accessibility score > 90
- ✅ Security audit passed

**Est. Hours: 24h | Actual: —**

---

### QA PHASE 2: ACCOUNTANT VALIDATION
**Owner: Daniel + External Accountant**

```
□ [4h] Prepare test environment
  - Seed realistic financial data
  - Create test orgs (3 types: small, medium, large company)
  - Document test data (transactions, invoices, credits)

□ [4h] Accountant acceptance testing
  - Generate all report types
  - Verify calculations match accounting standards
  - Verify CFDI generation matches expectations
  - Verify SAT compliance rules enforced
  - Verify audit trail meets requirements

□ [2h] Tax compliance review
  - RFC validation working
  - CURP validation working
  - Concepto validation against SAT catalog
  - Timestamp accuracy (SAT requirement: ±2 hours)

□ [2h] Reconciliation verification
  - Bank reconciliation reports accurate
  - Trial balance matches
  - GL entries correct

□ [2h] Documentation review
  - User guides for each module
  - Compliance documentation
  - API documentation
  - Data model documentation
```

**Deliverables:**
- ✅ Accountant sign-off on calculations
- ✅ SAT compliance verified
- ✅ User documentation complete
- ✅ API documentation complete

**Est. Hours: 14h | Actual: —**

---

### FINAL OPTIMIZATION
**Owner: Juan + Daniel**

```
□ [3h] Database tuning
  - Add missing indexes
  - Analyze query performance
  - Optimize N+1 queries
  - Set up query monitoring

□ [3h] Frontend optimization
  - Code splitting (lazy load modules)
  - Image optimization (compression, WebP)
  - CSS optimization (minification, tree-shaking)
  - JavaScript minification
  - Measure Core Web Vitals

□ [2h] API optimization
  - Batch endpoints where possible
  - Implement request deduplication
  - Setup response caching headers
  - Measure API response times

□ [2h] Infrastructure optimization
  - Supabase connection pooling
  - Database replica for read-heavy queries
  - CDN for static assets
  - Set up monitoring + alerting

□ [1h] Deployment checklist
  - Environment variables set in production
  - Database migrations tested on staging
  - Backups configured
  - Rollback plan documented
```

**Deliverables:**
- ✅ Performance < 2s for all dashboard loads
- ✅ Core Web Vitals: LCP < 2.5s, FID < 100ms, CLS < 0.1
- ✅ Monitoring + alerting setup
- ✅ Rollback procedure tested

**Est. Hours: 11h | Actual: —**

---

### LAUNCH PREPARATION
**Owner: Juan + Daniel**

```
□ [3h] Deployment dry-run (staging)
  - Deploy to staging environment
  - Run full E2E test suite
  - Verify data migration
  - Verify webhooks working
  - Verify monitoring + alerting

□ [2h] Cutover plan
  - Data migration strategy (GastoCheck v1 → v2)
  - User communication (email, in-app banner)
  - Support team training
  - Monitor 24/7 for first 72 hours

□ [2h] Launch timeline
  - Go/No-Go decision (48h before launch)
  - Launch time (Saturday 6 AM if issues, Tuesday 10 AM if stable)
  - Rollback trigger (P0 bug, >50 error rate)
  - Daily updates for first week

□ [2h] Marketing + communication
  - Release notes (features, fixes, known issues)
  - Upgrade guide (v1 → v2)
  - FAQ for users
  - Email announcement
  - In-app notifications

□ [1h] Post-launch support
  - First week: Juan on-call 24/7
  - Daniel on-call 24/7
  - Daily sync calls (9 AM, 3 PM)
  - Log all issues + create follow-up tasks
```

**Deliverables:**
- ✅ Staging deployment tested
- ✅ Cutover plan documented
- ✅ Data migration verified
- ✅ Support team trained
- ✅ Launch timeline confirmed
- ✅ Release notes published
- ✅ User communication sent

**Est. Hours: 10h | Actual: —**

---

### SEMANA 11-12 SUMMARY

| Task | Owner | Status | Hours | Notes |
|------|-------|--------|-------|-------|
| Full System QA | Daniel | 🟡 | 24 | 0 P0 target |
| Accountant Validation | Daniel + Extern | 🟡 | 14 | SAT sign-off |
| Final Optimization | Juan + Dan | 🟡 | 11 | Performance critical |
| Launch Preparation | Juan + Dan | 🟡 | 10 | Cutover + comms |
| **TOTAL** | — | **🟡** | **59** | — |

**Go/No-Go Criteria:**
- [ ] 0 P0 bugs
- [ ] <5 P1 bugs
- [ ] Accountant sign-off obtained
- [ ] Performance benchmarks achieved
- [ ] All documentation complete
- [ ] Support team trained
- [ ] Rollback plan tested
- [ ] Launch decision: GO

---

---

## CONSOLIDATED ROADMAP SUMMARY

### Timeline Overview
```
Week 1-2  (Jul 04-18):   Setup + Foundation      58 hours  ✓ Scaffolding
Week 3-4  (Jul 19-Aug01): Core Engines            83 hours  ✓ Data + Algorithms
Week 5-6  (Aug 02-15):   Features + Integrations 73 hours  ✓ External APIs
Week 7-8  (Aug 16-29):   Refinement + Compliance 64 hours  ✓ Advanced features
Week 9-10 (Aug 30-Sep12): Full Integration       86 hours  ✓ 5-Way convergence
Week 11-12(Sep 13-25):   QA + Launch            59 hours  ✓ Release v2.0
---------------------------------------------------------
TOTAL:                  12 weeks                483 hours
```

### Critical Path Dependencies
```
1. SETUP FOUNDATION (Semana 1-2) ← Blocks everything
   ├─ FlujoCheck types + DB ← needed for projection
   ├─ BancoCheck types + DB ← needed for OCR
   └─ FacturaCheck types + DB ← needed for CFDI

2. CORE ENGINES (Semana 3-4) ← Depends on #1
   ├─ FlujoCheck dashboard ← needed for capacity in Semana 5
   ├─ BancoCheck import ← needed for matching in Semana 5
   └─ FacturaCheck CFDI ← needed for signing in Semana 5

3. EXTERNAL INTEGRATIONS (Semana 5-6) ← Depends on #2
   ├─ BancoCheck OAuth ← needed for auto-sync
   └─ FacturaCheck FACTUROO ← needed for signing

4. REFINEMENT (Semana 7-8) ← Depends on #3
   ├─ Advanced projections ← needed for v2 feature set
   ├─ Smart matching ← needed for compliance
   └─ SAT compliance ← needed for certification

5. INTEGRATION (Semana 9-10) ← Depends on #4
   ├─ 5-way workflows ← core value proposition
   ├─ Audit trail ← SAT requirement
   └─ Alerts + export ← user experience

6. QA + LAUNCH (Semana 11-12) ← Depends on #5
   ├─ Full regression ← must pass before launch
   └─ Accountant sign-off ← must have before launch
```

### Resource Allocation
```
Owner: Juan (Arquitectura)
- Semana 1-2: Design all schemas + types (30h)
- Semana 3-4: Design algorithms (20h)
- Semana 5-6: Design external integrations (15h)
- Semana 7-8: Design advanced features (15h)
- Semana 9-10: Orchestrate 5-way integration (25h)
- Semana 11-12: Launch planning + go-live (8h)
TOTAL JUAN: ~113 hours (40% of total)

Owner: Daniel (Implementación)
- Semana 1-2: Implement components + hooks (28h)
- Semana 3-4: Implement UI + algorithms (63h)
- Semana 5-6: Implement external APIs (58h)
- Semana 7-8: Implement refinements (49h)
- Semana 9-10: QA + integration testing (61h)
- Semana 11-12: QA + launch (51h)
TOTAL DANIEL: ~310 hours (64% of total)

Shared: Code reviews, planning, testing
TOTAL SHARED: ~60 hours (12% of total)
```

### Key Blocking Issues (Managed Risks)
```
BLOCKING (Must resolve before launch):
- [ ] FACTUROO API key + sandbox environment
- [ ] BBVA + Santander OAuth sandbox credentials
- [ ] SendGrid API key + verified sender domain
- [ ] WhatsApp Business API credentials (Twilio/Meta)
- [ ] SAT test RFCs for compliance testing
- [ ] PDF library decision + license

HIGH PRIORITY (Should resolve ASAP):
- [ ] External accountant for compliance sign-off
- [ ] Test PDFs from BBVA + Santander
- [ ] Mobile device for iOS testing (current: Android only)

MEDIUM PRIORITY (Can work around if needed):
- [ ] ML library for advanced matching (optional feature)
- [ ] PDF rendering library performance (may need fallback)
```

### Success Metrics
```
Functional:
✓ All 5 workflows operational end-to-end
✓ 0 P0 bugs in production
✓ <5 P1 bugs at launch
✓ Audit trail 100% compliant for SAT
✓ Performance: <2s for all dashboards
✓ Performance: Core Web Vitals (LCP<2.5s, FID<100ms, CLS<0.1)

Quality:
✓ E2E test coverage: 50+ scenarios
✓ Security audit passed
✓ Accessibility: WCAG 2.1 Level AA
✓ Mobile ↔ Web sync: 100% reliable

Compliance:
✓ Accountant sign-off on calculations
✓ SAT compliance rules enforced
✓ RFC validation working
✓ Immutable audit trail for 7-year retention

User Experience:
✓ New user onboarding: <5 minutes to first dashboard
✓ Support: <1 issue per 1000 users in first month
✓ Adoption: >70% of v1 users upgrade to v2 within 30 days
```

---

## COLLABORATION CHECKLIST

### Weekly Sync (Every Monday 10 AM)
- [ ] Juan presents architecture review
- [ ] Daniel presents implementation status
- [ ] Discuss blockers + solutions
- [ ] Adjust timeline if needed
- [ ] Assign tasks for next week

### Daily Standups (Async in Slack)
- [ ] Juan: Architecture + integration plan for next 3 days
- [ ] Daniel: What built yesterday + blockers + plan today
- [ ] Brief sync call if major blocker found

### Code Review Process
- [ ] Daniel: Push feature branch for review
- [ ] Juan: Review architecture + integration points
- [ ] Daniel: Address feedback
- [ ] Juan: Approve + merge to main
- [ ] Daniel: Deploy to staging

### Documentation Maintenance
- [ ] Update this roadmap weekly (Actual hours, Blockers)
- [ ] Keep integration map current
- [ ] Maintain API documentation as endpoints added
- [ ] Update test coverage report

### Git Strategy
```
Main branch: master (production-ready)
Development branch: develop (integration testing)
Feature branches: feature/flujocheck-*, feature/bancocheck-*, etc.
Hotfix branches: hotfix/p0-issue-* (as needed)

Commits:
- feat(module): Description (for new features)
- fix(module): Description (for bug fixes)
- refactor(module): Description (for code cleanup)
- docs(module): Description (for documentation)

Examples:
- feat(flujocheck): Implement 12-week projection algorithm
- fix(bancocheck): Correct duplicate detection edge case
- docs(facturacheck): Add SAT compliance guide
```

---

## APPENDIX: MODULE FEATURE CHECKLIST

### FlujoCheck (Cash Flow) — v2.0 Feature List
- [x] Weekly cash flow tracking
- [x] Capacity calculation algorithm
- [x] 12-week projection (linear, seasonal, ML)
- [x] Scenario planning (base, optimistic, pessimistic)
- [x] Credit management + amortization
- [x] Weekly dashboard + charts
- [x] Alerts + notifications
- [x] Export reports (CSV, PDF)
- [x] Optimization recommendations
- [x] Year-over-year comparison
- [x] Integration: GastoCheck (inflows), CobraCheck (outflows)

### BancoCheck (Bank Integration) — v2.0 Feature List
- [x] PDF upload + OCR parsing (BBVA, Santander, Generic)
- [x] OAuth integration (BBVA, Santander, Belvo)
- [x] Transaction import + deduplication
- [x] Basic + advanced matching (amount, date, description)
- [x] Manual matching UI
- [x] Reconciliation reports
- [x] Admin dashboard
- [x] Daily auto-sync
- [x] Alerts (large transactions, duplicates, sync failures)
- [x] Export reconciliation (PDF, CSV)
- [x] Integration: BancoCheck ↔ GastoCheck (expenses), BancoCheck ↔ CobraCheck (collections)

### FacturaCheck (Invoicing) — v2.0 Feature List
- [x] CFDI 4.0 generation (unsigned)
- [x] CFDI signing via FACTUROO PAC
- [x] SAT compliance validation
- [x] RFC + CURP validation
- [x] Invoice builder (step-by-step form)
- [x] Email distribution (SendGrid)
- [x] WhatsApp distribution (Twilio/Meta)
- [x] PDF rendering with QR code
- [x] Delivery tracking + webhooks
- [x] Cancellation workflow
- [x] Audit trail (immutable)
- [x] 7-year retention
- [x] Compliance dashboard
- [x] Export invoices (PDF, XML)
- [x] Integration: FacturaCheck ↔ GastoCheck (conceptos from expenses)

### v2.0 Integration Workflows
- [x] Gasto approved → FlujoCheck inflow update → CFDI generation → Bank deposit
- [x] Cobro collected → FlujoCheck outflow update → Bank matching
- [x] Supplier invoice → Payment schedule in FlujoCheck → Bank payment → Invoice cancellation
- [x] Complete audit trail (all actions logged)
- [x] Real-time alerts across modules
- [x] Multi-module data export
- [x] Mobile ↔ Web sync (CobraCheck + GastoCheck)

---

**End of Document**
**Last Updated: 2026-07-04**
**Next Review: 2026-07-11 (Semana 1 Checkpoint)**

