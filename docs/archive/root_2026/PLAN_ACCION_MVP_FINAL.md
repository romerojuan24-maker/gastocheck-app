# 🚀 PLAN DE ACCIÓN MVP FINAL

**Fecha inicio:** 2026-06-19 (hoy)  
**Fecha lanzamiento:** 2026-06-21 (viernes)  
**Tiempo total:** 48 horas

---

## 📊 DIVISIÓN DE TRABAJO

### YO (Claude) - Tareas de desarrollo/depuración
```
├─ Auditar CobraCheck (2 horas)
├─ Implementar pólizas descargables (3 horas)
├─ Fijar bugs encontrados (2 horas)
├─ Testear flujos críticos (2 horas)
└─ Documentar cambios (1 hora)
TOTAL: 10 horas de trabajo paralelo
```

### TÚ (Usuario) - Tareas de validación y deploy
```
├─ Obtener 3 APIs (40 minutos)
├─ Testing PC + Mobile (2.5 horas)
├─ Deploy Vercel (1 hora)
├─ Deploy EAS (30 minutos)
└─ Go-live y primeros usuarios (validación)
TOTAL: ~4.5 horas trabajo usuario
```

---

## ⏱️ CRONOGRAMA

### HOY (2026-06-19)

**Mi trabajo (mientras obtienes APIs):**
```
13:00-15:00  Auditoría CobraCheck
             ├─ Revisar código completo
             ├─ Identificar bugs
             └─ Hacer lista de fixes

15:00-18:00  Implementar pólizas
             ├─ Función generación
             ├─ Descarga CSV
             ├─ Descarga Excel
             └─ UI component

18:00-19:00  Fijar bugs encontrados
             ├─ Validaciones
             ├─ Error handling
             └─ Edge cases
```

**Tu trabajo (paralelo):**
```
13:00-13:40  Obtener APIs
             ├─ ANTHROPIC_API_KEY
             ├─ STRIPE_SECRET_KEY
             └─ WHATSAPP_TOKEN (si usas)

13:40-14:00  Actualizar .env.local
             └─ Guardar variables

Después: Testing exploratorio (opcional)
```

**Checkpoint (19:00):**
- ✅ APIs en lugar
- ✅ CobraCheck depurado
- ✅ Pólizas implementadas
- ✅ Bugs principales listos

---

### MAÑANA (2026-06-20)

**Mi trabajo:**
```
09:00-10:00  Testing exhaustivo
             ├─ Flujo 1: Cliente → Factura → Pago → Póliza
             ├─ Flujo 2: Pago parcial
             ├─ Flujo 3: Risk score
             └─ Performance & Mobile

10:00-11:00  Fixes finales
             ├─ Bugs encontrados en testing
             ├─ Edge cases
             └─ Performance tuning

11:00-12:00  Documentar cambios
             ├─ COBRACHECK_CHANGES.md
             ├─ Commit final
             └─ Status report
```

**Tu trabajo:**
```
09:00-11:30  Testing PC
             ├─ GastoCheck (captura + exportación)
             ├─ CobraCheck (cliente → pago → póliza)
             └─ Checklist: 20+ items

11:30-14:00  Testing Mobile
             ├─ iOS o Android (lo que tengas)
             ├─ Flujos principales
             └─ Responsiveness

14:00-15:00  Deploy Vercel
             ├─ Variables de entorno
             ├─ Build
             └─ Test en producción
```

**Checkpoint (15:00):**
- ✅ Testing verde 100%
- ✅ Deploy en staging (Vercel)
- ✅ Listo para producción

---

### PASADO MAÑANA (2026-06-21 - VIERNES)

**Mi trabajo:**
```
08:00-09:00  Verificación final
             ├─ Revisar código en producción
             ├─ Verificar pólizas
             └─ Estar disponible para soporte

(En standby para emergencias)
```

**Tu trabajo:**
```
09:00-09:30  Deploy Mobile (EAS)
             ├─ Compilación
             ├─ iOS TestFlight (si aplica)
             └─ Android Google Play (si aplica)

09:30-10:00  Final smoke test
             ├─ Login
             ├─ GastoCheck + captura
             ├─ CobraCheck + póliza
             └─ Todo funciona ✅

10:00+       🚀 LANZAMIENTO OFICIAL
             ├─ Anuncio a primeros usuarios
             ├─ Link a Vercel
             ├─ Invitación a TestFlight/Play Store
             └─ Soporte en vivo (yo disponible)
```

