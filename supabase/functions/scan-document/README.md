# scan-document — Escaneo de Documentos con Gemini Vision

Edge Function de Supabase para leer tickets y facturas usando Google Gemini 2.5 Flash.

## Características

- **Modelo**: Gemini 2.5 Flash (visión por IA, temperatura 0.1 para máxima precisión)
- **Extrae**: monto, fecha, proveedor, concepto, RFC
- **Salida**: JSON estructurado con confianza y advertencias
- **Validación automática**: RFC, fecha, montos
- **Uso dual**: HTTP POST o importación TypeScript directa

## Deployar

```bash
npx supabase functions deploy scan-document
```

## Requisitos Previos

- Variable de entorno: `GEMINI_API_KEY` configurada en Supabase Secrets
- Imagen del documento en base64 (sin prefijo `data:image/...`)

## Uso HTTP (POST)

```bash
curl -X POST https://your-project.supabase.co/functions/v1/scan-document \
  -H "Content-Type: application/json" \
  -d '{
    "image_base64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "mime_type": "image/jpeg"
  }'
```

### Response

```json
{
  "ok": true,
  "data": {
    "amount": 250.50,
    "date": "2026-06-23",
    "vendor": "OXXO San Pedro",
    "concept": "Gasolina premium + bebidas",
    "rfc": "OXX120101ABC",
    "confidence": "high",
    "warnings": []
  }
}
```

## Uso TypeScript (Importación Directa)

```typescript
import { scanDocument } from 'https://your-project.supabase.co/functions/v1/scan-document';

const imageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const result = await scanDocument(imageBase64);

console.log(`Monto: $${result.amount} MXN`);
console.log(`Proveedor: ${result.vendor}`);
console.log(`RFC: ${result.rfc}`);
console.log(`Confianza: ${result.confidence}`);
```

## Estructura de Salida

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `amount` | `number \| null` | Monto total en MXN (ej: 250.50) |
| `date` | `string \| null` | Fecha en formato YYYY-MM-DD |
| `vendor` | `string \| null` | Nombre del proveedor/comerciante |
| `concept` | `string \| null` | Descripción breve del gasto (max 100 chars) |
| `rfc` | `string \| null` | RFC del emisor (validado contra SAT) |
| `confidence` | `"high" \| "medium" \| "low"` | Nivel de confianza en los datos extraídos |
| `warnings` | `string[]` | Lista de problemas detectados |

## Niveles de Confianza

- **high**: Monto, fecha y proveedor legibles con claridad
- **medium**: 2 de los 3 campos principales son claros
- **low**: Imagen borrosa, ilegible, cortada, o datos incompletos

## Validaciones Automáticas

✅ RFC: Formato SAT (3-4 letras + 6 dígitos + 3 alfanuméricos)  
✅ Fecha: Formato YYYY-MM-DD  
✅ Monto: Número válido  
✅ Vendor/Concept: String limpio  

Cualquier validación fallida → `null` + advertencia en `warnings[]`

## Casos de Uso

- **Captura de gastos**: Usuario fotografía ticket → Edge Function → registro en BD
- **Automatización contable**: Procesar lotes de recibos automáticamente
- **Validación de pólizas**: Confirmar datos antes de registrar en SAT
- **Auditoría**: Leer documentación soporte sin intervención manual

## Notas Técnicas

- Usa `responseMimeType: 'application/json'` + `responseSchema` para JSON estructurado
- `temperature: 0.1` para máxima precisión (no creatividad)
- Soporta JPEG, PNG, WebP, GIF
- Timeout: 30s (heredado de Deno Edge Functions)
- CORS habilitado para cualquier origen

## Troubleshooting

**"GEMINI_API_KEY no configurada"**
→ Añade la variable en Supabase Dashboard > Project Settings > Secrets > Edge Function Secrets

**"Baja confianza"**
→ Mejora la iluminación, asegura que el documento esté completo y legible

**"RFC con formato inválido"**
→ El RFC podría estar ilegible o mal leído; requiere validación manual

## Próximas Mejoras

- [ ] OCR de múltiples líneas (lineItems)
- [ ] Extracción de UUID CFDI
- [ ] Detección de IEPS, ISH, retenciones
- [ ] Batch processing (múltiples imágenes)
