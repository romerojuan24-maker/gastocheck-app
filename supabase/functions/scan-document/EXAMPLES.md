# Ejemplos de Uso: scan-document

## Caso 1: Ticket OXXO Claro

### Input
```bash
POST /scan-document
{
  "image_base64": "iVBORw0KGgoAAAANS...",
  "mime_type": "image/jpeg"
}
```

### Imagen (simulada)
```
╔════════════════════════════╗
║       OXXO SAN PEDRO       ║
║   RFC: OXX120101ABC        ║
║                            ║
║ Gasolina Premium   150.00  ║
║ Bebida 600ml        35.50  ║
║ Papas Fritas        25.00  ║
║                            ║
║ Subtotal:          210.50  ║
║ IVA (16%):          33.68  ║
║ Total:             244.18  ║
║                            ║
║ Fecha: 2026-06-23         ║
║ Hora: 14:30                ║
║ Folio: 001234             ║
╚════════════════════════════╝
```

### Response (Confianza: HIGH)
```json
{
  "ok": true,
  "data": {
    "amount": 244.18,
    "date": "2026-06-23",
    "vendor": "OXXO SAN PEDRO",
    "concept": "Gasolina + bebidas + snacks",
    "rfc": "OXX120101ABC",
    "confidence": "high",
    "warnings": []
  }
}
```

---

## Caso 2: Factura Digital CFDI (PDF/Imagen)

### Input
```bash
POST /scan-document
{
  "image_base64": "iVBORw0KGgoAAAANS...",
  "mime_type": "image/jpeg"
}
```

### Imagen simulada
```
╔═══════════════════════════════════════════════╗
║  FACTURA ELECTRÓNICA CFDi v4.0               ║
║  RFC EMISOR: ABC123456XYZ                     ║
║  Nombre: ABC Corp S.A. de C.V.                ║
║  Domicilio: Calle Falsa 123, CDMX             ║
║                                               ║
║  RECEPTOR:                                    ║
║  RFC: GENERICO001001GAT                       ║
║                                               ║
║  CONCEPTOS:                                   ║
║  Servicio de Consultoría        15,000.00     ║
║                                               ║
║  Subtotal:                      15,000.00     ║
║  IVA (16%):                      2,400.00     ║
║  Total:                         17,400.00     ║
║                                               ║
║  Fecha de emisión: 2026-06-21                ║
║  UUID: 550e8400-e29b-41d4-a716...             ║
╚═══════════════════════════════════════════════╝
```

### Response (Confianza: HIGH)
```json
{
  "ok": true,
  "data": {
    "amount": 17400.00,
    "date": "2026-06-21",
    "vendor": "ABC Corp S.A. de C.V.",
    "concept": "Servicio de Consultoría",
    "rfc": "ABC123456XYZ",
    "confidence": "high",
    "warnings": []
  }
}
```

---

## Caso 3: Ticket Borroso (Confianza: MEDIUM)

### Imagen simulada
```
╔════════════════════════╗
║  ██████ [BORROSO]      ║
║  ██████ ██████         ║
║                        ║
║  Producto        XX.XX ║
║  Producto        XX.XX ║ ← No se lee bien
║  ██████████            ║
║                        ║
║  Total:      345.XX    ║
║  Fecha: 2026-06-??     ║ ← Día ilegible
╚════════════════════════╝
```

### Response (Confianza: MEDIUM)
```json
{
  "ok": true,
  "data": {
    "amount": 345.00,
    "date": null,
    "vendor": "COMERCIO DESCONOCIDO",
    "concept": "Productos varios",
    "rfc": null,
    "confidence": "medium",
    "warnings": [
      "Fecha ilegible — no se pudo extraer fecha completa",
      "RFC no visible en la imagen",
      "Imagen parcialmente borrosa — revisa manualmente"
    ]
  }
}
```

---

## Caso 4: Foto Muy Oscura (Confianza: LOW)

