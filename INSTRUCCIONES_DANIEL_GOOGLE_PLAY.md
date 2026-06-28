# 📱 CHECK SUITE — PUBLICAR EN GOOGLE PLAY STORE
**Fecha:** 29 de Junio 2026  
**Responsable:** Daniel  
**Versión App:** 0.1.72  
**Tiempo estimado:** 45 minutos

---

## ⚠️ ANTES DE EMPEZAR

- ✅ Tienes acceso a Google Play Console (ya verificado)
- ✅ App ya está creada en Play Console (CHECK SUITE)
- ✅ Screenshots y descripción ya están (verificar)
- ✅ Developer Account activo (juan.romero@...)

---

## 📋 PASO 1: DESCARGA SERVICE ACCOUNT JSON (5 min)

**En tu navegador:**

1. Abre: https://play.google.com/console/developers
2. Login con cuenta google
3. Ve a: **Settings** → **API access**
4. En la sección **"Service Accounts"** → Click **"Create Service Account"**
5. Sigue los pasos:
   - Nombre: `gastocheck-publisher`
   - Rol: `Admin (all permissions)`
6. Una vez creado:
   - Click en el service account
   - Pestaña: **Keys** → **Add Key** → **Create new key** → **JSON**
7. **Descarga el archivo JSON**
8. Guárdalo en tu home:
   ```
   C:\Users\[tu-usuario]\gastocheck-service-account.json
   ```

---

## 🚀 PASO 2: BUILD Y PUBLISH A GOOGLE PLAY (25 min)

**En tu terminal (PowerShell):**

```powershell
cd "C:\Users\admin\Documents\gastocheck-app\apps\mobile"
eas build --platform android --profile production
```

**Qué pasa:**
1. EAS te preguntará: "Setup Google Service Account?"
2. Responde: **SÍ**
3. Te pedirá la ruta del JSON que descargaste
4. Pega la ruta:
   ```
   C:\Users\[tu-usuario]\gastocheck-service-account.json
   ```
5. EAS compilará (~15 min)
6. Al terminar, preguntará: "Submit to Google Play?"
7. Responde: **SÍ**

**Espera a que diga: ✅ Build submitted**

---

## 💰 PASO 3: CONFIGURAR SUSCRIPCIÓN (15 min)

**En Google Play Console:**

1. Ve a: **Monetization** → **In-App Products** → **Subscriptions**
2. Click: **Create Subscription**
3. Rellena:
   ```
   Producto ID:     gastocheck-premium-monthly
   Nombre:          GastoCheck Premium
   Descripción:     Acceso completo a todas las funciones
   Precio:          $299 MXN (México) o ajusta por región
   Período:         1 mes
   Período prueba:  30 días gratis
   ```
4. Click: **Save & Publish**
5. En **Pricing & Distribution:**
   - Activa para: **México** (o todos tus mercados)
   - Estado: **Active**

---

## ✅ PASO 4: VERIFICAR CONFIGURACIÓN DE LA APP

**En Google Play Console → App Settings:**

1. **Nombre:** CHECK SUITE ✓
2. **Descripción corta:**
   > "Control de gastos, anticipos y viáticos. 30 días gratis."
3. **Descripción larga:**
   ```
   CHECK SUITE: Control total de tu negocio
   
   Módulos:
   • GastoCheck: Captura gastos, anticipos y viáticos
   • Validación SAT en tiempo real
   • Reportes ejecutivos
   • Exportación contable
   • Panel contador general
   
   PRUEBA 30 DÍAS GRATIS
   Después: $299 MXN/mes
   ```
4. **Screenshots:**
   - Mínimo 2 screenshots
   - Máximo 8
   - Tamaño: 1080x1920 px
5. **Icono:** 512x512 px (STATIX logo)
6. **Content Rating:** Completa si pide

---

## 🔄 PASO 5: ESPERAR APROBACIÓN DE GOOGLE (24-48 horas)

**Qué hace Google:**
1. Revisa que la app no tenga malware
2. Verifica que funcione correctamente
3. Valida la suscripción/billing
4. Aprueba o rechaza

**Dónde ver el status:**
- Google Play Console → **Releases** → **Internal Testing** (o **Production**)
- Estado: *In review* → *Approved* → *Published*

---

## 📊 PASO 6: POST-PUBLICACIÓN (cuando esté aprobada)

**Una vez que Google apruebe:**

1. ✅ App aparece en Google Play Store
2. ✅ Los usuarios pueden descargarla
3. ✅ Primer mes es GRATIS (trial)
4. ✅ Después se les cobra $299 MXN/mes

**Monitorea:**
- Descargas en tiempo real (Analytics tab)
- Errores/crashes (Android Vitals)
- Reseñas y ratings
- Feedback de usuarios

---

## 🚨 SI ALGO FALLA

### Error: "Google Service Account Keys cannot be set up"
**Solución:** Descargaste el JSON pero EAS no lo encuentra
- Verifica la ruta completa del archivo JSON
- Intenta nuevamente

### Error: "Build failed"
**Solución:** Problema de dependencias
```powershell
cd C:\Users\admin\Documents\gastocheck-app
npm install
cd apps\mobile
eas build --platform android --profile production
```

### Error: "Submission failed"
**Solución:** Google Play rechazó la app
- Ve a Google Play Console
- Mira los detalles del error
- Contacta a Juan para fixes

---

## 📝 CHECKLIST FINAL

- [ ] Service Account JSON descargado
- [ ] Terminal: `eas build` completado
- [ ] Suscripción creada en Google Play Console
- [ ] Descripción y screenshots listos
- [ ] App enviada a Google Play
- [ ] Status: *In review*
- [ ] Esperando aprobación (24-48h)

---

## 📞 CONTACTO

Si hay problemas:
- **Juan:** romero.juan24@gmail.com
- Envía: Screenshot del error + paso en el que falló

---

**¡LISTO! Mañana a las 9 AM ejecuta esto y habremos publicado CHECK SUITE en Google Play.** 🚀

