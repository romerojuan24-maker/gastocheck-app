# 📋 GASTOCHECK - SISTEMA DE LOGGING & ERROR DETECTION

## Resumen Ejecutivo

Sistema **automático** de captura, logging y análisis de errores que:
- ✅ Captura TODOS los errores sin instrucción manual
- ✅ Los envia a Supabase `diagnostic_logs` (tabla remota)
- ✅ Los almacena localmente en buffer en memoria
- ✅ Redacta automáticamente datos sensibles (tokens, passwords, API keys)
- ✅ Se puede exportar por WhatsApp/email/etc
- ✅ Integrado en `_layout.tsx` - inicia automáticamente

---

## 🏗️ ARQUITECTURA

### Ubicación Principal
```
apps/mobile/lib/logger.ts (210 líneas)
```

### Inicialización Automática
```typescript
// En apps/mobile/app/_layout.tsx (línea 13)
import { initLogger, setCurrentScreen } from '../lib/logger';
initLogger(); // ← Se ejecuta una sola vez al iniciar la app
```

---

## 🎯 FUNCIONALIDADES

### 1. CAPTURA AUTOMÁTICA (Sin código adicional)

**Qué captura automáticamente:**

```
✅ console.log()     → Buffer local
✅ console.warn()    → Buffer local + Supabase
✅ console.error()   → Buffer local + Supabase
✅ Errores globales  → Unhandled errors de promises/timers
✅ Errores fatales   → Crashes del app
✅ Stack traces      → Primeros 2000 caracteres
```

**Sin necesidad de:**
```typescript
// NO necesitas escribir esto en cada catch:
// logError('tag', 'mensaje')

// Solo escribes lo normal:
try {
  await fetch(url);
} catch (err) {
  console.error('Fetch failed:', err); // ← AUTOMÁTICAMENTE enviado a Supabase
}
```

---

### 2. BUFFER EN MEMORIA

**Límite:** 3000 líneas máximo
**Formato:** `YYYY-MM-DDTHH:mm:ss.sssZ [LEVEL] mensaje`

```
12:00:45.123Z [INIT] logger iniciado · 0.1.81 · android
12:00:46.000Z [LOG] Iniciando sesión del usuario
12:00:47.500Z [WARN] Conexión lenta detectada
12:00:48.200Z [ERROR] Network timeout after 30s
```

---

### 3. ENVÍO AUTOMÁTICO A SUPABASE

**Tabla:** `diagnostic_logs`
**Trigger:** `console.warn()` y `console.error()`

**Estructura enviada:**
```json
{
  "user_id": "uuid",
  "tag": "console | global_error | unhandled_rejection",
  "level": "warn | error",
  "message": "El error que ocurrió",
  "metadata": {
    "screen": "/dashboard/gastocheck",
    "platform": "android",
    "fatal": false,
    "stack": "primeros 2000 chars del stack trace"
  },
  "created_at": "ISO timestamp"
}
```

---

### 4. REDACCIÓN AUTOMÁTICA DE DATOS SENSIBLES

**Patrón regex:**
```regex
/token|password|secret|apikey|api_key|authorization|jwt|clabe|csd|cert|private_key/i
```

**Ejemplo:**
```javascript
// Esto:
console.error('Auth error:', {
  token: 'eyJhbGciOiJIUzI1NiIs...',
  password: 'my_secure_pass',
  email: 'user@example.com'
});

// Se guarda como:
{
  token: '[REDACTED]',
  password: '[REDACTED]',
  email: 'user@example.com'
}
```

---

### 5. EXPORTACIÓN LOCAL

**Función:** `exportLogs()`
**Ubicación:** `apps/mobile/lib/logger.ts:189`

**Lo que hace:**
1. Toma todo el buffer
2. Lo escribe a archivo: `gastocheck-log-2026-07-10.txt`
3. Abre el diálogo de Share nativo (Android/iOS)
4. Usuario puede enviar por WhatsApp, email, etc

**Formato del archivo:**
```
=== GASTOCHECK · LOG DE DIAGNOSTICO ===
Generado: 2026-07-10T12:06:00.000Z
Version: 0.1.81
Plataforma: android 11
Contexto: {"user_id":"abc123"}
Lineas: 2847
========================================

12:00:45.123Z [INIT] logger iniciado · 0.1.81 · android
12:00:46.000Z [LOG] Iniciando sesión del usuario
...
```

---

## 🔌 CÓMO USARLO

### En el código de la app:

```typescript
// OPCIÓN 1: Dejar que se capture automáticamente
try {
  await apiCall();
} catch (err) {
  console.error('API failed:', err); // ← Auto enviado a Supabase
}

// OPCIÓN 2: Registrar un evento informativo (local only)
import { logEvent } from '../lib/logger';
logEvent('navigation', 'User opened settings');

// OPCIÓN 3: Log manual con datos sensibles (redactados automáticamente)
import { logWarn, logError } from '../lib/logger';
logWarn('auth', 'Token near expiry', { expiresIn: 300 });
logError('network', 'Connection lost', { attempts: 3 });

// OPCIÓN 4: Exportar logs (UI button llamando esto)
import { exportLogs } from '../lib/logger';
const uri = await exportLogs({ userId: user.id });
// El usuario ve el dialog y elige: WhatsApp, email, etc.
```

