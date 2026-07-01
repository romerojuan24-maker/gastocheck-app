# GastoCheck — Pre-Launch Deployment Checklist

## 🚀 PHASE 1: Database Migration (TODAY)

```bash
# 1. Backup current database
supabase db pull

# 2. Apply migration
supabase db push

# 3. Verify in Supabase Dashboard
# - Go to SQL Editor
# - Check: suppliers table has unique index
# - Check: receipts table has CHECK constraint on sat_validation_status
# - Check: advance_requests has constraints
# - Check: supplier cycle prevention trigger exists
```

**Expected outcomes:**
- ✅ No errors in migration
- ✅ Existing data preserved (migration only adds constraints)
- ✅ Performance baseline unchanged

---

## 🔧 PHASE 2: Edge Functions Deployment (TODAY)

```bash
# Deploy all updated functions
supabase functions deploy

# OR deploy specific functions with fixes:
supabase functions deploy authorize-expense
supabase functions deploy submit-receipt
supabase functions deploy xml-parse
supabase functions deploy notify-supervisor
supabase functions deploy whatsapp-webhook
```

**Verify in Supabase Dashboard → Edge Functions:**
- ✅ `authorize-expense` v2 (force_reason + type guard)
- ✅ `submit-receipt` v2 (category fix + amount validation)
- ✅ `xml-parse` v2 (XXE protection)
- ✅ `notify-supervisor` v2 (RLS validation)
- ✅ `whatsapp-webhook` v2 (image download)
- ✅ All others updated with latest code

---

## ⚙️ PHASE 3: Supabase Configuration (TODAY)

### Email Verification

**Goal:** Prevent fake email registrations

**Steps:**
1. Go to Supabase Dashboard → **Authentication** → **Email Templates**
2. Click **Email Confirmation**
3. Toggle **Enable email confirmations** ON
4. Copy template URL redirect (should auto-populate)
5. Set auto-confirm timeout: **7 days**
6. Save

**Test:**
```
1. Go to app login screen
2. Register new account with test email
3. Check inbox for confirmation email
4. Click link and verify account
5. Try to log in — should succeed
```

### WhatsApp Business Webhook

**Goal:** Receive images and messages from WhatsApp Business API

**Steps:**
1. Get Supabase project URL:
   - Supabase Dashboard → **Settings** → **API** → **Project URL**
   - Example: `https://abcd1234.supabase.co`

2. Construct webhook endpoint:
   ```
   https://abcd1234.supabase.co/functions/v1/whatsapp-webhook
   ```

3. Go to Meta Business Manager → **WhatsApp Business Account**

4. Find **Webhook Settings** (under your App)

5. Update **Callback URL**:
   ```
   https://abcd1234.supabase.co/functions/v1/whatsapp-webhook
   ```

6. Verify token in `.env` matches Meta's webhook token:
   ```
   WHATSAPP_WEBHOOK_TOKEN=your_token_from_meta
   ```

7. Click **Verify and Save**

**Test:**
```
1. Send test message from WhatsApp Business account
2. Check Supabase Function logs (Edge Functions → whatsapp-webhook)
3. Verify message appears in logs
4. Send test image
5. Verify image download logs appear
```

---

## 🧪 PHASE 4: Integration Testing (TODAY + TOMORROW)

### Offline Sync Test

**Scenario:** Submit receipt without internet, sync when reconnected

```
1. Open GastoCheck app
2. Navigate to Capture screen
3. Turn OFF internet (airplane mode)
4. Take photo, fill form, click Submit
5. Should see: "📱 Guardado offline" message
6. Turn internet BACK ON
7. App should auto-sync within 30 seconds
8. Check Supabase: receipt should appear in DB
```

**Expected:** No data loss, no duplicate receipts

### Receipt → Batch → SAT Validation

```
1. Submit 3 receipts with valid UUIDs
2. Create batch with 2 of them
3. Supervisor closes batch
4. Check receipts: sat_validation_status should be 'validated' or 'warning'
5. Check timestamp: sat_validation_at should be set
```

**Expected:** SAT status fields populated correctly

### Notification Delivery

```
1. Submit receipt as employee
2. Check supervisor account: should see notification
3. Approve expense
4. Check employee account: should see approval notification
```

**Expected:** Notifications delivered to correct recipients only

### Force Reason Validation

```
1. Try to authorize expense with force_reason = "ab" (2 chars)
2. Should see error: "force_reason debe tener al menos 3 caracteres"
3. Try with force_reason = "abc"
4. Should succeed
```

**Expected:** Validation enforced

---

## 📋 PHASE 5: QA Checklist (TOMORROW)

### Mobile App
- [ ] Login/register flow works
- [ ] OCR extraction works for 5+ receipt types
- [ ] Offline mode: submit while offline, sync when online
- [ ] Duplicate detection flags correct matches
- [ ] Fleet features show correct vehicle/operator KPIs
- [ ] Fuel theft alerts display
- [ ] Maintenance alerts display
- [ ] Notifications appear in-app and via push

### Web Dashboard
- [ ] Dashboard loads without errors
- [ ] Real-time KPI updates
- [ ] Batch export works (Excel/CSV)
- [ ] SAT validation status visible
- [ ] Company member list accurate

### API/Edge Functions
- [ ] submit-receipt creates receipt + expense + supplier correctly
- [ ] authorize-expense transitions state properly
- [ ] SAT validation updates receipts
- [ ] WhatsApp webhook receives messages
- [ ] offline-sync processes queue without race conditions

### Security
- [ ] XXE validation blocks malicious XML
- [ ] RLS prevents cross-company data access
- [ ] Type validation rejects invalid requests
- [ ] Rate limiting on edge functions (check Supabase)

---

## 🚨 Rollback Plan (IF NEEDED)

```bash
# Revert migration (if DB issues)
git revert bc46210  # revert docs commit
git revert f6f3c09  # revert ALTOS/MEDIOS
git revert 624a8b9  # revert CRÍTICOS

# Revert edge functions to previous versions
# (Supabase keeps version history in Dashboard)

# Supabase will keep backup of pre-migration DB
# Contact Supabase support to restore if needed
```

---

## ✅ Final Verification Before Launch

- [ ] All migrations applied successfully
- [ ] All edge functions deployed
- [ ] Email verification enabled
- [ ] WhatsApp webhook configured
- [ ] Offline sync tested (submit offline → sync online)
- [ ] SAT validation working
- [ ] Notifications delivered
- [ ] Security validations enforced (XXE, RLS, type checking)
- [ ] No errors in Supabase logs
- [ ] No regression in existing features
- [ ] E2E test: capture → submit → approve → batch close → export

---

## 📊 Post-Launch Monitoring

**First 24 hours:**
- Monitor Supabase Function logs for errors
- Check database for anomalies
- Monitor push notification delivery
- Track offline sync queue processing

**First week:**
- Analyze user feedback on offline experience
- Monitor SAT validation accuracy
- Track fleet feature usage
- Monitor any data consistency issues

---

## 📞 Support Contacts

**Supabase Issues:**
- Dashboard: https://app.supabase.com
- API docs: https://supabase.com/docs

**WhatsApp API Issues:**
- Meta Business Manager: https://business.facebook.com
- API docs: https://developers.facebook.com/docs/whatsapp

**Gemini OCR Issues:**
- API docs: https://ai.google.dev/docs

---

**TLDR:** Run `supabase db push && supabase functions deploy`, enable email + WhatsApp in UIs, run Phase 4 tests, then launch.

**Status: READY FOR DEPLOYMENT** 🚀

