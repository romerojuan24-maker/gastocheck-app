# ✅ CHECKLIST DANIEL - CHECK SUITE TESTING & FIXES

**Fecha:** 2026-06-22  
**Status:** 5 módulos listos, 90 issues encontrados (audit completo)  
**Tu rol:** Arreglar CRÍTICOS → Testear → Deploy

---

## 🚨 FASE 1: ARREGLAR CRÍTICOS PRIMERO (2-3 horas)

**DEBE ESTAR HECHO antes de cualquier testing.**

### 1️⃣ GastoCheck - CRÍTICOS (2 issues)

```
❌ CRÍTICO: apps/web/app/cobracheck/page.tsx:111
   Problema: Falta import de ErrorBoundary
   Fix: Agregar en imports: import { ErrorBoundary } from '@/components/ErrorBoundary'
   Tiempo: 2 min

❌ CRÍTICO: apps/web/app/cobracheck/page.tsx:120
   Problema: Falta import de Modal
   Fix: Agregar en imports: import { Modal } from '@/components/Modal'
   Tiempo: 2 min

❌ CRÍTICO: apps/web/app/cobracheck/page.tsx:188
   Problema: Variable 'invoices' undefined (debe ser 'facturas')
   Archivo: Line 188
   Fix: Cambiar invoices.map(inv => ...) por facturas.map(inv => ...)
   Tiempo: 5 min
```

**✅ Checklist:**
- [ ] Arreglados 3 imports en GastoCheck
- [ ] Código compila sin errors
- [ ] Commit: "fix(gasto): arreglar imports críticos y variable undefined"

---

### 2️⃣ CobraCheck - CRÍTICO (1 issue)

```
❌ CRÍTICO: apps/cobra-web/app/reportes/page.tsx:77
   Problema: Schema mismatch - código usa 'inv.total' y 'inv.paid' pero DB tiene 'amount'
   Archivo: apps/cobra-web/app/reportes/page.tsx
   
   Código actual (WRONG):
   invoices.map(inv => ({
     total: inv.total,    // ❌ No existe
     paid: inv.paid       // ❌ No existe
   }))
   
   Código correcto:
   invoices.map(inv => ({
     total: inv.amount,   // ✅ Nombre correcto
     paid: inv.amount - (inv.pending || 0)  // ✅ Calcular de disponible
   }))
   
   Time: 10 min
```

**✅ Checklist:**
- [ ] Schema verificado con migrations/cobra*
- [ ] Código actualizado a campos correctos
- [ ] Tipos TypeScript coinciden con schema
- [ ] Commit: "fix(cobra): corregir schema mismatch en reportes"

---

### 3️⃣ BancoCheck - CRÍTICOS (2 issues)

```
❌ CRÍTICO: apps/web/app/bancocheck/page.tsx - PÁGINA OBSOLETA
   Problema: Referencia tablas que no existen (empresa_usuarios, banco_cuentas)
   Fix: Esta página está duplicada. Debería redirigir a:
        apps/web/app/(dashboard)/bancocheck/page.tsx
   
   Solución:
   1. Eliminar: apps/web/app/bancocheck/page.tsx
   2. Crear redirect en app/bancocheck/route.ts:
   
   export async function GET(request: Request) {
     return new Response(null, {
       status: 307,
       headers: { Location: '/bancocheck' }
     })
   }
   
   Time: 5 min
```

**✅ Checklist:**
- [ ] Página obsoleta eliminada
- [ ] Redirect creado
- [ ] Verificado no hay otras referencias a apps/web/app/bancocheck

---

### 4️⃣ FlujoCheck - CRÍTICOS (2 issues)

```
❌ CRÍTICO #1: supabase/functions/proyectar-flujo-efectivo/index.ts:47
   Problema: Campo 'estado_pago' no existe en schema
   Schema actual: status (no estado_pago)
   Fix: Cambiar línea 47 de:
        query = query.filter('estado_pago', 'eq', 'PENDIENTE')
        A:
        query = query.filter('status', 'eq', 'PENDIENTE')
   
   Time: 5 min

❌ CRÍTICO #2: apps/web/app/flujocheck/page.tsx:5
   Problema: Usando anon key en server component (debe ser service role)
   Fix: Cambiar:
        const supabase = createClient(url, anonKey)  // ❌ WRONG
        A:
        import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
        const supabase = createServerComponentClient()  // ✅ CORRECT
   
   Time: 10 min
```

