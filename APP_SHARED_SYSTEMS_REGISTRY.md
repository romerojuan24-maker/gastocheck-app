# APP SHARED SYSTEMS REGISTRY — CHECK SUITE
**Catálogo de Sistemas Compartibles para Ecosistema STATIKA**

**Fecha**: 2026-07-08  
**Versión**: OTA 170+  
**Aplicación**: CHECK SUITE (BancoCheck, CobraCheck, FlujoCheck, GastoCheck, FacturaCheck)

---

## CÓMO USAR ESTE REGISTRO

Para cada sistema:
1. **Verificar estado**: ¿Producción o Beta?
2. **¿Usarlo directo?**: ¿Copiar código de esta app?
3. **¿Convertirlo en paquete?**: ¿Extraer a `packages/shared-*`?
4. **¿Exponerlo como API?**: ¿Llamar desde otro servidor?
5. **Riesgo**: ¿Qué puede salir mal?
6. **Recomendación**: ¿Cuál es la mejor forma de integrarlo?

---

## 1. OCR / VISIÓN COMPUTACIONAL

### 1.1 Gemini-Powered Receipt OCR

| Atributo | Valor |
|----------|-------|
| **Nombre** | Receipt OCR with Gemini 1.5 Flash |
| **Qué hace** | Escanea foto de comprobante, extrae: proveedor, RFC, monto, IVA, IEPS, impuestos, fiscal UUID, payment method |
| **Archivos** | `supabase/functions/ocr-extract/index.ts`, `packages/shared/src/ocr.ts` |
| **Dependencias** | Google Gemini 1.5 Flash, base64 encoding, `OcrResult` type |
| **Estado** | ✅ **Producción** |
| **Usable directo** | ✅ **Sí** — llamar Edge Function `ocr-extract` |
| **Convertible a paquete** | ✅ **Sí** — ya existe `@gastocheck/shared::ocr` |
| **Exponible como API** | ✅ **Sí** — actualmente es Edge Function |
| **Apps que lo necesitan** | Agro Copilot (fotos de facturas), STATIKA Portal (upload de docs), STATIKA RH (contratos/recibos), InventarioCheck (etiquetas) |
| **Riesgo** | 🟡 **Medio** — depende de API de Google, requiere API key, latency ~2-3s |
| **Peso estimado** | **200 KB** (types + wrapper) |
| **Cómo consumirlo** | |
| — Si eres app interna | `import { ocr-extract } from './supabase-client'; const result = await ocr-extract({ image_base64, mime_type })` |
| — Si eres app externa | `POST /api/ocr-extract` (crear endpoint en Next.js) |
| **Recomendación** | ✅ **Exponer como API** — Gemini es caro, mejor tener 1 endpoint que 5 apps llamando |

**Ejemplo de consumo (STATIKA Agro)**:
```typescript
// En Agro Copilot, cuando agricultor sube foto de factura
const result = await supabase.functions.invoke('ocr-extract', {
  body: { image_base64: photoBase64, mime_type: 'image/jpeg' }
})
const { providerName, total, fiscalUuid } = result.data
// Usar en flujo de gastos o inventario
```

---

### 1.2 Document Type Recognition

| Atributo | Valor |
|----------|-------|
| **Nombre** | Document Type Detection |
| **Qué hace** | Detecta si imagen es: factura CFDI, recibo simple, talón de nómina, contrato, etc. |
| **Archivos** | Implícito en `ocr-extract/`, no es código separado |
| **Dependencias** | Gemini vision, `OcrResult.internalFolio`, `OcrResult.fiscalUuid` |
| **Estado** | 🟡 **Beta** — funciona pero sin clasificación explícita |
| **Usable directo** | ⚠️ **Parcial** — deducible del resultado OCR pero sin etiqueta |
| **Convertible a paquete** | ✅ **Sí** — si se mejora clasificación |
| **Exponible como API** | ✅ **Sí** — junto con ocr-extract |
| **Apps que lo necesitan** | STATIKA Portal (validar tipo de documento), STATIKA RH (clasificar nómina vs contrato) |
| **Riesgo** | 🟡 **Medio** — clasificación puede fallar con documentos no estándar |
| **Peso estimado** | **100 KB** (embeddings si se implementa) |
| **Recomendación** | ⏳ **No compartir todavía** — mejorar precisión en CHECK SUITE primero, luego extraer |

---

## 2. CLIMA

### 2.1 Weather Integration

| Atributo | Valor |
|----------|-------|
| **Nombre** | Weather Service |
| **Qué hace** | ¿Busca clima para ubicaciones? (No encontrado en codebase) |
| **Archivos** | No identificado |
| **Dependencias** | N/A |
| **Estado** | ❌ **No implementado en CHECK SUITE** |
| **Observación** | Agro Copilot lo necesita (riego, plagas), pero CHECK SUITE no lo usa |
| **Recomendación** | 🚀 **Oportunidad**: Cuando Agro implemente, documentar aquí |

---

## 3. GPS / MAPAS / GEOLOCALIZACIÓN

### 3.1 GPS Route Tracking

