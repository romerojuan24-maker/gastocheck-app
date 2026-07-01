# GUÍA: DEPLOYMENT MOBILE (EAS - Expo)

**Fecha:** 2026-06-19  
**Objetivo:** Build APK/IPA para testing + store submission  
**Tiempo estimado:** 30 minutos (+ download)  

---

## FASE 1: SETUP INICIAL (5 min)

### Pasos:

1. **Crear/Verify cuenta Expo:**
   ```
   https://expo.dev/
   ```
   - Login con Google (romero.juan24@gmail.com)
   - O sign up si no tienes

2. **Install EAS CLI:**
   ```bash
   npm install -g eas-cli
   ```

3. **Login en EAS:**
   ```bash
   eas login
   # Se abrirá navegador
   # Login con tu cuenta Expo
   # Copiar token (si pide)
   ```

4. **Verificar proyecto está configurado:**
   ```bash
   cd C:\Users\admin\Documents\gastocheck-app\apps\mobile
   cat app.json | grep -A 5 '"eas"'
   # Debería mostrar projectId
   ```

✅ **VERIFICAR:** EAS CLI funciona: `eas --version`

---

## FASE 2: BUILD PARA TESTING (Android APK) (10 min)

### Recomendación:
Para testing rápido, usar Android (no requiere Mac como iOS)

### Pasos:

1. **Build APK para testing local:**
   ```bash
   cd C:\Users\admin\Documents\gastocheck-app\apps\mobile
   eas build --platform android --profile preview
   ```

   **Opciones a seleccionar:**
   - Use building locally? → NO (usa Expo cloud)
   - Signing method? → Expo managed (default)

2. **Esperar a que termine (15-20 min)**
   - Verás progreso
   - URL de download aparecerá al final
   - Ejemplo: `https://exp-shell-app-assets.s3.us-west-1.amazonaws.com/...apk`

3. **Descargar APK:**
   - Click en la URL
   - Guardar archivo: `gastocheck-preview.apk`

4. **Instalar en teléfono Android:**
   - Conectar teléfono por USB
   - Copiar `gastocheck-preview.apk` a teléfono
   - O enviar por WhatsApp/email
   - Abrir con File Manager
   - Instalar
   - Aceptar permisos

✅ **VERIFICAR:** App abre en teléfono Android

---

## FASE 3: BUILD PARA TESTING (iOS TestFlight) - OPCIONAL

### Requiere:
- Mac (no tienes, puedes saltarte o usar Expo Go)
- Apple Developer account ($99/año)

### Si quieres hacer:
```bash
eas build --platform ios --profile preview
```

### Alternativa más rápida (Expo Go):
```bash
cd C:\Users\admin\Documents\gastocheck-app\apps\mobile
npx expo start --localhost
# Scan QR con Expo Go app en teléfono (gratis)
# No necesita build, es instant
```

---

## FASE 4: BUILD PARA PRODUCCIÓN (No ahora, para después)

Una vez testing sea exitoso:

### Android (Google Play):
```bash
eas build --platform android --profile production
eas submit --platform android
# Requiere Google Play Developer account ($25 one-time)
# Esperar 2-3 horas para review
```

### iOS (App Store):
```bash
eas build --platform ios --profile production
eas submit --platform ios
# Requiere Apple Developer account ($99/year)
# Esperar 24-48 horas para review
```

---

## FASE 5: TESTEAR APP EN TELÉFONO

Una vez instalado el APK:

### Flujos a validar:

1. **Login:**
   - [ ] Abrir app
   - [ ] Login con: testadmin@gastocheck.com / TestPass123!
   - [ ] ✅ Ver dashboard

2. **Comprobantes (GastoCheck):**
   - [ ] Tab "Capturar"
   - [ ] [ ] Cámara funciona
   - [ ] Capturar photo de receipt
   - [ ] ✅ OCR procesa (2-3 seg)
   - [ ] ✅ Aparece en "Mis comprobantes"

3. **CobraCheck:**
   - [ ] Tab "CobraCheck"
   - [ ] ✅ Ver clientes
   - [ ] ✅ Ver scoring

4. **Offline:**
   - [ ] Airplane mode ON
   - [ ] ✅ Datos siguen visibles
   - [ ] Airplane mode OFF
   - [ ] ✅ Sync automático

5. **Performance:**
   - [ ] App abre en < 2 segundos
   - [ ] Scroll sin lag
   - [ ] No hay crashes

✅ **VERIFICAR:** Todos los flujos funcionan

---

## 🔧 VARIABLES DE ENTORNO MOBILE

En `apps/mobile/app.json`:
```json
{
  "expo": {
    "plugins": [
      ["expo-build-properties", {
        "android": {
          "usesCleartextTraffic": true
        }
      }]
    ],
    "eas": {
      "projectId": "[tu-project-id]"
    }
  }
}
```

Y en `.env.local` (mobile lo lee via expo-env):
```bash
EXPO_PUBLIC_SUPABASE_URL=https://[prod-project-id].supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
```

---

## ✅ CHECKLIST FINAL

- [ ] EAS CLI instalado
- [ ] Login en EAS exitoso
- [ ] `app.json` tiene projectId
- [ ] APK descargado
- [ ] APK instalado en teléfono
- [ ] App abre sin crashes
- [ ] Login funciona
- [ ] Todos los flujos validan correctamente
- [ ] Performance OK (< 2s load)

---

## 🚨 PROBLEMAS COMUNES

**P: Build falló "Dependency not found"**
- ✅ Ejecutar: `pnpm install` en `apps/mobile`
- ✅ Verificar `package.json` existe
- ✅ Reintentar `eas build`

**P: "Invalid project ID"**
- ✅ Verificar `app.json` tiene `projectId` en `eas` block
- ✅ Ejecutar: `eas project:info`

**P: APK no se instala en teléfono**
- ✅ Verificar "Instalar apps de fuentes desconocidas" está habilitado
- ✅ Verificar espacio disponible en teléfono
- ✅ Intentar reinstalar

**P: App crashes al abrirse**
- ✅ Ver logs: `adb logcat` (Android)
- ✅ Verificar SUPABASE_URL y keys están en `.env`
- ✅ Verificar conexión a internet en teléfono

**P: Cámara no funciona**
- ✅ Verificar permisos en teléfono: Settings → Apps → GastoCheck → Permissions → Camera
- ✅ Dar permiso

---

## 📋 PRÓXIMO PASO

Una vez hayas completado testing en teléfono:
1. ✅ APK instalado
2. ✅ Todos los flujos funcionan
3. ✅ Performance OK

**ENTONCES:** Ready para **TESTING CHECKLIST** (FASE 5)

Ver: `CHECKLIST_EXECUTION_2026_06_19.md` → FASE 5
