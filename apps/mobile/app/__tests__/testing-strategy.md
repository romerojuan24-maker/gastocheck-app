# CHECK SUITE v2.0 Testing Strategy

## Overview
Complete testing coverage across 5 modules with integration tests.

## Test Pyramid

```
                    ▲
                   / \
                  /   \
                 / E2E  \         UI + Cross-module flows
                /         \       2-3 tests per user journey
               /___________ \
              /             \
             / Integration   \    Module-to-module APIs
            /   Tests         \   5-8 tests per module pair
           /                   \
          /____________________ \
         /                       \
        / Unit Tests              \  Algorithms, validators, formatters
       /   (70% coverage)          \  20+ tests per module
      /_____________________________ \
```

## Module Testing Plan

### GastoCheck (Existing - Baseline)
- ✅ Unit tests: Póliza validation, SAT parsing, CONTPAQi export
- ✅ Integration: API endpoints, Supabase queries
- ✅ E2E: User creates póliza → approves → exports

### FlujoCheck (New - Priority)
**Unit Tests (30+)**
- `algorithms.ts`: 
  - ✓ calculateFixedAmortization (basic, edge cases)
  - ✓ calculateGraduatedAmortization (graduation validation)
  - ✓ calculateBalloonAmortization (balloon amount check)
  - ✓ calculateInterestOnlyAmortization (final payment)
  - ✓ calculatePaymentCapacity (buffer logic, recommendations)
  - ✓ generateAnnualProjection (health scoring, trend detection)
  - ✓ analyzeEarlyPaymentBenefit (NPV calculation)

- `hooks.ts`:
  - ✓ useFlujoBalance (fetch, refetch, error handling)
  - ✓ useFlujoItems (merge payables+receivables, risk calculation)
  - ✓ useFlujoMutations (save/remove operations)
  - ✓ useCalculatePaymentCapacity (capacity calculation with buffer)
  - ✓ useAmortizationCalculation (payment schedule generation)
  - ✓ useAnnualProjection (12-month projections)

**Integration Tests (8)**
- ← GastoCheck: Import last 6 months expenses, verify average
- ← CobraCheck: Import cobros with payment history, confidence scoring
- ← BancoCheck: Sync bank balances, reconciliation status
- → GastoCheck: Export cash flow summary as reference
- API endpoints: POST /api/flujo/periods, GET /api/flujo/dashboard
- Projection updates: Verify when GastoCheck/CobraCheck change
- Payment recommendations: Calculate available capacity with obligations
- Early payment analysis: Compare interest saved vs opportunity cost

**E2E Tests (3)**
- User views cash flow → sees red flag (buffer < 30 days) → gets early payment recommendation
- User creates credit → system projects payments → verifies amortization schedule displays
- Daily cash flow check → system updates with new bank balance → projections recalculate

### BancoCheck (New - Priority)
**Unit Tests (25+)**
- `hooks.ts`:
  - ✓ useOCRExtraction (Tesseract mock, confidence scoring)
  - ✓ useBankAccountSync (OAuth token exchange, account creation)
  - ✓ useTransactionMatching (similarity scoring, confidence thresholds)
  - ✓ useReconciliationStatus (matching percentage, discrepancy detection)
  - ✓ useBankTransactions (fetch, filter, pagination)
  - ✓ useAutoMatchingEngine (batch matching, confidence filtering)

**Integration Tests (8)**
- OAuth: BBVA/Santander/Belvo token exchange, token refresh
- OCR: PDF/JPG upload → extract transactions → create bank_statement_imports
- Matching: Bank TX vs internal TX → confidence scoring → manual override
- Reconciliation: Unmatched count, discrepancy reporting, audit trail
- → FlujoCheck: Real balance sync, update projections
- ← GastoCheck: Match bank TX to pólizas by amount/date
- ← CobraCheck: Match deposits to cobro payments
- API endpoints: POST /api/banco/import-statement, GET /api/banco/transactions

**E2E Tests (3)**
- User uploads bank statement → OCR extracts transactions → auto-matching suggests 95% matches → user approves
- User connects BBVA via OAuth → system imports last 30 days → reconciliation shows 98% matched
- Admin sees unmatched transaction → manually links to GastoCheck póliza → system flags for future auto-match

### FacturaCheck (New - Priority)
**Unit Tests (20+)**
- `hooks.ts`:
  - ✓ useCFDIGeneration (XML structure, SAT v4.0 compliance)
  - ✓ useCFDIDistribution (email/WhatsApp queuing, template interpolation)
  - ✓ useCFDICredit (balance calc, overage logic, reset)
  - ✓ useCreditTransaction (transaction recording, balance updates)
  - ✓ useCFDIList (filtering, pagination, summary aggregation)
  - ✓ useCFDICancel (reason validation, PAC cancellation)
  - ✓ useWebhookVerification (HMAC-SHA256 signature validation)

**Integration Tests (10)**
- CFDI Generation: Create XML → sign with cert → send to PAC → receive timbro
- PAC Adapters: Facturama, Solución Fácil, SW, Finkok
- Distribution: Email template → send via SendGrid → log status
- Distribution: WhatsApp template → send via Twilio → retry on failure
- Credit System: Track consumption → enforce limits → handle overage
- Webhooks: PAC sends timbrado → verify signature → update CFDI status
- → BancoCheck: When CFDI paid, create bank transaction link
- → GastoCheck: When CFDI timbrado, create accounting entry
- Cancellation: Mark as cancelled → log audit trail → refund credit
- API endpoints: POST /api/factura/generate-cfdi, GET /api/factura/cfdis

