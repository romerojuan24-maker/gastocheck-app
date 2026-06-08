# GastoCheck — Guía de Deployment Completo

> Sigue este orden exacto. Cada sección indica si lo hace **Claude automáticamente** o si **tú lo haces manualmente**.

---

## PASO 1 — Instalar Supabase CLI ✋ TÚ

```powershell
# En PowerShell como Administrador
winget install Supabase.CLI

# Verificar instalación
supabase --version
```

---

## PASO 2 — Login y vincular proyecto ✋ TÚ

```powershell
# Login (abre navegador)
supabase login

# Ir a la carpeta del proyecto
cd C:\Users\admin\Documents\gastocheck-app

# Vincular con tu proyecto de Supabase
# (el PROJECT_ID lo encuentras en Supabase Dashboard → Settings → General)
supabase link --project-ref TU_PROJECT_ID
```

---

## PASO 3 — Ejecutar Migration 0002 ✋ TÚ (en Supabase Dashboard)

1. Entra a [supabase.com/dashboard](https://supabase.com/dashboard)
2. Selecciona tu proyecto `gastocheck`
3. Ve a **SQL Editor → New query**
4. Copia y pega el contenido de:
   ```
   supabase/migrations/0002_storage_rls_seed.sql
   ```
5. Haz clic en **Run**

> ✅ Esto crea: buckets de Storage, RLS de Storage, tabla policy_snapshots,
> campo rejection_reason, índice único de CFDI

---

## PASO 4 — Crear usuarios de prueba ✋ TÚ (en Supabase Dashboard)

1. Ve a **Authentication → Users → Add user**
2. Crea estos 3 usuarios:

| Email | Contraseña | Rol en GastoCheck |
|-------|-----------|-------------------|
| `owner@gastocheck.test` | `Test1234!` | Owner (dueño) |
| `super@gastocheck.test` | `Test1234!` | Supervisor |
| `spender@gastocheck.test` | `Test1234!` | Spender (gastos) |

3. Después de crearlos, copia sus **UUIDs** (columna ID en la tabla de usuarios)
4. En **SQL Editor**, edita estas líneas de `0002_storage_rls_seed.sql`:
   ```sql
   v_owner_id    uuid := 'PEGA-UUID-OWNER-AQUI';
   v_super_id    uuid := 'PEGA-UUID-SUPERVISOR-AQUI';
   v_spender_id  uuid := 'PEGA-UUID-SPENDER-AQUI';
   ```
5. Ejecuta solo el bloque `DO $$ ... $$;` del seed

---

## PASO 5 — Configurar Secrets en Supabase ✋ TÚ

Ve a **Settings → Edge Functions → Secrets** y agrega:

| Secret | Valor | Cómo obtenerlo |
|--------|-------|---------------|
| `GEMINI_API_KEY` | `AIza...` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `WHATSAPP_API_TOKEN` | `EAA...` | Meta Business → WhatsApp → API Setup |
| `WHATSAPP_PHONE_NUMBER_ID` | `123456...` | Meta Business → WhatsApp → Phone Number ID |

> ⚠️ `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`
> ya existen por defecto en todas las Edge Functions — no hace falta agregarlos.

---

## PASO 6 — Deploy Edge Functions ✋ TÚ (PowerShell)

```powershell
cd C:\Users\admin\Documents\gastocheck-app

# Deployar todas las functions de una vez
supabase functions deploy ocr-extract
supabase functions deploy authorize-expense
supabase functions deploy xml-parse
supabase functions deploy close-policy
supabase functions deploy export-excel
supabase functions deploy export-zip
supabase functions deploy send-whatsapp
```

**O en una sola línea:**
```powershell
@("ocr-extract","authorize-expense","xml-parse","close-policy","export-excel","export-zip","send-whatsapp") | ForEach-Object { supabase functions deploy $_ }
```

---

## PASO 7 — Configurar .env de la app web ✋ TÚ

Edita `apps/web/.env.local` (créalo si no existe):

```env
NEXT_PUBLIC_SUPABASE_URL=https://TU_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...TU_ANON_KEY
```

---

## PASO 8 — Configurar .env de la app móvil ✋ TÚ

Edita `apps/mobile/.env` (créalo si no existe):

```env
EXPO_PUBLIC_SUPABASE_URL=https://TU_PROJECT_ID.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...TU_ANON_KEY
```

> Ambas claves las encuentras en **Supabase Dashboard → Settings → API**

---

## PASO 9 — Levantar apps localmente ✋ TÚ

```powershell
cd C:\Users\admin\Documents\gastocheck-app

# Instalar dependencias (primera vez)
npm install

# Web (Next.js) — abre en http://localhost:3000
npm run dev --workspace=apps/web

# Móvil (Expo) — en otra terminal
npm run dev --workspace=apps/mobile
```

---

## PASO 10 — Verificar que todo funciona ✋ TÚ

### Prueba 1: OCR (Gemini)
```bash
curl -X POST https://TU_PROJECT_ID.supabase.co/functions/v1/ocr-extract \
  -H "Authorization: Bearer TU_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"image_base64": "BASE64_DE_UNA_FOTO_DE_TICKET", "mime_type": "image/jpeg"}'
```
Respuesta esperada: `{"ok": true, "data": {"total": ..., "proveedor": ..., "confidence": "high"}}`

### Prueba 2: Flujo completo móvil
1. Abre app móvil con usuario `spender@gastocheck.test`
2. Toca "Tomar foto del ticket"
3. Toma foto de cualquier recibo
4. Verifica que se prellenan los datos
5. Toca "✓ Guardar gasto"
6. Verifica que aparece en "Mis gastos"

### Prueba 3: Autorización web
1. Abre web con usuario `super@gastocheck.test`
2. Verifica que aparece el gasto en "Autorizaciones pendientes"
3. Toca "✓ Autorizar"
4. Verifica que cambia estatus a "Autorizado"

### Prueba 4: Exportar Excel
```bash
curl -X POST https://TU_PROJECT_ID.supabase.co/functions/v1/export-excel \
  -H "Authorization: Bearer TOKEN_DEL_SUPERVISOR" \
  -H "Content-Type: application/json" \
  -d '{"policy_id": "ID_DE_LA_POLIZA"}'
```
Respuesta esperada: `{"ok": true, "signed_url": "https://...", "rows": 5}`

---

## PASO 11 — Deploy a Producción (Vercel + EAS)

### Web → Vercel
```powershell
# Instalar Vercel CLI
npm install -g vercel

# Deploy
cd apps/web
vercel --prod
```

### Móvil → EAS Build
```powershell
# Instalar EAS CLI
npm install -g eas-cli

# Login
eas login

# Configurar (primera vez)
eas build:configure

# Build para Android
eas build --platform android

# Build para iOS
eas build --platform ios
```

---

## Resumen de estado

| # | Paso | Responsable | Estado |
|---|------|-------------|--------|
| 1 | Instalar Supabase CLI | Tú | ⏳ |
| 2 | Login + link proyecto | Tú | ⏳ |
| 3 | Ejecutar migration 0002 | Tú (SQL Editor) | ⏳ |
| 4 | Crear usuarios de prueba | Tú (Dashboard) | ⏳ |
| 5 | Agregar Secrets | Tú (Dashboard) | ⏳ |
| 6 | Deploy Edge Functions | Tú (PowerShell) | ⏳ |
| 7 | .env web | Tú | ⏳ |
| 8 | .env móvil | Tú | ⏳ |
| 9 | Levantar apps localmente | Tú | ⏳ |
| 10 | Verificar flujo completo | Tú | ⏳ |
| 11 | Deploy Vercel + EAS | Tú | ⏳ |

---

## 🆘 Problemas frecuentes

### "GEMINI_API_KEY no configurada"
→ Falta agregar el Secret en Supabase → Settings → Edge Functions → Secrets

### "póliza no encontrada" en móvil
→ El spender no tiene póliza abierta → créala desde web o SQL

### "Error 401 no auth" en Edge Functions
→ El token JWT expiró o no se está enviando → re-login en la app

### Storage "bucket not found"
→ No se ejecutó la migration 0002 → ejecutar en SQL Editor

### "duplicate UUID" al subir XML
→ Correcto, es la validación anti-duplicados funcionando