| Atributo | Valor |
|----------|-------|
| **Nombre** | GPS Route Tracking with Movement History |
| **Qué hace** | Registra ubicación en tiempo real, calcula distancia recorrida, tiempo en ruta, paradas |
| **Archivos** | `apps/mobile/lib/route-tracker.ts` |
| **Dependencias** | Expo Location API, background task scheduler, Supabase |
| **Estado** | ✅ **Producción** |
| **Usable directo** | ✅ **Sí** — copiar archivo y adaptar |
| **Convertible a paquete** | ✅ **Sí** — extraer a `packages/shared-gps` |
| **Exponible como API** | ⚠️ **Parcial** — datos se guardan en Supabase, no hay API REST |
| **Apps que lo necesitan** | STATIKA Agro (track de riego/inspecciones), CobraCheck (rutas de cobradores), Portal (delivery tracking) |
| **Riesgo** | 🟡 **Medio** — batería, permisos de GPS, privacidad usuario |
| **Peso estimado** | **150 KB** (code + types) |
| **Cómo consumirlo** | |
| — Si eres app móvil | `import { startTracking } from '@gastocheck/shared-gps'; await startTracking(userId, companyId)` |
| — Si eres backend | Query tabla `movement_history` en Supabase |
| **Recomendación** | ✅ **Extraer a paquete** — reutilizar en Agro, CobraCheck, Portal |

**Ejemplo de consumo (STATIKA Agro)**:
```typescript
// En inspección de terreno
import { useRouteTracker } from '@statika/shared-gps'
const { startTracking, stopTracking, distanceKm, durationMin } = useRouteTracker()
await startTracking(userId, companyId, { recordElevation: true })
// Al terminar inspección
await stopTracking()
console.log(`Recorriste ${distanceKm} km en ${durationMin} min`)
```

---

### 3.2 Route Optimization

| Atributo | Valor |
|----------|-------|
| **Nombre** | Route Optimization Engine |
| **Qué hace** | Optimiza orden de visitas para minimizar distancia/tiempo (TSP solver) |
| **Archivos** | `supabase/functions/optimize-route/index.ts` |
| **Dependencias** | Google Maps Distance Matrix API, OR-Tools (Traveling Salesman Problem) |
| **Estado** | 🟡 **Beta** |
| **Usable directo** | ⚠️ **Parcial** — costo de API Google Maps puede ser alto |
| **Convertible a paquete** | ✅ **Sí** |
| **Exponible como API** | ✅ **Sí** — ya es Edge Function |
| **Apps que lo necesitan** | CobraCheck (rutas óptimas), Agro (riego por parcelas), Delivery/Logística (futuro) |
| **Riesgo** | 🔴 **Alto** — dependencia de Google Maps API, costo escalable, latency variable |
| **Peso estimado** | **500 KB** (incluyendo solver) |
| **Recomendación** | ⏳ **Exponer como API** — pero con control de costos (cache, rate limit) |

---

## 4. OFFLINE / SINCRONIZACIÓN

### 4.1 Offline Queue Management

| Atributo | Valor |
|----------|-------|
| **Nombre** | AsyncStorage Offline Queue |
| **Qué hace** | Encola operaciones (create/update/delete) cuando sin red, sincroniza cuando hay conexión |
| **Archivos** | `apps/mobile/lib/offline-sync.ts` |
| **Dependencias** | React Native AsyncStorage, Supabase client |
| **Estado** | ✅ **Producción** |
| **Usable directo** | ✅ **Sí** — copiar y adaptar |
| **Convertible a paquete** | ✅ **Sí** — ideal como `packages/shared-sync` |
| **Exponible como API** | ❌ **No** — es cliente-side only |
| **Apps que lo necesitan** | Agro Copilot (aplicación de riego sin red), STATIKA Portal (mobile), Field Ops (en general) |
| **Riesgo** | 🟢 **Bajo** — patrón probado, simple |
| **Peso estimado** | **80 KB** |
| **Cómo consumirlo** | |
| — Paso 1 | `import { enqueueOffline, syncQueue } from '@gastocheck/shared-sync'` |
| — Paso 2 | `await enqueueOffline('receipt', 'create', { amount: 100 })` cuando offline |
| — Paso 3 | `const { synced, failed } = await syncQueue()` cuando hay red |
| **Recomendación** | ✅ **Extraer a paquete INMEDIATO** — es genérico y reutilizable |

**Ejemplo de consumo (STATIKA Agro)**:
```typescript
import { enqueueOffline, syncQueue } from '@statika/shared-sync'

// Agricultor en terreno sin red
const enqueueReading = async (sensorId, value) => {
  await enqueueOffline('sensor_reading', 'create', {
    sensor_id: sensorId,
    value,
    timestamp: new Date().toISOString()
  })
}

// Cuando regresa a wifi
const syncReadings = async () => {
  const { synced, failed } = await syncQueue()
  if (failed > 0) showAlert(`${failed} lecturas no sincronizadas`)
}
```

---

### 4.2 Sync Conflict Resolution

