# 📋 ESTADO FINAL PARA DANIEL — LUNES 24 DE JUNIO

**Creado por:** Claude  
**Para:** Daniel (developer)  
**Fecha:** Viernes 19 de junio, 2026  
**Tarea:** Deploy OTA 1.1 (agregar CobraCheck)  

---

## ⚡ RESUMEN EJECUTIVO (2 minutos de lectura)

### Tu trabajo (Lunes)

```
DURACIÓN: 2.5 horas
DIFICULTAD: Muy simple (cambiar 1 línea, hacer deploy)
RIESGO: BAJO (GastoCheck no cambia, solo agrega CobraCheck)

PASOS:
1. Cambiar FEATURES_OTA_1_0 → FEATURES_OTA_1_1 (1 línea)
2. npm run build (10 min)
3. git commit + push (5 min)
4. Vercel deploya solo (10 min)
5. EAS build iOS + Android (1 hora)
6. Verificar + Release notes (15 min)
```

### Estado del código

```
✅ TODO LISTO
├─ GastoCheck: 100% funcional, sin cambios
├─ CobraCheck: Depurado, 0 bugs conocidos
├─ Pólizas: CSV + Excel descargables
├─ RFC: Validación 13 caracteres + duplicado
├─ Email: Campo agregado + validado
└─ Feature flags: Listos para activar
```

---

## 🎯 CAMBIO ÚNICO REQUERIDO

**Archivo:** `apps/web/config/features.ts`  
**Línea:** 64  

```typescript
// ANTES (OTA 1.0):
export const FEATURES: FeatureFlag = FEATURES_OTA_1_0

// DESPUÉS (OTA 1.1):
export const FEATURES: FeatureFlag = FEATURES_OTA_1_1
```

**Eso es TODO lo que cambias en el código.**

---

## 📅 INSTRUCCIONES PASO A PASO

### Paso 1: Preparación (5 minutos)

```bash
# 1. Navegar a la carpeta
cd C:\Users\admin\Documents\gastocheck-app

# 2. Estar en rama main
git branch
# Debería mostrar: * main

# 3. Pull últimos cambios
git pull origin main

# 4. Verificar estado
git status
# Debería mostrar: "On branch main, nothing to commit"
```

### Paso 2: Cambiar Feature Flag (2 minutos)

**Opción A: Editar el archivo manualmente**

1. Abre `apps/web/config/features.ts`
2. Busca línea 64: `export const FEATURES: FeatureFlag = FEATURES_OTA_1_0`
3. Cámbialo a: `export const FEATURES: FeatureFlag = FEATURES_OTA_1_1`
4. Guarda

**Opción B: Verificar que está correcto (si ya lo hizo Juan)**

```bash
grep "export const FEATURES" apps/web/config/features.ts
# Debería mostrar: export const FEATURES: FeatureFlag = FEATURES_OTA_1_1
```

### Paso 3: Build Local (15 minutos)

```bash
# 1. Build
npm run build

# Esperado:
# ✅ "Build successful"
# ✅ Sin errores TypeScript
# ✅ Sin errores compilación

# 2. Si hay errores: PARAR y reportar a Juan
```

### Paso 4: Commit (5 minutos)

```bash
# 1. Ver qué cambió
git status
# Debería mostrar: modified: apps/web/config/features.ts

# 2. Hacer commit
git add apps/web/config/features.ts
git commit -m "chore: activate CobraCheck for OTA 1.1"

# 3. Verificar
git log --oneline -1
# Debería mostrar tu commit
```

### Paso 5: Deploy Vercel (15-20 minutos)

```bash
# 1. Push a GitHub
git push origin main

# 2. Vercel automáticamente inicia el deploy
# (No necesitas hacer nada más, se hace automático)

# 3. Esperar a que termine (~10 minutos)
# Ir a: https://vercel.com/tu-proyecto/deployments

# 4. Verificar que está en "Ready"
```

### Paso 6: Deploy Mobile EAS (60 minutos - MIENTRAS ESPERAS VERCEL)

**iOS (30 minutos)**

```bash
# 1. Build
eas build --platform ios

# 2. Responder preguntas (mantener defaults)

# 3. Esperar compilación (~20-30 minutos)

# 4. Una vez listo, ver en https://testflight.apple.com
```

**Android (30 minutos - PARALELO)**

```bash
# 1. Build (en otra terminal)
eas build --platform android

# 2. Responder preguntas (mantener defaults)

# 3. Esperar compilación (~20-30 minutos)

# 4. Una vez listo, ver en https://play.google.com/console
```

### Paso 7: Verificación (15 minutos)

**Web**
```
1. Ir a https://tu-app.vercel.app
2. Login
3. Verificar:
   ✅ Botón GASTO aparece (igual que antes)
   ✅ Botón COBRANZA aparece (NUEVO)
   ✅ Ambos funcionan
   ✅ Dashboard carga sin errores
```

**Mobile**
```
1. iOS: Descargar desde TestFlight
2. Android: Descargar APK
3. Verificar:
   ✅ Botón GASTO visible
   ✅ Botón COBRANZA visible (NUEVO)
   ✅ Ambos funcionan
```

### Paso 8: Release Notes (10 minutos)

**En GitHub:**

1. Ir a: `https://github.com/tu-repo/releases`
2. Click "Create new release"
3. **Tag:** v1.1.0
4. **Title:** "OTA 1.1.0: CobraCheck Release"
5. **Description:** (copiar de abajo)

**Texto para Release Notes:**