**E2E Tests (4)**
- User creates CFDI → system generates XML → sends to PAC → timbrado received via webhook → PDF emailed → marked complete
- User runs low on CFDI credits → system alerts → user recharges → new allocation applied
- User cancels CFDI → system notifies PAC → cancellation confirmed → credit refunded
- Admin views CFDI reports → exports to CONTPAQi → downloads CSV with all issued CFDIs

### CobraCheck (Existing - Baseline)
- ✅ Unit tests: Route optimization, collection algorithms
- ✅ Integration: Daily route generation, payment status updates
- ✅ E2E: Admin assigns cobro → cobrador views route → marks as collected

## Test Execution

### Pre-Commit Hooks (15 min)
```bash
# Unit tests only
npm run test:unit -- --bail

# Type checking
npm run type-check

# Linting
npm run lint
```

### CI/CD (per PR)
```bash
# All tests
npm run test

# Coverage threshold: 70% overall, 85% per module
npm run test:coverage

# Integration test suite (Supabase + external APIs mocked)
npm run test:integration

# E2E tests (Expo simulator + mock server)
npm run test:e2e:mock
```

### Manual QA (per OTA)
1. **Smoke Test (20 min)**
   - App opens → auth flows → all 5 modules load → bottom nav displays all 5 tabs
   - Can create record in each module (póliza, cobro, cash flow, import bank, generate CFDI)

2. **Happy Path (45 min)**
   - Complete flow: Create GastoCheck póliza → FlujoCheck updates projection → CobraCheck tracks receivable → BancoCheck imports payment → FacturaCheck issues invoice

3. **Edge Cases (30 min)**
   - Offline → go online → sync triggers → data consistent
   - Permissions: Test buyer vs supervisor vs admin view differences
   - Concurrency: Edit same record in two devices simultaneously
   - Large data: 1000+ transactions in FlujoCheck projection

4. **Integration Points (20 min)**
   - GastoCheck expense → appears in FlujoCheck projection
   - CobraCheck overdue → appears in FlujoCheck risk scoring
   - BancoCheck real balance < buffer → FlujoCheck shows red alert
   - FacturaCheck CFDI paid → BancoCheck shows linked transaction
   - FacturaCheck CFDI timbrado → GastoCheck shows accounting entry

## Test Data

### Fixtures (reusable across tests)
```typescript
// apps/mobile/app/__tests__/fixtures.ts
export const MOCK_COMPANY = { id: 'comp_123', name: 'Test Corp' }
export const MOCK_USER = { id: 'user_456', role: 'admin' }

export const MOCK_POLIZA = {
  id: 'pol_001',
  amount: 5000,
  category: 'reembolsos',
  date: '2026-07-05',
}

export const MOCK_CREDIT = {
  principal: 50000,
  annual_rate: 0.15,
  months: 24,
}

export const MOCK_BANK_ACCOUNT = {
  account_number: '1234567890',
  bank: 'BBVA',
  balance: 100000,
}

export const MOCK_CFDI = {
  receptor_rfc: 'ABC123456XYZ',
  subtotal: 10000,
  tax_rate: 0.16,
}
```

### Factories (generate random test data)
```typescript
// apps/mobile/app/__tests__/factories.ts
export function createPoliza(overrides = {}) { ... }
export function createCobro(overrides = {}) { ... }
export function createBankTransaction(overrides = {}) { ... }
```

## Coverage Goals

| Module | Unit | Integration | E2E | Overall |
|--------|------|-------------|-----|---------|
| GastoCheck | 85% | 80% | 90% | 85% |
| CobraCheck | 85% | 80% | 90% | 85% |
| FlujoCheck | 85% | 80% | 85% | 83% |
| BancoCheck | 80% | 75% | 80% | 78% |
| FacturaCheck | 80% | 75% | 80% | 78% |
| **Overall** | **83%** | **78%** | **85%** | **82%** |

## Bug Categories & Response

### Critical (fix immediately)
- App crash
- Data loss
- Security vulnerability (auth bypass, SQL injection, XSS)
- OTA doesn't apply
- **Response**: Emergency fix + hotfix OTA within 24h

### High (fix in same sprint)
- Feature broken (CFDI won't generate, FlujoCheck crash on projection)
- Data corruption
- Wrong calculation (amortization, tax, matching confidence)
- **Response**: Fix in next planned OTA (3-5 days)

### Medium (fix in next sprint)
- UI/UX bug (layout issues, button misaligned)
- Slow performance (> 3 sec load)
- Error message unclear
- **Response**: Include in next planned OTA (7-10 days)

### Low (backlog)
- Missing i18n translation
- Typo in label
- Uncommon edge case
- **Response**: Backlog for future optimization

## Monitoring & Observability

### Client-side logging
```typescript
// All errors logged to Supabase
logError('flujocheck', 'Amortization calculation failed', error, { amount, rate, months })
```

### API monitoring
```typescript
// Track API response times and errors
POST /api/flujo/dashboard → avg 500ms (target: < 1000ms)
POST /api/factura/generate-cfdi → avg 2000ms (includes PAC call)
```

### Production alerts
- OTA adoption rate < 50% within 24h
- Error rate > 1% on any API endpoint
- Crash rate > 0.5% on any OS/device
- Sync failure on FlujoCheck/FacturaCheck

## Timeline

- **Week 1** (Jul 5-11): Unit tests for algorithms & validators
- **Week 2** (Jul 12-18): Integration tests for cross-module APIs
- **Week 3** (Jul 19-25): E2E tests & manual QA
- **Week 4** (Jul 26-Aug 1): Performance testing & optimization
- **Ongoing**: Bug fixes & regression testing per sprint
