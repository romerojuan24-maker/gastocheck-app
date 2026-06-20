# 🖼️ OCR Shared Library — Reutilización de Rutinas Probadas

**Versión:** 1.0  
**Fecha:** 2026-06-20  
**Objetivo:** Centralizar lógica OCR para usar en GastoCheck, BancoCheck, FacturaCheck, etc.

---

## 📋 Situación Actual

### Código Existente
```
supabase/functions/ocr-extract/index.ts
├─ Edge Function en producción (GastoCheck)
├─ Motor: Gemini 1.5 Flash
├─ Extrae: Tickets, facturas, recibos
├─ Retorna: OcrResult (providerName, tax, total, etc)
└─ Features:
   ├─ JSON schema validation
   ├─ 3 estrategias de parseo fallback
   ├─ Normalización de RFC/UUID/montos
   ├─ Detección de confianza (high/medium/low)
   └─ Warnings automáticos
```

### Problema
- Código duplicado si necesitamos OCR para PDFs, facturas, etc
- Cambios futuros afectan múltiples funciones
- Prompts específicos acoplados al código

### Solución
**Refactorizar en `packages/shared/src/ocr-engine.ts`**
- Lógica central de OCR
- Prompts pluggables por tipo de documento
- Reutilizable en cualquier Edge Function
- Versionable y testeado

---

## 🏗️ Estructura Propuesta

### 1. Tipos Genéricos (`packages/shared/src/types/ocr.ts`)

```typescript
// Tipos de documento soportados
export enum OcrDocumentType {
  RECEIPT = 'RECEIPT',           // Tickets/recibos (GastoCheck)
  BANK_STATEMENT = 'BANK_STATEMENT',  // Estado de cuenta (BancoCheck)
  INVOICE = 'INVOICE',           // Facturas CFDI (FacturaCheck, CobraCheck)
  CUSTOM = 'CUSTOM',             // Genérico
}

// Interfaz genérica para resultados OCR
export interface OcrExtractionResult {
  type: OcrDocumentType;
  data: Record<string, any>;     // Específico del tipo
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
  metadata: {
    processedAt: string;
    mimeType: string;
    sourceSize: number;           // Bytes
    geminiModel: string;
    processingMs: number;
  };
}

// Interfaz para cada tipo de documento
export interface OcrReceipt {
  providerName: string | null;
  providerRfc: string | null;
  receiptDate: string | null;    // YYYY-MM-DD
  receiptTime: string | null;    // HH:MM
  subtotal: number | null;
  tax: number | null;
  discount: number | null;
  ieps: number | null;
  ish: number | null;
  retencionIva: number | null;
  retencionIsr: number | null;
  total: number | null;
  currency: string;
  fiscalUuid: string | null;
  internalFolio: string | null;
  paymentMethod: string | null;
  fullText: string;
  lineItems: OcrLineItem[];
}

export interface OcrBankStatement {
  bankName: string | null;
  accountNumber: string | null;
  accountType: string | null;     // CHEQUES, AHORROS, CRÉDITO
  estatementPeriod: {
    from: string;                 // YYYY-MM-DD
    to: string;
  };
  openingBalance: number;
  closingBalance: number;
  movements: OcrBankMovement[];
}

export interface OcrBankMovement {
  fecha: string;                  // YYYY-MM-DD
  concepto: string;
  monto: number;                  // Positivo = ingreso, negativo = egreso
  saldo: number;
  referencia?: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface OcrInvoice {
  // Similar a Receipt pero más específico para CFDI
  emisorRfc: string | null;
  receptorRfc: string | null;
  conceptos: OcrInvoiceLineItem[];
  // ... más campos
}

// Línea de item genérica
export interface OcrLineItem {
  name: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  totalPrice: number | null;
  confidence: number;
}
```

---

### 2. Engine Central (`packages/shared/src/ocr-engine.ts`)