---

## 📊 ERRORES QUE CAPTURA

### 1. Errores de React (componentes)
```typescript
// ErrorBoundary captura estos
throw new Error('Component render failed');
```

### 2. Async/await y Promises
```typescript
try {
  await supabase.auth.signOut();
} catch (err) {
  console.error('Logout failed:', err); // ← Capturado
}
```

### 3. Promesas sin .catch (Unhandled rejection)
```typescript
fetch(url); // Si falla sin .catch → capturado por listener global
Promise.reject('error'); // ← Capturado
```

### 4. Errores en timers/listeners
```typescript
setTimeout(() => {
  throw new Error('Timer error'); // ← Capturado por ErrorUtils
}, 1000);
```

### 5. Errores globales/fatales
Crashes de Hermes (motor JS de React Native)

---

## 🔍 SUPABASE DIAGNOSTIC_LOGS

### Schema esperado:
```sql
CREATE TABLE diagnostic_logs (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  tag TEXT NOT NULL,        -- 'console' | 'global_error' | 'unhandled_rejection'
  message TEXT NOT NULL,
  level TEXT NOT NULL,      -- 'warn' | 'error'
  metadata JSONB,           -- {screen, platform, fatal, stack}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_user_logs ON diagnostic_logs(user_id, created_at DESC);
CREATE INDEX idx_level ON diagnostic_logs(level);
```

### Query ejemplo (ver errores del usuario):
```sql
SELECT * FROM diagnostic_logs
WHERE user_id = 'user-uuid'
  AND level = 'error'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 50;
```

---

## 📦 INSTALACIÓN EN OTRAS APPS

### Para `apps/web` (Next.js):

```typescript
// apps/web/lib/logger.ts (crear nuevo)
// Versión adaptada para Node.js/browser
// - Quita FileSystem y Share (no existen en web)
// - Agrega localStorage para persistencia
// - Envía a Supabase igual
```

### Para `apps/mobile` (ya está):
✅ Completamente funcional

### Para `apps/server` (NestJS backend):

```typescript
// apps/web/src/modules/logger/logger.service.ts (crear nuevo)
// Captura:
// - console.log/warn/error
// - Excepciones de NestJS
// - Request/Response logs
// - Envía a Supabase diagnostic_logs
```

---

## 🚨 CORRECCIÓN AUTOMÁTICA DE ERRORES

**Nota:** El logger ACTUAL captura y reporta errores. Para **corrección automática**, necesitarías:

### Opción A: Error Recovery Handler
```typescript
// En _layout.tsx, después de initLogger():
export async function handleAutoRecovery(error: Error) {
  if (error.message.includes('Network')) {
    await delay(2000);
    return 'RETRY'; // Reintentar la operación
  }
  if (error.message.includes('Session')) {
    await supabase.auth.refreshSession();
    return 'RETRY';
  }
  if (error.message.includes('RLS')) {
    router.replace('/login'); // Logout automático
    return 'LOGOUT';
  }
  return 'FAIL'; // No se puede recuperar
}
```

### Opción B: Supabase Diagnostics Hook
```typescript
// Procesar logs en Supabase para detectar patrones
// e invocar funciones edge para corregir
// Ej: Si detecta "5 errores RLS seguidos" → borrar sesión corrupta
```

---

## 🛠️ MANTENIMIENTO

### Monitoreo en Supabase:
```sql
-- Ver errores más comunes
SELECT tag, message, COUNT(*) as count
FROM diagnostic_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY tag, message
ORDER BY count DESC;
```

### Limpiar logs antiguos (90+ días):
```sql
DELETE FROM diagnostic_logs
WHERE created_at < NOW() - INTERVAL '90 days';
```

### Dashboard recomendado:
- Google Sheets + Supabase API
- Grafana + Supabase PostgreSQL
- Custom dashboard en React

---

## 📝 RESUMEN DE ARCHIVOS

```
apps/mobile/
  lib/
    logger.ts                    ← Sistema de logging
  app/
    _layout.tsx                  ← Inicializa el logger (línea 13)
    settings.tsx                 ← Podría agregar botón "Export Logs"

Próximo: Replicar en:
  apps/web/lib/logger.ts
  apps/web/src/modules/logger/logger.service.ts
```

---

## ✅ CHECKLIST DE INSTALACIÓN EN NUEVA APP

- [ ] Copiar `logger.ts` (adaptado al framework)
- [ ] Llamar `initLogger()` en entry point
- [ ] Crear tabla `diagnostic_logs` en Supabase
- [ ] Agregar permisos RLS para insert (solo usuarios autenticados)
- [ ] (Opcional) Agregar UI button para exportar logs
- [ ] (Opcional) Setup monitoring en Supabase