**✅ Checklist:**
- [ ] Schema field corregido (estado_pago → status)
- [ ] Supabase client actualizado a server component
- [ ] Verificado no hay otros uses de anon key en server
- [ ] Commit: "fix(flujo): arreglar schema y auth en FlujoCheck"

---

### 5️⃣ CheckIA - CRÍTICOS (2 issues - ⚠️ SEGURIDAD)

```
❌ CRÍTICO #1 (SECURITY): apps/web/app/api/checkia/detectar.ts:17
   Problema: SERVICE_ROLE_KEY EXPUESTA AL CLIENTE
   ¡¡¡ ESTO ES UN SECURITY BREACH !!!
   
   Código actual (WRONG):
   const supabase = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
   
   NUNCA exposer SERVICE_ROLE_KEY en API routes públicas.
   
   Solución:
   - Service role key SOLO en Edge Functions (backend)
   - API routes usan anon key + RLS policies
   
   Fix:
   const supabase = createClient(
     Deno.env.get('SUPABASE_URL'),
     Deno.env.get('SUPABASE_ANON_KEY')  // ✅ Público OK
   )
   // Validar user via RLS, no en código
   
   Time: 15 min

❌ CRÍTICO #2: apps/web/app/checkia/page.tsx:5
   Problema: getUser() fuera de auth context
   Fix: Cambiar a server action o usar getUser from request
        import { auth } from '@clerk/nextjs'  // Si usan Clerk
        O:
        import { getCurrentUser } from '@/lib/auth'
   
   Time: 10 min
```

**✅ Checklist:**
- [ ] SERVICE_ROLE_KEY removida de API routes
- [ ] RLS policies configuradas correctamente
- [ ] getUser() en contexto auth válido
- [ ] ⚠️ SECURITY COMMIT: "fix(security): remover SERVICE_ROLE_KEY de cliente"

---

## 🎯 DESPUÉS DE ARREGLAR CRÍTICOS

Cuando termines los 5 módulos:

```bash
# Commit todos los fixes críticos
git add -A
git commit -m "🚨 fix(critical): arreglar 9 issues críticos de seguridad y compilación

- GastoCheck: imports faltantes
- CobraCheck: schema mismatch
- BancoCheck: página obsoleta
- FlujoCheck: schema field + auth
- CheckIA: security breach + auth context"

# Verificar compilación
npm run typecheck
npm run build

# Si hay errores, arreglados antes de continuar
```

---

## ✅ FASE 2: SETUP & VERIFICACIONES (30 min)

Cuando los CRÍTICOS estén arreglados:

### 2.1 Verificar Environment

```bash
# 1. Supabase variables
echo $NEXT_PUBLIC_SUPABASE_URL
echo $NEXT_PUBLIC_SUPABASE_ANON_KEY

# 2. Si están vacías, crear .env.local
cat > .env.local << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://[tu-proyecto].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[tu-anon-key]
SUPABASE_SERVICE_ROLE_KEY=[tu-service-role-key]  # ⚠️ SOLO EN .env.local
EOF

# 3. Verificar Node version
node --version  # Debe ser 18+

# 4. Instalar dependencias
npm install

# 5. Typecheck
npm run typecheck
```

**✅ Checklist:**
- [ ] .env.local existe con credenciales
- [ ] npm install completó sin errors
- [ ] npm run typecheck pasó

### 2.2 SQL & Edge Functions

```bash
# 1. Deploy SQL (si aún no está hecho)
# Copiar sql/20260621_opcion_b_tablas_completas.sql
# Ir a: https://app.supabase.com → SQL Editor → New Query
# Pegar TODO el SQL
# Click "Run"

# Verificar:
SELECT COUNT(*) FROM plan_pagos_semanal;  -- Debe dar 0 (empty)
SELECT COUNT(*) FROM pago_semanal;  -- Debe dar 0 (empty)

# 2. Deploy Edge Functions
supabase login
supabase functions deploy

# 3. Verificar
supabase functions list
# Debe listar 6 funciones:
#  - actualizar-flujo-semanal
#  - crear-plan-semanal
#  - arrastrar-pago
#  - calcular-escenarios-what-if
#  - generar-alertas-inteligentes
#  - calcular-scoring-cobranza
```

