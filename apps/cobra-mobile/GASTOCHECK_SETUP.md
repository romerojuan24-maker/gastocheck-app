# GastoCheck Mobile - Setup & Integration

## Archivos Creados

### 1. Componente Principal
**Ruta:** `apps/cobra-mobile/app/(tabs)/gastocheck/index.tsx`

Pantalla completa "Mi Ruta" con:
- Lista de clientes optimizados
- Detalles del cliente (tap para abrir modal)
- Scanner de tickets (Gemini Vision)
- Formulario de captura de movimientos (pagó/no pagó/promesa)
- Reporte diario con depósitos

### 2. Hooks Personalizados
**Ruta:** `apps/cobra-mobile/hooks/useGastoCheck.ts`

Hooks reutilizables:
- `useRoute(actorId, date)` - Cargar ruta del día
- `useScanner(imageUri)` - Analizar fotos con Gemini
- `useMovementCapture()` - Registrar intentos de cobro
- `useDailyReport()` - Generar reporte diario
- `useMovementsByDate()` - Obtener movimientos del día
- `useCashDeposits()` - Obtener depósitos de efectivo

### 3. Tests
**Ruta:** `apps/cobra-mobile/app/(tabs)/gastocheck/index.test.tsx`

Suite de tests con:
- Rendering de componentes
- Lógica de hooks
- Interacciones de usuario (tap, form submit)
- Mocking de Expo libraries y Supabase

### 4. Documentación Completa
**Ruta:** `docs/GASTOCHECK_MOBILE_RUTA.md`

Incluye:
- Descripción de componentes
- Especificación de hooks
- Tablas SQL necesarias
- RLS policies
- Flujo de usuario paso a paso
- Migraciones SQL
- Estilos y colores

---

## Instalación & Setup

### 1. Copiar Archivos
```bash
# Ya están creados en:
# apps/cobra-mobile/app/(tabs)/gastocheck/index.tsx
# apps/cobra-mobile/hooks/useGastoCheck.ts
# docs/GASTOCHECK_MOBILE_RUTA.md
```

### 2. Instalar Dependencias Necesarias
```bash
cd apps/cobra-mobile

# Ya debería estar instalado
npm install expo-location expo-image-picker expo-linking

# Agregar si falta:
npm install @react-native-camera-roll/camera-roll
npm install react-native-safe-area-context
```

### 3. Crear Tablas en Supabase
Ejecutar el archivo de migración SQL:

```sql
-- Copiar contenido de: docs/GASTOCHECK_MOBILE_RUTA.md
-- Sección: "Migraciones SQL"
-- Pegarlo en: Supabase → SQL Editor → "New Query" → Ejecutar
```

**Tablas que se crean:**
- `daily_routes` - Ruta optimizada diaria
- `cobra_movements` - Intentos de cobro
- `cobra_daily_reports` - Reportes diarios
- `cobra_cash_deposits` - Depósitos de efectivo

### 4. Configurar RLS Policies
En Supabase → Authentication → Policies, agregar:

```sql
-- Para daily_routes
ALTER TABLE daily_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cobrador ve su propia ruta" ON daily_routes FOR SELECT
USING (auth.uid() = (SELECT auth_id FROM company_members WHERE id = actor_id));

-- Para cobra_movements
ALTER TABLE cobra_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cobrador crea sus movimientos" ON cobra_movements FOR INSERT
WITH CHECK (auth.uid() = (SELECT auth_id FROM company_members WHERE id = actor_id));

-- (Ver sección "RLS Policies" en GASTOCHECK_MOBILE_RUTA.md para todas)
```

### 5. Implementar Gemini Vision API
**Backend endpoint necesario:**