```typescript
import { OcrDocumentType, OcrExtractionResult } from './types/ocr';

interface OcrEngineConfig {
  geminiApiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

interface OcrPrompt {
  system: string;
  user: (context: any) => string;
  schema: any;  // JSON schema for validation
}

export class OcrEngine {
  private config: OcrEngineConfig;
  private prompts: Map<OcrDocumentType, OcrPrompt>;
  private geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

  constructor(config: OcrEngineConfig) {
    this.config = config;
    this.prompts = new Map();
    this.registerDefaultPrompts();
  }

  // Registrar prompts específicos por tipo de documento
  registerPrompt(type: OcrDocumentType, prompt: OcrPrompt) {
    this.prompts.set(type, prompt);
  }

  // Extraer datos de imagen
  async extract(
    imageBase64: string,
    docType: OcrDocumentType,
    mimeType: string = 'image/jpeg'
  ): Promise<OcrExtractionResult> {
    const prompt = this.prompts.get(docType);
    if (!prompt) {
      throw new Error(`No prompt registered for type: ${docType}`);
    }

    const startMs = Date.now();
    
    try {
      const geminiRes = await fetch(`${this.geminiUrl}?key=${this.config.geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: imageBase64,
                  },
                },
                { text: prompt.user({}) },  // Usuario puede pasar contexto
              ],
            },
          ],
          generationConfig: {
            temperature: this.config.temperature ?? 0.1,
            maxOutputTokens: this.config.maxTokens ?? 8192,
            responseMimeType: 'application/json',
            responseSchema: prompt.schema,
          },
        }),
      });

      if (!geminiRes.ok) {
        const err = await geminiRes.text();
        console.error('Gemini error:', err);
        throw new Error(`Gemini API failed: ${err}`);
      }

      const geminiData = await geminiRes.json();
      const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

      // Parseo robusto (3 estrategias)
      let parsed = this.parseJson(rawText);

      if (!parsed) {
        throw new Error('Could not parse JSON from Gemini response');
      }

      // Validar contra schema
      this.validateAgainstSchema(parsed, prompt.schema);

      return {
        type: docType,
        data: parsed,
        confidence: parsed.confidence ?? 'low',
        warnings: parsed.warnings ?? [],
        metadata: {
          processedAt: new Date().toISOString(),
          mimeType,
          sourceSize: Math.ceil(imageBase64.length * 0.75),
          geminiModel: this.config.model ?? 'gemini-2.5-flash',
          processingMs: Date.now() - startMs,
        },
      };
    } catch (error) {
      console.error('OCR extraction failed:', error);
      throw error;
    }
  }

  // Parseo robusto (copiar de ocr-extract existente)
  private parseJson(text: string): any | null {
    if (!text) return null;

    // 1. Parseo directo
    try { return JSON.parse(text); } catch { /* continua */ }

    // 2. Strip markdown fences
    try {
      const stripped = text
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/i, '')
        .trim();
      return JSON.parse(stripped);
    } catch { /* continua */ }

    // 3. Extraer primer bloque JSON
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* null */ }
    }

    return null;
  }

  // Validar resultado contra schema
  private validateAgainstSchema(data: any, schema: any) {
    // Implementar validación AJV o similar
    // Por ahora, validación básica
    if (!data) throw new Error('Invalid data');
  }

  // Registrar prompts por defecto
  private registerDefaultPrompts() {
    // RECEIPT (GastoCheck)
    this.registerPrompt(OcrDocumentType.RECEIPT, {
      system: 'Eres experto en lectura de tickets, facturas y recibos mexicanos.',
      user: () => `Analiza esta imagen y extrae datos del recibo...`,
      schema: {
        type: 'object',
        properties: {
          providerName: { type: 'string', nullable: true },
          providerRfc: { type: 'string', nullable: true },
          receiptDate: { type: 'string', nullable: true },
          receiptTime: { type: 'string', nullable: true },
          subtotal: { type: 'number', nullable: true },
          tax: { type: 'number', nullable: true },
          total: { type: 'number', nullable: true },
          currency: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          warnings: { type: 'array', items: { type: 'string' } },
          lineItems: { type: 'array' },
        },
      },
    });

    // BANK_STATEMENT (BancoCheck)
    this.registerPrompt(OcrDocumentType.BANK_STATEMENT, {
      system: 'Eres experto en lectura de estados de cuenta bancarios.',
      user: () => `Extrae la tabla de movimientos del estado de cuenta...`,
      schema: {
        type: 'object',
        properties: {
          bankName: { type: 'string', nullable: true },
          accountNumber: { type: 'string', nullable: true },
          accountType: { type: 'string', nullable: true },
          estatementPeriod: {
            type: 'object',
            properties: {
              from: { type: 'string' },
              to: { type: 'string' },
            },
          },
          openingBalance: { type: 'number' },
          closingBalance: { type: 'number' },
          movements: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                fecha: { type: 'string' },
                concepto: { type: 'string' },
                monto: { type: 'number' },
                saldo: { type: 'number' },
              },
            },
          },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          warnings: { type: 'array', items: { type: 'string' } },
        },
      },
    });
  }
}
```

---

### 3. Uso en Edge Functions

#### Opción A: GastoCheck (Existente)

**Antes (ocr-extract actual):**
```typescript
// Código largo en ocr-extract/index.ts
const prompt = `INSTRUCCIÓN CRÍTICA: ...`
const geminiRes = await fetch(...)
```

**Después (refactorizado):**
```typescript
import { OcrEngine, OcrDocumentType } from '@gastocheck/shared';