**✅ Checklist:**
- [ ] SQL ejecutado en Supabase
- [ ] Edge Functions deployed
- [ ] Tablas existen (conteo = 0)
- [ ] Funciones listadas sin errores

---

## 🧪 FASE 3: TESTING CADA MÓDULO (2-3 horas)

Inicia dev server:

```bash
npm run dev
# http://localhost:3000
```

### TEST 1: GastoCheck (10 min)

```
URL: http://localhost:3000/gastocheck

✅ Test 1.1: Página carga sin errores
   - Abre DevTools (F12)
   - Console debe estar limpia (sin red errors)
   - Página debe renderizar sin frozen

✅ Test 1.2: Importar Gasto
   - Click "Importar Gasto"
   - Selecciona CSV o XML
   - Debe parsearse sin errores
   - Verifica data en consola

✅ Test 1.3: Crear Póliza
   - Click en gasto
   - Click "Crear Póliza"
   - Debe generar PDF descargable
   - PDF debe tener estructura correcta

✅ Test 1.4: Auditoría
   - Verifica que cada movimiento tenga timestamp
   - Logs deben ser legibles
   - Timestamps deben ser recientes (no año 2000)
```

**Issues encontrados durante test 1.1-1.4:**
- Si ves error de variable, es fix que olvidamos
- Si PDF está vacío, check fn_generar_póliza en SQL
- Si no carga datos, check RLS policies

---

### TEST 2: CobraCheck (10 min)

```
URL: http://localhost:3000/cobracheck

✅ Test 2.1: Cargar Clientes
   - Página debe listar clientes
   - Cada cliente tiene RFC, nombre, estado
   - No debe haber "undefined" en campos

✅ Test 2.2: Visibilidad 360
   - Selecciona cliente
   - Debe ver: Facturas | Pagos | Banco
   - Datos deben coincidir (no contradicciones)

✅ Test 2.3: Scoring Cobranza
   - Columna "Riesgo" muestra 0-100
   - Riesgo alto = color rojo
   - Scoring se calcula automáticamente

✅ Test 2.4: Reconciliación
   - Marca factura como "pagada"
   - Sistema debe detectar que coincide con banco
   - No crear duplicados
```

**Checklist T2:**
- [ ] Clientes cargan correctamente
- [ ] No hay undefined en campos
- [ ] 360° muestra todas las vistas
- [ ] Scoring calcula automáticamente

---

### TEST 3: BancoCheck (10 min)

```
URL: http://localhost:3000/bancocheck

✅ Test 3.1: Importar Extracto
   - Upload CSV/OFX
   - Debe parsear movimientos
   - Cada movimiento tiene: fecha, monto, concepto

✅ Test 3.2: Auto-Match
   - Sistema debe matchear:
     Movimiento Banco ↔ Factura GastoCheck
     Movimiento Banco ↔ Cobro CobraCheck
   - Match score debe ser visible

✅ Test 3.3: Huérfanos
   - Movimientos sin match = "huérfanos"
   - Debe haber forma de manualamente asignarlos
   - No debe permitir dejar huérfanos sin resolver

✅ Test 3.4: Balance
   - Balance inicial = correcta
   - Balance final = inicial + ingresos - egresos
   - Error de cálculo indica bug
```

**Checklist T3:**
- [ ] Extracto importa correctamente
- [ ] Auto-match funciona
- [ ] Huérfanos pueden asignarse
- [ ] Balance cuadra matemáticamente

---

### TEST 4: FlujoCheck (15 min) - CRITICÓ HOY

