# ✅ PASOS PARA DANIEL — HOY (29 JUNIO 2026)

## PASO 1: EJECUTAR MIGRACIÓN SQL (5 minutos)

**EN SUPABASE STUDIO:**
1. Abre: https://app.supabase.com
2. Proyecto: **gastocheck-app**
3. Ve a: **SQL Editor** → **New query**
4. **COPIA TODO** el contenido de:
   ```
   C:\Users\admin\Documents\gastocheck-app\supabase\migrations\20260627_perfilamiento_gastocheck_v1.sql
   ```
5. **PEGA** en el editor SQL
6. Click: **▶️ Execute**
7. Espera: **✅ Success**

**Si ves errores:**
- Si dice "table already exists" → Es normal, significa que se ejecutó bien
- Si dice "permission denied" → Contacta a Juan

---

## PASO 2: ACCEDER A LA APP VIA EXPO GO (2 minutos)

**Expo Go está corriendo 24/7 en:**
```
http://localhost:8081
```

**EN TU TELÉFONO ANDROID:**
1. Abre **Expo Go** (app)
2. Escanea el **QR** que verás en tu computadora
3. O busca: **CHECK SUITE** en recientes

**VERSIÓN:** 0.1.72
- ✅ Viáticos (6 categorías)
- ✅ Multi-comprador tracking
- ✅ Contador General panel (web)

---

## PASO 3: TESTEAR LA APP (10 minutos)

**EN MOBILE:**
- [ ] Abre CHECK SUITE
- [ ] Login con tu cuenta Supabase
- [ ] Ve a: **GastoCheck** → **Viáticos**
- [ ] Intenta crear un viático (6 categorías disponibles)
- [ ] Ve a: **Mis Viáticos** (debería listarse)

**EN WEB (PC):**
- [ ] Abre: http://localhost:3000/gastocheck/contador-general
- [ ] Login como contador_general
- [ ] Verás: 4 KPIs + tablas
- [ ] Intenta los tabs: "Resumen", "Por Comprador", "Viáticos"

---

## CONTACTO

Si algo no funciona:
- **Servidor Expo:** Debe estar corriendo en background
- **Base de datos:** Verifica que ejecutaste la migración SQL
- **Credenciales:** Usa mismo usuario Supabase en mobile y web

---

## 📝 NOTAS IMPORTANTES

1. **Expo Go** se queda corriendo indefinidamente
   - No cierres la terminal
   - Los cambios de código se sincronizan automáticamente

2. **Migración SQL** SOLO se ejecuta UNA VEZ
   - Después está permanentemente en la BD

3. **Versioning:**
   - Cada cambio de código → nueva versión (0.1.73, 0.1.74, etc.)
   - Expo Go descarga automáticamente

4. **Si Juan quiere acceder desde su teléfono:**
   - Desde mismo WiFi: Escanea QR
   - Desde fuera: Necesita VPN o conexión

---

**¿Preguntas? Contacta a Juan o avísame si algo falla.** ✅

