# Arquitectura: scan-document Edge Function

## Visión General

`scan-document` es una Edge Function de Supabase que procesa imágenes de documentos (tickets/facturas) usando Google Gemini 2.5 Flash Vision y extrae 5 campos clave para automatizar la captura de gastos.

```
┌─────────────────┐
│  App Mobile     │
│  (Expo React)   │
└────────┬────────┘
         │ POST /scan-document
         │ { image_base64, mime_type }
         │
         ▼
┌─────────────────────────────────┐
│   Supabase Edge Function        │
│   (Deno Runtime)                │
├─────────────────────────────────┤
│  1. Recibe imagen en base64     │
│  2. Invoca Gemini 2.5 Flash     │
│  3. Parse respuesta JSON        │
│  4. Valida RFC, fecha, montos   │
│  5. Retorna { amount, date,...} │
└────────┬────────────────────────┘
         │
         ▼
┌──────────────────────────┐
│  Google Gemini API       │
│  (Cloud Vision + LLM)    │
│  modelo: gemini-2.5-flash
└──────────────────────────┘
         │ Analiza imagen
         │
         ▼
┌──────────────────────────┐
│   Respuesta JSON         │
│   (Structured Output)    │
└──────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│   Edge Function (cont.)         │
│   Validación + Normalización    │
├─────────────────────────────────┤
│  • RFC: validar formato SAT     │
│  • Date: validar YYYY-MM-DD     │
│  • Amount: parseNumber          │
│  • Vendor/Concept: trim + clean │
│  • Confidence: high/medium/low  │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│   Response (CORS-habilitado)    │
│   {                             │
│     "ok": true,                 │
│     "data": {                   │
│       "amount": 250.50,         │
│       "date": "2026-06-23",     │
│       "vendor": "OXXO",         │
│       "concept": "Gasolina",    │
│       "rfc": "OXX123456ABC",    │
│       "confidence": "high",     │
│       "warnings": []            │
│     }                           │
│   }                             │
└─────────────────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│   Cliente App                │
│   (Procesar respuesta)       │
│   • Mostrar datos            │
│   • Permitir edición manual  │
│   • Guardar en BD            │
└──────────────────────────────┘
```

## Componentes

### 1. **Función Principal: `scanDocument()`**

```typescript
export async function scanDocument(imageBase64: string): Promise<ScannedDocument>
```

**Responsabilidades:**
- Validar que `imageBase64` no sea vacío
- Validar que `GEMINI_API_KEY` esté configurada
- Delegar a `extractDocumentData()`

**Uso exportado (sin HTTP):**
```typescript
import { scanDocument } from 'https://project.supabase.co/functions/v1/scan-document';
const result = await scanDocument(base64);
```

### 2. **Extracción: `extractDocumentData()`**

Procesa la imagen con Gemini 2.5 Flash:

1. **Prompt cuidadosamente diseñado:**
   - Instruye al modelo a responder SOLO con JSON
   - Define exactamente los 5 campos esperados
   - Explica reglas de validación (RFC, fecha, montos)
   - Especifica niveles de confianza

2. **Configuración de Gemini:**
   - `model`: `gemini-2.5-flash` (rápido, económico, visión)
   - `temperature`: 0.1 (máxima precisión, sin creatividad)
   - `maxOutputTokens`: 1024 (suficiente para 5 campos)
   - `responseMimeType`: `application/json` (JSON estructurado)
   - `responseSchema`: Define la estructura esperada

3. **Manejo de respuesta:**
   - Try-catch para 3 estrategias de parseo (JSON limpio → strip markdown → regex)
   - Si todo falla, retorna objeto vacío con warnings

### 3. **Validación: Normalización automática**

Después de parsear JSON, se validan:

| Campo | Validación | Si falla |
|-------|-----------|---------|
| `amount` | `typeof === 'number'` | `null` + warning |
| `date` | Regex: `YYYY-MM-DD` | `null` + warning |
| `vendor` | String válido | Trim + null si vacío |
| `concept` | String válido | Trim + null si vacío |
| `rfc` | Regex SAT (3-4 letras + 6 dígitos + 3 alfanuméricos) | `null` + warning |
| `confidence` | Enum: high/medium/low | Default a "low" |
| `warnings` | Array válido | Default: `[]` |

### 4. **Handler HTTP: Deno.serve()**

```typescript
Deno.serve(async (req) => { ... })
```

**Flujo:**
1. OPTIONS → CORS headers (preflight)
2. POST → Recibe JSON, invoca `scanDocument()`, retorna respuesta
3. Otro método → 405 Method Not Allowed

**Request:**
```json
{
  "image_base64": "iVBORw0KGgo...",
  "mime_type": "image/jpeg"
}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "amount": 250.50,
    "date": "2026-06-23",
    "vendor": "OXXO San Pedro",
    "concept": "Gasolina premium",
    "rfc": "OXX120101ABC",
    "confidence": "high",
    "warnings": []
  }
}
```

## Interfaces TypeScript

### `ScannedDocument`

```typescript
interface ScannedDocument {
  amount: number | null;           // Monto total en MXN
  date: string | null;             // YYYY-MM-DD
  vendor: string | null;           // Nombre del proveedor
  concept: string | null;          // Descripción del gasto (max 100 chars)
  rfc: string | null;              // RFC formato SAT
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];              // Lista de problemas detectados
}
```