```
URL: http://localhost:3000/flujo-efectivo

✅ Test 4.1: Crear Plan Semanal
   - Click "Crear Plan"
   - Input: empresa_id, caja_inicial
   - Plan debe crearse para semana siguiente
   - Mostrar MAR-SÁB (5 días)

✅ Test 4.2: Agregar Pagos
   - Click "Agregar Pago"
   - Input: descripción, monto, tipo, vencimiento
   - Pago aparece en columna correcta
   - Color indica urgencia (ROJO=nómina)

✅ Test 4.3: Drag & Drop
   - Arrastra pago de JUE a VIE
   - Toast debe decir "Pago movido"
   - BD debe actualizar
   - Si flujo no permite, debe rechazar + alerta

✅ Test 4.4: Alertas Automáticas
   - Sin flujo para un pago = CRÍTICA (roja)
   - Nómina siempre INDISPENSABLE (roja)
   - Ingresos sin confirmar = MEDIA (amarilla)
   - Check push notifications funcionen

✅ Test 4.5: Tiempo Real
   - Open 2 browsers (A y B)
   - En A, arrastra pago
   - En B, debe actualizar sin refrescar
   - WebSocket debe estar conectado

✅ Test 4.6: Escenarios What-If
   - Input: "¿si pierdo cliente X?"
   - Sistema calcula: caja_final sería X
   - Si es negativa = "NO ES VIABLE"
   - Debe guardarse para histórico
```

**Checklist T4:**
- [ ] Plan semanal crea correctamente
- [ ] Pagos pueden agregarse
- [ ] Drag & drop funciona con validación
- [ ] Alertas se generan automáticamente
- [ ] Tiempo real sincroniza entre browsers
- [ ] Escenarios calculan correctamente

---

### TEST 5: CheckIA (15 min)

```
URL: http://localhost:3000/checkia

✅ Test 5.1: Detectar Anomalías
   - Click "Analizar"
   - Busca: gastos 3σ arriba/abajo del promedio
   - Debe listar anomalías con:
     * Descripción
     * Monto
     * % desviación
     * Recomendación

✅ Test 5.2: Tendencias
   - Gráfico de gastos últimos 30 días
   - Debe mostrar línea de promedio
   - Puntos rojos = anomalías detectadas

✅ Test 5.3: Advisor IA
   - Input: pregunta sobre negocio
   - IA debe responder con insights
   - Recomendaciones deben ser accionables
   - No hará alucinaciones (verificar con datos reales)

✅ Test 5.4: Clustering
   - Sistema agrupa gastos automáticamente:
     * Gastos por categoría
     * Gastos por proveedor
     * Gastos por mes
   - Gráficos deben ser claros

✅ Test 5.5: Comparativa
   - Mes A vs Mes B
   - Variación en % debe ser correcta
   - Gráfico comparativo claro
```

**Checklist T5:**
- [ ] Anomalías detecta correctamente
- [ ] IA advisor responde sensatamente
- [ ] Gráficos renderizan sin errores
- [ ] Clustering agrupa correctamente
- [ ] No hay "undefined" en campos

---

## 🔗 FASE 4: TESTING INTEGRACIÓN (45 min)

**Verifica que los 5 módulos funcionen JUNTOS:**

### 4.1 Flujo Completo: GASTO → COBRA → BANCO → FLUJO

```
1. Crear GASTO en GastoCheck
   ✓ Importar XML de SAT
   ✓ Validar RFC, montos
   ✓ Crear póliza

2. Verificar en CobraCheck
   ✓ Si es compra a cliente, aparece como factura
   ✓ Scoring recalcula (si es de proveedor de riesgo)

3. Verificar en BancoCheck
   ✓ Si fue pagado, aparece movimiento
   ✓ Auto-match debe conectar gasto con movimiento

4. Verificar en FlujoCheck
   ✓ Pago aparece en plan semanal
   ✓ Caja se ajusta automáticamente
   ✓ Alertas recalculan

5. Verificar en CheckIA
   ✓ Anomalía detectada si gasto es muy grande
   ✓ IA advisor menciona este gasto en análisis
```

**✅ Checklist integración:**
- [ ] Gasto crea en GastoCheck
- [ ] Aparece en CobraCheck (si aplica)
- [ ] Se matchea en BancoCheck
- [ ] Actualiza FlujoCheck automáticamente
- [ ] CheckIA lo detecta en análisis

### 4.2 Data Consistency Check

```bash
# En Supabase SQL:

-- 1. Total de gastos
SELECT SUM(monto) FROM gastos;  -- X

-- 2. Total de egresos en FlujoCheck
SELECT SUM(monto) FROM pago_semanal WHERE tipo='GASTO';  -- Debe ser X

-- 3. Total de ingresos
SELECT SUM(monto) FROM cobros WHERE estado='PAGADO';  -- Y

-- 4. Total en banco
SELECT SUM(monto) FROM banco_movimientos WHERE tipo='INGRESO';  -- Debe ser Y

-- Si no coinciden: hay redundancia o datos perdidos
```

