#!/usr/bin/env node

/**
 * Script para verificar usuarios en Supabase
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://omhycwfjxynkfwywzwvz.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

async function verifyUsers() {
  try {
    console.log('🔐 Conectando a Supabase...')
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Listar todos los usuarios
    console.log('\n📧 Obteniendo lista de usuarios...')
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()

    if (listError) {
      console.error('❌ Error:', listError.message)
      process.exit(1)
    }

    console.log(`\n✅ Total de usuarios: ${users.length}\n`)

    // Mostrar usuarios
    users.forEach(user => {
      console.log(`📧 ${user.email}`)
      console.log(`   ID: ${user.id}`)
      console.log(`   Confirmado: ${user.email_confirmed_at ? 'Sí' : 'No'}`)
      console.log(`   Creado: ${user.created_at}`)
      console.log()
    })

    // Intentar login con credenciales demo
    console.log('\n🔐 Intentando login con demo@gastocheck.app...')
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'demo@gastocheck.app',
      password: 'DemoGastoCheck2026!'
    })

    if (signInError) {
      console.log(`❌ Error de login: ${signInError.message}`)
    } else {
      console.log(`✅ Login exitoso!`)
      console.log(`   Usuario: ${data.user.email}`)
      console.log(`   ID: ${data.user.id}`)
    }

  } catch (error) {
    console.error('❌ Error inesperado:', error.message)
    process.exit(1)
  }
}

verifyUsers()
