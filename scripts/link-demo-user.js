#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://omhycwfjxynkfwywzwvz.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9taHljd2ZqeHlua2Z3eXd6d3Z6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDc3NjQyMywiZXhwIjoyMDk2MzUyNDIzfQ.mTSMLWCIOU_d8UNDNL8Dv40oJFUv8x9p3ceUQQbdvSU'

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const DEMO_USER_ID  = '17d69a4a-bb91-409d-8bcb-412b4ed4548d'
const DEMO_COMPANY_ID = '0e0c1a69-8584-45b2-848a-efe5a740fb2e'

async function run() {
  console.log('🔗 Enlazando usuario demo con empresa demo...\n')

  // 1. Ver si ya existe
  const { data: existing } = await sb
    .from('company_members')
    .select('*')
    .eq('user_id', DEMO_USER_ID)
    .maybeSingle()

  if (existing) {
    console.log('⚠️  Ya existe registro en company_members:')
    console.log(JSON.stringify(existing, null, 2))
    console.log('\n🔄 Actualizando a active/owner...')
    const { error } = await sb
      .from('company_members')
      .update({ status: 'active', role: 'owner' })
      .eq('user_id', DEMO_USER_ID)
    if (error) console.error('❌', error.message)
    else console.log('✅ Actualizado')
  } else {
    // 2. Insertar
    console.log('➕ Insertando en company_members...')
    const { data, error } = await sb
      .from('company_members')
      .insert({
        company_id: DEMO_COMPANY_ID,
        user_id:    DEMO_USER_ID,
        role:       'owner',
        status:     'active',
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Error insertando:', error.message)
      process.exit(1)
    }
    console.log('✅ Registro creado:', JSON.stringify(data, null, 2))
  }

  // 3. Verificar profile
  console.log('\n👤 Verificando perfil...')
  const { data: profile } = await sb
    .from('profiles')
    .select('*')
    .eq('id', DEMO_USER_ID)
    .maybeSingle()

  if (!profile) {
    console.log('➕ Creando perfil...')
    const { error } = await sb.from('profiles').insert({
      id:         DEMO_USER_ID,
      full_name:  'Demo GastoCheck',
      avatar_url: null,
    })
    if (error) console.warn('⚠️  Perfil:', error.message)
    else console.log('✅ Perfil creado')
  } else {
    console.log('✅ Perfil existe:', profile.full_name ?? '(sin nombre)')
  }

  console.log('\n🎉 Setup demo completo!')
  console.log(`\n📱 Credenciales:`)
  console.log(`   Email:      demo@gastocheck.app`)
  console.log(`   Contraseña: DemoGastoCheck2026!`)
  console.log(`   Empresa:    Constructora Demo SA de CV`)
  console.log(`   Rol:        owner`)
  console.log(`   URL:        http://localhost:3000/login`)
}

run().catch(console.error)
