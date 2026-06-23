#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js')
const URL = 'https://omhycwfjxynkfwywzwvz.supabase.co'
const SVC = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9taHljd2ZqeHlua2Z3eXd6d3Z6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDc3NjQyMywiZXhwIjoyMDk2MzUyNDIzfQ.mTSMLWCIOU_d8UNDNL8Dv40oJFUv8x9p3ceUQQbdvSU'
const sb = createClient(URL, SVC, { auth: { persistSession: false } })

const ORPHAN = 'b2199da2-50a2-431b-bea0-d8d9bb01f788'

async function run() {
  const { data: userObj, error: uErr } = await sb.auth.admin.getUserById(ORPHAN)
  if (uErr) { console.error('getUserById:', uErr.message); process.exit(1) }

  const email = userObj.user.email
  const name  = userObj.user.user_metadata?.full_name ?? email
  console.log(`User: ${email}  →  full_name: "${name}"`)

  const { error } = await sb.from('profiles').insert({
    id: ORPHAN, full_name: name, avatar_url: null,
  })
  if (error && error.code !== '23505') { console.error('insert:', error.message); process.exit(1) }
  console.log(error ? '⚠️  Perfil ya existía (ignorado)' : '✅ Perfil creado')

  // Re-verificar
  const { data: members } = await sb.from('company_members').select('user_id')
  const ids = [...new Set(members.map(m => m.user_id))]
  const { data: profiles } = await sb.from('profiles').select('id').in('id', ids)
  const profileSet = new Set(profiles.map(p => p.id))
  const remaining = ids.filter(id => !profileSet.has(id))

  if (remaining.length === 0) {
    console.log('\n✅ Integridad OK — todos los users tienen profile')
    console.log('\nEjecuta este SQL en Supabase > SQL Editor:\n')
    console.log('─'.repeat(60))
    console.log(`ALTER TABLE public.company_members
  ADD CONSTRAINT company_members_user_id_profiles_fk
  FOREIGN KEY (user_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;`)
    console.log('─'.repeat(60))
  } else {
    console.log(`\n⚠️  Aún faltan ${remaining.length} profiles:`, remaining)
  }
}
run().catch(e => { console.error('💥', e); process.exit(1) })
