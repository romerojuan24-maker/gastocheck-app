#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js')
const URL  = 'https://omhycwfjxynkfwywzwvz.supabase.co'
const SVC  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9taHljd2ZqeHlua2Z3eXd6d3Z6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDc3NjQyMywiZXhwIjoyMDk2MzUyNDIzfQ.mTSMLWCIOU_d8UNDNL8Dv40oJFUv8x9p3ceUQQbdvSU'
const sb = createClient(URL, SVC, { auth: { persistSession: false } })

const DEMO_ID = '17d69a4a-bb91-409d-8bcb-412b4ed4548d'
const PASS    = 'Demo2026!'   // ← misma que apps/mobile/app/login.tsx:13

async function run() {
  const { error } = await sb.auth.admin.updateUserById(DEMO_ID, {
    password: PASS, email_confirm: true,
  })
  if (error) { console.error('❌', error.message); process.exit(1) }
  console.log(`✅ Contraseña demo restaurada a: ${PASS}`)
  console.log('   (coincide con DEMO_PASSWORD de la app móvil)')
}
run()
