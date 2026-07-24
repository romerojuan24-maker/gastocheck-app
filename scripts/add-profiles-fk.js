#!/usr/bin/env node
/**
 * 1. Verifica que no hay company_members.user_id sin profile correspondiente
 * 2. Si está limpio, muestra el ALTER TABLE listo para ejecutar en Supabase SQL Editor
 */
const { createClient } = require('@supabase/supabase-js')

const URL = 'https://omhycwfjxynkfwywzwvz.supabase.co'
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY

const sb = createClient(URL, SVC, { auth: { persistSession: false } })

async function run() {
  console.log('🔍 Verificando integridad company_members → profiles...\n')

  // Traer todos los user_id de company_members
  const { data: members, error: mErr } = await sb
    .from('company_members')
    .select('user_id')

  if (mErr) { console.error('❌', mErr.message); process.exit(1) }

  const userIds = [...new Set(members.map(m => m.user_id))]
  console.log(`   company_members: ${members.length} filas, ${userIds.length} users únicos`)

  // Traer todos los profiles
  const { data: profiles, error: pErr } = await sb
    .from('profiles')
    .select('id')
    .in('id', userIds)

  if (pErr) { console.error('❌', pErr.message); process.exit(1) }

  const profileIds = new Set(profiles.map(p => p.id))
  const orphans = userIds.filter(id => !profileIds.has(id))

  if (orphans.length > 0) {
    console.log(`\n⚠️  Hay ${orphans.length} user_id SIN fila en profiles:`)
    orphans.forEach(id => console.log(`   - ${id}`))
    console.log('\n❌ La FK no se puede aplicar hasta crear esos perfiles.')
    console.log('   Ejecuta este SQL en Supabase para crearlos:')
    console.log(`
INSERT INTO profiles (id, full_name)
SELECT cm.user_id, au.email
FROM company_members cm
JOIN auth.users au ON au.id = cm.user_id
WHERE cm.user_id NOT IN (SELECT id FROM profiles)
ON CONFLICT (id) DO NOTHING;
`)
  } else {
    console.log(`   profiles encontrados: ${profiles.length}/${userIds.length} ✅ Todos tienen profile\n`)
    console.log('🎉 Integridad OK — puedes aplicar la FK.')
    console.log('\nEjecuta este SQL en Supabase > SQL Editor:\n')
    console.log('─'.repeat(60))
    console.log(`
ALTER TABLE public.company_members
  ADD CONSTRAINT company_members_user_id_profiles_fk
  FOREIGN KEY (user_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;
`)
    console.log('─'.repeat(60))
    console.log('\nDespués de eso, los embedded joins de PostgREST funcionarán.')
    console.log('Ejemplo: .select("company_id, role, profiles(full_name)")')
  }
}

run().catch(e => { console.error('💥', e); process.exit(1) })
