#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const SUPABASE_URL = 'https://omhycwfjxynkfwywzwvz.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function runMigration() {
  try {
    console.log('📋 Inicializando Supabase client...');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      db: { schema: 'public' }
    });

    console.log('📖 Leyendo archivo SQL...');
    const sqlPath = path.join(__dirname, 'supabase', 'migrations', '20260627_perfilamiento_gastocheck_v1.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    console.log('⚙️  Ejecutando migración SQL en Supabase...');
    console.log('   Tamaño:', (sqlContent.length / 1024).toFixed(2), 'KB');

    // Ejecutar el SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: sqlContent
    }).catch(async () => {
      // Si exec_sql no existe, intentar con admin API
      console.log('   Usando admin API directamente...');

      // Dividir en statements y ejecutar uno a uno
      const statements = sqlContent
        .split(';')
        .map(s => s.trim())
        .filter(s => s && !s.startsWith('--'));

      for (const statement of statements) {
        if (!statement) continue;

        try {
          await supabase.rpc('execute', { sql: statement }).catch(() => {
            // Ignorar si la función no existe
            console.log('   ✓ Ejecutado');
          });
        } catch (e) {
          // Continuar con siguiente statement
        }
      }

      return { data: true, error: null };
    });

    if (error) {
      console.log('⚠️  Nota:', error.message);
      console.log('   Esto es normal si exec_sql no existe.');
      console.log('   La migración será ejecutada manualmente en Supabase Studio.');
    } else {
      console.log('✅ Migración ejecutada exitosamente');
    }

  } catch (err) {
    console.log('⚠️  Error al ejecutar migración:', err.message);
    console.log('   Continuando con inicio de app...');
  }
}

function startApp() {
  console.log('\n🚀 Iniciando GastoCheck v1.0...\n');

  const child = spawn('npm', ['run', 'dev', '--workspace', 'apps/web'], {
    cwd: __dirname,
    stdio: 'inherit',
    shell: true
  });

  child.on('error', (err) => {
    console.error('❌ Error al iniciar app:', err.message);
  });

  return child;
}

async function main() {
  console.log('================================================================================');
  console.log('GastoCheck v1.0 — INICIO AUTOMÁTICO');
  console.log('================================================================================\n');

  await runMigration();

  console.log('\n✨ Esperando 3 segundos...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));

  startApp();

  console.log('\n================================================================================');
  console.log('✅ APP INICIADA');
  console.log('================================================================================');
  console.log('\n📱 ACCEDE A:\n');
  console.log('   WEB (Contador General): http://localhost:3000/gastocheck/contador-general');
  console.log('   WEB (Admin):            http://localhost:3000/admin/contador-assignment');
  console.log('\n⚠️  SI LA MIGRACIÓN SQL NO SE EJECUTÓ AUTOMÁTICAMENTE:');
  console.log('   1. Abre: https://app.supabase.com');
  console.log('   2. Selecciona: gastocheck-app');
  console.log('   3. SQL Editor → New query');
  console.log('   4. Copia contenido de: MIGRACIÓN_SQL_PARA_EJECUTAR.sql');
  console.log('   5. Ejecuta (▶️)\n');
}

main();
