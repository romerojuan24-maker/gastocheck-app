/**
 * TEST: Invocar scan-document localmente
 * Uso: deno run --allow-net --allow-env test.ts
 */

import { scanDocument } from './index.ts';

/**
 * Imagen de prueba: Ticket OXXO genérico en base64
 * (En producción, obtén la imagen del dispositivo del usuario)
 */
const TEST_IMAGE_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function testScanDocument() {
  console.log('🧪 Iniciando test de scan-document...\n');

  try {
    console.log('📸 Escaneando documento de prueba...');
    const result = await scanDocument(TEST_IMAGE_BASE64);

    console.log('\n✅ Resultado exitoso:');
    console.log(JSON.stringify(result, null, 2));

    // Validaciones básicas
    console.log('\n🔍 Validaciones:');
    console.log(`  ✓ Amount: ${result.amount !== null ? '✅' : '⚠️'} ${result.amount}`);
    console.log(`  ✓ Date: ${result.date !== null ? '✅' : '⚠️'} ${result.date}`);
    console.log(`  ✓ Vendor: ${result.vendor !== null ? '✅' : '⚠️'} ${result.vendor}`);
    console.log(`  ✓ Concept: ${result.concept !== null ? '✅' : '⚠️'} ${result.concept}`);
    console.log(`  ✓ RFC: ${result.rfc !== null ? '✅' : '⚠️'} ${result.rfc}`);
    console.log(`  ✓ Confidence: ${result.confidence}`);
    console.log(`  ✓ Warnings: ${result.warnings.length} issue(s)`);

    if (result.warnings.length > 0) {
      console.log('\n⚠️ Advertencias detectadas:');
      result.warnings.forEach((w, i) => console.log(`    ${i + 1}. ${w}`));
    }
  } catch (err) {
    console.error('\n❌ Error durante test:', err);
    process.exit(1);
  }
}

async function testHttpPost() {
  console.log('\n\n🌐 Iniciando test HTTP POST...\n');

  try {
    const response = await fetch('http://localhost:54321/functions/v1/scan-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_base64: TEST_IMAGE_BASE64,
        mime_type: 'image/jpeg',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ HTTP ${response.status}:`, error);
      return;
    }

    const data = await response.json();
    console.log('✅ HTTP Response:');
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('❌ HTTP test error:', err);
  }
}

async function runTests() {
  // Test directo
  await testScanDocument();

  // Test HTTP (requiere que la función esté deployada localmente)
  // await testHttpPost();

  console.log('\n✅ Tests completados');
}

runTests().catch(console.error);
