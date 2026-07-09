# BancoCheck — Quick Start Guide

## 📦 ONE-TIME SETUP

### 1. Database Migration
```bash
# Apply migration to Supabase
supabase migration up

# Verify tables exist
psql $DATABASE_URL -c "\dt bank_*"
```

### 2. Seed Demo Data (optional)
```bash
# Insert 3 demo accounts + 10 transactions + 4 suggestions
psql $DATABASE_URL < supabase/seeds/bancocheck-demo.sql

# Verify
psql $DATABASE_URL -c "SELECT COUNT(*) FROM bank_accounts;"
```

### 3. Generate Prisma Client
```bash
npx prisma generate
```

---

## 🚀 RUN LOCALLY

### Backend (NestJS)
```bash
# Start dev server
npm run dev

# Verify API responds
curl http://localhost:3000/api/bancocheck/accounts
# Expected: 200 + list of accounts
```

### Frontend (Next.js)
```bash
# Start Next.js dev
cd apps/web
npm run dev

# Open browser
# http://localhost:3000/bancocheck
# → Dashboard with KPI cards
```

### Mobile (React Native)
```bash
# Start Expo server
cd apps/mobile
npm start

# Scan QR with Expo Go app
# or press 'i' for iOS simulator
```

---

## ✅ MANUAL HAPPY PATH TEST

### 1. Create Account
```bash
curl -X POST http://localhost:3000/api/bancocheck/accounts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "name": "Test Bank",
    "bankName": "BBVA",
    "accountNumberLast4": "1234",
    "currency": "MXN",
    "type": "corriente"
  }'
```
Expected: 201 + account object

### 2. Import CSV
```bash
# Create test CSV
cat > /tmp/test.csv << 'EOF'
fecha,descripcion,debito,credito
2026-07-01,PAGO ACME,1500.00,0
2026-07-02,INGRESO CLIENTE,0,5000.00
EOF

# Import
curl -X POST http://localhost:3000/api/bancocheck/import-csv \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "bankAccountId": "YOUR_ACCOUNT_ID",
    "fileName": "test.csv",
    "csvData": "'$(cat /tmp/test.csv)'"
  }'
```
Expected: 200 + importedRows: 2, duplicateRows: 0

### 3. View Transactions
```bash
curl http://localhost:3000/api/bancocheck/transactions \
  -H "Authorization: Bearer $JWT_TOKEN"
```
Expected: 200 + 2 transactions

### 4. Classify Transaction
```bash
curl -X PATCH http://localhost:3000/api/bancocheck/transactions/TRANS_ID/classify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "status": "EXPLAINED",
    "category": "gasto_negocio",
    "notes": "Office supplies"
  }'
```
Expected: 200 + status: EXPLAINED

### 5. Dashboard
```bash
curl http://localhost:3000/api/bancocheck/dashboard \
  -H "Authorization: Bearer $JWT_TOKEN"
```
Expected: 200 + totalTransactions: 2, unexplainedCount: 1, explainedPercentage: 50

---

## 🧪 RUN TESTS

### Unit Tests (Service + CSV parsing)
```bash
npm run test -- bancocheck.service.spec.ts
npm run test -- csv-parsing.spec.ts
```

### Expected Output
```
PASS  bancocheck.service.spec.ts
  ✓ should create a bank account
  ✓ should parse and import CSV rows
  ✓ should detect duplicates
  ✓ should classify a transaction
  ✓ should match transaction to entity
  ✓ should aggregate dashboard stats

6 passed
```

---

## 🔐 VERIFY SECURITY

### RLS Tenant Isolation
```bash
# Login as user_1
export TOKEN_USER1=$(curl -X POST ... /auth/login -d '{"email": "user1@test.com"}'  | jq -r '.jwt')

# Get accounts (should see user1's accounts)
curl http://localhost:3000/api/bancocheck/accounts -H "Authorization: Bearer $TOKEN_USER1"

# Login as user_2 (different tenant)
export TOKEN_USER2=$(curl -X POST ... /auth/login -d '{"email": "user2@test.com"}'  | jq -r '.jwt')

# Get accounts with user2 token (should NOT see user1's accounts)
curl http://localhost:3000/api/bancocheck/accounts -H "Authorization: Bearer $TOKEN_USER2"
# Expected: empty array or only user2's accounts
```

---

## 📱 MOBILE TEST CHECKLIST

- [ ] Dashboard loads (stats cards visible)
- [ ] Import button opens form
- [ ] View All button shows transaction list
- [ ] Transaction card tappable (opens detail)
- [ ] Classify button opens modal
- [ ] Status dropdown works
- [ ] Save changes persists to server
- [ ] Dark mode toggle works (if implemented)

---

## 🚢 DEPLOY TO PRODUCTION

### 1. Verify locally
```bash
npm run build
npm run test
```

### 2. Push to main
```bash
git add .
git commit -m "feat: BancoCheck implementation complete"
git push origin main
```

### 3. Railway auto-deploys
```bash
# Check logs
railway logs -f

# Verify endpoint
curl https://statika-erp-production.up.railway.app/api/bancocheck/accounts \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### 4. Post-deployment
- [ ] Verify RLS in production (test cross-tenant access)
- [ ] Run seed data: `psql $PROD_DB_URL < supabase/seeds/bancocheck-demo.sql`
- [ ] Smoke test: dashboard loads, can import CSV
- [ ] Check logs for errors: `railway logs | grep ERROR`

---

## 📚 DOCUMENTATION

| File | Purpose |
|------|---------|
| BANCOCHECK_IMPL_SPEC.prisma | Full Prisma schema (5 models) |
| BANCOCHECK_IMPLEMENTATION_PLAN.md | 8-13h implementation roadmap |
| BANCOCHECK_CHECKLIST_PRUEBA.md | QA test cases (150+) |
| BANCOCHECK_STATUS.md | Progress tracker |
| BANCOCHECK_QUICKSTART.md | This file |

---

## ⚠️ KNOWN LIMITATIONS

1. **Mobile detail/classify modals not yet implemented** — in progress
2. **Integration tests pending** — schema and unit tests complete
3. **No pagination** — loading all transactions into memory (OK for < 10k rows)
4. **Matching suggestions are simple** — pattern-based only (can upgrade to ML later)
5. **No dark mode on web** — responsive design complete
6. **No export to Excel** — CSV export only

---

## 🆘 TROUBLESHOOTING

### "Connection refused" on API calls
```bash
# Check if backend running
lsof -i :3000
# If not, start: npm run dev
```

### CSV import fails
```bash
# Check CSV format
cat your_file.csv | head -3
# Should have: fecha, descripcion, debito, credito columns

# Check for encoding issues
file your_file.csv
# Should be: ASCII or UTF-8
```

### RLS error: "new row violates row level security policy"
```bash
# Ensure tenantId matches auth.uid()
# Check in Backend: req.user?.company_id must be set
# Verify RLS policy in Supabase: SELECT * WHERE tenant_id = auth.uid()::text
```

### Tests fail
```bash
# Clear Jest cache
npm run test -- --clearCache

# Run verbose
npm run test -- --verbose
```

---

## 📞 SUPPORT

For issues:
1. Check BANCOCHECK_CHECKLIST_PRUEBA.md for test cases
2. Review error logs: `railway logs`
3. Check migration status: `supabase migration list`
4. Verify JWT token is valid and not expired

**Last updated**: 2026-07-09 | BancoCheck v1.0 RC1