| Atributo | Valor |
|----------|-------|
| **Nombre** | Conflict Resolution (Last-Write-Wins + Dedup) |
| **Qué hace** | Resuelve conflictos cuando offline: última escritura gana, detecta duplicados |
| **Archivos** | `apps/mobile/lib/offline-sync.ts` (líneas ~44-100) |
| **Dependencias** | Timestamps, createdAt dedup |
| **Estado** | ✅ **Producción** |
| **Usable directo** | ✅ **Sí** |
| **Convertible a paquete** | ✅ **Sí** — junto con queue |
| **Exponible como API** | ❌ **No** |
| **Apps que lo necesitan** | Todas las apps offline-first |
| **Riesgo** | 🟢 **Bajo** |
| **Peso estimado** | **50 KB** (incluido en shared-sync) |
| **Recomendación** | ✅ **Incluir en packages/shared-sync** |

---

## 5. AUTENTICACIÓN / PERMISOS

### 5.1 Supabase Authentication Integration

| Atributo | Valor |
|----------|-------|
| **Nombre** | Supabase Auth (Magic Links + OAuth) |
| **Qué hace** | Magic links, sign up, password reset, OAuth Google/GitHub, JWT tokens |
| **Archivos** | `apps/*/lib/supabase.ts`, `supabase/migrations/*auth*.sql` (RLS) |
| **Dependencias** | `@supabase/supabase-js` v2.39+, Supabase project |
| **Estado** | ✅ **Producción** |
| **Usable directo** | ✅ **Sí** — usar directamente `supabase.auth` |
| **Convertible a paquete** | ✅ **Sí** — wrapper genérico |
| **Exponible como API** | ❌ **No** — delegar a Supabase |
| **Apps que lo necesitan** | Todas las apps STATIKA |
| **Riesgo** | 🟢 **Bajo** — Supabase managed |
| **Peso estimado** | **100 KB** (wrapper) |
| **Recomendación** | ✅ **Usar directo desde `@supabase/supabase-js`** — no duplicar |

---

### 5.2 Role-Based Access Control (RBAC)

| Atributo | Valor |
|----------|-------|
| **Nombre** | RBAC via RLS Policies |
| **Qué hace** | Controla acceso por rol: owner, admin, contador_general, operario, viewer |
| **Archivos** | `supabase/migrations/` (96 migrations contienen RLS policies) |
| **Dependencias** | Supabase RLS, `auth.users`, tabla de permisos |
| **Estado** | ✅ **Producción** |
| **Usable directo** | ✅ **Sí** — copiar RLS patterns |
| **Convertible a paquete** | ✅ **Sí** — template de RLS |
| **Exponible como API** | ❌ **No** — es BD, no API |
| **Apps que lo necesitan** | Todas las apps multi-tenant |
| **Riesgo** | 🟡 **Medio** — RLS bugs = data breach |
| **Peso estimado** | **Documental** (no código ejecutable) |
| **Cómo consumirlo** | |
| — Paso 1 | Copiar RLS pattern desde migration |
| — Paso 2 | Adaptar a tus tablas/roles |
| — Paso 3 | Testar con admin+user accounts |
| **Recomendación** | 📖 **Crear template + documentación RLS** — no código, pero muy importante |

**Template de consumo (Agro Copilot)**:
```sql
-- Template de RLS para tabla nueva en Agro
CREATE TABLE field_inspections (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  inspector_id UUID REFERENCES auth.users(id),
  data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- RLS: Solo miembros de la company pueden ver
CREATE POLICY "member_view_inspections" ON field_inspections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = field_inspections.company_id
        AND cm.user_id = auth.uid()
    )
  );

-- RLS: Solo inspector o admin puede crear
CREATE POLICY "inspector_create_inspections" ON field_inspections
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = field_inspections.company_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('admin', 'inspector')
    )
    AND inspector_id = auth.uid()
  );
```

---

### 5.3 Company Member Management

| Atributo | Valor |
|----------|-------|
| **Nombre** | Company Invites & Membership |
| **Qué hace** | Invita usuarios a company, gestiona memberships, asigna roles |
| **Archivos** | `supabase/functions/invite-gastador/`, `supabase/migrations/*members*.sql` |
| **Dependencias** | Supabase Auth, email delivery |
| **Estado** | ✅ **Producción** |
| **Usable directo** | ✅ **Sí** — copiar invite function |
| **Convertible a paquete** | ✅ **Sí** |
| **Exponible como API** | ✅ **Sí** — crear endpoint |
| **Apps que lo necesitan** | Todas las apps multi-tenant |
| **Riesgo** | 🟢 **Bajo** |
| **Peso estimado** | **120 KB** (Edge Function + types) |
| **Recomendación** | ✅ **Exponer como API** — POST `/api/company/invite` |

---

## 6. REPORTES

### 6.1 Excel Export (Universal Format)

| Atributo | Valor |
|----------|-------|
| **Nombre** | Universal Excel Export |
| **Qué hace** | Genera XLSX con 6 hojas: resumen, detalle, por categoría, proveedores, conceptos, auditoría |
| **Archivos** | `apps/web/lib/export-excel.ts`, `supabase/functions/export-excel/` |
| **Dependencias** | `xlsx` library v0.18.5, formatters |
| **Estado** | ✅ **Producción** |
| **Usable directo** | ✅ **Sí** — copiar y adaptar formato |
| **Convertible a paquete** | ✅ **Sí** — extraer a `packages/shared-export` |
| **Exponible como API** | ✅ **Sí** — ya es función |
| **Apps que lo necesitan** | Portal, ERP, Agro (reportes agrícolas), RH |
| **Riesgo** | 🟢 **Bajo** |
| **Peso estimado** | **80 KB** |
| **Recomendación** | ✅ **Extraer a paquete INMEDIATO** |

