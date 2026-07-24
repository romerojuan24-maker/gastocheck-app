#!/usr/bin/env node

/**
 * Setup completo de datos demo en Supabase
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://omhycwfjxynkfwywzwvz.supabase.co'
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function run() {
  console.log('🔍 Inspeccionando tablas disponibles...\n')

  // 1. Ver qué tablas existen
  const tables = ['companies', 'company_members', 'profiles', 'users', 'organizations', 'tenants']
  for (const t of tables) {
    const { data, error } = await sb.from(t).select('*').limit(1)
    if (!error) {
      console.log(`✅ Tabla "${t}" existe`)
    } else {
      console.log(`❌ Tabla "${t}": ${error.message}`)
    }
  }

  // 2. Buscar el usuario demo
  console.log('\n👤 Buscando usuario demo...')
  const { data: { users } } = await sb.auth.admin.listUsers()
  const demo = users.find(u => u.email === 'demo@gastocheck.app')
  if (!demo) { console.error('❌ Usuario demo no encontrado'); process.exit(1) }
  console.log(`✅ Usuario demo encontrado: ${demo.id}`)

  // 3. Intentar company_members para ver la estructura
  console.log('\n📋 Inspeccionando company_members...')
  const { data: members, error: membErr } = await sb.from('company_members').select('*').limit(5)
  if (membErr) {
    console.log(`❌ company_members: ${membErr.message}`)
  } else {
    console.log(`✅ company_members tiene ${members.length} registros`)
    if (members.length > 0) console.log('   Ejemplo:', JSON.stringify(members[0], null, 2))
  }

  // 4. Ver companies
  console.log('\n🏢 Inspeccionando companies...')
  const { data: comps, error: compErr } = await sb.from('companies').select('*').limit(5)
  if (compErr) {
    console.log(`❌ companies: ${compErr.message}`)
  } else {
    console.log(`✅ companies tiene ${comps.length} registros`)
    if (comps.length > 0) console.log('   Ejemplo:', JSON.stringify(comps[0], null, 2))
  }
}

run().catch(console.error)