const engine = new OcrEngine({
  geminiApiKey: Deno.env.get('GEMINI_API_KEY'),
});

const result = await engine.extract(imageBase64, OcrDocumentType.RECEIPT);
return Response.json({ ok: true, data: result.data });
```

#### Opción B: BancoCheck (Nuevo)

```typescript
// supabase/functions/extract-bank-statement/index.ts

import { OcrEngine, OcrDocumentType } from '@gastocheck/shared';

const engine = new OcrEngine({
  geminiApiKey: Deno.env.get('GEMINI_API_KEY'),
});

Deno.serve(async (req) => {
  const { pdf_pages_base64 } = await req.json();
  
  const movements = [];
  
  // Procesar cada página
  for (const page of pdf_pages_base64) {
    const result = await engine.extract(
      page,
      OcrDocumentType.BANK_STATEMENT,
      'image/png'  // PDF convertido a PNG
    );
    
    if (result.data.movements) {
      movements.push(...result.data.movements);
    }
  }
  
  // Crear entradas en BD...
  return Response.json({ movements, ok: true });
});
```

#### Opción C: FacturaCheck (Futuro)

```typescript
const result = await engine.extract(
  invoicePdf,
  OcrDocumentType.INVOICE
);
```

---

## 📊 Beneficios

| Aspecto | Antes | Después |
|--------|-------|---------|
| **Código duplicado** | Sí (ocr-extract) | No (centralizado) |
| **Prompts** | Acoplados en Edge Function | Pluggables, versionables |
| **Parseo** | Tres estrategias en `ocr-extract` | Una vez, reutilizable |
| **Normalización** | En `ocr-extract` | Centralizada en Engine |
| **Testing** | Manual | Unitario en library |
| **Mantenimiento** | Múltiples copies | Un solo lugar |
| **Nuevos tipos doc** | Duplicar todo | Solo registrar prompt |

---

## 🚀 Roadmap de Implementación

### Fase 1: Refactorizar (1-2 días)
```
1. Crear packages/shared/src/types/ocr.ts
2. Crear packages/shared/src/ocr-engine.ts
3. Actualizar ocr-extract para usar OcrEngine
4. Testing unitario de Engine
5. Verificar GastoCheck sigue funcionando igual
```

### Fase 2: BancoCheck (1 día)
```
1. Crear supabase/functions/extract-bank-statement/index.ts
2. Usar OcrEngine + OcrDocumentType.BANK_STATEMENT
3. Testing con PDFs reales
4. Integrar con reconciliación cruzada
```

### Fase 3: FacturaCheck (Futuro)
```
1. Registrar OcrDocumentType.INVOICE en Engine
2. Crear supabase/functions/extract-invoice/index.ts
3. Reutilizar todo lo anterior
```

---

## 🔐 Consideraciones Técnicas

### Versionado de OCR Engine
```typescript
// En package.json de packages/shared
{
  "version": "1.0.0",
  "exports": {
    "./ocr": "./src/ocr-engine.ts",
    "./types": "./src/types/ocr.ts"
  }
}

// Cambios en schema de Gemini → bump minor version
// Cambios en prompts → patch version
```

### Testing
```typescript
// packages/shared/src/__tests__/ocr-engine.test.ts

describe('OcrEngine', () => {
  it('should extract receipt data', async () => {
    const engine = new OcrEngine({ geminiApiKey: 'test-key' });
    // Mock Gemini response
    // Verify extraction
  });

  it('should parse JSON robustly', () => {
    const result = engine['parseJson']('```json\n{...}\n```');
    expect(result).toBeDefined();
  });
});
```

---

## 📝 Checklist de Migración

- [ ] Crear types/ocr.ts
- [ ] Crear ocr-engine.ts
- [ ] Refactorizar ocr-extract para usar Engine
- [ ] Testing ocr-extract (debe funcionar igual)
- [ ] Crear extract-bank-statement usando Engine
- [ ] Testing extract-bank-statement con PDFs
- [ ] Documentar cómo registrar nuevos tipos
- [ ] Actualizar BANCOCHECK_ARCHITECTURE.md con referencia
- [ ] Preparar para FacturaCheck (futuro)

---

**Beneficio clave:** Una sola rutina OCR, múltiples documentos, cero duplicación.