---

### 6.2 SAT Format Export (CONTPAQi, Aspel COI, MicroSIP)

| Atributo | Valor |
|----------|-------|
| **Nombre** | Accounting Software Exports |
| **Qué hace** | Genera pólizas en formato CONTPAQi, Aspel COI, MicroSIP, SW |
| **Archivos** | `packages/shared/src/export.ts`, `supabase/functions/exportar-polizas-sat/` |
| **Dependencias** | Formateo específico por software, validadores |
| **Estado** | ✅ **Producción** |
| **Usable directo** | ⚠️ **Parcial** — logística de GastoCheck, puede variar en ERP |
| **Convertible a paquete** | ✅ **Sí** — extraer formatos |
| **Exponible como API** | ✅ **Sí** |
| **Apps que lo necesitan** | STATIKA ERP (export a contadores), Portal |
| **Riesgo** | 🟡 **Medio** — cada software tiene reglas distintas |
| **Peso estimado** | **150 KB** |
| **Cómo consumirlo** | |
| — Paso 1 | `import { exportToContpaqi } from '@gastocheck/shared-export'` |
| — Paso 2 | `const poliza = await exportToContpaqi(transactions, accounts)` |
| — Paso 3 | Descargar o enviar a contador |
| **Recomendación** | ✅ **Extraer a paquete** — pero mantener actualizado con cada software |

---

### 6.3 CSV Export

| Atributo | Valor |
|----------|-------|
| **Nombre** | CSV Export (Universal) |
| **Qué hace** | Exporta tablas a CSV para Excel, Google Sheets, otros |
| **Archivos** | `apps/web/lib/export-csv.ts` |
| **Dependencias** | CSV formatter simple |
| **Estado** | ✅ **Producción** |
| **Usable directo** | ✅ **Sí** |
| **Convertible a paquete** | ✅ **Sí** — incluir en shared-export |
| **Exponible como API** | ✅ **Sí** |
| **Apps que lo necesitan** | Todas |
| **Riesgo** | 🟢 **Bajo** |
| **Peso estimado** | **40 KB** |
| **Recomendación** | ✅ **Incluir en packages/shared-export** |

---

### 6.4 ZIP Archive Generation

| Atributo | Valor |
|----------|-------|
| **Nombre** | ZIP Archive Generator |
| **Qué hace** | Empaqueta múltiples archivos (Excel, PDF, XML) en ZIP |
| **Archivos** | `supabase/functions/export-zip/` |
| **Dependencias** | ZIP library (JSZip or similar) |
| **Estado** | 🟡 **Beta** |
| **Usable directo** | ✅ **Sí** |
| **Convertible a paquete** | ✅ **Sí** |
| **Exponible como API** | ✅ **Sí** |
| **Apps que lo necesitan** | Portal, ERP, Agro |
| **Riesgo** | 🟢 **Bajo** |
| **Peso estimado** | **60 KB** |
| **Recomendación** | ✅ **Incluir en packages/shared-export** |

---

## 7. NOTIFICACIONES

### 7.1 WhatsApp Integration

| Atributo | Valor |
|----------|-------|
| **Nombre** | WhatsApp Sender + Webhook Receiver |
| **Qué hace** | Envía mensajes a WhatsApp, recibe webhooks (replies, attachments) |
| **Archivos** | `supabase/functions/send-whatsapp/`, `whatsapp-webhook/`, `cobracheck-whatsapp-webhook/` |
| **Dependencias** | WhatsApp Business API (Twilio o Meta), webhooks |
| **Estado** | ✅ **Producción** |
| **Usable directo** | ✅ **Sí** — copiar functions |
| **Convertible a paquete** | ✅ **Sí** — wrapper genérico |
| **Exponible como API** | ✅ **Sí** — POST `/api/whatsapp/send` |
| **Apps que lo necesitan** | Agro (riego alerts), Portal (notificaciones), CobraCheck (cobros), RH (avisos) |
| **Riesgo** | 🟡 **Medio** — API de tercero, costo, rate limits |
| **Peso estimado** | **100 KB** |
| **Cómo consumirlo** | |
| — En app interna | `const result = await supabase.functions.invoke('send-whatsapp', { body: { to: '+5255...', message } })` |
| — En app externa | `POST /api/whatsapp/send` + auth token |
| **Recomendación** | ✅ **Exponer como API centralizada** — no duplicar credenciales WhatsApp |

**Ejemplo (Agro Copilot)**:
```typescript
// Sistema de alertas de riego
import { sendWhatsApp } from '@gastocheck/shared-notifications'

const alertFarmer = async (farmerId, message) => {
  const phone = await getPhoneNumber(farmerId)
  await sendWhatsApp(phone, `🌾 Alerta de riego: ${message}`)
}

// Cuando humedad baja de 30%
await alertFarmer(farmId, 'Humedad baja, riego recomendado')
```

---

### 7.2 Push Notifications (Expo)