---

## 🔒 FASE 5: SECURITY SPOT CHECK (20 min)

```
✅ Test 5.1: RLS Policies
   Inicia 2 sesiones (Usuario A, Usuario B)
   - Usuario A ve solo su empresa
   - Usuario B NO ve datos de Usuario A
   - Si ves datos cruzados = SECURITY BREACH

   Test en SQL:
   SELECT COUNT(*) FROM plan_pagos_semanal;  -- Como Usuario A
   -- Debe ser 0 o N (su empresa)
   
   SELECT COUNT(*) FROM plan_pagos_semanal;  -- Como Usuario B
   -- Debe ser M (otro número, no N)
   -- Si es N, RLS está broken

✅ Test 5.2: API Keys Exposure
   DevTools → Network
   - Busca calls a API
   - Headers deben tener Authorization: Bearer [token]
   - NUNCA debe mostrar SERVICE_ROLE_KEY en requests

✅ Test 5.3: Input Validation
   Try XSS attack: entrada "<script>alert('xss')</script>"
   - Debe escaparse o sanitizarse
   - Nunca ejecutar scripts directamente

✅ Test 5.4: SQL Injection
   Nota: Supabase client previene esto automáticamente
   Pero verificar: todas las queries usan parámetros
   .filter('field', 'eq', userInput)  ✅
   NO: .where(`field = ${userInput}`)  ❌
```

**✅ Checklist seguridad:**
- [ ] RLS policies aislan datos correctamente
- [ ] API keys no exponibles en client
- [ ] Input sanitizado (no XSS)
- [ ] Queries parametrizadas (no SQL injection)

---

## 📋 RESUMEN CHECKLIST COMPLETO

```
CRÍTICOS (2-3 horas):
  [ ] GastoCheck: 3 fixes (imports + variable)
  [ ] CobraCheck: 1 fix (schema mismatch)
  [ ] BancoCheck: 1 fix (página obsoleta)
  [ ] FlujoCheck: 2 fixes (schema + auth)
  [ ] CheckIA: 2 fixes (security breach + auth)
  [ ] Commit críticos
  [ ] npm run typecheck pasado

SETUP (30 min):
  [ ] .env.local creado
  [ ] npm install completado
  [ ] SQL deployed
  [ ] Edge Functions deployed

TESTING MODULAR (2-3 horas):
  [ ] GastoCheck: 4 tests
  [ ] CobraCheck: 4 tests
  [ ] BancoCheck: 4 tests
  [ ] FlujoCheck: 6 tests
  [ ] CheckIA: 5 tests

INTEGRACIÓN (45 min):
  [ ] Flujo GASTO → COBRA → BANCO → FLUJO
  [ ] Data consistency verificada
  [ ] Validación cruzada de montos

SEGURIDAD (20 min):
  [ ] RLS policies OK
  [ ] API keys no expuestas
  [ ] Input sanitizado
  [ ] SQL parametrizado

FINAL:
  [ ] Todos los tests pasan
  [ ] Commit final: "test: verificación completa CHECK SUITE"
  [ ] Ready para deploy
```

---

## 🚀 DESPUÉS DE TESTING

Si TODO PASA:

```bash
# Final commit
git add -A
git commit -m "✅ test: CHECK SUITE testing completo - 5 módulos verificados

- GastoCheck: 4/4 tests
- CobraCheck: 4/4 tests
- BancoCheck: 4/4 tests
- FlujoCheck: 6/6 tests
- CheckIA: 5/5 tests

Integración: ✅
Seguridad: ✅
Ready para producción"

# Build final
npm run build

# Si build pasó:
echo "✅ CHECK SUITE LISTA PARA PRODUCCIÓN"
```

---

## 📞 SI ENCONTRÁS PROBLEMAS

1. **Error de compilación:** Revisa línea del error, compara con audit
2. **Test falla:** Chequea que los CRÍTICOS estén arreglados
3. **Data no sincroniza:** Verifica RLS policies
4. **Performance lento:** Check indexes en Supabase
5. **Security warning:** Revisa lista de CRÍTICOS (especialmente CheckIA)

---

**¡Adelante, Daniel! El sistema está listo. Cualquier duda, revisar AUDIT_REPORT.md cuando esté completo.**

