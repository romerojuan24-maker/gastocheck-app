#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js')
const URL  = 'https://omhycwfjxynkfwywzwvz.supabase.co'
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const sb = createClient(URL, ANON)

async function run() {
  console.log('🔐 Login demo@gastocheck.app / Demo2026! ...')
  const { data: auth, error } = await sb.auth.signInWithPassword({
    email: 'demo@gastocheck.app', password: 'Demo2026!',
  })
  if (error) { console.error('❌ Login:', error.message); process.exit(1) }
  console.log('✅ Auth OK\n')

  // Replica EXACTA del nuevo getSessionUser()
  const { data: member, error: mErr } = await sb.from('company_members')
    .select('company_id, role').eq('user_id', auth.user.id)
    .eq('status', 'active').limit(1).maybeSingle()
  if (mErr) { console.error('❌ member:', JSON.stringify(mErr)); process.exit(1) }
  console.log('✅ Query member:', JSON.stringify(member))

  const { data: profile, error: pErr } = await sb.from('profiles')
    .select('full_name').eq('id', auth.user.id).maybeSingle()
  if (pErr) { console.error('❌ profile:', JSON.stringify(pErr)); process.exit(1) }
  console.log('✅ Query profile:', JSON.stringify(profile))

  console.log('\n🎉 getSessionUser() ahora resuelve sin 400.')
  console.log('   Rol:', member.role, '→ ruta home: /hoy')
}
run()