| Atributo | Valor |
|----------|-------|
| **Nombre** | Expo Push Notifications |
| **Qué hace** | Envía push a app, tracking de delivery, actions |
| **Archivos** | `apps/mobile/lib/notifications.ts` |
| **Dependencias** | Expo Notifications SDK, Supabase |
| **Estado** | ✅ **Producción** |
| **Usable directo** | ✅ **Sí** — usar Expo SDK |
| **Convertible a paquete** | ✅ **Sí** |
| **Exponible como API** | ✅ **Sí** |
| **Apps que lo necesitan** | Agro, Portal, CobraCheck |
| **Riesgo** | 🟢 **Bajo** — Expo managed |
| **Peso estimado** | **70 KB** |
| **Recomendación** | ✅ **Extraer a paquete** |

---

### 7.3 In-App Toast Notifications

| Atributo | Valor |
|----------|-------|
| **Nombre** | React Hot Toast Integration |
| **Qué hace** | Toast notifications para feedback inmediato (success, error, info) |
| **Archivos** | `apps/web/` (react-hot-toast package) |
| **Dependencias** | `react-hot-toast` v2.4.1 |
| **Estado** | ✅ **Producción** |
| **Usable directo** | ✅ **Sí** |
| **Convertible a paquete** | ✅ **Sí** |
| **Exponible como API** | ❌ **No** — es UI |
| **Apps que lo necesitan** | Todas las web apps |
| **Riesgo** | 🟢 **Bajo** |
| **Peso estimado** | **Incluido en react-hot-toast** |
| **Recomendación** | ✅ **Usar directo** — no duplicar |

---

## 8. INTELIGENCIA ARTIFICIAL

### 8.1 Advisor IA Engine

| Atributo | Valor |
|----------|-------|
| **Nombre** | Advisor IA (Smart Insights) |
| **Qué hace** | Genera insights automáticos: cobranzas prioritarias, gastos anómalos, cash flow risk, alerts |
| **Archivos** | `supabase/functions/advisor-ask/`, `packages/shared/src/advisor.ts` |
| **Dependencias** | Gemini AI, análisis de datos |
| **Estado** | 🟡 **Beta** |
| **Usable directo** | ⚠️ **Parcial** — tipos existen, lógica variable |
| **Convertible a paquete** | ✅ **Sí** — tipos al menos |
| **Exponible como API** | ✅ **Sí** — es Edge Function |
| **Apps que lo necesitan** | Agro (insights agrícolas), Portal, ERP |
| **Riesgo** | 🟡 **Medio** — IA puede generar insights incorrectos |
| **Peso estimado** | **200 KB** |
| **Cómo consumirlo** | |
| — Paso 1 | `import { AdvisorInsight } from '@gastocheck/shared'` |
| — Paso 2 | `const insights = await supabase.functions.invoke('advisor-ask', { body: { company_id, module } })` |
| — Paso 3 | Mostrar insights con contexto (severity, action items) |
| **Recomendación** | 🔄 **Exponer como API** — mejorar prompts por módulo |

**Ejemplo (Agro Copilot)**:
```typescript
// Dashboard agrícola con IA insights
const insights = await supabase.functions.invoke('advisor-ask', {
  body: { company_id, module: 'agro' }
})

insights.forEach(insight => {
  if (insight.severity === 'critical') {
    showAlert(`⚠️ ${insight.title}: ${insight.body}`)
  }
})
```

---

### 8.2 Auto-Classification (Expenses)

| Atributo | Valor |
|----------|-------|
| **Nombre** | Auto-Categorization Engine |
| **Qué hace** | Clasifica gastos/transacciones automáticamente (IA + heurísticas) |
| **Archivos** | `packages/shared/src/categories.ts` (tipos), ML pipeline TBD |
| **Dependencias** | Gemini, categoría mapping |
| **Estado** | 🟡 **Beta** — heurísticas OK, ML model pending |
| **Usable directo** | ⚠️ **Parcial** — heurísticas sí, ML no |
| **Convertible a paquete** | ✅ **Sí** — cuando ML esté ready |
| **Exponible como API** | ✅ **Sí** — cuando ML esté ready |
| **Apps que lo necesitan** | Portal, ERP, Agro |
| **Riesgo** | 🔴 **Alto** — mal categorizado = contabilidad incorrecta |
| **Peso estimado** | **300 KB** (con ML model) |
| **Recomendación** | ⏳ **No compartir todavía** — mejorar accuracy en CHECK SUITE primero |

---

## 9. SENSORES / BLE / WiFi

**CHECK SUITE no usa sensores directamente. Esta sección es para referencia cuando otros productos lo necesiten.**

### 9.1 GPS Data Collection

| Atributo | Valor |
|----------|-------|
| **Nombre** | GPS/Location Collection |
| **Qué hace** | Recolecta coordenadas, altitud, precisión |
| **Archivos** | `apps/mobile/lib/route-tracker.ts` (usa Expo Location) |
| **Dependencias** | Expo Location API |
| **Estado** | ✅ **Producción** |
| **Usable directo** | ✅ **Sí** |
| **Convertible a paquete** | ✅ **Sí** |
| **Recomendación** | ✅ **Extraer a paquete** — usado en Agro (parcelas), CobraCheck (rutas) |

---

## 10. PAGOS

