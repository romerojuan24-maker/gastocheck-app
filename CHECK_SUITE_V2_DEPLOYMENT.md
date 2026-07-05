# CHECK SUITE v2.0 Deployment Checklist

## Status: Semana 2 Active (Jul 5, 2026)

**Completion**: ~50% (OTA 137 UI + Semana 2 algorithms)
**Blockers**: None critical
**Timeline**: 8-9 weeks (reduced from 12 weeks post-OTA 137 audit)

---

## Phase 1: Infrastructure & Database (Week 1-2)

### Migrations Status
- [x] FlujoCheck schema (20260705_001_flujocheck_schema.sql)
  - 14 tables, RLS policies, indexes
  - cash_flow_periods, payables, receivables, credits, amortization_rules, payment_schedule
  
- [x] BancoCheck schema (20260705_002_bancocheck_schema.sql)
  - 8 tables, manual + OAuth sync
  - bank_accounts_manual, bank_accounts_automated, bank_transactions, reconciliation_status
  
- [x] FacturaCheck schema (20260705_003_facturacheck_schema.sql)
  - 8 tables, CFDI lifecycle, PAC config
  - cfdi_documents, cfdi_credits, cfdi_distributions, pac_configuration

**Next Steps**:
- [ ] Execute migrations on production Supabase (Staging first)
- [ ] Verify indexes are created
- [ ] Test RLS policies with multi-company setup
- [ ] Backup before execution

---

## Phase 2: API Endpoints & Backend (Week 2-3)

### FlujoCheck APIs
- [x] Stub endpoints created (6 total)
  - [x] POST /api/flujo/periods (create cash flow)
  - [x] GET /api/flujo/dashboard (full data)
  - [x] POST /api/flujo/credit-scan (OCR document)
  - [x] GET /api/flujo/projection/annual (12-month forecast)
  - [x] POST /api/flujo/simulate-payment (impact analysis)
  - [x] GET /api/flujo/receivables/{id}/confidence

- [ ] Connect to actual Supabase queries
- [ ] Implement amortization calculation logic
- [ ] Add caching (Redis) for projections (5-min TTL)
- [ ] Error handling & validation

### BancoCheck APIs
- [x] Stub endpoints created (6 total)
  - [x] POST /api/banco/import-statement (OCR upload)
  - [x] GET /api/banco/accounts (list connections)
  - [x] POST /api/banco/oauth-callback (OAuth exchange)
  - [x] GET /api/banco/transactions (with reconciliation)
  - [x] POST /api/banco/manual-match (link transactions)
  - [x] GET /api/banco/unsupported-banks (feature requests)

- [ ] Integrate Tesseract/AWS Textract for OCR
- [ ] OAuth implementation (BBVA, Santander, Belvo)
- [ ] Transaction matching algorithm
- [ ] Reconciliation engine

### FacturaCheck APIs
- [x] Stub endpoints created (7 total)
  - [x] POST /api/factura/generate-cfdi (XML generation)
  - [x] GET /api/factura/cfdis (list with filters)
  - [x] GET /api/factura/cfdis/{id} (detail)
  - [x] POST /api/factura/distribute (email/WhatsApp)
  - [x] POST /api/factura/cancel (cancellation)
  - [x] GET /api/factura/credits (balance)
  - [x] GET /api/factura/reports (aggregates)

- [ ] CFDI XML generation (SAT v4.0 spec)
- [ ] PAC adapter pattern (Facturama, Solución Fácil, SW, Finkok)
- [ ] Webhook system (HMAC-SHA256 verification)
- [ ] Distribution queuing (email/WhatsApp)
- [ ] Credit consumption logic

---

## Phase 3: Frontend UI & Hooks (Week 3-4)

### FlujoCheck UI
- [x] Types & interfaces (20+ defined)
- [x] Algorithms file (amortization × 4, projections, capacity)
- [x] Hooks (6 custom React hooks)
- [ ] Screens
  - [ ] Dashboard: Cash position, balance, buffer health
  - [ ] Payables: List + status tracking
  - [ ] Receivables: List + confidence scoring
  - [ ] Credits: List + payment schedule
  - [ ] Projections: 12-month chart + what-if simulator
  - [ ] Recommendations: Early payment, expense reduction, receivables acceleration

### BancoCheck UI
- [x] Types & interfaces (20+ defined)
- [x] Hooks (6 custom React hooks)
- [ ] Screens
  - [ ] Dashboard: Account summary, reconciliation %
  - [ ] Import: PDF/JPG upload + OCR status
  - [ ] Transactions: List + matching status
  - [ ] Reconciliation: Unmatched review + manual linking
  - [ ] OAuth: Connect BBVA/Santander/Belvo
  - [ ] Reports: Monthly reconciliation

### FacturaCheck UI
- [x] Types & interfaces (20+ defined)
- [x] Hooks (7 custom React hooks)
- [ ] Screens
  - [ ] Dashboard: CFDI summary, credits remaining
  - [ ] Create: Form to generate CFDI (auto-fill from CobraCheck)
  - [ ] List: All CFDIs with status filters
  - [ ] Distribute: Email/WhatsApp sending + template editor
  - [ ] Credits: Balance, consumption history, recharge
  - [ ] Reports: Monthly issued, timbradas, cancelled
  - [ ] PAC Config: Provider selection + credentials

