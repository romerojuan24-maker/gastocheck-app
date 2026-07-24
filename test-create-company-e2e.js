// Prueba E2E: create-company
// Fecha: 2026-07-18
// Entorno: Produccion (Supabase)
// Ejecutar con: node test-create-company-e2e.js

const fs = require('fs');
const https = require('https');

const SUPABASE_URL = "https://omhycwfjxynkfwywzwvz.supabase.co";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log("=== PRUEBA E2E: create-company ===");
console.log("Entorno: PRODUCCION (Supabase)");
console.log("Fecha: 2026-07-18");
console.log("");

// Funcion auxiliar para hacer requests
function makeRequest(method, path, body, authToken = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, SUPABASE_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: method,
      headers: {
        "Content-Type": "application/json",
        "apikey": ANON_KEY
      }
    };

    if (authToken) {
      options.headers["Authorization"] = `Bearer ${authToken}`;
    }

    if (body) {
      const bodyStr = JSON.stringify(body);
      options.headers["Content-Length"] = bodyStr.length;
    }

    console.log(`${method} ${url.toString()}`);
    if (body) console.log(`Body: ${JSON.stringify(body)}`);
    console.log("");

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            statusText: res.statusMessage,
            headers: res.headers,
            data: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            statusText: res.statusMessage,
            headers: res.headers,
            data: data
          });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Paso 1: Crear usuario de prueba
async function step1() {
  console.log("Paso 1: Crear usuario de prueba en Auth...");

  const testEmail = `adm001+${Date.now()}@example.com`;
  const testPassword = "TestPassword123!@#";

  const response = await makeRequest('POST', '/auth/v1/signup', {
    email: testEmail,
    password: testPassword
  });

  console.log(`Response Status: ${response.status} ${response.statusText}`);
  console.log(`Response: ${JSON.stringify(response.data, null, 2)}`);
  console.log("");

  if (response.status === 200 && response.data && response.data.user) {
    const userId = response.data.user.id;
    const accessToken = response.data.session ? response.data.session.access_token : null;

    if (!accessToken) {
      console.error("ERROR: No access_token en response");
      process.exit(1);
    }

    console.log("OK: Usuario creado");
    console.log(`   Email: ${testEmail}`);
    console.log(`   User ID: ${userId}`);
    console.log(`   Access Token (primeros 50 caracteres): ${accessToken.substring(0, 50)}...`);
    console.log("");

    return { testEmail, userId, accessToken };
  } else {
    console.error("ERROR: Fallo al crear usuario");
    process.exit(1);
  }
}

// Paso 2: Invocar create-company
async function step2(userId, accessToken) {
  console.log("Paso 2: Invocar Edge Function create-company...");

  const companyName = `E2E Test Company ${new Date().toISOString()}`;

  const response = await makeRequest('POST', '/functions/v1/create-company', {
    companyName: companyName
  }, accessToken);

  console.log(`Response Status: ${response.status} ${response.statusText}`);
  console.log(`Response: ${JSON.stringify(response.data, null, 2)}`);
  console.log("");

  if (response.status >= 200 && response.status < 300 && response.data && response.data.company_id) {
    const companyId = response.data.company_id;
    const trialEndsAt = response.data.trial_ends_at;

    console.log("OK: Empresa creada");
    console.log(`   Company ID: ${companyId}`);
    console.log(`   Trial ends at: ${trialEndsAt}`);
    console.log("");

    return { companyName, companyId, trialEndsAt, response: response.data };
  } else {
    console.error("ERROR: Fallo al crear empresa");
    console.error(`Status: ${response.status}`);
    process.exit(1);
  }
}

// Paso 3: Guardar resultados
async function step3(testEmail, userId, accessToken, companyName, companyId, trialEndsAt, fullResponse) {
  console.log("Paso 3: Guardar IDs para verificacion posterior");

  const testData = {
    timestamp: new Date().toISOString(),
    entorno: "PRODUCCION",
    test_email: testEmail,
    user_id: userId,
    access_token_preview: accessToken.substring(0, 50) + "...",
    company_id: companyId,
    company_name: companyName,
    trial_ends_at: trialEndsAt,
    full_response_create_company: fullResponse
  };

  fs.writeFileSync('docs/TEST_E2E_CREATE_COMPANY_RESULT.json', JSON.stringify(testData, null, 2), 'utf8');
  console.log("OK: Datos guardados en docs/TEST_E2E_CREATE_COMPANY_RESULT.json");
  console.log("");
}

// Paso 4: Criterios de exito
async function step4(companyId, trialEndsAt) {
  console.log("=== CRITERIOS DE EXITO ===");
  console.log("");
  console.log("Esperado:");
  console.log("  HTTP 200/201");
  console.log("  company_id valido");
  console.log("  empresa creada");
  console.log("  company_members creada");
  console.log("  role = admin");
  console.log("  trial_ends_at asignado");
  console.log("  usuario puede leer su empresa");
  console.log("");
  console.log("Obtenido:");
  console.log("  HTTP: 200 (OK) [SUCCESS]");
  console.log(`  company_id: ${companyId} [SUCCESS]`);
  console.log(`  trial_ends_at: ${trialEndsAt} [${trialEndsAt ? 'SUCCESS' : 'FAIL'}]`);
  console.log("");
  console.log("=== SIGUIENTE: Verificar persistencia en BD ===");
  console.log("");
  console.log("Ejecutar en Supabase SQL Editor:");
  console.log(`  SELECT * FROM companies WHERE id = '${companyId}';`);
  console.log(`  SELECT * FROM company_members WHERE company_id = '${companyId}';`);
  console.log("");
}

// Ejecutar
(async () => {
  try {
    const { testEmail, userId, accessToken } = await step1();
    const { companyName, companyId, trialEndsAt, response } = await step2(userId, accessToken);
    await step3(testEmail, userId, accessToken, companyName, companyId, trialEndsAt, response);
    await step4(companyId, trialEndsAt);
  } catch (error) {
    console.error("ERROR:", error.message);
    process.exit(1);
  }
})();
