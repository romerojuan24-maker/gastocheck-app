# 📋 LUNES 24 DE JUNIO: RUNBOOK DEPLOYMENT OTA 1.1

**Responsable:** Daniel  
**Objetivo:** Desplegar OTA 1.1 (GastoCheck + CobraCheck)  
**Duración estimada:** 2.5 horas  
**Status:** Todo listo, solo falta ejecutar

---

## 🎯 QUÉ ES OTA 1.1

```
VERSIÓN: 1.1.0
CAMBIOS: Agregar CobraCheck (nuevo botón)
COMPATIBILIDAD: GastoCheck sin cambios
FEATURE FLAG: Cambiar COBRACHECK de false a true

RESULTADO:
- Usuarios verán botón CobraCheck nuevo
- Pólizas descargables (CSV + Excel)
- Risk scoring automático
- Gestión de clientes + facturas
```

---

## 📋 CHECKLIST PRE-DEPLOYMENT

### Verificar estado del código

```bash
# 1. Estar en rama main
git branch
# Debería mostrar: * main

# 2. Pull últimos cambios
git pull origin main

# 3. Ver los últimos commits
git log --oneline -10
# Deberías ver:
# ed95d9e - LAUNCH_SUMMARY (hoy viernes)
# c8dc69c - OTA deployment strategy (hoy viernes)
# a5a93cf - Pólizas descargables (hoy viernes)
# b68da1b - RFC validations (hoy viernes)
```

### Verificar feature flags

```bash
# 1. Leer config/features.ts
cat apps/web/config/features.ts

# 2. Verificar que esté FEATURES_OTA_1_0
# ❌ DEBE ESTAR: export const FEATURES: FeatureFlag = FEATURES_OTA_1_0
# ✅ CAMBIO NECESARIO: export const FEATURES: FeatureFlag = FEATURES_OTA_1_1
```

---

## 🔧 PASO 1: ACTUALIZAR FEATURE FLAG (5 minutos)

**Archivo:** `apps/web/config/features.ts`

**Cambio necesario (línea final):**

```typescript
// ANTES (OTA 1.0):
export const FEATURES: FeatureFlag = FEATURES_OTA_1_0

// DESPUÉS (OTA 1.1):
export const FEATURES: FeatureFlag = FEATURES_OTA_1_1
```

**Comando:**
```bash
# Navegar a la carpeta
cd C:\Users\admin\Documents\gastocheck-app

# Hacer el cambio (editar manualmente o):
# Usar un editor y cambiar la última línea de config/features.ts
```

**Verificar el cambio:**
```bash
grep "export const FEATURES" apps/web/config/features.ts
# Debería mostrar: export const FEATURES: FeatureFlag = FEATURES_OTA_1_1
```

---

## 📦 PASO 2: BUILD LOCAL (10 minutos)

**Propósito:** Verificar que el código compila sin errores

```bash
# 1. Instalar dependencias (si es primera vez)
npm install

# 2. Build
npm run build

# Esperado:
# ✅ "Build successful"
# ❌ Si hay errores, PARAR y reportar a Juan

# 3. Revisar que no hay type errors
# Si ves "TypeScript error" o "compilation failed", PARAR
```

---

## 🚀 PASO 3: DEPLOY VERCEL (30 minutos)

**Propósito:** Desplegar a producción en Vercel

### Opción A: Auto-deploy (RECOMENDADO)

```bash
# 1. Hacer commit
git add apps/web/config/features.ts
git commit -m "chore: activate CobraCheck for OTA 1.1"

# 2. Push a GitHub (Vercel auto-deploya)
git push origin main

# 3. Ir a https://vercel.com
# Vercel automáticamente inicia el deploy

# 4. Esperar a que termine (5-10 minutos)
# Ver status en: https://vercel.com/[proyecto]/deployments
```

### Opción B: Manual (si Vercel no auto-deploya)

```bash
# 1. Instalar Vercel CLI
npm install -g vercel

# 2. Deploy
vercel --prod

# 3. Responder preguntas (mantener defaults)
```

---

## 📱 PASO 4: DEPLOY MOBILE EAS (1 hora)

**Propósito:** Compilar y distribuir app para iOS + Android

### iOS (TestFlight)

```bash
# 1. Build para iOS
eas build --platform ios

# 2. Durante el build, se pedirá confirmación
# Responder "yes" a las preguntas

# 3. Esperar compilación (~20-30 minutos)

# 4. Una vez listo, Vercel envía a TestFlight
# Los testers pueden descargar desde TestFlight

# 5. Verificar en https://testflight.apple.com
```

### Android (Play Store)

```bash
# 1. Build para Android
eas build --platform android

# 2. Durante el build, se pedirá confirmación
# Responder "yes" a las preguntas

# 3. Esperar compilación (~20-30 minutos)

# 4. Una vez listo, APK está disponible
# Puede distribuirse a testers vía Play Console o link directo

# 5. Verificar en https://play.google.com/console
```

---

## ✅ PASO 5: VERIFICACIÓN (15 minutos)