```typescript
// backend/routes/api/vision.ts

import Anthropic from "@anthropic-ai/sdk";
import express from "express";

const router = express.Router();
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

router.post("/scan", async (req, res) => {
  try {
    const { image, language = "es" } = req.body;

    // Validar imagen base64
    if (!image || !image.startsWith("data:image")) {
      return res.status(400).json({ error: "Imagen inválida" });
    }

    // Llamar a Claude Vision
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: image.split(",")[1], // Remover "data:image/jpeg;base64,"
              },
            },
            {
              type: "text",
              text: `Analiza esta imagen de un ticket/comprobante. Extrae en ${language}:
              1. MONTO: número total a pagar (sin símbolo de moneda)
              2. FECHA: fecha del documento (formato YYYY-MM-DD)
              3. EMPRESA: nombre de la empresa/proveedor
              
              Responde SOLO con JSON válido, sin explicaciones:
              {
                "amount": 1500.50,
                "date": "2026-06-23",
                "provider": "NOMBRE EMPRESA",
                "confidence": 0.95,
                "raw_text": "texto extraído del documento"
              }
              
              Si no puedes extraer algún dato, usa null.
              confidence: 0.0 a 1.0 (qué tan seguro estás)`,
            },
          ],
        },
      ],
    });

    // Parsear respuesta
    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    res.json({
      amount: result.amount,
      date: result.date,
      provider: result.provider,
      confidence: result.confidence || 0.5,
      raw_text: result.raw_text,
    });
  } catch (error: any) {
    console.error("Vision error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

**En el hook, reemplazar simulación:**

```typescript
export function useScanner(imageUri: string | null): UseScannerResult {
  const scanImage = useCallback(async (uri: string) => {
    try {
      setLoading(true);
      setError(null);

      // 1. Convertir imagen a base64
      const response = await fetch(uri);
      const blob = await response.blob();
      const reader = new FileReader();

      reader.onloadend = async () => {
        const base64 = reader.result as string;

        // 2. Llamar a backend
        const scanRes = await fetch("/api/vision/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: base64,
            language: "es",
          }),
        });

        const result = await scanRes.json();
        setResult(result);
      };

      reader.readAsDataURL(blob);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ... resto del hook
}
```

---

## Integraciones Necesarias

### 1. Google Maps
**Android (AndroidManifest.xml):**
```xml
<meta-data
  android:name="com.google.android.geo.API_KEY"
  android:value="AIzaSyD..." />
```

**iOS (Info.plist):**
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Necesitamos tu ubicación para mostrar la ruta</string>
```

### 2. Permisos de Cámara
**app.json:**
```json
{
  "plugins": [
    [
      "expo-camera",
      {
        "cameraPermission": "Necesitamos acceso a la cámara para escanear tickets"
      }
    ],
    [
      "expo-location",
      {
        "locationAlwaysAndWhenInUsePermission": "Necesitamos tu ubicación para la ruta"
      }
    ]
  ]
}
```

### 3. Variables de Entorno
**.env.local:**
```
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=xxx
EXPO_PUBLIC_API_URL=https://backend.app/api
```

---

## Datos Mock para Testing

### Crear datos de prueba en Supabase:

```sql
-- 1. Crear empresa de prueba
INSERT INTO companies (name, logo_url) VALUES ('Test Company', 'https://...')
RETURNING id AS company_id;

-- 2. Crear cobrador
INSERT INTO company_members (
  company_id, member_name, email, role, auth_id
) VALUES (
  'company-id',
  'Juan Cobrador',
  'juan@test.com',
  'cobrador',
  'auth-id'
)
RETURNING id AS actor_id;

-- 3. Crear clientes
INSERT INTO cobra_clients (
  company_id, name, lat, lng, address, phone, office_hours
) VALUES
  ('company-id', 'Empresa XYZ', 25.6866, -100.3161, 'Calle Principal 123', '+52 81 1234 5678', 'Lun-Vie 8am-6pm'),
  ('company-id', 'Negocio ABC', 25.6900, -100.3200, 'Avenida Reforma 456', '+52 81 2345 6789', 'Lun-Sab 9am-7pm'),
  ('company-id', 'Tienda 123', 25.6800, -100.3000, 'Centro Comercial', '+52 81 3456 7890', 'Lun-Dom 10am-10pm')
RETURNING id, name;

-- 4. Crear facturas pendientes
INSERT INTO cobra_invoices (
  company_id, client_id, folio, amount, issue_date, due_date, status
) VALUES
  ('company-id', 'client-id-1', 'INV-001', 5000, '2026-06-01', '2026-06-30', 'pending'),
  ('company-id', 'client-id-1', 'INV-002', 2500, '2026-06-10', '2026-06-30', 'pending'),
  ('company-id', 'client-id-1', 'INV-003', 1500, '2026-06-15', '2026-07-15', 'pending'),
  ('company-id', 'client-id-2', 'INV-004', 8000, '2026-06-05', '2026-06-30', 'pending'),
  ('company-id', 'client-id-3', 'INV-005', 3000, '2026-06-12', '2026-07-12', 'pending');

-- 5. Crear ruta del día
INSERT INTO daily_routes (
  company_id, actor_id, route_date, client_id, sequence, distance_km, eta_minutes, status
) VALUES
  ('company-id', 'actor-id', '2026-06-23', 'client-id-1', 1, 2.5, 8, 'pending'),
  ('company-id', 'actor-id', '2026-06-23', 'client-id-2', 2, 5.2, 15, 'pending'),
  ('company-id', 'actor-id', '2026-06-23', 'client-id-3', 3, 8.7, 22, 'pending');
```

