# Compilar APK en Expo Cloud — Instrucciones para Daniel

> Fecha: 9 Junio 2026 | Estado: ✅ Todo configurado, solo ejecutar comandos

---

## Requisitos previos

✅ **Ya instalado:**
- EAS CLI v20.1.0
- Variables de entorno configuradas en `eas.json` y `.env.local`
- `app.json` completo y válido

⚠️ **Tú necesitas:**
- Cuenta Expo (crear gratis en https://expo.dev si no tienes)
- Terminal con PowerShell o bash
- Estar dentro de `C:\Users\admin\Documents\gastocheck-app\apps\mobile\`

---

## Paso 1 — Login (PRIMERA VEZ SOLAMENTE)

En la terminal, dentro de `apps/mobile/`:

```bash
eas login
```

Esto abrirá el navegador. Inicia sesión o crea una cuenta en https://expo.dev.

La terminal mostrará: `✔ Logged in as <tu-email>`

> **Si ya hiciste login antes, salta este paso.**

---

## Paso 2 — Inicializar proyecto (PRIMERA VEZ SOLAMENTE)

```bash
eas init
```

Preguntas que aparecerán:

```
? What would you like your Android app package to be? com.gastocheck.app
? What would you like your Expo slug to be? gastocheck
```

**Respuestas sugeridas:**
- Package: `com.gastocheck.app` (YA CONFIGURADO EN `app.json`)
- Slug: `gastocheck` (YA CONFIGURADO EN `app.json`)

Esto genera/actualiza el `projectId` en `app.json` automáticamente.

> **Si la pregunta dice "Would you like to update app.json?", responde `yes`.**

---

## Paso 3 — Compilar APK (CADA VEZ QUE QUIERAS BUILDAR)

```bash
eas build --platform android --profile preview
```

Esto dispara la compilación en la nube de Expo. Espera ~8–15 minutos.

**Output esperado:**

```
✔ Build finished
📱 Android app: https://expo.dev/artifacts/...
📥 Download APK: https://...gastocheck-preview.apk
```

---

## Paso 4 — Descargar e instalar

1. Haz clic en el link del APK o cópialo al navegador
2. El archivo se descarga como `gastocheck-preview.apk`
3. Envía a un teléfono Android (o abre directamente si estás en Android)
4. En el teléfono: **Configuración → Seguridad → Fuentes desconocidas** (activa)
5. Abre el APK y toca **Instalar**

---

## Probando la app

Después de instalar:

1. Abre **GastoCheck**
2. Login con: `operador@test.com` / `Test1234!`
3. Prueba capturar foto de ticket
4. Verifica que aparezca en el panel web

---

## Troubleshooting

| Error | Solución |
|---|---|
| `Not logged in` | Ejecuta `eas login` primero |
| `projectId not found` | Ejecuta `eas init` para generar uno |
| `Failed to bundle` | Verifica que no hay errores en TypeScript: `npm run typecheck -w apps/mobile` |
| `APK download link expira` | Los links duran ~24h. Descarga inmediatamente o haz un nuevo build |

---

## Versiones configuradas

```json
{
  "version": "0.1.0",
  "runtimeVersion": "0.1.0",
  "android": { "versionCode": 1 }
}
```

> Para siguientes versiones: incrementa `version`, `runtimeVersion` y `versionCode`

---

## Variables de entorno

✅ **Ya configuradas en `eas.json`:**
```
EXPO_PUBLIC_SUPABASE_URL=https://omhycwfjxynkfwywzwvz.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_sSlEbsfs4842PDD8H050uQ_dhLbljxA
```

Si necesitas cambiarlas:
```bash
eas secret:update --scope project --name EXPO_PUBLIC_SUPABASE_URL
```

---

## Próximos builds

### Desarrollo/prueba:
```bash
eas build --platform android --profile preview
```

### Para Play Store (producción):
```bash
eas build --platform android --profile production
```

(Requiere configurar keystore — después)

---

## Documentación útil

- [EAS Build Docs](https://docs.expo.dev/eas-update/introduction/)
- [Expo Router Setup](https://docs.expo.dev/router/introduction/)
- [GastoCheck Repo](https://github.com/romerojuan24-maker/gastocheck-app)

---

**Commit:** `48f2a9d` en GitHub
