# 🧪 GUÍA DE TESTING INTERACTIVO

**Fecha:** 2026-06-19  
**Objetivo:** Validar MVP en PC + Móvil con pasos visuales  
**Tiempo estimado:** 2.5 horas  

---

## PARTE 1: TESTING EN PC (1 hora)

### PRE-TESTING CHECKLIST

Antes de empezar, verifica:

- [ ] `.env.local` completado con APIs (ANTHROPIC, STRIPE, WHATSAPP)
- [ ] `npm run dev` ejecutándose sin errores
- [ ] Browser abierto en `http://localhost:3001`
- [ ] Console (F12) sin errores rojos
- [ ] Supabase seed data insertado (si ya creaste BD prod)

---

## FLUJO 1: AUTH (LOGIN)

### 1.1 Ir a Login Page

**Pasos:**
1. URL: `http://localhost:3001/login`
2. Deberías ver:
   - Logo de CHECK SUITE
   - Input "Email"
   - Input "Password"
   - Button "Iniciar sesión"

**Validar:**
- [ ] Página carga en < 2 segundos
- [ ] Inputs son visibles
- [ ] Button es clickeable

---

### 1.2 Ingresar Credenciales

**Pasos:**
1. Email input: `testadmin@gastocheck.com`
2. Password input: `TestPass123!`
3. Click "Iniciar sesión"

**Esperar:**
- 1-2 segundos para validación
- Redirect a `/hoy`

**Validar:**
- [ ] Redirect ocurre
- [ ] Dashboard aparece
- [ ] Ves KPIs (Saldo, Cartera, etc)
- [ ] Avatar muestra tu email en top right

**Si falla:**
- [ ] Ver console (F12) para error específico
- [ ] Ver TROUBLESHOOTING.md → "Login falla"

---

### 1.3 Logout

**Pasos:**
1. Click avatar (top right)
2. Click "Logout"

**Validar:**
- [ ] Redirect a `/login`
- [ ] Session termina
- [ ] Cookies/tokens se borran (F12 → Application)

---

## FLUJO 2: COBRACHECK DASHBOARD

### 2.1 Ver Dashboard

**Pasos:**
1. Ir a `/cobracheck`
2. Debería ver:
   - 4 KPI cards (Total por cobrar, Vencidas, En riesgo, Score promedio)
   - 3 tabs: Clientes, Facturas vencidas, Actividad
   - Button "+ Nuevo Cliente"

**Validar:**
- [ ] KPIs muestran números
- [ ] Total por cobrar > 0 (si hay datos)
- [ ] Tabs son clickeables
- [ ] Estilos se cargan correctamente

---

### 2.2 Ver Clientes (Tab 1)

**Pasos:**
1. Click tab "Clientes" (debería estar selected)
2. Ver lista de clientes

**Validar:**
- [ ] Lista muestra clientes (si hay datos en DB)
- [ ] Para cada cliente ves:
  - Nombre
  - RFC
  - Balance actual
  - Risk score (con color)
- [ ] Risk score colores:
  - 🟢 Verde: < 50 (bajo riesgo)
  - 🟡 Amarillo: 50-70 (medio)
  - 🔴 Rojo: > 70 (alto riesgo)

**Si no hay clientes:**
- Esto es normal sin seed data
- Continuar con siguiente flujo

---

### 2.3 Crear Nuevo Cliente

**Pasos:**
1. Click "+ Nuevo Cliente"
2. Modal abre con 2 inputs:
   - "Nombre del cliente"
   - "RFC"
3. Llenar:
   - Nombre: `Test Cliente XYZ`
   - RFC: `TEST123456789`
4. Click "Agregar"

**Validar:**
- [ ] Modal abre sin errores
- [ ] Inputs son focusables
- [ ] Validación RFC (min 12 caracteres):
   - Si escribes < 12: button "Agregar" disabled o error
   - Si escribes >= 12: button activo
- [ ] Click "Agregar":
  - Modal cierra
  - Cliente aparece en lista
  - Sin errores en console

**Si falla:**
- Ver TROUBLESHOOTING.md → "CobraCheck Form"

---

### 2.4 Ver Facturas Vencidas (Tab 2)

**Pasos:**
1. Click tab "Facturas vencidas"
2. Ver lista de facturas

**Validar:**
- [ ] Si hay datos: muestra facturas con:
  - Folio (ej: FAC-001)
  - Monto (ej: $50,000)
  - Días vencido
- [ ] Colores para urgencia:
  - Rojo si > 60 días vencido
  - Naranja si 30-60 días
  - Amarillo si < 30 días
- [ ] Sorting por fecha de vencimiento

---

## FLUJO 3: ADVISOR IA

