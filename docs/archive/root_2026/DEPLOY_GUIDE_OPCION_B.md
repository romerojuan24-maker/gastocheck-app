# 🚀 DEPLOY GUIDE: OPCIÓN B - FLUJO COMPLETO

**Estado:** 100% Código Producción-Ready  
**Fecha:** 2026-06-21  
**Tiempo de Deploy:** 30-45 minutos  

---

## ✅ CHECKLIST PRE-DEPLOY

```
[ ] Acceso a Supabase (https://app.supabase.com)
[ ] Backup de BD (automático en Supabase)
[ ] Terminal/CLI abierta
[ ] Node.js 18+ instalado
[ ] Git actualizado
```

---

## 📋 PASO 1: DEPLOY SQL (5 minutos)

### 1.1 Copiar SQL completo

Archivo: `sql/20260621_opcion_b_tablas_completas.sql`

```bash
cat sql/20260621_opcion_b_tablas_completas.sql | pbcopy  # macOS
# o
xclip -selection clipboard < sql/20260621_opcion_b_tablas_completas.sql  # Linux
# o (Windows)
Get-Content sql/20260621_opcion_b_tablas_completas.sql | Set-Clipboard
```

### 1.2 Ejecutar en Supabase

1. Ir a: https://app.supabase.com
2. Seleccionar proyecto
3. SQL Editor → New Query
4. Pegar todo el código SQL
5. Click "Run"
6. **Esperado:** Mensaje "OPCIÓN B CREADA ✅"

### 1.3 Verificar creación

```sql
-- Verificar tablas
SELECT tablename FROM pg_tables WHERE tablename LIKE 'plan_pagos_semanal' OR tablename LIKE 'pago_semanal' OR tablename LIKE 'ingreso_semanal_esperado';

-- Verificar funciones
SELECT proname FROM pg_proc WHERE proname LIKE 'fn_calcular%' OR proname LIKE 'fn_validar%';

-- Verificar triggers
SELECT trigger_name FROM information_schema.triggers WHERE event_object_table LIKE 'plan_pagos_semanal' OR event_object_table LIKE 'pago_semanal';
```

**Resultado esperado:**
- ✅ 8 tablas creadas
- ✅ 6+ funciones creadas
- ✅ 6+ triggers creados

---

## 📋 PASO 2: DEPLOY EDGE FUNCTIONS (10 minutos)

### 2.1 Instalar Supabase CLI

```bash
npm install -g supabase
```

### 2.2 Autenticar con Supabase

```bash
supabase login
```

Sigue las instrucciones, pega el access token.

### 2.3 Deploy Functions

```bash
# Desde raíz del proyecto
supabase functions deploy

# O individual
supabase functions deploy actualizar-flujo-semanal
supabase functions deploy crear-plan-semanal
supabase functions deploy arrastrar-pago
supabase functions deploy calcular-escenarios-what-if
supabase functions deploy generar-alertas-inteligentes
supabase functions deploy calcular-scoring-cobranza
```

**Esperado:** ✅ Functions deployed successfully

### 2.4 Verificar Edge Functions

```bash
supabase functions list
```

Debes ver 6 funciones listadas.

---

## 📋 PASO 3: INSTALAR DEPENDENCIAS (5 minutos)

```bash
npm install
```

O si uses pnpm:

```bash
pnpm install
```

**Esperado:** ✅ Todos los packages instalados

Verifica que se instaló:
- ✅ react-beautiful-dnd
- ✅ @supabase/supabase-js
- ✅ react-hot-toast
- ✅ recharts

```bash
npm list react-beautiful-dnd
npm list @supabase/supabase-js
```

---

## 📋 PASO 4: VARIABLES DE ENTORNO (.env.local)

Crea archivo `.env.local` en raíz del proyecto:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[TU_PROYECTO].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[TU_ANON_KEY]

