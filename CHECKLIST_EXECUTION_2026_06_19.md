# CHECK SUITE — CHECKLIST EJECUCIÓN PASO A PASO
**Fecha:** 2026-06-19  
**Objetivo:** Llevar a mercado en 1-2 días  
**Status:** 🟢 EN PROGRESO

---

## FASE 1: CONFIGURACIÓN DE APIs (CRÍTICO)
### ⏱️ Estimado: 1.5 horas

- [ ] **1.1 ANTHROPIC_API_KEY**
  - Crear en console.anthropic.com
  - Copiar a `.env.local`
  - Verificar en code: apps/web/lib/advisor.ts
  - **Status:** ❌ Pendiente
  - **Tiempo:** 5 min

- [ ] **1.2 WHATSAPP_TOKEN (Meta Business)**
  - Crear app en Meta Developers
  - Obtener: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID
  - Copiar a `.env.local`
  - Setup webhook en: supabase/functions/cobracheck-whatsapp-webhook
  - **Status:** ❌ Pendiente
  - **Tiempo:** 15 min

- [ ] **1.3 STRIPE_SECRET_KEY (Test Keys)**
  - Crear cuenta Stripe
  - Obtener: pk_test_*, sk_test_*
  - Copiar a `.env.local`
  - Crear 3 productos: Starter, Pro, Enterprise
  - **Status:** ❌ Pendiente
  - **Tiempo:** 20 min

- [ ] **1.4 SAT Certificates (Opcional para MVP)**
  - Solicitar e-firma SAT
  - ⚠️ BLOQUEA: esperar 2-5 días
  - **Status:** ⏳ Diferir
  - **Tiempo:** 0 min (para MVP)

---

## FASE 2: SETUP DE SUPABASE PRODUCCIÓN
### ⏱️ Estimado: 1 hora

- [ ] **2.1 Crear Base de Datos Producción**
  - Ir a Supabase Dashboard
  - Create new project (production)
  - Copiar URL + keys
  - **Status:** ❌ Pendiente
  - **Tiempo:** 5 min

- [ ] **2.2 Ejecutar Migraciones**
  ```bash
  supabase db push --db-url postgresql://[prod-connection]
  ```
  - **Status:** ❌ Pendiente
  - **Tiempo:** 10 min

- [ ] **2.3 Seed Test Data**
  - 1 admin user (testadmin@gastocheck.com)
  - 1 test company (TEST Inc.)
  - 3 test clients
  - 5 test invoices
  - **Status:** ❌ Pendiente
  - **Tiempo:** 10 min

- [ ] **2.4 RLS Policies Verification**
  - Validar no hay leaks cross-company
  - Probar acceso usuario A → empresa B → debe fallar
  - **Status:** ❌ Pendiente
  - **Tiempo:** 15 min

- [ ] **2.5 Backups Automáticos**
  - Configurar en Supabase dashboard
  - Frecuencia: diaria
  - **Status:** ❌ Pendiente
  - **Tiempo:** 5 min

---

## FASE 3: TESTING EN PC (NAVEGADOR)
### ⏱️ Estimado: 1 hora

- [ ] **3.1 Login**
  - Usuario: testadmin@gastocheck.com
  - Password: TestPass123!
  - ✅ Redirige a /hoy
  - ✅ Ver KPIs
  - **Status:** ❌ Pendiente
  - **Tiempo:** 5 min

- [ ] **3.2 CobraCheck**
  - ✅ Ver clientes en lista
  - ✅ Ver invoices vencidas
  - ✅ "+ Nuevo Cliente" funciona
  - ✅ Validación de RFC
  - **Status:** ❌ Pendiente
  - **Tiempo:** 10 min

- [ ] **3.3 Advisor IA**
  - ✅ Ir a /advisor
  - ✅ Preguntar: "¿Me alcanza para pagar?"
  - ✅ Ver respuesta en 2-3 seg
  - ✅ Respuesta menciona cartera + saldo
  - **Status:** ❌ Pendiente
  - **Tiempo:** 5 min