## Flujo de Datos Completo

### Entrada (Request)
```
Cliente → base64(imagen) → Edge Function
```

### Procesamiento
```
1. Base64 → Gemini API
2. Gemini → Analiza imagen
3. Respuesta JSON (structured output)
4. Parse JSON
5. Validación/normalización de cada campo
6. Construcción de ScannedDocument
```

### Salida (Response)
```
Edge Function → Response JSON → Cliente → Mostrar/Guardar en BD
```

## Niveles de Confianza

- **high**: Monto, fecha y proveedor completamente legibles y claros
- **medium**: 2 de los 3 campos principales se leen claramente
- **low**: Imagen borrosa, ilegible, cortada, o datos incompletos

## Validaciones Críticas

### RFC (3-4 letras + 6 dígitos + 3 alfanuméricos)

**Válido:**
- `OXX120101ABC` (Persona Moral: 3 letras)
- `ABCD123456XYZ` (Persona Física: 4 letras)
- `GISA590101D82` (Gobierno)

**Inválido:**
- `ABC12345XYZ` (solo 5 dígitos)
- `12345678ABC` (comienza con números)
- `ABC-12-34-56-XYZ` (con guiones)

### Fecha (YYYY-MM-DD)

**Válido:**
- `2026-06-23`
- `2020-01-01`

**Inválido:**
- `06/23/2026` (formato americano)
- `23-06-2026` (formato europeo)
- `2026/6/23` (con slash)

### Monto

- Debe ser `number` (parseado de string por Gemini)
- Puede tener decimales: `250.50`
- Sin símbolo de moneda: `250` (no `$250`)

## Performance

| Métrica | Valor | Notas |
|---------|-------|-------|
| Tiempo total | ~2-3s | Incluye latencia Gemini |
| Tokens Gemini | ~500-800 | Imagen + prompt + respuesta |
| Tamaño imagen | Hasta 20 MB | Límite Gemini API |
| Caché | No (stateless) | Cada invocación es nueva |

## Seguridad

✅ **Implementado:**
- CORS headers (permite requests desde cualquier origen)
- Validación de entrada (image_base64 requerido)
- Manejo de errores (no expone stack traces)
- Normalización de datos (evita inyección SQL)

⚠️ **Consideraciones:**
- `GEMINI_API_KEY` se guarda en Supabase Secrets (no en cliente)
- Imágenes base64 pueden ser grandes (~1-5 MB) — considera compresión en cliente
- Si almacenas imágenes, encríptalo antes (privacidad)

## Debugging

### Logs disponibles

```bash
supabase functions logs scan-document
```

Las funciones loguean:
- `finishReason` (STOP, MAX_TOKENS, etc.)
- Longitud del texto procesado
- Errores de parseo JSON
- Estrategia de parseo utilizada

### Error handling

**Gemini API falla:**
```
Error: Gemini API falló: { error details }
→ Retorna 502 Bad Gateway
```

**JSON inválido:**
```
Intenta 3 estrategias:
1. Parse directo
2. Strip markdown
3. Regex extraction
Si todas fallan → objeto vacío + warnings[]
```

**Validación fallida:**
```
Campo inválido → null + warning agregado
Ejemplo: RFC "ABC12345XYZ" → null + "RFC con formato inválido: ABC12345XYZ"
```

## Extensiones Futuras

### Gemini 2.0 (en beta)
Si Google publica Gemini 2.0, actualiza el modelo en `GEMINI_URL`:
```typescript
// Cambiar de:
'https://...gemini-2.5-flash:generateContent'
// A:
'https://...gemini-2-0:generateContent'
```

### Line Items (Productos)
Expansión para extraer detalles de líneas:
```typescript
interface ScannedDocument {
  // ... campos actuales
  lineItems?: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
}
```

### UUID CFDI
Extraer folio fiscal para validación SAT:
```typescript
interface ScannedDocument {
  // ... campos actuales
  fiscalUuid?: string; // UUID CFDI timbrado
}
```

### Batch Processing
Procesar múltiples imágenes en paralelo (requiere compilación en cliente):
```typescript
export async function scanBatch(images: string[]): Promise<ScannedDocument[]> {
  return Promise.all(images.map(scanDocument));
}
```

## Comparativa con `ocr-extract`

| Aspecto | `scan-document` | `ocr-extract` |
|---------|-----------------|---------------|
| **Campos** | 5 (monto, fecha, proveedor, concepto, RFC) | 15+ (incluye impuestos, UUID, lineItems) |
| **Objetivo** | Captura rápida de gastos | Extracción contable completa |
| **Complejidad** | Baja (prompt simple) | Alta (prompt detallado) |
| **Tiempo** | ~2s | ~3s |
| **Casos de uso** | App mobile, reembolsos rápidos | Facturación, auditoría SAT |
| **RFC solo** | Sí | Sí |
| **UUID CFDI** | No | Sí |
| **IEPS, ISH** | No | Sí |

## Conclusión

`scan-document` es una función ligera, rápida y enfocada que transforma imágenes en datos estructurados, permitiendo que los usuarios capturen gastos fotografiando documentos. Su validación automática y niveles de confianza ayudan a mantener integridad de datos sin intervención manual.

Para casos más complejos (auditoría contable, detalles de líneas, validación SAT), usa `ocr-extract`.