### 3.1 Acceder a Advisor

**Pasos:**
1. Ir a `/advisor`
2. Ver interfaz:
   - Input text para pregunta
   - Button "Preguntar"
   - Área de respuesta (vacía al inicio)

**Validar:**
- [ ] Página carga
- [ ] Inputs visible

---

### 3.2 Hacer Pregunta

**Pasos:**
1. Input: `¿Me alcanza dinero para pagar proveedores?`
2. Click "Preguntar"
3. Esperar 2-3 segundos

**Validar:**
- [ ] Respuesta aparece en < 3 segundos
- [ ] Respuesta es en español
- [ ] Respuesta menciona:
  - Saldo bancario
  - Cartera por cobrar
  - Recomendación (sí/no/depende)
- [ ] Sin errores en console

**Si no responde:**
- [ ] Verificar ANTHROPIC_API_KEY en `.env.local`
- [ ] Verificar `npm run dev` reiniciado
- [ ] Ver TROUBLESHOOTING.md → "Advisor IA no responde"

**Si responde con error:**
- [ ] "API key not found" → `.env.local` no tiene key
- [ ] "401 Unauthorized" → Key inválida/expirada
- [ ] Ver TROUBLESHOOTING.md → "API key not found"

---

## FLUJO 4: BANCOCHECK

### 4.1 Ver Dashboard

**Pasos:**
1. Ir a `/bancocheck`
2. Ver KPIs de transacciones

**Validar:**
- [ ] KPIs visibles (Total ingreso, Total egreso, Balance)
- [ ] Tabs: Sin clasificar, Clasificadas, Pendientes
- [ ] Button "Importar CSV"

---

### 4.2 Importar CSV Test

**Pasos:**
1. Click "Importar CSV"
2. Ir a `/bancocheck/importar`
3. Crear un archivo CSV simple:
   ```csv
   transaction_date,description,amount
   2026-06-15,Venta cliente,50000
   2026-06-14,Pago proveedores,-30000
   2026-06-13,Transferencia,-10000
   ```
4. Drag & drop o click para seleccionar archivo
5. Click "Importar"

**Validar:**
- [ ] File upload funciona
- [ ] Preview muestra transacciones
- [ ] Click "Importar" sin errores
- [ ] Transacciones aparecen en lista

---

### 4.3 Clasificar Transacción

**Pasos:**
1. Tab "Sin clasificar"
2. Click en 1 transacción
3. Seleccionar categoría (si hay dropdown)
4. Guardar

**Validar:**
- [ ] Transacción mueve a "Clasificadas"
- [ ] Categoría se guarda

---

## FLUJO 5: FLUJOCHECK

### 5.1 Ver Proyección

**Pasos:**
1. Ir a `/flujocheck`
2. Ver:
   - Saldo actual (HOY)
   - Proyección 7 días
   - Proyección 30 días
   - Risk badge

**Validar:**
- [ ] Números visibles
- [ ] Risk badge color (verde/amarillo/rojo)
- [ ] Gráfico (si implementado) muestra tendencia

---

## FLUJO 6: GASTOCHECK (Legacy)

### 6.1 Ver Comprobantes

**Pasos:**
1. Ir a `/gastocheck`
2. Ver lista de comprobantes capturados

**Validar:**
- [ ] Si hay datos: muestra comprobantes
- [ ] Filtros funcionan (si implementados)
- [ ] Búsqueda funciona

---

## PARTE 2: TESTING EN MÓVIL (1.5 horas)

### PRE-TESTING MÓVIL

Antes de empezar:

- [ ] APK descargado (ver GUIA_EAS_MOBILE_DEPLOYMENT.md)
- [ ] APK instalado en teléfono Android
- [ ] Teléfono conectado a internet (WiFi o datos)
- [ ] App puede abrirse sin crashes

---

## FLUJO 1: LOGIN MÓVIL

**Pasos:**
1. Abrir app GastoCheck
2. Ver login screen
3. Email: `testadmin@gastocheck.com`
4. Password: `TestPass123!`
5. Tap "Iniciar sesión"

**Validar:**
- [ ] App abre en < 2 segundos
- [ ] Login screen es legible
- [ ] Keyboard abre en inputs
- [ ] Redirect a dashboard
- [ ] KPIs visibles

**Performance:**
- [ ] Load time < 2 segundos
- [ ] No crashes
- [ ] No warnings en logs

---

## FLUJO 2: CAPTURAR COMPROBANTE (MOBILE)

**Pasos:**
1. Tab "Capturar"
2. Ver camera preview
3. Apuntar a un papel/receipt
4. Tap botón captura (📷)
5. Confirmar foto
6. Esperar OCR (2-3 seg)

