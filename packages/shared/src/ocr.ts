// OCR/Scanner Hook — Usado por GastoCheck, CobraCheck, FacturaCheck, InventarioCheck
// Llama a la Edge Function `ocr-extract` con Gemini 1.5 Flash
// Re-exporta tipos OcrResult para uso en todo el monorepo

export interface OcrLineItem {
  name: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  totalPrice: number | null;
  confidence: number;
}

export interface OcrResult {
  providerName: string | null;
  providerRfc: string | null;
  receiptDate: string | null; // YYYY-MM-DD
  receiptTime: string | null; // HH:MM
  subtotal: number | null;
  tax: number | null; // IVA
  discount: number | null;
  ieps: number | null; // IEPS combustibles/alcohol/tabaco
  ish: number | null; // Impuesto al Hospedaje (~3%)
  retencionIva: number | null; // Retención IVA (honorarios, arrendamiento)
  retencionIsr: number | null; // Retención ISR (honorarios, arrendamiento)
  total: number | null;
  currency: string;
  fiscalUuid: string | null; // UUID CFDI timbrado
  internalFolio: string | null;
  paymentMethod: string | null; // efectivo, tarjeta, transferencia
  fullText: string;
  lineItems: OcrLineItem[];
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
  documentBox: { x0: number; y0: number; x1: number; y1: number } | null; // recorte 0-1
}

export interface OcrHookReturn {
  data: OcrResult | null;
  error: string | null;
  croppedImageBase64: string | null;
}

// Hook Hook signature (para que Expo/React Native pueda usarlo)
// Implementación se encuentra en apps/mobile/hooks/useOcr.ts (que re-exporta desde aquí)
export type UseOcrFn = (
  base64: string,
  mimeType?: string,
) => Promise<OcrHookReturn>;
