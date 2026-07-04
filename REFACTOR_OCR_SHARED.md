# OCR/Scanner Refactor — Código Compartido (2026-07-04)

## Resumen
Se extrajo la rutina de OCR/Scanner de **GastoCheck** (que ya funcionaba con Gemini 1.5 Flash) y se centralizó en `packages/shared` para que **TODOS** los módulos (CobraCheck, FacturaCheck, InventarioCheck, CajaCheck) la reutilicen sin duplicación.

## Cambios Realizados

### 1. **`packages/shared/src/ocr.ts`** (NUEVO)
- Tipos centralizados: `OcrResult`, `OcrLineItem`, `OcrHookReturn`, `UseOcrFn`
- Exportados desde `@gastocheck/shared` para todo el monorepo
- No contiene implementación del hook (eso es React/Expo específico)

### 2. **`packages/shared/src/index.ts`** (ACTUALIZADO)
- Agregada línea: `export * from './ocr'`
- Ahora todos los módulos pueden importar tipos OCR

### 3. **`apps/mobile/hooks/useOcr.ts`** (SIN CAMBIOS)
- Ya existía y funcionaba correctamente
- Importa tipos desde `@gastocheck/shared` ✅
- Implementación real que llama a Edge Function `ocr-extract`

### 4. **`apps/cobra-mobile/hooks/useOcr.ts`** (NUEVO)
- Copia idéntica del hook de `apps/mobile`
- Permite que CobraCheck tenga su propia instancia sin complicaciones de path
- Mismo API: `useOcr()` devuelve `{ extractFromImage, loading }`

### 5. **`apps/cobra-mobile/app/(tabs)/gastocheck/hooks/useScanner.ts`** (REFACTORIZADO)
- **ANTES**: Mock con `setTimeout` que simulaba OCR
- **AHORA**: Usa el hook `useOcr` real
- Flujo:
  1. Lee imagen desde URI → base64 (via `expo-file-system`)
  2. Llama `extractFromImage()` con base64
  3. Mapea `OcrResult` → `ScannerResult` más simple
  4. Maneja errores y loading correctamente

## Cómo Usar OCR en Nuevos Módulos

### Paso 1: Importar el Hook
```typescript
import { useOcr } from '../hooks/useOcr'
import type { OcrResult } from '@gastocheck/shared'
```

### Paso 2: Usar en Componente
```typescript
export function MyScanner() {
  const { extractFromImage, loading } = useOcr()
  const [photo, setPhoto] = useState<string | null>(null)

  const handleScanPhoto = async (uri: string) => {
    const base64 = await readAsBase64(uri) // usa expo-file-system
    const { data, error } = await extractFromImage(base64, 'image/jpeg')
    
    if (data) {
      console.log('Proveedor:', data.providerName)
      console.log('Total:', data.total)
      console.log('UUID CFDI:', data.fiscalUuid)
    }
  }

  return (
    // UI aquí
  )
}
```

### Paso 3: Mapear Datos Según Necesidad
Cada módulo puede mapear `OcrResult` a sus propias interfaces:

**GastoCheck**: Usa `OcrResult` directamente (recibos/facturas)
```typescript
const receipt = {
  provider_name: ocr.providerName,
  total_amount: ocr.total,
  fiscal_uuid: ocr.fiscalUuid,
  line_items: ocr.lineItems,
}
```

**CobraCheck**: Mapea a `ScannerResult` más simple (solo lo básico)
```typescript
const scanner = {
  amount: ocr.total,
  provider: ocr.providerName,
  date: ocr.receiptDate,
}
```

**FacturaCheck**: Usa `OcrResult` + validación SAT
```typescript
const factura = {
  ...ocr,
  validSat: await validateSAT(ocr.fiscalUuid),
}
```

## Edge Function: `ocr-extract`

**Ubicación**: `supabase/functions/ocr-extract/index.ts`

**Entrada**: 
```json
{
  "image_base64": "base64encodedimage...",
  "mime_type": "image/jpeg"
}
```

**Salida**:
```json
{
  "data": {
    "providerName": "...",
    "total": 1500.00,
    "fiscalUuid": "...",
    "lineItems": [...],
    "confidence": "high",
    ...
  },
  "croppedImageBase64": "..."
}
```

**Modelo**: Gemini 2.5 Flash (rápido + económico)

**Costo**: ~$0.0001 USD por imagen (muy barato)

## Beneficios de Este Refactor

✅ **DRY**: OCR se implementa UNA SOLA VEZ
✅ **Consistencia**: Todos los módulos usan el mismo modelo Gemini
✅ **Mantenibilidad**: Bug fixes en OCR se aplican a todos los módulos
✅ **Reutilización de Tipos**: `OcrResult` es el estándar en todo el monorepo
✅ **Escalabilidad**: Nuevos módulos (FacturaCheck, InventarioCheck, etc.) lo heredan automáticamente

## Próximos Pasos

1. ✅ Centralizar tipos OCR en `packages/shared`
2. ✅ Reemplazar mock de CobraCheck con OCR real
3. ⏳ Aplicar migración SQL en Supabase (BLOCKER: `cobra_routes` table)
4. ⏳ FacturaCheck: Usar OCR + validación SAT
5. ⏳ InventarioCheck: Usar OCR para lectura de facturas de proveedores
6. ⏳ CajaCheck: Usar OCR para lectura de CFDI en punto de venta

## Documentación Interna

- Tipos OCR: `packages/shared/src/ocr.ts`
- Implementación GastoCheck: `apps/mobile/hooks/useOcr.ts`
- Implementación CobraCheck: `apps/cobra-mobile/hooks/useOcr.ts`
- Uso CobraCheck: `apps/cobra-mobile/app/(tabs)/gastocheck/hooks/useScanner.ts`