### 10.1 Stripe Checkout Integration

| Atributo | Valor |
|----------|-------|
| **Nombre** | Stripe Checkout Sessions |
| **Qué hace** | Crea sesiones de checkout para suscripciones, procesa pagos |
| **Archivos** | `supabase/functions/create-checkout-session/`, `stripe-webhook/` |
| **Dependencias** | Stripe SDK, webhooks |
| **Estado** | ✅ **Producción** |
| **Usable directo** | ✅ **Sí** |
| **Convertible a paquete** | ✅ **Sí** |
| **Exponible como API** | ✅ **Sí** — POST `/api/stripe/checkout` |
| **Apps que lo necesitan** | Portal, Agro, cualquier product con subscripción |
| **Riesgo** | 🟡 **Medio** — datos de pago, PCI compliance |
| **Peso estimado** | **120 KB** |
| **Recomendación** | ✅ **Extraer a paquete compartido** — reutilizar webhook, session logic |

**Ejemplo (Portal)**:
```typescript
const checkout = await supabase.functions.invoke('create-checkout-session', {
  body: {
    priceId: 'price_xxxxx',
    companyId: userCompanyId,
    successUrl: '/billing/success',
    cancelUrl: '/billing/cancel'
  }
})
window.location.href = checkout.url
```

---

### 10.2 Usage-Based Billing

| Atributo | Valor |
|----------|-------|
| **Nombre** | Usage Tracking & Credit System |
| **Qué hace** | Rastrea consumo (OCR calls, exports, MB almacenados), deduce credits |
| **Archivos** | `packages/shared/src/billing.ts`, `supabase/migrations/*billing*.sql` |
| **Dependencias** | Supabase tables, timestamp logic |
| **Estado** | 🟡 **Beta** |
| **Usable directo** | ✅ **Sí** — copiar schema |
| **Convertible a paquete** | ✅ **Sí** |
| **Exponible como API** | ✅ **Sí** |
| **Apps que lo necesitan** | Portal, Agro, cualquier SaaS |
| **Riesgo** | 🟡 **Medio** — fraude (spoof usage) |
| **Peso estimado** | **100 KB** |
| **Recomendación** | ✅ **Extraer a paquete** — pero con auditoría de usage |

---

## 11. ALMACENAMIENTO

### 11.1 Supabase Storage (File Upload)

| Atributo | Valor |
|----------|-------|
| **Nombre** | Supabase Storage Management |
| **Qué hace** | Upload/download files, RLS policies, presigned URLs, buckets |
| **Archivos** | `supabase/migrations/*storage*.sql` |
| **Dependencias** | Supabase Storage buckets, RLS |
| **Estado** | ✅ **Producción** |
| **Usable directo** | ✅ **Sí** — usar directo SDK |
| **Convertible a paquete** | ✅ **Sí** — wrapper |
| **Exponible como API** | ❌ **No** — delegar a Supabase |
| **Apps que lo necesitan** | Todas |
| **Riesgo** | 🟢 **Bajo** — Supabase managed |
| **Peso estimado** | **Wrapper ~50 KB** |
| **Recomendación** | ✅ **Usar directo desde Supabase SDK** |

---

### 11.2 Image Processing (Compression, Resize)

| Atributo | Valor |
|----------|-------|
| **Nombre** | Image Optimization |
| **Qué hace** | Comprime imágenes para OCR, crea thumbnails |
| **Archivos** | Implícito en OCR (base64 conversion) |
| **Dependencias** | Sharp o similar (no encontrado explícito) |
| **Estado** | 🟡 **Beta** — manual compression en cliente |
| **Usable directo** | ⚠️ **Parcial** |
| **Convertible a paquete** | ✅ **Sí** — si se implementa bien |
| **Recomendación** | ⏳ **No compartir todavía** — implementar en CHECK SUITE primero |

---

## 12. EXPORTACIÓN ESPECÍFICA

### 12.1 Póliza XML Generation (CONTPAQi Format)

| Atributo | Valor |
|----------|-------|
| **Nombre** | Accounting Journal Entry (Póliza) as XML |
| **Qué hace** | Genera póliza en formato XML para importar a CONTPAQi |
| **Archivos** | `apps/mobile/app/supervisor/reembolsos/index.tsx` (buildExportContent function) |
| **Dependencias** | XML formatter, accounting types |
| **Estado** | ✅ **Producción** |
| **Usable directo** | ✅ **Sí** — función simple de string |
| **Convertible a paquete** | ✅ **Sí** — incluir en shared-export |
| **Exponible como API** | ✅ **Sí** |
| **Apps que lo necesitan** | STATIKA ERP, Portal |
| **Riesgo** | 🟡 **Medio** — XML format must match CONTPAQi spec |
| **Peso estimado** | **40 KB** |
| **Recomendación** | ✅ **Incluir en packages/shared-export** |

---

### 12.2 Policy/Policy Summary Export

| Atributo | Valor |
|----------|-------|
| **Nombre** | Policy Summary Report |
| **Qué hace** | Genera resumen de póliza (líneas contables, totales) |
| **Archivos** | Distribuido en multiple places |
| **Dependencias** | Accounting calcs |
| **Estado** | 🟡 **Beta** |
| **Usable directo** | ⚠️ **Parcial** |
| **Recomendación** | 🔄 **Parcialmente reutilizar** — documentar template |

