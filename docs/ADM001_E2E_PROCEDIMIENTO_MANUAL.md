# ADM-001: Procedimiento E2E Manual — Paso a Paso
**Fecha: 2026-07-18**  
**Estado: BLOQUEADOR TÉCNICO ENCONTRADO - REQUIERE INTERVENCIÓN MANUAL**

---

## Bloqueador Técnico

1. **Auth Rate Limit (429):** El endpoint `/auth/v1/signup` tiene rate limit que impide crear usuarios automáticamente
2. **Dashboard UI Congelada:** Supabase dashboard Auth→Users es inestable
3. **Conclusión:** Es imposible crear usuario automáticamente para completar la prueba E2E

---

## Procedimiento Manual para Completar ADM-001 E2E

### Paso 1: Crear usuario en Supabase Auth (Manual)

Acceso directo (si el dashboard responde):  
```
https://supabase.com/dashboard/project/omhycwfjxynkfwywzwvz/auth/users
```

O mediante Supabase CLI:

```bash
# Crear usuario vía Supabase CLI
supabase --project-id omhycwfjxynkfwywzwvz auth users create \
  --email "test-adm001@example.com" \
  --password "TestPass123!@#$"
```

**Datos del usuario:**
- Email: `test-adm001@example.com`
- Password: `TestPass123!@#$`
- Email confirmado: SÍ (importante)

---

### Paso 2: Obtener access token del usuario

Ejecutar este script después de crear el usuario:

```bash
node test-create-company-e2e-signin.js
```

Script (guardar como `test-create-company-e2e-signin.js`):

```javascript
const https = require('https');

const SUPABASE_URL = "https://omhycwfjxynkfwywzwvz.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9taHljd2ZqeHlua2Z3eXd6d3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NzY0MjMsImV4cCI6MjA5NjM1MjQyM30.J9cmcQPAyuW7S9R7_3UDevYKAvLThSI6JWgHIl3Yj14";
const TEST_EMAIL = "test-adm001@example.com";
const TEST_PASSWORD = "TestPass123!@#$";

console.log("=== PASO 2: Obtener access token ===");
console.log("");

function makeRequest(method, path, body) {
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

    if (body) {
      const bodyStr = JSON.stringify(body);
      options.headers["Content-Length"] = bodyStr.length;
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
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

(async () => {
  try {
    console.log(`POST /auth/v1/token?grant_type=password`);
    console.log(`Email: ${TEST_EMAIL}`);
    console.log("");

    const response = await makeRequest('POST', '/auth/v1/token?grant_type=password', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });

    console.log(`Status: ${response.status}`);
    console.log("Response:");
    console.log(JSON.stringify(response.data, null, 2));
    console.log("");

    if (response.status === 200 && response.data.access_token) {
      console.log("✅ Access token obtenido:");
      console.log(`   ${response.data.access_token}`);
      console.log("");
      console.log("Guardar este token para el Paso 3");
    } else {
      console.error("❌ Error al obtener token");
      process.exit(1);
    }
  } catch (error) {
    console.error("ERROR:", error.message);
    process.exit(1);
  }
})();
```

---

### Paso 3: Invocar create-company

Ejecutar este script con el access token obtenido en Paso 2:

```bash
node test-create-company-e2e-complete.js
```

Script (guardar como `test-create-company-e2e-complete.js`):

```javascript
const https = require('https');
const fs = require('fs');
const readline = require('readline');

const SUPABASE_URL = "https://omhycwfjxynkfwywzwvz.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9taHljd2ZqeHlua2Z3eXd6d3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NzY0MjMsImV4cCI6MjA5NjM1MjQyM30.J9cmcQPAyuW7S9R7_3UDevYKAvLThSI6JWgHIl3Yj14";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function makeRequest(method, path, body, authToken) {
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

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
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

(async () => {
  try {
    console.log("=== PASO 3: Invocar create-company ===");
    console.log("");

    const accessToken = await question("Pegar access token obtenido en Paso 2: ");
    rl.close();

    if (!accessToken || accessToken.length < 50) {
      console.error("❌ Token inválido");
      process.exit(1);
    }

    console.log("");
    console.log(`POST /functions/v1/create-company`);
    console.log(`Authorization: Bearer [token]`);
    console.log("");

    const companyName = `E2E ADM001 ${new Date().toISOString()}`;
    const response = await makeRequest('POST', '/functions/v1/create-company', {
      company_name: companyName
    }, accessToken);

    console.log(`Status: ${response.status}`);
    console.log("Response:");
    console.log(JSON.stringify(response.data, null, 2));
    console.log("");

    if (response.status >= 200 && response.status < 300) {
      console.log("✅ create-company exitoso");
      console.log("");

      const evidence = {
        timestamp: new Date().toISOString(),
        entorno: "PRODUCCION",
        usuario_email: "test-adm001@example.com",
        http_status: response.status,
        response_body: response.data,
        company_id: response.data?.company_id,
        trial_ends_at: response.data?.trial_ends_at
      };

      fs.writeFileSync('docs/ADM001_E2E_EVIDENCE.json', JSON.stringify(evidence, null, 2), 'utf8');
      console.log("Evidencia guardada en: docs/ADM001_E2E_EVIDENCE.json");
    } else {
      console.error("❌ Error en create-company");
      process.exit(1);
    }
  } catch (error) {
    console.error("ERROR:", error.message);
    process.exit(1);
  }
})();
```

---

### Paso 4: Verificar persistencia en BD

Con el `company_id` obtenido en Paso 3, ejecutar en SQL Editor de Supabase:

```sql
-- Verificar empresa
SELECT id, name, trial_ends_at, created_at FROM companies 
WHERE id = '[COMPANY_ID_DEL_PASO_3]';

-- Verificar membresía
SELECT company_id, user_id, role, created_at FROM company_members 
WHERE company_id = '[COMPANY_ID_DEL_PASO_3]';
```

---

## Criterios de Éxito Esperados

```
✅ Paso 1: Usuario creado en Auth
✅ Paso 2: Access token obtenido (status 200)
✅ Paso 3: create-company retorna 200/201 con company_id
✅ Paso 4: Fila en companies existe con trial_ends_at
✅ Paso 4: Fila en company_members existe con role='admin'
```

---

## Criterios de Fallo

```
❌ Paso 2: Error 401/403 (credenciales inválidas)
❌ Paso 3: Error 4xx/5xx (Edge Function falla)
❌ Paso 3: company_id ausente en response
❌ Paso 4: Filas no existen en BD
❌ Paso 4: role ≠ 'admin'
❌ Paso 4: trial_ends_at es NULL
```

---

## Resultado

Después de completar todos los pasos manualmente, ADM-001 se clasificará como:

- **Si Paso 4 exitoso:** E4 ✅ (operativo probado)
- **Si Paso 3 falla:** E2 (schema válido, pero Edge Function falla)
- **Si Paso 2 falla:** E2 (requiere depuración de Auth)

**NO AVANZAR A OTROS FLUJOS HASTA OBTENER RESULTADO DEFINITIVO**
