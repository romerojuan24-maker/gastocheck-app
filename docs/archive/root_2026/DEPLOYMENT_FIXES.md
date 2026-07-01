# GastoCheck — Deployment & Configuration Fixes

## 🟠 HIGH Priority Configuration Changes

### Bug #13: Email Verification Setup
**Status**: Configuration required (no code change)  
**Action**: Enable email verification in Supabase Auth

#### Steps:
1. Go to Supabase Dashboard → **Authentication** → **Email Templates**
2. Under **Email Confirmation**, enable the toggle
3. Configure the email template:
   - Subject: `Confirma tu cuenta en GastoCheck`
   - Include redirect URL: `${REDIRECT_URL}` (defaults to app's auth callback)
4. Set auto-confirm timeout (suggest: 7 days)

#### Why:
- Prevents fake email registrations
- Ensures only legitimate users can access company data
- Required for multi-tenant security (one email per company member)

---

### Bug #16: WhatsApp Business API Endpoint
**Status**: Configuration + code URL update  
**Action**: Update webhook endpoint URL in Meta WhatsApp Cloud API

#### Current endpoint (WRONG):
```
https://gastocheck-api.example.com/functions/v1/whatsapp-webhook
```

#### Correct endpoint:
```
https://{PROJECT_ID}.supabase.co/functions/v1/whatsapp-webhook
```

#### Steps:
1. Get your Supabase project URL from:
   - Supabase Dashboard → **Settings** → **API** → **Project URL**
2. Go to Meta Business Manager → **WhatsApp Business Account**
3. Click **Webhook Settings** (under App)
4. Update the **Callback URL** to the correct endpoint above
5. Verify the webhook callback token in `.env`:
   ```
   WHATSAPP_WEBHOOK_TOKEN=your_webhook_token
   ```

#### Code update required:
- File: `supabase/functions/whatsapp-webhook/index.ts`
- Verify the webhook token validation (line ~50)
- Ensure token matches Meta's generated token

#### Why:
- WhatsApp will reject callbacks to wrong URL (403 Forbidden)
- Webhook must be publicly accessible
- Webhook token prevents spoofed requests from other sources

---

## 📋 Configuration Checklist Before Production

- [ ] Email verification enabled in Supabase Auth
- [ ] WhatsApp Business API webhook endpoint configured
- [ ] WhatsApp webhook token saved in Supabase secrets
- [ ] SAT validation API credentials (if using real SAT, not mock)
- [ ] Supabase migrations applied: `20260610000007_fix_critical_bugs.sql`
- [ ] Edge functions deployed with latest code
- [ ] Environment variables set in Supabase (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, etc.)

---

## 🔧 Deploy Commands

### Apply migration:
```bash
supabase db push
```

### Deploy all edge functions:
```bash
supabase functions deploy
```

### Deploy specific function (if needed):
```bash
supabase functions deploy authorize-expense
supabase functions deploy whatsapp-webhook
```

---

## 🧪 Testing Checklist

### Email Verification:
- [ ] Register new account
- [ ] Check email for verification link
- [ ] Click link and verify user is confirmed
- [ ] User can log in after confirmation

### WhatsApp Integration:
- [ ] Send test image from WhatsApp Business account
- [ ] Check Supabase Edge Function logs for receipt
- [ ] Verify webhook token is validated (reject invalid token)

### SAT Validation:
- [ ] Close batch with receipts
- [ ] Verify `sat_validation_status` is set (not NULL)
- [ ] Check `sat_validation_at` timestamp is recorded

### Force Reason Validation:
- [ ] Try to authorize expense with force_reason < 3 chars
- [ ] Expect 400 error response

---

**Last Updated**: 2026-06-10  
**Migration**: `20260610000007_fix_critical_bugs.sql`  
**Commit**: `624a8b9`