- [ ] **3.4 GastoCheck (Legacy)**
  - ✅ Ir a /gastocheck
  - ✅ Ver comprobantes capturados
  - ✅ Filtros funcionan
  - **Status:** ❌ Pendiente
  - **Tiempo:** 10 min

- [ ] **3.5 BancoCheck**
  - ✅ Ir a /bancocheck
  - ✅ Importar CSV test
  - ✅ Ver transacciones en lista
  - ✅ Clasificar transacciones
  - **Status:** ❌ Pendiente
  - **Tiempo:** 10 min

- [ ] **3.6 FlujoCheck**
  - ✅ Ir a /flujocheck
  - ✅ Ver saldo hoy
  - ✅ Ver proyección 7/30/60 días
  - ✅ Ver risk badge (verde/amarillo/rojo)
  - **Status:** ❌ Pendiente
  - **Tiempo:** 5 min

---

## FASE 4: TESTING EN MÓVIL (Teléfono)
### ⏱️ Estimado: 1.5 horas

- [ ] **4.1 Build APK/IPA**
  ```bash
  cd apps/mobile
  npx eas build --platform all --local
  ```
  - ✅ Android APK descargado
  - ✅ iOS IPA descargado (si Mac disponible)
  - **Status:** ❌ Pendiente
  - **Tiempo:** 30 min

- [ ] **4.2 Login Mobile**
  - ✅ Instalar APK en teléfono
  - ✅ Abrir app
  - ✅ Ver login screen
  - ✅ Ingresar credentials
  - ✅ Dashboard visible
  - **Status:** ❌ Pendiente
  - **Tiempo:** 10 min

- [ ] **4.3 GastoCheck (Capturar)**
  - ✅ Tab "Capturar"
  - ✅ Cámara abre
  - ✅ Capturar receipt
  - ✅ OCR procesa (2-3 seg)
  - ✅ Aparece en "Mis comprobantes"
  - **Status:** ❌ Pendiente
  - **Tiempo:** 10 min

- [ ] **4.4 CobraCheck Mobile**
  - ✅ Tab "CobraCheck"
  - ✅ Ver clientes + scoring
  - ✅ Ver invoices vencidas
  - **Status:** ❌ Pendiente
  - **Tiempo:** 10 min

- [ ] **4.5 BancoCheck Mobile**
  - ✅ Tab "BancoCheck"
  - ✅ Ver transacciones
  - ✅ Scroll performance OK
  - **Status:** ❌ Pendiente
  - **Tiempo:** 5 min

- [ ] **4.6 Offline Testing**
  - ✅ Airplane mode ON
  - ✅ Datos anteriores visible
  - ✅ Airplane mode OFF
  - ✅ Sync automático
  - **Status:** ❌ Pendiente
  - **Tiempo:** 10 min

---

## FASE 5: FLUJOS CRÍTICOS END-TO-END
### ⏱️ Estimado: 1 hora

- [ ] **5.1 Capturar → Exportar**
  - ✅ Capturar receipt en móvil
  - ✅ OCR procesa
  - ✅ Aparece en /gastocheck (web)
  - ✅ Exportar a Excel
  - ✅ Archivo descarga
  - **Status:** ❌ Pendiente
  - **Tiempo:** 20 min

- [ ] **5.2 Cliente → Factura → Pago**
  - ✅ Crear cliente en CobraCheck
  - ✅ Crear factura $50k
  - ✅ Registrar pago
  - ✅ Balance = $0
  - ✅ Risk score baja
  - **Status:** ❌ Pendiente
  - **Tiempo:** 15 min

- [ ] **5.3 BancoCheck → FlujoCheck → Advisor**
  - ✅ Importar CSV
  - ✅ Clasificar transacciones
  - ✅ /flujocheck muestra proyección
  - ✅ /advisor responde pregunta
  - **Status:** ❌ Pendiente
  - **Tiempo:** 15 min