```markdown
## OTA 1.1.0 - CobraCheck Release

### 🎉 Nuevas funcionalidades

✨ **CobraCheck**: Gestión completa de clientes y cobranzas
- Crear y editar clientes (con validación RFC)
- Registrar facturas
- Registrar pagos
- Tracking automático de riesgo (0-100)

✨ **Pólizas contables descargables**
- Descarga en Excel (.xlsx)
- Descarga en CSV (CONTPAQi compatible)
- Formato contable válido (debe = haber)

### 🐛 Correcciones

- RFC: Exactamente 13 caracteres (validado)
- RFC duplicado: No puede haber 2 con mismo RFC en empresa
- Email field: Agregado con validación
- Validaciones mejoradas en general

### 📱 Compatibilidad

- GastoCheck: Sin cambios (compatible con OTA 1.0)
- CobraCheck: Nuevo módulo
- Usuarios: Solo ven lo que están autorizados a ver

### 📊 Versión

```
v1.1.0 - 24 de junio, 2026
```

---

## ⚠️ SI ALGO FALLA

### Error: "Build failed"

```
Solución:
1. Verificar Node.js: node --version (debe ser 18+)
2. Verificar npm: npm --version (debe ser 9+)
3. Limpiar: rm -rf node_modules/.cache
4. Reintentar: npm run build
5. Si sigue fallando: Reportar a Juan con el error exacto
```

### Error: "Feature flag no aparece"

```
Solución:
1. Verificar que FEATURES_OTA_1_1 está en config/features.ts
2. Verificar que export const FEATURES = FEATURES_OTA_1_1
3. Hard refresh: Ctrl+Shift+R en el navegador
4. Limpiar caché: rm -rf .next/
5. Reintentar build
```

### Error: "EAS build failed"

```
Solución:
1. Verificar login: eas whoami
2. Si no estás logueado: eas login
3. Verificar credenciales: eas credentials
4. Reintentar: eas build --platform ios (o android)
5. Si sigue fallando: Reportar a Juan
```

### CobraCheck no aparece en app

```
Solución:
1. Hard refresh web: Ctrl+Shift+R
2. Desinstalar app mobile y reinstalar desde TestFlight
3. Verificar que FEATURES_OTA_1_1 está activo
4. Limpiar caché: rm -rf .next/
5. Limpiar build: npm run build de nuevo
```

---

## 📊 TIMELINE

```
09:00 - 09:05: Preparación + cambiar feature flag
09:05 - 09:20: Build local
09:20 - 09:25: Commit + push
09:25 - 09:35: Esperar deploy Vercel
09:35 - 10:35: EAS iOS + Android (PARALELO)
10:35 - 10:50: Verificación
10:50 - 11:00: Release notes
11:00+: LISTO - OTA 1.1 EN VIVO ✅
```

---

## ✅ CHECKLIST FINAL

Antes de dar por terminado:

- [ ] Cambié FEATURES a FEATURES_OTA_1_1
- [ ] npm run build sin errores
- [ ] Commit hecho: "chore: activate CobraCheck for OTA 1.1"
- [ ] Push a GitHub completado
- [ ] Vercel deploy en status "Ready"
- [ ] Web funciona: GASTO + COBRANZA visibles
- [ ] EAS iOS build completado
- [ ] EAS Android build completado
- [ ] Mobile apps instaladas y probadas
- [ ] Release notes publicadas en GitHub v1.1.0
- [ ] Todo funciona sin errores

---

## 🎯 QUÉ ESTÁ LISTO

```
CÓDIGO:
✅ GastoCheck: 100%, sin cambios, funcional
✅ CobraCheck: Depurado, 0 bugs, funcional
✅ Pólizas: CSV + Excel descargables
✅ Validaciones: RFC, email, límites
✅ Permisos: Multi-rol, multi-empresa

DOCUMENTACIÓN:
✅ 20+ documentos (setup, testing, troubleshooting, etc.)
✅ MONDAY_DEPLOYMENT_RUNBOOK.md (este documento extendido)
✅ Guías paso a paso para cada deploy

DATABASE:
✅ Tablas creadas
✅ RLS policies configuradas
✅ Migrations aplicadas

DEPLOY:
✅ Vercel configurado (auto-deploy)
✅ EAS configurado (ready para build)
✅ Feature flags listos
✅ Versiones listos (v1.1.0)
```

---

## 📞 SOPORTE

**Si algo no funciona:**

1. Leer TROUBLESHOOTING arriba
2. Revisar que el código no cambió (git log)
3. Reportar error exacto a Juan con:
   - Comando que ejecutaste
   - Error mensaje completo
   - Output de `git log --oneline -5`

**IMPORTANTE:** 
- No cambies nada de código fuera de features.ts
- No modifiques GastoCheck
- Solo activa CobraCheck con el feature flag

---

## 🎉 RESULTADO

Después de seguir estos pasos:

```
✅ OTA 1.1 EN VIVO
├─ Usuarios con iPhone: Descargan desde TestFlight
├─ Usuarios con Android: Descargan desde Play Store
├─ Usuarios en web: Actualizan en navegador
├─ Todos ven: GASTO + COBRANZA
└─ Todos pueden: Capturar gastos + Cobrar
```

---

**Status:** 🟢 LISTO PARA EJECUTAR  
**Dificultad:** ⭐ (Muy simple - solo cambiar 1 línea)  
**Riesgo:** 🟢 BAJO (GastoCheck sin cambios)  

¡Mucho éxito! 🚀