---

## Flujo de Desarrollo

### Fase 1: Setup Básico
- [ ] Copiar archivos
- [ ] Instalar dependencias
- [ ] Crear tablas SQL
- [ ] Configurar RLS

### Fase 2: Testing Local
- [ ] Probar carga de ruta
- [ ] Probar navegación entre modals
- [ ] Verificar estilos responsive
- [ ] Test de entrada de datos

### Fase 3: Integración Backend
- [ ] Implementar `/api/vision/scan`
- [ ] Conectar useScanner a API real
- [ ] Test de escaneo de fotos
- [ ] Validación de datos

### Fase 4: Optimización
- [ ] Geofencing para cliente cercano
- [ ] Sincronización offline
- [ ] Notificaciones push
- [ ] Caché de datos

---

## Debugging

### Logs de Hook
```typescript
// En useRoute, useScanner, etc.
useEffect(() => {
  console.log('Route data:', route);
  console.log('Loading:', loading);
  console.log('Error:', error);
}, [route, loading, error]);
```

### Inspeccionar DB en Supabase
```
Supabase Dashboard → SQL Editor → SELECT * FROM cobra_movements;
```

### Test de Componentes
```bash
npm test -- index.test.tsx --watch
```

---

## Performance Tips

1. **FlatList vs ScrollView**: RouteList usa FlatList con `scrollEnabled={false}` para integrar en ScrollView padre
2. **Memoización**: Componentes modales pueden usar `React.memo()` para evitar re-renders
3. **Imágenes**: Usar `Image.cache()` para caché de preview
4. **Debouncing**: En inputs largos (notas), debounce el estado

---

## Próximas Funcionalidades

1. **Geofencing**: Alertar cuando llega a cliente
2. **Rutas en Mapa**: Mostrar ruta completa en mapa interactivo
3. **Recordatorios**: Notificaciones cuando se aproxima hora de cierre
4. **Fotos de Prueba**: Capturar fotos del lugar de visita
5. **Sincronización Offline**: Guardar localmente, sincronizar al conectar
6. **Reportes PDF**: Generar PDF de reporte para email
7. **Integración WhatsApp**: Enviar reporte a supervisor por WhatsApp Business

---

## URLs de Referencia

- [Expo Documentation](https://docs.expo.dev)
- [React Native StyleSheet](https://reactnative.dev/docs/stylesheet)
- [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)
- [Google Maps API](https://developers.google.com/maps)
- [Anthropic Claude Vision](https://docs.anthropic.com/vision/vision-intro)

---

## Soporte

Para preguntas o issues:
1. Revisar `docs/GASTOCHECK_MOBILE_RUTA.md`
2. Revisar tests en `index.test.tsx`
3. Chequear logs en `useGastoCheck.ts`
4. Inspeccionar base de datos en Supabase Dashboard