---

## 13. SEGURIDAD

### 13.1 RLS Row-Level Security

| Atributo | Valor |
|----------|-------|
| **Nombre** | Supabase RLS Policies |
| **Qué hace** | Controla acceso a datos por fila (company_id, user_id, role) |
| **Archivos** | Todas las 96 migrations |
| **Dependencias** | Supabase, auth.uid() |
| **Estado** | ✅ **Producción** |
| **Usable directo** | ✅ **Sí** — copiar pattern |
| **Convertible a paquete** | 📖 **Documentación** — no código |
| **Recomendación** | 📖 **Crear RLS template + checklist** |

---

### 13.2 CFDI Credentials Encryption

| Atributo | Valor |
|----------|-------|
| **Nombre** | Encrypted PAC Credentials Storage |
| **Qué hace** | Almacena credenciales de facturación encriptadas (SAT keys, PAC passwords) |
| **Archivos** | `supabase/migrations/20260706010000_cfdi_credentials_encryption.sql` |
| **Dependencias** | Supabase pgcrypto, encryption keys |
| **Estado** | ✅ **Producción** |
| **Usable directo** | ✅ **Sí** — copiar migration |
| **Convertible a paquete** | 📖 **Documentación** |
| **Apps que lo necesitan** | STATIKA ERP, Portal |
| **Riesgo** | 🟢 **Bajo** — Supabase pgcrypto is solid |
| **Recomendación** | 📖 **Documentar pattern** |

---

### 13.3 Audit Logging

| Atributo | Valor |
|----------|-------|
| **Nombre** | Diagnostic Logs & Audit Trail |
| **Qué hace** | Registra quién hizo qué y cuándo (created_by, updated_at) |
| **Archivos** | `supabase/migrations/20260702000001_diagnostic_logs.sql`, `apps/mobile/lib/logger.ts` |
| **Dependencias** | Timestamps, user tracking |
| **Estado** | ✅ **Producción** |
| **Usable directo** | ✅ **Sí** |
| **Convertible a paquete** | ✅ **Sí** — logging library |
| **Exponible como API** | ✅ **Sí** — query logs endpoint |
| **Apps que lo necesitan** | Todas |
| **Riesgo** | 🟢 **Bajo** |
| **Peso estimado** | **60 KB** |
| **Recomendación** | ✅ **Extraer a paquete** (`packages/shared-logging`) |

---

## 14. UI COMPONENTS

### 14.1 Recharts Integration

| Atributo | Valor |
|----------|-------|
| **Nombre** | Charts & KPI Visualizations |
| **Qué hace** | Line charts, bar charts, KPI cards, responsive layout |
| **Archivos** | `apps/web/components/`, `recharts@^2.10.0` |
| **Dependencias** | Recharts, React |
| **Estado** | ✅ **Producción** |
| **Usable directo** | ✅ **Sí** — usar Recharts SDK |
| **Convertible a paquete** | ✅ **Sí** — wrapper components |
| **Exponible como API** | ❌ **No** — es UI |
| **Apps que lo necesitan** | Portal, Agro, ERP |
| **Riesgo** | 🟢 **Bajo** |
| **Peso estimado** | **Incluido en Recharts** |
| **Recomendación** | ✅ **Crear shared UI library** (`packages/shared-ui`) con chart wrappers |

**Ejemplo (Agro Dashboard)**:
```typescript
import { KPICard, LineChart } from '@statika/shared-ui'

<KPICard title="Humedad Promedio" value="45%" trend="↑ 5%" />
<LineChart
  data={readings}
  dataKey="humidity"
  name="Humedad (%)"
  xAxisKey="timestamp"
/>
```

---

### 14.2 Modal & Sheet Patterns

| Atributo | Valor |
|----------|-------|
| **Nombre** | Modal/Sheet Components |
| **Qué hace** | Reusable modal, bottom sheet, overlay patterns |
| **Archivos** | `apps/mobile/app/supervisor/reembolsos/index.tsx` (Modal patterns) |
| **Dependencias** | React Native |
| **Estado** | ✅ **Producción** |
| **Usable directo** | ✅ **Sí** — copiar código |
| **Convertible a paquete** | ✅ **Sí** |
| **Recomendación** | ✅ **Extraer a packages/shared-ui-mobile** |

---

### 14.3 Loading States & Skeletons

| Atributo | Valor |
|----------|-------|
| **Nombre** | Loading States (Spinner, Skeleton, Fallback) |
| **Qué hace** | UX patterns para estados de carga |
| **Archivos** | Distribuido en components |
| **Dependencias** | React, CSS |
| **Estado** | ✅ **Producción** |
| **Usable directo** | ✅ **Sí** |
| **Convertible a paquete** | ✅ **Sí** |
| **Recomendación** | ✅ **Extraer a packages/shared-ui** |

---

### 14.4 Form Patterns

| Atributo | Valor |
|----------|-------|
| **Nombre** | Form Validation & Error Handling |
| **Qué hace** | React Hook Form + Zod integration |
| **Archivos** | `apps/web/lib/schemas.ts` |
| **Dependencias** | react-hook-form, zod |
| **Estado** | ✅ **Producción** |
| **Usable directo** | ✅ **Sí** |
| **Convertible a paquete** | ✅ **Sí** |
| **Recomendación** | ✅ **Documentar pattern** |