---

## Phase 4: Integration & Sync (Week 4-5)

### Cross-Module Integrations
- [x] Integration functions defined (15 total)
  - [x] FlujoCheck ← GastoCheck (expenses)
  - [x] FlujoCheck ← CobraCheck (income + confidence)
  - [x] FlujoCheck ← BancoCheck (real balances)
  - [x] FacturaCheck ↔ BancoCheck (payment links)
  - [x] FacturaCheck ↔ GastoCheck (accounting entries)

- [ ] Implement real-time sync triggers
- [ ] Database-level event listeners (pg_listen)
- [ ] Queue system for async jobs (Bull/Sidekiq)
- [ ] Audit logging for all cross-module transactions
- [ ] Conflict resolution (if edited in 2 modules simultaneously)

### Unified Dashboard
- [x] Dashboard data structure defined
- [x] Module snapshot builders
- [x] Health score calculation
- [x] Recommendations generator

- [ ] Implement dashboard screen
- [ ] Real-time status updates (WebSocket)
- [ ] Alerts & notifications

---

## Phase 5: Testing & QA (Week 5-7)

### Unit Tests
- [x] Test strategy document created
- [ ] FlujoCheck algorithms (30+ tests)
- [ ] BancoCheck matching & OCR (25+ tests)
- [ ] FacturaCheck CFDI generation (20+ tests)
- [ ] Shared utilities & validators (20+ tests)
- [ ] Target: 85% coverage per module

### Integration Tests
- [ ] FlujoCheck ← all 3 sources
- [ ] BancoCheck OCR, OAuth, reconciliation
- [ ] FacturaCheck PAC, webhooks, distributions
- [ ] Cross-module triggers
- [ ] API endpoints with Supabase
- [ ] Target: 80% coverage

### E2E Tests
- [ ] Complete user journeys in Expo simulator
- [ ] Offline/online transitions
- [ ] Multi-user concurrency
- [ ] Performance benchmarks
- [ ] Target: 85% critical paths

### Manual QA
- [ ] Smoke test (all 5 modules load)
- [ ] Happy path (complete end-to-end flow)
- [ ] Edge cases (offline, permissions, large data)
- [ ] Accessibility (iOS VoiceOver, Android TalkBack)
- [ ] Performance (< 2s screen load, < 500ms API)

---

## Phase 6: Security & Compliance (Week 7)

### Security Review
- [ ] API rate limiting
- [ ] Input validation + sanitization
- [ ] SQL injection prevention (prepared statements)
- [ ] XSS protection (React escaping)
- [ ] CSRF tokens on state-changing requests
- [ ] OAuth token storage (encrypted)
- [ ] HTTPS enforcement
- [ ] Penetration testing (external firm)

### Compliance (SAT Fiscal)
- [ ] CFDI XML validation (SAT spec)
- [ ] Audit trail completeness (all actions logged)
- [ ] Data retention policy (7 years minimum)
- [ ] User access logging (IP, device, timestamp)
- [ ] Encryption at rest + in transit
- [ ] Legal review of ToS updates

### Data Privacy (GDPR-style)
- [ ] Data export functionality
- [ ] Data deletion (with retention period)
- [ ] Consent collection
- [ ] Privacy policy updated

---

## Phase 7: Performance & Optimization (Week 7-8)

### Client-side Optimization
- [ ] Code splitting per module
- [ ] Lazy loading screens
- [ ] Image optimization
- [ ] Bundle size audit (target: < 50MB uncompressed)
- [ ] First paint time < 2s

### Server-side Optimization
- [ ] Database query indexing review
- [ ] N+1 query elimination
- [ ] API response caching (Redis)
- [ ] Database connection pooling
- [ ] CDN for static assets

### Monitoring Setup
- [ ] Error tracking (Sentry)
- [ ] Performance monitoring (New Relic)
- [ ] API analytics (custom)
- [ ] Crash reporting
- [ ] User session replays (optional)

---

## Phase 8: Documentation & Training (Week 8)

### Developer Documentation
- [x] API endpoint specs (Swagger/OpenAPI)
- [x] Database schema diagrams
- [x] Architecture overview
- [x] Integration guide
- [x] Testing strategy

- [ ] Setup instructions (local development)
- [ ] Deployment runbook
- [ ] Troubleshooting guide
- [ ] Contribution guidelines

### User Documentation
- [ ] In-app tutorials per module
- [ ] Video walkthroughs
- [ ] FAQ & knowledge base
- [ ] Admin guide
- [ ] End-user guide (PDF)

### Training
- [ ] Admin training session
- [ ] Supervisor training session
- [ ] End-user onboarding video
- [ ] Support team training

---

## Phase 9: Soft Launch & Ramp (Week 8-9)

### Soft Launch (Internal)
- [ ] Deploy to staging environment
- [ ] Internal team testing (48h)
- [ ] Fix critical bugs
- [ ] Deploy to production
- [ ] Enable for 10% of users (canary)