### Verificar Vercel Deploy

```bash
# 1. Ir a https://tu-app.vercel.app

# 2. Login y verificar:
# ✅ Página carga sin errores
# ✅ Logo CHECK SUITE visible
# ✅ Botón 💰 GASTO visible
# ✅ Botón 📞 COBRANZA visible (NUEVO)

# 3. Probar flujo básico:
# ✅ Click en GASTO → debe abrir GastoCheck
# ✅ Click en COBRANZA → debe abrir CobraCheck
# ✅ CobraCheck dashboard carga
```

### Verificar Mobile Deploy

```bash
# 1. iOS: Abrir TestFlight
# ✅ Versión 1.1.0 disponible para descargar
# ✅ Instalar en iPhone/iPad
# ✅ Verificar que botón CobraCheck aparece

# 2. Android: Abrir Play Console
# ✅ Build completado
# ✅ APK disponible
# ✅ Verificar que botón CobraCheck aparece
```

---

## 📝 PASO 6: RELEASE NOTES (10 minutos)

**Archivo:** Crear release en GitHub

```bash
# 1. Ir a GitHub
# https://github.com/[tu-repo]/releases

# 2. Crear nuevo release
# Tag: v1.1.0
# Título: "OTA 1.1.0: CobraCheck Release"

# 3. Copiar release notes (ver abajo)

# 4. Publicar
```

**Release Notes template:**

```markdown
## OTA 1.1.0 - CobraCheck Release

### 🎉 Nuevas funcionalidades

✨ **CobraCheck**: Gestión completa de clientes y cobranzas
- Crear y editar clientes
- Registrar facturas
- Registrar pagos
- Tracking automático de riesgo

✨ **Pólizas contables**: Descargar en Excel o CSV
- Compatible con CONTPAQi
- Descarga automática al registrar pago
- Formato contable válido (debe = haber)

✨ **Risk scoring automático**: 0-100 según:
- Días vencido
- Saldo actual
- Historial de pagos

### 🐛 Correcciones

- RFC validación: exactamente 13 caracteres
- RFC duplicado: bloquea si ya existe en empresa
- Email field: nuevo y validado
- Validaciones mejoradas en general

### 📱 Clientes

- GastoCheck: Sin cambios (compatible 100%)
- CobraCheck: Nuevo, solo para usuarios autorizados

### 🔗 Links

- Web: https://tu-app.vercel.app
- TestFlight (iOS): [link]
- Play Store (Android): [link]
```

---

## ⚠️ TROUBLESHOOTING

### Error: "Feature flag not found"

```
Problema: FEATURES_OTA_1_1 no existe
Solución: Verificar que config/features.ts tiene la definición
Comando: grep "FEATURES_OTA_1_1" apps/web/config/features.ts
```

### Error: "Build failed"

```
Problema: npm run build falló
Solución: Verificar Node.js version
Comando: node --version (debería ser 18+)
         npm --version (debería ser 9+)
```

### Error: "EAS build failed"

```
Problema: eas build no compila
Solución: Verificar EAS credentials
Comando: eas whoami
         eas credentials
Si no está autorizado: eas login
```

### CobraCheck no aparece en app

```
Problema: Usuario ve solo GastoCheck
Solución: Feature flag no se actualizó o caché
Pasos:
1. Verificar FEATURES_OTA_1_1 está activo
2. Hard refresh en browser (Ctrl+Shift+R)
3. Desinstalar app mobile y reinstalar
4. Limpiar caché: rm -rf .next/
```

---

## 🎯 TIMELINE

```
09:00 - 09:30: Verificación inicial + Feature flag
09:30 - 09:45: Build local
09:45 - 10:15: Deploy Vercel
10:15 - 11:15: Deploy EAS (iOS + Android, paralelo)
11:15 - 11:30: Verificación final
11:30 - 11:45: Release notes + GitHub release
11:45 - 12:00: Buffer para issues
```

---

## ✅ FINAL CHECKLIST

- [ ] Feature flag cambiado a FEATURES_OTA_1_1
- [ ] Build local sin errores
- [ ] Commit hecho y pusheado
- [ ] Vercel deploy completado
- [ ] Web accessible y CobraCheck visible
- [ ] EAS iOS build completado
- [ ] EAS Android build completado
- [ ] Mobile apps instaladas y probadas
- [ ] Release notes publicadas en GitHub
- [ ] Usuarios notificados (opcional)

---

## 📞 CONTACTO SI HAY PROBLEMAS

Si algo falla y no sabes cómo arreglarlo:
1. Revisa TROUBLESHOOTING arriba
2. Verifica que el código no cambió desde ayer (git log)
3. Reporta el error exacto a Juan

**IMPORTANTE:** No hagas cambios al código. Solo actualiza el feature flag y deploya.

---

**Status:** 🟢 LISTO PARA DEPLOY
**Fecha:** Lunes 24 de junio, 2026
**Duración:** ~2.5 horas
**Riesgo:** BAJO (GastoCheck no cambia, solo se agrega CobraCheck)