### Imagen
```
╔═══════════════════════════╗
║ ███████████████████████   ║
║ ███████████████████████   ║ ← Muy oscura
║ ███████████████████████   ║
║ ███████████████████████   ║
╚═══════════════════════════╝
```

### Response (Confianza: LOW)
```json
{
  "ok": true,
  "data": {
    "amount": null,
    "date": null,
    "vendor": null,
    "concept": null,
    "rfc": null,
    "confidence": "low",
    "warnings": [
      "Imagen demasiado oscura — no se pueden leer los datos",
      "Baja confianza — revisa manualmente",
      "No se detectaron datos principales (monto, proveedor, fecha)"
    ]
  }
}
```

---

## Caso 5: RFC con Formato Inválido

### Imagen simulada
```
╔════════════════════════╗
║  Comercio X            ║
║  RFC: ABC-123-456-XYZ  ║ ← Formato incorrecto
║  Total: 500.00         ║
║  Fecha: 2026-06-23     ║
╚════════════════════════╝
```

### Response
```json
{
  "ok": true,
  "data": {
    "amount": 500.00,
    "date": "2026-06-23",
    "vendor": "Comercio X",
    "concept": null,
    "rfc": null,
    "confidence": "medium",
    "warnings": [
      "RFC con formato inválido: ABC-123-456-XYZ"
    ]
  }
}
```

Nota: RFC se normalizó a `null` porque no cumple formato SAT (3-4 letras + 6 dígitos + 3 alfanuméricos).

---

## Caso 6: Error de API

### Input (GEMINI_API_KEY faltante o inválida)

### Response (Error)
```json
{
  "ok": false,
  "error": "GEMINI_API_KEY no configurada en Supabase Secrets"
}
```

HTTP Status: `500`

---

## Caso 7: Imagen Vacía

### Input
```bash
POST /scan-document
{
  "image_base64": "",
  "mime_type": "image/jpeg"
}
```

### Response (Error)
```json
{
  "ok": false,
  "error": "image_base64 requerido"
}
```

HTTP Status: `400`

---

## Caso 8: Método HTTP Incorrecto

### Input
```bash
GET /scan-document
```

### Response (Error)
```
Method not allowed
```

HTTP Status: `405`

---

## Caso 9: Recibo de Hotel (ISH)

### Imagen simulada
```
╔═══════════════════════════╗
║    HOTEL GRAND PLAZA      ║
║    RFC: HTL120101GAB      ║
║                           ║
║ Hospedaje (1 noche)       ║
║ Tipo: Suite Deluxe   1200 ║
║                           ║
║ Subtotal:       1200.00   ║
║ IVA (16%):       192.00   ║
║ ISH (3%):         36.00   ║
║ Total:          1428.00   ║
║                           ║
║ Check-in: 2026-06-22      ║
║ Check-out: 2026-06-23     ║
╚═══════════════════════════╝
```

### Response
```json
{
  "ok": true,
  "data": {
    "amount": 1428.00,
    "date": "2026-06-22",
    "vendor": "HOTEL GRAND PLAZA",
    "concept": "Hospedaje Suite Deluxe",
    "rfc": "HTL120101GAB",
    "confidence": "high",
    "warnings": []
  }
}
```

Nota: ISH (Impuesto al Hospedaje) se detecta automáticamente pero no se extrae en `scan-document` — se retorna solo el monto total.

---

## Caso 10: Gasolinera (IEPS)

### Imagen simulada
```
╔════════════════════════╗
║    GASOLINERA SHELL    ║
║    RFC: SHL120101AB1   ║
║                        ║
║ Gasolina Premium  100L ║
║                 4800.00║
║                        ║
║ Subtotal:     4800.00  ║
║ IEPS:          450.00  ║
║ IVA:           840.00  ║
║ Total:        6090.00  ║
║                        ║
║ Fecha: 2026-06-23      ║
║ Hora: 08:15            ║
╚════════════════════════╝
```