### Ramp-Up
- Day 1-2: 10% of users
  - [ ] Monitor crash rate
  - [ ] Monitor error rate on APIs
  - [ ] Collect feedback
  
- Day 3-4: 50% of users
  - [ ] If stable, continue to 100%
  - [ ] If issues, rollback to canary

- Day 5: 100% of users
  - [ ] Mark v2.0 as "stable"
  - [ ] Continue monitoring for 1 week
  - [ ] Post-launch bug fixes in hotfix OTAs

---

## Pre-Launch Checklist (Go/No-Go)

### Critical (must be done)
- [ ] All 3 schema migrations executed successfully
- [ ] All 19 API endpoints (6 Flujo + 6 Banco + 7 Factura) tested
- [ ] GastoCheck integration working (expenses sync)
- [ ] CobraCheck integration working (income sync)
- [ ] BancoCheck basic functionality (account import)
- [ ] FacturaCheck basic functionality (CFDI generation)
- [ ] Security review cleared
- [ ] SAT compliance verified
- [ ] No P0 (critical) bugs remaining
- [ ] Backup & disaster recovery tested

### Important (should be done)
- [ ] All unit tests passing (70%+ coverage)
- [ ] All integration tests passing
- [ ] E2E smoke tests passing
- [ ] Manual QA sign-off
- [ ] Documentation complete
- [ ] Performance benchmarks met
- [ ] Monitoring & alerting setup

### Nice-to-have (can defer to v2.1)
- [ ] Full E2E test suite (current: critical paths only)
- [ ] Advanced features (early payment recommendations, scenario planning)
- [ ] Mobile app PWA version
- [ ] Advanced reporting & BI

---

## Rollout Plan

### OTA Numbering
- OTA 138: UI structure + algorithms (50% complete, OTA 137 baseline)
- OTA 139: Full FlujoCheck implementation + APIs
- OTA 140: Full BancoCheck implementation + OCR/OAuth
- OTA 141: Full FacturaCheck implementation + CFDI generation
- OTA 142: Cross-module integration + unified dashboard
- OTA 143: Testing + QA fixes
- OTA 144: Performance optimization + final fixes
- **OTA 145: CHECK SUITE v2.0 Release** ✨

### Branches
- `main`: Production-ready code
- `staging`: Pre-release testing (merged to main 1 day before OTA)
- `feature/*`: Individual feature branches (PR review before merge to staging)

### Release Notes Template
```
## CHECK SUITE v2.0 Release Notes

### New Features
- **FlujoCheck**: Cash flow forecasting, amortization calculator, payment capacity analysis
- **BancoCheck**: Bank statement import (OCR), multi-bank reconciliation, OAuth sync
- **FacturaCheck**: CFDI generation & distribution, credit prepayment system, PAC integration

### Improvements
- Unified admin dashboard across all 5 modules
- Cross-module integrations (automatic data sync)
- Enhanced financial analysis & recommendations
- Improved performance & offline support

### Bug Fixes
- [List of fixes from v1.x]

### Known Issues
- [Any known limitations to communicate]

### Migration Notes
- Existing GastoCheck and CobraCheck data automatically synced to FlujoCheck
- User permissions unchanged (existing roles apply to new modules)
- No data loss or disruption expected

### Support
- Contact: soporte@checksuiteapp.com
- Docs: https://docs.checksuiteapp.com
```

---

## Success Metrics

### Adoption
- Target: 70% of active companies adopt v2.0 within 30 days
- Measurement: MAU (monthly active users) per module

### Stability
- Target: < 0.5% crash rate
- Target: < 1% API error rate
- Measurement: Sentry, server logs

### Performance
- Target: < 2s screen load time
- Target: < 500ms API response time
- Measurement: New Relic, custom instrumentation

### User Satisfaction
- Target: 4.5+/5 rating on app stores
- Target: < 2% uninstall rate in first 30 days
- Measurement: App store reviews, analytics

### Feature Usage
- Target: > 50% of users use FlujoCheck projections
- Target: > 30% of users connect bank accounts
- Target: > 40% of users generate CFDIs
- Measurement: Analytics tracking (Mixpanel/Amplitude)

---

## Post-Launch Support (Week 9+)

### Hotfix SLA
- P0 (critical crash): Fix within 4 hours, deploy within 24 hours
- P1 (broken feature): Fix within 24 hours, deploy within 3 days
- P2 (degraded): Fix within 1 week, deploy in next regular OTA

### Regular OTA Schedule
- Weekly OTA every Thursday (new features, bug fixes)
- Bi-weekly major OTA (performance, architecture improvements)
- Monthly quarterly sync with web dashboard

### Customer Support
- In-app help center
- Email support: soporte@checksuiteapp.com
- WhatsApp Business support line
- Community forum for tips & tricks

---

## Sign-Off

- [ ] Product Owner: ____________________ Date: ________
- [ ] Lead Developer: ____________________ Date: ________
- [ ] QA Lead: ____________________ Date: ________
- [ ] Security Officer: ____________________ Date: ________

---

**Last Updated**: 2026-07-05
**Next Review**: After OTA 142 (integration testing complete)
