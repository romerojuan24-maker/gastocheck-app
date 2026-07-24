#!/usr/bin/env node

/**
 * Script para verificar/crear usuario de demostración
 * Uso: node scripts/setup-demo-user.js
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://omhycwfjxynkfwywzwvz.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const DEMO_EMAIL = 'demo@gastocheck.app'
const DEMO_PASSWORD = 'DemoGastoCheck2026!' // Contraseña segura por defecto

async function setupDemoUser() {
  try {
    console.log('🔐 Conectando a Supabase...')
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // 1. Verificar si el usuario existe
    console.log(`\n📧 Verificando si ${DEMO_EMAIL} existe...`)
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()

    if (listError) {
      console.error('❌ Error al listar usuarios:', listError.message)
      process.exit(1)
    }

    const existingUser = users.find(u => u.email === DEMO_EMAIL)

    if (existingUser) {
      console.log(`✅ Usuario ${DEMO_EMAIL} ya existe`)
      console.log(`   ID: ${existingUser.id}`)
      console.log(`   Email verificado: ${existingUser.email_confirmed_at ? 'Sí' : 'No'}`)
      console.log(`\n⚠️  Para cambiar contraseña, usa:")`)
      console.log(`   supabase.auth.admin.updateUserById("${existingUser.id}", { password: "nueva-contraseña" })`)

      // Opcionalmente resetear contraseña
      console.log(`\n🔄 Reseteando contraseña a: ${DEMO_PASSWORD}`)
      const { error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, {
        password: DEMO_PASSWORD,
        email_confirm: true,
      })

      if (updateError) {
        console.error('❌ Error al resetear contraseña:', updateError.message)
        process.exit(1)
      }

      console.log(`✅ Contraseña reseteada correctamente`)
      console.log(`\n📱 Datos de acceso:`)
      console.log(`   Email: ${DEMO_EMAIL}`)
      console.log(`   Contraseña: ${DEMO_PASSWORD}`)
      console.log(`   URL: http://localhost:3000`)
    } else {
      // 2. Crear usuario si no existe
      console.log(`❌ Usuario ${DEMO_EMAIL} no existe. Creándolo...`)

      const { data: { user }, error: createError } = await supabase.auth.admin.createUser({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: {
          display_name: 'Demo User',
        },
      })

      if (createError) {
        console.error('❌ Error al crear usuario:', createError.message)
        process.exit(1)
      }

      console.log(`✅ Usuario ${DEMO_EMAIL} creado correctamente`)
      console.log(`   ID: ${user.id}`)

      // 3. Crear registro en tabla de usuarios
      console.log(`\n👤 Creando perfil de usuario...`)
      const { error: profileError } = await supabase
        .from('usuarios')
        .insert({
          id: user.id,
          email: DEMO_EMAIL,
          nombre: 'Demo User',
          rol: 'admin', // O el rol que prefieras
          activo: true,
          creado_en: new Date(),
        })
        .select()

      if (profileError) {
        console.warn('⚠️  Error al crear perfil (puede ser normal si tabla no existe):', profileError.message)
      } else {
        console.log(`✅ Perfil creado correctamente`)
      }

      console.log(`\n📱 Datos de acceso:`)
      console.log(`   Email: ${DEMO_EMAIL}`)
      console.log(`   Contraseña: ${DEMO_PASSWORD}`)
      console.log(`   URL: http://localhost:3000`)
    }

    console.log(`\n✨ Setup completado!`)
    console.log(`\n🚀 Próximos pasos:`)
    console.log(`   1. Abre: http://localhost:3000`)
    console.log(`   2. Click en "Login"`)
    console.log(`   3. Email: ${DEMO_EMAIL}`)
    console.log(`   4. Contraseña: ${DEMO_PASSWORD}`)
    console.log(`   5. Explora los módulos`)

  } catch (error) {
    console.error('❌ Error inesperado:', error.message)
    process.exit(1)
  }
}

setupDemoUser()
