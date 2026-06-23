# Integración: scan-document en GastoCheck

Guía paso a paso para integrar el escaneo de documentos OCR en tu app mobile.

## 1. Deployar la Edge Function

```bash
cd /path/to/gastocheck-app
npx supabase functions deploy scan-document
```

Verifica en Supabase Dashboard > Project > Functions que aparezca `scan-document`.

## 2. Configurar GEMINI_API_KEY

En Supabase Dashboard:
1. Ve a **Project Settings** > **Secrets** (abajo en el sidebar)
2. Click en **New Secret**
3. Name: `GEMINI_API_KEY`
4. Value: Tu clave de Google Gemini API (obtenida de [Google AI Studio](https://aistudio.google.com/app/apikey))

Verifica que aparezca con estado "Active".

## 3. Crear tabla `expenses` (si no existe)

```sql
-- Ejecuta en SQL Editor de Supabase

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  company_id UUID NOT NULL,
  amount NUMERIC(12, 2),
  date DATE,
  vendor_name TEXT,
  concept TEXT,
  vendor_rfc VARCHAR(13),
  receipt_image_base64 TEXT,
  status VARCHAR(50) DEFAULT 'draft', -- draft, pending_review, approved, rejected
  extracted_from_ocr BOOLEAN DEFAULT FALSE,
  extraction_confidence VARCHAR(10), -- high, medium, low
  extraction_warnings TEXT[], -- JSON array of warning strings
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para búsquedas rápidas
CREATE INDEX idx_expenses_user_id ON expenses(user_id);
CREATE INDEX idx_expenses_company_id ON expenses(company_id);
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_expenses_status ON expenses(status);

-- RLS Policy (ejemplo para ver solo los propios gastos)
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own expenses"
  ON expenses
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own expenses"
  ON expenses
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

## 4. Integrar en Cliente Mobile

### 4.1 Crear servicio `expenseOCR.ts`

```typescript
// apps/mobile/src/services/expenseOCR.ts

import { supabase } from '@/lib/supabase';

export interface ScannedDocument {
  amount: number | null;
  date: string | null;
  vendor: string | null;
  concept: string | null;
  rfc: string | null;
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
}

export async function scanDocumentImage(imageBase64: string): Promise<ScannedDocument> {
  const { data, error } = await supabase.functions.invoke('scan-document', {
    body: {
      image_base64: imageBase64,
      mime_type: 'image/jpeg',
    },
  });

  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || 'Escaneo falló');

  return data.data;
}

export async function saveScannedExpense(
  imageBase64: string,
  userId: string,
  companyId: string,
  overrides?: Partial<ScannedDocument>,
) {
  // 1. Escanear documento
  const scanned = await scanDocumentImage(imageBase64);

  // 2. Aplicar sobrescrituras manuales (si el usuario corrigió algo)
  const finalData = { ...scanned, ...overrides };

  // 3. Guardar en BD
  const { data: expense, error } = await supabase
    .from('expenses')
    .insert([
      {
        user_id: userId,
        company_id: companyId,
        amount: finalData.amount,
        date: finalData.date || new Date().toISOString().split('T')[0],
        vendor_name: finalData.vendor,
        concept: finalData.concept,
        vendor_rfc: finalData.rfc,
        receipt_image_base64: imageBase64,
        status: 'draft',
        extracted_from_ocr: true,
        extraction_confidence: scanned.confidence,
        extraction_warnings: scanned.warnings,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return { expense, scanned };
}
```

### 4.2 Crear Pantalla de Captura

```typescript
// apps/mobile/src/screens/CaptureExpenseScreen.tsx

import { Camera } from 'expo-camera';
import { scanDocumentImage, saveScannedExpense } from '@/services/expenseOCR';

export function CaptureExpenseScreen() {
  const [photo, setPhoto] = React.useState<any>(null);
  const [scanned, setScanned] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);
  const cameraRef = React.useRef<Camera>(null);

  const handleCapture = async () => {
    try {
      setLoading(true);
      const photo = await cameraRef.current?.takePictureAsync({ base64: true });

      if (!photo?.base64) return;

      // Escanear imagen
      const result = await scanDocumentImage(photo.base64);
      setScanned(result);
      setPhoto(photo);
    } catch (err) {
      Alert.alert('Error', 'No se pudo escanear el documento');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    try {
      setLoading(true);
      const { expense } = await saveScannedExpense(
        photo.base64,
        userId,
        companyId,
      );

      Alert.alert('✅ Éxito', 'Gasto registrado correctamente');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', 'No se pudo guardar el gasto');
    } finally {
      setLoading(false);
    }
  };

  if (scanned) {
    return (
      <ScrollView>
        <Text>Datos extraídos:</Text>
        <Text>Monto: ${scanned.amount} MXN</Text>
        <Text>Fecha: {scanned.date}</Text>
        <Text>Proveedor: {scanned.vendor}</Text>
        <Text>RFC: {scanned.rfc}</Text>
        <Text>Confianza: {scanned.confidence}</Text>

        {scanned.warnings.length > 0 && (
          <View style={{ backgroundColor: '#fff3cd', padding: 10 }}>
            <Text style={{ color: '#856404' }}>⚠️ Revisa manualmente:</Text>
            {scanned.warnings.map((w, i) => (
              <Text key={i} style={{ color: '#856404' }}>
                • {w}
              </Text>
            ))}
          </View>
        )}

        <Button
          title={loading ? 'Guardando...' : 'Confirmar y Guardar'}
          onPress={handleConfirm}
          disabled={loading}
        />
      </ScrollView>
    );
  }

  return (
    <View>
      <Camera ref={cameraRef} />
      <Button
        title={loading ? 'Escaneando...' : 'Capturar Gasto'}
        onPress={handleCapture}
        disabled={loading}
      />
    </View>
  );
}
```

### 4.3 Actualizar Navegación

En tu router (Expo Router), añade la pantalla:

```typescript
// apps/mobile/src/app/(tabs)/expenses/_layout.tsx

export default Stack.Navigator({
  screens: {
    list: 'Gastos',
    capture: 'Capturar Gasto', // ← Nueva
    detail: 'Detalle',
  },
});
```

## 5. Testing

### Test Local (Supabase CLI)

```bash
# Terminal 1: Iniciar Supabase local
supabase start

# Terminal 2: Deployar función localmente
supabase functions deploy scan-document --no-verify-jwt

# Terminal 3: Hacer POST
curl -X POST http://localhost:54321/functions/v1/scan-document \
  -H "Content-Type: application/json" \
  -d '{
    "image_base64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "mime_type": "image/jpeg"
  }'
```

### Test en Producción

```typescript
// En tu app:
const { data } = await supabase.functions.invoke('scan-document', {
  body: { image_base64: '...', mime_type: 'image/jpeg' },
});
console.log(data.data); // Resultado del OCR
```

## 6. Monitoreo y Debugging

### Ver logs de la Edge Function

```bash
supabase functions logs scan-document
```

### Casos comunes de error

| Error | Causa | Solución |
|-------|-------|----------|
| `GEMINI_API_KEY no configurada` | Secret no existe en Supabase | Añade en Project Settings > Secrets |
| `Gemini API falló` | Clave inválida o cuota agotada | Verifica la clave en [Google AI Studio](https://aistudio.google.com) |
| `JSON truncado` | Respuesta muy larga | Reduce la complejidad de la imagen o limpia los datos |
| `Baja confianza` | Imagen borrosa o ilegible | Mejora iluminación o pide al usuario reintente |

## 7. Optimizaciones Futuras

### 7.1 Compresión de Imagen Antes de Enviar

```typescript
import * as ImageManipulator from 'expo-image-manipulator';

async function compressImage(base64: string) {
  const result = await ImageManipulator.manipulateAsync(
    `data:image/jpeg;base64,${base64}`,
    [{ resize: { width: 800, height: 600 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  );
  // Extraer base64 sin prefijo
  return result.base64 || base64;
}
```

### 7.2 Cache de Respuestas Anteriores

```typescript
// Evitar escanear la misma imagen 2 veces
const scannedCache = new Map<string, ScannedDocument>();

export async function scanWithCache(base64: string): Promise<ScannedDocument> {
  const hash = sha256(base64);
  if (scannedCache.has(hash)) {
    return scannedCache.get(hash)!;
  }

  const result = await scanDocumentImage(base64);
  scannedCache.set(hash, result);
  return result;
}
```

### 7.3 Batch Processing (Múltiples Fotos)

```typescript
export async function processBatchReceipts(images: string[]) {
  const results = await Promise.allSettled(
    images.map(img => scanDocumentImage(img))
  );

  return {
    success: results
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<ScannedDocument>).value),
    failed: results.filter(r => r.status === 'rejected').length,
  };
}
```

## 8. Seguridad

✅ **Hacer en producción:**
- La imagen base64 se almacena en `receipt_image_base64` — considera encriptarla antes de guardar
- Usa RLS policies para restringir acceso a datos sensibles
- Valida que `user_id` coincida con `auth.uid()`
- Implementa rate limiting en la Edge Function

❌ **No hacer:**
- Exponer GEMINI_API_KEY en el cliente
- Almacenar imágenes sin encriptación
- Permitir acceso a gastos de otros usuarios

## 9. Soporte

**Preguntas frecuentes:**

Q: ¿Qué tipos de archivo soporta?  
A: JPEG, PNG, WebP, GIF. Usa `mime_type` correspondiente.

Q: ¿Qué tan grande puede ser la imagen?  
A: Hasta 20 MB (límite de Gemini). Comprime si es necesario.

Q: ¿Funciona sin conexión?  
A: No. Requiere conexión para llamar a Gemini. Guarda la foto localmente y escanea cuando hay conexión.

Q: ¿Se almacenan las imágenes en Google?  
A: Según [política de Gemini](https://ai.google.dev/), Google puede usar imágenes para entrenar modelos (opt-out con config). Usa `receipt_image_base64` local si prefieres privacidad.