**Checkpoint (10:00):**
- 🚀 MVP EN MERCADO

---

## 🎯 TAREAS ESPECÍFICAS MÍO (HOY)

### 1. AUDITORÍA COBRACHECK (2h)

```bash
# Revisar cada archivo
├─ apps/web/app/cobracheck/page.tsx
│  ├─ Dashboard funciona
│  ├─ KPIs correctos
│  ├─ Filtros por tab
│  └─ Responsive
│
├─ apps/web/app/cobracheck/clientes/page.tsx
│  ├─ Listar clientes
│  ├─ Búsqueda/filtros
│  ├─ Click → detalle
│  └─ Sin n+1 queries
│
├─ apps/web/app/cobracheck/clientes/[id]/page.tsx
│  ├─ Mostrar datos
│  ├─ Editar funciona
│  ├─ Validaciones
│  └─ Guardar sin errores
│
├─ apps/web/app/cobracheck/facturas/page.tsx
│  ├─ Listar facturas
│  ├─ Filtro por status
│  ├─ Ordenar por días vencido
│  └─ Sin errores SQL
│
└─ apps/web/app/cobracheck/cobracheck/clientes/page.tsx (crear)
   ├─ Formulario cliente
   ├─ Validaciones RFC/email
   ├─ Crear exitoso
   └─ Aparece en lista inmediatamente
```

**Output:** Lista de bugs encontrados + severidad

### 2. IMPLEMENTAR PÓLIZAS (3h)

```typescript
Crear archivos:
├─ lib/poliza.ts
│  ├─ Interfaz Poliza
│  ├─ generatePolizaFromPayment()
│  └─ Validar debe = haber
│
├─ lib/export-csv.ts
│  ├─ generateCSV()
│  └─ downloadCSV()
│
├─ lib/export-excel.ts
│  ├─ generateExcel()
│  └─ downloadExcel()
│
└─ components/PolizaDownload.tsx
   ├─ Botón "Descargar CSV"
   ├─ Botón "Descargar Excel"
   └─ Preview de póliza

Integración:
├─ Registrar pago → crea póliza automáticamente
├─ Mostrar póliza en pantalla
└─ QUITAR: Envío por WhatsApp (antiguo)
```

**Output:** Pólizas descargables en CobraCheck

### 3. FIJAR BUGS (2h)

```
Basados en auditoría:
├─ [Bug lista]
├─ [Fix 1]
├─ [Fix 2]
└─ [Verify fixes]

Ejemplos comunes:
├─ RFC validation (exacto 13 caracteres)
├─ Email validation
├─ Decimal handling (2 decimales)
├─ Timezone (fechas correctas)
├─ Multi-empresa (datos aislados)
└─ Edge cases (pago > monto, etc)
```

**Output:** CobraCheck sin bugs conocidos

### 4. TESTING (2h)

```
Flujo 1: Cliente → Factura → Pago → Póliza
├─ Crear cliente (Juan)
├─ Crear factura a Juan ($1000, vence 30/06)
├─ Registrar pago ($500, 21/06)
├─ Verificar status = partial
├─ Descargar póliza CSV ✅
├─ Descargar póliza Excel ✅
└─ Importar en Excel manualmente ✅

Flujo 2: Pago completo
├─ Crear factura segunda (Juan)
├─ Pagar total ($1500)
├─ Status = paid ✅
└─ Póliza correcta ✅

Flujo 3: Risk scoring
├─ Nuevo cliente → score 0
├─ Crear factura vencida → score sube ✅
├─ Pagar a tiempo → score baja ✅
└─ Automático ✅

Performance:
├─ Dashboard < 2 seg ✅
├─ Crear cliente < 500ms ✅
├─ Registrar pago < 800ms ✅
└─ Sin lentitud observable ✅
```

**Output:** Testing report (todos los flujos green)

---

## 🎯 TAREAS ESPECÍFICAS TUYO (HOY + MAÑANA)