### Response
```json
{
  "ok": true,
  "data": {
    "amount": 6090.00,
    "date": "2026-06-23",
    "vendor": "GASOLINERA SHELL",
    "concept": "Gasolina Premium 100L",
    "rfc": "SHL120101AB1",
    "confidence": "high",
    "warnings": []
  }
}
```

Nota: IEPS se detecta en `ocr-extract` — `scan-document` retorna el monto total que ya incluye IEPS + IVA.

---

## Caso 11: Batch Processing (Múltiples imágenes)

### Client-side pseudocódigo
```typescript
import { processBatchReceipts } from '@/services/expenseOCR';

const images = [base64_1, base64_2, base64_3];
const results = await processBatchReceipts(images, userId, companyId);

console.log(`✅ ${results.success.length} procesadas`);
console.log(`❌ ${results.failed.length} fallaron`);
```

### Output esperado
```json
{
  "success": [
    {
      "amount": 244.18,
      "date": "2026-06-23",
      "vendor": "OXXO SAN PEDRO",
      "concept": "Gasolina + bebidas",
      "rfc": "OXX120101ABC",
      "confidence": "high",
      "warnings": []
    },
    {
      "amount": 17400.00,
      "date": "2026-06-21",
      "vendor": "ABC Corp S.A. de C.V.",
      "concept": "Servicio de Consultoría",
      "rfc": "ABC123456XYZ",
      "confidence": "high",
      "warnings": []
    }
  ],
  "failed": [
    {
      "image": "iVBORw0KGgo...",
      "error": "Imagen demasiado oscura"
    }
  ]
}
```

---

## Caso 12: Integración con Tabla expenses

### Después de extraer con scan-document:
```typescript
const scanned = await scanDocument(imageBase64);

// Registrar en BD
const { data: expense } = await supabase
  .from('expenses')
  .insert([{
    user_id: 'user123',
    company_id: 'company456',
    amount: scanned.amount,
    date: scanned.date,
    vendor_name: scanned.vendor,
    concept: scanned.concept,
    vendor_rfc: scanned.rfc,
    receipt_image_base64: imageBase64,
    extraction_confidence: scanned.confidence,
    extraction_warnings: scanned.warnings,
  }])
  .select()
  .single();
```

### Registro creado en BD:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "user123",
  "company_id": "company456",
  "amount": 244.18,
  "date": "2026-06-23",
  "vendor_name": "OXXO SAN PEDRO",
  "concept": "Gasolina + bebidas + snacks",
  "vendor_rfc": "OXX120101ABC",
  "receipt_image_base64": "iVBORw0KGgo...",
  "status": "draft",
  "extracted_from_ocr": true,
  "extraction_confidence": "high",
  "extraction_warnings": [],
  "created_at": "2026-06-23T15:45:30.123456Z",
  "updated_at": "2026-06-23T15:45:30.123456Z"
}
```

---

## Notas Importantes

1. **Confianza LOW** = Usuario debe revisar manualmente antes de enviar
2. **RFC se valida** contra formato SAT (3-4 letras + 6 dígitos + 3 alfanuméricos)
3. **Fecha debe estar** en formato YYYY-MM-DD (internamente)
4. **Monto es el TOTAL** (incluye impuestos, descuentos)
5. **Warnings se agregan automáticamente** si hay problemas de confianza

---

## Curls de Prueba

### Test 1: Con imagen válida
```bash
curl -X POST https://your-project.supabase.co/functions/v1/scan-document \
  -H "Content-Type: application/json" \
  -d '{
    "image_base64": "iVBORw0KGgoAAAANS...",
    "mime_type": "image/jpeg"
  }'
```

### Test 2: Sin imagen (error esperado)
```bash
curl -X POST https://your-project.supabase.co/functions/v1/scan-document \
  -H "Content-Type: application/json" \
  -d '{}'
```

Response:
```json
{"error": "image_base64 requerido"}
```

### Test 3: CORS preflight
```bash
curl -X OPTIONS https://your-project.supabase.co/functions/v1/scan-document \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type"
```

Response: `ok` (status 200)