# Edge Functions URL
NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL=https://[TU_PROYECTO].supabase.co/functions/v1
```

**Cómo obtener:**

1. Ir a: https://app.supabase.com → Settings → API
2. Copiar: `Project URL` → NEXT_PUBLIC_SUPABASE_URL
3. Copiar: `anon public` → NEXT_PUBLIC_SUPABASE_ANON_KEY

---

## 📋 PASO 5: TEST LOCAL (10 minutos)

### 5.1 Iniciar desarrollo

```bash
npm run dev
```

Debe abrir en: http://localhost:3000

### 5.2 Navegar a Planeador

```
http://localhost:3000/flujo-efectivo
```

(Ajusta ruta según tu app)

### 5.3 Pruebas manuales

✅ **Test 1: Crear Plan Semanal**
- Click "Crear Plan Semanal"
- Ingresa: empresa_id, caja_inicial
- Debe crear plan ✅

✅ **Test 2: Agregar Pago**
- Click "Agregar Pago"
- Ingresa: descripcion, monto, tipo, vencimiento
- Debe aparecer en columna de día ✅

✅ **Test 3: Drag & Drop**
- Arrastra pago entre días
- Debe validar flujo ✅
- Toast debe mostrar "Pago movido" ✅

✅ **Test 4: Actualización Tiempo Real**
- Abre 2 navegadores
- En uno, arrastra pago
- En otro, debe actualizar automáticamente ✅

✅ **Test 5: Alertas**
- Crea pago sin flujo
- Debe mostrar alerta ✅

---

## 📋 PASO 6: DEPLOY A PRODUCCIÓN (5 minutos)

### 6.1 Build

```bash
npm run build
```

**Esperado:** ✅ Build successful

### 6.2 Deploy

Opción A: **Vercel** (Recomendado)

```bash
npm i -g vercel
vercel
```

Sigue instrucciones.

Opción B: **GitHub Pages**

```bash
# Commit cambios
git add -A
git commit -m "Deploy OPCIÓN B"
git push origin main
```

Opción C: **Docker**

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
docker build -t gastocheck-opcion-b .
docker run -p 3000:3000 gastocheck-opcion-b
```

---

## 🔍 TROUBLESHOOTING

### Error: "Edge Function not found"

```bash
# Verificar functions
supabase functions list

# Re-deploy
supabase functions deploy
```

### Error: "Cannot find module 'react-beautiful-dnd'"

```bash
# Reinstalar dependencias
rm -rf node_modules package-lock.json
npm install
```

### Error: "Supabase credentials invalid"

1. Verificar `.env.local`
2. Verificar que NEXT_PUBLIC_SUPABASE_URL sea correcto
3. Verificar que NEXT_PUBLIC_SUPABASE_ANON_KEY sea válida

```bash
# Test conexión
curl https://[TU_URL]/rest/v1/plan_pagos_semanal
```

### Error: "Trigger not firing"

```sql
-- Verificar triggers
SELECT * FROM information_schema.triggers;

-- Re-crear trigger
DROP TRIGGER IF EXISTS tr_calcular_urgencia ON pago_semanal;
CREATE TRIGGER tr_calcular_urgencia
BEFORE INSERT OR UPDATE ON pago_semanal
FOR EACH ROW
EXECUTE FUNCTION fn_calcular_urgencia_pago();
```

---

## 📊 POST-DEPLOY CHECKLIST

```
[ ] SQL ejecutado sin errores
[ ] 8 tablas creadas
[ ] 6 Edge Functions deployed
[ ] Dependencies instaladas
[ ] .env.local configurado
[ ] Test local pasó
[ ] Build successful
[ ] Deploy en producción
[ ] Usuarios pueden acceder
```

---

## 📞 MONITOREO POST-DEPLOY

### Logs de Edge Functions

```bash
supabase functions list --json
```

### Monitoreo en tiempo real

```bash
# Ver logs en vivo
supabase functions logs
```

### Verificar uso

https://app.supabase.com → Realtime → Functions

---

## ✅ OPCIÓN B DEPLOYED

Una vez completados todos los pasos:

```
🎉 OPCIÓN B - FLUJO COMPLETO ACTIVA

✅ Planeador semanal operativo
✅ Drag & drop funcionando
✅ Alertas automáticas
✅ Tiempo real sincronizado
✅ Edge Functions respondiendo
✅ Base de datos operativa

READY FOR USERS 🚀
```

---

## 📚 RECURSOS

- [Supabase Docs](https://supabase.com/docs)
- [Edge Functions](https://supabase.com/docs/guides/functions)
- [React Beautiful DnD](https://github.com/atlassian/react-beautiful-dnd)
- [Next.js Docs](https://nextjs.org/docs)

---

## 🆘 SOPORTE

Si hay errores durante deploy:

1. Revisar logs en Supabase
2. Revisar console del navegador (F12)
3. Revert último cambio
4. Contactar soporte Supabase si es error de infraestructura