### HOY - 13:00 (40 minutos)

**OBTENER APIs:**

1. **ANTHROPIC_API_KEY**
   - Ir a https://console.anthropic.com
   - Login con romero.juan24@gmail.com
   - Crear API key
   - Copiar en .env.local

2. **STRIPE_SECRET_KEY**
   - Ya tiene (Stripe está setup)
   - Verificar en .env.local
   - Si falta, ir a https://dashboard.stripe.com

3. **WHATSAPP_TOKEN** (opcional, si integración futura)
   - Por ahora NO necesario
   - El MVP no usa WhatsApp

**Guardar en `.env.local`:**
```
NEXT_PUBLIC_ANTHROPIC_API_KEY=sk-ant-xxx
STRIPE_SECRET_KEY=sk_live_xxx
```

---

### MAÑANA - 09:00 (2.5 horas)

**TESTING PC (GastoCheck + CobraCheck):**

```
Checklist GastoCheck:
├─ Login funciona
├─ Capturar foto (OCR)
├─ Listado y búsqueda
├─ Exportación Excel
├─ Exportación CSV
└─ Exportación CONTPAQi ✅

Checklist CobraCheck:
├─ Dashboard KPIs
├─ Crear cliente
├─ Crear factura
├─ Registrar pago
├─ Póliza CSV
├─ Póliza Excel
└─ Risk score automático ✅

20+ items en lista (ver COBRACHECK_DEPURACION_CHECKLIST.md)
```

---

### MAÑANA - 14:00 (1 hora)

**DEPLOY VERCEL:**

```bash
# En terminal:
npm run build              # Compilar
npm run start              # Test local
git push origin master     # Push a GitHub

# En Vercel:
1. Conectar GitHub
2. Seleccionar rama main
3. Agregar env vars:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - NEXT_PUBLIC_ANTHROPIC_API_KEY
   - STRIPE_SECRET_KEY
4. Deploy
5. Test en https://tu-app.vercel.app
```

---

### VIERNES - 09:00 (30 min)

**DEPLOY MOBILE (EAS):**

```bash
# En terminal:
eas build --platform ios    # Para iOS
eas build --platform android # Para Android

# Esperar compilación (~10-15 min)

# Resultado:
├─ iOS: TestFlight link
└─ Android: Play Store

# Compartir con primeros usuarios
```

---

## ✅ CHECKLIST FINAL

### Antes de lanzar (Viernes 10:00)

- [ ] Obtener APIs (TÚ)
- [ ] CobraCheck auditado (YO)
- [ ] Pólizas implementadas (YO)
- [ ] Bugs fixes (YO)
- [ ] Testing PC (TÚ)
- [ ] Testing Mobile (TÚ)
- [ ] Deploy Vercel (TÚ)
- [ ] Deploy EAS (TÚ)
- [ ] Go-live readiness (AMBOS)

### Críticos

- ✅ GastoCheck funcional
- ✅ CobraCheck sin bugs
- ✅ Pólizas descargables
- ✅ UI responsiva
- ✅ Permisos funcionando
- ✅ DB clean

---

## 📞 COMUNICACIÓN DURANTE DESARROLLO

**Hoy (19:00):** Status call
- Yo: "CobraCheck depurado, pólizas listas"
- Tú: "APIs en lugar, testing exploratorio hecho"

**Mañana (15:00):** Status call
- Yo: "Testing green, listo para producción"
- Tú: "Deploy en Vercel, testing mobile completado"

**Viernes (09:00):** Final call
- Confirmación: Todo listo
- Lanzamiento en vivo

---

## 🚀 RESULTADO FINAL

```
Viernes 21 de junio, 10:00 AM:

MVP EN MERCADO
├─ GastoCheck 100% ✅
├─ CobraCheck 100% ✅
├─ Pólizas descargables ✅
├─ Permisos multi-rol ✅
├─ UI minimalista ✅
└─ CERO bugs conocidos ✅

Usuarios listos:
├─ Capturistas (GastoCheck)
├─ Jefes de cobranza (CobraCheck)
└─ Admins (todo)

Status: 🚀 LANZAMIENTO OFICIAL
```

---

**¿Listo? Comienzo auditoría de CobraCheck ahora mismo.**