---

## 15. ANALYTICS / OBSERVABILIDAD

### 15.1 Structured Logging

| Atributo | Valor |
|----------|-------|
| **Nombre** | Logger with Levels (Info, Warn, Error) |
| **Qué hace** | Registra eventos con niveles, serializa para analysis |
| **Archivos** | `apps/mobile/lib/logger.ts` |
| **Dependencias** | console, remote logging (optional) |
| **Estado** | ✅ **Producción** |
| **Usable directo** | ✅ **Sí** |
| **Convertible a paquete** | ✅ **Sí** |
| **Exponible como API** | ✅ **Sí** — query logs endpoint |
| **Apps que lo necesitan** | Todas |
| **Riesgo** | 🟢 **Bajo** |
| **Peso estimado** | **50 KB** |
| **Recomendación** | ✅ **Extraer a packages/shared-logging** |

---

### 15.2 Error Tracking

| Atributo | Valor |
|----------|-------|
| **Nombre** | Error Logging & Reporting |
| **Qué hace** | Captura errores, stack traces, contexto |
| **Archivos** | Implícito en logger.ts |
| **Dependencias** | Sentry (si se implementa) |
| **Estado** | 🟡 **Beta** — manual logging, no Sentry |
| **Usable directo** | ✅ **Sí** |
| **Recomendación** | 🔄 **Mejorar con Sentry o similar** |

---

### 15.3 Performance Monitoring

| Atributo | Valor |
|----------|-------|
| **Nombre** | Performance Metrics |
| **Qué hace** | Rastrea latencies, slow queries, UI performance |
| **Archivos** | No implementado explícitamente |
| **Estado** | ❌ **No implementado** |
| **Recomendación** | 🚀 **Oportunidad** — cuando crezca a escala |

---

## MATRIZ CONSOLIDADA: RECOMENDACIONES

| Sistema | Estado | Usar Directo | Paquete | API | Riesgo | Recomendación |
|---------|--------|--------------|---------|-----|--------|--------------|
| **OCR Receipt** | ✅ Prod | ✅ | ✅ | ✅ | 🟡 Med | Exponer API |
| **GPS Tracking** | ✅ Prod | ✅ | ✅ | ❌ | 🟡 Med | Extraer paquete |
| **Offline Sync** | ✅ Prod | ✅ | ✅ | ❌ | 🟢 Low | Extraer paquete |
| **Auth** | ✅ Prod | ✅ | ⚠️ | ❌ | 🟢 Low | Usar directo |
| **RBAC** | ✅ Prod | ✅ | 📖 | ❌ | 🟡 Med | Documentar |
| **Excel Export** | ✅ Prod | ✅ | ✅ | ✅ | 🟢 Low | Extraer paquete |
| **SAT Formats** | ✅ Prod | ⚠️ | ✅ | ✅ | 🟡 Med | Extraer paquete |
| **WhatsApp** | ✅ Prod | ✅ | ✅ | ✅ | 🟡 Med | Exponer API |
| **Stripe** | ✅ Prod | ✅ | ✅ | ✅ | 🟡 Med | Extraer paquete |
| **Advisor IA** | 🟡 Beta | ⚠️ | ✅ | ✅ | 🟡 Med | Exponer API |
| **RLS Policies** | ✅ Prod | ✅ | 📖 | ❌ | 🟢 Low | Documentar |
| **Logging** | ✅ Prod | ✅ | ✅ | ✅ | 🟢 Low | Extraer paquete |
| **Charts** | ✅ Prod | ✅ | ✅ | ❌ | 🟢 Low | Extraer UI lib |
| **Modals** | ✅ Prod | ✅ | ✅ | ❌ | 🟢 Low | Extraer UI lib |

---

## RESUMEN: PRÓXIMOS PASOS

### Semana 1: Bajo Esfuerzo, Alto Impacto
- [ ] `packages/shared-sync` — Offline queue (80 KB)
- [ ] `packages/shared-export` — Excel + SAT formats (250 KB)
- [ ] `packages/shared-logging` — Logger (50 KB)
- [ ] `packages/shared-ui` — Charts + Modals (150 KB)

### Semana 2-3: APIs Centralizadas
- [ ] `POST /api/ocr-extract` — Gemini OCR wrapper
- [ ] `POST /api/whatsapp/send` — WhatsApp centralizado
- [ ] `POST /api/stripe/checkout` — Stripe checkout
- [ ] `POST /api/advisor/insights` — Advisor IA

### Mes 2: Documentación & Templates
- [ ] RLS Policy template + checklist
- [ ] Database migration template
- [ ] Edge Function auth middleware template

### Mes 3+: Cuando Otros Productos lo Pidan
- [ ] `packages/shared-gps` — Route tracking (si Agro lo necesita)
- [ ] `packages/shared-billing` — Usage-based (si Portal lo necesita)
- [ ] Advisor IA improvements (cuando tengas feedback)

---

**Registro Completado**: 2026-07-08  
**Próxima Revisión**: Cuando se integre el primer paquete externo