**Validar:**
- [ ] Cámara funciona
- [ ] Foto se captura
- [ ] OCR procesa
- [ ] Datos extraídos aparecen (si implementado)
- [ ] Comprobante se guarda
- [ ] Aparece en "Mis comprobantes"

**Si cámara no funciona:**
- [ ] Settings → Apps → GastoCheck → Permissions → Camera
- [ ] Dar permiso
- [ ] Retry

---

## FLUJO 3: VER COMPROBANTES (MOBILE)

**Pasos:**
1. Tab "Mis comprobantes"
2. Ver lista de comprobantes capturados

**Validar:**
- [ ] Lista muestra comprobantes
- [ ] Scroll sin lag
- [ ] Puedes clickear cada uno para ver detalles

---

## FLUJO 4: COBRACHECK MÓVIL

**Pasos:**
1. Tab "CobraCheck"
2. Ver clientes
3. Tap en 1 cliente para detalles

**Validar:**
- [ ] Lista carga rápido
- [ ] Risk scoring visible
- [ ] Detalles cliente opens en < 1 segundo

---

## FLUJO 5: OFFLINE TESTING

**Pasos:**
1. Airplane mode ON
2. Intentar navegar en app
3. Airplane mode OFF
4. Esperar 3 segundos

**Validar:**
- [ ] En offline: datos anteriores visibles
- [ ] Sin crash
- [ ] Sin modo error
- [ ] Después de online: sync automático
- [ ] Datos se actualizan sin manual refresh

---

## PARTE 3: END-TO-END (30 minutos)

### E2E 1: CAPTURAR → EXPORTAR

**Pasos:**
1. En mobile: Capturar receipt
2. En web: Ir a `/gastocheck`
3. Ver comprobante aparezca
4. Exportar a Excel
5. Descargar
6. Abrir archivo

**Validar:**
- [ ] Comprobante sincroniza entre mobile y web
- [ ] Excel tiene datos correctos
- [ ] Formato es legible

---

### E2E 2: CLIENTE → FACTURA → PAGO

**Pasos:**
1. CobraCheck: Crear cliente
2. Crear factura $50,000
3. Registrar pago $50,000
4. Ver balance = $0
5. Ver risk score baja

**Validar:**
- [ ] Balance actualiza correctamente
- [ ] Risk score baja
- [ ] Factura movida a "pagada"

---

### E2E 3: ANÁLISIS FINANCIERO COMPLETO

**Pasos:**
1. BancoCheck: Importar CSV (5 transacciones)
2. Clasificar 3 transacciones
3. FlujoCheck: Ver proyección
4. Advisor: Preguntar "¿Cómo está mi flujo?"

**Validar:**
- [ ] FlujoCheck muestra proyección correcta
- [ ] Advisor responde con análisis
- [ ] Todo integrado sin errores

---

## 📊 RESUMEN: MARCAR COMPLETADO

Usa TESTING_CHECKLIST.csv para marcar cada flujo:

```csv
Flujo,Status,Notas
Login,✅,Sin problemas
CobraCheck Dashboard,✅,KPIs correctos
CobraCheck Nuevo Cliente,✅,Validación funciona
CobraCheck Ver Facturas,✅,Sorting correcto
Advisor IA,✅,Responde en 2.5s
BancoCheck Importar,✅,5 transacciones
BancoCheck Clasificar,✅,Movidas correctamente
FlujoCheck,✅,Proyección correcta
GastoCheck,✅,Comprobantes visibles
Mobile Login,✅,< 2 seg
Mobile Capturar,✅,OCR funciona
Mobile Offline,✅,Sync automático
E2E Capturar→Exportar,✅,Excel correcto
E2E Cliente→Pago,✅,Balance = 0
E2E Análisis,✅,Todo integrado
```

---

## ✅ TESTING COMPLETO CUANDO:

- [ ] Todos los 15+ flujos validados
- [ ] No hay crashes
- [ ] Performance OK (< 2 seg)
- [ ] Datos sincronizados (mobile ↔ web)
- [ ] Offline → Online funciona
- [ ] Errores NO críticos (warnings OK)

**ENTONCES:** ✅ READY PARA DEPLOYMENT

---

## 🆘 SI ALGO FALLA

1. **Nota el flujo exacto**
2. **Copia el error completo (console)**
3. **Ver TROUBLESHOOTING.md**
4. **Si sigue fallando:**
   - Reiniciar dev server
   - Limpiar cache: F12 → Application → Clear Storage
   - Hard refresh: Ctrl+Shift+R
   - Restart dev: Ctrl+C + npm run dev

---

**Testing completado:** ✅  
**Pronto:** Deployment a Vercel + EAS 🚀
