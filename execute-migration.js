#!/usr/bin/env node

// Script para ejecutar la migración SQL de GastoCheck v1.0
const fs = require('fs');
const path = require('path');

// Leer el archivo SQL
const sqlPath = path.join(__dirname, 'supabase', 'migrations', '20260627_perfilamiento_gastocheck_v1.sql');
const sqlContent = fs.readFileSync(sqlPath, 'utf8');

console.log('📋 Archivo SQL cargado:', sqlPath);
console.log('📏 Tamaño:', (sqlContent.length / 1024).toFixed(2), 'KB');
console.log('');
console.log('✅ LISTO PARA EJECUTAR EN SUPABASE STUDIO');
console.log('');
console.log('Pasos:');
console.log('1. Abre: https://app.supabase.com');
console.log('2. Selecciona proyecto: gastocheck-app');
console.log('3. SQL Editor → New query');
console.log('4. Copia y pega el contenido de:');
console.log('   supabase/migrations/20260627_perfilamiento_gastocheck_v1.sql');
console.log('5. Ejecuta (play button ▶️)');
console.log('6. Espera "✓ Success"');
console.log('');
console.log('---');
console.log('CONTENIDO DEL SQL (primeros 500 caracteres):');
console.log('---');
console.log(sqlContent.substring(0, 500));
console.log('...');
console.log('---');
console.log('');
console.log('✨ Una vez ejecutado, la app estará LISTA para acceso.');
