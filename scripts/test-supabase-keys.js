#!/usr/bin/env node

/**
 * Script para verificar si las claves de Supabase funcionan desde el navegador
 */

const SUPABASE_URL = 'https://omhycwfjxynkfwywzwvz.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9taHljd2ZqeHlua2Z3eXd6d3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDkwODk3MjYsImV4cCI6MjAyNDY2OTcyNn0.sSlEbsfs4842PDD8H050uQ_dhLbljxActT_m0E4pqns'

async function testKeys() {
  try {
    console.log('🔐 Verificando claves de Supabase...')
    console.log(`URL: ${SUPABASE_URL}`)
    console.log(`ANON KEY: ${SUPABASE_ANON_KEY.substring(0, 20)}...`)

    // Intentar hacer un POST a Supabase auth
    console.log('\n🔄 Intentando autenticación contra Supabase...')
    const response = await fetch(
      `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          email: 'demo@gastocheck.app',
          password: 'DemoGastoCheck2026!',
        }),
      }
    )

    console.log(`Response status: ${response.status}`)
    const data = await response.json()

    if (response.ok) {
      console.log('✅ Autenticación exitosa!')
      console.log(`Token: ${data.access_token.substring(0, 20)}...`)
    } else {
      console.log('❌ Error en autenticación:')
      console.log(JSON.stringify(data, null, 2))
      console.log('\n⚠️  Posibles problemas:')
      console.log('1. Las claves de Supabase son incorrectas')
      console.log('2. El usuario no existe')
      console.log('3. Hay un problema con la política CORS de Supabase')
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

testKeys()
