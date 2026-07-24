#!/usr/bin/env node
/**
 * Reproduce el 400 exacto en company_members usando la clave ANON
 * autenticado como el usuario demo (igual que el navegador).
 */
const { createClient } = require('@supabase/supabase-js')

const URL  = 'https://omhycwfjxynkfwywzwvz.supabase.co'
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const sb = createClient(URL, ANON)

async function run() {
  // 1. Login como el navegador
  console.log('🔐 Login como demo@gastocheck.app...')
  const { data: auth, error: authErr } = await sb.auth.signInWithPassword({
    email: 'demo@gastocheck.app',
    password: 'DemoGastoCheck2026!',
  })
  if (authErr) { console.error('❌ Login falló:', authErr.message); process.exit(1) }
  console.log('✅ Login OK. user_id =', auth.user.id, '\n')

  // 2. Query SIMPLE (la de login/page.tsx)
  console.log('── Query A (login/page.tsx): select role ──')
  const a = await sb.from('company_members')
    .select('role')
    .eq('user_id', auth.user.id)
    .eq('status', 'active')
    .limit(1).maybeSingle()
  console.log(a.error ? `❌ ${a.status} ${JSON.stringify(a.error)}` : `✅ ${JSON.stringify(a.data)}`)
  console.log()

  // 3. Query CON JOIN (la de getSessionUser)
  console.log('── Query B (getSessionUser): select con profiles:user_id(full_name) ──')
  const b = await sb.from('company_members')
    .select('company_id, role, profiles:user_id(full_name)')
    .eq('user_id', auth.user.id)
    .eq('status', 'active')
    .limit(1).maybeSingle()
  console.log(b.error ? `❌ ${b.status} ${JSON.stringify(b.error)}` : `✅ ${JSON.stringify(b.data)}`)
  console.log()

  // 4. Variantes del join para diagnosticar la relación
  console.log('── Query C: profiles!inner ──')
  const c = await sb.from('company_members')
    .select('company_id, role, profiles(full_name)')
    .eq('user_id', auth.user.id).limit(1).maybeSingle()
  console.log(c.error ? `❌ ${c.status} ${JSON.stringify(c.error)}` : `✅ ${JSON.stringify(c.data)}`)
  console.log()

  // 5. Ver columnas reales de company_members
  console.log('── Query D: select * (ver columnas) ──')
  const d = await sb.from('company_members').select('*')
    .eq('user_id', auth.user.id).limit(1).maybeSingle()
  console.log(d.error ? `❌ ${d.status} ${JSON.stringify(d.error)}` : `✅ ${JSON.stringify(d.data)}`)
}

run().catch(e => { console.error('💥', e); process.exit(1) })