- [ ] **5.4 Permisos (RBAC)**
  - ✅ Owner: acceso a todo
  - ✅ Supervisor: solo aprobaciones
  - ✅ Employee: solo tareas asignadas
  - ✅ No hay cross-company access
  - **Status:** ❌ Pendiente
  - **Tiempo:** 10 min

---

## FASE 6: FIXES MENORES EN CÓDIGO
### ⏱️ Estimado: 0.5 horas

- [ ] **6.1 CobraCheck Form Validation**
  - Arreglar: handleAddClient en page.tsx:78
  - Usar company_id correcto
  - **Status:** ❌ Pendiente
  - **Tiempo:** 10 min

- [ ] **6.2 Advisor Fallback si sin API Key**
  - Arreglar: apps/web/lib/advisor.ts
  - Mostrar mensaje claro
  - **Status:** ❌ Pendiente
  - **Tiempo:** 5 min

- [ ] **6.3 ErrorBoundary Logging**
  - Conectar a Sentry (cuando configurado)
  - **Status:** ⏳ Opcional
  - **Tiempo:** 0 min

---

## FASE 7: DEPLOYMENT
### ⏱️ Estimado: 1 hora

- [ ] **7.1 Deploy Web (Vercel)**
  ```bash
  vercel link
  vercel --prod
  ```
  - ✅ URL: https://tu-proyecto.vercel.app
  - ✅ Env vars configuradas
  - ✅ Build exitoso
  - **Status:** ❌ Pendiente
  - **Tiempo:** 15 min

- [ ] **7.2 Deploy Mobile (EAS)**
  ```bash
  eas build --platform all
  eas submit --platform all
  ```
  - ✅ APK en Google Play (internal testing)
  - ✅ IPA en TestFlight (si applicable)
  - **Status:** ❌ Pendiente
  - **Tiempo:** 30 min

- [ ] **7.3 Monitoring Setup**
  - Crear cuenta Sentry
  - Conectar web + mobile
  - Crear alertas
  - **Status:** ❌ Pendiente
  - **Tiempo:** 15 min

---

## FASE 8: PRE-MERCADO FINAL
### ⏱️ Estimado: 0.5 horas

- [ ] **8.1 Security Audit**
  - ✅ No hardcoded credentials en git
  - ✅ HTTPS enabled
  - ✅ RLS policies verified
  - **Status:** ❌ Pendiente
  - **Tiempo:** 10 min

- [ ] **8.2 Documentation**
  - ✅ Privacy Policy en /privacy
  - ✅ Terms of Service en /terms
  - ✅ Help Center básico
  - **Status:** ❌ Pendiente
  - **Tiempo:** 15 min

- [ ] **8.3 Performance Audit**
  - ✅ Lighthouse score > 80
  - ✅ Mobile load time < 2s
  - ✅ Database queries optimizadas
  - **Status:** ❌ Pendiente
  - **Tiempo:** 10 min

---

## RESUMEN TIEMPOS

| Fase | Tarea | Tiempo | Status |
|------|-------|--------|--------|
| 1 | APIs | 1.5h | ❌ |
| 2 | Supabase | 1h | ❌ |
| 3 | Testing PC | 1h | ❌ |
| 4 | Testing Mobile | 1.5h | ❌ |
| 5 | Flujos E2E | 1h | ❌ |
| 6 | Fixes | 0.5h | ❌ |
| 7 | Deployment | 1h | ❌ |
| 8 | Pre-Mercado | 0.5h | ❌ |
| **TOTAL** | | **8h** | 🟡 |

---

## PRÓXIMO PASO
**👉 Comenzar con FASE 1: Configuración de APIs**
- Obtener ANTHROPIC_API_KEY
- Obtener WHATSAPP_TOKEN
- Obtener STRIPE_SECRET_KEY
- Actualizar `.env.local`
